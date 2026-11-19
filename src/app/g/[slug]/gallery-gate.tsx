"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GalleryGate({
  mode,
  slug,
  collectionName,
  brand,
  themeVars,
  optIn = false,
  hasGroups = false,
}: {
  hasGroups?: boolean; // Phase 5B platform: access group codes are accepted here too
  mode: "password" | "email" | "prerelease";
  slug: string;
  collectionName: string;
  brand: string;
  themeVars: Record<string, string>;
  optIn?: boolean; // Phase 5B: show the marketing opt in checkbox
}) {
  const router = useRouter();
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
      setError(data.error || "Something went wrong");
    }
  }

  return (
    <div
      className="gallery-root flex flex-col items-center justify-center min-h-screen px-4"
      style={themeVars as unknown as React.CSSProperties}
    >
      <p className="gallery-display text-lg mb-10 opacity-80">{brand}</p>
      <div className="w-full max-w-sm text-center">
        <h1 className="gallery-display text-3xl mb-2">{collectionName}</h1>

        {mode === "password" && (
          <>
            <p className="text-sm opacity-70 mb-6">This gallery is password protected.</p>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input text-center"
                type="password"
                placeholder={hasGroups ? "Gallery password or access code" : "Gallery password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                View Gallery
              </button>
            </form>
          </>
        )}

        {mode === "email" && (
          <>
            <p className="text-sm opacity-70 mb-6">
              Enter your email to view this gallery. {brand} will see your registration.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                className="input text-center"
                placeholder="Your name (optional)"
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
                  <span>Keep me posted about print sales, mini sessions and offers from {brand}. Unsubscribe any time.</span>
                </label>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button className="btn-primary w-full" disabled={busy}>
                View Gallery
              </button>
            </form>
          </>
        )}

        {mode === "prerelease" &&
          (done ? (
            <p className="text-sm opacity-80 mt-4">
              You’re on the list, we’ll let you know the moment this gallery is published.
            </p>
          ) : (
            <>
              <p className="text-sm opacity-70 mb-6">
                This gallery isn’t published yet. Register your email and we’ll notify you when it goes
                live.
              </p>
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
                    <span>Keep me posted about print sales, mini sessions and offers from {brand}. Unsubscribe any time.</span>
                  </label>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button className="btn-primary w-full" disabled={busy}>
                  Notify Me
                </button>
              </form>
            </>
          ))}
      </div>
    </div>
  );
}
