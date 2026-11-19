import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resendConnected, sendMail } from "@/lib/mailer";

// Phase 5A, "Send test email" button in Settings. Sends to the account email
// and reports success or the provider error verbatim.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!resendConnected()) {
    return NextResponse.json(
      { error: "Resend is not connected. Set RESEND_API_KEY in the environment to enable email sending." },
      { status: 400 }
    );
  }
  const result = await sendMail({
    userId: user.id,
    to: user.email,
    subject: "Pixora test email",
    text: `Hi ${user.name},

This is a test email from your Pixora account. Email sending through Resend is working.

If you received this, gallery invites, booking confirmations, invoices, and all other app emails will be delivered for real.`,
  });
  if (!result.sent) {
    return NextResponse.json({ error: result.error || "The provider did not accept the message" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to: user.email, resendId: result.id ?? null });
}
