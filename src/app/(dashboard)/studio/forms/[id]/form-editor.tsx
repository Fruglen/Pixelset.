"use client";

import { useEffect, useState } from "react";
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

export function FormEditor({
  form,
  business,
  submissions,
}: {
  form: { id: string; name: string; token: string; heading: string; intro: string; thanks: string; createProject: boolean; active: boolean; fields: Field[] };
  business: string;
  submissions: { id: string; name: string; email: string; body: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState(form);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/f/${form.token}`;

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/studio/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Delete this lead form? Past submissions stay in your inbox.")) return;
    await fetch(`/api/studio/forms/${form.id}`, { method: "DELETE" });
    router.push("/studio/forms");
    router.refresh();
  }

  const upd = (i: number, patch: Partial<Field>) => setF({ ...f, fields: f.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const signature = `<a href="${link}" style="color:#1c1c1c;text-decoration:underline">Book a session with ${business}</a>`;
  const embed = `<iframe src="${link}?embed=1" style="width:100%;min-height:640px;border:0" title="${f.name}"></iframe>`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/forms" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Lead forms
        </Link>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          <button className="btn-secondary" onClick={remove}>
            Delete
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Share</h2>
        {[
          { label: "Direct link", value: link },
          { label: "Bio link (Instagram, TikTok, link in bio tools)", value: link },
          { label: "Email signature (HTML)", value: signature },
          { label: "Embed on any website", value: embed },
        ].map((row) => (
          <div key={row.label}>
            <label className="label">{row.label}</label>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={row.value} onFocus={(e) => e.target.select()} />
              <button className="btn-secondary whitespace-nowrap" onClick={() => navigator.clipboard.writeText(row.value)}>
                Copy
              </button>
            </div>
          </div>
        ))}
        <a href={`/f/${form.token}`} target="_blank" rel="noreferrer" className="text-sm underline text-neutral-600">
          Open the form ↗
        </a>
      </section>

      <section className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Internal name</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Heading</label>
            <input className="input" value={f.heading} onChange={(e) => setF({ ...f, heading: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Intro</label>
          <textarea className="input min-h-[60px]" value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} />
        </div>
        <div>
          <label className="label">Thank you message</label>
          <input className="input" value={f.thanks} onChange={(e) => setF({ ...f, thanks: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Accepting submissions
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.createProject} onChange={(e) => setF({ ...f, createProject: e.target.checked })} />
            Open an Inquiry card on the Projects board for each submission
          </label>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Questions</h2>
        <p className="text-xs text-neutral-400">Name, email and phone are always asked.</p>
        {f.fields.map((fl, i) => (
          <div key={fl.id} className="border border-neutral-200 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-[1fr_150px] gap-2">
              <input className="input" placeholder="Question" value={fl.label} onChange={(e) => upd(i, { label: e.target.value })} />
              <select className="input" value={fl.type} onChange={(e) => upd(i, { type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {fl.type === "choice" ? (
              <input className="input" placeholder="Options, comma-separated" value={fl.options} onChange={(e) => upd(i, { options: e.target.value })} />
            ) : null}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={fl.required} onChange={(e) => upd(i, { required: e.target.checked })} />
                Required
              </label>
              <button className="underline text-red-600" onClick={() => setF({ ...f, fields: f.fields.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() => setF({ ...f, fields: [...f.fields, { id: `f${Date.now()}`, type: "text", label: "", options: "", required: false }] })}
        >
          + Question
        </button>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg mb-3">Recent submissions</h2>
        {submissions.length === 0 ? <p className="text-sm text-neutral-500">No submissions yet.</p> : null}
        <div className="divide-y divide-neutral-100">
          {submissions.map((s) => (
            <div key={s.id} className="py-2.5 text-sm">
              <p className="font-medium">
                {s.name} <span className="text-neutral-500 font-normal">· {s.email}</span>
              </p>
              <p className="text-xs text-neutral-500 whitespace-pre-wrap mt-1 line-clamp-3">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
