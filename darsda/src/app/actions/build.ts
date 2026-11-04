"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBrand, MODS, okColor, type Settings } from "@/lib/platform";
import { seedDemoCourse } from "@/lib/demo";
import { FONTS, JOURNEYS } from "@/lib/journeys";
import { ROAD_CHOICES } from "@/lib/roadmapSvg";
import { studentIn } from "@/lib/accounts";
import { CATEGORIES, LANGS, STARTER } from "@/lib/lang";
import { localToUtc } from "@/lib/util";
import type { FormState } from "./auth";

/* ---------- Konstruktor: platforma egasi (admin) o'z platformasini sozlaydi ---------- */

async function admin() {
  const u = await requireUser(["admin"]);
  const b = await getBrand(u.platform_id);
  if (!b) throw new Error("Platforma topilmadi");
  return { u, b };
}

const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

export async function saveBrand(_: FormState, fd: FormData): Promise<FormState> {
  const { b } = await admin();
  const name = str(fd.get("name"), 60);
  const slug = str(fd.get("slug"), 30).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!name) return { error: "Platforma nomini yozing" };
  if (slug.length < 2) return { error: "Havola nomi kamida 2 ta lotin harfi yoki raqam bo'lsin" };
  if (slug !== b.slug) {
    const [ex] = await sql`select 1 from platforms where slug = ${slug}`;
    if (ex) return { error: "Bu havola nomi band — boshqasini tanlang" };
  }
  const logo = String(fd.get("logo") || "");
  const settings: Settings = { ...b.settings, welcome: str(fd.get("welcome"), 300) };
  if (fd.get("logo_remove") === "1") delete settings.logo;
  else if (logo.startsWith("data:image/") && logo.length < 200_000) settings.logo = logo;
  await sql`update platforms set name = ${name}, slug = ${slug}, settings = ${sql.json(settings)} where id = ${b.id}`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function saveMods(_: FormState, fd: FormData): Promise<FormState> {
  const { b } = await admin();
  const mods: Settings["mods"] = {}, labels: Settings["labels"] = {};
  for (const m of MODS) {
    mods[m.key] = fd.get(`on_${m.key}`) === "on";
    const l = str(fd.get(`label_${m.key}`), 40);
    if (l && l !== m.label) labels[m.key] = l;
  }
  // Osmon networking tanishuvlaridan yasaladi — networking o'chiq bo'lsa, osmon ham o'chadi
  if (!mods.networking) mods.osmon = false;
  await sql`update platforms set settings = ${sql.json({ ...b.settings, mods, labels })} where id = ${b.id}`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi" };
}

export async function saveDesign(_: FormState, fd: FormData): Promise<FormState> {
  const { b } = await admin();
  const font = String(fd.get("font") || "");
  const jr = String(fd.get("journey") || "kosmos");
  const settings: Settings = {
    ...b.settings,
    font: FONTS.some((f) => f.key === font) ? font : "",
    journey: JOURNEYS.some((j) => j.key === jr) ? jr : "kosmos",
    tint: fd.get("tint") === "on",
    road: ROAD_CHOICES.includes(String(fd.get("road"))) ? String(fd.get("road")) : "bahor",
  };
  await sql`update platforms set color = ${okColor(String(fd.get("color")))}, settings = ${sql.json(settings)} where id = ${b.id}`;
  revalidatePath("/", "layout");
  return { ok: "Saqlandi — o'quvchilar ham shu ko'rinishni ko'radi" };
}

