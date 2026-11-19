import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor } from "@/lib/plans";
import { clientIp } from "@/lib/ip-guard";
import { VOLUME_TIERS } from "@/lib/pricing";
import { IpAllowlistCard, SessionsCard, VolumeCard } from "./security-client";

export const dynamic = "force-dynamic";

// Night build (Pricing lane): account security settings. Home of the Studio
// Manager Volume plan features from the research: IP whitelisting (enforced
// at sign-in while a Volume plan is active), unlimited login sessions and
// no bandwidth restrictions (both already true for every account here).
export default async function SecuritySettingsPage() {
  const user = (await getCurrentUser())!;
  const plan = await planFor(user.id);
  const token = cookies().get("pxl_session")?.value;
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <VolumeCard initial={plan.billing.volume} options={VOLUME_TIERS} />
      <IpAllowlistCard
        initialEntries={plan.security.ipAllowlist}
        enforced={!!plan.billing.volume}
        currentIp={clientIp(headers())}
      />
      <SessionsCard
        sessions={sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          current: s.token === token,
        }))}
      />
    </div>
  );
}
