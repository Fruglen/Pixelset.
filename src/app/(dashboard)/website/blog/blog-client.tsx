"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  publishedAt: string | null;
  updatedAt: string;
}

export function BlogListClient({ posts, siteSlug }: { posts: PostRow[]; siteSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createPost() {
    setBusy(true);
    const res = await fetch("/api/website/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled post" }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/website/blog/${data.id}`);
    }
  }

  async function remove(post: PostRow) {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await fetch(`/api/website/blog/${post.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">
          Journal posts live at /blog on your site. They survive template switches.
        </p>
        <button className="btn-primary" onClick={createPost} disabled={busy}>
          {busy ? "Creating…" : "+ New post"}
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="card p-10 text-center text-sm text-neutral-500">
          No posts yet. Write your first journal entry, session stories, planning tips, behind the scenes.
        </div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/website/blog/${post.id}`} className="font-medium text-sm hover:underline truncate">
                    {post.title}
                  </Link>
                  <span
                    className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                      post.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {post.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5 truncate">
                  /blog/{post.slug}
                  {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ""}
                  {post.excerpt ? ` · ${post.excerpt}` : ""}
                </p>
              </div>
              <a
                href={`/site/${siteSlug}/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-500 hover:text-neutral-900 underline"
              >
                View
              </a>
              <Link href={`/website/blog/${post.id}`} className="btn-secondary !py-1.5 !px-3 text-xs">
                Edit
              </Link>
              <button onClick={() => remove(post)} className="text-neutral-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
