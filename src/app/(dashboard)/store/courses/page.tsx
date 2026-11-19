import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { COURSES_WAITING_REASON, coursesAvailable, listCourses, listLessons } from "@/lib/courses";
import { fmtMoney } from "@/lib/studio";
import { CreateCourse } from "./create-course";

export const dynamic = "force-dynamic";

// Night build (Extras): online courses for clients. The dashboard, the API
// and the public viewer are built; the Course tables are logged in
// NIGHT-SCHEMA-NEEDS.md, so until they land this page says so plainly
// instead of faking a course list.
export default async function CoursesPage() {
  const user = (await getCurrentUser())!;
  const available = coursesAvailable();
  const courses = await listCourses(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display">Online courses</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Teach what you shoot: a course of lessons clients can buy or be given access to, sold alongside your
          galleries.
        </p>
      </div>

      {!available && (
        <div className="card p-5">
          <p className="font-medium">Courses are not switched on yet</p>
          <p className="text-sm text-neutral-500 mt-1">{COURSES_WAITING_REASON}</p>
        </div>
      )}

      {available && <CreateCourse />}

      {available && courses.length === 0 && (
        <div className="card p-5 text-sm text-neutral-500">No courses yet. Create your first one above.</div>
      )}

      {courses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {await Promise.all(
            courses.map(async (c) => {
              const lessons = await listLessons(c.id);
              return (
                <div key={c.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {lessons.length} lesson{lessons.length === 1 ? "" : "s"} ·{" "}
                        {c.priceCents > 0 ? fmtMoney(c.priceCents) : "Free"} · {c.published ? "Published" : "Draft"}
                      </p>
                    </div>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 border ${c.published ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-50 text-neutral-500 border-neutral-200"}`}
                    >
                      {c.published ? "Live" : "Draft"}
                    </span>
                  </div>
                  {c.description && <p className="text-sm text-neutral-600 mt-2">{c.description}</p>}
                  <p className="text-sm mt-3">
                    Client link:{" "}
                    <Link className="underline" href={`/course/${c.id}`}>
                      /course/{c.id}
                    </Link>{" "}
                    (access code {c.accessCode})
                  </p>
                </div>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
