import { ArrowRight, Grid3X3 } from "lucide-react";
import Link from "next/link";

import { getMyCookie } from "@/app/(root)/action";
import FavoriteMenuSection from "@/components/home/FavoriteMenuSection";
import WorkspaceTodoSection from "@/components/home/WorkspaceTodoSection";
import { FAVORITES_COOKIE_KEY, parseFavoriteKeys } from "@/lib/home/favorites";
import { HOME_MENU_GROUPS, type HomeMenuGroup } from "@/lib/home/menu";
import { fetchWorkspaceTodos } from "@/lib/home/workspace-todos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function MenuGroupCard({ group }: { group: HomeMenuGroup }) {
  return (
    <section
      className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
      aria-labelledby={`group-${group.title}`}
    >
      <h3
        id={`group-${group.title}`}
        className="text-sm font-bold text-slate-900"
      >
        {group.title}
      </h3>
      <div className="mt-3 divide-y divide-slate-100">
        {group.items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 py-3 outline-none first:pt-1 last:pb-0 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${item.iconSurfaceClassName}`}
              >
                <Icon
                  className={`h-4 w-4 ${item.iconClassName}`}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-700 transition-colors group-hover:text-blue-700">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

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
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50/70">
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

        <section className="mt-8" aria-labelledby="all-tools">
          <h2
            id="all-tools"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            เครื่องมือทั้งหมด
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {HOME_MENU_GROUPS.map((group) => (
              <MenuGroupCard key={group.title} group={group} />
            ))}
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
          © {currentYear} KCW. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
