import "server-only";
import { sql } from "./db";
import type { User } from "./auth";
import { pointsAll, scopeStudents, type Course, type Task } from "./course";
import { lessonProgress } from "./progress";
import type { Ctx } from "./student";

/* ---------- 🚀 Bozorga parvoz ---------- */

/** Katak holati: done — bajarilgan, debt — qarz, review — tekshiruvda, todo — muddat bor, na — kerak emas, fut — hali o'tilmagan */
export type Cell = "done" | "debt" | "review" | "todo" | "na" | "fut";
/** Yoqilg'i turlari: davomat, konspekt/fayl, workbook, boshqa vazifa */
export const FUEL = ["Davomat", "Konspekt", "Workbook", "Vazifa"] as const;

export const isBig = (t: Task) => /^amaliy/i.test(t.title) || t.max_points >= 40;
const fuelKind = (t: Task) => (t.kind === "workbook" ? 2 : /konspekt/i.test(t.title) ? 1 : 3);

export type FlightData = {
  pts: number;
  orbit: { pts: number; label: string };
  moon: { pts: number; label: string };
  L: { n: number; t: string; fut: boolean; cells: { k: number; st: Cell; label: string }[] }[];
  A: { k: number; t: string; st: "done" | "debt" | "review" | "todo" | "locked" }[];
  done: number; total: number;
  parts: [string, number][];
};

export async function flightData(ctx: Ctx, uid: number): Promise<FlightData> {
  const { course, lessons, tasks, subs, att, watch, joinedAt } = ctx;
  const now = new Date();
  const P = (await pointsAll(course)).get(uid) ?? { tasks: 0, attend: 0, bonus: 0, net: 0, ws: 0, total: 0 };
  const goals = [...course.points.goals].sort((a, b) => a.pts - b.pts);
  const orbit = goals[0] ?? { pts: 1000, label: "Birinchi maqsad" };
  const moon = goals.length > 1 ? goals[goals.length - 1] : { pts: Math.round(orbit.pts * 1.5), label: "Yuqori natija" };

  const map: Record<string, Cell> = { done: "done", late: "debt", review: "review", todo: "todo", na: "na" };
  const L = lessons.map((l) => {
    const fut = new Date(l.starts_at) > now;
    if (fut) return { n: l.n, t: l.title, fut, cells: [] };
    const pr = lessonProgress(l, course, tasks, subs, att.find((a) => a.lesson_id === l.id), watch.find((w) => w.lesson_id === l.id), joinedAt, now);
    const cells = pr.items.filter((i) => i.key !== "vid").flatMap((i) => {
      if (i.key === "att") return [{ k: 0, st: map[i.st], label: "Davomat" }];
      const t = tasks.find((x) => `t${x.id}` === i.key);
      if (!t || isBig(t)) return [];
      return [{ k: fuelKind(t), st: map[i.st], label: i.label }];
    });
    return { n: l.n, t: l.title, fut, cells };
  });

  const A = tasks.filter((t) => t.lesson_id && isBig(t)).map((t, j) => {
    const mine = subs.filter((s) => s.task_id === t.id);
    const st = t.opens_at && new Date(t.opens_at) > now ? "locked"
      : mine.some((s) => s.status === "approved") ? "done"
      : mine.some((s) => s.status === "pending") ? "review"
      : t.due_at && new Date(t.due_at) < now ? "debt" : "todo";
    return { k: j + 1, t: t.title.replace(/^amaliy:\s*/i, ""), st } as FlightData["A"][number];
  });

  let done = 0, total = 0;
  L.forEach((l) => l.cells.forEach((c) => { if (c.st === "done") done++; if (c.st !== "na") total++; }));

  // Ball tarkibi: vazifalar turi bo'yicha + davomat, networking, workshop, bonus
  const byKind = new Map<string, number>();
  for (const s of subs) {
    if (s.status !== "approved" || !s.points) continue;
    const t = tasks.find((x) => x.id === s.task_id);
    if (!t) continue;
    const k = isBig(t) ? "Amaliy" : t.kind === "repeat" ? t.title : FUEL[fuelKind(t)];
    byKind.set(k, (byKind.get(k) ?? 0) + s.points);
  }
  const parts: [string, number][] = [["Davomat", P.attend], ...byKind.entries(), ["Networking", P.net], ["Workshop", P.ws], ["Bonus", P.bonus]];
  return { pts: P.total, orbit, moon, L, A, done, total, parts: parts.filter(([, v]) => v) };
}

