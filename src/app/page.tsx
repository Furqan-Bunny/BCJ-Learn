import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types";

const ROLE_HOME: Record<Role, string> = {
  manager: "/manager/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
};

// Root entry. Resolves the signed-in user's role server-side and sends them to
// their dashboard; signed-out visitors go to /login.
//
// This MUST be role-aware (not a blind redirect to /login): the auth middleware
// bounces an authenticated user off /login back to "/", so if "/" simply
// redirected to /login again we'd ping-pong forever (ERR_TOO_MANY_REDIRECTS).
// An authenticated user is therefore always routed INTO the app — even if their
// profile role can't be read we default to "manager" rather than bounce back.
export default async function Home() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // No session → login. (Middleware won't bounce this back: there is no user.)
  if (!user) redirect("/login");

  const { data } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = ((data as { role?: Role } | null)?.role ?? "manager") as Role;

  redirect(ROLE_HOME[role]);
}
