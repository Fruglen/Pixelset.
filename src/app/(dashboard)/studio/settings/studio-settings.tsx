"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  bookingSlug: string;
  welcomeText: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  taxId: string;
  defaultTaxRate: number;
  pixelsetPaymentsConnected: boolean;
  stripeConnected: boolean;
  stripeAccount: string;
  paypalConnected: boolean;
  paypalEmail: string;
  manualEnabled: boolean;
  manualInstructions: string;
  showStripe: boolean;
  showPaypal: boolean;
  showManual: boolean;
  googleCalendarSync: boolean;
  googleEmail: string;
  googleSyncAt: string | null;
  googleConnected: boolean;
  googleConfigured: boolean;
}

interface Processors {
  stripe: boolean;
  stripeConnect: boolean;
  paypal: boolean;
  paypalSandbox: boolean;
}

export function StudioSettings({
  profile,
  processors,
  googleNote = "",
}: {
  profile: Profile;
  processors?: Processors;
  googleNote?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...profile, defaultTaxRate: String(profile.defaultTaxRate) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMsg, setGoogleMsg] = useState("");

  async function googleSyncNow() {
    setGoogleBusy(true);
    setGoogleMsg("");
    const res = await fetch("/api/studio/google/sync", { method: "POST" });
    const out = await res.json().catch(() => ({}));
    setGoogleBusy(false);
    setGoogleMsg(out.detail ?? (res.ok ? "Synced" : "Sync failed"));
    router.refresh();
  }

  async function googleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Bookings stop syncing and your personal events stop blocking availability. Events already on your Google calendar stay there.")) return;
    setGoogleBusy(true);
    await fetch("/api/studio/google/disconnect", { method: "POST" });
    setGoogleBusy(false);
    setGoogleMsg("Disconnected");
    router.refresh();
  }

  async function patch(data: Record<string, unknown>, feedback = false) {
    setError("");
    const res = await fetch("/api/studio/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? "Save failed");
      return false;
    }
    if (feedback) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    }
    router.refresh();
    return true;
  }

  async function save() {
    setBusy(true);
    await patch(
      {
        bookingSlug: form.bookingSlug,
        welcomeText: form.welcomeText,
        businessEmail: form.businessEmail,
        businessPhone: form.businessPhone,
        businessAddress: form.businessAddress,
        taxId: form.taxId,
        defaultTaxRate: parseFloat(form.defaultTaxRate) || 0,
        stripeAccount: form.stripeAccount,
        paypalEmail: form.paypalEmail,
        manualInstructions: form.manualInstructions,
      },
      true
    );
    setBusy(false);
  }

  function Toggle({
    on,
    onChange,
    label,
  }: {
    on: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-end gap-2">
        {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Booking site</h2>
        <div>
          <label className="label">Booking link</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">/book/</span>
            <input
              className="input max-w-xs"
              value={form.bookingSlug}
              onChange={(e) => setForm({ ...form, bookingSlug: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Welcome text</label>
          <textarea
            className="input min-h-[60px]"
            value={form.welcomeText}
            onChange={(e) => setForm({ ...form, welcomeText: e.target.value })}
          />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Google Calendar</h2>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              profile.googleConnected ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {profile.googleConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        {googleNote === "connected" ? (
          <p className="text-sm text-emerald-600">Google Calendar connected. Your bookings and personal events are syncing.</p>
        ) : null}
        {googleNote === "not-configured" ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            Google Calendar is not configured on this server yet (the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
            environment variables are missing), so connecting is not available right now.
          </p>
        ) : null}
        {googleNote === "error" ? (
          <p className="text-sm text-red-600">Google did not complete the connection. Try again.</p>
        ) : null}
        {!profile.googleConfigured && !profile.googleConnected ? (
          <p className="text-sm text-neutral-500">
            Two way sync is built in, but this server has no Google credentials configured, so the Connect button
            cannot work yet. Once GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set on the server, connecting
            takes one click.
          </p>
        ) : profile.googleConnected ? (
          <>
            <p className="text-sm text-neutral-600">
              Connected{profile.googleEmail ? ` as ${profile.googleEmail}` : ""}. Bookings are pushed to your
              Google calendar, and your personal events block your booking availability so clients cannot book
              over them.
              {profile.googleSyncAt
                ? ` Last synced ${new Date(profile.googleSyncAt).toLocaleString("en-US")}.`
                : " Not synced yet."}
            </p>
            <Toggle
              on={form.googleCalendarSync}
              label="Two way sync on (push bookings, block availability with personal events)"
              onChange={(v) => {
                setForm({ ...form, googleCalendarSync: v });
                patch({ googleCalendarSync: v });
              }}
            />
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={googleBusy} onClick={googleSyncNow}>
                {googleBusy ? "Syncing…" : "Sync now"}
              </button>
              <button className="btn-secondary" disabled={googleBusy} onClick={googleDisconnect}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600">
              Connect your Google calendar and Pixelset will push every booking onto it, and read your personal
              events back as busy time so a client can never book over them.
            </p>
            <a className="btn-primary inline-block" href="/api/studio/google/connect">
              Connect Google Calendar
            </a>
          </>
        )}
        {googleMsg ? <p className="text-sm text-neutral-500">{googleMsg}</p> : null}
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-display text-lg">Business details</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Business email</label>
            <input className="input" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax ID</label>
            <input className="input" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </div>
          <div>
            <label className="label">Default tax rate (%)</label>
            <input className="input" value={form.defaultTaxRate} onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <h2 className="font-display text-lg">Payments</h2>

        <div className="border border-neutral-200 rounded-md p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Pixelset Payments</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Stripe-powered cards, Apple Pay and Google Pay · 2.9% + $0.30 per transaction.
              </p>
            </div>
            <button
              className={profile.pixelsetPaymentsConnected ? "btn-secondary" : "btn-primary"}
              onClick={() => patch({ pixelsetPaymentsConnected: !profile.pixelsetPaymentsConnected })}
            >
              {profile.pixelsetPaymentsConnected ? "Disconnect" : "Set up"}
            </button>
          </div>
          {profile.pixelsetPaymentsConnected ? (
            processors?.stripe ? (
              <p className="text-xs text-emerald-600 mt-2">
                Connected. Card, Apple Pay, Google Pay, Link, Affirm and Klarna run through Stripe Checkout on pay pages.
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-2">
                Switched on, but the server has no Stripe key yet (STRIPE_SECRET_KEY), so pay pages use the recorded demo checkout and no
                card is charged.
              </p>
            )
          ) : null}
        </div>

        <div className="border border-neutral-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Your own Stripe account</p>
              <p className="text-xs text-neutral-500 mt-0.5">Connect an existing Stripe account instead.</p>
            </div>
            <button
              className={profile.stripeConnected ? "btn-secondary" : "btn-primary"}
              onClick={() => patch({ stripeConnected: !profile.stripeConnected })}
            >
              {profile.stripeConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
          {profile.stripeConnected ? (
            <div className="space-y-2">
              <div>
                <label className="label">Stripe account ID</label>
                <input
                  className="input max-w-xs"
                  placeholder="acct_…"
                  value={form.stripeAccount}
                  onChange={(e) => setForm({ ...form, stripeAccount: e.target.value })}
                />
              </div>
              {processors?.stripeConnect ? (
                <a className="text-xs underline text-neutral-600" href="/api/studio/payments/connect">
                  Connect or reconnect with Stripe (OAuth)
                </a>
              ) : (
                <p className="text-xs text-neutral-400">
                  OAuth connect is not configured on this server (STRIPE_PLATFORM_CLIENT_ID), paste your account ID instead.
                </p>
              )}
              {!processors?.stripe ? (
                <p className="text-xs text-amber-600">The server has no Stripe key yet, so charges stay in the recorded demo checkout.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border border-neutral-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">PayPal</p>
              <p className="text-xs text-neutral-500 mt-0.5">Let clients pay with PayPal.</p>
            </div>
            <button
              className={profile.paypalConnected ? "btn-secondary" : "btn-primary"}
              onClick={() => patch({ paypalConnected: !profile.paypalConnected })}
            >
              {profile.paypalConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
          {profile.paypalConnected ? (
            <div className="space-y-2">
              <div>
                <label className="label">PayPal email</label>
                <input
                  className="input max-w-xs"
                  value={form.paypalEmail}
                  onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })}
                />
              </div>
              {processors?.paypal ? (
                <p className="text-xs text-emerald-600">
                  PayPal is configured on this server ({processors.paypalSandbox ? "sandbox" : "live"}), clients pay through PayPal checkout.
                </p>
              ) : (
                <p className="text-xs text-amber-600">
                  Switched on, but the server has no PayPal app credentials yet (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET), so PayPal
                  payments stay in the recorded demo checkout.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="border border-neutral-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Manual payments</p>
              <p className="text-xs text-neutral-500 mt-0.5">Cash, check, bank transfer, with instructions for the client.</p>
            </div>
            <button
              className={profile.manualEnabled ? "btn-secondary" : "btn-primary"}
              onClick={() => patch({ manualEnabled: !profile.manualEnabled })}
            >
              {profile.manualEnabled ? "Disable" : "Enable"}
            </button>
          </div>
          {profile.manualEnabled ? (
            <div>
              <label className="label">Instructions shown to clients</label>
              <textarea
                className="input min-h-[50px]"
                value={form.manualInstructions}
                onChange={(e) => setForm({ ...form, manualInstructions: e.target.value })}
              />
            </div>
          ) : null}
        </div>

        <div>
          <p className="label">Shown on client pay pages</p>
          <div className="flex flex-wrap gap-5">
            <Toggle
              on={profile.showStripe}
              label="Card (Stripe)"
              onChange={(v) => patch({ showStripe: v })}
            />
            <Toggle on={profile.showPaypal} label="PayPal" onChange={(v) => patch({ showPaypal: v })} />
            <Toggle on={profile.showManual} label="Manual / pay another way" onChange={(v) => patch({ showManual: v })} />
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Connections charge for real only when the server keys above are in place; until then pay pages use a recorded demo checkout
            and say so. Tap to Pay runs through Stripe Terminal on your phone when Stripe is live; in person payments can always be
            recorded from an invoice.
          </p>
        </div>
      </section>
    </div>
  );
}
