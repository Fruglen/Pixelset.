export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "collection";
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function endOfDay(dateStr: string, timeZone?: string): Date {
  // Expires at 11:59:59 pm on the chosen date in the photographer's timezone
  // (Phase 5B). Falls back to the server's local zone when none is given.
  if (!timeZone) return new Date(`${dateStr}T23:59:59`);
  return zonedTimeToUtc(dateStr, "23:59:59", timeZone);
}

/** Minutes the zone is ahead of UTC at the given instant (e.g. -360 for CST). */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return -new Date().getTimezoneOffset();
  }
}

/** The UTC instant at which the wall clock in timeZone reads dateStr timeStr. */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}Z`);
  let off = tzOffsetMinutes(naive, timeZone);
  let d = new Date(naive.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(d, timeZone);
  if (off2 !== off) {
    off = off2;
    d = new Date(naive.getTime() - off * 60000);
  }
  return d;
}

/** YYYY-MM-DD of an instant as seen in timeZone. */
export function dateInZone(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Africa/Lagos",
  "Africa/Douala",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function randomToken(len = 24): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = require("crypto").randomBytes(len) as Buffer;
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function generatePassword(): string {
  const words = ["amber", "willow", "harbor", "linen", "meadow", "cedar", "ember", "golden", "river", "sable", "velvet", "maple"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}${Math.floor(100 + Math.random() * 900)}`;
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua || "");
}

export function isExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

/** Video timecode as m:ss (or h:mm:ss past an hour). */
export function formatTimecode(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
