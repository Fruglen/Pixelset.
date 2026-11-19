import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { jobDir } from "@/lib/zip";

export const runtime = "nodejs";

// Phase 5B: serves one ZIP part of an emailed Download All job.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const job = await db.downloadJob.findUnique({ where: { token: params.token } });
  if (!job) return NextResponse.json({ error: "Unknown download link" }, { status: 404 });
  if (job.expiresAt < new Date()) return NextResponse.json({ error: "This download link has expired. Ask your photographer for a new one." }, { status: 410 });
  if (job.status !== "READY") return NextResponse.json({ error: job.status === "FAILED" ? "This download could not be prepared" : "Still preparing, try again in a moment" }, { status: 409 });
  const parts = JSON.parse(job.parts) as { name: string }[];
  const n = Math.max(1, Math.min(parts.length, Number(req.nextUrl.searchParams.get("part")) || 1));
  try {
    const buf = await readFile(path.join(jobDir(job.token), `part-${n}.zip`));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${parts[n - 1].name}"` },
    });
  } catch {
    return NextResponse.json({ error: "File missing, ask your photographer for a new link" }, { status: 410 });
  }
}
