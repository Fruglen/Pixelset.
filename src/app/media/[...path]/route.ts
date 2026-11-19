import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { b2Enabled, presignGet } from "@/lib/storage";
import { contentTypeFor } from "@/lib/media";

export const runtime = "nodejs";

// Serves B2-backed stored files. Photo/asset URLs point here (/media/<key>)
// instead of at files in public/, so uploads written at runtime are visible
// immediately (the old public/ files only appeared after a server restart)
// and survive the instance's ephemeral disk. With B2 configured we redirect
// to a short-lived presigned GET so bytes flow straight from Backblaze, not
// through this 512 MB server. Without B2 (dev), stream the local file.

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = (params.path ?? []).map((seg) => decodeURIComponent(seg)).join("/");
  if (!key || key.includes("..")) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (b2Enabled()) {
    try {
      const url = await presignGet(key, 3600);
      return NextResponse.redirect(url, {
        status: 302,
        headers: { "Cache-Control": "private, max-age=300" },
      });
    } catch {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
  }

  const file = path.join(process.cwd(), "public", key);
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("not a file");
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Length": String(st.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
