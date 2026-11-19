"use client";

import { useState } from "react";

// Night build (Website): the unlock form shown instead of a password
// protected site or page. Posts to /api/site/unlock; the server sets the
// signed gate cookie and the page reloads into the content.
export function PasswordGateForm({ slug, pageId, label }: { slug: string; pageId?: string; label: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/site/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, password, pageId: pageId ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "That password is not right");
    window.location.reload();
  }
  return (
    <form onSubmit={submit} className="w-full max-w-xs mx-auto space-y-3">
      <label className="block text-xs uppercase tracking-[0.25em] site-subtle">{label}</label>
      <input
        type="password"
        className="site-input text-center"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
      />
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button className="site-btn w-full" disabled={busy || !password}>
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
