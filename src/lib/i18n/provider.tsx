"use client";

import * as React from "react";
import { type Locale, type TFunc, getT } from "./index";

const LocaleCtx = React.createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleCtx);
}

/** Client translator hook bound to the current locale. */
export function useT(): TFunc {
  const locale = React.useContext(LocaleCtx);
  return React.useMemo(() => getT(locale), [locale]);
}
