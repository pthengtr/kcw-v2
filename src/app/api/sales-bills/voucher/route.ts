import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  voucher: z.string().trim().min(1).max(40),
});

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(SALES_BILL_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    voucher: url.searchParams.get("voucher") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fn_voucher_bills", {
    p_voucher_no: parsed.data.voucher,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bills = (data ?? []).map((row: {
    source?: string;
    doc_type?: string;
    billno?: string;
    bill_date?: string | null;
    acctname?: string | null;
    amount?: number | string | null;
    canceled?: boolean;
  }) => ({
    source: row.source === "purchase" ? "purchase" : "sales",
    doc_type: String(row.doc_type ?? ""),
    billno: String(row.billno ?? "").trim(),
    bill_date: row.bill_date ?? null,
    acctname: row.acctname ?? null,
    amount: num(row.amount),
    canceled: Boolean(row.canceled),
  })).filter((row: { billno: string }) => row.billno !== "");

  return NextResponse.json({
    voucher_no: parsed.data.voucher,
    bills,
  });
}
