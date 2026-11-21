"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDashT } from "@/components/dash-lang";
import { DASHBOARD_LANGUAGES } from "@/lib/dashboard-i18n";

// Build pack 2026-11-20: dashboard language switch (Account settings).
// Option labels are each language's own name so anyone can switch back.
export function DashboardLanguage({ initial }: { initial: string }) {
  const router = useRouter();
  const { t } = useDashT();
  const [locale, setLocale] = useState(["auto", "en", "es", "pt"].includes(initial) ? initial : "auto");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    const res = await fetch("/api/account/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    setBusy(false);
    if (!res.ok) return setError(t("langFailed"));
    const chosen = DASHBOARD_LANGUAGES.find((l) => l.id === locale);
    setMsg(t("langSaved", { language: chosen ? chosen.label : t("langAuto") }));
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-xl mt-6" data-testid="dashboard-language">
      <section className="card p-6 space-y-4">
        <h2 className="font-display text-lg">{t("langTitle")}</h2>
        <p className="text-sm text-neutral-500">{t("langBody")}</p>
        <div>
          <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)} aria-label={t("langTitle")}>
            <option value="auto">{t("langAuto")}</option>
            {DASHBOARD_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>
    </form>
  );
}
