"use client";

// Print lab fulfillment — Coming Soon presentation (owner's call, Nov 19,
// 2026). The full lab pipeline (payload generation, Prodigi adapter, status
// timeline in src/lib/lab.ts) stays in the code, dormant: the panel shows
// existing lab orders read-only and the order path is blocked with the
// Coming Soon message, in the UI here and in /api/store/orders/[id]/lab.

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

const SOURCE: Record<string, string> = { SYSTEM: "Pixora", PHOTOGRAPHER: "You", LAB: "Lab" };

export default function LabPanel({
  labOrders,
  hasLabItems,
}: {
  orderId: string;
  labOrders: LabOrderView[];
  hasLabItems: boolean;
  connected: boolean;
  connectionNote: string;
  held?: boolean;
}) {
  if (!hasLabItems) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label">Lab fulfillment</p>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">Coming Soon</span>
      </div>
      <p className="text-sm text-neutral-500">
        Print lab fulfillment is coming soon. Orders with print products are recorded as usual, and sending
        them to a print lab switches on when labs launch. Until then, fulfill print orders yourself from the
        order details above.
      </p>

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
          </div>
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
        </div>
      ))}
    </div>
  );
}
