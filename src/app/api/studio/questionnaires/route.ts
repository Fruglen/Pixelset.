import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { STUDIO_LIMITS, capMessage, planFor, tierLabel } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  // Night build (Pricing lane): Studio Manager Free plan cap, 3 questionnaires.
  {
    const plan = await planFor(user.id);
    const limit = STUDIO_LIMITS[plan.studio].questionnaires;
    if (Number.isFinite(limit)) {
      const count = await db.questionnaire.count({ where: { userId: user.id } });
      if (count >= limit) {
        return NextResponse.json({ error: capMessage("questionnaires", limit, tierLabel("studio", plan.studio)) }, { status: 403 });
      }
    }
  }
  // Phase 5B: FEEDBACK questionnaires collect post delivery reviews and testimonials.
  const feedback = body.kind === "FEEDBACK";
  const q = await db.questionnaire.create({
    data: {
      userId: user.id,
      name,
      kind: feedback ? "FEEDBACK" : "STANDARD",
      fields: JSON.stringify(feedback ? [
        { id: "rating", type: "choice", label: "How would you rate your experience?", options: "5 - Wonderful, 4 - Great, 3 - Good, 2 - Fair, 1 - Poor", required: true },
        { id: "loved", type: "textarea", label: "What did you love most?", options: "", required: false },
        { id: "testimonial", type: "textarea", label: "A few words we could share as a testimonial", options: "", required: false },
        { id: "improve", type: "textarea", label: "Anything we could do better?", options: "", required: false },
      ] : [
        { id: "f1", type: "text", label: "What is the occasion?", options: "", required: true },
        { id: "f2", type: "textarea", label: "Anything we should know beforehand?", options: "", required: false },
      ]),
    },
  });
  if (feedback && body.useAfterDelivery === true) {
    await db.studioProfile.updateMany({ where: { userId: user.id }, data: { feedbackQuestionnaireId: q.id } });
  }
  return NextResponse.json({ id: q.id });
}
