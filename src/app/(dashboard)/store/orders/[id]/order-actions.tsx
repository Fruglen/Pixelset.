"use client";

import { useRouter } from "next/navigation";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"];

export default function OrderActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function setStatus(next: string) {
    const res = await fetch(`/api/store/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "Could not update");
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    const res = await fetch(`/api/store/orders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not delete");
    }
    router.push("/store/orders");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button className="btn-danger" onClick={remove}>
        Delete
      </button>
    </div>
  );
}
