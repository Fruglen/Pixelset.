"use client";

import { createContext, useContext, useMemo } from "react";
import { dashT, type DashLang } from "@/lib/dashboard-i18n";

// Build pack 2026-11-20: the dashboard language, resolved on the server in the
// dashboard layout and read by client components with useDashT().
const DashLangContext = createContext<DashLang>("en");

export function DashLangProvider({ lang, children }: { lang: DashLang; children: React.ReactNode }) {
  return <DashLangContext.Provider value={lang}>{children}</DashLangContext.Provider>;
}

export function useDashT() {
  const lang = useContext(DashLangContext);
  return useMemo(() => dashT(lang), [lang]);
}
