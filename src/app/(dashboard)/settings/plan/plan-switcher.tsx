"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tiers = { gallery: string; website: string; studio: string };

const LABEL: Record<string, string> = { free: "Free", basic: "Basic", plus: "Plus", pro: "Pro", ultimate: "Ultimate" };

// Phase 5B platform: the simulated plan. Caps and Pro features (retainers at
// booking, manual approval, ...) are enforced against it. No billing is connected.
export function PlanSwitcher({
  initial,
  options,
  unlocks,
}: {
  initial: Tiers;
  options: { gallery: string[]; website: string[]; studio: string[] };
  unlocks: { studioPro: string[] };
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  async function save(next: Tiers) {
    setV(next);
    setMsg("");
    const res = await fetch("/api/account/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setMsg(res.ok ? "Plan updated. No charge was made, billing is not connected." : "Could not update the plan");
    router.refresh();
  }
  const rows: { key: keyof Tiers; name: string }[] = [
    { key: "gallery", name: "Client Gallery" },
    { key: "website", name: "Website" },
    { key: "studio", name: "Studio Manager" },
  ];
  return (
    <div className="card p-5">
      <h2 className="font-medium">Your plan</h2>
      <p className="text-sm text-neutral-500 mt-1">
        Simulated plan, no billing connected. Switching a tier applies its limits and unlocks immediately so you can see how
        each plan behaves. Nothing is charged.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {rows.map((r) => (
          <div key={r.key}>
            <label className="label">{r.name}</label>
            <select
              className="input"
              value={v[r.key]}
              onChange={(e) => save({ ...v, [r.key]: e.target.value })}
              data-plan={r.key}
            >
              {options[r.key].map((t) => (
                <option key={t} value={t}>
                  {LABEL[t] ?? t}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500 mt-3">
        Studio Manager Pro unlocks: {unlocks.studioPro.join(", ")}.{" "}
        {v.studio === "pro" ? "Unlocked on your plan." : "Locked on your current Studio Manager plan."}
      </p>
      {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
    </div>
  );
}
