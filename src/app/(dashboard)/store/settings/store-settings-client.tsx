"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  taxEnabled: boolean;
  taxRate: number;
  currency: string;
  digitalLicense: string;
  termsOfSale: string;
  labEnabled: boolean;
  labName: string;
  labEmail: string;
  labEndpoint: string;
};

export default function StoreSettingsClient({
  profile,
  labKeyPresent,
}: {
  profile: Profile;
  labKeyPresent: boolean;
}) {
  const router = useRouter();
  const [taxEnabled, setTaxEnabled] = useState(profile.taxEnabled);
  const [taxRate, setTaxRate] = useState(String(profile.taxRate));
  const [digitalLicense, setDigitalLicense] = useState(profile.digitalLicense);
  const [termsOfSale, setTermsOfSale] = useState(profile.termsOfSale);
  const [labEnabled, setLabEnabled] = useState(profile.labEnabled);
  const [labName, setLabName] = useState(profile.labName);
  const [labEmail, setLabEmail] = useState(profile.labEmail);
  const [labEndpoint, setLabEndpoint] = useState(profile.labEndpoint);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const labConnected = labEnabled && Boolean(labEndpoint) && labKeyPresent;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const res = await fetch("/api/store/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxEnabled,
        taxRate: parseFloat(taxRate) || 0,
        digitalLicense,
        termsOfSale,
        labEnabled,
        labName,
        labEmail,
        labEndpoint,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return setError(json.error || "Could not save");
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Automatic tax</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
          Collect tax automatically on store orders (prints and digital)
        </label>
        {taxEnabled && (
          <div className="max-w-40">
            <label className="label">Tax rate %</label>
            <input className="input" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
        )}
        <p className="text-xs text-neutral-400">
          Pixieset&rsquo;s &ldquo;auto-pilot&rdquo; local tax lookup is simulated with a single configurable rate.
          Currency: {profile.currency}.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Lab fulfillment</h2>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              labConnected ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {labConnected ? `Connected to ${labName || "lab"}` : "No lab connected"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={labEnabled} onChange={(e) => setLabEnabled(e.target.checked)} />
          Enable sending lab orders to the lab API
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lab name</label>
            <input className="input" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="WHCC" />
          </div>
          <div>
            <label className="label">Lab account email</label>
            <input className="input" value={labEmail} onChange={(e) => setLabEmail(e.target.value)} placeholder="account@yourstudio.com" />
          </div>
        </div>
        <div>
          <label className="label">Lab API endpoint</label>
          <input className="input" value={labEndpoint} onChange={(e) => setLabEndpoint(e.target.value)} placeholder="https://api.whcc.com/orders" />
        </div>
        <p className="text-xs text-neutral-400">
          Orders with lab products always generate a complete lab order payload. It is POSTed to the endpoint
          only when the toggle is on, an endpoint is set, and the LAB_API_KEY environment variable exists
          {labKeyPresent ? " (key detected)" : " (key not set)"}. Otherwise payloads stay queued on the order,
          clearly marked as not sent.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Digital Image License</h2>
        <p className="text-xs text-neutral-400">Attached to every digital-download sale and shown at checkout.</p>
        <textarea className="input h-28" value={digitalLicense} onChange={(e) => setDigitalLicense(e.target.value)} />
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Terms of sale (optional)</h2>
        <textarea className="input h-20" value={termsOfSale} onChange={(e) => setTermsOfSale(e.target.value)} placeholder="Shown in the checkout footer…" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn-primary">Save settings</button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </form>
  );
}
