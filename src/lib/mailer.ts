import { Resend } from "resend";
import { db } from "./db";

// Phase 5A, real email sending through Resend.
//
// Every email the app produces goes through sendMail(). When RESEND_API_KEY is
// set, the message is delivered through the Resend API; when it is absent, the
// call is a no-op ({ sent: false }) and the caller keeps its existing behavior
// of logging the message to the inbox/activities, so the app never breaks.

export interface MailResult {
  sent: boolean;
  id?: string; // the provider's message id on a real send (proof of delivery hand-off)
  error?: string; // provider or validation error, verbatim, when a real send failed
}

export function resendConnected(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function defaultFrom(): string {
  return process.env.MAIL_FROM || "Pixora <onboarding@resend.dev>";
}

/** Base URL used to build absolute links inside real emails. */
export function appBaseUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${appBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Effective from address for a user: their stored override, else env/default. */
export async function fromFor(userId?: string): Promise<string> {
  if (userId) {
    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { mailFrom: true } });
      if (user?.mailFrom) return user.mailFrom;
    } catch {
      // fall through to default
    }
  }
  return defaultFrom();
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1c1c1c;">$1</a>'
  );
  return `<div style="font-family: Georgia, 'Times New Roman', serif; color: #1c1c1c; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">${withLinks
    .split(/\n\n+/)
    .map((p) => `<p style="margin: 0 0 16px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("")}</div>`;
}

export async function sendMail(opts: {
  userId?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false }; // logged-only mode, by design
  const to = (opts.to || "").trim();
  if (!to || !to.includes("@")) {
    return { sent: false, error: `No valid recipient address ("${opts.to}")` };
  }
  try {
    const resend = new Resend(key);
    const from = opts.from || (await fromFor(opts.userId));
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html || textToHtml(opts.text),
    });
    if (error) return { sent: false, error: `${error.name}: ${error.message}` };
    return { sent: true, id: data?.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Honest one-line delivery status for log records (StudioMessage meta,
 * Activity detail). Keeps the UI truthful about what actually happened.
 */
export function deliveryNote(result: MailResult): string {
  if (result.sent) return result.id ? `Delivered via Resend (id ${result.id})` : "Delivered via Resend";
  if (result.error) return `Email send failed: ${result.error}`;
  return "Logged only, no email service connected";
}
