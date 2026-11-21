import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

// Phase 5B platform: personal API token (Client Gallery > Tools) for scripted
// uploads, for example from an export action or a future Lightroom plugin.
//
// Build pack 2026-11-20 (Lightroom groundwork): the scheme is matched
// case-insensitively ("Bearer", "bearer"), surrounding whitespace is ignored,
// and only well formed pxs_ tokens reach the database. Tokens belong to the
// account owner; a revoked or rotated token stops working immediately because
// the lookup is always against the current stored value.
const TOKEN_RE = /^Bearer\s+(pxs_[A-Za-z0-9]{20,64})$/i;

export function bearerToken(req: NextRequest): string | null {
  const h = (req.headers.get("authorization") || "").trim();
  const m = h.match(TOKEN_RE);
  return m ? m[1] : null;
}

export async function userFromBearer(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return null;
  const user = await db.user.findUnique({ where: { apiToken: token } });
  // tokens are only ever issued to account owners; a team login row never authenticates the API
  if (!user || user.teamOwnerId) return null;
  return user;
}

/** 401 for the token API, with the standard challenge header so clients (and plugins) know to send a Bearer token. */
export function tokenUnauthorized() {
  return NextResponse.json(
    { error: "Invalid or missing API token. Create one in Client Gallery > Tools and send it as: Authorization: Bearer <token>" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="pixora", error="invalid_token"' } }
  );
}
