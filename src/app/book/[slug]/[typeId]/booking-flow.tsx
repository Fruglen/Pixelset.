"use client";

import { useEffect, useMemo, useState } from "react";
import { SignaturePad } from "@/components/signature-pad";

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
  requiresApproval?: boolean;
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

function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localHm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BookingFlow({
  slug,
  sessionType,
  addOns,
  questionnaireFields,
  dates,
  payMethods,
  initialSlotId = "",
}: {
  initialSlotId?: string;
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
  const [slotId, setSlotId] = useState(initialSlotId);
  const [pickedDateId, setPickedDateId] = useState(
    dates.find((d) => d.slots.some((s) => s.id === initialSlotId))?.id ?? dates[0]?.id ?? ""
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  // Phase 5B: live availability for regular sessions
  const [fromDate, setFromDate] = useState(() => localYmd(new Date()));
  const [liveDays, setLiveDays] = useState<{ date: string; slots: string[] }[] | null>(null);
  const [slotsError, setSlotsError] = useState("");
  const [signMode, setSignMode] = useState<"type" | "draw">("type");
  const [signatureImage, setSignatureImage] = useState("");
  const [where, setWhere] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [manageToken, setManageToken] = useState("");

  useEffect(() => {
    if (sessionType.isMini) return;
    let alive = true;
    setLiveDays(null);
    setSlotsError("");
    fetch(`/api/book/${slug}/slots?typeId=${sessionType.id}&from=${fromDate}&days=14`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setSlotsError(d.error);
        else setLiveDays(d.days ?? []);
      })
      .catch(() => alive && setSlotsError("Could not load available times."));
    return () => {
      alive = false;
    };
  }, [slug, sessionType.id, sessionType.isMini, fromDate]);

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
  const [awaitingApproval, setAwaitingApproval] = useState(false);
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

  // booking coupon (validated by the server, applied to the pre-tax subtotal)
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const pickedSlot = useMemo(() => {
    for (const d of dates) for (const s of d.slots) if (s.id === slotId) return { d, s };
    return null;
  }, [dates, slotId]);

  const subCents = useMemo(() => {
    const addOnTotal = addOns
      .filter((a) => chosenAddOns.includes(a.id))
      .reduce((n, a) => n + a.priceCents, 0);
    return sessionType.priceCents + addOnTotal;
  }, [addOns, chosenAddOns, sessionType]);

  const discountCents = appliedCoupon ? Math.min(appliedCoupon.discountCents, subCents) : 0;
  const taxCents = Math.round(((subCents - discountCents) * sessionType.taxRate) / 100);
  const estTotal = subCents - discountCents + taxCents;

  // A percent coupon is worked out on the chosen add-ons, so changing the
  // add-ons clears the applied code and the client applies it again.
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError("");
  }, [chosenAddOns]);

  async function applyCoupon() {
    setCouponError("");
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    const res = await fetch(`/api/book/${slug}/coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput, sessionTypeId: sessionType.id, subtotalCents: subCents }),
    });
    const data = await res.json().catch(() => ({}));
    setCouponBusy(false);
    if (!res.ok) return setCouponError(data.error ?? "That code did not work.");
    setAppliedCoupon({ code: data.code, discountCents: data.discountCents });
  }

  const pickedWaitlist = !!pickedSlot && pickedSlot.s.booked >= pickedSlot.s.capacity;

  function timeChosen(): boolean {
    if (sessionType.isMini) return !!slotId;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  }

  async function submitBooking() {
    setError("");
    if (!name.trim()) return setError("Enter your name.");
    if (!/.+@.+\..+/.test(email)) return setError("Enter a valid email.");
    if (sessionType.locationType === "PHONE" && !sessionType.location && !phone.trim()) {
      return setError("Enter a phone number so we can call you.");
    }
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
        couponCode: appliedCoupon?.code ?? "",
        answers,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (res.status === 409 && !sessionType.isMini) {
        setTime("");
        setFromDate((f) => f); // refresh the slot list
        setStep("time");
      }
      return setError(data.error ?? "Could not complete the booking.");
    }
    setBookingId(data.bookingId);
    setWhere(data.where ?? "");
    setMeetingLink(data.meetingLink ?? "");
    setManageToken(data.manageToken ?? "");
    setWaitlisted(data.waitlisted === true);
    setAwaitingApproval(data.awaitingApproval === true);
    setContractToken(data.contractToken ?? "");
    setContractBody(data.contractBody ?? "");
    setContractTitle(data.contractTitle ?? "");
    setTotalCents(data.totalCents ?? 0);
    setRetainerCents(data.retainerCents ?? 0);
    if (data.waitlisted || data.awaitingApproval) setStep("done");
    else if (data.contractToken) setStep("contract");
    else if ((data.retainerCents ?? 0) > 0) setStep("payment");
    else setStep("done");
  }

  async function signContract() {
    setError("");
    if (!signName.trim()) return setError("Type your full name to sign.");
    if (signMode === "draw" && !signatureImage) return setError("Draw your signature in the box.");
    if (!agree) return setError("Tick the box to agree to the terms.");
    setBusy(true);
    const res = await fetch(`/api/sign/${contractToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signName, agree, signatureImage: signMode === "draw" ? signatureImage : "" }),
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
      ? `${fmtDateLong(date)} · ${time ? fmtSlotTime(`${date}T${time}:00`) : ""}`
      : "";

  const steps: { key: Step; label: string }[] = [
    { key: "time", label: sessionType.isMini ? "Pick a spot" : "Date & time" },
    { key: "details", label: "Your details" },
    ...(sessionType.hasContract && !sessionType.requiresApproval ? [{ key: "contract" as Step, label: "Contract" }] : []),
    ...(sessionType.retainerType !== "NONE" && !sessionType.requiresApproval ? [{ key: "payment" as Step, label: "Payment" }] : []),
    { key: "done", label: sessionType.requiresApproval ? "Request sent" : "Confirmed" },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl">{sessionType.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {sessionType.durationMin} min · {money(sessionType.priceCents)}
          {sessionType.locationType === "ZOOM"
            ? " · Zoom call"
            : sessionType.locationType === "VIDEO"
              ? " · Video call, link sent on booking"
              : sessionType.locationType === "PHONE"
                ? " · Phone call"
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
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              className="btn-secondary text-xs"
              disabled={fromDate <= localYmd(new Date())}
              onClick={() => {
                const d = new Date(`${fromDate}T12:00:00`);
                d.setDate(d.getDate() - 14);
                const today = localYmd(new Date());
                setFromDate(localYmd(d) < today ? today : localYmd(d));
              }}
            >
              ← Earlier
            </button>
            <span className="text-xs text-neutral-500">Times shown in your local time zone · {sessionType.durationMin} min</span>
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                const d = new Date(`${fromDate}T12:00:00`);
                d.setDate(d.getDate() + 14);
                setFromDate(localYmd(d));
              }}
            >
              Later →
            </button>
          </div>
          {slotsError ? <p className="text-sm text-red-600">{slotsError}</p> : null}
          {liveDays === null && !slotsError ? <p className="text-sm text-neutral-500">Loading available times…</p> : null}
          {liveDays && liveDays.every((d) => d.slots.length === 0) ? (
            <p className="text-sm text-neutral-500">No open times in these two weeks. Try later dates.</p>
          ) : null}
          {liveDays ? (
            <div className="flex flex-wrap gap-2">
              {liveDays
                .filter((d) => d.slots.length > 0)
                .map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      setDate(d.date);
                      setTime("");
                    }}
                    className={`px-3 py-2 rounded-md text-sm border text-left ${
                      date === d.date ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:bg-neutral-50"
                    }`}
                  >
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    <span className={`block text-[11px] ${date === d.date ? "text-neutral-300" : "text-neutral-400"}`}>
                      {d.slots.length} time{d.slots.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
            </div>
          ) : null}
          {date && liveDays ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(liveDays.find((d) => d.date === date)?.slots ?? []).map((iso) => {
                const hm = localHm(new Date(iso));
                return (
                  <button
                    key={iso}
                    onClick={() => setTime(hm)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      time === hm ? "border-neutral-900 ring-1 ring-neutral-900 bg-white font-medium" : "border-neutral-300 bg-white hover:border-neutral-500"
                    }`}
                  >
                    {fmtSlotTime(iso)}
                  </button>
                );
              })}
            </div>
          ) : null}
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
              <label className="label">Phone{sessionType.locationType === "PHONE" && !sessionType.location ? " *" : ""}</label>
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
              {discountCents > 0 && appliedCoupon ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon {appliedCoupon.code}</span>
                  <span>-{money(discountCents)}</span>
                </div>
              ) : null}
              {sessionType.taxRate > 0 ? (
                <div className="flex justify-between text-neutral-500">
                  <span>Tax ({sessionType.taxRate}%)</span>
                  <span>{money(taxCents)}</span>
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
              {appliedCoupon ? (
                <p className="text-xs text-emerald-600 pt-1">
                  Coupon {appliedCoupon.code} applied.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput("");
                    }}
                  >
                    Remove
                  </button>
                </p>
              ) : (
                <div className="pt-2">
                  <div className="flex gap-2">
                    <input
                      className="input !py-1.5 uppercase flex-1"
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    />
                    <button type="button" className="btn-secondary !py-1.5" disabled={couponBusy || !couponInput.trim()} onClick={applyCoupon}>
                      {couponBusy ? "Checking…" : "Apply"}
                    </button>
                  </div>
                  {couponError ? <p className="text-xs text-red-600 mt-1">{couponError}</p> : null}
                </div>
              )}
            </div>
          ) : null}

          {sessionType.cancellationPolicy ? (
            <p className="text-xs text-neutral-400">{sessionType.cancellationPolicy}</p>
          ) : null}

          <button className="btn-primary" disabled={busy} onClick={submitBooking}>
            {busy
              ? "Working…"
              : pickedWaitlist
                ? "Join waitlist"
                : sessionType.requiresApproval
                  ? "Request this booking"
                  : sessionType.hasContract
                    ? "Continue to contract"
                    : "Book this session"}
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
              <label className="label">Your full legal name *</label>
              <input className="input max-w-sm" value={signName} onChange={(e) => setSignName(e.target.value)} />
            </div>
            <div>
              <div className="flex gap-4 text-sm mb-2">
                <button className={signMode === "type" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setSignMode("type")}>
                  Type signature
                </button>
                <button className={signMode === "draw" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setSignMode("draw")}>
                  Draw signature
                </button>
              </div>
              {signMode === "type" ? (
                signName.trim() ? <p className="font-display italic text-2xl mt-2 text-neutral-800">{signName}</p> : null
              ) : (
                <SignaturePad onChange={setSignatureImage} />
              )}
            </div>
            <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I have read and agree to the terms of this agreement, and I intend my signature above to act as my
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
          <div className="text-4xl mb-3">{waitlisted || awaitingApproval ? "⏳" : "✓"}</div>
          <h2 className="font-display text-2xl">
            {waitlisted ? "You're on the waitlist" : awaitingApproval ? "Request sent" : "You're booked!"}
          </h2>
          <p className="text-sm text-neutral-600 mt-3 max-w-md mx-auto">
            {waitlisted
              ? `We'll email ${email} the moment a spot opens up for ${sessionType.name}.`
              : awaitingApproval
                ? `Your time is held while we review the request. We'll email ${email} once it is approved, with any contract or payment step.`
                : `A confirmation email has been prepared for ${email}.`}
          </p>
          {manageToken && !waitlisted ? (
            <a href={`/book/manage/${manageToken}`} className="btn-secondary inline-block mt-4">
              View or manage this booking
            </a>
          ) : null}
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
              {where ? (
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-500">Where</span>
                  <span className="text-right break-all">
                    {meetingLink ? (
                      <a href={meetingLink} target="_blank" rel="noreferrer" className="underline">
                        {where}
                      </a>
                    ) : (
                      where
                    )}
                  </span>
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
