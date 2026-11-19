"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SetupChecklist } from "@/lib/onboarding";

// Phase 5B platform: guided setup checklist card (Studio Manager and Website).
export function SetupChecklistCard({ list }: { list: SetupChecklist }) {
  const router = useRouter();
  const total = list.steps.length;
  async function call(body: Record<string, unknown>) {
    await fetch("/api/account/setup", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }
  if (list.dismissed) {
    return (
      <p className="text-xs text-neutral-400">
        Setup checklist hidden ({list.doneCount} of {total} done).{" "}
        <button className="underline" onClick={() => call({ show: list.id })}>
          Show it
        </button>
      </p>
    );
  }
  return (
    <section className="card p-5" data-setup={list.id}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg">{list.title}</h2>
          <p className="text-sm text-neutral-500">
            {list.doneCount === total ? "All done, you are fully set up." : `${list.doneCount} of ${total} steps done`}
          </p>
        </div>
        <button className="text-xs underline text-neutral-500 shrink-0" onClick={() => call({ dismiss: list.id })}>
          Hide
        </button>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full mt-3 overflow-hidden">
        <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${Math.round((list.doneCount / total) * 100)}%` }} />
      </div>
      <ol className="mt-4 space-y-2.5">
        {list.steps.map((s, i) => {
          const isNext = list.next?.key === s.key;
          return (
            <li key={s.key} className={`flex items-start gap-3 text-sm ${isNext ? "bg-neutral-50 -mx-2 px-2 py-2 rounded" : ""}`}>
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full grid place-items-center text-[11px] ${s.done ? "bg-emerald-600 text-white" : "border border-neutral-300 text-neutral-500"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <Link href={s.href} className={s.done ? "text-neutral-500 line-through" : "font-medium hover:underline"}>
                  {s.label}
                </Link>
                {!s.done ? <p className="text-xs text-neutral-500">{s.detail}</p> : null}
                {isNext ? (
                  <div className="mt-2 flex gap-3 items-center">
                    <Link href={s.href} className="btn-primary !py-1 !px-3 text-xs">
                      Start this step
                    </Link>
                    {list.id === "website" && s.key === "template" ? (
                      <button className="text-xs underline text-neutral-500" onClick={() => call({ keepTemplate: true })}>
                        Keep the current template
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
