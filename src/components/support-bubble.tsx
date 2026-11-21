"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChatIcon } from "@/components/icons";
import { SUPPORT_TOPICS } from "@/lib/support";

// Fix batch 2026-11-20: dashboard support bubble. Opens a short message form;
// the message lands in the site owner's support inbox inside the app.
export function SupportBubble({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("GENERAL");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, body, page: pathname }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Your message could not be sent, please try again");
      return;
    }
    setSentTo(d.replyTo || email);
    setBody("");
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      {open ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white shadow-lift p-4" role="dialog" aria-label="Contact support" data-testid="support-panel">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display text-lg">Support</p>
            <button className="text-sm text-neutral-500 hover:text-neutral-800" onClick={() => setOpen(false)} aria-label="Close support">
              Close
            </button>
          </div>
          {sentTo ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700">
                Thanks, your message is in our support inbox. We reply by email to <strong>{sentTo}</strong>, usually
                within one working day.
              </p>
              <button className="btn-secondary w-full" onClick={() => setSentTo("")}>
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs text-neutral-500">
                Ask us anything. Replies come by email to {email}, not in this window. The <a href="/help" className="underline">help centre</a> may answer it faster.
              </p>
              <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
                {SUPPORT_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                className="input min-h-[7rem]"
                placeholder="How can we help?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                minLength={5}
                aria-label="Message"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button className="btn-primary w-full" disabled={busy || body.trim().length < 5}>
                {busy ? "Sending..." : "Send message"}
              </button>
            </form>
          )}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full bg-brand-500 text-white px-4 py-3 shadow-lift hover:bg-brand-600 transition-colors"
          aria-expanded={open}
          data-testid="support-bubble"
        >
          <ChatIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Support</span>
        </button>
      </div>
    </div>
  );
}
