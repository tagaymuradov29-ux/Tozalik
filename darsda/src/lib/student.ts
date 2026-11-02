import "server-only";
import { sql } from "./db";
import type { User } from "./auth";
import { currentCourse, getLessons, getTasks, pointsAll, type Course, type Lesson, type Sub, type Task } from "./course";

export type Att = { lesson_id: number; status: string; late_min: number; reason: string };

/** O'quvchi sahifalari uchun umumiy ma'lumot */
export async function studentCtx(u: User, uid = u.id) {
  const course = await currentCourse(u);
  if (!course) return null;
  const [lessons, tasks, subs, att] = await Promise.all([
    getLessons(course.id),
    getTasks(course.id),
    sql<Sub[]>`select s.* from submissions s join tasks t on t.id = s.task_id
      where s.user_id = ${uid} and t.course_id = ${course.id} order by s.created_at desc`,
    sql<Att[]>`select a.lesson_id, a.status, a.late_min, a.reason from attendance a
      join lessons l on l.id = a.lesson_id where a.user_id = ${uid} and l.course_id = ${course.id}`,
  ]);
  return { course, lessons, tasks, subs, att };
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
