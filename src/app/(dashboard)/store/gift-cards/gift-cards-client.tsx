"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { CreditCardIcon } from "@/components/icons";

type Card = {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  active: boolean;
  recipient: string;
};

export default function GiftCardsClient({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState("50");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/store/gift-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: Math.round(parseFloat(amount || "0") * 100), recipient }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create");
    setCreating(false);
    setRecipient("");
    router.refresh();
  }

  async function toggle(c: Card) {
    await fetch(`/api/store/gift-cards/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this gift card?")) return;
    const res = await fetch(`/api/store/gift-cards/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not delete");
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">
          Fixed-value credit redeemable at gallery checkout. Share the code with the recipient.
        </p>
        <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
          + Issue Gift Card
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Amount $</label>
            <input className="input !w-32" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="flex-1 min-w-48">
            <label className="label">Recipient (optional)</label>
            <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Emma James, wedding gift" />
          </div>
          {error && <p className="text-sm text-red-600 w-full">{error}</p>}
          <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
            Cancel
          </button>
          <button className="btn-primary">Issue</button>
        </form>
      )}

      {cards.length === 0 ? (
        <EmptyState icon={CreditCardIcon} line="No gift cards issued yet. Issue one and it can be spent in any of your gallery stores.">
          <button className="btn-primary mt-5" onClick={() => setCreating(true)}>
            Issue gift card
          </button>
        </EmptyState>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {cards.map((c) => (
            <div key={c.id} className={`flex items-center gap-4 px-4 py-3 ${c.active ? "" : "opacity-50"}`}>
              <code className="text-sm font-mono bg-neutral-100 rounded px-2 py-1">{c.code}</code>
              <div className="flex-1 text-sm">
                <span className="font-medium">${(c.balanceCents / 100).toFixed(2)}</span>
                <span className="text-neutral-500"> of ${(c.initialCents / 100).toFixed(2)} remaining</span>
                {c.recipient && <span className="text-neutral-500"> · {c.recipient}</span>}
              </div>
              <button className="text-xs underline text-neutral-500" onClick={() => toggle(c)}>
                {c.active ? "Deactivate" : "Activate"}
              </button>
              <button className="text-xs underline text-red-500" onClick={() => remove(c.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
