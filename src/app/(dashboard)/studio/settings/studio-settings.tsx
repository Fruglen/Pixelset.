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
}

export function StudioSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...profile, defaultTaxRate: String(profile.defaultTaxRate) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
        <Toggle
          on={form.googleCalendarSync}
          label="Google Calendar sync, push bookings to your Google Calendar"
          onChange={(v) => {
            setForm({ ...form, googleCalendarSync: v });
            patch({ googleCalendarSync: v });
          }}
        />
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
            <p className="text-xs text-emerald-600 mt-2">✓ Connected (demo), card payments are offered on pay pages.</p>
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
            <div>
              <label className="label">Stripe account ID</label>
              <input
                className="input max-w-xs"
                placeholder="acct_…"
                value={form.stripeAccount}
                onChange={(e) => setForm({ ...form, stripeAccount: e.target.value })}
              />
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
            <div>
              <label className="label">PayPal email</label>
              <input
                className="input max-w-xs"
                value={form.paypalEmail}
                onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })}
              />
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
            All connections are demo states, no real processor is contacted. Tap to Pay is noted on invoices.
          </p>
        </div>
      </section>
    </div>
  );
}
