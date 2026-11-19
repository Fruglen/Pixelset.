"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Pricing lane): subscription management for the account's
// plans. Talks to /api/account/billing, which runs the parked (simulated)
// billing state machine, or real Stripe Checkout when a key is connected.

type Tiers = { gallery: string; website: string; studio: string };
type Cycle = "monthly" | "annual";

interface Billing {
  status: "NONE" | "ACTIVE" | "CLOSED";
  cycle: Cycle;
  periodStart: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  processor: "none" | "stripe";
  history: { at: string; type: string; detail: string; amountCents: number }[];
}

interface Preview {
  currentPriceCents: number;
  newPriceCents: number;
  creditCents: number;
  dueCents: number;
  netCents: number;
  cycleChanged: boolean;
  periodEnd: string | null;
}

const LABEL: Record<string, string> = { free: "Free", basic: "Basic", plus: "Plus", pro: "Pro", ultimate: "Ultimate" };
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "");

export function SubscriptionCard({
  initialTiers,
  billing,
  options,
  priceTable,
  stripeConnected,
}: {
  initialTiers: Tiers;
  billing: Billing;
  options: { gallery: string[]; website: string[]; studio: string[] };
  priceTable: Record<string, Record<string, { monthly: number; annual: number }>>;
  stripeConnected: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Tiers>(initialTiers);
  const [cycle, setCycle] = useState<Cycle>(billing.cycle);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const active = billing.status === "ACTIVE";
  const selectedPrice =
    (priceTable.gallery[sel.gallery]?.[cycle] ?? 0) +
    (priceTable.website[sel.website]?.[cycle] ?? 0) +
    (priceTable.studio[sel.studio]?.[cycle] ?? 0);
  const changed =
    sel.gallery !== initialTiers.gallery || sel.website !== initialTiers.website || sel.studio !== initialTiers.studio || cycle !== billing.cycle;

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/account/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    const json = await post({ action: "preview", ...sel, cycle });
    setPreview(json.preview as Preview);
  }

  async function confirm() {
    const json = await post({ action: "subscribe", ...sel, cycle });
    if (json.url) {
      window.location.href = json.url as string;
      return;
    }
    setPreview(null);
    setMsg(json.simulated ? "Subscription updated in simulated mode. Nothing was charged." : "Subscription updated.");
    router.refresh();
  }

  async function simple(action: string, extra: Record<string, unknown> = {}) {
    await post({ action, ...extra });
    router.refresh();
  }

  const rows: { key: keyof Tiers; name: string }[] = [
    { key: "gallery", name: "Client Gallery" },
    { key: "website", name: "Website" },
    { key: "studio", name: "Studio Manager" },
  ];

  return (
    <div className="card p-5">
      <h2 className="font-medium">Subscription</h2>
      {!stripeConnected && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
          Billing is parked on this server: no payment processor is connected, so subscriptions run in simulated
          mode and no card is ever charged. Connect Stripe (STRIPE_SECRET_KEY) to take real plan payments through
          Stripe Checkout.
        </p>
      )}
      {stripeConnected && (
        <p className="text-sm text-neutral-500 mt-1">
          Stripe is connected: new subscriptions are paid through Stripe Checkout, and plan changes are prorated
          by Stripe.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
        <div>
          <p>
            <span className="text-neutral-500">Status:</span>{" "}
            <span className="font-medium">
              {billing.status === "ACTIVE"
                ? billing.cancelAtPeriodEnd
                  ? `Active, cancelling on ${date(billing.periodEnd)}`
                  : "Active"
                : billing.status === "CLOSED"
                  ? "Closed (on Free plans)"
                  : "No paid subscription"}
            </span>
          </p>
          {active && (
            <p className="mt-1">
              <span className="text-neutral-500">Current period:</span> {date(billing.periodStart)} to{" "}
              {date(billing.periodEnd)} ({billing.cycle})
            </p>
          )}
          {active && (
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={billing.autoRenew}
                disabled={busy}
                onChange={(e) => simple("autoRenew", { value: e.target.checked })}
              />
              Auto renew at the end of the period
            </label>
          )}
          {active && !billing.cancelAtPeriodEnd && (
            <button className="btn-secondary mt-3" disabled={busy} onClick={() => simple("cancel")}>
              Cancel subscription
            </button>
          )}
          {active && billing.cancelAtPeriodEnd && (
            <button className="btn-secondary mt-3" disabled={busy} onClick={() => simple("reactivate")}>
              Undo cancellation
            </button>
          )}
          {active && (
            <p className="text-xs text-neutral-500 mt-2">
              Cancellation policy: no refunds. Paid plans stay active until the end of the paid period, then the
              account moves to the Free plans.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-neutral-500">{active ? "Change to:" : "Choose your plans:"}</span>
            <div className="ml-auto flex rounded-md border border-neutral-200 overflow-hidden">
              {(["monthly", "annual"] as Cycle[]).map((c) => (
                <button
                  key={c}
                  className={`px-2.5 py-1 text-xs ${cycle === c ? "bg-neutral-900 text-white" : "bg-white"}`}
                  onClick={() => {
                    setCycle(c);
                    setPreview(null);
                  }}
                >
                  {c === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rows.map((r) => (
              <div key={r.key}>
                <label className="label">{r.name}</label>
                <select
                  className="input"
                  value={sel[r.key]}
                  onChange={(e) => {
                    setSel({ ...sel, [r.key]: e.target.value });
                    setPreview(null);
                  }}
                >
                  {options[r.key].map((t) => (
                    <option key={t} value={t}>
                      {LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="mt-2">
            Combined price: <span className="font-medium">{money(selectedPrice)}</span> per {cycle === "annual" ? "year" : "month"}
          </p>
          {!preview && (
            <button className="btn-primary mt-2" disabled={busy || (active && !changed)} onClick={review}>
              {active ? "Review change" : "Subscribe"}
            </button>
          )}
          {preview && (
            <div className="mt-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2">
              {billing.status === "ACTIVE" ? (
                <p>
                  Proration to {date(preview.periodEnd ?? billing.periodEnd)}: credit {money(preview.creditCents)} for
                  the unused old plan, {money(preview.dueCents)} for the new plan. Net{" "}
                  {preview.netCents >= 0 ? "due" : "credit"}: <span className="font-medium">{money(Math.abs(preview.netCents))}</span>
                  {preview.cycleChanged ? " (billing cycle changes, so a new period starts today)" : ""}.
                </p>
              ) : (
                <p>
                  Starts today at <span className="font-medium">{money(preview.newPriceCents)}</span> per{" "}
                  {cycle === "annual" ? "year" : "month"}, auto renewing unless cancelled. Cancellations are not
                  refunded.
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button className="btn-primary" disabled={busy} onClick={confirm}>
                  Confirm
                </button>
                <button className="btn-secondary" disabled={busy} onClick={() => setPreview(null)}>
                  Back
                </button>
              </div>
            </div>
          )}
          {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
        </div>
      </div>

      {billing.history.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium">Billing history</h3>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {[...billing.history].reverse().slice(0, 8).map((h, i) => (
              <li key={i} className="py-2 flex gap-3">
                <span className="text-neutral-400 whitespace-nowrap">{new Date(h.at).toLocaleDateString()}</span>
                <span className="flex-1">{h.detail}</span>
                {h.amountCents !== 0 && <span className="whitespace-nowrap">{money(h.amountCents)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
