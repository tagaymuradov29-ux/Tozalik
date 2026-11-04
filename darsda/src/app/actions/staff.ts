"use server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { normPhone, requireUser, type User } from "@/lib/auth";
import { currentCourse, notify } from "@/lib/course";
import type { FormState } from "./auth";

/** Xodim shu o'quvchini boshqara oladimi: admin — o'z platformasida, kurator — o'z guruhida */
async function canManage(u: User, studentId: number) {
  const [r] = await sql`
    select 1 from users s join groups g on g.id = s.group_id
    where s.id = ${studentId} and s.platform_id = ${u.platform_id}
      and (${u.role === "admin"} or g.curator_id = ${u.id})`;
  return !!r;
}

export async function gradeSubmission(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision") || "");
  const feedback = String(fd.get("feedback") || "").trim();
  const [s] = await sql<{ id: number; user_id: number; status: string; late: boolean; max_points: number; late_points: number | null; title: string; task_id: number; kind: string }[]>`
    select s.id, s.user_id, s.status, s.late, t.max_points, t.late_points, t.title, t.id as task_id, t.kind
    from submissions s join tasks t on t.id = s.task_id where s.id = ${id}`;
  if (!s || !(await canManage(u, s.user_id))) return { error: "Ruxsat yo'q" };
  if (decision === "reject") {
    if (!feedback) return { error: "Qaytarish sababini yozing" };
    await sql`update submissions set status = 'rejected', points = null, feedback = ${feedback}, graded_by = ${u.id}, graded_at = now() where id = ${id}`;
    await notify([s.user_id], `«${s.title}» qaytarildi`, feedback, `/vazifa/${s.task_id}`);
  } else {
    const cap = s.late ? s.late_points ?? s.max_points : s.max_points;
    const pts = Math.max(0, Math.min(cap, Math.round(Number(fd.get("points") ?? cap))));
    await sql`update submissions set status = 'approved', points = ${pts}, feedback = ${feedback}, graded_by = ${u.id}, graded_at = now() where id = ${id}`;
    if (s.kind !== "repeat")
      await sql`update submissions set status = 'cancelled' where task_id = ${s.task_id} and user_id = ${s.user_id} and id <> ${id} and status = 'pending'`;
    await notify([s.user_id], `«${s.title}» qabul qilindi: +${pts} ball`, feedback, `/vazifa/${s.task_id}`);
  }
  revalidatePath("/", "layout");
  return { ok: decision === "reject" ? "Qaytarildi" : "Baholandi" };
}

export async function reopenSubmission(fd: FormData) {
  const u = await requireUser(["admin", "curator"]);
  const id = Number(fd.get("id"));
  const [s] = await sql<{ user_id: number }[]>`select user_id from submissions where id = ${id}`;
  if (!s || !(await canManage(u, s.user_id))) return;
  await sql`update submissions set status = 'pending', points = null, graded_by = null, graded_at = null where id = ${id}`;
  revalidatePath("/", "layout");
}

export async function markAttendance(fd: FormData) {
  const u = await requireUser(["admin", "curator"]);
  const lessonId = Number(fd.get("lesson_id"));
  const uid = Number(fd.get("user_id"));
  const status = String(fd.get("status"));
  if (!(await canManage(u, uid))) return;
  if (status === "clear") {
    await sql`delete from attendance where lesson_id = ${lessonId} and user_id = ${uid}`;
  } else if (["ontime", "late", "absent", "excused"].includes(status)) {
    const late = status === "late" ? Number(fd.get("late_min") || 15) : 0;
    await sql`insert into attendance (lesson_id, user_id, status, late_min, src, marked_by, reason)
      values (${lessonId}, ${uid}, ${status}, ${late}, 'kurator', ${u.id}, ${String(fd.get("reason") || "")})
      on conflict (lesson_id, user_id) do update set status = excluded.status, late_min = excluded.late_min,
        src = 'kurator', marked_by = excluded.marked_by, reason = case when excluded.reason = '' then attendance.reason else excluded.reason end`;
  }
  revalidatePath("/", "layout");
}

