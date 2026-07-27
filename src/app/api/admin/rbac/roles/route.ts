import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ADMIN_RBAC_PAGE } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const permCheck = await requirePermission(ADMIN_RBAC_PAGE);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("kcw_roles")
    .select("role_key,title,description")
    .order("title");

  if (error) {
    return NextResponse.json(
      { error: "Unable to load roles" },
      { status: 500 }
    );
  }

  return NextResponse.json({ roles: data ?? [] });
}

