"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  date: string;
  source: string;
  label: string;
  amountCents: number;
  tipCents: number;
  feeCents: number;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

// Night build: payouts management. Balances are worked out from the payment
// ledger: gross, minus refunds, minus processor fees, grouped into weekly
// payouts (paid on Mondays). With a live processor connected, payouts land in
// the bank on the processor's schedule; these figures mirror them.
export function PayoutsPanel({ rows }: { rows: Row[] }) {
  const { available, fees, refunded, batches } = useMemo(() => {
    let net = 0;
    let feeTotal = 0;
    let refundTotal = 0;
    const byWeek = new Map<string, number>();
    for (const r of rows) {
      const v = r.amountCents + r.tipCents - (r.amountCents > 0 ? r.feeCents : 0);
      net += v;
      feeTotal += r.amountCents > 0 ? r.feeCents : 0;
      if (r.amountCents < 0) refundTotal += -r.amountCents;
      const k = weekKey(r.date);
      byWeek.set(k, (byWeek.get(k) ?? 0) + v);
    }
    const list = Array.from(byWeek.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, cents]) => {
        const monday = new Date(`${week}T12:00:00`);
        const payoutDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
        return { week, cents, payoutDate, paid: payoutDate.getTime() <= Date.now() };
      });
    return { available: net, fees: feeTotal, refunded: refundTotal, batches: list };
  }, [rows]);

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg">Payouts</h2>
      <div className="grid md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Available balance</p>
          <p className="text-2xl font-display mt-1">{money(available)}</p>
          <p className="text-xs text-neutral-400 mt-1">Net of fees and refunds, weekly schedule</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Processor fees (estimated)</p>
          <p className="text-2xl font-display mt-1">{money(fees)}</p>
          <p className="text-xs text-neutral-400 mt-1">Card 2.9% + $0.30, PayPal 3.49% + $0.49</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Refunded</p>
          <p className="text-2xl font-display mt-1">{money(refunded)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Next payout</p>
          <p className="text-2xl font-display mt-1">
            {batches.find((b) => !b.paid)
              ? money(batches.filter((b) => !b.paid).reduce((n, b) => n + b.cents, 0))
              : money(0)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Payouts are batched weekly, paid Mondays</p>
        </div>
      </div>
      {batches.length ? (
        <div className="card divide-y divide-neutral-100">
          {batches.map((b) => (
            <div key={b.week} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                Week of {new Date(`${b.week}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                <span className="text-xs text-neutral-400"> · pays {b.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </span>
              <span className="flex items-center gap-3">
                <span>{money(b.cents)}</span>
                <span className={b.paid ? "text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" : "text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"}>
                  {b.paid ? "Paid out" : "Scheduled"}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400">No payouts yet. They appear here as payments come in.</p>
      )}
    </section>
  );
}

interface Dispute {
  id: string;
  paymentLabel: string;
  amountCents: number;
  reason: string;
  status: string;
  processor: string;
  createdAt: string;
}

// Night build: disputes and chargebacks workspace.
export function DisputesPanel() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [form, setForm] = useState({ paymentLabel: "", amount: "", reason: "", processor: "Stripe" });
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/studio/payments/disputes");
    const out = await res.json().catch(() => ({}));
    setDisputes(out.disputes ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setError("");
    const res = await fetch("/api/studio/payments/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentLabel: form.paymentLabel, amountCents: Math.round((parseFloat(form.amount) || 0) * 100), reason: form.reason, processor: form.processor }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setError(out.error ?? "Could not record the dispute");
    setForm({ paymentLabel: "", amount: "", reason: "", processor: "Stripe" });
    load();
    router.refresh();
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/studio/payments/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id, status }),
    });
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg">Disputes and chargebacks</h2>
      <p className="text-sm text-neutral-500 max-w-2xl">
        When a client goes to their bank instead of you, the processor opens a dispute. Record ones that arrive by letter or from your
        processor dashboard, track the evidence you send, and close them out here. Disputes on live charges are fought in the processor;
        this is your record of them.
      </p>
      {disputes.length ? (
        <div className="card divide-y divide-neutral-100">
          {disputes.map((d) => (
            <div key={d.id} className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <p className="font-medium">
                  {d.paymentLabel} · {money(d.amountCents)}
                  {d.processor ? <span className="text-neutral-400 font-normal"> · {d.processor}</span> : null}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Opened {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {d.reason ? ` · ${d.reason}` : ""}
                </p>
              </div>
              <select className="input !w-auto !py-1 text-xs" value={d.status} onChange={(e) => setStatus(d.id, e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="EVIDENCE_SENT">Evidence sent</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
                <option value="ACCEPTED">Accepted (refunded)</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400">No disputes recorded. Good news.</p>
      )}
      <div className="card p-4 grid sm:grid-cols-[1fr_120px_1fr_120px_auto] gap-2 items-end">
        <div>
          <label className="label">Payment</label>
          <input className="input" placeholder="Invoice INV-1042, full balance" value={form.paymentLabel} onChange={(e) => setForm({ ...form, paymentLabel: e.target.value })} />
        </div>
        <div>
          <label className="label">Amount ($)</label>
          <input className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Reason given by the bank</label>
          <input className="input" placeholder="Product not received" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <div>
          <label className="label">Processor</label>
          <select className="input" value={form.processor} onChange={(e) => setForm({ ...form, processor: e.target.value })}>
            <option>Stripe</option>
            <option>PayPal</option>
            <option>Other</option>
          </select>
        </div>
        <button className="btn-primary" onClick={add}>
          Record dispute
        </button>
        {error ? <p className="text-sm text-red-600 sm:col-span-5">{error}</p> : null}
      </div>
    </section>
  );
}
