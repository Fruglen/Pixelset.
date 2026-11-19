import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runAutomations, TRIGGERS } from "@/lib/automations";
import AutomationsClient from "./automations-client";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const user = (await getCurrentUser())!;

  // Lazy evaluation on page load (no cron in this stack), same pattern as
  // scheduled contract sends. Each automation fires at most once per target.
  await runAutomations(user.id);

  const automations = await db.automation.findMany({
    where: { userId: user.id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 50 } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AutomationsClient
      triggers={TRIGGERS.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        conditionFields: t.conditionFields,
        actions: t.actions.map((a) => ({ type: a.type, label: a.label, templateKey: a.templateKey ?? null })),
      }))}
      automations={automations.map((a) => ({
        id: a.id,
        name: a.name,
        trigger: a.trigger,
        conditions: JSON.parse(a.conditions),
        actions: JSON.parse(a.actions),
        steps: JSON.parse(a.steps || "[]"),
        active: a.active,
        runs: a.runs.map((r) => ({
          id: r.id,
          targetLabel: r.targetLabel,
          status: r.status,
          step: r.step,
          detail: r.detail,
          createdAt: r.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
