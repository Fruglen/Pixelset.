import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStudioProfile } from "@/lib/studio";

// Disconnect Google Calendar: forget the stored token and busy cache and
// switch sync off. Events already created on Google stay there (they belong
// to the photographer's own calendar); nothing new is pushed or read.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getStudioProfile(user.id);
  await db.studioProfile.update({
    where: { id: profile.id },
    data: {
      googleRefreshToken: "",
      googleEmail: "",
      googleBusyJson: "",
      googleSyncAt: null,
      googleCalendarSync: false,
    },
  });
  await db.booking.updateMany({ where: { userId: user.id }, data: { googleEventId: "" } });
  return NextResponse.json({ ok: true });
}
