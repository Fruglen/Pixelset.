import { randomBytes } from "crypto";
import { db } from "./db";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { ROLE_LABELS } from "./team";

// Team member login invites. Inviting a member (or resending) stamps a fresh
// single-use token on the TeamMember row and emails the set-password link
// through the mailer. When email is not connected the send is logged only and
// the caller still gets the link, so the owner can share it by hand — the UI
// says which of the two happened.

export async function sendTeamInvite(memberId: string) {
  const member = await db.teamMember.findUnique({
    where: { id: memberId },
    include: { user: true },
  });
  if (!member) return null;
  const token = randomBytes(24).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await db.teamMember.update({
    where: { id: member.id },
    data: { inviteToken: token, inviteExpiresAt },
  });
  const link = absoluteUrl(`/team/accept/${token}`);
  const studio = member.user.businessName || member.user.name;
  const mail = await sendMail({
    userId: member.userId,
    to: member.email,
    subject: `You're invited to join ${studio} on Pixora`,
    text: `Hi ${member.name},\n\n${studio} invited you to join their Pixora studio as ${ROLE_LABELS[member.role] ?? member.role}.\n\nSet your password and sign in here:\n${link}\n\nThe link expires on ${inviteExpiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
  });
  return { link, emailed: mail.sent, note: deliveryNote(mail), expiresAt: inviteExpiresAt.toISOString() };
}
