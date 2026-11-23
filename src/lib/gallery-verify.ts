import { db } from "./db";
import { isEmailVerified, type GalleryAccess } from "./gallery-auth";

// GLE-122 (H7): which typed emails carry ownership rights in a collection.
// Kept apart from gallery-auth.ts so that module stays free of database calls.

/** Addresses the photographer named on this collection: exclusive-set clients and invitees. */
export async function namedClientEmails(collectionId: string): Promise<Set<string>> {
  const [sets, invites] = await Promise.all([
    db.photoSet.findMany({ where: { collectionId, clientEmail: { not: "" } }, select: { clientEmail: true } }),
    db.invite.findMany({ where: { collectionId }, select: { email: true } }),
  ]);
  const emails = [...sets.map((s) => s.clientEmail), ...invites.map((i) => i.email)];
  return new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean));
}

/**
 * True when the viewer's typed email would carry ownership they have not proven:
 * it is a named client, or it owns favorite lists this browser did not create.
 * Any other email never needs a code.
 */
export async function needsEmailVerification(collectionId: string, access: GalleryAccess): Promise<boolean> {
  if (!access.email || isEmailVerified(collectionId, access)) return false;
  if ((await namedClientEmails(collectionId)).has(access.email)) return true;
  const claimedLists = await db.favoriteList.count({
    where: { collectionId, clientEmail: access.email, id: { notIn: access.lists } },
  });
  return claimedLists > 0;
}
