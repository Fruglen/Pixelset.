"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Inst {
  id: string;
  label: string;
  dueDate: string;
  overdue: boolean;
  amountCents: number;
  paid: boolean;
  paidAt: string;
  method: string;
}

export function PayClient({
  token,
  status,
  totalCents,
  installments,
  payMethods,
}: {
  token: string;
  status: string;
  totalCents: number;
  installments: Inst[];
  payMethods: {
    stripe: boolean;
    paypal: boolean;
    manual: boolean;
    manualInstructions: string;
    live?: { stripeLive: boolean; paypalLive: boolean; wallets: string[]; bnpl: string[] };
  };
}) {
  const router = useRouter();
  const [method, setMethod] = useState(payMethods.stripe ? "card" : payMethods.paypal ? "paypal" : "manual");
  const [tip, setTip] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const nextUnpaid = installments.find((i) => !i.paid);

  async function pay(installmentId?: string) {
    setError("");
    setBusy(installmentId ?? "full");
    const tipCents = Math.max(0, Math.round((parseFloat(tip) || 0) * 100));
    // Night build: live processors, when connected, take over the card and
    // PayPal paths (Stripe Checkout / PayPal approval). Everything else uses
    // the recorded demo checkout below.
    const livePath =
      method === "card" && payMethods.live?.stripeLive
        ? `/api/pay/${token}/checkout`
        : method === "paypal" && payMethods.live?.paypalLive
          ? `/api/pay/${token}/paypal`
          : null;
    if (livePath) {
      const res = await fetch(livePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId, tipCents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setBusy("");
        setError(data.error ?? "Could not start the payment.");
        return;
      }
      window.location.href = data.url;
      return;
    }
    const res = await fetch(`/api/pay/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installmentId, method, tipCents }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? "Payment failed.");
      return;
    }
    router.refresh();
  }

  if (status === "PAID") {
    return (
      <p className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
        This invoice is paid in full, thank you!
      </p>
    );
  }

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-display text-lg">Make a payment</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {installments.length > 0 ? (
        <div className="space-y-2">
          {installments.map((inst) => (
            <div
              key={inst.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
                inst.paid ? "border-emerald-200 bg-emerald-50" : inst.overdue ? "border-red-200 bg-red-50" : "border-neutral-200"
              }`}
            >
              <div>
                <p className="font-medium">{inst.label}</p>
                <p className="text-xs text-neutral-500">
                  {inst.paid ? `Paid ${inst.paidAt}${inst.method ? ` · ${inst.method}` : ""}` : `Due ${inst.dueDate}${inst.overdue ? " · overdue" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{money(inst.amountCents)}</span>
                {inst.paid ? (
                  <span className="text-emerald-600 text-xs font-medium">✓ Paid</span>
                ) : (
                  <button
                    className="btn-primary !py-1.5 !px-3"
                    disabled={!!busy || inst.id !== nextUnpaid?.id}
                    title={inst.id !== nextUnpaid?.id ? "Pay earlier instalments first" : undefined}
                    onClick={() => pay(inst.id)}
                  >
                    {busy === inst.id ? "…" : "Pay"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span>Balance due</span>
          <span className="font-semibold">{money(totalCents)}</span>
        </div>
      )}

      <div className="space-y-2">
        <p className="label">Payment method</p>
        {payMethods.stripe ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={method === "card"} onChange={() => setMethod("card")} />
            <span>
              Card, Pixora Payments (Stripe-powered)
              {payMethods.live?.stripeLive && (payMethods.live.wallets.length || payMethods.live.bnpl.length) ? (
                <span className="block text-xs text-neutral-500">
                  Also accepts {[...payMethods.live.wallets, ...payMethods.live.bnpl].join(", ")}
                </span>
              ) : null}
            </span>
          </label>
        ) : null}
        {payMethods.paypal ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={method === "paypal"} onChange={() => setMethod("paypal")} />
            PayPal
          </label>
        ) : null}
        {payMethods.manual ? (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="radio" className="mt-0.5" checked={method === "manual"} onChange={() => setMethod("manual")} />
            <span>
              Pay another way
              {payMethods.manualInstructions ? (
                <span className="block text-xs text-neutral-500">{payMethods.manualInstructions}</span>
              ) : null}
            </span>
          </label>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="label">Add a tip (optional)</label>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {[5, 10, 15].map((pct) => {
              const base = nextUnpaid ? nextUnpaid.amountCents : totalCents;
              const val = ((base * pct) / 100 / 100).toFixed(2);
              return (
                <button
                  key={pct}
                  type="button"
                  className={tip === val ? "btn-primary !px-3 !py-1.5 text-sm" : "btn-secondary !px-3 !py-1.5 text-sm"}
                  onClick={() => setTip(val)}
                >
                  {pct}%
                </button>
              );
            })}
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => setTip("")}>
              No tip
            </button>
          </div>
          <input
            className="input w-28"
            placeholder="Custom $"
            inputMode="decimal"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
          />
        </div>
        <p className="text-xs text-neutral-400">Presets are worked out on the amount you are paying now.</p>
      </div>
      <div className="flex items-end gap-3">
        <div />
        {installments.length === 0 ? (
          <button className="btn-primary" disabled={!!busy} onClick={() => pay()}>
            {busy ? "Processing…" : `Pay ${money(totalCents)}`}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-neutral-400">
        {payMethods.live?.stripeLive || payMethods.live?.paypalLive
          ? "Payments are processed securely by the connected provider. Tap to Pay is available in person."
          : "Demo checkout, no real charge is made. Tap to Pay is available in person."}
      </p>
    </div>
  );
}
