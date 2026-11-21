import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { GalleryIcon } from "@/components/icons";
import { getDashT } from "@/lib/dashboard-lang";
import type { DashKey } from "@/lib/dashboard-i18n";

export const dynamic = "force-dynamic";

// Build pack 2026-11-20: labels come from the dashboard dictionary (act_<TYPE>)
const ACTIVITY_TYPES = ["VIEW", "FAVORITE", "UNFAVORITE", "LIST_CREATED", "DOWNLOAD", "DOWNLOAD_ALL", "COMMENT", "EMAIL_REGISTRATION", "INVITE_SENT", "QUICK_SHARE_CREATED"];

export default async function DashboardHome() {
  const user = (await getCurrentUser())!;
  const { t } = await getDashT();
  const statusLabel = (s: string) => (["DRAFT", "PRERELEASE", "PUBLISHED"].includes(s) ? t(`status_${s}` as DashKey) : s.toLowerCase());
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
        <h1 className="font-display text-2xl">{t("welcome", { name: user.name.split(" ")[0] })}</h1>
        <Link href="/help" className="text-sm underline text-neutral-600 hover:text-brand-700" data-testid="dashboard-help-link">
          {t("helpLink")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("statCollections")}</p>
          <p className="text-3xl font-display mt-1">{collectionCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("statPhotos")}</p>
          <p className="text-3xl font-display mt-1">{photoCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{t("statViews")}</p>
          <p className="text-3xl font-display mt-1">{viewCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 [&>*]:min-w-0">
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {t("recentCollections")}
            </h2>
            <Link href="/collections" className="text-sm underline text-neutral-600">
              {t("viewAll")}
            </Link>
          </div>
          <div className="space-y-2">
            {collections.length === 0 && (
              <EmptyState icon={GalleryIcon} line={t("noCollections")} ctaLabel={t("createFirst")} ctaHref="/collections" />
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
                    {t("photosCount", { n: c._count.photos })} · {statusLabel(c.status)}
                  </p>
                </div>
                <span className="text-neutral-400">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            {t("latestActivity")}
          </h2>
          <div className="card divide-y divide-neutral-100">
            {activities.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">{t("noActivity")}</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className="p-3">
                <p className="text-sm">
                  {ACTIVITY_TYPES.includes(a.type) ? t(`act_${a.type}` as DashKey) : a.type}
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
