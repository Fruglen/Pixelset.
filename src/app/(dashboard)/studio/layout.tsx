import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { StudioTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  const profile = await getStudioProfile(user.id);
  const website = await db.website.findUnique({ where: { userId: user.id } });
  const unreadStudio = await db.studioMessage.count({ where: { userId: user.id, read: false } });
  const unreadSite = website
    ? await db.siteMessage.count({ where: { websiteId: website.id, read: false, kind: "BOOKING" } })
    : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display">Studio Manager</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Bookings, contracts, invoices and clients, booking site at /book/{profile.bookingSlug}
          </p>
        </div>
        <a href={`/book/${profile.bookingSlug}`} target="_blank" rel="noreferrer" className="btn-secondary">
          View booking site ↗
        </a>
      </div>
      <StudioTabs unread={unreadStudio + unreadSite} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
