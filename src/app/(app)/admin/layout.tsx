// Section guard for /admin/* — keeps employees (managers) out of the staff UI,
// even if they type an /admin URL directly. Admins and Department Leads pass
// (leads reach a few shared /admin detail pages from their own flows). The real
// data is also RLS-protected; this stops the staff shell from rendering at all
// for managers. Skipped in demo mode (role is picked client-side there).

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role === "manager") redirect("/manager/dashboard");
  }
  return <>{children}</>;
}
