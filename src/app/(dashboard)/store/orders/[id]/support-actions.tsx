"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Extras): client support and reprint process, with the
// studio's published reprint policy. Cases land in the photographer's
// notifications; a reprint case also clones the lab order (reprint flag)
// through the existing lab flow.

export const REPRINT_POLICY =
  "Reprint policy: if a print arrives damaged or with a lab defect, we reprint it free of charge within 30 days of delivery. Colour differences caused by an uncalibrated screen are not defects. To start a reprint, open a case on the order and we order the reprint with the lab the same business day.";

export function SupportActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function open(kind: "REPRINT" | "ISSUE") {
    setBusy(kind);
    setMsg("");
    setError("");
    const res = await fetch(`/api/store/orders/${orderId}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, note }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) {
      setMsg(json.detail as string);
      setNote("");
      router.refresh();
    } else {
      setError(json.error || "Could not open the case.");
    }
  }

  return (
    <div className="card p-4">
      <p className="label">Client support and reprints</p>
      <p className="text-sm text-neutral-600">{REPRINT_POLICY}</p>
      <textarea
        className="input mt-3"
        rows={2}
        placeholder="What happened? (damage, defect, wrong item, anything the client reported)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2 mt-2 flex-wrap">
        <button className="btn-primary" disabled={busy !== ""} onClick={() => open("REPRINT")}>
          Request reprint
        </button>
        <button className="btn-secondary" disabled={busy !== ""} onClick={() => open("ISSUE")}>
          Log an issue
        </button>
      </div>
      {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
