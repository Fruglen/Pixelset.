import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CollectionTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const user = (await getCurrentUser())!;
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { _count: { select: { photos: true } } },
  });
  if (!collection) notFound();

  const statusLabel =
    collection.status === "PRERELEASE" ? "Pre-release" : collection.status.toLowerCase();
  const expired = collection.expiresAt && collection.expiresAt < new Date();

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <Link href="/collections" className="text-xs text-neutral-500 hover:underline">
            ← Collections
          </Link>
          <h1 className="font-display text-2xl mt-1">{collection.name}</h1>
          <p className="text-sm text-neutral-500">
            {collection._count.photos} photos · /g/{collection.slug} ·{" "}
            <span className="capitalize">{statusLabel}</span>
            {expired ? " · expired (hidden)" : ""}
          </p>
        </div>
        <a
          href={`/g/${collection.slug}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          Public view ↗
        </a>
      </div>
      <CollectionTabs id={collection.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
