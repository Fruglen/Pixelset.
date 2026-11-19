import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logStudioMessage, upsertContact } from "@/lib/studio";
import { notify } from "@/lib/notify";

// Phase 5B: inbound email webhook for the Studio inbox.
//
// Point your email provider's inbound webhook (Resend inbound, Postmark,
// SendGrid Inbound Parse posting JSON, or any service that can POST JSON) at
//   POST /api/studio/inbound?secret=$INBOUND_EMAIL_SECRET
// (or send the secret in an "x-inbound-secret" header). Messages are routed to
// the photographer whose inbound address (inbox+<token>@$INBOUND_EMAIL_DOMAIN),
// business email, or from address appears in the To list. Without
// INBOUND_EMAIL_SECRET the route answers 503 "Not connected" and stores nothing.

function addresses(v: unknown): string[] {
  const list: string[] = [];
  const push = (x: unknown) => {
    if (typeof x === "string") {
      for (const part of x.split(",")) {
        const m = part.match(/<([^>]+)>/);
        const a = (m ? m[1] : part).trim().toLowerCase();
        if (a.includes("@")) list.push(a);
      }
    } else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      push(o.email ?? o.address ?? o.Email ?? "");
    }
  };
  if (Array.isArray(v)) v.forEach(push);
  else push(v);
  return list;
}

function displayName(v: unknown): string {
  if (typeof v === "string") {
    const m = v.match(/^\s*"?([^"<]+?)"?\s*</);
    return m ? m[1].trim() : "";
  }
  if (v && typeof v === "object") return String((v as Record<string, unknown>).name ?? "");
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, status: "Not connected", reason: "INBOUND_EMAIL_SECRET is not set" }, { status: 503 });
  }
  const given = req.headers.get("x-inbound-secret") ?? new URL(req.url).searchParams.get("secret");
  if (given !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  // Resend wraps the email in { type, data }; Postmark uses capitalised keys.
  const e = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
  const fromRaw = e.from ?? e.From ?? e.sender ?? "";
  const from = addresses(fromRaw)[0] ?? "";
  const fromName = displayName(fromRaw) || String(e.FromName ?? "");
  const to = [...addresses(e.to ?? e.To ?? ""), ...addresses(e.cc ?? e.Cc ?? "")];
  const subject = String(e.subject ?? e.Subject ?? "(no subject)").slice(0, 500);
  const text = String(e.text ?? e.TextBody ?? e.plain ?? "") || stripHtml(String(e.html ?? e.HtmlBody ?? ""));
  if (!from) return NextResponse.json({ error: "Missing sender address" }, { status: 400 });

  // Route to a photographer.
  const tokens = to.map((a) => a.match(/\+([a-z0-9]+)@/i)?.[1]).filter(Boolean) as string[];
  let profile = tokens.length ? await db.studioProfile.findFirst({ where: { inboundToken: { in: tokens } } }) : null;
  if (!profile && to.length) {
    profile = await db.studioProfile.findFirst({ where: { businessEmail: { in: to } } });
  }
  if (!profile && to.length) {
    const user = await db.user.findFirst({ where: { OR: [{ mailFrom: { in: to } }, { email: { in: to } }] } });
    if (user) profile = await db.studioProfile.findUnique({ where: { userId: user.id } });
  }
  if (!profile) return NextResponse.json({ error: "No studio matches the recipient address" }, { status: 404 });

  const contact = await upsertContact(profile.userId, { name: fromName || from, email: from });

  // Night build: inbound attachments. Providers send them as
  // { filename, content (base64), content_type } (Postmark style) or
  // { filename, download_url } (Resend style). Base64 payloads are saved with
  // the photographer's uploads; URLs are linked as they are.
  let bodyText = text.slice(0, 50000);
  const rawAtts = (e.attachments ?? e.Attachments ?? []) as Record<string, unknown>[];
  if (Array.isArray(rawAtts) && rawAtts.length) {
    const { mkdir, writeFile } = await import("fs/promises");
    const path = (await import("path")).default;
    const { randomBytes } = await import("crypto");
    const lines: string[] = [];
    for (const a of rawAtts.slice(0, 10)) {
      const name = String(a.filename ?? a.name ?? a.Filename ?? "attachment").slice(0, 160);
      const b64 = String(a.content ?? a.Content ?? "");
      const dl = String(a.download_url ?? a.downloadUrl ?? "");
      if (b64) {
        try {
          const buf = Buffer.from(b64, "base64");
          if (buf.length > 0 && buf.length <= 15 * 1024 * 1024) {
            const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-") || "attachment";
            const stored = `${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
            const dir = path.join(process.cwd(), "public", "uploads", "inbox", profile.userId);
            await mkdir(dir, { recursive: true });
            await writeFile(path.join(dir, stored), buf);
            lines.push(`Attachment: ${name} - /uploads/inbox/${profile.userId}/${stored}`);
            continue;
          }
        } catch {
          /* fall through to naming the file only */
        }
      }
      lines.push(dl ? `Attachment: ${name} - ${dl}` : `Attachment: ${name} (could not be stored)`);
    }
    if (lines.length) bodyText += `\n\nAttachments:\n${lines.join("\n")}`;
  }

  await logStudioMessage(profile.userId, {
    kind: "INBOUND",
    name: contact.name,
    email: from,
    subject,
    body: bodyText,
    meta: `Received by email · to ${to.join(", ")}`,
    read: false,
  });
  await notify(profile.userId, "MESSAGE", `New email from ${fromName || from}`, subject, "/studio/inbox");
  return NextResponse.json({ ok: true });
}
