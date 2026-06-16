// Section guard for /teacher/* — keeps employees (managers) out of the
// Department Lead UI, even via a direct URL. Leads and Admins pass. Per-module
// ownership is still enforced page-by-page (getAccessibleModuleOr404). Skipped
// in demo mode (role is picked client-side there).

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default async function TeacherSectionLayout({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role === "manager") redirect("/manager/dashboard");
  }
  return <>{children}</>;
}
