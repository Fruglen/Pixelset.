"use client";

import { useMemo, useState } from "react";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface SessionTypeInfo {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  durationMin: number;
  priceCents: number;
  taxRate: number;
  locationType: string;
  location: string;
  cancellationPolicy: string;
  retainerType: string;
  retainerValue: number;
  isMini: boolean;
  showBookedSpots: boolean;
  waitlistEnabled: boolean;
  hasContract: boolean;
}

interface AddOn {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

interface QField {
  id: string;
  type: string;
  label: string;
  options: string;
  required: boolean;
}

interface MiniDate {
  id: string;
  date: string;
  slots: { id: string; startsAt: string; endsAt: string; capacity: number; booked: number }[];
}

interface PayMethods {
  stripe: boolean;
  paypal: boolean;
  manual: boolean;
  manualInstructions: string;
}

type Step = "time" | "details" | "contract" | "payment" | "done";

function fmtSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDateLong(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function retainerOf(t: SessionTypeInfo, totalCents: number) {
  if (t.retainerType === "PERCENT") return Math.min(totalCents, Math.round((totalCents * t.retainerValue) / 100));
  if (t.retainerType === "FIXED") return Math.min(totalCents, t.retainerValue);
  if (t.retainerType === "FULL") return totalCents;
  return 0;
}

const TIME_OPTIONS: string[] = [];
for (let h = 8; h <= 19; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 19) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

export function BookingFlow({
  slug,
  sessionType,
  addOns,
  questionnaireFields,
  dates,
  payMethods,
}: {
  slug: string;
  sessionType: SessionTypeInfo;
  addOns: AddOn[];
  questionnaireFields: QField[];
  dates: MiniDate[];
  payMethods: PayMethods;
}) {
  const [step, setStep] = useState<Step>("time");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // step: time
  const [slotId, setSlotId] = useState("");
  const [pickedDateId, setPickedDateId] = useState(dates[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");

  // step: details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [chosenAddOns, setChosenAddOns] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // after booking
  const [bookingId, setBookingId] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);
  const [contractToken, setContractToken] = useState("");
  const [contractBody, setContractBody] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [retainerCents, setRetainerCents] = useState(0);

  // contract step
  const [signName, setSignName] = useState("");
  const [agree, setAgree] = useState(false);
  const [signedName, setSignedName] = useState("");

  // payment step
  const [method, setMethod] = useState(payMethods.stripe ? "card" : payMethods.paypal ? "paypal" : "manual");
  const [paidStatus, setPaidStatus] = useState("");

  const pickedSlot = useMemo(() => {
    for (const d of dates) for (const s of d.slots) if (s.id === slotId) return { d, s };
    return null;
  }, [dates, slotId]);

  const estTotal = useMemo(() => {
    const addOnTotal = addOns
      .filter((a) => chosenAddOns.includes(a.id))
      .reduce((n, a) => n + a.priceCents, 0);
    const sub = sessionType.priceCents + addOnTotal;
    return sub + Math.round((sub * sessionType.taxRate) / 100);
  }, [addOns, chosenAddOns, sessionType]);

  const pickedWaitlist = !!pickedSlot && pickedSlot.s.booked >= pickedSlot.s.capacity;

  function timeChosen(): boolean {
    if (sessionType.isMini) return !!slotId;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !!time;
  }

  async function submitBooking() {
    setError("");
    if (!name.trim()) return setError("Enter your name.");
    if (!/.+@.+\..+/.test(email)) return setError("Enter a valid email.");
    for (const f of questionnaireFields) {
      if (f.required && !(answers[f.id] ?? "").trim()) {
        return setError(`Please answer: ${f.label}`);
      }
    }
    setBusy(true);
    const res = await fetch(`/api/book/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionTypeId: sessionType.id,
        slotId: sessionType.isMini ? slotId : undefined,
        date: sessionType.isMini ? undefined : date,
        time: sessionType.isMini ? undefined : time,
        name,
        email,
        phone,
        notes,
        addOnIds: chosenAddOns,
        answers,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not complete the booking.");
    setBookingId(data.bookingId);
    setWaitlisted(data.waitlisted === true);
    setContractToken(data.contractToken ?? "");
    setContractBody(data.contractBody ?? "");
    setContractTitle(data.contractTitle ?? "");
    setTotalCents(data.totalCents ?? 0);
    setRetainerCents(data.retainerCents ?? 0);
    if (data.waitlisted) setStep("done");
    else if (data.contractToken) setStep("contract");
    else if ((data.retainerCents ?? 0) > 0) setStep("payment");
    else setStep("done");
  }

  async function signContract() {
    setError("");
    if (!signName.trim()) return setError("Type your full name to sign.");
    if (!agree) return setError("Tick the box to agree to the terms.");
    setBusy(true);
    const res = await fetch(`/api/sign/${contractToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signName, agree }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not sign the contract.");
    setSignedName(signName);
    if (retainerCents > 0) setStep("payment");
    else setStep("done");
  }

  async function payRetainer() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/book/${slug}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, method }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Payment failed.");
    setPaidStatus(data.paymentStatus ?? "RETAINER_PAID");
    setStep("done");
  }

  const whenLabel = sessionType.isMini
    ? pickedSlot
      ? `${fmtDateLong(pickedSlot.d.date)} · ${fmtSlotTime(pickedSlot.s.startsAt)}–${fmtSlotTime(pickedSlot.s.endsAt)}`
      : ""
    : date
      ? `${fmtDateLong(date)} · ${time}`
      : "";

  const steps: { key: Step; label: string }[] = [
    { key: "time", label: sessionType.isMini ? "Pick a spot" : "Date & time" },
    { key: "details", label: "Your details" },
    ...(sessionType.hasContract ? [{ key: "contract" as Step, label: "Contract" }] : []),
    ...(sessionType.retainerType !== "NONE" ? [{ key: "payment" as Step, label: "Payment" }] : []),
    { key: "done", label: "Confirmed" },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl">{sessionType.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {sessionType.durationMin} min · {money(sessionType.priceCents)}
          {sessionType.locationType === "ZOOM"
            ? " · Zoom"
            : sessionType.location
              ? ` · ${sessionType.location}`
              : ""}
        </p>
        {sessionType.description ? (
          <p className="text-sm text-neutral-600 mt-3">{sessionType.description}</p>
        ) : null}
      </div>

      {/* progress */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 ? <span className="text-neutral-300">-</span> : null}
            <span
              className={
                i < stepIdx
                  ? "text-emerald-600"
                  : i === stepIdx
                    ? "font-semibold text-neutral-900"
                    : "text-neutral-400"
              }
            >
              {i < stepIdx ? "✓ " : ""}
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
      ) : null}

      {/* ---------------------------------------------------------- step: time */}
      {step === "time" && sessionType.isMini ? (
        <div className="space-y-6">
          {dates.length === 0 ? (
            <p className="text-sm text-neutral-500">No dates are available yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setPickedDateId(d.id)}
                    className={`px-4 py-2 rounded-md text-sm border ${
                      pickedDateId === d.id
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    {fmtDateLong(d.date)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(dates.find((d) => d.id === pickedDateId)?.slots ?? []).map((s) => {
                  const left = s.capacity - s.booked;
                  const full = left <= 0;
                  const selectable = !full || sessionType.waitlistEnabled;
                  return (
                    <button
                      key={s.id}
                      disabled={!selectable}
                      onClick={() => setSlotId(s.id)}
                      className={`rounded-md border px-3 py-2.5 text-sm text-left ${
                        slotId === s.id
                          ? "border-neutral-900 ring-1 ring-neutral-900 bg-white"
                          : full
                            ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                            : "border-neutral-300 bg-white hover:border-neutral-500"
                      } ${!selectable ? "cursor-not-allowed" : ""}`}
                    >
                      <span className="font-medium">{fmtSlotTime(s.startsAt)}</span>
                      <span className="block text-xs mt-0.5">
                        {full
                          ? sessionType.waitlistEnabled
                            ? "Full, join waitlist"
                            : "Full"
                          : sessionType.showBookedSpots
                            ? `${left} of ${s.capacity} spot${s.capacity === 1 ? "" : "s"} left`
                            : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button className="btn-primary" disabled={!timeChosen()} onClick={() => setStep("details")}>
                {pickedWaitlist ? "Join the waitlist" : "Continue"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {step === "time" && !sessionType.isMini ? (
        <div className="space-y-5 max-w-sm">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Start time</label>
            <select className="input" value={time} onChange={(e) => setTime(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-400 mt-1">Session length: {sessionType.durationMin} minutes.</p>
          </div>
          <button className="btn-primary" disabled={!timeChosen()} onClick={() => setStep("details")}>
            Continue
          </button>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- step: details */}
      {step === "details" ? (
        <div className="space-y-6">
          <p className="text-sm text-neutral-500">
            {pickedWaitlist ? "Joining the waitlist for" : "Booking"}: <span className="text-neutral-900 font-medium">{whenLabel}</span>{" "}
            <button className="underline text-neutral-500 ml-2" onClick={() => setStep("time")}>
              change
            </button>
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {addOns.length > 0 && !pickedWaitlist ? (
            <div>
              <label className="label">Add-ons</label>
              <div className="space-y-2">
                {addOns.map((a) => (
                  <label key={a.id} className="card flex items-start gap-3 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={chosenAddOns.includes(a.id)}
                      onChange={(e) =>
                        setChosenAddOns((prev) =>
                          e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)
                        )
                      }
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-neutral-500"> · {money(a.priceCents)}</span>
                      {a.description ? <span className="block text-xs text-neutral-500 mt-0.5">{a.description}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {questionnaireFields.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-display text-lg">A few questions</h3>
              {questionnaireFields.map((f) => (
                <div key={f.id}>
                  <label className="label">
                    {f.label}
                    {f.required ? " *" : ""}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      className="input min-h-[80px]"
                      value={answers[f.id] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                    />
                  ) : f.type === "choice" ? (
                    <select
                      className="input"
                      value={answers[f.id] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      {f.options
                        .split(",")
                        .map((o) => o.trim())
                        .filter(Boolean)
                        .map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type === "date" ? "date" : "text"}
                      value={answers[f.id] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label className="label">Anything else?</label>
            <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {!pickedWaitlist ? (
            <div className="card p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span>{sessionType.name}</span>
                <span>{money(sessionType.priceCents)}</span>
              </div>
              {addOns
                .filter((a) => chosenAddOns.includes(a.id))
                .map((a) => (
                  <div key={a.id} className="flex justify-between text-neutral-600">
                    <span>{a.name}</span>
                    <span>{money(a.priceCents)}</span>
                  </div>
                ))}
              {sessionType.taxRate > 0 ? (
                <div className="flex justify-between text-neutral-500">
                  <span>Tax ({sessionType.taxRate}%)</span>
                  <span>
                    {money(estTotal - sessionType.priceCents - addOns.filter((a) => chosenAddOns.includes(a.id)).reduce((n, a) => n + a.priceCents, 0))}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold border-t border-neutral-100 pt-2 mt-2">
                <span>Total</span>
                <span>{money(estTotal)}</span>
              </div>
              {sessionType.retainerType !== "NONE" ? (
                <div className="flex justify-between text-neutral-600">
                  <span>Due now{sessionType.retainerType !== "FULL" ? " (retainer)" : ""}</span>
                  <span>{money(retainerOf(sessionType, estTotal))}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {sessionType.cancellationPolicy ? (
            <p className="text-xs text-neutral-400">{sessionType.cancellationPolicy}</p>
          ) : null}

          <button className="btn-primary" disabled={busy} onClick={submitBooking}>
            {busy ? "Working…" : pickedWaitlist ? "Join waitlist" : sessionType.hasContract ? "Continue to contract" : "Book this session"}
          </button>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- step: contract */}
      {step === "contract" ? (
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-display text-lg mb-3">{contractTitle}</h3>
            <div className="text-sm whitespace-pre-wrap text-neutral-700 max-h-80 overflow-y-auto border border-neutral-100 rounded-md p-4 bg-neutral-50">
              {contractBody}
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">Type your full legal name to sign *</label>
              <input className="input max-w-sm" value={signName} onChange={(e) => setSignName(e.target.value)} />
              {signName.trim() ? (
                <p className="font-display italic text-2xl mt-2 text-neutral-800">{signName}</p>
              ) : null}
            </div>
            <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I have read and agree to the terms of this agreement, and I intend my typed name to act as my
              electronic signature.
            </label>
            <button className="btn-primary" disabled={busy} onClick={signContract}>
              {busy ? "Signing…" : "Sign agreement"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- step: payment */}
      {step === "payment" ? (
        <div className="space-y-5 max-w-md">
          <div className="card p-5 text-sm space-y-1">
            <div className="flex justify-between font-semibold">
              <span>{retainerCents >= totalCents ? "Payment due now" : "Retainer due now"}</span>
              <span>{money(retainerCents)}</span>
            </div>
            {retainerCents < totalCents ? (
              <p className="text-neutral-500 text-xs">
                Remaining {money(totalCents - retainerCents)} due by the session date.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            {payMethods.stripe ? (
              <label className="card flex items-center gap-3 p-3 cursor-pointer text-sm">
                <input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} />
                <span>
                  <span className="font-medium">Card</span>
                  <span className="text-neutral-500">, Pixelset Payments (Stripe-powered)</span>
                </span>
              </label>
            ) : null}
            {payMethods.paypal ? (
              <label className="card flex items-center gap-3 p-3 cursor-pointer text-sm">
                <input type="radio" name="method" checked={method === "paypal"} onChange={() => setMethod("paypal")} />
                <span className="font-medium">PayPal</span>
              </label>
            ) : null}
            {payMethods.manual ? (
              <label className="card flex items-start gap-3 p-3 cursor-pointer text-sm">
                <input type="radio" name="method" className="mt-0.5" checked={method === "manual"} onChange={() => setMethod("manual")} />
                <span>
                  <span className="font-medium">Pay another way</span>
                  {payMethods.manualInstructions ? (
                    <span className="block text-xs text-neutral-500 mt-0.5">{payMethods.manualInstructions}</span>
                  ) : null}
                </span>
              </label>
            ) : null}
          </div>
          <p className="text-xs text-neutral-400">
            Demo checkout, no real charge is made; the payment is recorded as received.
          </p>
          <button className="btn-primary w-full" disabled={busy} onClick={payRetainer}>
            {busy ? "Processing…" : `Pay ${money(retainerCents)}`}
          </button>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- step: done */}
      {step === "done" ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">{waitlisted ? "⏳" : "✓"}</div>
          <h2 className="font-display text-2xl">
            {waitlisted ? "You're on the waitlist" : "You're booked!"}
          </h2>
          <p className="text-sm text-neutral-600 mt-3 max-w-md mx-auto">
            {waitlisted
              ? `We'll email ${email} the moment a spot opens up for ${sessionType.name}.`
              : `A confirmation email is on its way to ${email}.`}
          </p>
          {!waitlisted ? (
            <div className="text-sm text-left max-w-sm mx-auto mt-6 space-y-2 border-t border-neutral-100 pt-5">
              <div className="flex justify-between">
                <span className="text-neutral-500">Session</span>
                <span>{sessionType.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">When</span>
                <span>{whenLabel}</span>
              </div>
              {sessionType.locationType === "ZOOM" ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Where</span>
                  <span>Zoom, link to follow</span>
                </div>
              ) : sessionType.location ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Where</span>
                  <span>{sessionType.location}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-neutral-500">Total</span>
                <span>{money(totalCents)}</span>
              </div>
              {signedName ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Contract</span>
                  <span className="text-emerald-600">Signed by {signedName}</span>
                </div>
              ) : null}
              {retainerCents > 0 ? (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Payment</span>
                  <span className={paidStatus ? "text-emerald-600" : "text-amber-600"}>
                    {paidStatus
                      ? paidStatus === "PAID"
                        ? `Paid ${money(retainerCents)}`
                        : `Retainer paid ${money(retainerCents)}`
                      : "Due at session"}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
