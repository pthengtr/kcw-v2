"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { loginDestination } from "@/lib/auth/external-portal";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data);

  if (error || !signInData.user) {
    console.log(error?.message ?? "Login failed");
    redirect("/error");
  }

  const { data: roles } = await supabase
    .from("kcw_user_roles")
    .select("role_key")
    .eq("user_id", signInData.user.id);

  const roleKeys = (roles ?? []).map((row) => row.role_key as string);
  const nextRaw = formData.get("next");
  const nextPath = typeof nextRaw === "string" ? nextRaw : null;

  revalidatePath("/home", "layout");
  redirect(loginDestination(roleKeys, nextPath));
}

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/error");
  }

  revalidatePath("/home", "layout");
  redirect("/home");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}
