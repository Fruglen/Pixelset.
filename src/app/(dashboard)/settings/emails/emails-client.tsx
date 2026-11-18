"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Template = {
  key: string;
  name: string;
  description: string;
  tokens: string[];
  subject: string;
  body: string;
  customized: boolean;
};

export default function EmailTemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function open(t: Template) {
    setOpenKey(openKey === t.key ? null : t.key);
    setSubject(t.subject);
    setBody(t.body);
    setMsg("");
    setError("");
  }

  async function save(key: string) {
    setError("");
    setMsg("");
    const res = await fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, subject, body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not save");
    setMsg("Saved.");
    router.refresh();
  }

  async function reset(key: string) {
    const res = await fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, reset: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setSubject(json.subject);
      setBody(json.body);
      setMsg("Reset to default.");
      router.refresh();
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-neutral-500">
        Fully editable reminder emails, not just presets. Automations and reminder sends use these templates;
        {" "}<code className="text-xs bg-neutral-100 rounded px-1">{"{{tokens}}"}</code> are filled in per client.
      </p>
      {templates.map((t) => (
        <div key={t.key} className="card">
          <button className="w-full flex items-center justify-between px-5 py-3.5 text-left" onClick={() => open(t)}>
            <div>
              <p className="text-sm font-medium">
                {t.name}
                {t.customized && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">
                    Customized
                  </span>
                )}
              </p>
              <p className="text-xs text-neutral-400">{t.description}</p>
            </div>
            <span className="text-neutral-400">{openKey === t.key ? "▴" : "▾"}</span>
          </button>
          {openKey === t.key && (
            <div className="px-5 pb-5 space-y-3 border-t border-neutral-100 pt-4">
              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="label">Body</label>
                <textarea className="input h-48 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.tokens.map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    className="text-[11px] font-mono bg-neutral-100 hover:bg-neutral-200 rounded px-1.5 py-0.5"
                    onClick={() => setBody((b) => `${b}${b.endsWith(" ") || b === "" ? "" : " "}${tok}`)}
                    title="Append to body"
                  >
                    {tok}
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {msg && <p className="text-sm text-green-600">{msg}</p>}
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => save(t.key)}>
                  Save template
                </button>
                <button className="btn-secondary" onClick={() => reset(t.key)}>
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
