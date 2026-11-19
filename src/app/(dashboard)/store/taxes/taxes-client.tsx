"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, TAX_REGIONS, resolveTax } from "@/lib/store-rates";

type Settings = { taxEnabled: boolean; taxMode: string; taxRate: number; taxNexus: string; taxShipping: boolean };
type Rate = { id: string; name: string; country: string; region: string; ratePct: number; active: boolean };

export default function TaxesClient({ settings, rates }: { settings: Settings; rates: Rate[] }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [rateText, setRateText] = useState(String(settings.taxRate));
  const [nexus, setNexus] = useState<string[]>(settings.taxNexus ? settings.taxNexus.split(",") : []);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", country: "US", region: "", ratePct: "" });
  const [testCountry, setTestCountry] = useState("US");
  const [testRegion, setTestRegion] = useState("TX");

  async function saveSettings() {
    setError("");
    setSaved(false);
    const res = await fetch("/api/store/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxEnabled: s.taxEnabled,
        taxMode: s.taxMode,
        taxRate: parseFloat(rateText) || 0,
        taxShipping: s.taxShipping,
        taxNexus: nexus.join(","),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not save");
    setSaved(true);
    router.refresh();
  }

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/store/tax-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, ratePct: parseFloat(draft.ratePct) || 0 }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not add the rate");
    setDraft({ name: "", country: draft.country, region: "", ratePct: "" });
    router.refresh();
  }

  async function patchRate(id: string, data: Record<string, unknown>) {
    await fetch(`/api/store/tax-rates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    router.refresh();
  }

  async function deleteRate(id: string) {
    if (!confirm("Delete this tax rate?")) return;
    await fetch(`/api/store/tax-rates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const draftRegions = TAX_REGIONS.filter((r) => r.country === draft.country);
  const test = resolveTax({ ...s, taxRate: parseFloat(rateText) || 0, taxNexus: nexus.join(",") }, rates, testCountry, testRegion);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-5 space-y-4">
        <h2 className="font-medium">Tax collection</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.taxEnabled} onChange={(e) => setS({ ...s, taxEnabled: e.target.checked })} />
          Collect tax on store orders (prints and digital downloads)
        </label>
        {s.taxEnabled && (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <label className={`card p-3 cursor-pointer text-sm ${s.taxMode === "AUTO" ? "ring-1 ring-neutral-900" : ""}`}>
                <input type="radio" className="mr-2" checked={s.taxMode === "AUTO"} onChange={() => setS({ ...s, taxMode: "AUTO" })} />
                <span className="font-medium">Automatic local tax</span>
                <p className="text-xs text-neutral-500 mt-1">
                  The rate is looked up from the buyer&rsquo;s state or province at checkout, using the built in table below.
                  Manual rates override it.
                </p>
              </label>
              <label className={`card p-3 cursor-pointer text-sm ${s.taxMode === "MANUAL" ? "ring-1 ring-neutral-900" : ""}`}>
                <input type="radio" className="mr-2" checked={s.taxMode === "MANUAL"} onChange={() => setS({ ...s, taxMode: "MANUAL" })} />
                <span className="font-medium">Manual rates</span>
                <p className="text-xs text-neutral-500 mt-1">
                  Only your own rates apply. Buyers outside every rate pay the default rate.
                </p>
              </label>
            </div>
            {s.taxMode === "MANUAL" && (
              <div className="max-w-48">
                <label className="label">Default rate %</label>
                <input className="input" inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value)} />
              </div>
            )}
            {s.taxMode === "AUTO" && (
              <div>
                <label className="label">Collect only in these regions (leave empty to collect everywhere in the table)</label>
                <select
                  className="input h-28"
                  multiple
                  value={nexus}
                  onChange={(e) => setNexus(Array.from(e.target.selectedOptions).map((o) => o.value))}
                >
                  {TAX_REGIONS.map((r) => (
                    <option key={`${r.country}-${r.code}`} value={`${r.country}-${r.code}`}>
                      {r.country === "US" ? "US" : "Canada"}, {r.name} ({r.ratePct}%)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400 mt-1">
                  {nexus.length ? `${nexus.length} region(s) selected.` : "Collecting in every listed region."} Hold Ctrl or Cmd to pick several.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.taxShipping} onChange={(e) => setS({ ...s, taxShipping: e.target.checked })} />
              Charge tax on shipping too
            </label>
          </>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={saveSettings}>
            Save tax settings
          </button>
          {saved && <span className="text-sm text-green-600">Saved.</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Manual tax rates</h2>
        <p className="text-xs text-neutral-400">
          Named rates for a state, province, or whole country. A rate with no region covers the whole country.
        </p>
        {rates.length === 0 ? (
          <p className="text-sm text-neutral-400">No manual rates yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rates.map((r) => (
              <li key={r.id} className={`py-2 flex items-center gap-3 text-sm ${r.active ? "" : "opacity-50"}`}>
                <span className="font-medium flex-1">{r.name}</span>
                <span className="text-neutral-500">
                  {r.country}
                  {r.region ? `-${r.region}` : ", whole country"}
                </span>
                <span className="w-16 text-right">{r.ratePct}%</span>
                <button className="text-xs underline text-neutral-500" onClick={() => patchRate(r.id, { active: !r.active })}>
                  {r.active ? "Pause" : "Activate"}
                </button>
                <button className="text-xs underline text-red-500" onClick={() => deleteRate(r.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addRate} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="label">Name</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Austin combined rate" required />
          </div>
          <div>
            <label className="label">Country</label>
            <select className="input" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value, region: "" })}>
              {COUNTRIES.filter((c) => c.code !== "OTHER").map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Region</label>
            <select className="input" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })}>
              <option value="">Whole country</option>
              {draftRegions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input className="input" inputMode="decimal" placeholder="%" value={draft.ratePct} onChange={(e) => setDraft({ ...draft, ratePct: e.target.value })} required />
            <button className="btn-secondary">Add</button>
          </div>
        </form>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Check a location</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input !w-44" value={testCountry} onChange={(e) => { setTestCountry(e.target.value); setTestRegion(""); }}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input !w-56" value={testRegion} onChange={(e) => setTestRegion(e.target.value)}>
            <option value="">No region</option>
            {TAX_REGIONS.filter((r) => r.country === testCountry).map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="text-sm">
            {s.taxEnabled ? test.label || "No tax" : "Tax collection is off"} {s.taxEnabled && <span className="font-medium">, {test.ratePct}%</span>}
          </span>
        </div>
        <p className="text-xs text-neutral-400">Uses the settings on this page, including unsaved changes.</p>
      </div>

      <details className="card p-5">
        <summary className="font-medium cursor-pointer">Automatic rate table ({TAX_REGIONS.length} regions)</summary>
        <p className="text-xs text-neutral-400 mt-2">
          US statewide base sales tax and Canadian combined GST, HST, PST, and QST rates. County and city add ons are not
          included, add a manual rate where you need them.
        </p>
        <div className="grid md:grid-cols-3 gap-x-6 text-xs text-neutral-600 mt-3">
          {TAX_REGIONS.map((r) => (
            <div key={`${r.country}-${r.code}`} className="flex justify-between py-0.5">
              <span>
                {r.name} <span className="text-neutral-400">{r.country}</span>
              </span>
              <span>{r.ratePct}%</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
