"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Design = {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: string;
  link: string;
  updatedAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  CHANGES_REQUESTED: "bg-red-50 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft, with the client",
  SUBMITTED: "Submitted, needs your review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

export default function AlbumsClient({
  designs,
  products,
  orders,
}: {
  designs: Design[];
  products: { id: string; name: string }[];
  orders: { id: string; number: string; customerName: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/store/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, productId, orderId, clientName, clientEmail }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create");
    setCreating(false);
    setTitle("");
    router.refresh();
  }

  async function setStatus(d: Design, status: string) {
    const res = await fetch(`/api/store/albums/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not update");
    }
    router.refresh();
  }

  async function remove(d: Design) {
    if (!confirm(`Delete the album design "${d.title}"? The client link stops working.`)) return;
    await fetch(`/api/store/albums/${d.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">
          Send a client a link and they design their album cover and spreads. You approve the finished design
          before it goes to print.
        </p>
        <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
          + New Album Design
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-4 mb-4 grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Johnson Wedding Album" />
          </div>
          <div>
            <label className="label">Album product (optional)</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From order (optional)</label>
            <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.customerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Client name</label>
            <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Filled from the order when picked" />
          </div>
          <div>
            <label className="label">Client email</label>
            <input className="input" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="flex justify-end gap-2">
            {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn-primary">Create</button>
          </div>
          {products.length === 0 && (
            <p className="text-xs text-neutral-400 md:col-span-3">
              Tip: add an Albums &amp; Books or Packages product to a price sheet and it can be picked here.
            </p>
          )}
        </form>
      )}

      {designs.length === 0 ? (
        <p className="text-sm text-neutral-400">No album designs yet.</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {designs.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-neutral-500">
                  {d.clientName || d.clientEmail || "No client yet"} · updated {d.updatedAt}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[d.status] ?? STATUS_STYLE.DRAFT}`}>
                {STATUS_LABEL[d.status] ?? d.status}
              </span>
              <button
                className="text-xs underline text-neutral-500"
                onClick={async () => {
                  await navigator.clipboard.writeText(d.link).catch(() => undefined);
                  setCopied(d.id);
                }}
              >
                {copied === d.id ? "Copied" : "Copy client link"}
              </button>
              <a className="text-xs underline text-neutral-500" href={d.link} target="_blank" rel="noreferrer">
                Open designer ↗
              </a>
              {d.status === "SUBMITTED" && (
                <>
                  <button className="text-xs underline text-emerald-600" onClick={() => setStatus(d, "APPROVED")}>
                    Approve
                  </button>
                  <button className="text-xs underline text-amber-600" onClick={() => setStatus(d, "CHANGES_REQUESTED")}>
                    Request changes
                  </button>
                </>
              )}
              {d.status === "APPROVED" && (
                <button className="text-xs underline text-neutral-500" onClick={() => setStatus(d, "DRAFT")}>
                  Reopen
                </button>
              )}
              <button className="text-xs underline text-red-500" onClick={() => remove(d)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
