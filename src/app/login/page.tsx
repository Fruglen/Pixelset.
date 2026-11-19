"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PIXORA_WORDMARK } from "@/lib/brand-assets";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (res.ok) {
      // Phase 5B: return to a deep link (e.g. the phone upload screen) after sign in.
      const next = new URLSearchParams(window.location.search).get("next") || "";
      router.push(/^\/(?!\/)/.test(next) ? next : "/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid email or password");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIXORA_WORDMARK} alt="Pixora" className="h-12 w-auto" />
        </h1>
        <p className="text-center text-sm text-neutral-500 mb-8">
          Sign in to your photographer account
        </p>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@pixelset.app"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
          <p className="text-xs text-neutral-500 text-center">
            Demo account: demo@pixelset.app / demo1234
          </p>
        </form>
        <p className="text-sm text-center mt-4 text-neutral-600">
          New here?{" "}
          <Link href="/signup" className="underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
