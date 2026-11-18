import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const q = await db.questionnaire.create({
    data: {
      userId: user.id,
      name,
      fields: JSON.stringify([
        { id: "f1", type: "text", label: "What is the occasion?", options: "", required: true },
        { id: "f2", type: "textarea", label: "Anything we should know beforehand?", options: "", required: false },
      ]),
    },
  });
  return NextResponse.json({ id: q.id });
}
