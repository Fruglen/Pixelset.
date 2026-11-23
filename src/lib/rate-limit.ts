import { createHash } from "crypto";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GLE-118 (security H3): failed-attempt limiter for credential checks.
//
// Sliding window: 10 failures for one key within 15 minutes blocks that key
// until the oldest failure leaves the window. Only failures count.
//
// LIMITATION: state is in this process's memory. It resets on restart or
// deploy, and is not shared between instances. If the app ever runs on more
// than one instance, move this store to Postgres or Redis.
//
// Callers must run check -> verify -> record with NO `await` in between.
// Node then cannot interleave another request, so a parallel burst cannot
// slip past the counter.
// ---------------------------------------------------------------------------

export const RATE_LIMIT_MAX_FAILURES = 10;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const MAX_KEYS = 20_000;
const SWEEP_INTERVAL_MS = 60 * 1000;

type LimiterState = { failures: Map<string, number[]>; lastSweep: number };

// Next can bundle each route separately, so the store lives on globalThis to
// stay a single store across routes and dev reloads.
const globalForLimiter = globalThis as unknown as { pixoraRateLimit?: LimiterState };
const state: LimiterState = (globalForLimiter.pixoraRateLimit ??= { failures: new Map(), lastSweep: 0 });

function recent(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
}

/**
 * The client IP for limiter keys. Deliberately not ip-guard's clientIp(): that
 * reads the FIRST X-Forwarded-For hop, which a client can set to a new value
 * per request and so dodge the limit. This counts from the right, past the
 * proxies we control. RATE_LIMIT_PROXY_HOPS is how many trusted proxies append
 * to the header (default 1).
 */
function limiterIp(headers: Headers): string {
  const hops = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length === 0) return "unknown";
  const configured = Number(process.env.RATE_LIMIT_PROXY_HOPS);
  const trusted = Number.isInteger(configured) && configured > 0 ? configured : 1;
  return hops[Math.max(0, hops.length - trusted)];
}

/** Builds a key from scope + client IP + target. Hashed so no emails sit in memory. */
export function rateLimitKey(scope: string, headers: Headers, target: string): string {
  return createHash("sha256").update(`${scope}\n${limiterIp(headers)}\n${target}`).digest("hex");
}

/** Seconds until this key may try again, or 0 when it is not blocked. */
export function retryAfterSeconds(key: string): number {
  const stored = state.failures.get(key);
  if (!stored) return 0;
  const now = Date.now();
  const live = recent(stored, now);
  if (live.length === 0) {
    state.failures.delete(key);
    return 0;
  }
  if (live.length < RATE_LIMIT_MAX_FAILURES) return 0;
  const reopensAt = live[live.length - RATE_LIMIT_MAX_FAILURES] + RATE_LIMIT_WINDOW_MS;
  return Math.max(1, Math.ceil((reopensAt - now) / 1000));
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const live = recent(state.failures.get(key) ?? [], now);
  live.push(now);
  // Delete then set keeps Map order oldest-active first, for eviction below.
  state.failures.delete(key);
  state.failures.set(key, live.slice(-RATE_LIMIT_MAX_FAILURES));
  enforceKeyCap(now);
}

export function clearFailures(key: string): void {
  state.failures.delete(key);
}

// Bounds memory when someone floods the endpoint with random targets.
function enforceKeyCap(now: number): void {
  if (state.failures.size <= MAX_KEYS) return;
  if (now - state.lastSweep >= SWEEP_INTERVAL_MS) {
    state.lastSweep = now;
    state.failures.forEach((timestamps, key) => {
      if (recent(timestamps, now).length === 0) state.failures.delete(key);
    });
  }
  while (state.failures.size > MAX_KEYS) {
    const oldest = state.failures.keys().next().value;
    if (oldest === undefined) break;
    state.failures.delete(oldest);
  }
}

export function tooManyAttempts(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Please wait a few minutes and try again.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
