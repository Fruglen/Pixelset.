"use client";

import { useState } from "react";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayLinkClient({ token, fixedCents, methods }: { token: string; fixedCents: number; methods: { stripe: boolean; paypal: boolean; manual: boolean } }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(methods.stripe ? "card" : methods.paypal ? "paypal" : "manual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(0);
  const cents = fixedCents > 0 ? fixedCents : Math.round((parseFloat(amount) || 0) * 100);

  async function pay() {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/pay-link/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, amountCents: cents, method }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Payment failed.");
    setPaid(out.amountCents);
  }

  if (paid) return <p className="card p-6 text-center text-sm">Thank you, {money(paid)} was recorded as paid.</p>;

  return (
    <div className="card p-6 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {fixedCents > 0 ? (
        <p className="text-center text-3xl font-display">{money(fixedCents)}</p>
      ) : (
        <div>
          <label className="label">Amount ($)</label>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {methods.stripe ? (
          <label className="flex items-center gap-2">
            <input type="radio" checked={method === "card"} onChange={() => setMethod("card")} /> Card
          </label>
        ) : null}
        {methods.paypal ? (
          <label className="flex items-center gap-2">
            <input type="radio" checked={method === "paypal"} onChange={() => setMethod("paypal")} /> PayPal
          </label>
        ) : null}
        {methods.manual ? (
          <label className="flex items-center gap-2">
            <input type="radio" checked={method === "manual"} onChange={() => setMethod("manual")} /> Pay another way
          </label>
        ) : null}
      </div>
      <p className="text-xs text-neutral-400">Demo checkout, no real charge is made; the payment is recorded as received.</p>
      <button className="btn-primary w-full" disabled={busy || cents < 100} onClick={pay}>
        {busy ? "Processing…" : `Pay ${money(cents)}`}
      </button>
    </div>
  );
}
