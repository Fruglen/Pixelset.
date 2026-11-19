"use client";

import { useEffect, useState } from "react";

// Night build (Website): configurable cookie consent banner. The choice is
// kept in the visitor's local storage; the banner never shows again once
// answered, and it renders nothing until it has checked (no flash).
export function CookieBanner({ siteSlug, text }: { siteSlug: string; text: string }) {
  const [visible, setVisible] = useState(false);
  const key = `pxs-cookie-consent-${siteSlug}`;
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(key)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [key]);
  if (!visible) return null;
  function answer(v: string) {
    try {
      window.localStorage.setItem(key, v);
    } catch {
      // storage unavailable; hide for this visit anyway
    }
    setVisible(false);
  }
  return (
    <div
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-50 shadow-2xl border p-5"
      style={{ background: "var(--s-bg)", color: "var(--s-text)", borderColor: "color-mix(in srgb, var(--s-text) 18%, transparent)", borderRadius: "var(--s-radius, 2px)" }}
      role="dialog"
      aria-label="Cookie consent"
    >
      <p className="text-sm leading-relaxed">
        {text || "This site uses cookies to understand visits and improve your experience. You can accept or decline."}
      </p>
      <div className="flex gap-2 mt-4">
        <button className="site-btn flex-1" onClick={() => answer("accepted")}>Accept</button>
        <button className="site-btn site-btn-outline flex-1" onClick={() => answer("declined")}>Decline</button>
      </div>
    </div>
  );
}
