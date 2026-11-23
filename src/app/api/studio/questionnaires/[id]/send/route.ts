import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { sendQuestionnaireRequest } from "@/lib/studio-flow";
import { upsertContact } from "@/lib/studio";

// Phase 5B: send a questionnaire to a client as its own link (tracked as a
// request, so incomplete ones can be reminded by the automation).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const q = await db.questionnaire.findFirst({ where: { id: params.id, userId: user.id } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  let contact = null;
  if (typeof body.contactId === "string" && body.contactId) {
    contact = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
  } else if (typeof body.email === "string" && /.+@.+\..+/.test(body.email)) {
    contact = await upsertContact(user.id, { name: String(body.name ?? "").trim() || body.email, email: body.email });
  }
  if (!contact?.email) return NextResponse.json({ error: "Pick a contact with an email address" }, { status: 400 });
  const out = await sendQuestionnaireRequest({ userId: user.id, questionnaireId: q.id, email: contact.email, name: contact.name, contactId: contact.id });
  if (!out) return NextResponse.json({ error: "Could not send" }, { status: 400 });
  return NextResponse.json({ ok: true, link: `/questionnaire/${out.request.token}`, delivery: out.note });
}
