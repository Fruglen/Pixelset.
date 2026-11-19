import { NextRequest } from "next/server";
import { db } from "./db";

// Phase 5B platform: personal API token (Client Gallery > Tools) for scripted
// uploads, for example from an export action or a future Lightroom plugin.
export async function userFromBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(pxs_[A-Za-z0-9]{20,})$/);
  if (!m) return null;
  return db.user.findUnique({ where: { apiToken: m[1] } });
}
