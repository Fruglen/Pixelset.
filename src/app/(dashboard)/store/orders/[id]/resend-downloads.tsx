"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B: resend purchased download links (fresh 7 day links, emailed).
export default function ResendDownloads({ orderId, email, mailConnected }: { orderId: string; email: string; mailConnected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function resend() {
    if (!confirm(`Issue fresh 7 day download links and email them to ${email}? The current links stop working.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/store/orders/${orderId}/resend-downloads`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: data.error || "Could not resend" });
    else
      setMsg({
        ok: !data.error,
        text: data.delivered
          ? `${data.count} fresh link(s) emailed to ${email}.`
          : data.error
            ? `Fresh links issued, but the email failed: ${data.error}`
            : `${data.count} fresh link(s) issued. Email is not connected, so nothing was delivered; the message is in your inbox log.`,
      });
    router.refresh();
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button className="btn-secondary !py-1 text-xs" onClick={resend} disabled={busy}>
        {busy ? "Sending…" : "Resend download links"}
      </button>
      {!mailConnected && !msg && <span className="text-xs text-neutral-400">Email: Not connected</span>}
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </div>
  );
}
