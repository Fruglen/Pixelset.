import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { runDownloadJob } from "@/lib/zip";

// Send as Download from a favorite list: the photographer turns a client's
// favorite list into a download delivery. Reuses the Download All machinery:
// a DownloadJob is created for exactly the list's photos, the ZIP is built in
// the background, and the client is emailed the expiring /d/[token] link
// (runDownloadJob sends it; delivery state lands in Activities).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await db.favoriteList.findUnique({
    where: { id: params.id },
    include: { collection: true, favorites: true },
  });
  if (!list || list.collection.userId !== user.id) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  if (list.favorites.length === 0) {
    return NextResponse.json({ error: "This list is empty, there is nothing to send" }, { status: 400 });
  }
  if (!list.clientEmail || !list.clientEmail.includes("@")) {
    return NextResponse.json({ error: "This list has no client email to send the download to" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const offered = list.collection.downloadSizes.split(",").filter(Boolean);
  const size = typeof body.size === "string" && offered.includes(body.size) ? body.size : offered[0] ?? "original";

  const job = await db.downloadJob.create({
    data: {
      collectionId: list.collectionId,
      token: randomBytes(16).toString("hex"),
      email: list.clientEmail,
      size,
      photoIds: list.favorites.map((f) => f.photoId).join(","),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  await logActivity(
    list.collectionId,
    "DOWNLOAD_ALL",
    `Favorite list "${list.name}" sent as a download to ${list.clientEmail} (${list.favorites.length} photos)`,
    list.clientEmail
  );
  // Build after responding; the server keeps running the job, and the client
  // email goes out from runDownloadJob when the ZIP is ready.
  setTimeout(() => {
    runDownloadJob(job.id).catch(() => {});
  }, 10);
  return NextResponse.json({ ok: true, link: `/d/${job.token}`, email: list.clientEmail, count: list.favorites.length });
}
