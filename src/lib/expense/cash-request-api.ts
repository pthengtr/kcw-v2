import { ROLE_ADMIN } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AuthFail = {
  ok: false;
  status: 401 | 403;
  message: string;
};

type AuthOk = {
  ok: true;
  /** User-scoped client (RLS applies). */
  supabase: Awaited<ReturnType<typeof createClient>>;
  /** Service-role client for privileged reads after auth. */
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  userEmail: string;
  isAdmin: boolean;
};

async function loadExpenseCashAuth(): Promise<AuthOk | AuthFail> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const { data: roles } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", user.id);
  const keys = (roles ?? []).map((r) => r.role_key as string);
  if (keys.length === 0) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return {
    ok: true,
    supabase,
    admin: createAdminClient(),
    userId: user.id,
    userEmail: user.email ?? "unknown",
    isAdmin: keys.includes(ROLE_ADMIN),
  };
}

/** Any signed-in staff with a role may view cash requests (approve stays admin). */
export async function requireExpenseCashViewer() {
  return loadExpenseCashAuth();
}

export async function requireExpenseCashAdmin() {
  const auth = await loadExpenseCashAuth();
  if (!auth.ok) return auth;
  if (!auth.isAdmin) {
    return { ok: false as const, status: 403 as const, message: "Admin only" };
  }
  return auth;
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
