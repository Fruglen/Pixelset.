import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import MobileUploadClient from "./upload-client";

export const dynamic = "force-dynamic";

// Phase 5B: mobile first upload screen. Opened from the QR code on the Photos
// tab, it lets the photographer take photos with the phone camera or pick them
// from the camera roll, straight into a set of this collection.
export default async function MobileUploadPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/m/upload/${params.id}`);
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { sets: { orderBy: { order: "asc" }, include: { _count: { select: { photos: true } } } } },
  });
  if (!collection) notFound();
  return (
    <MobileUploadClient
      collection={{ id: collection.id, name: collection.name }}
      sets={collection.sets.map((s) => ({ id: s.id, name: s.name, count: s._count.photos }))}
    />
  );
}
