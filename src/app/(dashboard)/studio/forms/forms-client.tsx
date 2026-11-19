"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function FormsClient({ forms }: { forms: { id: string; name: string; token: string; active: boolean; submissions: number }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/studio/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/studio/forms/${out.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500 max-w-xl">
          Lead forms live on their own link, ready for your Instagram bio, email signature, or any website. Every submission creates
          a lead contact, lands in your inbox, and can open an Inquiry card on the Projects board.
        </p>
        <button className="btn-primary" onClick={() => setShow(true)}>
          + Lead form
        </button>
      </div>
      {forms.length === 0 ? <p className="text-sm text-neutral-500 py-8 text-center">No lead forms yet.</p> : null}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {forms.map((f) => (
          <div key={f.id} className={`card p-4 ${f.active ? "" : "opacity-60"}`}>
            <Link href={`/studio/forms/${f.id}`} className="font-medium text-sm hover:underline">
              {f.name}
            </Link>
            <p className="text-xs text-neutral-500 mt-1">
              {f.submissions} submission{f.submissions === 1 ? "" : "s"} · {f.active ? "Live" : "Paused"}
            </p>
            <div className="flex gap-3 mt-3 text-xs">
              <Link href={`/studio/forms/${f.id}`} className="underline text-neutral-600">
                Edit
              </Link>
              <a href={`/f/${f.token}`} target="_blank" rel="noreferrer" className="underline text-neutral-600">
                Open ↗
              </a>
            </div>
          </div>
        ))}
      </div>
      {show ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New lead form</h3>
            <label className="label">Name</label>
            <input className="input" autoFocus placeholder="Wedding inquiry" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
