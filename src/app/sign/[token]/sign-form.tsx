"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignForm({
  token,
  secondSigner,
  expiresAt,
}: {
  token: string;
  secondSigner: boolean;
  expiresAt: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sign() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, agree }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not sign.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-display text-lg">{secondSigner ? "Second signature required" : "Sign this agreement"}</h2>
      {expiresAt ? <p className="text-xs text-neutral-500">Open for signing until {expiresAt}.</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <label className="label">Type your full legal name *</label>
        <input className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
        {name.trim() ? <p className="font-display italic text-2xl mt-2 text-neutral-800">{name}</p> : null}
      </div>
      <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read and agree to the terms above, and I intend my typed name to act as my electronic signature.
        My signature is recorded with a timestamp, IP address and browser details.
      </label>
      <button className="btn-primary" disabled={busy} onClick={sign}>
        {busy ? "Signing…" : "Sign agreement"}
      </button>
    </div>
  );
}
