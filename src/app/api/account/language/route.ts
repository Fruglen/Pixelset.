import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Build pack 2026-11-20: dashboard language. "auto" follows the browser language.
const ALLOWED = ["auto", "en", "es", "pt"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ locale: user.locale });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!ALLOWED.includes(locale)) return NextResponse.json({ error: "Choose auto, English, Spanish or Portuguese" }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: { locale } });
  return NextResponse.json({ ok: true, locale });
}
