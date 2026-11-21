"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { galleryT } from "@/lib/gallery-i18n";

export default function GalleryGate({
  mode,
  slug,
  collectionName,
  brand,
  themeVars,
  optIn = false,
  hasGroups = false,
  lang = "en",
}: {
  lang?: string; // Fix batch 2026-11-20: gallery interface language
  hasGroups?: boolean; // Phase 5B platform: access group codes are accepted here too
  mode: "password" | "email" | "prerelease";
  slug: string;
  collectionName: string;
  brand: string;
  themeVars: Record<string, string>;
  optIn?: boolean; // Phase 5B: show the marketing opt in checkbox
}) {
  const router = useRouter();
  const { t, te, tag } = galleryT(lang);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/gallery/${slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, password, email, name, optIn: optIn && marketing }),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "prerelease") {
        setDone(true);
      } else {
        router.refresh();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(te(data.error, t("somethingWrong")));
    }
  }

  return (
    <div
      lang={tag}
      className="gallery-root flex flex-col items-center justify-center min-h-screen px-4"
      style={themeVars as unknown as React.CSSProperties}
    >
      <p className="gallery-display text-lg mb-10 opacity-80">{brand}</p>
      <div className="w-full max-w-sm text-center">
        <h1 className="gallery-display text-3xl mb-2">{collectionName}</h1>

        {mode === "password" && (
          <>
            <p className="text-sm opacity-70 mb-6">{t("pwProtected")}</p>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input text-center"
                type="password"
                placeholder={hasGroups ? t("pwOrCode") : t("pwPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                {t("viewGallery")}
              </button>
            </form>
          </>
        )}

        {mode === "email" && (
          <>
            <p className="text-sm opacity-70 mb-6">{t("emailGate", { brand })}</p>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input text-center"
                placeholder={t("nameOptional")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="input text-center"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {optIn && (
                <label className="flex items-start gap-2 text-left text-xs opacity-80">
                  <input type="checkbox" className="mt-0.5" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                  <span>{t("optIn", { brand })}</span>
                </label>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                {t("viewGallery")}
              </button>
            </form>
          </>
        )}

        {mode === "prerelease" &&
          (done ? (
            <p className="text-sm opacity-80 mt-4">{t("onTheList")}</p>
          ) : (
            <>
              <p className="text-sm opacity-70 mb-6">{t("notPublished")}</p>
              <form onSubmit={submit} className="space-y-3">
                <input
                  className="input text-center"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {optIn && (
                  <label className="flex items-start gap-2 text-left text-xs opacity-80">
                    <input type="checkbox" className="mt-0.5" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                    <span>{t("optIn", { brand })}</span>
                  </label>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button className="btn-primary w-full" disabled={busy}>
                  {t("notifyMe")}
                </button>
              </form>
            </>
          ))}
      </div>
    </div>
  );
}
