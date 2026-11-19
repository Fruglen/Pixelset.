import { db } from "@/lib/db";
import { GaTag } from "@/components/ga-tag";

// Phase 5B platform: inject the account's gallery Google Analytics tag.
export default async function GalleryLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const c = await db.collection.findUnique({ where: { slug: params.slug }, select: { user: { select: { galleryGaId: true } } } });
  return (
    <>
      {children}
      {c?.user.galleryGaId ? <GaTag id={c.user.galleryGaId} /> : null}
    </>
  );
}
