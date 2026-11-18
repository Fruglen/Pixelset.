"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  body: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
}

export function PostEditor({ post, siteSlug }: { post: PostData; siteSlug: string }) {
  const router = useRouter();
  const [form, setForm] = useState(post);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof PostData>(key: K, value: PostData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save(status?: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/website/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status: status ?? form.status }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    if (status) setForm((f) => ({ ...f, status }));
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/website/blog" className="text-sm text-neutral-500 hover:text-neutral-900">← Blog</Link>
        <span
          className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
            form.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {form.status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
        <div className="flex-1" />
        <a href={`/site/${siteSlug}/blog/${form.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">
          Preview ↗
        </a>
        {form.status === "PUBLISHED" ? (
          <button className="btn-secondary" disabled={saving} onClick={() => save("DRAFT")}>Unpublish</button>
        ) : (
          <button className="btn-secondary" disabled={saving} onClick={() => save("PUBLISHED")}>Publish</button>
        )}
        <button className="btn-primary" disabled={saving || !dirty} onClick={() => save()}>
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <div className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input text-lg" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">URL slug</label>
            <input className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
          <div>
            <label className="label">Excerpt</label>
            <input className="input" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="label">Cover image URL</label>
            <input className="input" placeholder="https://…" value={form.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} />
          </div>
          <div>
            <label className="label">Cover alt text</label>
            <input className="input" value={form.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} />
          </div>
        </div>
        {form.coverUrl ? <img src={form.coverUrl} alt={form.coverAlt} className="w-full max-h-64 object-cover rounded border border-neutral-200" /> : null}
        <div>
          <label className="label">Body</label>
          <textarea
            className="input font-mono text-[13px] leading-relaxed"
            rows={18}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={"Write your post…\n\nBlank line starts a new paragraph.\n## A line starting with ## becomes a heading.\n> A line starting with > becomes a pull quote."}
          />
          <p className="text-xs text-neutral-400 mt-1">Formatting: blank line = paragraph · “## ” = heading · “&gt; ” = pull quote.</p>
        </div>
        <div className="card p-4">
          <p className="label mb-3">Search engine listing</p>
          <div className="space-y-3">
            <div>
              <label className="label">SEO title (defaults to the post title)</label>
              <input className="input" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            </div>
            <div>
              <label className="label">SEO description (defaults to the excerpt)</label>
              <textarea className="input" rows={2} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
