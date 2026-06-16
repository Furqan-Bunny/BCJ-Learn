import { getCertificateSettings, getBrandingSettings } from "@/lib/db/settings";
import { resolveBrandingLogoUrl } from "@/lib/branding";
import { CertificateSettingsView } from "./certificate-settings-view";

export default async function CertificateSettingsPage() {
  const [initial, branding] = await Promise.all([getCertificateSettings(), getBrandingSettings()]);
  return <CertificateSettingsView initial={initial} logoUrl={resolveBrandingLogoUrl(branding.logoPath)} />;
}
