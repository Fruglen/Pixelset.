"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B: offline payment received.
export default function MarkPaid({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go() {
    if (!confirm("Mark this offline payment as received? Download links are emailed and lab orders are sent.")) return;
    setBusy(true);
    const res = await fetch(`/api/store/orders/${orderId}/mark-paid`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: data.error || "Could not update" });
    else
      setMsg({
        ok: true,
        text: `Marked paid.${data.links ? ` ${data.links} download link(s) issued.` : ""} Client email: ${data.mail}.${
          data.lab?.length ? ` Lab: ${data.lab.join("; ")}.` : ""
        }`,
      });
    router.refresh();
  }
  return (
    <div className="space-y-1">
      <button className="btn-primary !py-1 text-xs" onClick={go} disabled={busy}>
        {busy ? "Saving…" : "Mark payment received"}
      </button>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
