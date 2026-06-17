import { notFound, redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { getModuleSummariesBySlugs } from "@/lib/db/modules";
import { listAttemptsForManager } from "@/lib/db/attempts";
import { getCertificateSettings, getBrandingSettings } from "@/lib/db/settings";
import { resolveBrandingLogoUrl } from "@/lib/branding";
import { CertificateView } from "./certificate-view";

// A printable completion certificate. Only the employee who PASSED this module
// can see it — gated purely on their passed attempt (RLS-safe). The module's
// title/number are resolved via service-role so the certificate still renders
// even when the manager can't directly read the modules table (e.g. they're no
// longer a current invitee). The pass itself is the authorisation.
export default async function CertificatePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const me = await getCurrentUserForRole("manager");
  if (!me) redirect("/login");

  const [myAttempts, certSettings, branding] = await Promise.all([
    listAttemptsForManager(me.id),
    getCertificateSettings(),
    getBrandingSettings(),
  ]);

  // Best passed attempt for this module (highest score). Gate FIRST — no pass,
  // no certificate, regardless of module visibility.
  const passed = myAttempts
    .filter((a) => a.moduleSlug === slug && a.status === "passed")
    .sort((a, b) => Number(b.scorePct) - Number(a.scorePct))[0];
  if (!passed) return notFound();

  const summary = (await getModuleSummariesBySlugs([slug], me.locale)).get(slug);
  if (!summary) return notFound(); // module no longer exists

  return (
    <CertificateView
      name={me.name}
      moduleTitle={summary.title}
      moduleNumber={summary.number}
      scorePct={Math.round(Number(passed.scorePct))}
      passedAt={passed.submittedAt ?? passed.startedAt}
      moduleSlug={slug}
      settings={certSettings}
      logoUrl={resolveBrandingLogoUrl(branding.logoPath) ?? ""}
    />
  );
}
