"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Field {
  id: string;
  type: string;
  label: string;
  options: string;
  required: boolean;
}

const TYPES = [
  { v: "text", label: "Short text" },
  { v: "textarea", label: "Long text" },
  { v: "choice", label: "Multiple choice" },
  { v: "date", label: "Date" },
];

export function QuestionnaireBuilder({
  questionnaire,
  sessionTypes,
  responses,
}: {
  questionnaire: { id: string; name: string; fields: Field[] };
  sessionTypes: { id: string; name: string }[];
  responses: {
    id: string;
    name: string;
    email: string;
    bookingTitle: string;
    createdAt: string;
    answers: Record<string, string>;
  }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(questionnaire.name);
  const [fields, setFields] = useState<Field[]>(questionnaire.fields);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openResponse, setOpenResponse] = useState("");

  function upd(i: number, patch: Partial<Field>) {
    setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/studio/questionnaires/${questionnaire.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fields }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
      router.refresh();
    }
  }

  const fieldById = new Map(questionnaire.fields.map((f) => [f.id, f.label]));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/questionnaires" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Questionnaires
        </Link>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input max-w-md" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {sessionTypes.length ? (
          <p className="text-xs text-neutral-500">
            Attached to:{" "}
            {sessionTypes.map((t, i) => (
              <span key={t.id}>
                {i > 0 ? ", " : ""}
                <Link className="underline" href={`/studio/sessions/${t.id}`}>
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-xs text-neutral-400">Not attached to any session type yet.</p>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Questions</h2>
        {fields.map((f, i) => (
          <div key={f.id} className="border border-neutral-200 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-[1fr_150px] gap-2">
              <input
                className="input"
                placeholder="Question label"
                value={f.label}
                onChange={(e) => upd(i, { label: e.target.value })}
              />
              <select className="input" value={f.type} onChange={(e) => upd(i, { type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {f.type === "choice" ? (
              <input
                className="input"
                placeholder="Options, comma-separated"
                value={f.options}
                onChange={(e) => upd(i, { options: e.target.value })}
              />
            ) : null}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={f.required} onChange={(e) => upd(i, { required: e.target.checked })} />
                Required
              </label>
              <div className="flex gap-2 text-xs">
                <button className="underline text-neutral-500" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button className="underline text-neutral-500" onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button className="underline text-red-600" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() =>
            setFields([
              ...fields,
              { id: `f${Date.now()}`, type: "text", label: "", options: "", required: false },
            ])
          }
        >
          + Question
        </button>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg mb-3">Responses ({responses.length})</h2>
        {responses.length === 0 ? (
          <p className="text-sm text-neutral-500">No responses yet, they arrive with bookings.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {responses.map((r) => (
              <div key={r.id} className="py-3">
                <button
                  className="w-full flex items-center justify-between gap-3 text-left"
                  onClick={() => setOpenResponse(openResponse === r.id ? "" : r.id)}
                >
                  <span className="text-sm font-medium">
                    {r.name || r.email || "Anonymous"}
                    {r.bookingTitle ? <span className="text-neutral-500 font-normal"> · {r.bookingTitle}</span> : null}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
                    {openResponse === r.id ? "▴" : "▾"}
                  </span>
                </button>
                {openResponse === r.id ? (
                  <dl className="mt-2 space-y-1.5 text-sm bg-neutral-50 rounded-md p-3">
                    {Object.entries(r.answers).map(([fid, v]) => (
                      <div key={fid}>
                        <dt className="text-xs text-neutral-500">{fieldById.get(fid) ?? fid}</dt>
                        <dd className="whitespace-pre-wrap">{v}</dd>
                      </div>
                    ))}
                    {Object.keys(r.answers).length === 0 ? (
                      <p className="text-xs text-neutral-400">No answers recorded.</p>
                    ) : null}
                  </dl>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
