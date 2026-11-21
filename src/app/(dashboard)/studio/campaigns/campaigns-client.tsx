"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Send = { id: string; email: string; status: string; detail: string; createdAt: string };
type Campaign = {
  id: string;
  name: string;
  kind: string;
  subject: string;
  body: string;
  audience: string;
  status: string;
  sentAt: string | null;
  sends: Send[];
};

const KINDS = [
  { id: "PRINT_SALE", label: "Print sale", subject: "Print sale this week at {business}", body: "Hi {name},\n\nFor the next seven days every print and wall art order from your gallery is 20% off. Open your gallery, pick your favourites and choose Buy.\n\nWarmly,\n{business}" },
  { id: "MINI_SESSION", label: "Mini session announcement", subject: "Mini sessions are open", body: "Hi {name},\n\nI am running a day of 20 minute mini sessions and would love to see you. Spots are limited, reply to this email or book from my website to hold yours.\n\n{business}" },
  { id: "REVIEW_REQUEST", label: "Review request", subject: "Would you share a few words?", body: "Hi {name},\n\nIt was a joy to photograph you. If you have a minute, a short review helps other families find me. Thank you so much.\n\n{business}" },
  { id: "CUSTOM", label: "Custom", subject: "", body: "" },
];

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: "bg-emerald-50 text-emerald-700",
  LOGGED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
};

