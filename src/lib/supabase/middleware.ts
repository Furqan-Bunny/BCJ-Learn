// Supabase auth middleware helper.
// Wired into Next.js via the root middleware.ts.
// Refreshes the user's session on every request and gates protected routes.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Paths that don't need the session gate.
//  • /auth/* are the auth-handling pages (callback, confirm, accept-invite,
//    reset-password). Their session arrives in the URL (hash/code) and is
//    processed client-side, so the server gate must NOT bounce them to /login.
//  • /api/* routes authenticate themselves (e.g. /api/cron/* checks CRON_SECRET).
const PUBLIC_PATHS = ["/login", "/auth", "/api"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do NOT add code between createServerClient() and getUser().
  // Reading the user refreshes the session and is what the middleware exists to do.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // In demo mode, skip the auth gate so the role-pick modal still works for demos.
  if (DEMO_MODE) {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // Unauthenticated → redirect to /login for protected paths.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated but on /login → redirect to home (will be role-resolved client-side).
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
