"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords don't match");
    setBusy(true);
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not accept the invite");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 mt-6 space-y-4">
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
        <p className="text-xs text-neutral-400 mt-1">At least 8 characters. This is your own sign-in password.</p>
      </div>
      <div>
        <label className="label">Confirm password</label>
        <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Setting up…" : "Set password and sign in"}
      </button>
    </form>
  );
}
