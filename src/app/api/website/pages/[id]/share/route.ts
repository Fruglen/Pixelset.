import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks";
import { makeShareCode } from "@/lib/site-share";

export const runtime = "nodejs";

// Night build (Website): build a share code for one of the owner's pages.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  const page = await db.sitePage.findFirst({ where: { id: params.id, websiteId: website.id } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  const code = makeShareCode({ v: 1, kind: "page", title: page.title, blocks: parseBlocks(page.blocks) });
  return NextResponse.json({ code, title: page.title });
}
