"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Night build: clients can move their own booking to another open time, or
// ask the photographer for a specific alternative time instead.
interface DaySlots {
  date: string;
  slots: string[]; // ISO start times from the availability engine
}

function slotParts(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    label: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export function ReschedulePanel({ token, currentLabel }: { token: string; currentLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"move" | "request">("move");
  const [mini, setMini] = useState(false);
  const [days, setDays] = useState<DaySlots[]>([]);
  const [slots, setSlots] = useState<{ id: string; label: string }[]>([]);
  const [pick, setPick] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch(`/api/book/manage/${token}`);
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return setError(out.error ?? "Could not load open times.");
      setMini(!!out.mini);
      if (out.mini) setSlots(out.slots ?? []);
      else setDays(out.days ?? []);
    })();
  }, [open, token]);

  async function post(data: Record<string, unknown>) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/book/manage/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Something went wrong.");
    if (data.action === "request-slot") {
      setDone("Request sent. Your photographer will confirm the new time with you.");
      return;
    }
    setDone("Your booking has been moved.");
    router.refresh();
  }

  function move() {
    if (!pick) return setError("Pick a new time first.");
    if (mini) return post({ action: "reschedule", slotId: pick });
    const [date, time] = pick.split("T");
    return post({ action: "reschedule", date, time });
  }

  if (done) return <div className="card p-5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md">{done}</div>;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Need a different time?</h2>
        {!open ? (
          <button className="btn-secondary" onClick={() => setOpen(true)}>
            Reschedule
          </button>
        ) : null}
      </div>
      <p className="text-sm text-neutral-500">Currently booked: {currentLabel}. Moving is free and confirmed instantly when the time is open.</p>
      {open ? (
        <>
          <div className="flex gap-4 text-sm">
            <button className={mode === "move" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("move")}>
              Pick a new time
            </button>
            <button className={mode === "request" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("request")}>
              Request another time
            </button>
          </div>
          {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p> : null}
          {mode === "move" ? (
            <div className="space-y-3">
              {mini ? (
                <div className="flex flex-wrap gap-2">
                  {slots.length === 0 ? <p className="text-sm text-neutral-500">No other open spots right now. Try requesting a time instead.</p> : null}
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      className={pick === s.id ? "btn-primary" : "btn-secondary"}
                      onClick={() => setPick(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {days.length === 0 ? <p className="text-sm text-neutral-500">Loading open times…</p> : null}
                  {days
                    .filter((d) => d.slots.length > 0)
                    .map((d) => (
                      <div key={d.date}>
                        <p className="text-xs font-medium text-neutral-500 mb-1">
                          {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {d.slots.map((iso) => {
                            const p = slotParts(iso);
                            const value = `${p.date}T${p.time}`;
                            return (
                              <button key={value} className={pick === value ? "btn-primary" : "btn-secondary"} onClick={() => setPick(value)}>
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <button className="btn-primary" disabled={busy} onClick={move}>
                {busy ? "Moving…" : "Move my booking"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">The time you would prefer</label>
                <input className="input" placeholder="e.g. Saturday June 14 at 10am" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={busy} onClick={() => post({ action: "request-slot", when, note })}>
                {busy ? "Sending…" : "Send request"}
              </button>
              <p className="text-xs text-neutral-400">Your booking stays as it is until your photographer agrees the new time.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
