// Resolve a branding_settings.logo_path into a usable URL.
// The `branding` bucket is public, so a stored path becomes a public URL.
// A full URL (already resolved) is returned untouched.

export function resolveBrandingLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  if (logoPath.startsWith("http")) return logoPath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/branding/${logoPath}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// Build a CSS string that overrides the brand color tokens from the admin's
// saved branding. Scoped to `:root:not(.dark)` so it applies in LIGHT mode only
// (dark mode keeps its tuned, readable scale). Invalid/empty colors are skipped
// so the globals.css defaults remain. Returns "" when there's nothing to apply.
export function buildBrandingCss(
  primaryColor?: string | null,
  accentColor?: string | null,
): string {
  const decls: string[] = [];
  if (primaryColor && HEX.test(primaryColor)) {
    decls.push(
      `--primary:${primaryColor}`,
      `--brand:${primaryColor}`,
      `--ring:${primaryColor}`,
      `--sidebar-primary:${primaryColor}`,
      `--sidebar-ring:${primaryColor}`,
      `--chart-1:${primaryColor}`,
    );
  }
  if (accentColor && HEX.test(accentColor)) {
    decls.push(`--gold:${accentColor}`, `--chart-2:${accentColor}`);
  }
  if (decls.length === 0) return "";
  return `:root:not(.dark){${decls.join(";")};}`;
}
