import { createClient } from "@/lib/supabase/server";
import { ROLE_ADMIN } from "./rbac-pages";

export type MyPageAccess = {
  roleKeys: string[];
  pageKeys: string[];
};

export async function getMyPageAccess(): Promise<MyPageAccess> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return { pageKeys: [], roleKeys: [] };
  }

  const { data: roles } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", user.id);

  const roleKeys = (roles ?? []).map((r) => r.role_key as string);

  if (roleKeys.includes(ROLE_ADMIN)) {
    return { pageKeys: ["*"], roleKeys };
  }

  if (roleKeys.length === 0) {
    return { pageKeys: [], roleKeys };
  }

  const { data: perms } = await supabase
    .from("kcw_role_page_permissions")
    .select("page_key")
    .in("role_key", roleKeys);

  return {
    pageKeys: Array.from(
      new Set((perms ?? []).map((p) => p.page_key as string))
    ),
    roleKeys,
  };
}
