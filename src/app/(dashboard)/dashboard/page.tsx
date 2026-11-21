import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { GalleryIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  VIEW: "Gallery viewed",
  FAVORITE: "Photo favorited",
  UNFAVORITE: "Favorite removed",
  LIST_CREATED: "Favorite list created",
  DOWNLOAD: "Photo downloaded",
  DOWNLOAD_ALL: "Gallery downloaded",
  COMMENT: "Comment added",
  EMAIL_REGISTRATION: "Email registered",
  INVITE_SENT: "Invite sent",
  QUICK_SHARE_CREATED: "Quick share link created",
};

export default async function DashboardHome() {
  const user = (await getCurrentUser())!;
  const [collections, photoCount, activities] = await Promise.all([
    db.collection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { photos: true } } },
      take: 6,
    }),
    db.photo.count({ where: { collection: { userId: user.id } } }),
    db.activity.findMany({
      where: { collection: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { collection: { select: { name: true, id: true } } },
    }),
  ]);
  const collectionCount = await db.collection.count({ where: { userId: user.id } });
  const viewCount = await db.activity.count({
    where: { collection: { userId: user.id }, type: "VIEW" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl">Welcome back, {user.name.split(" ")[0]}</h1>
        <Link href="/help" className="text-sm underline text-neutral-600 hover:text-brand-700" data-testid="dashboard-help-link">
          Help centre and guides
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Collections</p>
          <p className="text-3xl font-display mt-1">{collectionCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Photos</p>
          <p className="text-3xl font-display mt-1">{photoCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Gallery views</p>
          <p className="text-3xl font-display mt-1">{viewCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 [&>*]:min-w-0">
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Recent collections
            </h2>
            <Link href="/collections" className="text-sm underline text-neutral-600">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {collections.length === 0 && (
              <EmptyState icon={GalleryIcon} line="No collections yet." ctaLabel="Create your first collection" ctaHref="/collections" />
            )}
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="card p-4 flex items-center justify-between hover:border-neutral-400 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-neutral-500">
                    {c._count.photos} photos · {c.status.toLowerCase()}
                  </p>
                </div>
                <span className="text-neutral-400">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Latest activity
          </h2>
          <div className="card divide-y divide-neutral-100">
            {activities.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">No activity yet.</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className="p-3">
                <p className="text-sm">
                  {ACTIVITY_LABELS[a.type] ?? a.type}
                  {a.clientEmail ? ` · ${a.clientEmail}` : ""}
                </p>
                <p className="text-xs text-neutral-500">
                  {a.collection.name} · {formatDateTime(a.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
