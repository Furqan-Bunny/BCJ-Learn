import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModule } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCertificateSettings } from "@/lib/db/settings";
import { CertificateView } from "./certificate-view";

const LOGO_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/branding/bcj-logo.png`;

// A printable completion certificate. Only the employee who PASSED this module
// can see it — derived purely from their passed attempt + the module.
export default async function CertificatePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [mod, myAttempts, certSettings] = await Promise.all([
    getModule(slug),
    listAttemptsForManager(me.id),
    getCertificateSettings(),
  ]);
  if (!mod) return notFound();

  // Best passed attempt for this module (highest score).
  const passed = myAttempts
    .filter((a) => a.moduleSlug === slug && a.status === "passed")
    .sort((a, b) => Number(b.scorePct) - Number(a.scorePct))[0];
  if (!passed) return notFound(); // no certificate until they pass

  return (
    <CertificateView
      name={me.name}
      moduleTitle={mod.title}
      moduleNumber={mod.number}
      scorePct={Math.round(Number(passed.scorePct))}
      passedAt={passed.submittedAt ?? passed.startedAt}
      moduleSlug={slug}
      settings={certSettings}
      logoUrl={LOGO_URL}
    />
  );
}
