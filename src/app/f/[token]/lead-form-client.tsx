"use client";

import { useState } from "react";

interface QField {
  id: string;
  type: string;
  label: string;
  options: string;
  required: boolean;
}

export function LeadFormClient({ token, fields }: { token: string; fields: QField[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/f/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, answers, website: hp }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Could not send.");
    setThanks(out.thanks || "Thank you, we'll be in touch.");
  }

  if (thanks) return <p className="card p-6 text-center text-sm text-neutral-700">{thanks}</p>;

  return (
    <div className="card p-6 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <input className="hidden" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden />
      {fields.map((f) => (
        <div key={f.id}>
          <label className="label">
            {f.label}
            {f.required ? " *" : ""}
          </label>
          {f.type === "textarea" ? (
            <textarea className="input min-h-[90px]" value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
          ) : f.type === "choice" ? (
            <select className="input" value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}>
              <option value="">Choose…</option>
              {f.options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
                .map((o) => (
                  <option key={o}>{o}</option>
                ))}
            </select>
          ) : (
            <input className="input" type={f.type === "date" ? "date" : "text"} value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
          )}
        </div>
      ))}
      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
