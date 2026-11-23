import { db } from "./db";
import { appBaseUrl } from "./mailer";

// Night build follow-up (Studio): two way Google Calendar sync.
//
// The integration is fully credential gated, per the owner's order for
// external services: the server needs GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET (GOOGLE_REDIRECT_URI optional) before the Connect
// button can work at all, and every state without them says so honestly.
// When a photographer connects:
//   - bookings are pushed to their Google calendar (create / update /
//     delete mirrored from the booking status), and
//   - their personal events are read back through the freebusy API into a
//     busy cache (googleBusyJson) that the availability engine treats as
//     blocked time, so personal events stop double bookings.
// Nothing in here throws into a booking flow: sync is best effort and the
// settings page reports the last sync time and result.

const CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl()}/api/studio/google/callback`;
}

export function googleConnectUrl(state: string): string | null {
  if (!googleOAuthConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleProfileLike {
  googleRefreshToken: string;
  googleCalendarId: string;
}

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(
  code: string
): Promise<{ refreshToken: string; accessToken: string } | { error: string }> {
  const out = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  if (!out?.access_token) return { error: "Google did not complete the sign in. Try connecting again." };
  return {
    accessToken: String(out.access_token),
    refreshToken: typeof out.refresh_token === "string" ? out.refresh_token : "",
  };
}

export async function googleEmailFor(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const out = (await res.json()) as { email?: string };
    return out.email ?? "";
  } catch {
    return "";
  }
}

async function accessTokenFor(profile: GoogleProfileLike): Promise<string | null> {
  if (!profile.googleRefreshToken) return null;
  const out = await tokenRequest({
    refresh_token: profile.googleRefreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    grant_type: "refresh_token",
  });
  return out?.access_token ? String(out.access_token) : null;
}

export interface BusyBlock {
  start: string; // ISO
  end: string; // ISO
  title: string;
}

export function parseBusyJson(json: string | null | undefined): BusyBlock[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((b): b is BusyBlock => !!b && typeof b.start === "string" && typeof b.end === "string")
      .map((b) => ({ start: b.start, end: b.end, title: typeof b.title === "string" ? b.title : "Personal event" }));
  } catch {
    return [];
  }
}

/** Read the photographer's personal events (freebusy) into the busy cache. */
export async function refreshGoogleBusy(
  profile: { id: string } & GoogleProfileLike,
  days = 60
): Promise<{ ok: boolean; count: number; detail: string }> {
  const token = await accessTokenFor(profile);
  if (!token) return { ok: false, count: 0, detail: "Google connection expired, reconnect in Studio Settings." };
  const calendarId = profile.googleCalendarId || "primary";
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + days * 86_400_000).toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    if (!res.ok) return { ok: false, count: 0, detail: `Google freebusy read failed (${res.status}).` };
    const out = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const busy = (out.calendars?.[calendarId]?.busy ?? []).map((b) => ({
      start: b.start,
      end: b.end,
      title: "Personal event",
    }));
    await db.studioProfile.update({
      where: { id: profile.id },
      data: { googleBusyJson: JSON.stringify(busy), googleSyncAt: new Date() },
    });
    return { ok: true, count: busy.length, detail: `Read ${busy.length} personal event${busy.length === 1 ? "" : "s"} from Google Calendar.` };
  } catch {
    return { ok: false, count: 0, detail: "Could not reach Google Calendar." };
  }
}

interface BookingLike {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  googleEventId: string;
  contact?: { name: string; email: string } | null;
}

async function googleFetch(
  token: string,
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

/** Create or update the Google event for a booking. Returns the event id. */
export async function pushBookingEvent(
  profile: GoogleProfileLike,
  booking: BookingLike
): Promise<{ eventId: string } | { error: string }> {
  const token = await accessTokenFor(profile);
  if (!token) return { error: "Google connection expired, reconnect in Studio Settings." };
  const calendarId = encodeURIComponent(profile.googleCalendarId || "primary");
  const payload = {
    summary: booking.contact?.name ? `${booking.title}, ${booking.contact.name}` : booking.title,
    description: `Pixora booking${booking.contact?.email ? ` for ${booking.contact.email}` : ""}. Status: ${booking.status}.`,
    start: { dateTime: booking.startsAt.toISOString() },
    end: { dateTime: booking.endsAt.toISOString() },
  };
  if (booking.googleEventId) {
    const out = await googleFetch(token, `/calendars/${calendarId}/events/${encodeURIComponent(booking.googleEventId)}`, "PUT", payload);
    if (out.ok) return { eventId: booking.googleEventId };
    if (out.status !== 404 && out.status !== 410) return { error: `Google event update failed (${out.status}).` };
    // Event was deleted on Google's side: fall through and recreate it.
  }
  const out = await googleFetch(token, `/calendars/${calendarId}/events`, "POST", payload);
  if (out.ok && out.json?.id) return { eventId: String(out.json.id) };
  return { error: `Google event create failed (${out.status}).` };
}

export async function deleteBookingEvent(profile: GoogleProfileLike, booking: BookingLike): Promise<boolean> {
  if (!booking.googleEventId) return true;
  const token = await accessTokenFor(profile);
  if (!token) return false;
  const calendarId = encodeURIComponent(profile.googleCalendarId || "primary");
  const out = await googleFetch(token, `/calendars/${calendarId}/events/${encodeURIComponent(booking.googleEventId)}`, "DELETE");
  return out.ok || out.status === 404 || out.status === 410;
}

const SYNCED_STATUSES = ["CONFIRMED", "PENDING", "AWAITING_CLIENT", "COMPLETED"];

/**
 * Mirror one booking to Google Calendar (best effort, never throws).
 * Cancelled bookings have their event removed; live bookings are created or
 * updated. Does nothing when sync is off or Google is not connected.
 */
export async function syncBookingToGoogle(bookingId: string): Promise<{ synced: boolean; detail: string }> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { contact: { select: { name: true, email: true } } },
    });
    if (!booking) return { synced: false, detail: "Booking not found" };
    const profile = await db.studioProfile.findUnique({ where: { userId: booking.userId } });
    if (!profile || !profile.googleCalendarSync || !profile.googleRefreshToken) {
      return { synced: false, detail: "Google Calendar is not connected" };
    }
    if (booking.status === "CANCELLED") {
      if (!booking.googleEventId) return { synced: true, detail: "No Google event to remove" };
      const removed = await deleteBookingEvent(profile, booking);
      if (removed) {
        await db.booking.update({ where: { id: booking.id }, data: { googleEventId: "" } });
        return { synced: true, detail: "Removed from Google Calendar" };
      }
      return { synced: false, detail: "Could not remove the Google event" };
    }
    if (!SYNCED_STATUSES.includes(booking.status)) {
      return { synced: false, detail: `Bookings with status ${booking.status} are not mirrored` };
    }
    const out = await pushBookingEvent(profile, booking);
    if ("error" in out) return { synced: false, detail: out.error };
    if (out.eventId !== booking.googleEventId) {
      await db.booking.update({ where: { id: booking.id }, data: { googleEventId: out.eventId } });
    }
    return { synced: true, detail: "Mirrored to Google Calendar" };
  } catch {
    return { synced: false, detail: "Google sync failed" };
  }
}

/** Push every upcoming live booking that has no Google event yet, then refresh the busy cache. */
export async function syncAllBookingsToGoogle(
  userId: string
): Promise<{ pushed: number; busy: number; detail: string }> {
  const profile = await db.studioProfile.findUnique({ where: { userId } });
  if (!profile || !profile.googleRefreshToken) return { pushed: 0, busy: 0, detail: "Google Calendar is not connected" };
  if (!googleOAuthConfigured()) return { pushed: 0, busy: 0, detail: "Google Calendar is not configured on this server" };
  const bookings = await db.booking.findMany({
    where: {
      userId,
      status: { in: SYNCED_STATUSES },
      endsAt: { gt: new Date(Date.now() - 86_400_000) },
    },
    include: { contact: { select: { name: true, email: true } } },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  let pushed = 0;
  for (const b of bookings) {
    const out = await pushBookingEvent(profile, b);
    if ("eventId" in out) {
      pushed++;
      if (out.eventId !== b.googleEventId) {
        await db.booking.update({ where: { id: b.id }, data: { googleEventId: out.eventId } });
      }
    }
  }
  const busy = await refreshGoogleBusy(profile);
  return {
    pushed,
    busy: busy.count,
    detail: `Pushed ${pushed} booking${pushed === 1 ? "" : "s"} to Google Calendar. ${busy.detail}`,
  };
}
