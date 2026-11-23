import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { sendStudioEmail } from "@/lib/studio-flow";
import { resendConnected } from "@/lib/mailer";

// Phase 5B: send an email from the Studio inbox (new message or reply). Goes
// through the shared mailer: delivered via Resend when connected, otherwise
// logged only, and the UI says which.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!/.+@.+\..+/.test(to)) return NextResponse.json({ error: "Enter a valid recipient email" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Add a subject" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write a message" }, { status: 400 });
  // Night build: attachments uploaded via /api/studio/messages/attachments
  // travel as links in the email and stay on the logged inbox copy.
  const rawAtts: unknown[] = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments = rawAtts
    .filter((a): a is { name: string; url: string } => {
      if (!a || typeof a !== "object") return false;
      const o = a as Record<string, unknown>;
      return typeof o.name === "string" && typeof o.url === "string" && (o.url.startsWith("/uploads/inbox/") || o.url.startsWith("/media/uploads/inbox/"));
    })
    .slice(0, 10)
    .map((a) => ({ name: a.name.slice(0, 160), url: a.url }));
  let fullText = text.slice(0, 20000);
  if (attachments.length) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "";
    fullText += `\n\nAttachments:\n${attachments.map((a) => `Attachment: ${a.name} - ${origin}${a.url}`).join("\n")}`;
  }
  const note = await sendStudioEmail(user.id, { email: to, name: typeof body.name === "string" ? body.name : "" }, subject, fullText, "Sent from inbox");
  return NextResponse.json({ ok: true, delivered: resendConnected() && note.startsWith("Delivered"), note });
}
