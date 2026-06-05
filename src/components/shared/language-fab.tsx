"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { setLocale } from "@/lib/server/locale-actions";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * Small floating English/Español switch, bottom-right. Employee-only (mounted
 * for managers in the app layout). Flips to the other language in one tap,
 * saves it to the profile, and refreshes so the whole app updates.
 */
export function LanguageFab() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    if (busy) return;
    const next = locale === "es" ? "en" : "es";
    setBusy(true);
    const res = await setLocale(next);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not change language"); return; }
    toast.success(t("lang.saved"));
    router.refresh();
  }

  // The chip shows the language you'll switch TO (the action), e.g. "Español".
  const target = locale === "es" ? t("lang.english") : t("lang.spanish");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={target}
      aria-label={target}
      className="print:hidden fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full
                 bg-primary text-primary-foreground shadow-lg shadow-primary/25
                 pl-3 pr-4 py-2.5 text-sm font-medium
                 transition-all hover:shadow-xl hover:brightness-110 active:scale-95
                 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      <Languages className="size-4" />
      <span className="tabular-nums">{locale === "es" ? "EN" : "ES"}</span>
    </button>
  );
}
