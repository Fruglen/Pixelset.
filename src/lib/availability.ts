import { db } from "./db";
import { parseBusyJson } from "./google-calendar";

// Phase 5B: real availability engine for regular session types.
// Weekly working hours per weekday, date overrides (closed days or custom
// hours), minimum notice, max bookings per day, a slot interval, a booking
// window, plus before/after buffers. Existing bookings (every session type,
// minis included) are treated as busy time, expanded by buffers.

export interface HoursRange {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface DateOverride {
  date: string; // YYYY-MM-DD
  closed: boolean;
  start?: string;
  end?: string;
}

export interface Availability {
  hours: Record<string, HoursRange[]>; // "0" (Sunday) .. "6" (Saturday)
  overrides: DateOverride[];
  minNoticeHours: number;
  maxPerDay: number; // 0 = unlimited
  intervalMin: number; // spacing between offered start times
  windowDays: number; // how far ahead clients can book
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function defaultAvailability(): Availability {
  const weekday = [{ start: "09:00", end: "17:00" }];
  return {
    hours: { "0": [], "1": weekday, "2": weekday, "3": weekday, "4": weekday, "5": weekday, "6": [{ start: "10:00", end: "14:00" }] },
    overrides: [],
    minNoticeHours: 24,
    maxPerDay: 0,
    intervalMin: 30,
    windowDays: 60,
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseAvailability(json: string | null | undefined): Availability {
  const base = defaultAvailability();
  if (!json) return base;
  try {
    const raw = JSON.parse(json);
    const hours: Record<string, HoursRange[]> = {};
    for (let d = 0; d < 7; d++) {
      const list = Array.isArray(raw?.hours?.[String(d)]) ? raw.hours[String(d)] : base.hours[String(d)];
      hours[String(d)] = list
        .filter((r: HoursRange) => r && HHMM.test(r.start) && HHMM.test(r.end) && r.start < r.end)
        .map((r: HoursRange) => ({ start: r.start, end: r.end }));
    }
    const overrides: DateOverride[] = Array.isArray(raw?.overrides)
      ? raw.overrides
          .filter((o: DateOverride) => o && /^\d{4}-\d{2}-\d{2}$/.test(o.date))
          .map((o: DateOverride) => ({
            date: o.date,
            closed: !!o.closed,
            start: o.start && HHMM.test(o.start) ? o.start : undefined,
            end: o.end && HHMM.test(o.end) ? o.end : undefined,
          }))
      : [];
    const n = (v: unknown, d: number, min: number, max: number) => {
      const x = Math.round(Number(v));
      return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d;
    };
    return {
      hours,
      overrides,
      minNoticeHours: n(raw?.minNoticeHours, base.minNoticeHours, 0, 24 * 60),
      maxPerDay: n(raw?.maxPerDay, base.maxPerDay, 0, 100),
      intervalMin: n(raw?.intervalMin, base.intervalMin, 5, 240),
      windowDays: n(raw?.windowDays, base.windowDays, 1, 730),
    };
  } catch {
    return base;
  }
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function at(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00`);
}

/** Working ranges for one calendar date after overrides. */
export function rangesFor(av: Availability, date: string): HoursRange[] {
  const override = av.overrides.find((o) => o.date === date);
  if (override) {
    if (override.closed) return [];
    if (override.start && override.end && override.start < override.end) return [{ start: override.start, end: override.end }];
  }
  const dow = new Date(`${date}T12:00:00`).getDay();
  return av.hours[String(dow)] ?? [];
}

interface Busy {
  start: number;
  end: number;
  sessionTypeId: string | null;
  day: string;
}

export const BLOCKING_STATUSES = ["CONFIRMED", "PENDING", "AWAITING_CLIENT", "COMPLETED"];

async function busyFor(userId: string, from: Date, to: Date, excludeBookingId?: string): Promise<Busy[]> {
  const bookings = await db.booking.findMany({
    where: {
      userId,
      status: { in: BLOCKING_STATUSES },
      startsAt: { lt: new Date(to.getTime() + 86_400_000) },
      endsAt: { gt: new Date(from.getTime() - 86_400_000) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    include: { sessionType: { select: { bufferMin: true, bufferBeforeMin: true } } },
  });
  const busy: Busy[] = bookings.map((b) => ({
    start: b.startsAt.getTime() - (b.sessionType?.bufferBeforeMin ?? 0) * 60_000,
    end: b.endsAt.getTime() + (b.sessionType?.bufferMin ?? 0) * 60_000,
    sessionTypeId: b.sessionTypeId,
    day: ymd(b.startsAt),
  }));
  // Night build follow-up: personal Google Calendar events (cached by the
  // two way sync in google-calendar.ts) block availability like a booking.
  const profile = await db.studioProfile.findUnique({
    where: { userId },
    select: { googleCalendarSync: true, googleRefreshToken: true, googleBusyJson: true },
  });
  if (profile?.googleCalendarSync && profile.googleRefreshToken) {
    for (const block of parseBusyJson(profile.googleBusyJson)) {
      const start = new Date(block.start).getTime();
      const end = new Date(block.end).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      if (end < from.getTime() - 86_400_000 || start > to.getTime() + 86_400_000) continue;
      busy.push({ start, end, sessionTypeId: null, day: ymd(new Date(start)) });
    }
  }
  return busy;
}

export interface SlotType {
  id: string;
  userId: string;
  durationMin: number;
  bufferMin: number;
  bufferBeforeMin: number;
  availability: string;
}

export interface DaySlots {
  date: string;
  slots: string[]; // ISO start times
}

/** Bookable start times for a regular session type over a date range. */
export async function computeSlots(
  type: SlotType,
  opts: { from?: string; days?: number; excludeBookingId?: string; ignoreNotice?: boolean } = {}
): Promise<DaySlots[]> {
  const av = parseAvailability(type.availability);
  const now = Date.now();
  const earliest = opts.ignoreNotice ? now : now + av.minNoticeHours * 3_600_000;
  const lastDay = new Date(now + av.windowDays * 86_400_000);
  const start = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? new Date(`${opts.from}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.min(Math.max(1, opts.days ?? 14), 62);
  const end = new Date(start.getTime() + days * 86_400_000);
  const busy = await busyFor(type.userId, start, end, opts.excludeBookingId);
  const dur = type.durationMin * 60_000;
  const before = type.bufferBeforeMin * 60_000;
  const after = type.bufferMin * 60_000;

  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (day.getTime() > lastDay.getTime()) break;
    const date = ymd(day);
    const slots: string[] = [];
    const sameTypeCount = busy.filter((b) => b.day === date && b.sessionTypeId === type.id).length;
    if (av.maxPerDay > 0 && sameTypeCount >= av.maxPerDay) {
      out.push({ date, slots });
      continue;
    }
    for (const r of rangesFor(av, date)) {
      const rs = at(date, r.start).getTime();
      const re = at(date, r.end).getTime();
      for (let t = rs; t + dur <= re; t += av.intervalMin * 60_000) {
        if (t < earliest) continue;
        const s = t - before;
        const e = t + dur + after;
        if (busy.some((b) => s < b.end && e > b.start)) continue;
        slots.push(new Date(t).toISOString());
      }
    }
    out.push({ date, slots });
  }
  return out;
}

/** True when this exact start time is currently bookable for the type. */
export async function isSlotOpen(type: SlotType, startsAt: Date, excludeBookingId?: string): Promise<boolean> {
  const days = await computeSlots(type, { from: ymd(startsAt), days: 1, excludeBookingId });
  const iso = startsAt.toISOString();
  return days.some((d) => d.slots.includes(iso));
}

/** A real, working video call room link (Jitsi Meet needs no account or API key). */
export function generateMeetingLink(seed: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const clean = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "session";
  return `https://meet.jit.si/pixelset-${clean}-${rand}`;
}

export const LOCATION_TYPES = [
  { id: "IN_PERSON", label: "In person" },
  { id: "VIDEO", label: "Video call (meeting link created per booking)" },
  { id: "ZOOM", label: "Zoom (your own Zoom link)" },
  { id: "PHONE", label: "Phone call" },
];

/** Human readable "where" for confirmations and reminders. */
export function whereLabel(
  t: { locationType: string; location: string },
  b?: { meetingLink?: string; callPhone?: string }
): string {
  if (t.locationType === "VIDEO" || t.locationType === "ZOOM") {
    const link = b?.meetingLink || (t.locationType === "ZOOM" ? t.location : "");
    return link ? `Video call: ${link}` : "Video call, link to follow";
  }
  if (t.locationType === "PHONE") {
    if (t.location) return `Phone call, call ${t.location}`;
    return b?.callPhone ? `Phone call, we will call you at ${b.callPhone}` : "Phone call";
  }
  return t.location;
}
