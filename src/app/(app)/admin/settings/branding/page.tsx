import { getBrandingSettings } from "@/lib/db/settings";
import { BrandingView } from "./branding-view";

export default async function BrandingSettingsPage() {
  const initial = await getBrandingSettings();
  return <BrandingView initial={initial} />;
}
