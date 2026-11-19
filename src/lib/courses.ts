import { db } from "./db";

// ---------------------------------------------------------------------------
// Night build (Extras): online courses for clients (sell or gift a course
// of lessons alongside galleries). The Course, CourseLesson and
// CourseAccess tables are logged in NIGHT-SCHEMA-NEEDS.md and were not part
// of the centrally applied night schema, so this data layer is guarded the
// same way Builder A's site-ext fields are: when the Prisma models exist
// the feature lights up with no code change; until then reads return empty
// and writes report the honest reason. The dashboard and public pages are
// fully built against this layer.
// ---------------------------------------------------------------------------

export interface CourseRow {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverUrl: string;
  priceCents: number;
  published: boolean;
  accessCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseLessonRow {
  id: string;
  courseId: string;
  title: string;
  body: string;
  videoUrl: string;
  order: number;
  createdAt: Date;
}

interface CourseModel {
  findMany: (args: unknown) => Promise<CourseRow[]>;
  findFirst: (args: unknown) => Promise<CourseRow | null>;
  create: (args: unknown) => Promise<CourseRow>;
  update: (args: unknown) => Promise<CourseRow>;
  delete: (args: unknown) => Promise<CourseRow>;
}

interface LessonModel {
  findMany: (args: unknown) => Promise<CourseLessonRow[]>;
  create: (args: unknown) => Promise<CourseLessonRow>;
  delete: (args: unknown) => Promise<CourseLessonRow>;
}

function model<T>(name: string): T | null {
  const m = (db as unknown as Record<string, unknown>)[name];
  return m && typeof m === "object" ? (m as T) : null;
}

export function coursesAvailable(): boolean {
  return model<CourseModel>("course") !== null;
}

export const COURSES_WAITING_REASON =
  "Online courses are waiting on their database tables (Course, CourseLesson, CourseAccess, logged in NIGHT-SCHEMA-NEEDS.md). The pages and data layer are built; the feature switches on when the tables land.";

export async function listCourses(userId: string): Promise<CourseRow[]> {
  const course = model<CourseModel>("course");
  if (!course) return [];
  try {
    return await course.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  } catch {
    return [];
  }
}

export async function getCourse(id: string, userId?: string): Promise<CourseRow | null> {
  const course = model<CourseModel>("course");
  if (!course) return null;
  try {
    return await course.findFirst({ where: userId ? { id, userId } : { id } });
  } catch {
    return null;
  }
}

export async function listLessons(courseId: string): Promise<CourseLessonRow[]> {
  const lesson = model<LessonModel>("courseLesson");
  if (!lesson) return [];
  try {
    return await lesson.findMany({ where: { courseId }, orderBy: { order: "asc" } });
  } catch {
    return [];
  }
}

export async function createCourse(
  userId: string,
  data: { title: string; description?: string; priceCents?: number },
): Promise<CourseRow> {
  const course = model<CourseModel>("course");
  if (!course) throw new Error(COURSES_WAITING_REASON);
  return course.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? "",
      priceCents: data.priceCents ?? 0,
      accessCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
  });
}
