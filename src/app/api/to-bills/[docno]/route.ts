import { NextResponse } from "next/server";

import { isExternalPortalUser } from "@/lib/auth/external-portal";
import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DOCNO = /^TO\d{4}-\d{3,}$/;

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ docno: string }> }
) {
  const permCheck = await requirePermission(SALES_BILL_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
  }

  const { docno } = await context.params;
  const key = decodeURIComponent(docno).trim().toUpperCase();
  if (!DOCNO.test(key)) {
    return NextResponse.json({ error: "เลขที่ใบเต็มไม่ถูกต้อง" }, { status: 400 });
  }

  const userClient = await createClient();
  const { data: roles } = await userClient
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", permCheck.userId);
  const internal = !isExternalPortalUser(
    (roles ?? []).map((row) => String(row.role_key ?? ""))
  );

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("to_bill")
    .from("invoices")
    .select(
      "invoice_id,docno,status,tad_billno,bill_date,customer_name,address,phone,tax_id,branch_label,email,beforetax,tax,aftertax,discount,online_po,void_reason"
    )
    .eq("docno", key)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || (!internal && data.status !== "issued")) {
    return NextResponse.json({ error: "ไม่พบใบเต็ม" }, { status: 404 });
  }

  const linesRes = await supabase
    .schema("to_bill")
    .from("lines")
    .select("line_no,bcode,detail,qty,ui,price,amount")
    .eq("invoice_id", data.invoice_id)
    .order("line_no");
  if (linesRes.error) {
    return NextResponse.json({ error: linesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    docno: data.docno,
    status: data.status,
    tad_billno: data.tad_billno,
    bill_date: data.bill_date,
    customer_name: data.customer_name,
    address: data.address,
    phone: data.phone,
    tax_id: data.tax_id,
    branch_label: data.branch_label,
    email: data.email,
    online_po: data.online_po,
    beforetax: num(data.beforetax),
    tax: num(data.tax),
    aftertax: num(data.aftertax),
    discount: num(data.discount),
    void_reason: data.void_reason,
    lines: (linesRes.data ?? []).map((line) => ({
      bcode: line.bcode,
      detail: line.detail,
      qty: num(line.qty),
      ui: line.ui,
      price: num(line.price),
      amount: num(line.amount),
    })),
  });
}
