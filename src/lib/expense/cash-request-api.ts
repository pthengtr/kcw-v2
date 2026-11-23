import { ROLE_ADMIN } from "@/lib/auth/rbac-pages";
import { createClient } from "@/lib/supabase/server";

export async function requireExpenseCashAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    return { ok: false as const, status: 401 as const, message: "Unauthorized" };
  }
  const { data: roles } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", user.id);
  const keys = (roles ?? []).map((r) => r.role_key as string);
  if (!keys.includes(ROLE_ADMIN)) {
    return { ok: false as const, status: 403 as const, message: "Admin only" };
  }
  return {
    ok: true as const,
    supabase,
    userId: user.id,
    userEmail: user.email ?? "unknown",
  };
}

export function expenseCashApiBase(): string {
  return (
    process.env.KCW_API_PUBLIC_URL ||
    process.env.EXPENSE_CASH_API_BASE_URL ||
    "https://kcw-api-production.up.railway.app"
  ).replace(/\/$/, "");
}

export function expenseCashSecret(): string {
  return (process.env.EXPENSE_CASH_INTERNAL_SECRET || "").trim();
}

export async function callExpenseCashApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const secret = expenseCashSecret();
  if (!secret) {
    throw new Error("EXPENSE_CASH_INTERNAL_SECRET is not configured");
  }
  const url = `${expenseCashApiBase()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Expense-Cash-Secret": secret,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}
