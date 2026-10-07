import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  externalPortalAccess,
  isExternalPortalUser,
} from "@/lib/auth/external-portal";

// /liff is LINE WebView only (no Supabase login). Trust boundary stays in kcw-api webhook.
const PUBLIC_PATH_PREFIXES = ["/login", "/auth", "/error", "/no-access", "/liff"];
const PUBLIC_EXACT_PATHS = new Set(["/manifest.webmanifest", "/sw.js"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api");

  // Layer 0: must be signed in for app pages (APIs handle their own 401).
  if (!user && !isApi && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Layer 1: signed-in users must have at least one role.
  // Layer 2 (page permissions) is enforced in requirePermission / UI.
  // External users are limited to the statement portal.
  if (user && !isPublicPath(pathname)) {
    const { data: roles, error } = await supabase
      .from("kcw_user_roles")
      .select("role_key")
      .eq("user_id", user.id);

    const roleKeys = (roles ?? []).map((row) => row.role_key as string);
    const hasRole = !error && roleKeys.length > 0;

    if (!hasRole) {
      if (isApi) {
        return NextResponse.json(
          { error: "No role assigned" },
          { status: 403 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      return NextResponse.redirect(url);
    }

    if (isExternalPortalUser(roleKeys)) {
      const access = externalPortalAccess(pathname, request.method);
      if (access === "deny") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (access === "redirect") {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
