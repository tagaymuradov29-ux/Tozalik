import "server-only";
import { sql } from "./db";
import type { User } from "./auth";

export type MyCourse = { id: number; course_id: number; course: string; group_name: string; lang: string; category: string; current: boolean };

/** O'quvchining shu platformadagi barcha kurslari (bir raqam + bir xil parol/tasdiq — bitta odam) */
export async function myCourses(u: User): Promise<MyCourse[]> {
  if (u.role !== "student") return [];
  return sql<MyCourse[]>`
    select s.id, c.id as course_id, c.title as course, g.name as group_name, c.lang, c.category, (s.id = ${u.id}) as current
    from users s join users me on me.id = ${u.id}
    join groups g on g.id = s.group_id join courses c on c.id = g.course_id
    where s.platform_id = me.platform_id and s.phone = me.phone and s.role = 'student' and s.active
      and s.password_hash = me.password_hash
    order by c.id desc`;
}

/** Sinov va yangi kurs uchun: shu odamning kursdagi o'quvchi hisobi (bo'lmasa yaratiladi) */
export async function studentIn(templateId: number, courseId: number) {
  const [t] = await sql<{ platform_id: number; phone: string; name: string; password_hash: string }[]>`
    select platform_id, phone, name, password_hash from users where id = ${templateId}`;
  if (!t) return null;
  const [ex] = await sql<{ id: number }[]>`select u.id from users u join groups g on g.id = u.group_id
    where u.platform_id = ${t.platform_id} and u.phone = ${t.phone} and u.role = 'student' and g.course_id = ${courseId} limit 1`;
  if (ex) return ex.id;
  const [g] = await sql<{ id: number }[]>`select id from groups where course_id = ${courseId} order by id limit 1`;
  if (!g) return null;
  const [n] = await sql<{ id: number }[]>`insert into users (platform_id, phone, password_hash, name, role, group_id)
    values (${t.platform_id}, ${t.phone}, ${t.password_hash}, ${t.name}, 'student', ${g.id}) returning id`;
  return n.id;
}
