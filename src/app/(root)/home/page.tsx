import { Grid3X3 } from "lucide-react";

import { getMyCookie } from "@/app/(root)/action";
import FavoriteMenuSection from "@/components/home/FavoriteMenuSection";
import WorkspaceTodoSection from "@/components/home/WorkspaceTodoSection";
import { FAVORITES_COOKIE_KEY, parseFavoriteKeys } from "@/lib/home/favorites";
import { fetchWorkspaceTodos } from "@/lib/home/workspace-todos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getDisplayName(metadata: Record<string, unknown> | undefined) {
  const candidate = [
    metadata?.display_name,
    metadata?.full_name,
    metadata?.name,
  ].find((value): value is string => typeof value === "string" && !!value.trim());

  return candidate?.trim();
}

function getAdminClientOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName = getDisplayName(
    user?.user_metadata as Record<string, unknown> | undefined
  );
  const currentYear = new Date().getFullYear();
  const favoriteKeys = parseFavoriteKeys(
    await getMyCookie(FAVORITES_COOKIE_KEY)
  );
  const adminClient = getAdminClientOrNull() ?? supabase;
  const workspaceTodos = await fetchWorkspaceTodos({
    userClient: supabase,
    adminClient,
  });

  return (
    <main className="min-h-full bg-slate-50/70">
      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              สวัสดี{displayName ? `, ${displayName}` : ""} 👋
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              จัดการงานของคุณได้อย่างง่ายและรวดเร็ว
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm">
            <Grid3X3 className="h-4 w-4 text-blue-600" aria-hidden />
            KCW Workspace
          </div>
        </header>

        <FavoriteMenuSection initialKeys={favoriteKeys} />

        <WorkspaceTodoSection items={workspaceTodos} />

        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
          © {currentYear} KCW. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
