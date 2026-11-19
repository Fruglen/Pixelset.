import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { COURSES_WAITING_REASON, coursesAvailable, createCourse, listCourses } from "@/lib/courses";

// Night build (Extras): online courses API. Guarded until the Course
// tables land (NIGHT-SCHEMA-NEEDS.md): GET answers honestly, POST returns
// 501 with the reason rather than pretending.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    available: coursesAvailable(),
    reason: coursesAvailable() ? "" : COURSES_WAITING_REASON,
    courses: await listCourses(user.id),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!coursesAvailable()) {
    return NextResponse.json({ error: COURSES_WAITING_REASON }, { status: 501 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Give the course a title" }, { status: 400 });
  const course = await createCourse(user.id, {
    title,
    description: typeof body.description === "string" ? body.description : "",
    priceCents: typeof body.priceCents === "number" ? Math.max(0, Math.round(body.priceCents)) : 0,
  });
  return NextResponse.json({ ok: true, course });
}
