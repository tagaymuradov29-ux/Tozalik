"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentCourse, DEFAULT_POINTS, type Workbook } from "@/lib/course";
import { localToUtc } from "@/lib/util";
import { CATEGORIES, LANGS } from "@/lib/lang";
import type { FormState } from "./auth";

async function adminCourse() {
  const u = await requireUser(["admin"]);
  const c = await currentCourse(u);
  if (!c) throw new Error("Kurs yo'q");
  return { u, c };
}

const num = (v: FormDataEntryValue | null, d = 0) => (v === null || v === "" ? d : Number(v));

export async function saveLesson(_: FormState, fd: FormData): Promise<FormState> {
  const { u, c } = await adminCourse();
  const id = num(fd.get("id"));
  const title = String(fd.get("title") || "").trim();
  const startsLocal = String(fd.get("starts_at") || "");
  if (!title || !startsLocal) return { error: "Mavzu va sana kerak" };
  const materials = String(fd.get("materials") || "")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)\s*(https?:\/\/\S+)$/);
      return m ? { title: m[1].replace(/[—–-]\s*$/, "").trim() || m[2], url: m[2] } : null;
    }).filter(Boolean);
  const v = {
    n: num(fd.get("n"), 1),
    title,
    speaker: String(fd.get("speaker") || "").trim(),
    starts_at: localToUtc(startsLocal, u.tz),
    duration_min: num(fd.get("duration_min"), 240),
    video_url: String(fd.get("video_url") || "").trim(),
    content: String(fd.get("content") || ""),
    materials: sql.json(materials),
    attendance: fd.get("attendance") === "on",
  };
  if (id) {
    await sql`update lessons set ${sql(v)} where id = ${id} and course_id = ${c.id}`;
  } else {
    const [l] = await sql<{ id: number }[]>`insert into lessons ${sql({ ...v, course_id: c.id })} returning id`;
    revalidatePath("/", "layout");
    redirect(`/darslar/${l.id}`);
  }
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function deleteLesson(fd: FormData) {
  const { c } = await adminCourse();
  await sql`delete from lessons where id = ${num(fd.get("id"))} and course_id = ${c.id}`;
  revalidatePath("/", "layout");
  redirect("/darslar");
}

export async function saveTask(_: FormState, fd: FormData): Promise<FormState> {
  const { u, c } = await adminCourse();
  const id = num(fd.get("id"));
  const title = String(fd.get("title") || "").trim();
  const kind = String(fd.get("kind") || "file");
  if (!title) return { error: "Vazifa nomini yozing" };
  if (!["file", "text", "link", "workbook", "repeat"].includes(kind)) return { error: "Turi noto'g'ri" };
  let workbook: Workbook | null = null;
  const wbRaw = String(fd.get("workbook") || "").trim();
  if (kind === "workbook") {
    try {
      workbook = JSON.parse(wbRaw);
      if (!Array.isArray(workbook?.sections)) throw new Error();
    } catch {
      return { error: "Workbook JSON noto'g'ri: {\"sections\":[{\"t\":\"Bo'lim\",\"f\":[{\"k\":\"a\",\"t\":\"area\",\"l\":\"Savol\"}]}]}" };
    }
  }
  const lessonId = num(fd.get("lesson_id")) || null;
  if (lessonId) {
    const [l] = await sql`select 1 from lessons where id = ${lessonId} and course_id = ${c.id}`;
    if (!l) return { error: "Dars topilmadi" };
  }
  const opens = String(fd.get("opens_at") || "");
  const due = String(fd.get("due_at") || "");
  const late = String(fd.get("late_points") || "");
  const v = {
    lesson_id: lessonId,
    title,
    kind,
    instructions: String(fd.get("instructions") || ""),
    max_points: num(fd.get("max_points"), 10),
    late_points: late === "" ? null : Number(late),
    opens_at: opens ? localToUtc(opens, u.tz) : null,
    due_at: due ? localToUtc(due, u.tz) : null,
    review: fd.get("review") === "on",
    workbook: workbook ? sql.json(workbook) : null,
    per_day: kind === "repeat" && fd.get("per_day") ? num(fd.get("per_day")) : null,
    per_week: kind === "repeat" && fd.get("per_week") ? num(fd.get("per_week")) : null,
    position: num(fd.get("position")),
  };
  if (id) await sql`update tasks set ${sql(v)} where id = ${id} and course_id = ${c.id}`;
  else {
    const [t] = await sql<{ id: number }[]>`insert into tasks ${sql({ ...v, course_id: c.id })} returning id`;
    revalidatePath("/", "layout");
    redirect(`/vazifa/${t.id}`);
  }
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function deleteTask(fd: FormData) {
  const { c } = await adminCourse();
  const [t] = await sql<{ lesson_id: number | null }[]>`delete from tasks where id = ${num(fd.get("id"))} and course_id = ${c.id} returning lesson_id`;
  revalidatePath("/", "layout");
  redirect(t?.lesson_id ? `/darslar/${t.lesson_id}` : "/darslar");
}

export async function saveCourse(_: FormState, fd: FormData): Promise<FormState> {
  const { c } = await adminCourse();
  const title = String(fd.get("title") || "").trim();
  if (!title) return { error: "Kurs nomini yozing" };
  const goals = String(fd.get("goals") || "")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const m = l.match(/^(\d+)\s*[—–:-]?\s*(.+)$/); return m ? { pts: Number(m[1]), label: m[2] } : null; })
    .filter(Boolean);
  const points = { ...DEFAULT_POINTS };
  for (const k of Object.keys(DEFAULT_POINTS) as (keyof typeof DEFAULT_POINTS)[]) {
    if (k === "goals") continue;
    const v = fd.get(k);
    if (v !== null && v !== "") (points as Record<string, unknown>)[k] = Number(v);
  }
  points.goals = goals as typeof points.goals;
  const cat = CATEGORIES.some((x) => x.key === fd.get("category")) ? String(fd.get("category")) : c.category;
  const lang = cat === "til" ? (LANGS.some((x) => x.key === fd.get("lang")) ? String(fd.get("lang")) : c.lang || "en") : "";
  await sql`update courses set title = ${title}, description = ${String(fd.get("description") || "")}, points = ${sql.json(points)}, category = ${cat}, lang = ${lang} where id = ${c.id}`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function createCourse(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin"]);
  const title = String(fd.get("title") || "").trim();
  if (!title) return { error: "Kurs nomini yozing" };
  const [c] = await sql<{ id: number }[]>`insert into courses (platform_id, title) values (${u.platform_id}, ${title}) returning id`;
  await sql`insert into groups (platform_id, course_id, name) values (${u.platform_id}, ${c.id}, '1-guruh')`;
  (await cookies()).set("course", String(c.id), { path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
  return { ok: "Kurs yaratildi va tanlandi" };
}

export async function switchCourse(fd: FormData) {
  const u = await requireUser(["admin", "curator"]);
  const id = num(fd.get("id"));
  const [c] = await sql`select 1 from courses where id = ${id} and platform_id = ${u.platform_id}`;
  if (c) (await cookies()).set("course", String(id), { path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
}

export async function savePlatform(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin"]);
  const name = String(fd.get("name") || "").trim();
  const color = String(fd.get("color") || "");
  if (!name) return { error: "Nom kerak" };
  await sql`update platforms set name = ${name}, color = ${/^#[0-9a-f]{6}$/i.test(color) ? color : "#0B5D46"} where id = ${u.platform_id}`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}
