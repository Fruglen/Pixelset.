import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runStudioReminders } from "@/lib/studio-flow";
import { runAutomations } from "@/lib/automations";

// Phase 5B: scheduler entry point for Studio Manager time based sends (session
// reminders, invoice reminder schedules, reminder automations) across every
// photographer. Call it every 15 to 60 minutes with
//   Authorization: Bearer $CRON_SECRET
// When CRON_SECRET is not set the route reports "Not connected" and does
// nothing; the same sends still run lazily whenever the dashboard is opened.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, status: "Not connected", reason: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await db.studioProfile.findMany({ select: { userId: true } });
  const results = [];
  for (const u of users) {
    const reminders = await runStudioReminders(u.userId).catch(() => ({ sessions: 0, invoices: 0 }));
    const automations = await runAutomations(u.userId).catch(() => []);
    results.push({ userId: u.userId, ...reminders, automationsFired: automations.reduce((n, a) => n + a.fired, 0) });
  }
  return NextResponse.json({ ok: true, ran: results.length, results });
}

export const POST = GET;
