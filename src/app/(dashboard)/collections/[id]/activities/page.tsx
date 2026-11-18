import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All", types: [] as string[] },
  { id: "views", label: "Views", types: ["VIEW"] },
  { id: "favorites", label: "Favorites", types: ["FAVORITE", "UNFAVORITE", "LIST_CREATED"] },
  { id: "downloads", label: "Downloads", types: ["DOWNLOAD", "DOWNLOAD_ALL"] },
  { id: "comments", label: "Comments", types: ["COMMENT"] },
  { id: "emails", label: "Email registrations", types: ["EMAIL_REGISTRATION"] },
  { id: "invites", label: "Invites", types: ["INVITE_SENT", "QUICK_SHARE_CREATED"] },
];

const TYPE_LABELS: Record<string, string> = {
  VIEW: "Gallery viewed",
  FAVORITE: "Photo favorited",
  UNFAVORITE: "Favorite removed",
  LIST_CREATED: "Favorite list created",
  DOWNLOAD: "Photo downloaded",
  DOWNLOAD_ALL: "Download All (ZIP)",
  COMMENT: "Comment added",
  EMAIL_REGISTRATION: "Email registered",
  INVITE_SENT: "Invite sent",
  QUICK_SHARE_CREATED: "Quick Share link created",
};

export default async function ActivitiesTab({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const user = (await getCurrentUser())!;
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!collection) notFound();

  const active = FILTERS.find((f) => f.id === (searchParams.filter ?? "all")) ?? FILTERS[0];
  const activities = await db.activity.findMany({
    where: {
      collectionId: collection.id,
      ...(active.types.length > 0 ? { type: { in: active.types } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const registrations = await db.emailRegistration.findMany({
    where: { collectionId: collection.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/collections/${collection.id}/activities?filter=${f.id}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              active.id === f.id
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {active.id === "emails" && registrations.length > 0 && (
        <div className="card p-4 mb-5">
          <p className="label">Registered emails ({registrations.length})</p>
          <p className="text-sm font-mono text-neutral-700">
            {registrations.map((r) => r.email).join(", ")}
          </p>
        </div>
      )}

      <div className="card divide-y divide-neutral-100">
        {activities.length === 0 && (
          <p className="p-6 text-sm text-neutral-500">No activity in this category yet.</p>
        )}
        {activities.map((a) => (
          <div key={a.id} className="p-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{TYPE_LABELS[a.type] ?? a.type}</p>
              {a.detail && <p className="text-xs text-neutral-500">{a.detail}</p>}
              {a.clientEmail && <p className="text-xs text-neutral-400">{a.clientEmail}</p>}
            </div>
            <span className="text-xs text-neutral-400 shrink-0">{formatDateTime(a.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
