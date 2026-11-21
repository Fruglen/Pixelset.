import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tokenUnauthorized, userFromBearer } from "@/lib/api-token";

// Build pack 2026-11-20 (Lightroom groundwork): a cheap "test connection"
// call for upload clients. Returns which account the token belongs to and the
// upload limits that apply, never the token or any secret.
export async function GET(req: NextRequest) {
  const user = await userFromBearer(req);
  if (!user) return tokenUnauthorized();
  const collections = await db.collection.count({ where: { userId: user.id } });
  return NextResponse.json({
    ok: true,
    account: { name: user.businessName || user.name, email: user.email },
    collections,
    endpoints: {
      collections: "/api/v1/collections",
      upload: "/api/v1/collections/{collectionId}/photos",
    },
    upload: { field: "file", maxFilesPerRequest: 20, setIdOptional: true },
  });
}
