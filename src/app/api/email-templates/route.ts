import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { defaultTemplate } from "@/lib/emails";
import { permissionError } from "@/lib/team";

// Upsert a customized reminder-email template, or reset one to default.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const key = String(body.key ?? "");
  if (!defaultTemplate(key)) return NextResponse.json({ error: "Unknown template" }, { status: 400 });

  if (body.reset === true) {
    await db.emailTemplate.deleteMany({ where: { userId: user.id, key } });
    const def = defaultTemplate(key)!;
    return NextResponse.json({ ok: true, subject: def.subject, body: def.body });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const templateBody = typeof body.body === "string" ? body.body : "";
  if (!subject || !templateBody.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  await db.emailTemplate.upsert({
    where: { userId_key: { userId: user.id, key } },
    create: { userId: user.id, key, subject, body: templateBody },
    update: { subject, body: templateBody },
  });
  return NextResponse.json({ ok: true });
}