export async function addBonus(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const uid = Number(fd.get("user_id"));
  const pts = Math.round(Number(fd.get("points")));
  const note = String(fd.get("note") || "").trim();
  if (!(await canManage(u, uid))) return { error: "Ruxsat yo'q" };
  if (!pts || Math.abs(pts) > 500) return { error: "Ball −500…+500 oralig'ida bo'lsin" };
  if (!note) return { error: "Izoh yozing (nima uchun)" };
  await sql`insert into bonuses (user_id, points, note, by_id) values (${uid}, ${pts}, ${note}, ${u.id})`;
  await notify([uid], pts > 0 ? `+${pts} bonus ball` : `${pts} ball`, note, "/natijalar");
  revalidatePath("/", "layout");
  return { ok: "Qo'shildi" };
}

export async function deleteBonus(fd: FormData) {
  const u = await requireUser(["admin"]);
  await sql`delete from bonuses b using users s where b.id = ${Number(fd.get("id"))} and s.id = b.user_id and s.platform_id = ${u.platform_id}`;
  revalidatePath("/", "layout");
}

export async function createInvite(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const role = String(fd.get("role") || "student");
  const gid = Number(fd.get("group_id") || 0) || null;
  if (u.role === "curator" && role !== "student") return { error: "Kurator faqat o'quvchi taklif qila oladi" };
  if (!["student", "curator", "admin"].includes(role)) return { error: "Noto'g'ri rol" };
  if (role === "student" && !gid) return { error: "Guruhni tanlang" };
  if (gid) {
    const [g] = await sql`select 1 from groups where id = ${gid} and platform_id = ${u.platform_id}
      and (${u.role === "admin"} or curator_id = ${u.id})`;
    if (!g) return { error: "Guruh topilmadi" };
  }
  const [ex] = await sql<{ code: string }[]>`
    select code from invites where platform_id = ${u.platform_id} and role = ${role}
      and coalesce(group_id, 0) = ${gid ?? 0} and active limit 1`;
  if (!ex) {
    const code = randomBytes(5).toString("base64url");
    await sql`insert into invites (code, platform_id, role, group_id, created_by) values (${code}, ${u.platform_id}, ${role}, ${gid}, ${u.id})`;
  }
  revalidatePath("/guruh");
  return { ok: "Havola tayyor — pastdan nusxa oling" };
}

export async function revokeInvite(fd: FormData) {
  const u = await requireUser(["admin", "curator"]);
  await sql`update invites set active = false where code = ${String(fd.get("code"))} and platform_id = ${u.platform_id}
    and (${u.role === "admin"} or created_by = ${u.id})`;
  revalidatePath("/guruh");
}

