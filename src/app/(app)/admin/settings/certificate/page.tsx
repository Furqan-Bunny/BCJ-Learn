import { getCertificateSettings } from "@/lib/db/settings";
import { CertificateSettingsView } from "./certificate-settings-view";

export default async function CertificateSettingsPage() {
  const initial = await getCertificateSettings();
  return <CertificateSettingsView initial={initial} />;
}
