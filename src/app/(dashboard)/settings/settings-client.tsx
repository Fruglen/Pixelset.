"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountSettingsClient({
  user,
  email,
}: {
  user: { name: string; businessName: string; watermarkText: string; email: string; mailFrom: string };
  email: { connected: boolean; defaultFrom: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [businessName, setBusinessName] = useState(user.businessName);
  const [watermarkText, setWatermarkText] = useState(user.watermarkText);
  const [mailFrom, setMailFrom] = useState(user.mailFrom);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testError, setTestError] = useState("");
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    setTestMsg("");
    setTestError("");
    try {
      const res = await fetch("/api/account/test-email", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTestMsg(`Test email sent to ${data.to}`);
      else setTestError(data.error || "The test email could not be sent");
    } finally {
      setTesting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        businessName,
        watermarkText,
        mailFrom,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      }),
    });
    if (res.ok) {
      setMsg("Settings saved");
      setCurrentPassword("");
      setNewPassword("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save");
    }
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={save} className="space-y-6">
        <section className="card p-6 space-y-4">
          <h2 className="font-display text-lg">Profile</h2>
          <div>
            <label className="label">Email</label>
            <input className="input bg-neutral-50" value={user.email} disabled />
          </div>
          <div>
            <label className="label">Your name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Business name</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div>
            <label className="label">Watermark text (shown on watermarked gallery previews)</label>
            <input className="input" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
          </div>
        </section>

        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Email sending</h2>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                email.connected ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {email.connected ? "Resend connected" : "Not connected"}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            {email.connected
              ? "Emails (invites, confirmations, invoices, reminders) are delivered for real through Resend."
              : "No RESEND_API_KEY is set, so emails are logged to the inbox and activities instead of being delivered. Set the key in the environment to send for real."}
          </p>
          <div>
            <label className="label">From address (leave blank for the default)</label>
            <input
              className="input"
              value={mailFrom}
              onChange={(e) => setMailFrom(e.target.value)}
              placeholder={email.defaultFrom}
            />
            <p className="text-xs text-neutral-400 mt-1">
              Format: Your Studio &lt;hello@yourdomain.com&gt;. The domain must be verified with Resend.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={sendTest}
              disabled={testing || !email.connected}
            >
              {testing ? "Sending…" : "Send test email"}
            </button>
            <span className="text-xs text-neutral-400">Sends to {user.email}</span>
          </div>
          {testMsg && <p className="text-sm text-emerald-600">{testMsg}</p>}
          {testError && <p className="text-sm text-red-600">{testError}</p>}
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="font-display text-lg">Change password</h2>
          <div>
            <label className="label">Current password</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">New password (min 8 characters)</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </section>

        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary">Save Settings</button>
      </form>
    </div>
  );
}
