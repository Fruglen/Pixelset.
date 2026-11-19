"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Night build (Pricing lane): security settings client pieces: the Volume
// plan picker, the IP allowlist editor and the session list. The research
// puts IP whitelisting, unlimited login sessions and no bandwidth
// restrictions on the Volume plans; Pixelset never meters sessions or
// bandwidth, so the allowlist is the working feature.

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export function VolumeCard({
  initial,
  options,
}: {
  initial: string;
  options: { id: string; label: string; monthlyCents: number }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const chosen = options.find((o) => o.id === value);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/account/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "volume", value }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Volume plan updated in simulated mode. Nothing was charged.");
      router.refresh();
    } else {
      setMsg("Could not update the volume plan.");
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-medium">Studio Manager Volume plan</h2>
      <p className="text-sm text-neutral-500 mt-1">
        Volume plans (billed annually) add IP whitelisting for sign-ins. Login sessions are unlimited and bandwidth
        is never metered on any Pixelset account, so those two Volume promises are already true for everyone.
        Billing is parked, so changes here are simulated and nothing is charged.
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <select className="input w-56" value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.monthlyCents ? `, ${money(o.monthlyCents)}/mo billed annually` : ""}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={busy || value === initial} onClick={save}>
          Save volume plan
        </button>
        {chosen && chosen.monthlyCents > 0 && (
          <span className="text-sm text-neutral-500">{money(chosen.monthlyCents * 12)} a year</span>
        )}
      </div>
      {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
    </div>
  );
}

export function IpAllowlistCard({
  initialEntries,
  enforced,
  currentIp,
}: {
  initialEntries: string[];
  enforced: boolean;
  currentIp: string;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<string[]>(initialEntries);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save(next: string[]) {
    setBusy(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/account/ip-allowlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: next }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setEntries(json.entries as string[]);
      setMsg("Allowlist saved.");
      router.refresh();
    } else {
      setError(json.error || "Could not save the allowlist.");
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-medium">Sign-in IP allowlist</h2>
      <p className="text-sm text-neutral-500 mt-1">
        {enforced
          ? "Active: sign-in is only allowed from the addresses below. An empty list allows every address."
          : "Saved but not enforced: IP whitelisting switches on with a Studio Manager Volume plan."}{" "}
        Your current address appears to this server as <span className="font-mono">{currentIp}</span>. Add it (or
        the word <span className="font-mono">local</span> for this machine) before saving a list, or you will lock
        yourself out.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {entries.map((e) => (
          <li key={e} className="flex items-center gap-3">
            <span className="font-mono bg-neutral-50 border border-neutral-200 rounded px-2 py-1">{e}</span>
            <button
              className="text-red-600 hover:underline disabled:opacity-50"
              disabled={busy || !enforced}
              onClick={() => save(entries.filter((x) => x !== e))}
            >
              Remove
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="text-neutral-400">No addresses yet, every sign-in address is allowed.</li>}
      </ul>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <input
          className="input w-64 font-mono"
          placeholder="203.0.113.7 or 203.0.113.0/24 or local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn-secondary"
          disabled={busy || !enforced || !draft.trim()}
          onClick={() => {
            const next = [...entries, draft.trim()];
            setDraft("");
            save(next);
          }}
        >
          Add address
        </button>
        {!enforced && <span className="text-sm text-amber-600">Choose a Volume plan above to edit and enforce the list.</span>}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
    </div>
  );
}

export function SessionsCard({
  sessions,
}: {
  sessions: { id: string; createdAt: string; expiresAt: string; current: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  async function revoke(id: string) {
    setBusy(id);
    await fetch(`/api/account/sessions/${id}`, { method: "DELETE" });
    setBusy("");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="font-medium">Login sessions</h2>
      <p className="text-sm text-neutral-500 mt-1">
        Every signed in device. Sessions are unlimited on every plan (the Volume plans promise this in the
        research, and Pixelset does not meter them for anyone). Revoking a session signs that device out.
      </p>
      <ul className="mt-3 divide-y divide-neutral-100 text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="py-2 flex items-center gap-3 flex-wrap">
            <span>
              Signed in {new Date(s.createdAt).toLocaleString()}, expires {new Date(s.expiresAt).toLocaleDateString()}
            </span>
            {s.current && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">This device</span>}
            <button className="ml-auto text-red-600 hover:underline disabled:opacity-50" disabled={busy === s.id} onClick={() => revoke(s.id)}>
              Revoke
            </button>
          </li>
        ))}
        {sessions.length === 0 && <li className="py-2 text-neutral-400">No active sessions.</li>}
      </ul>
    </div>
  );
}
