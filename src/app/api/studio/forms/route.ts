import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B: standalone lead forms with their own public link.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const form = await db.leadForm.create({
    data: {
      userId: user.id,
      name,
      heading: "Let's work together",
      intro: "Tell us a little about what you have in mind and we'll be in touch within two business days.",
      fields: JSON.stringify([
        { id: "type", type: "choice", label: "What are you looking for?", options: "Wedding, Portrait, Family, Brand, Other", required: true },
        { id: "date", type: "date", label: "Event or preferred date", options: "", required: false },
        { id: "message", type: "textarea", label: "Tell us more", options: "", required: false },
      ]),
    },
  });
  return NextResponse.json({ id: form.id });
}
