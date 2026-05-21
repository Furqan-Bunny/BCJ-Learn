// Resolve a branding_settings.logo_path into a usable URL.
// The `branding` bucket is public, so a stored path becomes a public URL.
// A full URL (already resolved) is returned untouched.

export function resolveBrandingLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  if (logoPath.startsWith("http")) return logoPath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/branding/${logoPath}`;
}