/* ---------- ✨ Tanishuvlar osmoni ---------- */

export type SkyData = {
  acc: "student" | "staff";
  me: number | null;
  nodes: { id: number; n: string; g: number }[];
  edges: [number, number, "ok" | "wait"][];
  week: number[];
  my: number[];
  gn: string[];
  items: { ok: number; all: number };
};

/** Yulduzlar — kursdoshlar, nurlar — tasdiqlangan (ok) yoki tekshiruvdagi (wait) tanishuvlar. Networking boshlanmagan bo'lsa null. */
export async function skyData(u: User, c: Course): Promise<SkyData | null> {
  const rounds = await sql<{ id: number; starts_at: Date; weeks: number }[]>`select id, starts_at, weeks from net_rounds where course_id = ${c.id} order by starts_at`;
  if (!rounds.length) return null;
  const [groups, students, pairs] = await Promise.all([
    sql<{ id: number; name: string }[]>`select id, name from groups where course_id = ${c.id} order by name`,
    sql<{ id: number; name: string; group_id: number }[]>`select u.id, u.name, u.group_id from users u join groups g on g.id = u.group_id
      where g.course_id = ${c.id} and u.role = 'student' and u.active`,
    sql<{ a: number; b: number; round_id: number; week: number; st: string | null }[]>`
      select pa.a_id as a, pa.b_id as b, pa.round_id, pa.week,
        (select case when bool_or(x.status = 'approved') then 'ok' when bool_or(x.status = 'pending') then 'wait' end
           from net_proofs x where x.pair_id = pa.id) as st
      from net_pairs pa where pa.round_id = any(${rounds.map((r) => r.id)})`,
  ]);
  const gi = new Map(groups.map((g, i) => [g.id, i]));
  const nodes = students.map((s) => ({ id: s.id, n: s.name, g: gi.get(s.group_id) ?? 5 }));
  const seen = new Map<string, "ok" | "wait">();
  for (const p of pairs) {
    if (!p.st) continue;
    const k = p.a < p.b ? `${p.a}:${p.b}` : `${p.b}:${p.a}`;
    if (seen.get(k) !== "ok") seen.set(k, p.st as "ok" | "wait");
  }
  let edges = [...seen.entries()].map(([k, st]) => { const [a, b] = k.split(":").map(Number); return [a, b, st] as [number, number, "ok" | "wait"]; });
  const stu = u.role === "student";
  let week: number[] = [], my: number[] = [], items = { ok: 0, all: 0 };
  if (stu) {
    edges = edges.filter(([a, b]) => a === u.id || b === u.id);
    const now = Date.now();
    const r = rounds.find((x) => { const w = Math.floor((now - new Date(x.starts_at).getTime()) / (7 * 86400000)) + 1; return w >= 1 && w <= x.weeks; });
    if (r) {
      const wk = Math.floor((now - new Date(r.starts_at).getTime()) / (7 * 86400000)) + 1;
      const mine = pairs.filter((p) => p.round_id === r.id && p.week === wk && (p.a === u.id || p.b === u.id));
      week = mine.map((p) => (p.a === u.id ? p.b : p.a));
      items = { ok: mine.filter((p) => p.st === "ok").length, all: mine.length };
    }
  } else if (u.role === "curator") {
    my = (await scopeStudents(u, c.id)).map((s) => s.id);
  }
  return { acc: stu ? "student" : "staff", me: stu ? u.id : null, nodes, edges, week, my, gn: groups.map((g) => g.name), items };
}
