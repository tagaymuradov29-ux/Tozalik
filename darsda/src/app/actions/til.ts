"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { STARTER } from "@/lib/lang";
import type { FormState } from "./auth";

/** Leitner qutilari: to'g'ri topsa keyingi qutiga o'tadi va keyinroq takrorlanadi (kun) */
const GAP = [0, 1, 3, 7, 14, 30, 90];

async function course(roles?: ("admin" | "curator" | "student")[]) {
  const u = await requireUser(roles);
  const c = await currentCourse(u);
  if (!c) throw new Error("Kurs yo'q");
  return { u, c };
}

/** Admin: so'zlarni ro'yxat bilan qo'shish. Har qatorda: so'z — tarjima — o'qilishi — misol (oxirgi ikkisi ixtiyoriy) */
export async function addWords(_: FormState, fd: FormData): Promise<FormState> {
  const { c } = await course(["admin"]);
  const lessonId = Number(fd.get("lesson_id") || 0) || null;
  if (lessonId) {
    const [l] = await sql`select 1 from lessons where id = ${lessonId} and course_id = ${c.id}`;
    if (!l) return { error: "Dars topilmadi" };
  }
  const rows = String(fd.get("lines") || "").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(/\s*[—|;\t]\s*|\s+-\s+/).map((x) => x.trim()))
    .filter((p) => p[0]).slice(0, 500)
    .map((p, i) => ({ course_id: c.id, lesson_id: lessonId, word: p[0].slice(0, 120), tr: (p[1] ?? "").slice(0, 200), translit: (p[2] ?? "").slice(0, 120), example: (p[3] ?? "").slice(0, 300), position: i }));
  if (!rows.length) return { error: "Kamida bitta so'z yozing" };
  await sql`insert into vocab ${sql(rows)}`;
  revalidatePath("/til", "layout");
  return { ok: `${rows.length} ta so'z qo'shildi` };
}

export async function addStarter(fd: FormData) {
  const { c } = await course(["admin"]);
  const list = STARTER[c.lang] ?? [];
  const lessonId = Number(fd.get("lesson_id") || 0) || null;
  if (list.length) await sql`insert into vocab ${sql(list.map(([word, tr, translit], i) => ({ course_id: c.id, lesson_id: lessonId, word, tr, translit, example: "", position: i })))}`;
  revalidatePath("/til", "layout");
}

export async function deleteWord(fd: FormData) {
  const { c } = await course(["admin"]);
  await sql`delete from vocab where id = ${Number(fd.get("id"))} and course_id = ${c.id}`;
  revalidatePath("/til", "layout");
}

/** O'quvchi kartochkaga javob berdi: bildi / bilmadi */
/** Kartochka javobi: ok — bildim, !ok — bilmadim (so'z «Bilmagan so'zlarim»ga tushadi), easy — juda oson (2 quti oldinga) */
export async function answerCard(vocabId: number, ok: boolean, easy = false) {
  const { u, c } = await course(["student"]);
  const [v] = await sql`select 1 from vocab where id = ${vocabId} and course_id = ${c.id}`;
  if (!v) return;
  const [p] = await sql<{ box: number }[]>`select box from vocab_progress where user_id = ${u.id} and vocab_id = ${vocabId}`;
  const box = ok ? Math.min(6, (p?.box ?? 0) + (easy ? 3 : 1)) : 1;
  const unknown = !ok ? true : box >= 3 ? false : null;   // 3-qutiga yetsa «bilmaganlar»dan chiqadi
  const due = new Date(Date.now() + (ok ? GAP[box] * 86400000 : 10 * 60000));
  await sql`insert into vocab_progress (user_id, vocab_id, box, due_at, right_n, wrong_n, unknown)
    values (${u.id}, ${vocabId}, ${box}, ${due}, ${ok ? 1 : 0}, ${ok ? 0 : 1}, ${!ok})
    on conflict (user_id, vocab_id) do update set box = ${box}, due_at = ${due}, updated_at = now(),
      unknown = coalesce(${unknown}, vocab_progress.unknown),
      right_n = vocab_progress.right_n + ${ok ? 1 : 0}, wrong_n = vocab_progress.wrong_n + ${ok ? 0 : 1}`;
}

/** Talaffuz natijasi (0–100) — eng yaxshisi saqlanadi */
export async function savePron(vocabId: number, score: number) {
  const { u, c } = await course(["student"]);
  const [v] = await sql`select 1 from vocab where id = ${vocabId} and course_id = ${c.id}`;
  if (!v) return;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  await sql`insert into vocab_progress (user_id, vocab_id, box, due_at, pron) values (${u.id}, ${vocabId}, 0, now(), ${s})
    on conflict (user_id, vocab_id) do update set pron = greatest(coalesce(vocab_progress.pron, 0), ${s}), updated_at = now()`;
}

/** Admin: bitta so'zni alohida maydonlar bilan qo'shish (so'z, tarjima, o'qilishi, misol, rasm havolasi) */
export async function addWord(_: FormState, fd: FormData): Promise<FormState> {
  const { c } = await course(["admin"]);
  const word = String(fd.get("word") || "").trim().slice(0, 120);
  if (!word) return { error: "So'zni yozing" };
  const lessonId = Number(fd.get("lesson_id") || 0) || null;
  if (lessonId) {
    const [l] = await sql`select 1 from lessons where id = ${lessonId} and course_id = ${c.id}`;
    if (!l) return { error: "Dars topilmadi" };
  }
  const img = String(fd.get("image") || "").trim();
  await sql`insert into vocab (course_id, lesson_id, word, tr, translit, example, image, position)
    values (${c.id}, ${lessonId}, ${word}, ${String(fd.get("tr") || "").trim().slice(0, 200)}, ${String(fd.get("translit") || "").trim().slice(0, 120)},
      ${String(fd.get("example") || "").trim().slice(0, 300)}, ${/^https?:\/\//.test(img) ? img.slice(0, 500) : ""}, 9999)`;
  revalidatePath("/til", "layout");
  return { ok: `«${word}» qo'shildi` };
}

/** O'quvchi so'zni o'zi «Bilmagan so'zlarim»ga qo'shadi (yoki AI suhbatdan tavsiya qilingan so'z) */
export async function markUnknown(vocabId: number, on = true) {
  const { u, c } = await course(["student"]);
  const [v] = await sql`select 1 from vocab where id = ${vocabId} and course_id = ${c.id}`;
  if (!v) return;
  await sql`insert into vocab_progress (user_id, vocab_id, box, due_at, unknown) values (${u.id}, ${vocabId}, 1, now(), ${on})
    on conflict (user_id, vocab_id) do update set unknown = ${on}, updated_at = now()`;
  revalidatePath("/til", "layout");
}
