import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/team";
import AcceptClient from "./accept-client";

export const dynamic = "force-dynamic";

// Team invite landing: the member sets their password and is signed straight
// in with their role. Expired or used links say so plainly.
export default async function TeamAcceptPage({ params }: { params: { token: string } }) {
  const member = await db.teamMember.findUnique({
    where: { inviteToken: params.token },
    include: { user: true },
  });
  if (!member) notFound();
  const studio = member.user.businessName || member.user.name;
  const expired = Boolean(member.loginUserId) || !member.inviteExpiresAt || member.inviteExpiresAt < new Date();
  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4 py-12 text-ink">
      <div className="w-full max-w-md">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{studio}</p>
        <h1 className="font-display text-2xl text-center">Join the studio team</h1>
        {expired ? (
          <p className="text-sm text-neutral-600 text-center mt-4">
            This invite link is no longer valid. Ask {studio} to send a fresh invite from Settings, Team.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-600 text-center mt-3">
              Hi {member.name}, you are joining as {ROLE_LABELS[member.role] ?? member.role}. Set a password for
              your own sign-in ({member.email}).
            </p>
            <AcceptClient token={params.token} />
          </>
        )}
      </div>
    </div>
  );
}
