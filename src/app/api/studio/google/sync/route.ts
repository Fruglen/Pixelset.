import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncAllBookingsToGoogle } from "@/lib/google-calendar";

// Manual "Sync now" from Studio Settings: pushes upcoming bookings that are
// not on Google Calendar yet and refreshes the personal busy cache that
// blocks availability.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out = await syncAllBookingsToGoogle(user.id);
  return NextResponse.json({ ok: true, ...out });
}
