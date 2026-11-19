"use client";

import { useState } from "react";

// Phase 5B: availability rules for a regular session type. Saved as JSON on the
// session type and read by the slot engine in src/lib/availability.ts.

interface Range {
  start: string;
  end: string;
}
interface Override {
  date: string;
  closed: boolean;
  start?: string;
  end?: string;
}
interface Rules {
  hours: Record<string, Range[]>;
  overrides: Override[];
  minNoticeHours: number;
  maxPerDay: number;
  intervalMin: number;
  windowDays: number;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaults(): Rules {
  const wk = [{ start: "09:00", end: "17:00" }];
  return {
    hours: { "0": [], "1": wk, "2": wk, "3": wk, "4": wk, "5": wk, "6": [{ start: "10:00", end: "14:00" }] },
    overrides: [],
    minNoticeHours: 24,
    maxPerDay: 0,
    intervalMin: 30,
    windowDays: 60,
  };
}

function parse(json: string): Rules {
  const d = defaults();
  if (!json) return d;
  try {
    const r = JSON.parse(json);
    return {
      hours: { ...d.hours, ...(r.hours ?? {}) },
      overrides: Array.isArray(r.overrides) ? r.overrides : [],
      minNoticeHours: Number(r.minNoticeHours ?? d.minNoticeHours),
      maxPerDay: Number(r.maxPerDay ?? d.maxPerDay),
      intervalMin: Number(r.intervalMin ?? d.intervalMin),
      windowDays: Number(r.windowDays ?? d.windowDays),
    };
  } catch {
    return d;
  }
}

export function AvailabilityEditor({ value, onSave }: { value: string; onSave: (json: string) => Promise<boolean> }) {
  const [rules, setRules] = useState<Rules>(() => parse(value));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ovDate, setOvDate] = useState("");
  const [ovClosed, setOvClosed] = useState(true);
  const [ovStart, setOvStart] = useState("10:00");
  const [ovEnd, setOvEnd] = useState("14:00");

  function setDay(d: string, ranges: Range[]) {
    setRules({ ...rules, hours: { ...rules.hours, [d]: ranges } });
  }

  async function save() {
    setBusy(true);
    const ok = await onSave(JSON.stringify(rules));
    setBusy(false);
    setMsg(ok ? "Availability saved" : "");
    if (ok) setTimeout(() => setMsg(""), 2000);
  }

  function addOverride() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ovDate)) return;
    const rest = rules.overrides.filter((o) => o.date !== ovDate);
    setRules({
      ...rules,
      overrides: [...rest, ovClosed ? { date: ovDate, closed: true } : { date: ovDate, closed: false, start: ovStart, end: ovEnd }].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    });
    setOvDate("");
  }

  return (
    <section className="card p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Availability</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Clients only see start times inside these hours, outside your buffers, and clear of every other booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {DAYS.map((label, i) => {
          const d = String(i);
          const ranges = rules.hours[d] ?? [];
          return (
            <div key={d} className="py-2.5 flex items-start gap-4 text-sm">
              <label className="w-32 flex items-center gap-2 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ranges.length > 0}
                  onChange={(e) => setDay(d, e.target.checked ? [{ start: "09:00", end: "17:00" }] : [])}
                />
                {label}
              </label>
              <div className="flex-1 space-y-1.5">
                {ranges.length === 0 ? <p className="text-neutral-400 pt-1.5">Unavailable</p> : null}
                {ranges.map((r, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      type="time"
                      className="input w-32"
                      value={r.start}
                      onChange={(e) => setDay(d, ranges.map((x, k) => (k === j ? { ...x, start: e.target.value } : x)))}
                    />
                    <span className="text-neutral-400">to</span>
                    <input
                      type="time"
                      className="input w-32"
                      value={r.end}
                      onChange={(e) => setDay(d, ranges.map((x, k) => (k === j ? { ...x, end: e.target.value } : x)))}
                    />
                    <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => setDay(d, ranges.filter((_, k) => k !== j))}>
                      Remove
                    </button>
                  </div>
                ))}
                {ranges.length > 0 ? (
                  <button className="text-xs underline text-neutral-500" onClick={() => setDay(d, [...ranges, { start: "18:00", end: "20:00" }])}>
                    Add hours
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Minimum notice (hours)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={rules.minNoticeHours}
            onChange={(e) => setRules({ ...rules, minNoticeHours: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Max bookings per day</label>
          <input
            className="input"
            type="number"
            min={0}
            value={rules.maxPerDay}
            onChange={(e) => setRules({ ...rules, maxPerDay: Number(e.target.value) })}
          />
          <p className="text-xs text-neutral-400 mt-1">0 means no limit.</p>
        </div>
        <div>
          <label className="label">Start times every (min)</label>
          <select className="input" value={rules.intervalMin} onChange={(e) => setRules({ ...rules, intervalMin: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bookable up to (days ahead)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={rules.windowDays}
            onChange={(e) => setRules({ ...rules, windowDays: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className="label">Date overrides</label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" className="input w-44" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />
          <select className="input w-40" value={ovClosed ? "closed" : "custom"} onChange={(e) => setOvClosed(e.target.value === "closed")}>
            <option value="closed">Blocked, closed all day</option>
            <option value="custom">Custom hours</option>
          </select>
          {!ovClosed ? (
            <>
              <input type="time" className="input w-32" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
              <span className="text-neutral-400">to</span>
              <input type="time" className="input w-32" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
            </>
          ) : null}
          <button className="btn-secondary" onClick={addOverride} disabled={!ovDate}>
            Add override
          </button>
        </div>
        {rules.overrides.length > 0 ? (
          <ul className="mt-3 text-sm divide-y divide-neutral-100 border border-neutral-100 rounded-md">
            {rules.overrides.map((o) => (
              <li key={o.date} className="flex items-center justify-between px-3 py-2">
                <span>
                  {new Date(`${o.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  <span className="text-neutral-500"> · {o.closed ? "Closed" : `${o.start} to ${o.end}`}</span>
                </span>
                <button
                  className="text-xs text-neutral-400 hover:text-red-600"
                  onClick={() => setRules({ ...rules, overrides: rules.overrides.filter((x) => x.date !== o.date) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-400 mt-2">Block holidays or set special hours for a single date.</p>
        )}
      </div>
    </section>
  );
}
