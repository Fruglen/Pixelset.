"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Msg {
  id: string;
  source: "studio" | "website" | "gallery";
  kind: string;
  direction: "IN" | "OUT" | "EVENT";
  name: string;
  email: string;
  subject: string;
  body: string;
  meta: string;
  read: boolean;
  createdAt: string;
  href: string;
}

const KIND_LABEL: Record<string, string> = {
  BOOKING: "Booking",
  WAITLIST: "Waitlist",
  CONTRACT: "Contract",
  PAYMENT: "Payment",
  QUOTE: "Quote",
  EMAIL: "Sent email",
  INBOUND: "Received",
  QUESTIONNAIRE: "Questionnaire",
  LEAD: "Lead form",
  GALLERY: "Gallery email",
  CAMPAIGN: "Campaign",
  WEBSITE: "Website",
  NEWSLETTER: "Newsletter",
};

const KIND_COLOR: Record<string, string> = {
  BOOKING: "bg-emerald-100 text-emerald-700",
  WAITLIST: "bg-purple-100 text-purple-700",
  CONTRACT: "bg-blue-100 text-blue-700",
  PAYMENT: "bg-amber-100 text-amber-700",
  QUOTE: "bg-sky-100 text-sky-700",
  EMAIL: "bg-neutral-100 text-neutral-500",
  INBOUND: "bg-indigo-100 text-indigo-700",
  QUESTIONNAIRE: "bg-teal-100 text-teal-700",
  LEAD: "bg-rose-100 text-rose-700",
  GALLERY: "bg-stone-200 text-stone-700",
  CAMPAIGN: "bg-neutral-100 text-neutral-600",
  WEBSITE: "bg-rose-100 text-rose-700",
  NEWSLETTER: "bg-neutral-100 text-neutral-600",
};

const FILTERS = ["ALL", "INBOUND", "EMAIL", "BOOKING", "CONTRACT", "PAYMENT", "QUOTE", "QUESTIONNAIRE", "LEAD", "GALLERY", "CAMPAIGN", "WEBSITE"];

