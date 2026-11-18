"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const BADGE: Record<string, string> = {
  SIGNED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  AWAITING_SECOND: "bg-amber-100 text-amber-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  EXPIRED: "bg-red-100 text-red-700",
  DRAFT: "bg-neutral-100 text-neutral-600",
};

interface ContractData {
  id: string;
  title: string;
  body: string;
  status: string;
  derived: string;
  token: string;
  contactId: string;
  contactName: string;
  templateName: string;
  bookingTitle: string;
  expiresAt: string;
  scheduledSendAt: string;
  secondSignerEmail: string;
  signerName: string;
  signedAt: string;
  signerIp: string;
  signerUserAgent: string;
  secondSignerName: string;
  secondSignedAt: string;
  secondSignerIp: string;
  secondSignerUserAgent: string;
  sentAt: string;
}

export function ContractEditor({
  contract,
  contacts,
}: {
  contract: ContractData;
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const signed = !!contract.signedAt;
  const [form, setForm] = useState({
    title: contract.title,
    body: contract.body,
    contactId: contract.contactId,
    expiresAt: contract.expiresAt,
    scheduledSendAt: contract.scheduledSendAt,
    secondSignerEmail: contract.secondSignerEmail,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function patch(data: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/studio/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? "Save failed");
      return false;
    }
    router.refresh();
    return true;
  }

  async function save() {
    setBusy(true);
    const ok = await patch({
      title: form.title,
      body: form.body,
      contactId: form.contactId || null,
      expiresAt: form.expiresAt || null,
      scheduledSendAt: form.scheduledSendAt || null,
      secondSignerEmail: form.secondSignerEmail,
    });
    setBusy(false);
    if (ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  async function send() {
    setBusy(true);
    await patch({
      title: form.title,
      body: form.body,
      contactId: form.contactId || null,
      expiresAt: form.expiresAt || null,
      secondSignerEmail: form.secondSignerEmail,
      action: "send",
    });
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this contract?")) return;
    await fetch(`/api/studio/contracts/${contract.id}`, { method: "DELETE" });
    router.push("/studio/contracts");
    router.refresh();
  }

  const signLink = `/sign/${contract.token}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/studio/contracts" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Contracts
          </Link>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[contract.derived] ?? BADGE.DRAFT}`}>
            {contract.derived.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          <button className="btn-danger" onClick={remove}>
            Delete
          </button>
          {!signed ? (
            <button className="btn-secondary" disabled={busy} onClick={save}>
              Save
            </button>
          ) : null}
          {contract.status === "DRAFT" ? (
            <button className="btn-primary" disabled={busy} onClick={send}>
              {busy ? "…" : "Send now"}
            </button>
          ) : contract.status === "SENT" && !signed ? (
            <button className="btn-secondary" disabled={busy} onClick={() => patch({ action: "revertToDraft" })}>
              Revert to draft
            </button>
          ) : null}
        </div>
      </div>

      {contract.status !== "DRAFT" ? (
        <div className="card p-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500 whitespace-nowrap">Signing link:</span>
          <input className="input font-mono text-xs" readOnly value={signLink} onFocus={(e) => e.target.select()} />
          <button
            className="btn-secondary whitespace-nowrap"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}${signLink}`)}
          >
            Copy
          </button>
          <a href={signLink} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap">
            Open ↗
          </a>
        </div>
      ) : null}

      {(contract.signedAt || contract.secondSignedAt) && (
        <div className="card p-5 border-emerald-200 bg-emerald-50/40">
          <h2 className="font-display text-lg mb-3">Signatures</h2>
          <div className="grid sm:grid-cols-2 gap-5 text-sm">
            {contract.signedAt ? (
              <div>
                <p className="font-display italic text-2xl">{contract.signerName}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Signed {fmtDateTime(contract.signedAt)}
                  <br />
                  IP {contract.signerIp}
                  <br />
                  <span className="break-all">{contract.signerUserAgent.slice(0, 90)}</span>
                </p>
              </div>
            ) : null}
            {contract.secondSignedAt ? (
              <div>
                <p className="font-display italic text-2xl">{contract.secondSignerName}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Second signer · {fmtDateTime(contract.secondSignedAt)}
                  <br />
                  IP {contract.secondSignerIp}
                  <br />
                  <span className="break-all">{contract.secondSignerUserAgent.slice(0, 90)}</span>
                </p>
              </div>
            ) : contract.secondSignerEmail ? (
              <p className="text-xs text-amber-700 self-center">Awaiting second signature from {contract.secondSignerEmail}.</p>
            ) : null}
          </div>
        </div>
      )}

      <section className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Title</label>
            <input className="input" disabled={signed} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" disabled={signed} value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Expires</label>
            <input
              type="date"
              className="input"
              disabled={signed}
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Second signer email (optional)</label>
            <input
              className="input"
              disabled={signed}
              placeholder="partner@example.com"
              value={form.secondSignerEmail}
              onChange={(e) => setForm({ ...form, secondSignerEmail: e.target.value })}
            />
          </div>
          {contract.status === "DRAFT" ? (
            <div>
              <label className="label">Scheduled send (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.scheduledSendAt}
                onChange={(e) => setForm({ ...form, scheduledSendAt: e.target.value })}
              />
              <p className="text-xs text-neutral-400 mt-1">The contract opens for signing automatically at this time.</p>
            </div>
          ) : null}
        </div>
        {contract.templateName || contract.bookingTitle ? (
          <p className="text-xs text-neutral-400">
            {contract.templateName ? `From template: ${contract.templateName}. ` : ""}
            {contract.bookingTitle ? `Linked booking: ${contract.bookingTitle}.` : ""}
          </p>
        ) : null}
      </section>

      <section className="card p-5">
        <label className="label">Contract text {signed ? "(locked, already signed)" : ""}</label>
        <textarea
          className="input min-h-[420px] font-mono text-xs leading-relaxed"
          disabled={signed}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
      </section>
    </div>
  );
}
