import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return NextResponse.json({ pageKeys: [], roleKeys: [] }, { status: 200 });
  }

  const { data: roles } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", user.id);

  const roleKeys = (roles ?? []).map((r) => r.role_key as string);

  if (roleKeys.includes("admin")) {
    return NextResponse.json({ pageKeys: ["*"], roleKeys });
  }

  if (roleKeys.length === 0) {
    return NextResponse.json({ pageKeys: [], roleKeys });
  }

  const { data: perms } = await supabase
    .from("kcw_role_page_permissions")
    .select("page_key")
    .in("role_key", roleKeys);

  return NextResponse.json({
    pageKeys: Array.from(new Set((perms ?? []).map((p) => p.page_key as string))),
    roleKeys,
  });
}

