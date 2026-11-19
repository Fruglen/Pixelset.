import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import ListsPanel from "./lists-panel";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All", types: [] as string[] },
  { id: "views", label: "Views", types: ["VIEW"] },
  { id: "favorites", label: "Favorites", types: ["FAVORITE", "UNFAVORITE", "LIST_CREATED", "LIST_SUBMITTED", "LIST_REOPENED"] },
  { id: "downloads", label: "Downloads", types: ["DOWNLOAD", "DOWNLOAD_ALL"] },
  { id: "comments", label: "Comments", types: ["COMMENT"] },
  { id: "emails", label: "Email registrations", types: ["EMAIL_REGISTRATION", "MARKETING_OPT_IN"] },
  { id: "invites", label: "Invites", types: ["INVITE_SENT", "QUICK_SHARE_CREATED", "EXPIRY_REMINDER"] },
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
  LIST_SUBMITTED: "Favorite list sent to you",
  LIST_REOPENED: "Favorite list reopened",
  MARKETING_OPT_IN: "Marketing opt in",
  EXPIRY_REMINDER: "Expiry reminder email",
  ACCESS_GROUP: "Access group entered",
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

  const optIns = await db.campaignOptIn.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "desc" } });
  const lists =
    active.id === "favorites" || active.id === "all"
      ? await db.favoriteList.findMany({
          where: { collectionId: collection.id },
          orderBy: [{ submittedAt: "desc" }, { createdAt: "asc" }],
          include: { favorites: { include: { photo: { select: { filename: true } } }, orderBy: { createdAt: "asc" } } },
        })
      : [];

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

      {active.id === "emails" && (
        <div className="card p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="label !mb-0">Registered emails ({registrations.length})</p>
            <a className="btn-secondary !py-1 !px-2 text-xs" href={`/api/collections/${collection.id}/registrations`}>
              Export CSV
            </a>
          </div>
          {registrations.length > 0 ? (
            <p className="text-sm font-mono text-neutral-700">{registrations.map((r) => r.email).join(", ")}</p>
          ) : (
            <p className="text-xs text-neutral-400">No registrations yet.</p>
          )}
          <div>
            <p className="label">Marketing opt ins, your campaign audience ({optIns.length})</p>
            {optIns.length > 0 ? (
              <p className="text-sm font-mono text-neutral-700">{optIns.map((o) => o.email).join(", ")}</p>
            ) : (
              <p className="text-xs text-neutral-400">
                {collection.campaignOptIn ? "Nobody has opted in yet." : "Marketing opt in is off for this gallery (Collection Settings, Privacy)."}
              </p>
            )}
            <p className="text-[11px] text-neutral-400 mt-1">
              Opt ins are tagged “marketing opt in” on the contact in Studio Manager and included in the CSV export.
            </p>
          </div>
        </div>
      )}

      {lists.length > 0 && (
        <ListsPanel
          lists={lists.map((l) => ({
            id: l.id,
            name: l.name,
            clientName: l.clientName,
            clientEmail: l.clientEmail,
            selectionLimit: l.selectionLimit,
            submittedAt: l.submittedAt ? l.submittedAt.toISOString() : null,
            favorites: l.favorites.map((f) => ({ filename: f.photo.filename, note: f.note })),
          }))}
        />
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
