import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { isExpired } from "@/lib/utils";

export const dynamic = "force-dynamic";

// One public share link for a whole folder: lists the folder's published,
// unexpired collections, each linking into its own gallery (which keeps its
// own password / registration gates). Only folders the owner switched to
// public resolve here.
async function load(slug: string) {
  const folder = await db.folder.findUnique({ where: { slug }, include: { user: true } });
  if (!folder || !folder.isPublic) return null;
  const collections = await db.collection.findMany({
    where: { folderId: folder.id, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: { photos: { take: 1, orderBy: { order: "asc" } }, _count: { select: { photos: true } } },
  });
  return { folder, user: folder.user, collections: collections.filter((c) => !isExpired(c.expiresAt)) };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await load(params.slug);
  return { title: d ? `${d.folder.name}, ${d.user.businessName || d.user.name}` : "Galleries" };
}

export default async function FolderSharePage({ params }: { params: { slug: string } }) {
  const d = await load(params.slug);
  if (!d) notFound();
  const { folder, user, collections } = d;
  const brand = user.businessName || user.name;
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink">
      <div className="max-w-5xl mx-auto px-4 py-14">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{brand}</p>
        <h1 className="font-display text-3xl text-center">{folder.name}</h1>
        <p className="text-sm text-neutral-500 text-center mt-3">
          {collections.length} {collections.length === 1 ? "gallery" : "galleries"}
        </p>
        {collections.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center mt-10">No galleries are published here yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-10">
            {collections.map((c) => (
              <Link key={c.id} href={`/g/${c.slug}`} className="card overflow-hidden group block">
                <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                  {c.photos[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photos[0].url} alt={c.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {c._count.photos} photos
                    {c.password ? " · password protected" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
