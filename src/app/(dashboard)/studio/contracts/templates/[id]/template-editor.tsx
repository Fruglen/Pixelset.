"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SMART_FIELDS = [
  { token: "{{client_name}}", label: "Client name" },
  { token: "{{client_email}}", label: "Client email" },
  { token: "{{client_phone}}", label: "Client phone" },
  { token: "{{session_type}}", label: "Session type" },
  { token: "{{session_date}}", label: "Session date" },
  { token: "{{session_location}}", label: "Location" },
  { token: "{{session_price}}", label: "Price" },
  { token: "{{retainer}}", label: "Retainer" },
  { token: "{{business_name}}", label: "Business name" },
  { token: "{{photographer_name}}", label: "Photographer" },
  { token: "{{today}}", label: "Today's date" },
];

export function TemplateEditor({ template }: { template: { id: string; name: string; body: string } }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/studio/contract-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, body }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
      router.refresh();
    }
  }

  function insertToken(token: string) {
    const el = textRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/contracts" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Contracts
        </Link>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Template name</label>
          <input className="input max-w-md" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Smart fields, click to insert at the cursor</label>
          <div className="flex flex-wrap gap-1.5">
            {SMART_FIELDS.map((f) => (
              <button
                key={f.token}
                type="button"
                title={f.token}
                className="text-xs border border-neutral-300 rounded-full px-2.5 py-1 hover:bg-neutral-100"
                onClick={() => insertToken(f.token)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Contract text</label>
          <textarea
            ref={textRef}
            className="input min-h-[460px] font-mono text-xs leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-neutral-400 mt-2">
            Smart fields fill in automatically when a contract is created from this template (from the chosen
            client, session type and your business details). Unresolved fields stay visible so you can fill
            them by hand.
          </p>
        </div>
      </div>
    </div>
  );
}
