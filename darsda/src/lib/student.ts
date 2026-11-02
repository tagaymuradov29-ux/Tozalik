import "server-only";
import { sql } from "./db";
import type { User } from "./auth";
import { currentCourse, getLessons, getTasks, pointsAll, type Course, type Lesson, type Sub, type Task } from "./course";
import { lessonProgress, type LState, type Watch } from "./progress";

export type Att = { lesson_id: number; status: string; late_min: number; reason: string };

/** O'quvchi sahifalari uchun umumiy ma'lumot */
export async function studentCtx(u: User, uid = u.id) {
  const course = await currentCourse(u);
  if (!course) return null;
  const [lessons, tasks, subs, att, watch, [who]] = await Promise.all([
    getLessons(course.id),
    getTasks(course.id),
    sql<Sub[]>`select s.* from submissions s join tasks t on t.id = s.task_id
      where s.user_id = ${uid} and t.course_id = ${course.id} order by s.created_at desc`,
    sql<Att[]>`select a.lesson_id, a.status, a.late_min, a.reason from attendance a
      join lessons l on l.id = a.lesson_id where a.user_id = ${uid} and l.course_id = ${course.id}`,
    sql<Watch[]>`select v.lesson_id, v.done, v.max_pos, v.duration from video_progress v
      join lessons l on l.id = v.lesson_id where v.user_id = ${uid} and l.course_id = ${course.id}`,
    sql<{ created_at: Date }[]>`select created_at from users where id = ${uid}`,
  ]);
  return { course, lessons, tasks, subs, att, watch, joinedAt: new Date(who?.created_at ?? 0) };
}

export type Ctx = NonNullable<Awaited<ReturnType<typeof studentCtx>>>;

/** Yo'l xaritasi uchun: har dars holati, shartlar ro'yxati va «siz shu yerdasiz» (birinchi yopilmagan dars) */
export function road(ctx: Ctx) {
  const now = new Date();
  const prog = ctx.lessons.map((l) => lessonProgress(l, ctx.course, ctx.tasks, ctx.subs,
    ctx.att.find((a) => a.lesson_id === l.id), ctx.watch.find((w) => w.lesson_id === l.id), ctx.joinedAt, now));
  const states: LState[] = prog.map((p) => p.st);
  let here = states.findIndex((st) => st === "debt" || st === "current" || st === "review");
  if (here < 0) here = Math.max(0, states.findIndex((st) => st === "locked") - 1);
  if (here < 0) here = states.length - 1;
  const opened = states.filter((st) => st !== "locked").length;
  const closed = states.filter((st) => st === "done").length;
  return { prog, states, here, opened, closed, debts: states.filter((st) => st === "debt").length };
}

export async function ranking(course: Course, groupId?: number | null) {
  const pts = await pointsAll(course);
  const users = await sql<{ id: number; name: string; group_id: number; group_name: string }[]>`
    select u.id, u.name, u.group_id, g.name as group_name from users u join groups g on g.id = u.group_id
    where g.course_id = ${course.id} and u.role = 'student' and u.active`;
  const list = users
    .filter((x) => !groupId || x.group_id === groupId)
    .map((x) => ({ ...x, ...(pts.get(x.id) ?? { tasks: 0, attend: 0, bonus: 0, net: 0, ws: 0, total: 0 }) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return list.map((x, i) => ({ ...x, rank: i + 1 }));
}

export function nextLesson(lessons: Lesson[]) {
  const now = Date.now();
  return lessons.find((l) => new Date(l.starts_at).getTime() + l.duration_min * 60000 > now) ?? null;
}

export function lessonTasks(tasks: Task[], lessonId: number) {
  return tasks.filter((t) => t.lesson_id === lessonId);
}
