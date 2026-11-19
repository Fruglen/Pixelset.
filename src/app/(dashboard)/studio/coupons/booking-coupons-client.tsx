"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minSpendCents: number;
  active: boolean;
  useLimit: number | null;
  useCount: number;
  expiresAt: string | null;
  sessionTypeId: string;
};

function describe(c: Coupon): string {
  if (c.type === "PERCENT") return `${c.value}% off`;
  return `$${(c.value / 100).toFixed(2)} off`;
}

export default function BookingCouponsClient({
  coupons,
  sessionTypes,
}: {
  coupons: Coupon[];
  sessionTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState("10");
  const [minSpend, setMinSpend] = useState("");
  const [useLimit, setUseLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [error, setError] = useState("");

  const typeName = (id: string) => sessionTypes.find((s) => s.id === id)?.name ?? "a session";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/studio/booking-coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        type,
        value: type === "FIXED" ? Math.round(parseFloat(value || "0") * 100) : Math.round(parseFloat(value || "0")),
        minSpendCents: minSpend ? Math.round(parseFloat(minSpend) * 100) : 0,
        useLimit: useLimit ? Number(useLimit) : null,
        expiresAt: expiresAt || null,
        sessionTypeId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create");
    setCreating(false);
    setCode("");
    router.refresh();
  }

  async function toggle(c: Coupon) {
    await fetch(`/api/studio/booking-coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await fetch(`/api/studio/booking-coupons/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">Clients enter codes in the booking price summary.</p>
        <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
          + New Coupon
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-4 mb-4 grid md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="label">Code</label>
            <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FAMILY10" required autoFocus />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PERCENT">% off</option>
              <option value="FIXED">$ off</option>
            </select>
          </div>
          <div>
            <label className="label">{type === "PERCENT" ? "Percent" : "Amount $"}</label>
            <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <label className="label">Applies to</label>
            <select className="input" value={sessionTypeId} onChange={(e) => setSessionTypeId(e.target.value)}>
              <option value="">Every session</option>
              {sessionTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Min spend $ (opt.)</label>
            <input className="input" inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
          </div>
          <div>
            <label className="label">Use limit (opt.)</label>
            <input className="input" inputMode="numeric" value={useLimit} onChange={(e) => setUseLimit(e.target.value)} />
          </div>
          <div>
            <label className="label">Expires (opt.)</label>
            <input className="input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="md:col-span-6 flex justify-end gap-2">
            {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn-primary">Create</button>
          </div>
        </form>
      )}

      {coupons.length === 0 ? (
        <p className="text-sm text-neutral-400">No booking coupons yet.</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {coupons.map((c) => (
            <div key={c.id} className={`flex items-center gap-4 px-4 py-3 ${c.active ? "" : "opacity-50"}`}>
              <code className="text-sm font-mono bg-neutral-100 rounded px-2 py-1">{c.code}</code>
              <div className="flex-1 text-sm">
                <span className="font-medium">{describe(c)}</span>
                <span className="text-neutral-500"> · {c.sessionTypeId ? typeName(c.sessionTypeId) : "every session"}</span>
                {c.minSpendCents > 0 && <span className="text-neutral-500"> · min ${(c.minSpendCents / 100).toFixed(2)}</span>}
                {c.expiresAt && <span className="text-neutral-500"> · expires {c.expiresAt}</span>}
              </div>
              <span className="text-xs text-neutral-400">
                used {c.useCount}
                {c.useLimit ? `/${c.useLimit}` : ""}
              </span>
              <button className="text-xs underline text-neutral-500" onClick={() => toggle(c)}>
                {c.active ? "Deactivate" : "Activate"}
              </button>
              <button className="text-xs underline text-red-500" onClick={() => remove(c.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
