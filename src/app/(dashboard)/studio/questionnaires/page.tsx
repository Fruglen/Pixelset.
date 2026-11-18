import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuestionnairesClient } from "./questionnaires-client";

export const dynamic = "force-dynamic";

export default async function QuestionnairesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const questionnaires = await db.questionnaire.findMany({
    where: { userId: user.id },
    include: { _count: { select: { responses: true, sessionTypes: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <QuestionnairesClient
      questionnaires={questionnaires.map((q) => ({
        id: q.id,
        name: q.name,
        fieldCount: (JSON.parse(q.fields || "[]") as unknown[]).length,
        responses: q._count.responses,
        sessionTypes: q._count.sessionTypes,
      }))}
    />
  );
}
