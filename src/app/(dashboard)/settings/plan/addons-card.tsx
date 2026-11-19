"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Pricing lane): plan add-ons from the research. The Photo
// Editor add-on unlocks the editor on a Free Client Gallery plan (paid plans
// include it); extra video hours and extra campaign blocks raise the tier
// allowances in src/lib/plans.ts. Billing is parked: activations are recorded
// as simulated add-on subscriptions and nothing is charged.

interface AddOns {
  editor: boolean;
  extraVideoHours: number;
  extraCampaignBlocks: number;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function AddOnsCard({
  initial,
  prices,
  galleryTier,
}: {
  initial: AddOns;
  prices: { editor: number; videoHour: number; campaignBlock: number };
  galleryTier: string;
}) {
  const router = useRouter();
  const [videoHours, setVideoHours] = useState(initial.extraVideoHours);
  const [campaignBlocks, setCampaignBlocks] = useState(initial.extraCampaignBlocks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const total =
    (initial.editor ? prices.editor : 0) + videoHours * prices.videoHour + campaignBlocks * prices.campaignBlock;

  async function save(key: string, value: boolean | number) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/account/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addon", key, value }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Add-ons updated in simulated mode. Nothing was charged.");
      router.refresh();
    } else {
      setMsg("Could not update the add-on.");
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-medium">Add-ons</h2>
      <p className="text-sm text-neutral-500 mt-1">
        Add-ons ride on top of any plan and renew with it. Billing is parked, so these are simulated and nothing is
        charged.
      </p>

      <div className="divide-y divide-neutral-100 mt-3 text-sm">
        <div className="py-3 flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="font-medium">Photo Editor: {money(prices.editor)} a month</p>
            <p className="text-neutral-500">
              {galleryTier === "free"
                ? "Unlocks the editor (AI culling, edit suggestions, your learned style) on your Free Client Gallery plan."
                : "Your Client Gallery plan already includes the editor, so this add-on is only needed on the Free plan."}
            </p>
          </div>
          <button
            className={initial.editor ? "btn-secondary" : "btn-primary"}
            disabled={busy}
            onClick={() => save("editor", !initial.editor)}
          >
            {initial.editor ? "Remove add-on" : "Add to plan"}
          </button>
        </div>

        <div className="py-3 flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="font-medium">Extra video: {money(prices.videoHour)} a month per hour</p>
            <p className="text-neutral-500">Adds hours of video storage on top of your Client Gallery tier.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input w-20"
              type="number"
              min={0}
              max={100}
              value={videoHours}
              onChange={(e) => setVideoHours(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
            <span className="text-neutral-500">hours</span>
            <button className="btn-secondary" disabled={busy || videoHours === initial.extraVideoHours} onClick={() => save("extraVideoHours", videoHours)}>
              Save
            </button>
          </div>
        </div>

        <div className="py-3 flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="font-medium">Extra email campaigns: {money(prices.campaignBlock)} a month per 5,000 sends</p>
            <p className="text-neutral-500">Adds blocks of 5,000 campaign sends a month on top of your tier.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input w-20"
              type="number"
              min={0}
              max={100}
              value={campaignBlocks}
              onChange={(e) => setCampaignBlocks(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
            <span className="text-neutral-500">blocks</span>
            <button className="btn-secondary" disabled={busy || campaignBlocks === initial.extraCampaignBlocks} onClick={() => save("extraCampaignBlocks", campaignBlocks)}>
              Save
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm mt-2">
        Add-ons total: <span className="font-medium">{money(total)} a month</span>
      </p>
      {msg && <p className="text-sm text-emerald-600 mt-1">{msg}</p>}
    </div>
  );
}
