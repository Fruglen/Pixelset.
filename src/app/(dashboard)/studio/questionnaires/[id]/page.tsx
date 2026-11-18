import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuestionnaireBuilder } from "./questionnaire-builder";

export const dynamic = "force-dynamic";

export default async function QuestionnaireEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const q = await db.questionnaire.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      responses: { include: { booking: true }, orderBy: { createdAt: "desc" } },
      sessionTypes: { select: { id: true, name: true } },
    },
  });
  if (!q) notFound();

  const fields = JSON.parse(q.fields || "[]") as {
    id: string;
    type: string;
    label: string;
    options: string;
    required: boolean;
  }[];

  return (
    <QuestionnaireBuilder
      questionnaire={{ id: q.id, name: q.name, fields }}
      sessionTypes={q.sessionTypes}
      responses={q.responses.map((r) => ({
        id: r.id,
        name: r.respondentName,
        email: r.respondentEmail,
        bookingTitle: r.booking?.title ?? "",
        createdAt: r.createdAt.toISOString(),
        answers: JSON.parse(r.answers || "{}") as Record<string, string>,
      }))}
    />
  );
}
