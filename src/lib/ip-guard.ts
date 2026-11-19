import { db } from "./db";
import { parsePlan, serializePlan } from "./plans";

// ---------------------------------------------------------------------------
// Night build (Pricing lane): sign-in IP allowlist, a Studio Manager Volume
// plan feature from the research. The list rides inside the account's plan
// JSON (User.plan), the same no-schema-change pattern as the plan state
// itself; NIGHT-SCHEMA-NEEDS.md still asks for a dedicated column.
//
// Entries are IPv4 addresses or IPv4 CIDR ranges (for example 203.0.113.7
// or 203.0.113.0/24), plus the literal "local" for loopback and same-host
// sign-ins. An empty list means no restriction.
// ---------------------------------------------------------------------------

export function isValidIpEntry(entry: string): boolean {
  if (entry === "local") return true;
  const [ip, prefix] = entry.split("/");
  if (prefix !== undefined && !/^\d{1,2}$/.test(prefix)) return false;
  if (prefix !== undefined && Number(prefix) > 32) return false;
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export function ipMatches(allowlist: string[], ip: string): boolean {
  if (!allowlist.length) return true;
  const isLocal = ip === "local" || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.");
  for (const entry of allowlist) {
    if (entry === "local" && isLocal) return true;
    if (!entry.includes("/")) {
      if (entry === ip) return true;
      continue;
    }
    const [base, prefixRaw] = entry.split("/");
    const prefix = Number(prefixRaw);
    const ipInt = ipv4ToInt(ip.replace("::ffff:", ""));
    const baseInt = ipv4ToInt(base);
    if (ipInt === null || baseInt === null || Number.isNaN(prefix)) continue;
    if (prefix === 0) return true;
    const shift = 32 - prefix;
    if ((ipInt >>> shift) === (baseInt >>> shift)) return true;
  }
  return false;
}

/** The client IP for a request: first forwarded hop, else a local marker. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "local";
}

export async function ipAllowlistFor(userId: string): Promise<string[]> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!u) return [];
  return parsePlan(u.plan).security.ipAllowlist;
}

export async function setIpAllowlist(userId: string, entries: string[]): Promise<string[]> {
  const clean = Array.from(new Set(entries.map((e) => e.trim()).filter(Boolean))).slice(0, 50);
  for (const e of clean) {
    if (!isValidIpEntry(e)) throw new Error(`"${e}" is not a valid IPv4 address or CIDR range`);
  }
  const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!u) throw new Error("Account not found");
  const state = parsePlan(u.plan);
  state.security = { ipAllowlist: clean };
  await db.user.update({ where: { id: userId }, data: { plan: serializePlan(state) } });
  return clean;
}

/**
 * True when this sign-in attempt is allowed for the account. The allowlist
 * is a Volume plan feature: it is only enforced while a Volume plan is
 * active on the account.
 */
export async function loginIpAllowed(userId: string, ip: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!u) return true;
  const state = parsePlan(u.plan);
  if (!state.billing.volume) return true;
  return ipMatches(state.security.ipAllowlist, ip);
}
