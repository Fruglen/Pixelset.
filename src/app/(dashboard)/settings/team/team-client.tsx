"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ASSISTANT: "Assistant",
  SECOND_SHOOTER: "Second Shooter",
};

type Member = { id: string; name: string; email: string; role: string };

export default function TeamClient({
  owner,
  members,
  workingAs,
  matrix,
}: {
  owner: { name: string; email: string };
  members: Member[];
  workingAs: string;
  matrix: { role: string; permissions: { label: string; allowed: boolean }[] }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ASSISTANT");
  const [error, setError] = useState("");

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not add member");
    setName("");
    setEmail("");
    router.refresh();
  }

  async function setMemberRole(id: string, newRole: string) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this team member?")) return;
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not remove");
    }
    router.refresh();
  }

  async function workAs(newRole: string) {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workAs: newRole }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not switch");
    }
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-5">
        <h2 className="font-medium mb-1">Team members</h2>
        <p className="text-xs text-neutral-400 mb-4">
          Owner, Assistant and Second Shooter seats with different permission levels, destructive and money actions
          are enforced server-side.
        </p>
        <div className="divide-y divide-neutral-100">
          <div className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{owner.name}</p>
              <p className="text-xs text-neutral-400">{owner.email}</p>
            </div>
            <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-900 text-white">Owner</span>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-neutral-400">{m.email}</p>
              </div>
              <select className="input !w-44" value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value)}>
                <option value="ASSISTANT">Assistant</option>
                <option value="SECOND_SHOOTER">Second Shooter</option>
              </select>
              <button className="text-xs underline text-red-500" onClick={() => remove(m.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2 items-end border-t border-neutral-100 pt-4">
          <div className="flex-1 min-w-36">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-48">
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ASSISTANT">Assistant</option>
              <option value="SECOND_SHOOTER">Second Shooter</option>
            </select>
          </div>
          <button className="btn-primary">Invite</button>
          {error && <p className="text-sm text-red-600 w-full">{error}</p>}
        </form>
      </div>

      <div className="card p-5">
        <h2 className="font-medium mb-3">Permissions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-400 uppercase tracking-wide">
              <th className="py-1.5 font-medium">Can…</th>
              {matrix.map((m) => (
                <th key={m.role} className="py-1.5 font-medium text-center">
                  {ROLE_LABELS[m.role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {matrix[0].permissions.map((p, i) => (
              <tr key={p.label}>
                <td className="py-2">{p.label}</td>
                {matrix.map((m) => (
                  <td key={m.role} className="py-2 text-center">
                    {m.permissions[i].allowed ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-neutral-300">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-medium mb-1">Work as role</h2>
        <p className="text-xs text-neutral-400 mb-3">
          Switch the current session to a seat&rsquo;s permission level to see (and prove) the enforcement, guarded
          endpoints return 403 for roles without the permission. Switch back to Owner when done.
        </p>
        <div className="flex gap-2">
          {matrix.map((m) => (
            <button
              key={m.role}
              onClick={() => workAs(m.role)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                workingAs === m.role ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"
              }`}
            >
              {ROLE_LABELS[m.role]}
            </button>
          ))}
        </div>
        {workingAs !== "OWNER" && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-3">
            You are working as {ROLE_LABELS[workingAs]}, deleting, payments or settings changes will be refused until
            you switch back to Owner.
          </p>
        )}
      </div>
    </div>
  );
}
