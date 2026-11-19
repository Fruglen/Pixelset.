import { getCurrentUser } from "@/lib/auth";
import { TIMEZONES } from "@/lib/utils";
import WelcomeWizard from "./wizard";
import { db } from "@/lib/db";
import { siteRootDomain } from "@/lib/site-domains";

export const dynamic = "force-dynamic";

// Phase 5B: guided first run after free sign up (no card asked for), ending
// with a created collection.
export default async function WelcomePage() {
  const user = (await getCurrentUser())!;
  const site = await db.website.findUnique({ where: { userId: user.id }, select: { slug: true } });
  return (
    <>
    {site ? (
      <p className="card p-3 text-sm mb-4 max-w-2xl" data-subdomain>
        Your free address is live: <a className="underline font-medium" href={`/site/${site.slug}`} target="_blank" rel="noreferrer">{site.slug}.{siteRootDomain()}</a>.
        Change it any time in Website, Settings.
      </p>
    ) : null}
    <WelcomeWizard
      name={user.name}
      businessName={user.businessName}
      timezone={user.timezone}
      timezones={TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES]}
    />
    </>
  );
}
