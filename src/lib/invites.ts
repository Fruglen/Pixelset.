import { db } from "./db";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { logActivity } from "./activity";
import { DOWNLOAD_SIZES } from "./design";

// Phase 5B: branded gallery invites (HTML with cover preview, personal
// message, download instructions), reusable invite templates with smart
// fields, bulk sending with per recipient personalisation, and scheduled
// sending processed lazily whenever the dashboard is used.

export const INVITE_TOKENS = [
  "{client_name}",
  "{gallery_name}",
  "{gallery_link}",
  "{business_name}",
  "{gallery_password}",
  "{download_pin}",
  "{expiry_date}",
];

export const DEFAULT_INVITE_SUBJECT = "{business_name} shared a gallery with you: {gallery_name}";
export const DEFAULT_INVITE_BODY = `Hi {client_name},

Your gallery "{gallery_name}" is ready to view. You can favorite the photos you love, leave comments, and download images where enabled.

{gallery_link}

{business_name}`;

type CollectionForInvite = {
  id: string;
  slug: string;
  name: string;
  password: string;
  downloadEnabled: boolean;
  pinEnabled: boolean;
  downloadPin: string;
  downloadSizes: string;
  expiresAt: Date | null;
  coverPhotoId: string | null;
  coverImageUrl: string;
  userId: string;
};

export function renderInviteText(
  tpl: string,
  c: CollectionForInvite,
  businessName: string,
  recipientName: string
): string {
  const values: Record<string, string> = {
    "{client_name}": recipientName || "there",
    "{gallery_name}": c.name,
    "{gallery_link}": absoluteUrl(`/g/${c.slug}`),
    "{business_name}": businessName,
    "{gallery_password}": c.password || "(no password needed)",
    "{download_pin}": c.pinEnabled ? c.downloadPin : "(no PIN needed)",
    "{expiry_date}": c.expiresAt ? c.expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "(no expiry)",
  };
  return Object.entries(values).reduce((s, [k, v]) => s.split(k).join(v), tpl);
}

function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function coverUrlFor(c: CollectionForInvite): Promise<string> {
  if (c.coverImageUrl) return absoluteUrl(c.coverImageUrl);
  const photo = c.coverPhotoId
    ? await db.photo.findUnique({ where: { id: c.coverPhotoId } })
    : await db.photo.findFirst({ where: { collectionId: c.id, isPrivate: false, mediaType: "IMAGE" }, orderBy: { order: "asc" } });
  if (!photo) return "";
  const src = photo.mediaType === "IMAGE" ? photo.url : photo.posterUrl;
  return src ? absoluteUrl(src) : "";
}

export function downloadInstructions(c: CollectionForInvite): string {
  if (!c.downloadEnabled) return "Downloads are not enabled for this gallery.";
  const sizes = c.downloadSizes
    .split(",")
    .map((id) => DOWNLOAD_SIZES.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(", ");
  const pin = c.pinEnabled ? " A 4 digit download PIN is required, your photographer will share it with you." : "";
  return `To download, open a photo and press Download, or use Download All at the top of the gallery. Sizes offered: ${sizes}.${pin}`;
}

export async function buildInviteEmail(
  c: CollectionForInvite,
  businessName: string,
  subjectTpl: string,
  bodyTpl: string,
  recipientName: string
) {
  const subject = renderInviteText(subjectTpl || DEFAULT_INVITE_SUBJECT, c, businessName, recipientName);
  const body = renderInviteText(bodyTpl || DEFAULT_INVITE_BODY, c, businessName, recipientName);
  const instructions = downloadInstructions(c);
  const link = absoluteUrl(`/g/${c.slug}`);
  const cover = await coverUrlFor(c);
  const text = `${body}\n\n${instructions}${c.password ? "\n\nThis gallery is password protected." : ""}`;
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const html = `<div style="background:#f5f3f0;padding:32px 12px;font-family:Georgia,'Times New Roman',serif;color:#1c1c1c;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;">
    ${cover ? `<a href="${link}"><img src="${cover}" alt="${esc(c.name)}" style="display:block;width:100%;max-height:360px;object-fit:cover;"/></a>` : ""}
    <div style="padding:28px 32px;">
      <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8a7357;margin:0 0 8px;">${esc(businessName)}</p>
      <h1 style="font-weight:normal;font-size:26px;margin:0 0 18px;">${esc(c.name)}</h1>
      <div style="font-size:15px;line-height:1.6;">${paragraphs}</div>
      <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;border:1px solid #1c1c1c;padding:10px 22px;color:#1c1c1c;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;">View Gallery</a></p>
      <p style="font-size:12px;color:#6b6b6b;line-height:1.5;margin:0;">${esc(instructions)}${c.password ? " This gallery is password protected." : ""}</p>
    </div>
  </div>
</div>`;
  return { subject, text, html };
}

/** Send one invite now and record the outcome on the Invite row + Activities. */
export async function deliverInvite(inviteId: string) {
  const invite = await db.invite.findUnique({ where: { id: inviteId }, include: { collection: { include: { user: true } } } });
  if (!invite) return null;
  const c = invite.collection;
  const businessName = c.user.businessName || c.user.name;
  const [subjectTpl, bodyTpl] = [invite.subject || DEFAULT_INVITE_SUBJECT, invite.message || DEFAULT_INVITE_BODY];
  const name = invite.recipientName;
  const email = await buildInviteEmail(c, businessName, subjectTpl, bodyTpl, name);
  const mail = await sendMail({ userId: c.userId, to: invite.email, subject: email.subject, text: email.text, html: email.html });
  const note = deliveryNote(mail);
  await db.invite.update({
    where: { id: invite.id },
    data: { status: mail.error ? "FAILED" : "SENT", sentAt: new Date(), deliveryNote: note },
  });
  await logActivity(c.id, "INVITE_SENT", `Invite email to ${invite.email} (${note})`, invite.email);
  return mail;
}

/** Lazily send every scheduled invite whose time has come. */
export async function processScheduledInvites(userId?: string) {
  const due = await db.invite.findMany({
    where: { status: "SCHEDULED", sendAt: { lte: new Date() }, ...(userId ? { collection: { userId } } : {}) },
    select: { id: true },
    take: 200,
  });
  for (const d of due) await deliverInvite(d.id);
  return due.length;
}
