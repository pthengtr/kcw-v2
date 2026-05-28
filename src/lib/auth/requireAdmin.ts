import { createClient } from "@/lib/supabase/server";

export type RequireAdminResult =
  | { ok: true; userEmail: string }
  | { ok: false; status: 401 | 403; message: string };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("kcw_admin")
    .select("user_id")
    .eq("user_id", user.email)
    .limit(1);

  if (error) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  if (!data || data.length === 0) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, userEmail: user.email };
}

