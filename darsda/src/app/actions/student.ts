"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  attStatusFor, attWindow, checkAttCode, currentCourse, getLessons, repeatUsage, taskOpen,
  wbMissing, wbText, type Sub, type Task,
} from "@/lib/course";
import type { FormState } from "./auth";

const MAX_FILE = 4 * 1024 * 1024;
const MAX_TOTAL = 4.3 * 1024 * 1024;

async function loadTask(taskId: number) {
  const u = await requireUser(["student"]);
  const course = await currentCourse(u);
  const [t] = await sql<Task[]>`select * from tasks where id = ${taskId} and course_id = ${course?.id ?? 0}`;
  return { u, course, t };
}

export async function submitTask(_: FormState, fd: FormData): Promise<FormState> {
  const { u, course, t } = await loadTask(Number(fd.get("task_id")));
  if (!t || !course) return { error: "Vazifa topilmadi" };
  if (!taskOpen(t)) return { error: "Vazifa hali ochilmagan" };
  if (t.kind === "workbook") return { error: "Workbook formasi orqali yuboring" };
  const text = String(fd.get("text") || "").trim();
  const link = String(fd.get("link") || "").trim();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!text && !link && !files.length) return { error: "Matn, havola yoki fayl qo'shing" };
  if (link && !/^https?:\/\/\S+$/i.test(link)) return { error: "Havola http:// yoki https:// bilan boshlanishi kerak" };
  if (files.some((f) => f.size > MAX_FILE)) return { error: "Har bir fayl 4 MB dan oshmasin" };
  if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) return { error: "Fayllar jami 4 MB dan oshmasin — kamroq yuboring" };

  const subs = await sql<Sub[]>`select * from submissions where task_id = ${t.id} and user_id = ${u.id}`;
  if (t.kind === "repeat") {
    const use = repeatUsage(t, subs, u.tz);
    if (t.per_day && use.day >= t.per_day) return { error: `Bugungi limit tugadi (${t.per_day} ta)` };
    if (t.per_week && use.week >= t.per_week) return { error: `Haftalik limit tugadi (${t.per_week} ta)` };
    if (link && subs.some((s) => s.link === link && s.status !== "cancelled" && s.status !== "rejected"))
      return { error: "Bu havola avval yuborilgan" };
  } else {
    if (subs.some((s) => s.status === "approved")) return { error: "Bu vazifa allaqachon qabul qilingan" };
    if (subs.some((s) => s.status === "pending")) return { error: "Oldingi javobingiz tekshirilmoqda" };
  }

  const stored: { id: string; name: string; type: string; size: number }[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const sha = createHash("sha256").update(buf).digest("hex");
    const [used] = await sql`
      select 1 from submissions s, jsonb_array_elements(s.files) e
      join files fl on fl.id = (e->>'id')::uuid
      where fl.sha256 = ${sha} and fl.platform_id = ${u.platform_id} and s.status <> 'cancelled' and s.status <> 'rejected'
      limit 1`;
    if (used) return { error: `«${f.name}» avval boshqa javobda yuborilgan` };
    const [row] = await sql<{ id: string }[]>`
      insert into files (platform_id, user_id, name, type, size, sha256, data)
      values (${u.platform_id}, ${u.id}, ${f.name.slice(0, 120)}, ${f.type || "application/octet-stream"}, ${buf.length}, ${sha}, ${buf})
      returning id`;
    stored.push({ id: row.id, name: f.name.slice(0, 120), type: f.type, size: buf.length });
  }

  const late = !!t.due_at && new Date(t.due_at) < new Date();
  const auto = !t.review;
  const pts = auto ? (late ? t.late_points ?? t.max_points : t.max_points) : null;
  await sql`insert into submissions (task_id, user_id, text, link, files, status, points, late, graded_at)
    values (${t.id}, ${u.id}, ${text}, ${link}, ${sql.json(stored)}, ${auto ? "approved" : "pending"}, ${pts}, ${late}, ${auto ? new Date() : null})`;
  revalidatePath("/", "layout");
  return { ok: auto ? `Qabul qilindi: +${pts} ball` : "Yuborildi! Kurator tekshirgach ball qo'shiladi." };
}

export async function cancelSubmission(fd: FormData) {
  const u = await requireUser(["student"]);
  await sql`update submissions set status = 'cancelled' where id = ${Number(fd.get("id"))} and user_id = ${u.id} and status = 'pending'`;
  revalidatePath("/", "layout");
}

export async function submitWorkbook(_: FormState, fd: FormData): Promise<FormState> {
  const { u, t } = await loadTask(Number(fd.get("task_id")));
  if (!t || !t.workbook) return { error: "Workbook topilmadi" };
  if (!taskOpen(t)) return { error: "Workbook hali ochilmagan" };
  const [ans] = await sql<{ data: Record<string, unknown> }[]>`select data from wb_answers where user_id = ${u.id} and task_id = ${t.id}`;
  const data = ans?.data ?? {};
  const miss = wbMissing(t.workbook, data);
  if (miss.length) return { error: `To'ldirilmagan: ${miss.slice(0, 3).join("; ")}${miss.length > 3 ? ` va yana ${miss.length - 3} ta` : ""}` };
  const subs = await sql<Sub[]>`select * from submissions where task_id = ${t.id} and user_id = ${u.id} and status in ('pending','approved')`;
  if (subs.length) return { error: subs[0].status === "approved" ? "Allaqachon qabul qilingan" : "Tekshirilmoqda" };
  const late = !!t.due_at && new Date(t.due_at) < new Date();
  await sql`insert into submissions (task_id, user_id, text, late) values (${t.id}, ${u.id}, ${wbText(t.workbook, data)}, ${late})`;
  revalidatePath("/", "layout");
  return { ok: "Workbook yuborildi! Kurator tekshiradi." };
}

export async function checkIn(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["student"]);
  const course = await currentCourse(u);
  if (!course) return { error: "Kurs topilmadi" };
  const code = String(fd.get("code") || "").replace(/\D/g, "");
  const now = new Date();
  const lessons = (await getLessons(course.id)).filter((l) => {
    const w = attWindow(l, course);
    return l.attendance && now >= w.from && now <= w.to;
  });
  const l = lessons.find((x) => checkAttCode(x.id, code));
  if (!l) return { error: lessons.length ? "Kod noto'g'ri yoki eskirgan — ekrandagi yangi kodni kiriting" : "Hozir davomat oynasi ochiq emas" };
  const [ex] = await sql`select 1 from attendance where lesson_id = ${l.id} and user_id = ${u.id}`;
  if (ex) return { ok: "Davomat allaqachon belgilangan ✓" };
  const st = attStatusFor(l, course, now);
  const reason = String(fd.get("reason") || "").trim();
  await sql`insert into attendance (lesson_id, user_id, status, late_min, src, reason)
    values (${l.id}, ${u.id}, ${st.status}, ${st.late_min}, 'kod', ${reason})`;
  revalidatePath("/", "layout");
  return { ok: st.status === "ontime" ? "✓ Vaqtida keldingiz!" : `Belgilandi — ${st.late_min} daqiqa kechikdingiz` };
}

export async function markRead() {
  const u = await requireUser();
  await sql`update notifications set read_at = now() where user_id = ${u.id} and read_at is null`;
  revalidatePath("/", "layout");
}
