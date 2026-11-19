import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B platform: per viewer access groups (vendors, second shooters,
// family). Each group has its own access code, the sets it may see, and its
// own download rights (on or off, and which sizes).
export const GROUP_SIZES = ["original", "high3600", "web2048", "web1024", "web640"];

export async function ownedCollection(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.collection.findFirst({ where: { id, userId: user.id }, include: { sets: true } });
}

export function cleanGroup(
  body: Record<string, unknown>,
  setIds: string[]
): { data: { name?: string; code?: string; canDownload?: boolean; downloadSizes?: string; setIds?: string }; error?: string } {
  const data: { name?: string; code?: string; canDownload?: boolean; downloadSizes?: string; setIds?: string } = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return { data, error: "Give the group a name, for example Vendors or Family" };
    data.name = body.name.trim().slice(0, 60);
  }
  if (typeof body.code === "string") {
    const code = body.code.trim();
    if (code.length < 4) return { data, error: "The access code needs at least 4 characters" };
    data.code = code.slice(0, 40);
  }
  if (typeof body.canDownload === "boolean") data.canDownload = body.canDownload;
  if (Array.isArray(body.downloadSizes)) {
    data.downloadSizes = body.downloadSizes.filter((s): s is string => typeof s === "string" && GROUP_SIZES.includes(s)).join(",");
  }
  if (Array.isArray(body.setIds)) {
    data.setIds = body.setIds.filter((s): s is string => typeof s === "string" && setIds.includes(s)).join(",");
  }
  return { data };
}

export async function codeTaken(collectionId: string, code: string, exceptId?: string) {
  const clash = await db.accessGroup.findFirst({ where: { collectionId, code, NOT: exceptId ? { id: exceptId } : undefined } });
  if (clash) return true;
  const c = await db.collection.findUnique({ where: { id: collectionId }, select: { password: true } });
  return !!c?.password && c.password === code;
}
