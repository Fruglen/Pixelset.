import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logStudioMessage } from "@/lib/studio";
import { upsertContact } from "@/lib/contact-sync";
import { notify } from "@/lib/notify";

// Phase 5B: public lead form submission. Creates or updates the contact (as a
// lead), logs the message to the Studio inbox, opens an Inquiry project card
// when the form is set to, and notifies the photographer.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const form = await db.leadForm.findUnique({ where: { token: params.token } });
  if (!form || !form.active) return NextResponse.json({ error: "This form is not accepting submissions." }, { status: 404 });
  const body = await req.json();
  if (typeof body.website === "string" && body.website) return NextResponse.json({ ok: true }); // honeypot
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 50) : "";
  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const fields = JSON.parse(form.fields || "[]") as { id: string; label: string; required: boolean }[];
  const answers: { label: string; value: string }[] = [];
  for (const f of fields) {
    const v = body.answers?.[f.id];
    if (typeof v === "string" && v.trim()) answers.push({ label: f.label, value: v.trim().slice(0, 4000) });
    else if (f.required) return NextResponse.json({ error: `Please answer: ${f.label}` }, { status: 400 });
  }

  const contact = await upsertContact(form.userId, email, name, "LEAD_FORM", { phone, tag: "lead form" });
  await logStudioMessage(form.userId, {
    kind: "LEAD",
    name,
    email,
    subject: `${form.name}: ${name}`,
    body: answers.map((a) => `${a.label}\n${a.value}`).join("\n\n") || "(no answers)",
    meta: [phone ? `Phone ${phone}` : "", `Lead form ${form.name}`].filter(Boolean).join(" · "),
    read: false,
  });
  if (form.createProject && contact) {
    const max = await db.project.aggregate({ where: { userId: form.userId, stage: "INQUIRY" }, _max: { order: true } });
    await db.project.create({
      data: {
        userId: form.userId,
        name: `${name}, ${answers[0]?.value ?? form.name}`.slice(0, 120),
        contactId: contact.id,
        stage: "INQUIRY",
        order: (max._max.order ?? 0) + 1,
        notes: answers.map((a) => `${a.label}: ${a.value}`).join("\n"),
      },
    });
  }
  await db.leadForm.update({ where: { id: form.id }, data: { submissions: { increment: 1 } } });
  await notify(form.userId, "FORM_SUBMISSION", `New inquiry from ${name}`, form.name, "/studio/inbox");
  return NextResponse.json({ ok: true, thanks: form.thanks });
}
