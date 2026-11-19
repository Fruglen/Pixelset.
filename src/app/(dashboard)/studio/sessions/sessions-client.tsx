"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TypeRow {
  id: string;
  name: string;
  isMini: boolean;
  active: boolean;
  published: boolean;
  durationMin: number;
  priceCents: number;
  locationType: string;
  location: string;
  addOnCount: number;
  bookingCount: number;
  dateCount: number;
  spotsTotal: number;
  spotsBooked: number;
}

export function SessionsClient({ bookingSlug, types }: { bookingSlug: string; types: TypeRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [isMini, setIsMini] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const regular = types.filter((t) => !t.isMini);
  const minis = types.filter((t) => t.isMini);

  async function create() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/studio/session-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        isMini,
        durationMin: parseInt(duration) || (isMini ? 15 : 60),
        priceCents: Math.round((parseFloat(price) || 0) * 100),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create");
    router.push(`/studio/sessions/${data.id}`);
    router.refresh();
  }

  async function duplicate(id: string) {
    const res = await fetch(`/api/studio/session-types/${id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/studio/sessions/${data.id}`);
      router.refresh();
    }
  }

  function Row({ t }: { t: TypeRow }) {
    return (
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/studio/sessions/${t.id}`} className="font-medium hover:underline truncate">
              {t.name}
            </Link>
            {t.isMini ? (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  t.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {t.published ? "PUBLISHED" : "UNPUBLISHED"}
              </span>
            ) : (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  t.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {t.active ? "BOOKABLE" : "HIDDEN"}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t.durationMin} min · {money(t.priceCents)}
            {t.locationType === "ZOOM" ? " · Zoom" : t.location ? ` · ${t.location}` : ""}
            {t.addOnCount ? ` · ${t.addOnCount} add-on${t.addOnCount === 1 ? "" : "s"}` : ""}
            {t.isMini
              ? ` · ${t.dateCount} date${t.dateCount === 1 ? "" : "s"} · ${t.spotsBooked}/${t.spotsTotal} spots booked`
              : ` · ${t.bookingCount} booking${t.bookingCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => duplicate(t.id)}>
          Duplicate
        </button>
        <Link href={`/studio/sessions/${t.id}`} className="btn-secondary !px-3 !py-1.5 text-xs">
          Edit
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Session types appear on your booking site at <span className="font-mono text-xs">/book/{bookingSlug}</span>.
        </p>
        <div className="flex gap-2">
          <Link href="/studio/calendar?add=1" className="btn-secondary">
            + Book for a client
          </Link>
          <button
            className="btn-secondary"
            onClick={() => {
              setIsMini(true);
              setDuration("15");
              setShowCreate(true);
            }}
          >
            + Mini session
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setIsMini(false);
              setDuration("60");
              setShowCreate(true);
            }}
          >
            + Session type
          </button>
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg mb-3">Session types</h2>
        {regular.length === 0 ? (
          <p className="text-sm text-neutral-500">No session types yet, create one to start taking bookings.</p>
        ) : (
          <div className="space-y-3">
            {regular.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">Mini sessions</h2>
        {minis.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No mini sessions yet. A mini session runs on specific dates with auto-generated time slots -
            perfect for holiday minis.
          </p>
        ) : (
          <div className="space-y-3">
            {minis.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </div>
        )}
      </section>

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">{isMini ? "New mini session" : "New session type"}</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={name}
                  autoFocus
                  placeholder={isMini ? "Holiday Mini Sessions" : "Portrait Session"}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{isMini ? "Slot length (min)" : "Duration (min)"}</label>
                  <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div>
                  <label className="label">Price ($)</label>
                  <input className="input" value={price} placeholder="0.00" onChange={(e) => setPrice(e.target.value)} />
                </div>
              </div>
              {isMini ? (
                <p className="text-xs text-neutral-500">
                  You&apos;ll add dates and generate time slots on the next screen. Minis start unpublished.
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
