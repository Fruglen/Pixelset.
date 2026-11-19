"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";

export function SignForm({
  token,
  secondSigner,
  expiresAt,
  accent = "",
}: {
  token: string;
  secondSigner: boolean;
  expiresAt: string;
  accent?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [drawn, setDrawn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sign() {
    setError("");
    if (mode === "draw" && !drawn) return setError("Draw your signature in the box.");
    setBusy(true);
    const res = await fetch(`/api/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, agree, signatureImage: mode === "draw" ? drawn : "" }),
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
        <label className="label">Your full legal name *</label>
        <input className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <div className="flex gap-4 text-sm mb-2">
          <button type="button" className={mode === "type" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("type")}>
            Type signature
          </button>
          <button type="button" className={mode === "draw" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("draw")}>
            Draw signature
          </button>
        </div>
        {mode === "type" ? (
          name.trim() ? <p className="font-display italic text-2xl mt-2 text-neutral-800">{name}</p> : null
        ) : (
          <SignaturePad onChange={setDrawn} />
        )}
      </div>
      <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read and agree to the terms above, and I intend my signature to act as my electronic signature. My
        signature is recorded with a timestamp, IP address and browser details.
      </label>
      <button
        className="btn-primary"
        style={accent ? { backgroundColor: accent, borderColor: accent } : undefined}
        disabled={busy}
        onClick={sign}
      >
        {busy ? "Signing…" : "Sign agreement"}
      </button>
    </div>
  );
}
