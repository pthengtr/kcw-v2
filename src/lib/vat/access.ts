import { isExternalPortalUser } from "@/lib/auth/external-portal";
import {
  requirePermission,
  type RequirePermissionResult,
} from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createClient } from "@/lib/supabase/server";

export async function requireVatRegisterRead(): Promise<RequirePermissionResult> {
  return requirePermission(BI_PAGE_KEYS.vatRegister);
}

export async function requireVatRegisterWrite(): Promise<RequirePermissionResult> {
  const perm = await requirePermission(BI_PAGE_KEYS.vatRegister);
  if (!perm.ok) return perm;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", perm.userId);

  if (error) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  const roleKeys = (data ?? []).map((row) => row.role_key as string);
  if (isExternalPortalUser(roleKeys)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return perm;
}
