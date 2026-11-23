"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Photo Editor): the editor as a paid add on (about $12 a
// month in the research). Shown on the Free gallery plan.
// Night build (Pricing lane): the button activates the add-on in the
// billing system (src/lib/billing.ts). Billing is parked, so activation
// is simulated and nothing is charged; with Stripe connected the add-on
// would be charged through the same subscription.
export default function EditorAddonWall({ planLabel }: { planLabel: string }) {
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addon", key: "editor", value: true }),
    });
    setBusy(false);
    if (res.ok) {
      setTried(true);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not add the Photo Editor.");
    }
  }
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-display mb-2">Photo Editor</h1>
      <p className="text-sm text-neutral-500 mb-6">
        The Photo Editor is an add on to your {planLabel} plan. It is included with every paid Client Gallery
        plan, or on its own for $12 a month.
      </p>
      <div className="card p-6 space-y-4">
        <p className="font-medium">What the add on unlocks</p>
        <ul className="text-sm text-neutral-600 space-y-1.5 list-disc pl-5">
          <li>Canvas editing with presets, adjustments, crop, rotate and straighten</li>
          <li>Pro Editor powered by Photopea: layers, masks and full retouching</li>
          <li>AI tools (background removal, object removal, upscaling, face restore) when an AI endpoint is connected</li>
          <li>AI culling and AI editing suggestions</li>
          <li>RAW editing through full size previews</li>
          <li>Edited copies saved straight back into any client gallery</li>
        </ul>
        {tried ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            Add-on activated in simulated mode: billing is parked, so nothing was charged. The editor is open.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary" disabled={busy} onClick={activate}>
          Add the Photo Editor, $12/month
        </button>
        <p className="text-xs text-neutral-400">
          Manage or remove the add-on any time in Settings, Plan. While billing is parked the activation is
          simulated and no payment is taken.
        </p>
      </div>
    </div>
  );
}
