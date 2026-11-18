import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PostEditor } from "./post-editor";

export const dynamic = "force-dynamic";

export default async function BlogPostEditorPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");
  const post = await db.blogPost.findFirst({ where: { id: params.id, websiteId: website.id } });
  if (!post) notFound();

  return (
    <PostEditor
      siteSlug={website.slug}
      post={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverUrl: post.coverUrl,
        coverAlt: post.coverAlt,
        body: post.body,
        status: post.status,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
      }}
    />
  );
}
