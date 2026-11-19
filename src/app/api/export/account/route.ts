import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { buildAccountExport } from "@/lib/account-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 5B: full account export ZIP (every record as CSV and JSON, originals
// manifest, and with ?files=1 the original files themselves).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const includeFiles = req.nextUrl.searchParams.get("files") === "1";
  const { stream } = await buildAccountExport(user.id, includeFiles);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(Readable.toWeb(stream as unknown as Readable) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pixelset-account-${includeFiles ? "full" : "data"}-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
