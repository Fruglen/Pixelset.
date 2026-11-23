import { cookies } from "next/headers";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { isExpired } from "./utils";

// Client-side gallery access state, stored as an HMAC-signed cookie per collection.
export type GalleryAccess = {
  pw: boolean; // collection password satisfied
  email: string; // registered viewer email ("" if none)
  name: string; // viewer display name
  sets: string[]; // unlocked client-exclusive set ids
  group?: string; // Phase 5B: access group id the viewer entered with
  // GLE-122 (H7): `email` above is only a typed label. These two carry ownership.
  lists: string[]; // favorite lists created in this browser under `email`
  verified: string; // proof the viewer confirmed `email` for this collection ("" if not)
};

const SECRET = process.env.SESSION_SECRET || "pixelset-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function cookieNameFor(collectionId: string) {
  return `ga_${collectionId}`;
}

export function readGalleryAccess(collectionId: string): GalleryAccess {
  const empty: GalleryAccess = { pw: false, email: "", name: "", sets: [], lists: [], verified: "" };
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
      lists: Array.isArray(data.lists) ? data.lists.filter((l: unknown) => typeof l === "string") : [],
      verified: typeof data.verified === "string" ? data.verified : "",
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

// ---------------------------------------------------------------------------
// GLE-122 (H7): email verification for ownership decisions.
//
// The code lives in a short-lived signed challenge cookie, so a code only works
// in the browser that asked for it and no schema change is needed. The cookie
// holds an HMAC of the code, never the code. Its signature is domain-separated
// from the access cookie, so one can never be replayed as the other.
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_SECONDS = 10 * 60;
const MAX_REMEMBERED_LISTS = 20;
// 8 characters, no lookalikes (0/O, 1/I/L): about 40 bits, so online guessing
// stays infeasible even if the in-memory rate limiter resets.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

// Spent challenge ids, so a code works once. In memory, like the rate limiter.
const globalForChallenges = globalThis as unknown as { pixoraSpentChallenges?: Map<string, number> };
const spentChallenges = (globalForChallenges.pixoraSpentChallenges ??= new Map<string, number>());

function verifiedMark(collectionId: string, email: string) {
  return `${collectionId}\n${email}`;
}

/** True when this viewer confirmed their current email for this collection. */
export function isEmailVerified(collectionId: string, access: GalleryAccess): boolean {
  return !!access.email && access.verified === verifiedMark(collectionId, access.email);
}

export function withEmailVerified(collectionId: string, access: GalleryAccess): GalleryAccess {
  return { ...access, verified: verifiedMark(collectionId, access.email) };
}

/** Records a list created in this browser, so its creator needs no code to keep using it. */
export function withOwnedList(access: GalleryAccess, listId: string): GalleryAccess {
  return { ...access, lists: [...access.lists.filter((l) => l !== listId), listId].slice(-MAX_REMEMBERED_LISTS) };
}

/** The one ownership decision for a favorite list. A typed email alone never passes. */
export function ownsFavoriteList(
  list: { id: string; collectionId: string; clientEmail: string },
  access: GalleryAccess
): boolean {
  if (!access.email || list.clientEmail !== access.email) return false;
  return isEmailVerified(list.collectionId, access) || access.lists.includes(list.id);
}

function challengeCookieName(collectionId: string) {
  return `gv_${collectionId}`;
}

function challengeHmac(label: string, value: string) {
  return createHmac("sha256", SECRET).update(`gallery-verify-${label}\n${value}`).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function codeHash(collectionId: string, email: string, nonce: string, expires: number, code: string) {
  return challengeHmac("code", [collectionId, email, nonce, expires, code].join("\n"));
}

/** Starts a challenge for this email in this browser and returns the code to send. */
export function createEmailChallenge(collectionId: string, email: string): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const nonce = randomBytes(12).toString("hex");
  const expires = Date.now() + CHALLENGE_TTL_SECONDS * 1000;
  const payload = Buffer.from(
    JSON.stringify({ c: collectionId, e: email, n: nonce, x: expires, h: codeHash(collectionId, email, nonce, expires, code) }),
    "utf8"
  ).toString("base64url");
  cookies().set(challengeCookieName(collectionId), `${payload}.${challengeHmac("challenge", payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
  return code;
}

export function clearEmailChallenge(collectionId: string) {
  cookies().set(challengeCookieName(collectionId), "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * Checks a submitted code and spends the challenge on success. Synchronous, so
 * two parallel requests cannot both spend the same code.
 */
export function confirmEmailChallenge(collectionId: string, email: string, submitted: string): boolean {
  const raw = cookies().get(challengeCookieName(collectionId))?.value;
  if (!raw || !email) return false;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig || !safeEqualHex(challengeHmac("challenge", payload), sig)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Date.now();
    if (data.c !== collectionId || data.e !== email || typeof data.n !== "string") return false;
    if (typeof data.x !== "number" || data.x <= now || typeof data.h !== "string") return false;
    if (spentChallenges.has(data.n)) return false;
    const code = submitted.toUpperCase().replace(/[\s-]/g, "");
    if (!safeEqualHex(codeHash(collectionId, email, data.n, data.x, code), data.h)) return false;
    spentChallenges.forEach((expiry, id) => {
      if (expiry <= now) spentChallenges.delete(id);
    });
    spentChallenges.set(data.n, data.x);
    return true;
  } catch {
    return false;
  }
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