export async function saveGroup(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin"]);
  const course = await currentCourse(u);
  if (!course) return { error: "Kurs yo'q" };
  const id = Number(fd.get("id") || 0);
  const name = String(fd.get("name") || "").trim();
  const cur = Number(fd.get("curator_id") || 0) || null;
  if (!name) return { error: "Guruh nomini yozing" };
  if (cur) {
    const [c] = await sql`select 1 from users where id = ${cur} and platform_id = ${u.platform_id} and role in ('curator','admin')`;
    if (!c) return { error: "Kurator topilmadi" };
  }
  if (id) await sql`update groups set name = ${name}, curator_id = ${cur} where id = ${id} and platform_id = ${u.platform_id}`;
  else await sql`insert into groups (platform_id, course_id, name, curator_id) values (${u.platform_id}, ${course.id}, ${name}, ${cur})`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function updateStudent(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const uid = Number(fd.get("user_id"));
  const [target] = await sql<{ role: string }[]>`select role from users where id = ${uid} and platform_id = ${u.platform_id}`;
  if (!target) return { error: "Topilmadi" };
  if (target.role === "student" && !(await canManage(u, uid))) return { error: "Ruxsat yo'q" };
  if (target.role !== "student" && u.role !== "admin") return { error: "Ruxsat yo'q" };
  const name = String(fd.get("name") || "").trim();
  if (name) await sql`update users set name = ${name} where id = ${uid}`;
  const pass = String(fd.get("password") || "");
  if (pass) {
    if (pass.length < 6) return { error: "Parol kamida 6 belgi" };
    await sql`update users set password_hash = ${bcrypt.hashSync(pass, 10)} where id = ${uid}`;
  }
  const gid = Number(fd.get("group_id") || 0);
  if (gid && u.role === "admin" && target.role === "student") {
    await sql`update users set group_id = ${gid} where id = ${uid} and exists (select 1 from groups where id = ${gid} and platform_id = ${u.platform_id})`;
  }
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function addUser(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const role = u.role === "curator" ? "student" : String(fd.get("role") || "student");
  const name = String(fd.get("name") || "").trim();
  const phone = normPhone(String(fd.get("phone") || ""));
  const pass = String(fd.get("password") || "");
  const gid = Number(fd.get("group_id") || 0) || null;
  if (!name || phone.length < 9 || pass.length < 6) return { error: "Ism, telefon va parol (6+) kerak" };
  if (role === "student") {
    if (!gid) return { error: "Guruhni tanlang" };
    const [g] = await sql`select 1 from groups where id = ${gid} and platform_id = ${u.platform_id} and (${u.role === "admin"} or curator_id = ${u.id})`;
    if (!g) return { error: "Guruh topilmadi" };
  }
  const ex = await sql<{ id: number; role: string; course_id: number | null; password_hash: string }[]>`
    select u.id, u.role, g.course_id, u.password_hash from users u left join groups g on g.id = u.group_id where u.platform_id = ${u.platform_id} and u.phone = ${phone}`;
  if (role !== "student" && ex.some((x) => x.role === role)) return { error: "Bu raqam allaqachon bor" };
  if (role === "student" && ex.some((x) => x.role === "student")) {
    const [cg] = await sql<{ course_id: number }[]>`select course_id from groups where id = ${gid}`;
    if (ex.some((x) => x.role === "student" && x.course_id === cg?.course_id)) return { error: "Bu o'quvchi shu kursda allaqachon bor" };
    const prev = ex.find((x) => x.role === "student")!;
    await sql`insert into users (platform_id, phone, password_hash, name, role, group_id) values (${u.platform_id}, ${phone}, ${prev.password_hash}, ${name}, 'student', ${gid})`;
    revalidatePath("/", "layout");
    return { ok: `${name} yangi kursga qo'shildi — avvalgi paroli bilan kiradi, kurslar ro'yxatida ikkalasi ham ko'rinadi` };
  }
  await sql`insert into users (platform_id, phone, password_hash, name, role, group_id)
    values (${u.platform_id}, ${phone}, ${bcrypt.hashSync(pass, 10)}, ${name}, ${role}, ${role === "student" ? gid : null})`;
  revalidatePath("/", "layout");
  return { ok: `${name} qo'shildi. Kirish: +${phone} / ${pass}` };
}

export async function toggleActive(fd: FormData) {
  const u = await requireUser(["admin"]);
  const uid = Number(fd.get("user_id"));
  if (uid === u.id) return;
  await sql`update users set active = not active where id = ${uid} and platform_id = ${u.platform_id}`;
  revalidatePath("/", "layout");
}

export async function nudge(fd: FormData) {
  const u = await requireUser(["admin", "curator"]);
  const uid = Number(fd.get("user_id"));
  if (!(await canManage(u, uid))) return;
  await notify([uid], "Eslatma: topshirilmagan vazifalaringiz bor", `${u.name}: iltimos, qarzlarni yoping`, "/darslar");
  revalidatePath("/", "layout");
}
