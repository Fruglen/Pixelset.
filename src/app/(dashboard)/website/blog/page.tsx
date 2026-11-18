import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BlogListClient } from "./blog-client";

export const dynamic = "force-dynamic";

export default async function WebsiteBlogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");

  const posts = await db.blogPost.findMany({
    where: { websiteId: website.id },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <BlogListClient
      siteSlug={website.slug}
      posts={posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        excerpt: p.excerpt,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}
