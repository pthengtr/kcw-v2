import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const permCheck = await requirePermission(ONLINE_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.message }, { status: permCheck.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("curated_kcw")
    .from("online_statement_uploads")
    .select(
      "id, format, shop, original_filename, status, row_count, error_message, created_at, applied_at"
    )
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ uploads: data ?? [] });
}
