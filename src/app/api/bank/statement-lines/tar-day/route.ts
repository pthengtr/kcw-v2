import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { saleBillTakesFifo } from "@/lib/bank/fifo-margin";
import { loadSaleFifo } from "@/lib/bank/fifo-margin-query";
import { summarizeTarDayBills, type TarDayBill } from "@/lib/bank/tar-day";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  series: z.enum(["hq", "syp"]),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { date, series } = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("bank").rpc("fn_tar_day_bills", {
    p_billdate: date,
    p_series: series,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bills: TarDayBill[] = (data ?? []).map((row: TarDayBill) => ({
    doc_type: String(row.doc_type ?? ""),
    billno: String(row.billno ?? ""),
    amount: Number(row.amount ?? 0),
  }));
  const totals = summarizeTarDayBills(bills);
  const saleBillnos = bills
    .filter((bill) => saleBillTakesFifo(bill.billno, bill.doc_type))
    .map((bill) => bill.billno);
  let fifo: Awaited<ReturnType<typeof loadSaleFifo>> = [];
  let fifoError: string | null = null;
  try {
    fifo = await loadSaleFifo(saleBillnos, series);
  } catch (err: unknown) {
    fifoError = err instanceof Error ? err.message : "โหลดต้นทุน FIFO ไม่สำเร็จ";
  }

  return NextResponse.json({
    date,
    series,
    bills,
    fifo,
    fifo_error: fifoError,
    ...totals,
  });
}