export default function CampaignsClient({
  campaigns,
  allowance,
  sources,
  connected,
}: {
  campaigns: Campaign[];
  allowance: { limit: number; used: number; remaining: number };
  sources: { optIns: number; contacts: number; collections: { id: string; name: string; registrations: number }[] };
  connected: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);

  function blank(): Campaign {
    const k = KINDS[0];
    return { id: "", name: "", kind: k.id, subject: k.subject, body: k.body, audience: "OPT_INS", status: "DRAFT", sentAt: null, sends: [] };
  }

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    fetch(`/api/campaigns/audience?source=${encodeURIComponent(editing.audience)}`)
      .then((r) => r.json())
      .then((d) => alive && setPreview(typeof d.count === "number" ? { count: d.count, sample: d.sample ?? [] } : null))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [editing?.audience]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(): Promise<string | null> {
    if (!editing) return null;
    setErr("");
    const payload = { name: editing.name, kind: editing.kind, subject: editing.subject, body: editing.body, audience: editing.audience };
    const res = await fetch(editing.id ? `/api/campaigns/${editing.id}` : "/api/campaigns", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || "Could not save the campaign");
      return null;
    }
    setEditing({ ...editing, id: d.campaign.id });
    return d.campaign.id as string;
  }

  async function saveDraft() {
    setBusy(true);
    const id = await save();
    setBusy(false);
    if (id) {
      setMsg("Draft saved.");
      setEditing(null);
      router.refresh();
    }
  }

  async function send() {
    if (!editing) return;
    if (!confirm(`Send "${editing.subject || editing.name}" to ${preview?.count ?? 0} recipients now?`)) return;
    setBusy(true);
    const id = await save();
    if (!id) {
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(d.error || "The campaign could not be sent");
      router.refresh();
      return;
    }
    setMsg(
      d.mode === "resend"
        ? `Sent to ${d.total}: ${d.delivered} delivered through Resend${d.failed ? `, ${d.failed} failed` : ""}.`
        : `Recorded for ${d.total} recipients. No email service is connected, so these were logged only and nobody received an email.`
    );
    setEditing(null);
    router.refresh();
  }

  async function remove(c: Campaign) {
    if (!confirm(`Delete ${c.name}${c.status === "SENT" ? " and its send log" : ""}?`)) return;
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Could not delete");
      return;
    }
    router.refresh();
  }

  function sourceName(a: string) {
    if (a === "OPT_INS") return "Gallery marketing opt ins";
    if (a === "CONTACTS") return "Studio contacts";
    const id = a.replace(/^COLLECTION:/, "");
    const c = sources.collections.find((x) => x.id === id);
    return c ? `Registrations on ${c.name}` : "Registrations on a deleted collection";
  }

  const pct = allowance.limit > 0 ? Math.min(100, Math.round((allowance.used / allowance.limit) * 100)) : 100;

  return (
    <div className="space-y-6">
      <div className="card p-5 flex flex-wrap items-center gap-5" data-testid="campaign-allowance">
        <div className="flex-1 min-w-[14rem]">
          <p className="label">Campaign sends this month</p>
          <p className="text-sm">
            <span className="font-semibold">{allowance.used.toLocaleString("en-US")}</span> of{" "}
            {allowance.limit.toLocaleString("en-US")} used, {allowance.remaining.toLocaleString("en-US")} left
          </p>
          <div className="h-2 rounded-full bg-neutral-100 mt-2 overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
          {allowance.limit === 0 ? (
            <p className="text-xs text-neutral-500 mt-2">Your gallery plan does not include campaign sends. Upgrade or add a campaign block in Settings, Plan.</p>
          ) : null}
        </div>
        <div className="text-xs text-neutral-500 max-w-xs">
          Email: {connected ? "Connected (Resend), campaigns are delivered." : "Not connected. Sends are recorded in the log as logged only, no email leaves the app."}
        </div>
        <button className="btn-primary" onClick={() => { setMsg(""); setErr(""); setEditing(blank()); }} data-testid="new-campaign">
          New campaign
        </button>
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err && !editing ? <p className="text-sm text-red-600">{err}</p> : null}

      {editing ? (
        <div className="card p-5 space-y-4" data-testid="campaign-builder">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Campaign name</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Spring print sale" />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={editing.kind}
                onChange={(e) => {
                  const k = KINDS.find((x) => x.id === e.target.value)!;
                  const untouched = !editing.subject && !editing.body;
                  const isTemplate = KINDS.some((x) => x.subject === editing.subject && x.body === editing.body);
                  setEditing({ ...editing, kind: k.id, ...(untouched || isTemplate ? { subject: k.subject, body: k.body } : {}) });
                }}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Recipients</label>
            <select className="input" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} data-testid="campaign-source">
              <option value="OPT_INS">Gallery marketing opt ins ({sources.optIns})</option>
              <option value="CONTACTS">Studio contacts ({sources.contacts})</option>
              {sources.collections.map((c) => (
                <option key={c.id} value={`COLLECTION:${c.id}`}>
                  Registrations on {c.name} ({c.registrations})
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              {preview
                ? `${preview.count} unique valid address${preview.count === 1 ? "" : "es"}${preview.sample.length ? `, for example ${preview.sample.slice(0, 3).join(", ")}` : ""}.`
                : "Counting recipients..."}
              {preview && preview.count > allowance.remaining ? (
                <span className="text-red-600"> This is more than the {allowance.remaining} sends left this month, so sending will be refused.</span>
              ) : null}
            </p>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input min-h-[12rem]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            <p className="text-xs text-neutral-500 mt-1">
              {"{name}"} becomes the recipient&apos;s first name when known, {"{business}"} your business name. A line telling the
              client who sent it and how to opt out is added at the bottom.
            </p>
          </div>
          {err ? <p className="text-sm text-red-600" data-testid="campaign-error">{err}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setEditing(null); setErr(""); }} disabled={busy}>
              Cancel
            </button>
            <button className="btn-secondary" onClick={saveDraft} disabled={busy || !editing.name.trim()}>
              Save draft
            </button>
            <button className="btn-primary" onClick={send} disabled={busy || !editing.name.trim() || !editing.subject.trim() || !editing.body.trim() || !preview?.count}>
              {busy ? "Working..." : "Send campaign"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card divide-y divide-neutral-100">
        {campaigns.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No campaigns yet. Start one with New campaign.</p>
        ) : (
          campaigns.map((c) => {
            const counts = { DELIVERED: 0, LOGGED: 0, FAILED: 0 } as Record<string, number>;
            c.sends.forEach((s) => (counts[s.status] = (counts[s.status] ?? 0) + 1));
            return (
              <div key={c.id} className="p-4" data-testid="campaign-row">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[12rem]">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-neutral-500">
                      {KINDS.find((k) => k.id === c.kind)?.label ?? c.kind} · {sourceName(c.audience)}
                      {c.sentAt ? ` · sent ${new Date(c.sentAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "SENT" ? "bg-brand-50 text-brand-800" : "bg-neutral-100 text-neutral-600"}`}>
                    {c.status === "SENT" ? "Sent" : "Draft"}
                  </span>
                  {c.status === "SENT" ? (
                    <button className="text-sm underline text-neutral-600" onClick={() => setOpenLog(openLog === c.id ? null : c.id)}>
                      Send log ({c.sends.length})
                    </button>
                  ) : (
                    <button className="text-sm underline text-neutral-600" onClick={() => { setMsg(""); setErr(""); setEditing(c); }}>
                      Edit
                    </button>
                  )}
                  <button
                    className="text-sm underline text-neutral-600"
                    onClick={() => { setMsg(""); setErr(""); setEditing({ ...c, id: "", name: `${c.name} (copy)`, status: "DRAFT", sentAt: null, sends: [] }); }}
                  >
                    Duplicate
                  </button>
                  <button className="text-sm underline text-red-600" onClick={() => remove(c)}>
                    Delete
                  </button>
                </div>
                {c.status === "SENT" ? (
                  <p className="text-xs text-neutral-500 mt-1">
                    {counts.DELIVERED} delivered, {counts.LOGGED} logged only, {counts.FAILED} failed
                  </p>
                ) : null}
                {openLog === c.id ? (
                  <table className="w-full text-sm mt-3" data-testid="campaign-send-log">
                    <thead>
                      <tr className="text-left text-xs text-neutral-500">
                        <th className="py-1 font-medium">Recipient</th>
                        <th className="py-1 font-medium">Status</th>
                        <th className="py-1 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.sends.map((s) => (
                        <tr key={s.id} className="border-t border-neutral-100">
                          <td className="py-1.5 pr-3">{s.email}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] ?? ""}`}>{s.status === "LOGGED" ? "Logged only" : s.status === "DELIVERED" ? "Delivered" : "Failed"}</span>
                          </td>
                          <td className="py-1.5 text-xs text-neutral-500">{s.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
