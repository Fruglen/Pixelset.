import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { cleanGroup, codeTaken, ownedCollection } from "./shared";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = await ownedCollection(params.id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const groups = await db.accessGroup.findMany({ where: { collectionId: c.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const c = await ownedCollection(params.id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { data, error } = cleanGroup({ code: randomBytes(6).toString("hex").toUpperCase(), ...body }, c.sets.map((s) => s.id));
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!data.name) return NextResponse.json({ error: "Give the group a name" }, { status: 400 });
  if (await codeTaken(c.id, data.code!)) return NextResponse.json({ error: "That code is already used in this gallery" }, { status: 409 });
  const group = await db.accessGroup.create({
    data: {
      collectionId: c.id,
      name: data.name,
      code: data.code!,
      canDownload: data.canDownload ?? true,
      downloadSizes: data.downloadSizes ?? "web2048",
      setIds: data.setIds ?? "",
    },
  });
  return NextResponse.json({ group });
}
