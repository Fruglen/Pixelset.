"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DisputesPanel, PayoutsPanel } from "./money-panels";

interface Row {
  id: string;
  date: string;
  source: string;
  label: string;
  payer: string;
  method: string;
  amountCents: number;
  tipCents: number;
  feeCents: number;
  kind: "invoice" | "ledger";
}

interface Link {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  token: string;
  active: boolean;
  payments: number;
  collectedCents: number;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentsClient({ rows, outstandingCents, links, from, to }: { rows: Row[]; outstandingCents: number; links: Link[]; from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [source, setSource] = useState("ALL");
  const [nl, setNl] = useState({ title: "", description: "", amount: "" });
  const [error, setError] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const d = r.date.slice(0, 10);
        return (!f || d >= f) && (!t || d <= t) && (source === "ALL" || r.source === source);
      }),
    [rows, f, t, source]
  );

  const sum = filtered.reduce((n, r) => n + r.amountCents + r.tipCents, 0);
  const tips = filtered.reduce((n, r) => n + r.tipCents, 0);
  const bySource = ["Invoice", "Booking retainer", "Payment link"].map((s) => ({
    s,
    cents: filtered.filter((r) => r.source === s).reduce((n, r) => n + r.amountCents + r.tipCents, 0),
  }));
  const byMethod = Array.from(new Set(filtered.map((r) => r.method))).map((m) => ({
    m,
    cents: filtered.filter((r) => r.method === m).reduce((n, r) => n + r.amountCents + r.tipCents, 0),
  }));
  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + r.amountCents + r.tipCents);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);
  const maxMonth = Math.max(1, ...byMonth.map(([, v]) => v));

  function exportCsv() {
    const head = ["Date", "Source", "Description", "Payer", "Method", "Amount", "Tip"];
    const lines = filtered.map((r) =>
      [r.date.slice(0, 10), r.source, r.label, r.payer, r.method, (r.amountCents / 100).toFixed(2), (r.tipCents / 100).toFixed(2)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payments${f ? `-from-${f}` : ""}${t ? `-to-${t}` : ""}.csv`;
    a.click();
  }

  async function createLink() {
    setError("");
    const res = await fetch("/api/studio/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nl.title, description: nl.description, amountCents: Math.round((parseFloat(nl.amount) || 0) * 100) }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setError(out.error ?? "Could not create");
    setNl({ title: "", description: "", amount: "" });
    router.refresh();
  }

  async function patchLink(id: string, data: Record<string, unknown>) {
    await fetch(`/api/studio/payment-links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    router.refresh();
  }

  async function deleteLink(id: string) {
    if (!confirm("Delete this payment link? Past payments stay in the report.")) return;
    await fetch(`/api/studio/payment-links/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2">
        Payments are mocked per the owner&apos;s payments exclusion: pay pages record payments as received, no card is charged and no
        processor fees apply.
      </p>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="font-display text-lg">Payments and income</h2>
          <div className="flex items-end gap-2 flex-wrap text-sm">
            <div>
              <label className="label">From</label>
              <input type="date" className="input !py-1.5" value={f} onChange={(e) => setF(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input !py-1.5" value={t} onChange={(e) => setT(e.target.value)} />
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input !py-1.5" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="ALL">All sources</option>
                <option>Invoice</option>
                <option>Booking retainer</option>
                <option>Payment link</option>
              </select>
            </div>
            <button className="btn-secondary" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs text-neutral-500">Income</p>
            <p className="text-2xl font-display mt-1">{money(sum)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-neutral-500">Payments</p>
            <p className="text-2xl font-display mt-1">{filtered.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-neutral-500">Tips</p>
            <p className="text-2xl font-display mt-1">{money(tips)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-neutral-500">Outstanding on invoices</p>
            <p className="text-2xl font-display mt-1">{money(outstandingCents)}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="card p-4 md:col-span-2">
            <p className="text-sm font-medium mb-3">Income by month</p>
            {byMonth.length === 0 ? <p className="text-sm text-neutral-400">No payments in this range.</p> : null}
            <div className="space-y-1.5">
              {byMonth.map(([m, v]) => (
                <div key={m} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-neutral-500">{m}</span>
                  <div className="flex-1 bg-neutral-100 rounded h-4">
                    <div className="bg-neutral-800 h-4 rounded" style={{ width: `${(v / maxMonth) * 100}%` }} />
                  </div>
                  <span className="w-24 text-right">{money(v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4 space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">By source</p>
              {bySource.map((x) => (
                <div key={x.s} className="flex justify-between text-neutral-600">
                  <span>{x.s}</span>
                  <span>{money(x.cents)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium mb-1">By method</p>
              {byMethod.map((x) => (
                <div key={x.m} className="flex justify-between text-neutral-600">
                  <span className="capitalize">{x.m}</span>
                  <span>{money(x.cents)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-200">
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium">Payer</th>
                <th className="text-left px-4 py-2 font-medium">Method</th>
                <th className="text-right px-4 py-2 font-medium">Fee</th>
                <th className="text-right px-4 py-2 font-medium">Net</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-neutral-100">
                  <td className="px-4 py-2">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-2">{r.source}</td>
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2">{r.payer || "-"}</td>
                  <td className="px-4 py-2 capitalize">{r.method}</td>
                  <td className="px-4 py-2 text-right text-neutral-500">{r.amountCents > 0 ? money(r.feeCents) : "-"}</td>
                  <td className="px-4 py-2 text-right text-neutral-600">{r.amountCents > 0 ? money(r.amountCents + r.tipCents - r.feeCents) : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    {money(r.amountCents)}
                    {r.tipCents ? <span className="text-xs text-neutral-500"> + {money(r.tipCents)} tip</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.amountCents > 0 ? (
                      <button
                        className="text-xs underline text-neutral-500"
                        onClick={async () => {
                          const reason = prompt(`Refund ${money(r.amountCents)} for "${r.label}"? Optional reason:`);
                          if (reason === null) return;
                          const res = await fetch("/api/studio/payments/refund", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ kind: r.kind, id: r.id, reason }),
                          });
                          const out = await res.json().catch(() => ({}));
                          if (!res.ok) return alert(out.error ?? "Refund failed");
                          router.refresh();
                        }}
                      >
                        Refund
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-400">
          Fees are the processor's published rate for the method, estimated per payment. A connected processor reports the exact fee on
          each charge.
        </p>
      </section>

      <PayoutsPanel rows={rows} />
      <DisputesPanel />

      <section className="space-y-4">
        <h2 className="font-display text-lg">Payment links</h2>
        <p className="text-sm text-neutral-500">Reusable branded payment pages for services, prints, or post session tips. Leave the amount empty to let the client enter it.</p>
        <div className="card p-4 grid sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="Session tip" value={nl.title} onChange={(e) => setNl({ ...nl, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={nl.description} onChange={(e) => setNl({ ...nl, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Amount ($)</label>
            <input className="input" placeholder="Open" value={nl.amount} onChange={(e) => setNl({ ...nl, amount: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={!nl.title.trim()} onClick={createLink}>
            Create link
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="card divide-y divide-neutral-100">
          {links.length === 0 ? <p className="text-sm text-neutral-500 p-4">No payment links yet.</p> : null}
          {links.map((l) => (
            <div key={l.id} className={`p-4 flex items-center justify-between gap-3 flex-wrap ${l.active ? "" : "opacity-60"}`}>
              <div>
                <p className="text-sm font-medium">
                  {l.title} <span className="text-neutral-500 font-normal">· {l.amountCents ? money(l.amountCents) : "Client enters amount"}</span>
                </p>
                <p className="text-xs text-neutral-500">
                  {l.payments} payment{l.payments === 1 ? "" : "s"} · {money(l.collectedCents)} collected
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button className="underline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/link/${l.token}`)}>
                  Copy link
                </button>
                <a className="underline" href={`/pay/link/${l.token}`} target="_blank" rel="noreferrer">
                  Open ↗
                </a>
                <button className="underline" onClick={() => patchLink(l.id, { active: !l.active })}>
                  {l.active ? "Deactivate" : "Activate"}
                </button>
                <button className="underline text-red-600" onClick={() => deleteLink(l.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
