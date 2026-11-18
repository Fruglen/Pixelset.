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
}

export default function LabPanel({
  orderId,
  labOrders,
  hasLabItems,
  connected,
  connectionNote,
}: {
  orderId: string;
  labOrders: LabOrderView[];
  hasLabItems: boolean;
  connected: boolean;
  connectionNote: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
            <span className="flex-1" />
            <select
              className="input !w-44 !py-1 text-xs"
              value={lo.status}
              onChange={(e) => act({ action: "setStatus", labOrderId: lo.id, status: e.target.value }, `st-${lo.id}`)}
            >
              {LAB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LABELS[s]}
                </option>
              ))}
            </select>
            {lo.status === "QUEUED" || lo.status === "REPRINT_REQUESTED" ? (
              <button
                className="btn-secondary !py-1 text-xs"
                disabled={busy !== ""}
                onClick={() => act({ action: "send", labOrderId: lo.id }, `send-${lo.id}`)}
              >
                {busy === `send-${lo.id}` ? "Sending…" : "Send to lab now"}
              </button>
            ) : null}
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
