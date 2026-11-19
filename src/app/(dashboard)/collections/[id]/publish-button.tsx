"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B: Publish and Notify. Publishes the collection and emails everyone
// who registered during pre-release plus any addresses typed in, through the
// branded invite email. Delivery status is reported honestly per recipient.
export default function PublishButton({
  collectionId,
  status,
  registrations,
  mailConnected,
}: {
  collectionId: string;
  status: string;
  registrations: string[];
  mailConnected: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [includeRegs, setIncludeRegs] = useState(true);
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ email: string; delivered: boolean; error: string | null }[] | null>(null);

  async function publish() {
    setBusy(true);
    setError("");
    const emails = extra
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    const res = await fetch(`/api/collections/${collectionId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeRegistrations: includeRegs, emails, message }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not publish");
      return;
    }
    setResults(data.results ?? []);
    router.refresh();
  }

  return (
    <>
      <button className={status === "PUBLISHED" ? "btn-secondary" : "btn-primary"} onClick={() => setOpen(true)}>
        {status === "PUBLISHED" ? "Notify clients" : "Publish and Notify"}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{status === "PUBLISHED" ? "Notify clients" : "Publish and Notify"}</h2>
              <button
                className="text-neutral-400 hover:text-neutral-900"
                onClick={() => {
                  setOpen(false);
                  setResults(null);
                }}
              >
                ✕
              </button>
            </div>
            {results ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Collection is published.{" "}
                  {results.length === 0
                    ? "Nobody was selected to notify."
                    : `${results.filter((r) => r.delivered).length} of ${results.length} notification${results.length === 1 ? "" : "s"} delivered.`}
                </p>
                <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.email} className={r.delivered ? "text-emerald-700" : r.error ? "text-red-600" : "text-neutral-600"}>
                      {r.email}: {r.delivered ? "Delivered via Resend" : r.error ? `Send failed, ${r.error}` : "Logged only, email not connected"}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button className="btn-primary" onClick={() => { setOpen(false); setResults(null); }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className={`text-xs rounded p-2 ${mailConnected ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                  {mailConnected
                    ? "Email connected: each recipient gets the branded gallery email."
                    : "Email: Not connected. The collection is published and each notification is recorded in Activities, but no email is delivered until RESEND_API_KEY is set."}
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 accent-brand-600" checked={includeRegs} onChange={(e) => setIncludeRegs(e.target.checked)} />
                  <span>
                    Notify the {registrations.length} registered email{registrations.length === 1 ? "" : "s"}
                    {registrations.length > 0 && <span className="block text-xs text-neutral-500 font-mono">{registrations.slice(0, 6).join(", ")}{registrations.length > 6 ? ", …" : ""}</span>}
                  </span>
                </label>
                <div>
                  <label className="label">Also notify (comma or line separated)</label>
                  <textarea className="input h-16 text-sm" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="client@example.com" />
                </div>
                <div>
                  <label className="label">Message (optional)</label>
                  <textarea className="input h-20 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your gallery is ready, enjoy!" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={publish} disabled={busy}>
                    {busy ? "Working…" : status === "PUBLISHED" ? "Send notifications" : "Publish and Notify"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
