import { getBrandingSettings } from "@/lib/db/settings";
import { resolveBrandingLogoUrl } from "@/lib/branding";
import { BrandingView } from "./branding-view";

export default async function BrandingSettingsPage() {
  const initial = await getBrandingSettings();
  return <BrandingView initial={initial} initialLogoUrl={resolveBrandingLogoUrl(initial.logoPath)} />;
}
