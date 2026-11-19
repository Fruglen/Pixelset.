import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logStudioMessage } from "@/lib/studio";
import { notify } from "@/lib/notify";

// Night build: autosave. A draft is a QuestionnaireResponse whose answers
// JSON carries "__draft": true, linked from the request. The same link works
// on any device, so a client can start on their phone and finish on a laptop.
async function loadDraft(requestId: string, responseId: string) {
  if (!responseId) return null;
  const resp = await db.questionnaireResponse.findUnique({ where: { id: responseId } });
  if (!resp) return null;
  try {
    const parsed = JSON.parse(resp.answers || "{}") as Record<string, unknown>;
    if (parsed.__draft !== true) return null;
    return { resp, parsed };
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const r = await db.questionnaireRequest.findUnique({ where: { token: params.token } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.completedAt) return NextResponse.json({ completed: true, answers: {} });
  const draft = await loadDraft(r.id, r.responseId);
  if (!draft) return NextResponse.json({ completed: false, answers: {} });
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft.parsed)) {
    if (k !== "__draft" && typeof v === "string") answers[k] = v;
  }
  return NextResponse.json({ completed: false, answers, savedAt: draft.resp.createdAt });
}

// Phase 5B: public submission for a sent questionnaire (including post delivery
// feedback with an optional testimonial permission).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await db.questionnaireRequest.findUnique({ where: { token: params.token } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.completedAt) return NextResponse.json({ error: "These answers were already submitted, thank you." }, { status: 400 });
  const q = await db.questionnaire.findUnique({ where: { id: r.questionnaireId } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const fields = JSON.parse(q.fields || "[]") as { id: string; label: string; required: boolean }[];

  // Draft save: partial answers, no required-field validation.
  if (body.draft === true) {
    const stored: Record<string, unknown> = { __draft: true };
    for (const f of fields) {
      const v = body.answers?.[f.id];
      if (typeof v === "string" && v.trim()) stored[f.id] = v.slice(0, 4000);
    }
    const existing = await loadDraft(r.id, r.responseId);
    if (existing) {
      await db.questionnaireResponse.update({ where: { id: existing.resp.id }, data: { answers: JSON.stringify(stored) } });
      return NextResponse.json({ ok: true, draft: true });
    }
    const created = await db.questionnaireResponse.create({
      data: {
        questionnaireId: q.id,
        contactId: r.contactId,
        respondentName: r.name,
        respondentEmail: r.email,
        answers: JSON.stringify(stored),
      },
    });
    await db.questionnaireRequest.update({ where: { id: r.id }, data: { responseId: created.id } });
    return NextResponse.json({ ok: true, draft: true });
  }

  const answers: Record<string, string> = {};
  for (const f of fields) {
    const v = body.answers?.[f.id];
    if (typeof v === "string" && v.trim()) answers[f.id] = v.slice(0, 4000);
    else if (f.required) return NextResponse.json({ error: `Please answer: ${f.label}` }, { status: 400 });
  }
  const draft = await loadDraft(r.id, r.responseId);
  const response = draft
    ? await db.questionnaireResponse.update({
        where: { id: draft.resp.id },
        data: { answers: JSON.stringify(answers), testimonial: q.kind === "FEEDBACK" && body.testimonial === true },
      })
    : await db.questionnaireResponse.create({
        data: {
          questionnaireId: q.id,
          contactId: r.contactId,
          respondentName: r.name,
          respondentEmail: r.email,
          answers: JSON.stringify(answers),
          testimonial: q.kind === "FEEDBACK" && body.testimonial === true,
        },
      });
  await db.questionnaireRequest.update({ where: { id: r.id }, data: { completedAt: new Date(), responseId: response.id } });
  await notify(r.userId, "QUESTIONNAIRE_COMPLETED", `${r.name || r.email} completed ${q.name}`, q.kind === "FEEDBACK" ? "New feedback" : "", `/studio/questionnaires/${q.id}`);
  await logStudioMessage(r.userId, {
    kind: "QUESTIONNAIRE",
    name: r.name,
    email: r.email,
    subject: `${q.kind === "FEEDBACK" ? "Feedback received" : "Questionnaire completed"}: ${q.name}`,
    body: fields
      .filter((f) => answers[f.id])
      .map((f) => `${f.label}\n${answers[f.id]}`)
      .join("\n\n"),
  });
  return NextResponse.json({ ok: true });
}
