import { createClient } from "@/lib/supabase/server";
import { ROLE_ADMIN, pageKeysMatching } from "./rbac-pages";

export type RequirePermissionResult =
  | { ok: true; userId: string; userEmail: string }
  | { ok: false; status: 401 | 403; message: string };

export async function requirePermission(
  pageKey: string
): Promise<RequirePermissionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const userId = user.id;
  const userEmail = user.email ?? "unknown";

  const { data: userRoles, error: rolesError } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", userId);

  if (rolesError) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  const roleKeys = (userRoles ?? []).map((r) => r.role_key as string);

  if (roleKeys.includes(ROLE_ADMIN)) {
    return { ok: true, userId, userEmail };
  }

  // Layer 1 already required a role in middleware; empty here is still deny.
  if (roleKeys.length === 0) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  // Layer 2: page_key must be granted to one of the user's roles.
  const { data: allowed, error: allowedError } = await supabase
    .from("kcw_role_page_permissions")
    .select("page_key")
    .in("role_key", roleKeys)
    .in("page_key", pageKeysMatching(pageKey))
    .limit(1);

  if (allowedError) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  if (!allowed || allowed.length === 0) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, userId, userEmail };
}

