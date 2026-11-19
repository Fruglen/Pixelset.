import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MiniSessionSlots } from "@/components/mini-session-slots";

export const dynamic = "force-dynamic";

// Phase 5B: iframe friendly live mini session calendar for any website.
export default async function MiniEmbedPage({ params }: { params: { slug: string; typeId: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) notFound();
  const type = await db.sessionType.findFirst({ where: { id: params.typeId, userId: profile.userId, isMini: true, published: true } });
  if (!type) notFound();
  return (
    <div className="bg-white text-ink p-4 font-sans">
      <MiniSessionSlots userId={profile.userId} typeId={type.id} target="_top" />
    </div>
  );
}
