"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ConditionField = { id: string; label: string; unit: string };
type TriggerDef = {
  id: string;
  label: string;
  description: string;
  conditionFields: ConditionField[];
  actions: { type: string; label: string; templateKey: string | null }[];
};
type Condition = { field: string; op: "gte" | "lte" | "eq"; value: number };
type Action = { type: string; templateKey?: string; value?: string; subject?: string; body?: string };
type Step = { delayDays: number; actions: Action[] };
type Run = { id: string; targetLabel: string; status: string; step: number; detail: string; createdAt: string };

const CUSTOM_DEFAULT = {
  subject: "A note from {{business_name}}",
  body: "Hi {{client_name}},\n\n\n\n{{business_name}}",
};
type Automation = {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  steps: Step[];
  active: boolean;
  runs: Run[];
};

const OPS = [
  { id: "gte", label: "is at least" },
  { id: "lte", label: "is at most" },
  { id: "eq", label: "equals" },
] as const;

type Draft = {
  id: string | null;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  steps: Step[];
};

function newAction(t: TriggerDef["actions"][number]): Action {
  return {
    type: t.type,
    templateKey: t.templateKey ?? undefined,
    value: t.type === "TAG_CONTACT" ? "follow-up" : undefined,
    ...(t.type === "SEND_CUSTOM_EMAIL" ? CUSTOM_DEFAULT : {}),
  };
}

