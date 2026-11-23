import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";
import { isExpired } from "./utils";

// Client-side gallery access state, stored as an HMAC-signed cookie per collection.
export type GalleryAccess = {
  pw: boolean; // collection password satisfied
  email: string; // registered viewer email ("" if none)
  name: string; // viewer display name
  sets: string[]; // unlocked client-exclusive set ids
  group?: string; // Phase 5B: access group id the viewer entered with
};

const SECRET = process.env.SESSION_SECRET || "pixelset-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function cookieNameFor(collectionId: string) {
  return `ga_${collectionId}`;
}

export function readGalleryAccess(collectionId: string): GalleryAccess {
  const empty: GalleryAccess = { pw: false, email: "", name: "", sets: [] };
  const raw = cookies().get(cookieNameFor(collectionId))?.value;
  if (!raw) return empty;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig || sign(payload) !== sig) return empty;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return {
      pw: !!data.pw,
      email: typeof data.email === "string" ? data.email : "",
      name: typeof data.name === "string" ? data.name : "",
      sets: Array.isArray(data.sets) ? data.sets.filter((s: unknown) => typeof s === "string") : [],
      group: typeof data.group === "string" ? data.group : undefined,
    };
  } catch {
    return empty;
  }
}

export function writeGalleryAccess(collectionId: string, access: GalleryAccess) {
  const payload = Buffer.from(JSON.stringify(access), "utf8").toString("base64url");
  cookies().set(cookieNameFor(collectionId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export type GalleryGateReason = "draft" | "expired" | "prerelease" | "password" | "email";

/**
 * The gate a non-owner hits on this gallery, or null when they may view it.
 * One decision shared by the gallery page and the /media route.
 */
export function galleryGate(
  collection: { status: string; expiresAt: Date | null; password: string | null; emailRegistration: boolean },
  access: GalleryAccess
): GalleryGateReason | null {
  if (collection.status === "DRAFT") return "draft";
  if (isExpired(collection.expiresAt)) return "expired";
  if (collection.status === "PRERELEASE") return "prerelease";
  if (collection.password && !access.pw) return "password";
  if (collection.emailRegistration && !access.email) return "email";
  return null;
}

// Anonymous client key for download-cap accounting when no email registered.
export function getClientKey(): string {
  const existing = cookies().get("pxl_cid")?.value;
  if (existing) return existing;
  return `anon_${randomBytes(8).toString("hex")}`;
}

export function ensureClientKey(): string {
  const existing = cookies().get("pxl_cid")?.value;
  if (existing) return existing;
  const key = `anon_${randomBytes(8).toString("hex")}`;
  cookies().set("pxl_cid", key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return key;
}
