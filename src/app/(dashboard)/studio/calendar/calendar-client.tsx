"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface BookingRow {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  retainerCents: number;
  source: string;
  notes: string;
  contactName: string;
  hasInvoice: boolean;
  hasContract: boolean;
  clientToken: string;
  approvalState?: string;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  AWAITING_CLIENT: "bg-sky-100 text-sky-700",
  WAITLIST: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-neutral-100 text-neutral-400 line-through",
  COMPLETED: "bg-neutral-200 text-neutral-600",
};

export function CalendarClient({
  month,
  googleCalendarSync,
  monthBookings,
  upcoming,
  sessionTypes,
  contacts,
  openAdd,
}: {
  month: string;
  googleCalendarSync: boolean;
  monthBookings: BookingRow[];
  upcoming: BookingRow[];
  sessionTypes: { id: string; name: string; isMini: boolean }[];
  contacts: { id: string; name: string }[];
  openAdd: boolean;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(openAdd);
  // Phase 5B platform: manual approval of booking requests
  async function decide(id: string, decision: "approve" | "decline") {
    const message = window.prompt(decision === "approve" ? "Optional note to the client" : "Optional reason for the client") ?? "";
    const res = await fetch(`/api/studio/bookings/${id}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) window.alert(data.error || "Could not update the booking");
    else window.alert(`${decision === "approve" ? "Approved" : "Declined"}. Client email: ${data.delivery}`);
    router.refresh();
  }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sessionTypeId: "",
    title: "",
    contactId: "",
    clientName: "",
    clientEmail: "",
    date: "",
    time: "10:00",
    durationMin: "60",
    price: "",
    notes: "",
    slotId: "",
    mode: "CONFIRMED",
    sendConfirmation: true,
  });
  const [force, setForce] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [openDays, setOpenDays] = useState<{ date: string; slots: string[] }[]>([]);
  const [miniDates, setMiniDates] = useState<{ date: string; slots: { id: string; startsAt: string; left: number }[] }[]>([]);
  const pickedType = sessionTypes.find((t) => t.id === form.sessionTypeId);

  // Phase 5B: live open times from the availability engine for the chosen session type
  useEffect(() => {
    setOpenDays([]);
    setMiniDates([]);
    if (!form.sessionTypeId) return;
    const from = form.date || new Date().toISOString().slice(0, 10);
    fetch(`/api/studio/slots?typeId=${form.sessionTypeId}&from=${from}&days=14`)
      .then((r) => r.json())
      .then((d) => {
        if (d.mini) setMiniDates(d.dates ?? []);
        else setOpenDays(d.days ?? []);
      })
      .catch(() => null);
  }, [form.sessionTypeId, form.date]);

  const [year, mo] = month.split("-").map(Number);
  const first = new Date(year, mo - 1, 1);
  const daysInMonth = new Date(year, mo, 0).getDate();
  const startWeekday = first.getDay();
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function shiftMonth(delta: number) {
    const d = new Date(year, mo - 1 + delta, 1);
    router.push(`/studio/calendar?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const byDay = new Map<number, BookingRow[]>();
  for (const b of monthBookings) {
    const day = new Date(b.startsAt).getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), b]);
  }

  async function createBooking() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/studio/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionTypeId: form.sessionTypeId || undefined,
        title: form.title,
        contactId: form.contactId || undefined,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        date: form.date,
        time: form.time,
        slotId: form.slotId || undefined,
        durationMin: parseInt(form.durationMin) || 60,
        priceCents: Math.round((parseFloat(form.price) || 0) * 100),
        notes: form.notes,
        mode: form.mode,
        sendConfirmation: form.sendConfirmation,
        force,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setConflict(!!data.conflict);
      return setError(data.error ?? "Could not create the booking");
    }
    setConflict(false);
    setForce(false);
    setShowAdd(false);
    router.refresh();
  }

  async function patchBooking(id: string, data: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/studio/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) setError(out.error ?? "Update failed");
    router.refresh();
  }

  async function invoiceBooking(id: string) {
    const res = await fetch("/api/studio/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/studio/invoices/${data.id}`);
  }

  async function removeBooking(id: string) {
    if (!confirm("Delete this booking?")) return;
    await fetch(`/api/studio/bookings/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button className="btn-secondary !px-3" onClick={() => shiftMonth(-1)}>
            ←
          </button>
          <h2 className="font-display text-lg w-44 text-center">{monthLabel}</h2>
          <button className="btn-secondary !px-3" onClick={() => shiftMonth(1)}>
            →
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            Google Calendar sync:{" "}
            <span className={googleCalendarSync ? "text-emerald-600" : "text-neutral-400"}>
              {googleCalendarSync ? "on" : "off"}
            </span>{" "}
            (Settings)
          </span>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            + Add booking
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* month grid */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 text-xs text-neutral-400 uppercase tracking-wide border-b border-neutral-200">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`e${i}`} className="min-h-[86px] border-b border-r border-neutral-100 bg-neutral-50/50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const items = byDay.get(day) ?? [];
            const today = new Date();
            const isToday =
              today.getFullYear() === year && today.getMonth() === mo - 1 && today.getDate() === day;
            return (
              <div key={day} className="min-h-[86px] border-b border-r border-neutral-100 p-1.5">
                <span
                  className={`text-xs ${isToday ? "bg-neutral-900 text-white rounded-full px-1.5 py-0.5" : "text-neutral-400"}`}
                >
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      title={`${b.title}${b.contactName ? `, ${b.contactName}` : ""}`}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${STATUS_COLORS[b.status] ?? "bg-neutral-100"}`}
                    >
                      {fmtTime(b.startsAt)} {b.contactName || b.title}
                    </div>
                  ))}
                  {items.length > 3 ? (
                    <p className="text-[10px] text-neutral-400">+{items.length - 3} more</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* upcoming list with actions */}
      <section>
        <h2 className="font-display text-lg mb-3">Upcoming & recent</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing on the calendar yet.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <div key={b.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">
                      {b.title}
                      {b.contactName ? <span className="text-neutral-500">, {b.contactName}</span> : null}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(b.startsAt).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {fmtTime(b.endsAt)} · {money(b.totalCents)} · via{" "}
                      {b.source === "MINI" ? "mini session" : b.source === "BOOKING_SITE" ? "booking site" : "manual"}
                      {b.hasContract ? " · contract" : ""}
                    </p>
                    {b.notes ? <p className="text-xs text-neutral-400 mt-1">{b.notes}</p> : null}
                    {b.approvalState === "REQUESTED" ? (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">Booking request, needs your approval</span>
                        <button className="btn-primary !px-2.5 !py-1 text-xs" onClick={() => decide(b.id, "approve")}>
                          Approve
                        </button>
                        <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => decide(b.id, "decline")}>
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      className="input !w-auto !py-1 text-xs"
                      value={b.status}
                      onChange={(e) => patchBooking(b.id, { status: e.target.value })}
                    >
                      {["PENDING", "AWAITING_CLIENT", "CONFIRMED", "WAITLIST", "COMPLETED", "CANCELLED"].map((s) => (
                        <option key={s} value={s}>
                          {s === "AWAITING_CLIENT" ? "Awaiting client" : s.charAt(0) + s.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input !w-auto !py-1 text-xs"
                      value={b.paymentStatus}
                      onChange={(e) => patchBooking(b.id, { paymentStatus: e.target.value })}
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="RETAINER_PAID">Retainer paid</option>
                      <option value="PAID">Paid</option>
                    </select>
                    {!b.hasInvoice ? (
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => invoiceBooking(b.id)}>
                        Invoice
                      </button>
                    ) : null}
                    {b.clientToken ? (
                      <a className="text-xs underline text-neutral-500" href={`/book/manage/${b.clientToken}`} target="_blank" rel="noreferrer">
                        Client page
                      </a>
                    ) : null}
                    <button className="text-xs text-red-600 underline" onClick={() => removeBooking(b.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAdd ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">Add a booking</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Session type</label>
                  <select
                    className="input"
                    value={form.sessionTypeId}
                    onChange={(e) => setForm({ ...form, sessionTypeId: e.target.value })}
                  >
                    <option value="">Custom…</option>
                    {sessionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isMini ? " (mini)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {!form.sessionTypeId ? (
                  <div>
                    <label className="label">Title</label>
                    <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Existing contact</label>
                  <select
                    className="input"
                    value={form.contactId}
                    onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  >
                    <option value="">New client…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!form.contactId ? (
                  <>
                    <div>
                      <label className="label">Client name</label>
                      <input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Client email</label>
                      <input className="input" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} />
                    </div>
                  </>
                ) : null}
              </div>
              {pickedType?.isMini ? (
                <div>
                  <label className="label">Mini session spot</label>
                  {miniDates.length === 0 ? <p className="text-sm text-neutral-500">No upcoming spots on this mini session.</p> : null}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {miniDates.map((d) => (
                      <div key={d.date}>
                        <p className="text-xs text-neutral-500 mb-1">{d.date}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {d.slots.map((sl) => (
                            <button
                              key={sl.id}
                              type="button"
                              disabled={sl.left <= 0}
                              onClick={() => setForm({ ...form, slotId: sl.id })}
                              className={`text-xs border rounded px-2 py-1 ${form.slotId === sl.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"} ${sl.left <= 0 ? "opacity-40" : ""}`}
                            >
                              {fmtTime(sl.startsAt)} {sl.left <= 0 ? "full" : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Date</label>
                      <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Time</label>
                      <input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                    </div>
                    {!form.sessionTypeId ? (
                      <div>
                        <label className="label">Duration (min)</label>
                        <input className="input" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
                      </div>
                    ) : null}
                  </div>
                  {form.sessionTypeId && form.date ? (
                    <div>
                      <label className="label">Open times on this date</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(openDays.find((d) => d.date === form.date)?.slots ?? []).map((iso) => {
                          const dt = new Date(iso);
                          const hm = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setForm({ ...form, time: hm })}
                              className={`text-xs border rounded px-2 py-1 ${form.time === hm ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
                            >
                              {fmtTime(iso)}
                            </button>
                          );
                        })}
                        {(openDays.find((d) => d.date === form.date)?.slots ?? []).length === 0 ? (
                          <span className="text-xs text-neutral-400">No open times on this date for this session type.</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {conflict ? (
                    <label className="flex items-center gap-2 text-sm text-amber-700">
                      <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                      Book anyway, outside availability or overlapping another booking
                    </label>
                  ) : null}
                </>
              )}
              <div>
                <label className="label">Booking status</label>
                <div className="space-y-1.5 text-sm">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" className="mt-1" checked={form.mode === "CONFIRMED"} onChange={() => setForm({ ...form, mode: "CONFIRMED" })} />
                    <span>
                      Confirmed now
                      <label className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                        <input
                          type="checkbox"
                          checked={form.sendConfirmation}
                          disabled={form.mode !== "CONFIRMED"}
                          onChange={(e) => setForm({ ...form, sendConfirmation: e.target.checked })}
                        />
                        Email the client a confirmation
                      </label>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" className="mt-1" checked={form.mode === "AWAITING_CLIENT"} onChange={() => setForm({ ...form, mode: "AWAITING_CLIENT" })} />
                    <span>
                      Awaiting client
                      <span className="block text-xs text-neutral-500">
                        Holds the time and emails the client a link to answer the questionnaire, sign the contract and pay the
                        retainer. It flips to Confirmed when they finish.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              {!form.sessionTypeId ? (
                <div>
                  <label className="label">Price ($)</label>
                  <input className="input w-32" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              ) : null}
              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy} onClick={createBooking}>
                  {busy ? "Adding…" : "Add booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
