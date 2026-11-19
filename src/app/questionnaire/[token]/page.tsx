import { notFound } from "next/navigation";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { QuestionnaireForm } from "./questionnaire-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questionnaire" };

export default async function PublicQuestionnairePage({ params }: { params: { token: string } }) {
  const r = await db.questionnaireRequest.findUnique({ where: { token: params.token } });
  if (!r) notFound();
  const q = await db.questionnaire.findUnique({ where: { id: r.questionnaireId } });
  const user = await db.user.findUnique({ where: { id: r.userId } });
  if (!q || !user) notFound();
  const fields = JSON.parse(q.fields || "[]") as { id: string; type: string; label: string; options: string; required: boolean }[];
  const brand = await brandFor(user.id);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-12 px-4 branded" style={brandVars(brand)}>
      <div className="max-w-xl mx-auto">
        <div className="mb-3"><BrandMark brand={brand} /></div>
        <h1 className="font-display text-2xl text-center mb-8">{q.name}</h1>
        {r.completedAt ? (
          <p className="card p-6 text-center text-sm text-neutral-600">Thank you, your answers were received.</p>
        ) : (
          <QuestionnaireForm token={params.token} fields={fields} feedback={q.kind === "FEEDBACK"} greeting={r.name} />
        )}
      </div>
    </div>
  );
}
