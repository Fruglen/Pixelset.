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

  const [profile, contacts, requests] = await Promise.all([
    db.studioProfile.findUnique({ where: { userId: user.id } }),
    db.contact.findMany({ where: { userId: user.id, email: { not: "" } }, orderBy: { name: "asc" } }),
    db.questionnaireRequest.findMany({ where: { questionnaireId: q.id }, orderBy: { sentAt: "desc" } }),
  ]);

  const fields = JSON.parse(q.fields || "[]") as {
    id: string;
    type: string;
    label: string;
    options: string;
    required: boolean;
  }[];

  return (
    <QuestionnaireBuilder
      questionnaire={{ id: q.id, name: q.name, fields, kind: q.kind, afterDelivery: profile?.feedbackQuestionnaireId === q.id }}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name, email: c.email }))}
      requests={requests.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        token: r.token,
        reason: r.reason,
        sentAt: r.sentAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? "",
        started: !r.completedAt && !!r.responseId,
      }))}
      sessionTypes={q.sessionTypes}
      responses={q.responses.map((r) => {
        const raw = JSON.parse(r.answers || "{}") as Record<string, unknown>;
        const draft = raw.__draft === true;
        const answers: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (k !== "__draft" && typeof v === "string") answers[k] = v;
        }
        return {
          id: r.id,
          name: r.respondentName,
          email: r.respondentEmail,
          bookingTitle: r.booking?.title ?? "",
          createdAt: r.createdAt.toISOString(),
          answers,
          testimonial: r.testimonial,
          draft,
        };
      })}
    />
  );
}
