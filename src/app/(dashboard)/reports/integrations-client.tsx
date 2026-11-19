"use client";

import { useState } from "react";

type Provider = { connected: boolean; ok: number; failed: number; last: string | null };

// Phase 5B: full account export plus accounting and CRM exports and live sync.
export default function ExportIntegrations({ status }: { status: { quickbooks: Provider; hubspot: Provider } }) {
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState("");

  async function sync(provider: "quickbooks" | "hubspot") {
    setBusy(provider);
    const res = await fetch("/api/integrations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    setMsg({ ...msg, [provider]: { ok: res.ok && !json.failed, text: json.message || json.error || "Sync failed" } });
  }

  const files = [
    { kind: "qb-invoices-iif", label: "QuickBooks Desktop invoices and customers (.iif)" },
    { kind: "qb-payments-iif", label: "QuickBooks Desktop payments (.iif)" },
    { kind: "qbo-invoices-csv", label: "QuickBooks Online invoice import (.csv)" },
    { kind: "payments-csv", label: "Payments ledger for any accounting tool (.csv)" },
    { kind: "crm-contacts-csv", label: "CRM contacts, HubSpot import columns (.csv)" },
  ];

  const providers = [
    { id: "quickbooks" as const, name: "QuickBooks Online", what: "invoices and customers", env: "QUICKBOOKS_ACCESS_TOKEN and QUICKBOOKS_REALM_ID", s: status.quickbooks },
    { id: "hubspot" as const, name: "HubSpot CRM", what: "contacts (upsert by email)", env: "HUBSPOT_TOKEN", s: status.hubspot },
  ];

  return (
    <>
      <div className="card p-5">
        <h2 className="font-medium mb-1">Full account export</h2>
        <p className="text-xs text-neutral-400 mb-3">
          One ZIP with every record in your account (galleries, photos metadata, website, studio, store, automations and
          more) as CSV and JSON, plus a manifest of every original file. Passwords and access tokens are never included.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="/api/export/account">
            Download data ZIP
          </a>
          <a className="btn-secondary" href="/api/export/account?files=1">
            Download data and original files ZIP
          </a>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">
          The files ZIP streams every original stored in Pixelset by gallery and set. Photos linked from another service
          are listed in the manifest with their URL.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-medium mb-1">Accounting and CRM</h2>
        <p className="text-xs text-neutral-400 mb-3">
          Export files your bookkeeper can import, or sync directly when a connection is configured. Payment amounts are
          the payments recorded in Pixelset, which are mocked per the owner&rsquo;s payments exclusion.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {files.map((f) => (
            <a
              key={f.kind}
              href={`/api/export/accounting?kind=${f.kind}`}
              className="flex items-center justify-between border border-neutral-200 rounded-md px-3 py-2 text-sm hover:border-neutral-400"
            >
              <span>{f.label}</span>
              <span className="text-xs underline text-neutral-600">Download</span>
            </a>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {providers.map((p) => (
            <div key={p.id} className="border border-neutral-200 rounded-md p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span className={`text-xs ${p.s.connected ? "text-emerald-600" : "text-neutral-400"}`}>
                  {p.s.connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Syncs {p.what}.{" "}
                {p.s.connected
                  ? `${p.s.ok} record(s) synced${p.s.failed ? `, ${p.s.failed} failed` : ""}${p.s.last ? `, last ${new Date(p.s.last).toLocaleString()}` : ""}.`
                  : `To connect, set ${p.env} in the server environment.`}
              </p>
              <button className="btn-secondary mt-2" disabled={!p.s.connected || busy === p.id} onClick={() => sync(p.id)}>
                {busy === p.id ? "Syncing…" : "Sync now"}
              </button>
              {msg[p.id] && <p className={`text-xs mt-1 ${msg[p.id].ok ? "text-emerald-600" : "text-red-600"}`}>{msg[p.id].text}</p>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
