"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setLocale } from "@/lib/server/locale-actions";
import { useT, useLocale } from "@/lib/i18n/provider";

/** English / Español switch for employees. Saves to the profile + refreshes. */
export function LanguageToggle({ className }: { className?: string }) {
  const router = useRouter();
  const t = useT();
  const current = useLocale();
  const [busy, setBusy] = React.useState(false);

  async function choose(locale: "en" | "es") {
    if (locale === current || busy) return;
    setBusy(true);
    const res = await setLocale(locale);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Could not change language"); return; }
    toast.success(t("lang.saved"));
    router.refresh();
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
        <Languages className="size-3.5" /> {t("lang.label")}
      </div>
      <div className="inline-flex rounded-md border overflow-hidden text-sm">
        {(["en", "es"] as const).map((loc) => (
          <button
            key={loc}
            type="button"
            disabled={busy}
            onClick={() => choose(loc)}
            className={cn(
              "px-3 py-1.5 transition-colors disabled:opacity-60",
              current === loc ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground",
            )}
          >
            {loc === "en" ? t("lang.english") : t("lang.spanish")}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">{t("lang.help")}</p>
    </div>
  );
}
