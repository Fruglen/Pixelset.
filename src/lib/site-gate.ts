import { cookies } from "next/headers";
import { createHmac } from "crypto";

// Night build (Website): password gates for the whole site and for single
// pages. Unlock state rides in one HMAC signed cookie per site, following
// the gallery access pattern (src/lib/gallery-auth.ts). The owner is never
// gated. Passwords themselves are compared server side only.

export interface SiteGateState {
  site: boolean; // whole site unlocked
  pages: string[]; // unlocked page ids
}

const SECRET = process.env.SESSION_SECRET || "pixelset-dev-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function gateCookieName(websiteId: string) {
  return `sg_${websiteId}`;
}

export function readSiteGate(websiteId: string): SiteGateState {
  const empty: SiteGateState = { site: false, pages: [] };
  const raw = cookies().get(gateCookieName(websiteId))?.value;
  if (!raw) return empty;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig || sign(payload) !== sig) return empty;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return {
      site: !!data.site,
      pages: Array.isArray(data.pages) ? data.pages.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    return empty;
  }
}

export function writeSiteGate(websiteId: string, state: SiteGateState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  cookies().set(gateCookieName(websiteId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
