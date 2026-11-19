import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/mailer";
import AlbumsClient from "./albums-client";

export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  const user = (await getCurrentUser())!;
  const [designs, products, orders] = await Promise.all([
    db.albumDesign.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
    db.product.findMany({
      where: { priceSheet: { userId: user.id }, category: { in: ["ALBUM", "PACKAGE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, number: true, customerName: true },
    }),
  ]);
  return (
    <AlbumsClient
      designs={designs.map((d) => ({
        id: d.id,
        title: d.title,
        clientName: d.clientName,
        clientEmail: d.clientEmail,
        status: d.status,
        link: absoluteUrl(`/album/${d.token}`),
        updatedAt: d.updatedAt.toISOString().slice(0, 10),
      }))}
      products={products}
      orders={orders}
    />
  );
}
