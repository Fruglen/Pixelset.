import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import AlbumDesigner from "./album-designer";

export const dynamic = "force-dynamic";

export default async function AlbumDesignPage({ params }: { params: { token: string } }) {
  const design = await db.albumDesign.findUnique({ where: { token: params.token } });
  if (!design) notFound();
  return <AlbumDesigner token={params.token} />;
}
