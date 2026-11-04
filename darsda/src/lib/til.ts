import "server-only";
import { sql } from "./db";

export type Word = { id: number; lesson_id: number | null; word: string; tr: string; translit: string; example: string; image: string; ln: number | null };
export type WordP = Word & { box: number | null; due_at: Date | null; pron: number | null; unknown: boolean | null };

/** Kursdagi so'zlar va o'quvchining holati. Faqat boshlangan darslar (yoki darsga bog'lanmagan) so'zlari */
export async function wordsFor(courseId: number, uid: number, lessonId = 0, onlyOpen = true) {
  return sql<WordP[]>`
    select v.id, v.lesson_id, v.word, v.tr, v.translit, v.example, v.image, l.n as ln, p.box, p.due_at, p.pron, p.unknown
    from vocab v left join lessons l on l.id = v.lesson_id
    left join vocab_progress p on p.vocab_id = v.id and p.user_id = ${uid}
    where v.course_id = ${courseId} and (${lessonId} = 0 or v.lesson_id = ${lessonId})
      and (${!onlyOpen} or v.lesson_id is null or l.starts_at <= now())
    order by l.n nulls first, v.position, v.id`;
}

/** Lug'at statistikasi: jami, yodlangan (4+ quti), bugun takrorlash kerak, yangi */
export function stats(ws: WordP[]) {
  const now = Date.now();
  const learned = ws.filter((w) => (w.box ?? 0) >= 4).length;
  const fresh = ws.filter((w) => !w.box).length;
  const due = ws.filter((w) => (w.box ?? 0) >= 1 && w.box! < 6 && new Date(w.due_at!).getTime() <= now).length;
  const pr = ws.filter((w) => w.pron !== null);
  return { total: ws.length, learned, fresh, due, unknown: ws.filter((w) => w.unknown).length, pron: pr.length ? Math.round(pr.reduce((s, w) => s + (w.pron ?? 0), 0) / pr.length) : null };
}

/** Kurator/admin uchun: har o'quvchining lug'at natijasi */
export async function classStats(courseId: number, ids: number[]) {
  return sql<{ user_id: number; learned: number; seen: number; pron: number | null }[]>`
    select p.user_id, count(*) filter (where p.box >= 4)::int as learned, count(*)::int as seen, round(avg(p.pron))::int as pron
    from vocab_progress p join vocab v on v.id = p.vocab_id
    where v.course_id = ${courseId} and p.user_id = any(${ids}) group by p.user_id`;
}
