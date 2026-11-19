import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const FIELD_TYPES = ["text", "textarea", "choice", "date"];

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.leadForm.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const form = await own(params.id);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  for (const k of ["heading", "intro", "thanks"] as const) if (typeof body[k] === "string") data[k] = body[k].slice(0, 2000);
  for (const k of ["createProject", "active"] as const) if (typeof body[k] === "boolean") data[k] = body[k];
  if (Array.isArray(body.fields)) {
    data.fields = JSON.stringify(
      body.fields
        .filter((f: Record<string, unknown>) => f && typeof f.label === "string" && (f.label as string).trim())
        .slice(0, 30)
        .map((f: Record<string, unknown>, i: number) => ({
          id: typeof f.id === "string" && f.id ? f.id : `f${Date.now()}_${i}`,
          type: FIELD_TYPES.includes(f.type as string) ? f.type : "text",
          label: (f.label as string).trim(),
          options: typeof f.options === "string" ? f.options : "",
          required: f.required === true,
        }))
    );
  }
  await db.leadForm.update({ where: { id: form.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const form = await own(params.id);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.leadForm.delete({ where: { id: form.id } });
  return NextResponse.json({ ok: true });
}
