"use client";

import { useEffect, useRef, useState } from "react";

interface QField {
  id: string;
  type: string;
  label: string;
  options: string;
  required: boolean;
}

export function QuestionnaireForm({ token, fields, feedback, greeting }: { token: string; fields: QField[]; feedback: boolean; greeting: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testimonial, setTestimonial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Night build: restore any autosaved draft (works across devices, the link
  // is the key), then autosave as the client types.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/questionnaire/${token}`);
        const out = await res.json().catch(() => ({}));
        if (out.answers && Object.keys(out.answers).length) {
          setAnswers(out.answers);
          setSavedNote("We restored your earlier answers. You can keep going from here.");
        }
      } catch {
        /* offline or no draft: start fresh */
      }
      loaded.current = true;
    })();
  }, [token]);

  useEffect(() => {
    if (!loaded.current || done) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/questionnaire/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: true, answers }),
        });
        setSavedNote("Draft saved. You can close this page and finish later from any device using the same link.");
      } catch {
        /* autosave is best effort */
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, token, done]);

  async function submit() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/questionnaire/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, testimonial }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Could not submit.");
    setDone(true);
  }

  if (done) return <p className="card p-6 text-center text-sm text-neutral-600">Thank you{greeting ? `, ${greeting}` : ""}! Your answers were received.</p>;

  return (
    <div className="card p-6 space-y-4">
      {greeting ? <p className="text-sm text-neutral-600">Hi {greeting}, thank you for taking a few minutes.</p> : null}
      {savedNote ? <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">{savedNote}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
      {feedback ? (
        <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={testimonial} onChange={(e) => setTestimonial(e.target.checked)} />
          You may share my feedback, with my first name, as a testimonial.
        </label>
      ) : null}
      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? "Sending…" : "Submit"}
      </button>
    </div>
  );
}
