"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LAB_STATUSES = ["QUEUED", "SENT", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "REPRINT_REQUESTED"];
const LABELS: Record<string, string> = {
  QUEUED: "Queued",
  SENT: "Sent to lab",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REPRINT_REQUESTED: "Reprint requested",
};

export interface LabOrderView {
  id: string;
  status: string;
  lab: string;
  payload: string;
  isReprint: boolean;
  sentAt: string;
  response: string;
  createdAt: string;
  trackingNumber: string;
  carrier: string;
  labReference: string;
  events: { id: string; status: string; note: string; source: string; at: string }[];
}

const SOURCE: Record<string, string> = { SYSTEM: "Pixelset", PHOTOGRAPHER: "You", LAB: "Lab" };

export default function LabPanel({
  orderId,
  labOrders,
  hasLabItems,
  connected,
  connectionNote,
  held = false,
}: {
  orderId: string;
  labOrders: LabOrderView[];
  hasLabItems: boolean;
  connected: boolean;
  connectionNote: string;
  held?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edits, setEdits] = useState<Record<string, { status: string; trackingNumber: string; carrier: string; note: string }>>({});
  const editOf = (lo: LabOrderView) =>
    edits[lo.id] ?? { status: lo.status, trackingNumber: lo.trackingNumber, carrier: lo.carrier, note: "" };

  if (!hasLabItems) return null;

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/store/orders/${orderId}/lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "The action failed");
      else if (data.detail) setNotice(data.detail);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label">Lab fulfillment</p>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {connected ? "Lab connected" : "No lab connected"}
        </span>
      </div>
      {!connected && <p className="text-xs text-amber-700">{connectionNote}</p>}

      {labOrders.length === 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            No lab order payload exists yet for this order (placed before lab orders were introduced).
          </p>
          <button
            className="btn-secondary whitespace-nowrap"
            disabled={busy !== ""}
            onClick={() => act({ action: "create" }, "create")}
          >
            {busy === "create" ? "Generating…" : "Generate lab order"}
          </button>
        </div>
      )}

      {labOrders.map((lo) => (
        <div key={lo.id} className="border border-neutral-100 rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{lo.lab}</span>
            {lo.isReprint && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Reprint</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {LABELS[lo.status] ?? lo.status}
            </span>
            {lo.sentAt && <span className="text-xs text-neutral-400">sent {lo.sentAt}</span>}
            {lo.labReference && <span className="text-xs text-neutral-400">lab ref {lo.labReference}</span>}
            <span className="flex-1" />
            {(lo.status === "QUEUED" || lo.status === "REPRINT_REQUESTED") && !held ? (
              <button
                className="btn-secondary !py-1 text-xs"
                disabled={busy !== ""}
                onClick={() => act({ action: "send", labOrderId: lo.id }, `send-${lo.id}`)}
              >
                {busy === `send-${lo.id}` ? "Sending…" : "Send to lab now"}
              </button>
            ) : null}
          </div>
          {held && lo.status === "QUEUED" && (
            <p className="text-xs text-amber-700">Held until the offline payment is marked received.</p>
          )}
          {lo.trackingNumber && (
            <p className="text-xs text-neutral-600">
              Tracking: {lo.carrier ? `${lo.carrier} ` : ""}
              <span className="font-mono">{lo.trackingNumber}</span>
            </p>
          )}

          <ol className="border-l border-neutral-200 ml-1.5 space-y-2 py-1">
            {lo.events.map((e) => (
              <li key={e.id} className="pl-3 relative text-xs">
                <span className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full bg-neutral-400" />
                <span className="font-medium">{LABELS[e.status] ?? e.status}</span>
                <span className="text-neutral-400"> · {e.at} · {SOURCE[e.source] ?? e.source}</span>
                {e.note && <p className="text-neutral-500">{e.note}</p>}
              </li>
            ))}
            {lo.events.length === 0 && <li className="pl-3 text-xs text-neutral-400">No timeline events recorded yet.</li>}
          </ol>

          <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-2">
            <div>
              <label className="label !text-[10px]">Status</label>
              <select
                className="input !w-40 !py-1 text-xs"
                value={editOf(lo).status}
                onChange={(e) => setEdits({ ...edits, [lo.id]: { ...editOf(lo), status: e.target.value } })}
              >
                {LAB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            {editOf(lo).status === "SHIPPED" && (
              <>
                <div>
                  <label className="label !text-[10px]">Carrier</label>
                  <input className="input !w-28 !py-1 text-xs" value={editOf(lo).carrier} onChange={(e) => setEdits({ ...edits, [lo.id]: { ...editOf(lo), carrier: e.target.value } })} placeholder="UPS" />
                </div>
                <div>
                  <label className="label !text-[10px]">Tracking number</label>
                  <input className="input !w-40 !py-1 text-xs" value={editOf(lo).trackingNumber} onChange={(e) => setEdits({ ...edits, [lo.id]: { ...editOf(lo), trackingNumber: e.target.value } })} />
                </div>
              </>
            )}
            <div className="flex-1 min-w-32">
              <label className="label !text-[10px]">Note</label>
              <input className="input !py-1 text-xs" value={editOf(lo).note} onChange={(e) => setEdits({ ...edits, [lo.id]: { ...editOf(lo), note: e.target.value } })} placeholder="Optional" />
            </div>
            <button
              className="btn-secondary !py-1 text-xs"
              disabled={busy !== ""}
              onClick={async () => {
                await act({ action: "setStatus", labOrderId: lo.id, ...editOf(lo) }, `st-${lo.id}`);
                setEdits((x) => {
                  const n = { ...x };
                  delete n[lo.id];
                  return n;
                });
              }}
            >
              {busy === `st-${lo.id}` ? "Saving…" : "Update status"}
            </button>
          </div>
          {(lo.status === "QUEUED" || lo.status === "REPRINT_REQUESTED") && !connected && (
            <p className="text-xs text-amber-700">Ready to send, no lab connected.</p>
          )}
          {lo.response && <p className="text-xs text-neutral-500">Last response: {lo.response}</p>}
          <details>
            <summary className="text-xs text-neutral-400 cursor-pointer">Lab order payload</summary>
            <pre className="text-xs bg-neutral-50 rounded p-3 overflow-x-auto mt-2">{lo.payload}</pre>
          </details>
        </div>
      ))}

      {labOrders.length > 0 && (
        <button
          className="btn-secondary text-xs"
          disabled={busy !== ""}
          onClick={() => act({ action: "reprint" }, "reprint")}
        >
          {busy === "reprint" ? "Creating…" : "Request reprint"}
        </button>
      )}

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
