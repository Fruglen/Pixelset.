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
  showBanner: boolean;
  bannerText: string;
};

const TYPE_LABELS: Record<string, string> = {
  PERCENT: "% off",
  FIXED: "$ off",
  FREE_SHIPPING: "Free shipping",
  FREE_PRODUCT: "Free product",
};

function describe(c: Coupon): string {
  if (c.type === "PERCENT") return `${c.value}% off`;
  if (c.type === "FIXED") return `$${(c.value / 100).toFixed(2)} off`;
  if (c.type === "FREE_SHIPPING") return "Free shipping";
  return "Cheapest item free";
}

export default function CouponsClient({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState("10");
  const [minSpend, setMinSpend] = useState("");
  const [useLimit, setUseLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/store/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        type,
        value: type === "FIXED" ? Math.round(parseFloat(value || "0") * 100) : Math.round(parseFloat(value || "0")),
        minSpendCents: minSpend ? Math.round(parseFloat(minSpend) * 100) : 0,
        useLimit: useLimit ? Number(useLimit) : null,
        expiresAt: expiresAt || null,
        showBanner,
        bannerText,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create");
    setCreating(false);
    setCode("");
    router.refresh();
  }

  async function toggle(c: Coupon) {
    await fetch(`/api/store/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  }

  async function toggleBanner(c: Coupon) {
    await fetch(`/api/store/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showBanner: !c.showBanner }),
    });
    router.refresh();
  }

  async function saveBannerText(c: Coupon, text: string) {
    await fetch(`/api/store/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerText: text }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await fetch(`/api/store/coupons/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">Clients enter codes at gallery checkout.</p>
        <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
          + New Coupon
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-4 mb-4 grid md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="label">Code</label>
            <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PRINTS10" required autoFocus />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {(type === "PERCENT" || type === "FIXED") && (
            <div>
              <label className="label">{type === "PERCENT" ? "Percent" : "Amount $"}</label>
              <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
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
          <div className="md:col-span-6 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} />
              Show as a banner in client galleries
            </label>
            {showBanner && (
              <input
                className="input flex-1"
                placeholder="Banner text (optional), e.g. Holiday sale, 10% off prints with PRINTS10"
                value={bannerText}
                maxLength={140}
                onChange={(e) => setBannerText(e.target.value)}
              />
            )}
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
        <p className="text-sm text-neutral-400">No coupons yet.</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {coupons.map((c) => (
            <div key={c.id} className={`flex items-center gap-4 px-4 py-3 ${c.active ? "" : "opacity-50"}`}>
              <code className="text-sm font-mono bg-neutral-100 rounded px-2 py-1">{c.code}</code>
              <div className="flex-1 text-sm">
                <span className="font-medium">{describe(c)}</span>
                {c.minSpendCents > 0 && <span className="text-neutral-500"> · min ${(c.minSpendCents / 100).toFixed(2)}</span>}
                {c.expiresAt && <span className="text-neutral-500"> · expires {c.expiresAt}</span>}
                {c.showBanner && (
                  <span className="block mt-1">
                    <input
                      className="input !py-1 !text-xs max-w-md"
                      defaultValue={c.bannerText}
                      placeholder={`Banner: ${describe(c)} with code ${c.code}`}
                      onBlur={(e) => {
                        if (e.target.value !== c.bannerText) saveBannerText(c, e.target.value);
                      }}
                    />
                  </span>
                )}
              </div>
              <span className="text-xs text-neutral-400">
                used {c.useCount}
                {c.useLimit ? `/${c.useLimit}` : ""}
              </span>
              <button className="text-xs underline text-neutral-500" onClick={() => toggleBanner(c)}>
                {c.showBanner ? "Banner on" : "Banner off"}
              </button>
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