// Action checklist used by the first step and by every follow up step.
function ActionsEditor({
  trig,
  actions,
  onChange,
}: {
  trig: TriggerDef | undefined;
  actions: Action[];
  onChange: (next: Action[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {trig?.actions.map((t) => {
        const selected = actions.find((a) => a.type === t.type);
        const patch = (p: Partial<Action>) => onChange(actions.map((a) => (a.type === t.type ? { ...a, ...p } : a)));
        return (
          <div key={t.type}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!selected}
                onChange={() => onChange(selected ? actions.filter((a) => a.type !== t.type) : [...actions, newAction(t)])}
              />
              {t.label}
            </label>
            {selected && t.type === "TAG_CONTACT" && (
              <input
                className="input !w-56 mt-1 ml-6"
                value={selected.value ?? ""}
                placeholder="Tag, e.g. follow-up"
                onChange={(e) => patch({ value: e.target.value })}
              />
            )}
            {selected && t.type === "SEND_CUSTOM_EMAIL" && (
              <div className="ml-6 mt-1 space-y-1.5">
                <input className="input" value={selected.subject ?? ""} placeholder="Subject" onChange={(e) => patch({ subject: e.target.value })} />
                <textarea className="input min-h-[90px]" value={selected.body ?? ""} placeholder="Email body" onChange={(e) => patch({ body: e.target.value })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AutomationsClient({
  triggers,
  automations,
}: {
  triggers: TriggerDef[];
  automations: Automation[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState("");
  const [logFor, setLogFor] = useState<string | null>(null);

  const triggerDef = (id: string) => triggers.find((t) => t.id === id);

  function newDraft() {
    const t = triggers[0];
    setDraft({
      id: null,
      name: "",
      trigger: t.id,
      conditions: [{ field: t.conditionFields[0].id, op: "gte", value: 3 }],
      actions: [newAction(t.actions[0])],
      steps: [],
    });
    setError("");
  }

  function editDraft(a: Automation) {
    setDraft({ id: a.id, name: a.name, trigger: a.trigger, conditions: a.conditions, actions: a.actions, steps: a.steps ?? [] });
    setError("");
  }

  function setTrigger(id: string) {
    if (!draft) return;
    const t = triggerDef(id)!;
    setDraft({
      ...draft,
      trigger: id,
      conditions: [{ field: t.conditionFields[0].id, op: "gte", value: 3 }],
      actions: [newAction(t.actions[0])],
      steps: [],
    });
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    const res = await fetch(draft.id ? `/api/automations/${draft.id}` : "/api/automations", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        trigger: draft.trigger,
        conditions: draft.conditions,
        actions: draft.actions,
        steps: draft.steps,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not save");
    setDraft(null);
    router.refresh();
  }

  async function toggleActive(a: Automation) {
    await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this automation (and its run log)?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addPresets() {
    setRunResult("");
    const res = await fetch("/api/automations/presets", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setRunResult(res.ok ? `Added ${json.added} preset reminder automation(s).` : json.error || "Could not add presets");
    router.refresh();
  }

  async function addSequences() {
    setRunResult("");
    const res = await fetch("/api/automations/sequences", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setRunResult(res.ok ? `Added ${json.added} marketing sequence(s).` : json.error || "Could not add sequences");
    router.refresh();
  }

  async function runNow() {
    setRunning(true);
    setRunResult("");
    const res = await fetch("/api/automations/run", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setRunning(false);
    if (!res.ok) return setRunResult(json.error || "Run failed");
    const total = (json.summaries ?? []).reduce(
      (s: { checked: number; fired: number; steps: number }, x: { checked: number; fired: number; stepsFired?: number }) => ({
        checked: s.checked + x.checked,
        fired: s.fired + x.fired,
        steps: s.steps + (x.stepsFired ?? 0),
      }),
      { checked: 0, fired: 0, steps: 0 }
    );
    setRunResult(`Checked ${total.checked} target(s), started ${total.fired} rule(s), fired ${total.steps} follow up step(s).`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-neutral-500 max-w-xl">
          If-this-then-that rules with conditions, evaluated whenever this page loads, on demand, and by the scheduler
          when one is connected. Each rule starts once per matching target, then its follow up steps fire in order after
          their delays, stopping if the target no longer qualifies. Everything lands in the run log and the Inbox email
          log. Emails are delivered when an email service is connected in Settings, otherwise they are logged only.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary" onClick={addPresets}>
            + Preset reminders
          </button>
          <button className="btn-secondary" onClick={addSequences}>
            + Marketing sequences
          </button>
          <button className="btn-secondary" onClick={runNow} disabled={running}>
            {running ? "Running…" : "▶ Run now"}
          </button>
          <button className="btn-primary" onClick={newDraft}>
            + New Automation
          </button>
        </div>
      </div>
      {runResult && <p className="text-sm text-green-700">{runResult}</p>}

      {automations.length === 0 && (
        <p className="text-sm text-neutral-400">
          No automations yet. Try: &ldquo;if an invoice is unpaid 3 days past due → send the reminder email&rdquo;.
        </p>
      )}

      <div className="space-y-4">
        {automations.map((a) => {
          const t = triggerDef(a.trigger);
          return (
            <div key={a.id} className={`card p-4 ${a.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    <span className="font-semibold uppercase tracking-wide text-[10px] text-neutral-400">When</span>{" "}
                    {t?.label ?? a.trigger}
                    {a.conditions.map((c, i) => {
                      const f = t?.conditionFields.find((x) => x.id === c.field);
                      return (
                        <span key={i}>
                          {" "}· {f?.label ?? c.field} {OPS.find((o) => o.id === c.op)?.label} {c.value}
                        </span>
                      );
                    })}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    <span className="font-semibold uppercase tracking-wide text-[10px] text-neutral-400">Then</span>{" "}
                    {a.actions
                      .map((act) => t?.actions.find((x) => x.type === act.type)?.label ?? act.type)
                      .join(" · ")}
                  </p>
                  {a.steps.map((st, i) => (
                    <p key={i} className="text-xs text-neutral-500 mt-0.5">
                      <span className="font-semibold uppercase tracking-wide text-[10px] text-neutral-400">
                        +{st.delayDays}d
                      </span>{" "}
                      {st.actions
                        .map((act) =>
                          act.type === "SEND_CUSTOM_EMAIL"
                            ? `Email "${act.subject}"`
                            : t?.actions.find((x) => x.type === act.type)?.label ?? act.type
                        )
                        .join(" · ")}
                    </p>
                  ))}
                  {a.steps.length > 0 && (
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {a.steps.length + 1} step sequence ·{" "}
                      {new Set(a.runs.map((r) => r.targetLabel)).size} target(s) in progress or done
                    </p>
                  )}
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <button className="underline text-neutral-500" onClick={() => setLogFor(logFor === a.id ? null : a.id)}>
                    Run log ({a.runs.length})
                  </button>
                  <button className="underline text-neutral-500" onClick={() => editDraft(a)}>
                    Edit
                  </button>
                  <button className="underline text-neutral-500" onClick={() => toggleActive(a)}>
                    {a.active ? "Pause" : "Activate"}
                  </button>
                  <button className="underline text-red-500" onClick={() => remove(a.id)}>
                    Delete
                  </button>
                </div>
              </div>

              {logFor === a.id && (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  {a.runs.length === 0 ? (
                    <p className="text-xs text-neutral-400">No runs yet, the conditions haven&rsquo;t matched anything.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-neutral-400 uppercase tracking-wide">
                          <th className="py-1 font-medium">Target</th>
                          <th className="py-1 font-medium">Step</th>
                          <th className="py-1 font-medium">What happened</th>
                          <th className="py-1 font-medium text-right">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {a.runs.map((r) => (
                          <tr key={r.id}>
                            <td className="py-1.5 pr-3 font-medium">{r.targetLabel}</td>
                            <td className="py-1.5 pr-3 text-neutral-500 whitespace-nowrap">{r.step + 1}</td>
                            <td className="py-1.5 pr-3 text-neutral-600">{r.detail}</td>
                            <td className="py-1.5 text-right text-neutral-400 whitespace-nowrap">
                              {new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveDraft} className="bg-white rounded-lg p-6 w-full max-w-xl space-y-4 my-8">
            <h3 className="font-display text-lg">{draft.id ? "Edit automation" : "New automation"}</h3>
            <div>
              <label className="label">Name</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Unpaid invoice reminder" required autoFocus />
            </div>

            <div>
              <label className="label">Trigger (when…)</label>
              <select className="input" value={draft.trigger} onChange={(e) => setTrigger(e.target.value)} disabled={!!draft.id}>
                {triggers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-400 mt-1">{triggerDef(draft.trigger)?.description}</p>
            </div>

            <div>
              <label className="label">Conditions (all must match)</label>
              <div className="space-y-2">
                {draft.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      className="input flex-1"
                      value={c.field}
                      onChange={(e) =>
                        setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })
                      }
                    >
                      {triggerDef(draft.trigger)?.conditionFields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input !w-32"
                      value={c.op}
                      onChange={(e) =>
                        setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as Condition["op"] } : x)) })
                      }
                    >
                      {OPS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input !w-20"
                      inputMode="numeric"
                      value={c.value}
                      onChange={(e) =>
                        setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)) })
                      }
                    />
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-red-500"
                      onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs underline text-neutral-500 mt-2"
                onClick={() => {
                  const f = triggerDef(draft.trigger)!.conditionFields[0];
                  setDraft({ ...draft, conditions: [...draft.conditions, { field: f.id, op: "gte", value: 1 }] });
                }}
              >
                + Add condition
              </button>
            </div>

            <div>
              <label className="label">Actions (then…)</label>
              <ActionsEditor
                trig={triggerDef(draft.trigger)}
                actions={draft.actions}
                onChange={(next) => setDraft({ ...draft, actions: next })}
              />
              <p className="text-xs text-neutral-400 mt-2">
                Email actions use your customizable templates (Settings → Email Templates). Custom emails accept smart
                fields such as {"{{client_name}}"}, {"{{gallery_link}}"} and {"{{business_name}}"}.
              </p>
            </div>

            <div>
              <label className="label">Follow up steps (sequence)</label>
              <div className="space-y-3">
                {draft.steps.map((st, i) => (
                  <div key={i} className="border border-neutral-200 rounded p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Step {i + 2}:</span> wait
                      <input
                        className="input !w-20"
                        inputMode="numeric"
                        value={st.delayDays}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            steps: draft.steps.map((x, j) => (j === i ? { ...x, delayDays: Math.max(0, Number(e.target.value) || 0) } : x)),
                          })
                        }
                      />
                      day(s) after step {i + 1}, then
                      <button
                        type="button"
                        className="ml-auto text-neutral-400 hover:text-red-500"
                        onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>
                    <ActionsEditor
                      trig={triggerDef(draft.trigger)}
                      actions={st.actions}
                      onChange={(next) => setDraft({ ...draft, steps: draft.steps.map((x, j) => (j === i ? { ...x, actions: next } : x)) })}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs underline text-neutral-500 mt-2"
                onClick={() => {
                  const custom = triggerDef(draft.trigger)!.actions.find((x) => x.type === "SEND_CUSTOM_EMAIL")!;
                  setDraft({ ...draft, steps: [...draft.steps, { delayDays: 3, actions: [newAction(custom)] }] });
                }}
              >
                + Add follow up step
              </button>
              <p className="text-xs text-neutral-400 mt-1">
                Steps fire in order, each after its delay, once per target. A target that stops qualifying (paid, signed,
                accepted) leaves the sequence.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn-primary">{draft.id ? "Save" : "Create automation"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
