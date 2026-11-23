import type { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// GLE-137: OAuth CSRF protection for the studio's Stripe and Google connects.
//
// The connect route puts a random state in a short-lived signed httpOnly cookie
// bound to the signed-in user. The callback accepts a code only when its state
// matches that cookie, so a code from a link the user did not start is refused.

const FLOWS = {
  stripe: { cookie: "oauth_state_stripe", path: "/api/studio/payments/connect" },
  google: { cookie: "oauth_state_google", path: "/api/studio/google" },
} as const;

export type OAuthProvider = keyof typeof FLOWS;

const STATE_TTL_SECONDS = 10 * 60;
const SECRET = process.env.SESSION_SECRET || "pixelset-dev-secret";
const SECURE_COOKIE = (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");

// Spent states, so a state works once. In memory, like the gallery challenges.
const globalForOAuth = globalThis as unknown as { pixoraSpentOAuthStates?: Map<string, number> };
const spentStates = (globalForOAuth.pixoraSpentOAuthStates ??= new Map<string, number>());

// Domain-separated from the gallery cookies, so one can never be replayed as another.
function signPayload(provider: OAuthProvider, payload: string) {
  return createHmac("sha256", SECRET).update(`oauth-state-${provider}\n${payload}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

/** Stores the state on the redirect that sends the user to the provider. */
export function setOAuthStateCookie(res: NextResponse, provider: OAuthProvider, state: string, userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ s: state, u: userId, x: Date.now() + STATE_TTL_SECONDS * 1000 }),
    "utf8"
  ).toString("base64url");
  res.cookies.set(FLOWS[provider].cookie, `${payload}.${signPayload(provider, payload)}`, {
    httpOnly: true,
    sameSite: "lax", // Must be sent on the top-level redirect back from the provider.
    secure: SECURE_COOKIE,
    path: FLOWS[provider].path,
    maxAge: STATE_TTL_SECONDS,
  });
}

export function clearOAuthStateCookie(res: NextResponse, provider: OAuthProvider) {
  res.cookies.set(FLOWS[provider].cookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: FLOWS[provider].path,
    maxAge: 0,
  });
}

/**
 * Checks the callback's state against the cookie and spends it on success.
 * Synchronous, so two parallel callbacks cannot both spend the same state.
 */
export function consumeOAuthState(req: NextRequest, provider: OAuthProvider, userId: string): boolean {
  const submitted = req.nextUrl.searchParams.get("state");
  const raw = req.cookies.get(FLOWS[provider].cookie)?.value;
  if (!submitted || !raw) return false;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig || !safeEqual(signPayload(provider, payload), sig)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Date.now();
    if (typeof data.s !== "string" || typeof data.u !== "string" || typeof data.x !== "number") return false;
    if (data.x <= now || !safeEqual(data.u, userId) || !safeEqual(data.s, submitted)) return false;
    if (spentStates.has(data.s)) return false;
    spentStates.forEach((expiry, id) => {
      if (expiry <= now) spentStates.delete(id);
    });
    spentStates.set(data.s, data.x);
    return true;
  } catch {
    return false;
  }
}
