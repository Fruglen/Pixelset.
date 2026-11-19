import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { paletteById, fontById } from "@/lib/design";
import AutoRefresh from "./auto-refresh";

export const dynamic = "force-dynamic";

// Phase 5B: landing page for an emailed Download All link (lists the ZIP parts).
export default async function DownloadJobPage({ params }: { params: { token: string } }) {
  const job = await db.downloadJob.findUnique({ where: { token: params.token }, include: { collection: { include: { user: true } } } });
  if (!job) notFound();
  const c = job.collection;
  const palette = paletteById(c.palette);
  const font = fontById(c.fontPairing);
  const parts = JSON.parse(job.parts) as { name: string; files: number; bytes: number }[];
  const expired = job.expiresAt < new Date();
  const brand = c.user.businessName || c.user.name;
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: palette.bg, color: palette.text, fontFamily: font.body }}>
      <div className="max-w-md w-full text-center">
        <p className="text-sm opacity-70 mb-6" style={{ fontFamily: font.display }}>{brand}</p>
        <h1 className="text-3xl mb-2" style={{ fontFamily: font.display }}>{c.name}</h1>
        {expired ? (
          <p className="text-sm opacity-70">This download link has expired. Please ask {brand} for a new one.</p>
        ) : job.status === "PENDING" ? (
          <>
            <p className="text-sm opacity-70">Your download is being prepared. This page refreshes on its own, and an email is sent when it is ready (when the photographer has email connected).</p>
            <AutoRefresh />
          </>
        ) : job.status === "FAILED" ? (
          <p className="text-sm text-red-600">This download could not be prepared: {job.error}</p>
        ) : (
          <>
            <p className="text-sm opacity-70 mb-6">
              {parts.reduce((n, p) => n + p.files, 0)} files ready in {parts.length} ZIP file{parts.length === 1 ? "" : "s"}. Link expires{" "}
              {job.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            </p>
            <div className="space-y-2">
              {parts.map((p, i) => (
                <a
                  key={p.name}
                  href={`/api/download/job/${job.token}?part=${i + 1}`}
                  className="flex items-center justify-between border px-4 py-3 text-sm hover:opacity-70"
                  style={{ borderColor: palette.text }}
                >
                  <span>{p.name}</span>
                  <span className="opacity-60">
                    {p.files} files · {(p.bytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
