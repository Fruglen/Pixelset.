import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { applyTemplateToWebsite } from "@/lib/site-service";
import { templateById } from "@/lib/templates";

// Switch templates: rebuilds the page set from the template bundle and applies
// its palette/font/header. Blog posts live in their own table and survive.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });

  const body = await req.json();
  if (typeof body.templateId !== "string" || !templateById(body.templateId)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }
  await applyTemplateToWebsite(website.id, body.templateId);
  return NextResponse.json({ ok: true });
}
