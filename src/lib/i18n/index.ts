// Lightweight, toggle-based i18n (no URL routing). The employee experience
// switches between English and Spanish from `profiles.locale`. Keys are flat,
// namespaced strings ("quiz.start"); a missing key falls back to English, then
// to the key itself, so nothing ever renders blank. Interpolate with {var}.

import { en } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";

const DICTS: Record<Locale, Record<string, string>> = { en, es };

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? en;
  let s = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

/** Server-side translator bound to a locale. */
export function getT(locale: Locale): TFunc {
  return (key, vars) => t(locale, key, vars);
}

export function normalizeLocale(raw: string | null | undefined): Locale {
  return raw === "es" ? "es" : "en";
}

/**
 * Pick the localized variant of an admin-authored string (module/lesson/
 * resource title or description). Falls back to English whenever the Spanish
 * value is missing/blank, so reads never render empty for 'es' employees.
 */
export function pickLocale(
  en: string | null | undefined,
  es: string | null | undefined,
  locale: Locale,
): string {
  if (locale === "es" && es && es.trim()) return es;
  return en ?? "";
}
