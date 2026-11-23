"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvailabilityEditor } from "./availability-editor";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TypeData {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  durationMin: number;
  bufferMin: number;
  bufferBeforeMin: number;
  availability: string;
  remindersEnabled: boolean;
  reminderHoursBefore: number;
  meetingLink: string;
  priceCents: number;
  taxRate: number;
  locationType: string;
  location: string;
  cancellationPolicy: string;
  retainerType: string;
  retainerValue: number;
  requiresApproval?: boolean;
  contractTemplateId: string;
  questionnaireId: string;
  active: boolean;
  isMini: boolean;
  published: boolean;
  showBookedSpots: boolean;
  waitlistEnabled: boolean;
}

interface AddOn {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

interface SlotInfo {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
  waitlist: number;
  names: string[];
}

interface DateInfo {
  id: string;
  date: string;
  startTime: string;
  slotLengthMin: number;
  slotCount: number;
  spotsPerSlot: number;
  breakEvery: number;
  breakMin: number;
  slots: SlotInfo[];
}

export function SessionEditor({
  bookingSlug,
  type,
  addOns,
  dates,
  templates,
  questionnaires,
  studioPro = true,
}: {
  studioPro?: boolean;
  bookingSlug: string;
  type: TypeData;
  addOns: AddOn[];
  dates: DateInfo[];
  templates: { id: string; name: string }[];
  questionnaires: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: type.name,
    description: type.description,
    coverUrl: type.coverUrl,
    durationMin: String(type.durationMin),
    bufferMin: String(type.bufferMin),
    bufferBeforeMin: String(type.bufferBeforeMin),
    meetingLink: type.meetingLink,
    reminderHoursBefore: String(type.reminderHoursBefore),
    price: (type.priceCents / 100).toFixed(2),
    taxRate: String(type.taxRate),
    locationType: type.locationType,
    location: type.location,
    cancellationPolicy: type.cancellationPolicy,
    retainerType: type.retainerType,
    retainerValue:
      type.retainerType === "FIXED" ? (type.retainerValue / 100).toFixed(2) : String(type.retainerValue),
    requiresApproval: !!type.requiresApproval,
    contractTemplateId: type.contractTemplateId,
    questionnaireId: type.questionnaireId,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // add-on form
  const [aoName, setAoName] = useState("");
  const [aoPrice, setAoPrice] = useState("");
  const [aoDesc, setAoDesc] = useState("");

  // new date form
  const [showDateForm, setShowDateForm] = useState(false);
  const [df, setDf] = useState({
    date: "",
    startTime: "09:00",
    slotLengthMin: String(type.durationMin || 15),
    slotCount: "8",
    spotsPerSlot: "1",
    breakEvery: "0",
    breakMin: "0",
  });

  const directLink = `/book/${bookingSlug}/${type.id}`;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  async function patch(data: Record<string, unknown>, refresh = true) {
    setError("");
    const res = await fetch(`/api/studio/session-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? "Save failed");
      return false;
    }
    if (refresh) router.refresh();
    return true;
  }

  async function save() {
    setBusy(true);
    setMsg("");
    const ok = await patch({
      name: form.name,
      description: form.description,
      coverUrl: form.coverUrl,
      durationMin: parseInt(form.durationMin) || type.durationMin,
      bufferMin: parseInt(form.bufferMin) || 0,
      bufferBeforeMin: parseInt(form.bufferBeforeMin) || 0,
      meetingLink: form.meetingLink,
      reminderHoursBefore: parseInt(form.reminderHoursBefore) || 24,
      priceCents: Math.round((parseFloat(form.price) || 0) * 100),
      taxRate: parseFloat(form.taxRate) || 0,
      locationType: form.locationType,
      location: form.location,
      cancellationPolicy: form.cancellationPolicy,
      retainerType: form.retainerType,
      retainerValue:
        form.retainerType === "FIXED"
          ? Math.round((parseFloat(form.retainerValue) || 0) * 100)
          : Math.round(parseFloat(form.retainerValue) || 0),
      requiresApproval: form.requiresApproval,
      contractTemplateId: form.contractTemplateId || null,
      questionnaireId: form.questionnaireId || null,
    });
    setBusy(false);
    if (ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  async function addAddOn() {
    if (!aoName.trim()) return;
    const res = await fetch(`/api/studio/session-types/${type.id}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: aoName,
        priceCents: Math.round((parseFloat(aoPrice) || 0) * 100),
        description: aoDesc,
      }),
    });
    if (res.ok) {
      setAoName("");
      setAoPrice("");
      setAoDesc("");
      router.refresh();
    }
  }

  async function deleteAddOn(id: string) {
    await fetch(`/api/studio/addons/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addDate() {
    setError("");
    const res = await fetch(`/api/studio/session-types/${type.id}/dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: df.date,
        startTime: df.startTime,
        slotLengthMin: parseInt(df.slotLengthMin) || 15,
        slotCount: parseInt(df.slotCount) || 8,
        spotsPerSlot: parseInt(df.spotsPerSlot) || 1,
        breakEvery: parseInt(df.breakEvery) || 0,
        breakMin: parseInt(df.breakMin) || 0,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setError(out.error ?? "Could not add date");
    setShowDateForm(false);
    setDf({ ...df, date: "" });
    router.refresh();
  }

  async function deleteDate(id: string) {
    if (!confirm("Delete this date and its slots?")) return;
    const res = await fetch(`/api/studio/dates/${id}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) setError(out.error ?? "Could not delete");
    router.refresh();
  }

  async function duplicate() {
    const res = await fetch(`/api/studio/session-types/${type.id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/studio/sessions/${data.id}`);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Delete this session type? Existing bookings keep their details.")) return;
    await fetch(`/api/studio/session-types/${type.id}`, { method: "DELETE" });
    router.push("/studio/sessions");
    router.refresh();
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/sessions" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Sessions
        </Link>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          <button className="btn-secondary" onClick={duplicate}>
            Duplicate
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* publish / visibility */}
      {type.isMini ? (
        <div className={`card p-5 ${type.published ? "border-emerald-200" : "border-amber-200"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg">{type.published ? "Published" : "Not published"}</h2>
              <p className="text-sm text-neutral-500 mt-1">
                {type.published
                  ? "Clients can book through the direct link or your booking site."
                  : "Publish to open booking. The direct link stays private until then."}
              </p>
            </div>
            <button
              className={type.published ? "btn-secondary" : "btn-primary"}
              onClick={() => patch({ published: !type.published })}
            >
              {type.published ? "Unpublish" : "Publish"}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input className="input font-mono text-xs" readOnly value={directLink} onFocus={(e) => e.target.select()} />
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}${directLink}`)}
            >
              Copy link
            </button>
            {type.published ? (
              <a className="btn-secondary whitespace-nowrap" href={directLink} target="_blank" rel="noreferrer">
                Open ↗
              </a>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={type.showBookedSpots}
                onChange={(e) => patch({ showBookedSpots: e.target.checked })}
              />
              Show remaining spots to clients
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={type.waitlistEnabled}
                onChange={(e) => patch({ waitlistEnabled: e.target.checked })}
              />
              Waitlist when a slot is full
            </label>
          </div>
        </div>
      ) : (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg">{type.active ? "Listed on your booking site" : "Hidden"}</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Direct link: <span className="font-mono text-xs">{directLink}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}${directLink}`)}
            >
              Copy link
            </button>
            <button className="btn-secondary" onClick={() => patch({ active: !type.active })}>
              {type.active ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

      {/* details */}
      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Details</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[70px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Cover image URL</label>
          <input
            className="input"
            placeholder="https://… or /api/placeholder?..."
            value={form.coverUrl}
            onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="label">{type.isMini ? "Slot length (min)" : "Duration (min)"}</label>
            <input
              className="input"
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Buffer before (min)</label>
            <input
              className="input"
              value={form.bufferBeforeMin}
              onChange={(e) => setForm({ ...form, bufferBeforeMin: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Buffer after (min)</label>
            <input
              className="input"
              value={form.bufferMin}
              onChange={(e) => setForm({ ...form, bufferMin: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Price ($)</label>
            <input className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax rate (%)</label>
            <input
              className="input"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Location type</label>
            <select
              className="input"
              value={form.locationType}
              onChange={(e) => setForm({ ...form, locationType: e.target.value })}
            >
              <option value="IN_PERSON">In person</option>
              <option value="VIDEO">Video call (link created per booking)</option>
              <option value="ZOOM">Zoom (your own link)</option>
              <option value="PHONE">Phone call</option>
            </select>
          </div>
          {form.locationType === "VIDEO" ? (
            <div>
              <label className="label">Fixed meeting link (optional)</label>
              <input
                className="input"
                placeholder="Leave empty to create a new video room for every booking"
                value={form.meetingLink}
                onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
              />
              <p className="text-xs text-neutral-400 mt-1">
                Empty: each booking gets its own Jitsi Meet room link, included in the confirmation and reminder emails.
              </p>
            </div>
          ) : (
            <div>
              <label className="label">
                {form.locationType === "ZOOM" ? "Zoom link" : form.locationType === "PHONE" ? "Number the client should call (optional)" : "Location"}
              </label>
              <input
                className="input"
                placeholder={
                  form.locationType === "ZOOM"
                    ? "https://zoom.us/j/…"
                    : form.locationType === "PHONE"
                      ? "Leave empty and you will call the client"
                      : "Zilker Park, Austin"
                }
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              {form.locationType === "PHONE" && !form.location ? (
                <p className="text-xs text-neutral-400 mt-1">Clients must enter a phone number when they book.</p>
              ) : null}
            </div>
          )}
        </div>
        <div>
          <label className="label">Cancellation policy</label>
          <textarea
            className="input min-h-[60px]"
            value={form.cancellationPolicy}
            onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })}
          />
        </div>
      </section>

      {!type.isMini ? <AvailabilityEditor value={type.availability} onSave={(json) => patch({ availability: json })} /> : null}

      {/* reminders */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg">Session reminders</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Emails the client the upcoming session reminder (Settings, Email templates) ahead of each confirmed booking.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={type.remindersEnabled} onChange={(e) => patch({ remindersEnabled: e.target.checked })} />
            Send reminders
          </label>
        </div>
        {type.remindersEnabled ? (
          <div className="flex items-center gap-2 text-sm">
            <span>Send</span>
            <input
              className="input w-20"
              value={form.reminderHoursBefore}
              onChange={(e) => setForm({ ...form, reminderHoursBefore: e.target.value })}
            />
            <span>hours before the session (saved with Save).</span>
          </div>
        ) : null}
      </section>

      {type.isMini ? (
        <section className="card p-5 space-y-3">
          <h2 className="font-display text-lg">Embed on your website</h2>
          <p className="text-sm text-neutral-500">
            In the Website editor, add the <span className="font-medium">Mini session calendar</span> block (Forms) to show this
            mini session&apos;s open spots live on any page. To embed it on another site, paste this code:
          </p>
          <textarea
            readOnly
            className="input font-mono text-xs min-h-[70px]"
            onFocus={(e) => e.target.select()}
            value={`<iframe src="${origin}/book/${bookingSlug}/embed/${type.id}" style="width:100%;min-height:520px;border:0" title="${type.name}"></iframe>`}
          />
        </section>
      ) : null}

      {/* payment schedule */}
      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Payment at booking</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Retainer</label>
            <select
              className="input"
              disabled={!studioPro}
              value={form.retainerType}
              onChange={(e) => setForm({ ...form, retainerType: e.target.value, retainerValue: e.target.value === "PERCENT" ? "25" : e.target.value === "FIXED" ? "100.00" : "0" })}
            >
              <option value="NONE">No payment at booking</option>
              <option value="PERCENT">Percentage retainer</option>
              <option value="FIXED">Fixed-amount retainer</option>
              <option value="FULL">Full payment at booking</option>
            </select>
          </div>
          {form.retainerType === "PERCENT" || form.retainerType === "FIXED" ? (
            <div>
              <label className="label">{form.retainerType === "PERCENT" ? "Retainer (%)" : "Retainer ($)"}</label>
              <input
                className="input"
                value={form.retainerValue}
                onChange={(e) => setForm({ ...form, retainerValue: e.target.value })}
              />
            </div>
          ) : null}
        </div>
        <p className="text-xs text-neutral-500">
          Online payment is not enabled yet, so collect the retainer directly and record it on the booking; the remainder is due by
          the session date.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            disabled={!studioPro}
            checked={form.requiresApproval}
            onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
          />
          <span>
            Manual approval
            <span className="block text-xs text-neutral-500">
              Bookings arrive as requests. You approve or decline each one from the Calendar before the client signs or pays.
            </span>
          </span>
        </label>
        {!studioPro ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
            Retainers at booking and manual approval are Studio Manager Pro features. Your current plan does not include them,
            so bookings confirm without a payment step. Change plan in{" "}
            <a className="underline" href="/settings/plan">
              Settings, Plan
            </a>
            .
          </p>
        ) : null}
      </section>

      {/* add-ons */}
      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Add-ons</h2>
        {addOns.length ? (
          <ul className="divide-y divide-neutral-100">
            {addOns.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-neutral-500"> · {money(a.priceCents)}</span>
                  {a.description ? <p className="text-xs text-neutral-500">{a.description}</p> : null}
                </div>
                <button className="text-xs text-red-600 underline" onClick={() => deleteAddOn(a.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No add-ons yet, e.g. extra prints, a second location, rush delivery.</p>
        )}
        <div className="grid grid-cols-[1fr_90px_1fr_auto] gap-2 items-end">
          <div>
            <label className="label">Name</label>
            <input className="input" value={aoName} onChange={(e) => setAoName(e.target.value)} />
          </div>
          <div>
            <label className="label">Price ($)</label>
            <input className="input" value={aoPrice} onChange={(e) => setAoPrice(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={aoDesc} onChange={(e) => setAoDesc(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={addAddOn}>
            Add
          </button>
        </div>
      </section>

      {/* attachments */}
      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Contract & questionnaire</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Contract template</label>
            <select
              className="input"
              value={form.contractTemplateId}
              onChange={(e) => setForm({ ...form, contractTemplateId: e.target.value })}
            >
              <option value="">None, book without a contract</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Questionnaire</label>
            <select
              className="input"
              value={form.questionnaireId}
              onChange={(e) => setForm({ ...form, questionnaireId: e.target.value })}
            >
              <option value="">None</option>
              {questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          With a contract attached, clients sign during booking (typed signature, timestamped with IP and
          browser). Questionnaire answers are stored with the booking.
        </p>
      </section>

      {/* mini dates */}
      {type.isMini ? (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Dates & slots</h2>
            <button className="btn-secondary" onClick={() => setShowDateForm((v) => !v)}>
              {showDateForm ? "Cancel" : "+ Add date"}
            </button>
          </div>

          {showDateForm ? (
            <div className="border border-neutral-200 rounded-md p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end bg-neutral-50">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={df.date} onChange={(e) => setDf({ ...df, date: e.target.value })} />
              </div>
              <div>
                <label className="label">Start time</label>
                <input type="time" className="input" value={df.startTime} onChange={(e) => setDf({ ...df, startTime: e.target.value })} />
              </div>
              <div>
                <label className="label">Slot length (min)</label>
                <input className="input" value={df.slotLengthMin} onChange={(e) => setDf({ ...df, slotLengthMin: e.target.value })} />
              </div>
              <div>
                <label className="label"># of slots</label>
                <input className="input" value={df.slotCount} onChange={(e) => setDf({ ...df, slotCount: e.target.value })} />
              </div>
              <div>
                <label className="label">Spots per slot</label>
                <input className="input" value={df.spotsPerSlot} onChange={(e) => setDf({ ...df, spotsPerSlot: e.target.value })} />
              </div>
              <div>
                <label className="label">Break after every N slots</label>
                <input className="input" value={df.breakEvery} onChange={(e) => setDf({ ...df, breakEvery: e.target.value })} />
              </div>
              <div>
                <label className="label">Break length (min)</label>
                <input className="input" value={df.breakMin} onChange={(e) => setDf({ ...df, breakMin: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={addDate}>
                Generate slots
              </button>
            </div>
          ) : null}

          {dates.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No dates yet. Add a date and its time slots are generated automatically from the start time,
              slot length, spot count and breaks.
            </p>
          ) : (
            <div className="space-y-4">
              {dates.map((d) => (
                <div key={d.id} className="border border-neutral-200 rounded-md p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-neutral-500">
                        From {d.startTime} · {d.slots.length} slots × {d.slotLengthMin} min · {d.spotsPerSlot} spot
                        {d.spotsPerSlot === 1 ? "" : "s"} each
                        {d.breakEvery ? ` · ${d.breakMin}-min break every ${d.breakEvery} slots` : ""}
                      </p>
                    </div>
                    <button className="text-xs text-red-600 underline" onClick={() => deleteDate(d.id)}>
                      Delete date
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.slots.map((s) => {
                      const full = s.booked >= s.capacity;
                      return (
                        <span
                          key={s.id}
                          title={s.names.join(", ") || undefined}
                          className={`text-xs px-2 py-1 rounded border ${
                            full
                              ? "bg-neutral-900 text-white border-neutral-900"
                              : s.booked > 0
                                ? "bg-amber-50 border-amber-300 text-amber-800"
                                : "bg-white border-neutral-200 text-neutral-600"
                          }`}
                        >
                          {fmtTime(s.startsAt)} · {s.booked}/{s.capacity}
                          {s.waitlist ? ` +${s.waitlist}wl` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="card p-5 border-red-200 flex items-center justify-between">
        <p className="text-sm text-neutral-500">Delete this session type.</p>
        <button className="btn-danger" onClick={remove}>
          Delete
        </button>
      </section>
    </div>
  );
}
