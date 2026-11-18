"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuoteClient({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(action: "accept" | "decline") {
    setError("");
    setBusy(action);
    const res = await fetch(`/api/quote/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-6 text-center space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-sm text-neutral-600">Happy with this quote? Accepting turns it into an invoice.</p>
      <div className="flex justify-center gap-3">
        <button className="btn-primary" disabled={!!busy} onClick={() => act("accept")}>
          {busy === "accept" ? "Accepting…" : "Accept quote"}
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => act("decline")}>
          {busy === "decline" ? "…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