// Night build: message bodies carry attachment lines ("Attachment: name - url")
// for files sent from or received into the inbox. Render them as download chips.
function MessageBody({ body }: { body: string }) {
  const lines = (body || "(no message body)").split("\n");
  const atts: { name: string; url: string }[] = [];
  const textLines: string[] = [];
  for (const line of lines) {
    const m = line.match(/^Attachment: (.+?) - (https?:\/\/\S+|\/\S+)$/);
    if (m) atts.push({ name: m[1], url: m[2] });
    else if (line.trim() !== "Attachments:") textLines.push(line);
  }
  return (
    <div>
      <p className="whitespace-pre-wrap">{textLines.join("\n").trim()}</p>
      {atts.length ? (
        <div className="flex flex-wrap gap-2 mt-3">
          {atts.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs bg-white border border-neutral-200 rounded-full px-3 py-1.5 underline"
            >
              {a.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InboxClient({
  messages,
  initialSearch,
  sending,
  receiving,
  inboundAddress,
  inboundToken,
}: {
  messages: Msg[];
  initialSearch: string;
  sending: boolean;
  receiving: boolean;
  inboundAddress: string;
  inboundToken: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState(initialSearch);
  const [open, setOpen] = useState("");
  const [compose, setCompose] = useState<{ to: string; name: string; subject: string; body: string } | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number }[]>([]);
  const [attBusy, setAttBusy] = useState(false);
  const [attError, setAttError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = messages.filter((m) => {
    const kindOk = filter === "ALL" ? true : filter === "WEBSITE" ? m.kind === "WEBSITE" || m.kind === "NEWSLETTER" : m.kind === filter;
    const searchOk = !q || m.email.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
    return kindOk && searchOk;
  });

  function endpoint(m: Msg) {
    return m.source === "studio" ? `/api/studio/messages/${m.id}` : `/api/website/messages/${m.id}`;
  }

  async function openMessage(m: Msg) {
    setOpen(open === m.id ? "" : m.id);
    if (!m.read && m.source !== "gallery") {
      await fetch(endpoint(m), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) });
      router.refresh();
    }
  }

  async function remove(m: Msg) {
    if (!confirm("Delete this message?")) return;
    await fetch(endpoint(m), { method: "DELETE" });
    router.refresh();
  }

  async function uploadAttachment(file: File) {
    setAttError("");
    setAttBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/studio/messages/attachments", { method: "POST", body: fd });
    const out = await res.json().catch(() => ({}));
    setAttBusy(false);
    if (!res.ok) return setAttError(out.error ?? "Could not attach that file");
    setAttachments((a) => [...a, { name: out.name, url: out.url, size: out.size }]);
  }

  async function send() {
    if (!compose) return;
    setError("");
    setBusy(true);
    const res = await fetch("/api/studio/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...compose, attachments }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Could not send");
    setCompose(null);
    setAttachments([]);
    setNotice(out.delivered ? `Sent to ${compose.to}.` : `Saved to the inbox. ${out.note}.`);
    router.refresh();
  }

  function reply(m: Msg) {
    setCompose({
      to: m.email,
      name: m.name,
      subject: m.subject.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject}`,
      body: `\n\n---\nOn ${new Date(m.createdAt).toLocaleString("en-US")}, ${m.name || m.email} wrote:\n${m.body}`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className={`rounded-md border px-3 py-2 ${sending ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
          <span className="font-medium">Sending: {sending ? "Connected (Resend)" : "Not connected"}</span>
          {sending ? null : <span className="block mt-0.5">Messages you write are saved here but not emailed until an email service is connected in Settings.</span>}
        </div>
        <div className={`rounded-md border px-3 py-2 ${receiving ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
          <span className="font-medium">Receiving: {receiving ? "Connected" : "Not connected"}</span>
          <span className="block mt-0.5">
            {receiving
              ? inboundAddress
                ? `Client emails to ${inboundAddress} (or your business email) arrive here.`
                : `Inbound webhook active. Route token: ${inboundToken}.`
              : "Set INBOUND_EMAIL_SECRET and point your provider's inbound webhook at /api/studio/inbound to receive replies here."}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                filter === f ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f === "ALL" ? "All" : KIND_LABEL[f] ?? f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input className="input !w-56 !py-1.5 text-sm" placeholder="Search name, email, subject" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-primary" onClick={() => setCompose({ to: "", name: "", subject: "", body: "" })}>
            New message
          </button>
        </div>
      </div>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      {compose ? (
        <div className="card p-4 space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">To</label>
              <input className="input" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
            </div>
            <div>
              <label className="label">Subject</label>
              <input className="input" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
            </div>
          </div>
          <textarea className="input min-h-[160px]" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="btn-secondary !py-1.5 text-xs cursor-pointer">
                {attBusy ? "Attaching…" : "Attach a PDF or mood board"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAttachment(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-neutral-400">Up to 15 MB each. Clients get a link in the email.</span>
            </div>
            {attError ? <p className="text-xs text-red-600">{attError}</p> : null}
            {attachments.length ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span key={a.url} className="inline-flex items-center gap-2 text-xs bg-neutral-100 rounded-full px-3 py-1">
                    {a.name} · {(a.size / 1024).toFixed(0)} KB
                    <button className="text-neutral-500" onClick={() => setAttachments(attachments.filter((x) => x.url !== a.url))}>
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setCompose(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} onClick={send}>
              {busy ? "Sending…" : sending ? "Send" : "Save (email not connected)"}
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 py-10 text-center">
          Nothing here yet, bookings, payments, signed contracts, gallery emails and website messages all land in this inbox.
        </p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {filtered.map((m) => (
            <div key={`${m.source}-${m.id}`}>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50" onClick={() => openMessage(m)}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.read ? "bg-transparent" : "bg-blue-600"}`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${KIND_COLOR[m.kind] ?? "bg-neutral-100"}`}>
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${m.read ? "" : "font-semibold"}`}>
                    {m.direction === "OUT" ? "↗ " : m.direction === "IN" ? "↙ " : ""}
                    {m.subject}
                  </span>
                  <span className="block text-xs text-neutral-500 truncate">
                    {m.name || m.email || "-"}
                    {m.name && m.email ? ` · ${m.email}` : ""}
                  </span>
                </span>
                <span className="text-xs text-neutral-400 whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </button>
              {open === m.id ? (
                <div className="px-4 pb-4 pl-11">
                  <div className="bg-neutral-50 rounded-md p-4 text-sm">
                    <MessageBody body={m.body} />
                    {m.meta ? <p className="text-xs text-neutral-500 mt-2">{m.meta}</p> : null}
                    <div className="flex gap-3 mt-3 text-xs">
                      {m.email ? (
                        <button className="underline text-neutral-700" onClick={() => reply(m)}>
                          Reply
                        </button>
                      ) : null}
                      {m.email ? (
                        <button className="underline text-neutral-600" onClick={() => setSearch(m.email)}>
                          Full history with {m.name || m.email}
                        </button>
                      ) : null}
                      {m.href ? (
                        <Link className="underline text-neutral-600" href={m.href}>
                          Open gallery
                        </Link>
                      ) : null}
                      {m.source !== "gallery" ? (
                        <button className="underline text-red-600" onClick={() => remove(m)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
