import { notFound } from "next/navigation";
import { COURSES_WAITING_REASON, coursesAvailable, getCourse, listLessons } from "@/lib/courses";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Night build (Extras): the public course viewer. Clients open it from
// the link the photographer shares and unlock lessons with the access
// code (checked server side by the lessons API when the tables land).
// Until the Course tables exist this page reports the honest state.
export default async function CourseViewerPage({ params }: { params: { id: string } }) {
  if (!coursesAvailable()) {
    return (
      <div className="min-h-screen bg-white text-ink flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl mb-2">Online courses</h1>
          <p className="text-sm text-neutral-500">{COURSES_WAITING_REASON}</p>
        </div>
      </div>
    );
  }
  const course = await getCourse(params.id);
  if (!course || !course.published) notFound();
  const lessons = await listLessons(course.id);
  const owner = await db.user.findUnique({
    where: { id: course.userId },
    select: { businessName: true, name: true },
  });

  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-neutral-400">{owner?.businessName || owner?.name}</p>
        <h1 className="font-display text-3xl mt-1">{course.title}</h1>
        {course.description && <p className="text-neutral-600 mt-3">{course.description}</p>}
        <ol className="mt-8 space-y-3">
          {lessons.map((l, i) => (
            <li key={l.id} className="border border-neutral-200 rounded-lg px-4 py-3">
              <p className="font-medium">
                {i + 1}. {l.title}
              </p>
              {l.body && <p className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{l.body}</p>}
              {l.videoUrl && (
                <p className="text-sm mt-1">
                  <a className="underline" href={l.videoUrl}>
                    Watch the lesson video
                  </a>
                </p>
              )}
            </li>
          ))}
          {lessons.length === 0 && <li className="text-sm text-neutral-500">Lessons are on the way.</li>}
        </ol>
      </div>
    </div>
  );
}
