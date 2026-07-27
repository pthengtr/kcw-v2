import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("bank")
    .from("statement_import_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ row: data });
}

