import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });

  const body = await req.json();
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled post";

  let slug = slugify(title) || "post";
  let candidate = slug;
  let i = 1;
  while (await db.blogPost.findUnique({ where: { websiteId_slug: { websiteId: website.id, slug: candidate } } })) {
    candidate = `${slug}-${++i}`;
  }

  const post = await db.blogPost.create({
    data: { websiteId: website.id, title, slug: candidate },
  });
  return NextResponse.json({ id: post.id });
}
