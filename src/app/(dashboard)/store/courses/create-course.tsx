"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Extras): create a course (title, description, price).
export function CreateCourse() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/store/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        priceCents: Math.round((Number(price) || 0) * 100),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setDescription("");
      setPrice("");
      router.refresh();
    } else {
      setError(json.error || "Could not create the course.");
    }
  }

  return (
    <div className="card p-5">
      <p className="font-medium">New course</p>
      <div className="grid gap-3 mt-3 sm:grid-cols-2">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Posing couples, a mini course" />
        </div>
        <div>
          <label className="label">Price (USD, 0 = free)</label>
          <input className="input" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <button className="btn-primary mt-3" disabled={busy || !title.trim()} onClick={create}>
        Create course
      </button>
    </div>
  );
}
