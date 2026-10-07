import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { normalizeSalesBillDocType } from "@/lib/sales/bill-detail";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  billno: z.string().trim().min(1).max(40),
  doc_type: z.string().trim().max(20).optional(),
});

type BillLine = {
  bcode?: string | null;
  detail?: string | null;
  qty?: number | string | null;
  ui?: string | null;
  price?: number | string | null;
  amount?: number | string | null;
};

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
    billno: url.searchParams.get("billno") ?? "",
    doc_type: url.searchParams.get("doc_type") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const docType = normalizeSalesBillDocType(parsed.data.billno, parsed.data.doc_type);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fn_sales_bill_detail", {
    p_doc_type: docType,
    p_billno: parsed.data.billno.trim(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }

  const bill = data as {
    doc_type?: string;
    billno?: string;
    bill_date?: string | null;
    acctname?: string | null;
    po?: string | null;
    beforetax?: number | string | null;
    tax?: number | string | null;
    aftertax?: number | string | null;
    discount?: number | string | null;
    canceled?: boolean;
    lines?: BillLine[];
  };

  return NextResponse.json({
    doc_type: String(bill.doc_type ?? docType),
    billno: String(bill.billno ?? parsed.data.billno.trim()),
    bill_date: bill.bill_date ?? null,
    acctname: bill.acctname ?? null,
    po: bill.po ?? null,
    beforetax: num(bill.beforetax),
    tax: num(bill.tax),
    aftertax: num(bill.aftertax),
    discount: num(bill.discount),
    canceled: Boolean(bill.canceled),
    lines: (bill.lines ?? []).map((line) => ({
      bcode: line.bcode ?? null,
      detail: line.detail ?? null,
      qty: num(line.qty),
      ui: line.ui ?? null,
      price: num(line.price),
      amount: num(line.amount),
    })),
  });
}
