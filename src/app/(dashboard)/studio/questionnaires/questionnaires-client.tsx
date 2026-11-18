"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function QuestionnairesClient({
  questionnaires,
}: {
  questionnaires: { id: string; name: string; fieldCount: number; responses: number; sessionTypes: number }[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/studio/questionnaires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create");
    setShowCreate(false);
    router.push(`/studio/questionnaires/${data.id}`);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this questionnaire and its responses?")) return;
    await fetch(`/api/studio/questionnaires/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Attach a questionnaire to a session type and clients answer it while booking.
        </p>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Questionnaire
        </button>
      </div>

      {questionnaires.length === 0 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">No questionnaires yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {questionnaires.map((q) => (
            <div key={q.id} className="card p-4">
              <Link href={`/studio/questionnaires/${q.id}`} className="font-medium text-sm hover:underline">
                {q.name}
              </Link>
              <p className="text-xs text-neutral-500 mt-1">
                {q.fieldCount} question{q.fieldCount === 1 ? "" : "s"} · {q.responses} response
                {q.responses === 1 ? "" : "s"} · on {q.sessionTypes} session type{q.sessionTypes === 1 ? "" : "s"}
              </p>
              <div className="flex gap-3 mt-3">
                <Link href={`/studio/questionnaires/${q.id}`} className="text-xs underline text-neutral-600">
                  Edit
                </Link>
                <button className="text-xs underline text-red-600" onClick={() => remove(q.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New questionnaire</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <label className="label">Name</label>
            <input className="input" autoFocus placeholder="Wedding day details" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
