"use client";

import { useState } from "react";

// Phase 5B platform: personal API token for scripted uploads.
export function ApiTokenCard({ hasToken }: { hasToken: boolean }) {
  const [active, setActive] = useState(hasToken);
  const [token, setToken] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  async function create() {
    if (active && !window.confirm("Create a new token? The current one stops working.")) return;
    const res = await fetch("/api/account/api-token", { method: "POST" });
    const data = await res.json();
    setToken(data.token);
    setActive(true);
  }
  async function revoke() {
    if (!window.confirm("Revoke the API token? Anything using it stops working.")) return;
    await fetch("/api/account/api-token", { method: "DELETE" });
    setToken("");
    setActive(false);
  }
  return (
    <section className="card p-6 space-y-3 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Upload API</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
          {active ? "Token active" : "No token"}
        </span>
      </div>
      <p className="text-sm text-neutral-500">
        Upload photos into any collection from scripts or an export action, through the same limits as the dashboard. A
        Lightroom Classic plugin is not available yet; this API is what such a plugin would call.
      </p>
      {token ? (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
          <p className="mb-1">Copy your token now, it is only shown once:</p>
          <code className="break-all text-xs" data-testid="api-token">{token}</code>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={create}>
          {active ? "Rotate token" : "Create token"}
        </button>
        {active ? (
          <button className="btn-secondary" onClick={revoke}>
            Revoke
          </button>
        ) : null}
      </div>
      <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-3 overflow-x-auto">{`# list collections and sets
curl -H "Authorization: Bearer YOUR_TOKEN" ${origin}/api/v1/collections

# upload into a collection (setId optional)
curl -H "Authorization: Bearer YOUR_TOKEN" \\
  -F file=@photo.jpg -F setId=SET_ID \\
  ${origin}/api/v1/collections/COLLECTION_ID/photos`}</pre>
    </section>
  );
}
