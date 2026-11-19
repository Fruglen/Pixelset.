import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { WebsiteTabs } from "./tabs";
import { PublishBar } from "./publish-bar";
import { draftStatus } from "@/lib/site-publish";

export const dynamic = "force-dynamic";

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const website = user ? await db.website.findUnique({ where: { userId: user.id } }) : null;
  const unread = website ? await db.siteMessage.count({ where: { websiteId: website.id, read: false } }) : 0;

  if (!website) return <>{children}</>;
  const status = await draftStatus(website.id);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display">Website</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {website.slug}.mypixelset.com
            {website.customDomain ? ` · ${website.customDomain}${website.domainStatus === "VERIFIED" ? "" : " (not verified)"}` : ""} ·{" "}
            <span className={website.published ? "text-emerald-600" : "text-amber-600"}>
              {website.published ? "Online" : "Offline"}
            </span>
          </p>
        </div>
        <a href={`/site/${website.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">
          View site ↗
        </a>
      </div>
      <PublishBar changes={status.changes} publishedAt={status.publishedAt ? status.publishedAt.toISOString() : null} slug={website.slug} />
      <WebsiteTabs unread={unread} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
