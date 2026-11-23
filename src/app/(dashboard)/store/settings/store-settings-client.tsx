"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { STORE_CURRENCIES } from "@/lib/store-rates";

type Profile = {
  storeOpen: boolean;
  closedMessage: string;
  currency: string;
  cardPayments: boolean;
  offlinePayments: boolean;
  offlineInstructions: string;
  digitalLicense: string;
  termsOfSale: string;
  labEnabled: boolean;
  labName: string;
  labEmail: string;
  labEndpoint: string;
  whiteLabelPackaging: boolean;
};

export default function StoreSettingsClient({
  profile,
  labKeyPresent,
  webhookPresent,
}: {
  profile: Profile;
  labKeyPresent: boolean;
  webhookPresent: boolean;
}) {
  const router = useRouter();
  const [storeOpen, setStoreOpen] = useState(profile.storeOpen);
  const [closedMessage, setClosedMessage] = useState(profile.closedMessage);
  const [currency, setCurrency] = useState(profile.currency);
  const [cardPayments, setCardPayments] = useState(profile.cardPayments);
  const [offlinePayments, setOfflinePayments] = useState(profile.offlinePayments);
  const [offlineInstructions, setOfflineInstructions] = useState(profile.offlineInstructions);
  const [digitalLicense, setDigitalLicense] = useState(profile.digitalLicense);
  const [termsOfSale, setTermsOfSale] = useState(profile.termsOfSale);
  const [labEnabled, setLabEnabled] = useState(profile.labEnabled);
  const [labName, setLabName] = useState(profile.labName);
  const [labEmail, setLabEmail] = useState(profile.labEmail);
  const [labEndpoint, setLabEndpoint] = useState(profile.labEndpoint);
  const [whiteLabelPackaging, setWhiteLabelPackaging] = useState(profile.whiteLabelPackaging);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");


  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const res = await fetch("/api/store/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeOpen,
        closedMessage,
        currency,
        cardPayments,
        offlinePayments,
        offlineInstructions,
        digitalLicense,
        termsOfSale,
        labEnabled,
        labName,
        labEmail,
        labEndpoint,
        whiteLabelPackaging,
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Store status</h2>
          <span className={`text-xs px-2 py-1 rounded-full ${storeOpen ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
            {storeOpen ? "Open" : "Closed"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={storeOpen} onChange={(e) => setStoreOpen(e.target.checked)} />
          Store is open, clients can buy from galleries with a price sheet
        </label>
        {!storeOpen && (
          <div>
            <label className="label">Message shown in galleries while closed</label>
            <input className="input" value={closedMessage} onChange={(e) => setClosedMessage(e.target.value)} placeholder="The store is closed for the holidays, back January 5." />
          </div>
        )}
        <div className="max-w-48">
          <label className="label">Store currency</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {STORE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-400">Prices in the gallery storefront, checkout, and client emails are shown in this currency.</p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-medium">Payment methods</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cardPayments} onChange={(e) => setCardPayments(e.target.checked)} />
          Card payments at checkout
        </label>
        <p className="text-xs text-neutral-400 -mt-1 ml-6">
          Online card payment is not enabled yet. Orders stay awaiting payment until you mark them paid, whatever this setting says.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={offlinePayments} onChange={(e) => setOfflinePayments(e.target.checked)} />
          Offline payment (cash, bank transfer, check)
        </label>
        {offlinePayments && (
          <div className="ml-6">
            <label className="label">Payment instructions shown at checkout and in the confirmation email</label>
            <textarea className="input h-20" value={offlineInstructions} onChange={(e) => setOfflineInstructions(e.target.value)} placeholder="Send an e-transfer to studio@example.com with your order number." />
            <p className="text-xs text-neutral-400 mt-1">
              Offline orders wait as Awaiting payment. Download links and lab orders are released when you mark the order paid.
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Lab fulfillment</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">Coming Soon</span>
        </div>
        <p className="text-sm text-neutral-500">
          Print lab fulfillment is coming soon. The lab connection settings below are saved with your store,
          and sending orders to a print lab switches on when labs launch.
        </p>
        <fieldset disabled className="space-y-3 opacity-60">
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
        <p className="text-xs text-neutral-400">
          Lab status updates: the lab POSTs to <span className="font-mono">/api/store/lab-webhook</span> with the
          LAB_WEBHOOK_SECRET bearer token{webhookPresent ? " (secret detected)" : ", which is not set, so the webhook is Not connected"}.
          Until then, move lab orders through the timeline by hand on the order page.
        </p>
        <div className="border-t border-neutral-100 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={whiteLabelPackaging} onChange={(e) => setWhiteLabelPackaging(e.target.checked)} />
            White label packaging
          </label>
          <p className="text-xs text-neutral-400 mt-1">
            Lab shipments carry no Pixora or lab branding, only your studio name on the packing label. The
            choice is written into every lab order payload.
          </p>
        </div>
        </fieldset>
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
