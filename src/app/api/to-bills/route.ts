import { NextResponse } from "next/server";

import { isExternalPortalUser } from "@/lib/auth/external-portal";
import { requirePermission } from "@/lib/auth/requirePermission";
import { SALES_BILL_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { isHqTadBillno } from "@/lib/sales/to-bill";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BILLS = 200;

async function canCreate(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", userId);
  const roles = (data ?? []).map((row) => String(row.role_key ?? ""));
  return !isExternalPortalUser(roles);
}

function createBaseUrl(): string {
  return (process.env.TO_BILL_APP_URL ?? "").trim().replace(/\/$/, "");
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(SALES_BILL_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
  }

  const url = new URL(req.url);
  const billnos = [
    ...new Set(
      (url.searchParams.get("billnos") ?? "")
        .split(",")
        .map((part) => part.trim().toUpperCase())
        .filter((part) => isHqTadBillno(part) && part.length <= 40)
    ),
  ].slice(0, MAX_BILLS);

  const allowCreate = await canCreate(permCheck.userId);
  const base = allowCreate ? createBaseUrl() : "";
  if (billnos.length === 0) {
    return NextResponse.json({ rows: [], can_create: allowCreate, create_base_url: base });
  }

  const supabase = createAdminClient();
  const query = supabase
    .schema("to_bill")
    .from("invoices")
    .select("invoice_id,tad_billno,docno,status")
    .in("tad_billno", billnos)
    .in("status", allowCreate ? ["draft", "issued"] : ["issued"]);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (data ?? []).map((row) => ({
      invoice_id: row.invoice_id,
      tad_billno: row.tad_billno,
      docno: row.docno,
      status: row.status,
    })),
    can_create: allowCreate,
    create_base_url: base,
  });
}
