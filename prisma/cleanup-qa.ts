import type { PrismaClient } from "@prisma/client";
import { deleteStored } from "../src/lib/storage";

// Idempotent cleanup of the QA/test artifacts created on the live demo data
// during the Nov 19, 2026 functional test, so Pixora's demo starts clean.
// Runs at every boot from prisma/seed.ts (before the seed boot-guard) and is
// a no-op once the artifacts are gone. Scoped tightly to the demo account
// and the exact artifact names, so legitimate demo content (the Emma &
// James wedding gallery, ORD-0001, the seeded starred pair, the submitted
// "Retouch Requests" list) always survives.

export async function cleanupQaArtifacts(db: PrismaClient): Promise<string[]> {
  const log: string[] = [];

  // Throwaway account created by the QA signup test.
  try {
    const qaUser = await db.user.deleteMany({ where: { email: "qa-tester@example.com" } });
    if (qaUser.count) log.push("removed throwaway account qa-tester@example.com");
  } catch {
    log.push("could not remove qa-tester@example.com (blocked by related rows)");
  }

  const demo = await db.user.findUnique({ where: { email: "demo@pixelset.app" } });
  if (!demo) return log;
  const collections = await db.collection.findMany({ where: { userId: demo.id }, select: { id: true, slug: true } });
  const colIds = collections.map((c) => c.id);
  if (colIds.length === 0) return log;

  // Runtime-uploaded photos inside demo collections. Seeded demo photos are
  // addressed under uploads/seed/ (or are external Picsum links); anything
  // addressed uploads/<collectionId>/... was uploaded at runtime, which in
  // the demo data means only QA artifacts: qa-upload.jpg in Northline and
  // the two edited test copies (wedding collection + Rivera set).
  const photos = await db.photo.findMany({
    where: { collectionId: { in: colIds } },
    select: { id: true, url: true, posterUrl: true, filename: true, collectionId: true },
  });
  const runtimePhotos = photos.filter((p) => {
    const key = p.url.replace(/^\//, "").replace(/^media\//, "");
    return key.startsWith(`uploads/${p.collectionId}/`);
  });
  for (const p of runtimePhotos) {
    await db.photo.delete({ where: { id: p.id } }).catch(() => undefined);
    await deleteStored(p.url).catch(() => undefined);
    if (p.posterUrl) await deleteStored(p.posterUrl).catch(() => undefined);
    log.push(`removed runtime-uploaded demo photo ${p.filename}`);
  }

  // The Rivera "QA Exports" set (its photos went with the rule above; make
  // sure the set itself and any stragglers are gone too).
  const qaSets = await db.photoSet.findMany({ where: { collectionId: { in: colIds }, name: "QA Exports" }, select: { id: true } });
  for (const s of qaSets) {
    await db.photo.deleteMany({ where: { setId: s.id } });
    await db.photoSet.delete({ where: { id: s.id } }).catch(() => undefined);
    log.push("removed Rivera 'QA Exports' set");
  }

  // The "Test Picks" favorites list from the QA client test.
  const lists = await db.favoriteList.deleteMany({
    where: { collectionId: { in: colIds }, name: "Test Picks", clientEmail: "testclient@example.com" },
  });
  if (lists.count) log.push("removed 'Test Picks' favorites list");

  // The QA Consultation booking and its contact.
  const qaContacts = await db.contact.findMany({ where: { userId: demo.id, name: "QA Test Client" }, select: { id: true } });
  if (qaContacts.length) {
    const bookings = await db.booking.deleteMany({ where: { contactId: { in: qaContacts.map((c) => c.id) } } });
    if (bookings.count) log.push("removed QA Consultation booking");
    await db.contact.deleteMany({ where: { id: { in: qaContacts.map((c) => c.id) } } });
    log.push("removed 'QA Test Client' contact");
  }

  // The mock store order placed during the QA checkout test (the seeded
  // order is ORD-0001 and is never touched).
  const order = await db.order.deleteMany({ where: { userId: demo.id, number: "ORD-0002" } });
  if (order.count) log.push("removed store order ORD-0002");

  // The one photo starred by hand during QA: the seed stars exactly the
  // first two IMAGE photos of the wedding gallery, so unstar everything
  // else in the demo collections.
  const wedding = collections.find((c) => c.slug === "emma-james-wedding");
  let keepStarred = new Set<string>();
  if (wedding) {
    const first = await db.photo.findMany({
      where: { collectionId: wedding.id, mediaType: "IMAGE" },
      orderBy: { order: "asc" },
      take: 2,
      select: { id: true },
    });
    keepStarred = new Set(first.map((p) => p.id));
  }
  const unstarred = await db.photo.updateMany({
    where: { collectionId: { in: colIds }, starred: true, id: { notIn: Array.from(keepStarred) } },
    data: { starred: false },
  });
  if (unstarred.count) log.push(`unstarred ${unstarred.count} QA-starred photo(s)`);

  // Download PIN uses counted during QA (the seeded PIN itself stays).
  const pins = await db.collection.updateMany({
    where: { userId: demo.id, pinUseCount: { gt: 0 } },
    data: { pinUseCount: 0 },
  });
  if (pins.count) log.push("reset download PIN use counts");

  return log;
}