/** Yangi kurs: bo'sh jadval, RM 6.0 namunasi yoki mavjud kursdan nusxa */
export async function newCourse(_: FormState, fd: FormData): Promise<FormState> {
  const { u, b } = await admin();
  const mode = String(fd.get("mode") || "schedule");
  const title = str(fd.get("title"), 80);
  if (!title) return { error: "Kurs nomini yozing" };
  const date = String(fd.get("date") || "");
  const time = /^\d\d:\d\d$/.test(String(fd.get("time"))) ? String(fd.get("time")) : "18:00";
  const cat = CATEGORIES.some((x) => x.key === fd.get("category")) ? String(fd.get("category")) : "boshqa";
  const lang = cat === "til" ? (LANGS.some((x) => x.key === fd.get("lang")) ? String(fd.get("lang")) : "en") : "";
  let courseId = 0;

  if (mode === "rm6") {
    courseId = await seedDemoCourse(b.id);
    await sql`update courses set title = ${title} where id = ${courseId}`;
  } else if (mode === "copy") {
    const src = Number(fd.get("source"));
    const [sc] = await sql<{ id: number; description: string; points: unknown }[]>`select id, description, points from courses where id = ${src} and platform_id = ${b.id}`;
    if (!sc) return { error: "Nusxa olinadigan kursni tanlang" };
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return { error: "Birinchi dars sanasini tanlang" };
    const [first] = await sql<{ starts_at: Date }[]>`select starts_at from lessons where course_id = ${src} order by starts_at limit 1`;
    const shift = first ? localToUtc(`${date}T${time}`, u.tz).getTime() - new Date(first.starts_at).getTime() : 0;
    const iv = `${Math.round(shift / 1000)} seconds`;
    await sql.begin(async (tx) => {
      const [c] = await tx<{ id: number }[]>`insert into courses (platform_id, title, description, points)
        values (${b.id}, ${title}, ${sc.description}, ${sql.json(sc.points as object)}) returning id`;
      courseId = c.id;
      // Darslar sanasi siljitiladi, vazifalar yangi darslarga bog'lanadi
      const map = new Map<number, number>();
      const ls = await tx<{ id: number }[]>`select id from lessons where course_id = ${src} order by starts_at, n`;
      for (const l of ls) {
        const [nl] = await tx<{ id: number }[]>`insert into lessons (course_id, n, title, speaker, starts_at, duration_min, video_url, content, materials, attendance)
          select ${c.id}, n, title, speaker, starts_at + ${iv}::interval, duration_min, video_url, content, materials, attendance
          from lessons where id = ${l.id} returning id`;
        map.set(l.id, nl.id);
      }
      await tx`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, review, workbook, per_day, per_week, position)
        select ${c.id}, m.new_id, t.title, t.kind, t.instructions, t.max_points, t.late_points,
          t.opens_at + ${iv}::interval, t.due_at + ${iv}::interval, t.review, t.workbook, t.per_day, t.per_week, t.position
        from tasks t left join (select (e->>0)::int as old_id, (e->>1)::int as new_id from jsonb_array_elements(${sql.json([...map.entries()])}::jsonb) e) m
          on m.old_id = t.lesson_id
        where t.course_id = ${src}`;
      // Lug'at ham ko'chadi
      await tx`insert into vocab (course_id, lesson_id, word, tr, translit, example, position)
        select ${c.id}, m.new_id, v.word, v.tr, v.translit, v.example, v.position
        from vocab v left join (select (e->>0)::int as old_id, (e->>1)::int as new_id from jsonb_array_elements(${sql.json([...map.entries()])}::jsonb) e) m
          on m.old_id = v.lesson_id
        where v.course_id = ${src}`;
      await tx`insert into groups (platform_id, course_id, name) values (${b.id}, ${c.id}, '1-guruh')`;
    });
  } else {
    // Jadval bo'yicha: N ta dars, haftaning tanlangan kunlarida, belgilangan soatda
    const days = fd.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
    const count = Math.min(100, Math.max(1, Number(fd.get("count") || 12)));
    const dur = Math.min(600, Math.max(15, Number(fd.get("duration") || 120)));
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) return { error: "Birinchi dars sanasini tanlang" };
    if (!days.length) return { error: "Dars bo'ladigan kunlarni belgilang" };
    const kons = fd.get("t_kons") === "on", amaliy = fd.get("t_amaliy") === "on";
    const [c] = await sql<{ id: number }[]>`insert into courses (platform_id, title, points) values (${b.id}, ${title},
      ${sql.json({ goals: [{ pts: 300, label: "🎓 Sertifikat" }, { pts: 600, label: "🏆 Eng yaxshilar qatorida" }] })}) returning id`;
    courseId = c.id;
    await sql`insert into groups (platform_id, course_id, name) values (${b.id}, ${c.id}, '1-guruh')`;
    const d0 = new Date(date + "T00:00:00Z");
    let n = 0;
    for (let k = 0; n < count && k < 800; k++) {
      const d = new Date(d0.getTime() + k * 86400000);
      if (!days.includes((d.getUTCDay() + 6) % 7)) continue;
      n++;
      const ymd = d.toISOString().slice(0, 10);
      const start = localToUtc(`${ymd}T${time}`, u.tz);
      const [l] = await sql<{ id: number }[]>`insert into lessons (course_id, n, title, starts_at, duration_min)
        values (${c.id}, ${n}, ${`${n}-dars mavzusi`}, ${start}, ${dur}) returning id`;
      const end = new Date(start.getTime() + dur * 60000);
      if (kons) await sql`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, position)
        values (${c.id}, ${l.id}, ${`${n}-dars konspekti`}, 'file', 'Darsda yozgan konspektingizni rasm yoki PDF qilib yuboring.', 10, 8, ${start}, ${new Date(end.getTime() + 20 * 3600000)}, 1)`;
      if (amaliy) await sql`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, position)
        values (${c.id}, ${l.id}, ${`Amaliy: ${n}-dars topshirig'i`}, 'file', 'Topshiriqni bajarib, fayl, rasm yoki havola ko''rinishida yuboring.', 50, 40, ${end}, ${new Date(end.getTime() + 7 * 86400000)}, 3)`;
    }
  }
  await sql`update courses set category = ${mode === "rm6" ? "marketing" : cat}, lang = ${mode === "rm6" ? "" : lang} where id = ${courseId}`;
  // Til kursi: boshlang'ich so'zlar (namuna) — admin keyin o'zinikini qo'shadi yoki o'chiradi
  if (cat === "til" && mode !== "rm6" && fd.get("starter") === "on" && STARTER[lang]) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from vocab where course_id = ${courseId}`;
    if (!n) await sql`insert into vocab ${sql(STARTER[lang].map(([word, tr, translit], i) => ({ course_id: courseId, lesson_id: null, word, tr, translit, example: "", position: i })))}`;
  }
  // Shu raqamdagi o'quvchi hisobi (sinov) ham yangi kursga darhol qo'shiladi — o'quvchi panelida kurs ko'rinadi
  const [stu] = await sql<{ id: number }[]>`select id from users where platform_id = ${b.id} and phone = ${u.phone} and role = 'student' and active order by id limit 1`;
  if (stu) await studentIn(stu.id, courseId);
  // Sinov kuratori (admin bilan bir raqamdagi) yangi kursning guruhiga ham biriktiriladi
  await sql`update groups set curator_id = (select k.id from users k where k.platform_id = ${b.id} and k.role = 'curator' and k.phone = ${u.phone} and k.active limit 1)
    where course_id = ${courseId} and curator_id is null and id = (select min(id) from groups where course_id = ${courseId})`;
  (await cookies()).set("course", String(courseId), { path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
  redirect(cat === "til" && mode !== "rm6" ? "/til" : "/darslar");
}

export async function deleteCourse(fd: FormData) {
  const { b } = await admin();
  const id = Number(fd.get("id"));
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from courses where platform_id = ${b.id}`;
  if (n <= 1) return;   // oxirgi kurs o'chirilmaydi
  await sql`delete from courses where id = ${id} and platform_id = ${b.id}`;
  (await cookies()).delete("course");
  revalidatePath("/", "layout");
  redirect("/sozlash/kurs");
}
