import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import type { User } from "./auth";
import { dayKey, weekdayMon } from "./util";

export type PointsCfg = {
  att_ontime: number;
  att_late1: number;
  att_late2: number;
  att_absent: number;
  late_ok_min: number;
  late1_max: number;
  late2_max: number;
  window_after_min: number;
  goals: { pts: number; label: string }[];
  /** O'z qoidalari: kurator bir bosishda beradigan +/- ball (masalan «Darsda faol qatnashdi» +10) */
  rules: { pts: number; label: string }[];
};

export const DEFAULT_POINTS: PointsCfg = {
  att_ontime: 20,
  att_late1: -5,
  att_late2: -10,
  att_absent: -20,
  late_ok_min: 10,
  late1_max: 20,
  late2_max: 30,
  window_after_min: 60,
  goals: [],
  rules: [],
};

export type Course = { id: number; platform_id: number; title: string; description: string; points: PointsCfg; category: string; lang: string };
export type Lesson = {
  id: number; course_id: number; n: number; title: string; speaker: string; starts_at: Date;
  duration_min: number; video_url: string; content: string; materials: { title: string; url: string }[];
  attendance: boolean;
};
export type Task = {
  id: number; course_id: number; lesson_id: number | null; title: string; kind: string; instructions: string;
  max_points: number; late_points: number | null; opens_at: Date | null; due_at: Date | null; review: boolean;
  workbook: Workbook | null; per_day: number | null; per_week: number | null; position: number;
};
export type Sub = {
  id: number; task_id: number; user_id: number; text: string; link: string;
  files: { id: string; name: string; type: string; size: number }[];
  status: "pending" | "approved" | "rejected" | "cancelled"; points: number | null; late: boolean;
  feedback: string; graded_by: number | null; graded_at: Date | null; created_at: Date;
};

export type WbField = {
  k: string; t: "text" | "area" | "table" | "recall" | "quiz" | "chips"; l: string;
  cols?: string[]; rows?: string[]; dyn?: number; a?: string; o?: string[]; c?: number; x?: string; multi?: boolean;
};
export type Workbook = { title?: string; goal?: string; sections: { t: string; quote?: string; theory?: string[]; f?: WbField[] }[] };

function withDefaults(c: Course): Course {
  return { ...c, points: { ...DEFAULT_POINTS, ...(c.points || {}) } };
}

/** Foydalanuvchi uchun joriy kurs: o'quvchida — guruhniki, xodimda — tanlangani yoki birinchisi. */
export async function currentCourse(u: User): Promise<Course | null> {
  if (!u.platform_id) return null;
  if (u.role === "student") {
    const [c] = await sql<Course[]>`
      select c.* from courses c join groups g on g.course_id = c.id where g.id = ${u.group_id ?? 0}`;
    return c ? withDefaults(c) : null;
  }
  const want = Number((await cookies()).get("course")?.value || 0);
  const list = await sql<Course[]>`select * from courses where platform_id = ${u.platform_id} order by id`;
  // Kurator — tanlamagan bo'lsa, o'zi kuratorlik qiladigan guruh kursi
  const mine = u.role === "curator" && !list.some((x) => x.id === want)
    ? (await sql<{ course_id: number }[]>`select course_id from groups where curator_id = ${u.id} order by id limit 1`)[0]?.course_id
    : undefined;
  const c = list.find((x) => x.id === want) ?? list.find((x) => x.id === mine) ?? list[0];
  return c ? withDefaults(c) : null;
}

export async function getLessons(courseId: number) {
  return sql<Lesson[]>`select * from lessons where course_id = ${courseId} order by n, starts_at`;
}
export async function getTasks(courseId: number) {
  return sql<Task[]>`select * from tasks where course_id = ${courseId} order by coalesce(due_at, opens_at), position, id`;
}

export const lessonEnd = (l: Lesson) => new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000);
export const taskOpen = (t: Task) => !t.opens_at || new Date(t.opens_at) <= new Date();

/** O'quvchilar (kurs guruhlaridagi). Kurator faqat o'z guruhlarini ko'radi. */
export async function scopeStudents(u: User, courseId: number) {
  return sql<{ id: number; name: string; phone: string; group_id: number; group_name: string; created_at: Date }[]>`
    select u.id, u.name, u.phone, u.group_id, g.name as group_name, u.created_at
    from users u join groups g on g.id = u.group_id
    where g.course_id = ${courseId} and u.role = 'student' and u.active
      and (${u.role !== "curator"} or g.curator_id = ${u.id})
    order by g.name, u.name`;
}

export type Points = { tasks: number; attend: number; bonus: number; net: number; ws: number; total: number };

/** Kursdagi barcha o'quvchilar ballari: vazifalar + davomat + networking + workshop + bonus. Saqlanmaydi — har safar hisoblanadi. */
export async function pointsAll(c: Course): Promise<Map<number, Points>> {
  const P = c.points;
  const rows = await sql<{ id: number; tasks: number; attend: number; bonus: number; net: number; ws: number }[]>`
    with st as (
      select u.id, u.created_at from users u join groups g on g.id = u.group_id
      where g.course_id = ${c.id} and u.role = 'student' and u.active
    ),
    tp as (
      select s.user_id, sum(s.points)::int as p from submissions s join tasks t on t.id = s.task_id
      where t.course_id = ${c.id} and s.status = 'approved' group by s.user_id
    ),
    ap as (
      select st.id as user_id, sum(case
        when a.status = 'excused' then 0
        when a.status = 'ontime' then ${P.att_ontime}
        when a.status = 'late' and a.late_min <= ${P.late1_max} then ${P.att_late1}
        when a.status = 'late' and a.late_min <= ${P.late2_max} then ${P.att_late2}
        else ${P.att_absent} end)::int as p
      from st cross join lessons l
      left join attendance a on a.lesson_id = l.id and a.user_id = st.id
      where l.course_id = ${c.id} and l.attendance
        and (a.status is not null or (l.starts_at + make_interval(mins => ${P.window_after_min}) < now()
             and l.starts_at > st.created_at - interval '1 day'))
      group by st.id
    ),
    bp as (select user_id, sum(points)::int as p from bonuses group by user_id),
    np as (
      select pr.user_id, sum(pr.points)::int as p from net_proofs pr join net_pairs pa on pa.id = pr.pair_id
      join net_rounds r on r.id = pa.round_id where r.course_id = ${c.id} and pr.status = 'approved' group by pr.user_id
    ),
    wp as (
      select m.user_id, sum(coalesce((w.res ->> m.team::text)::int, 0))::int as p from ws_members m
      join workshops w on w.id = m.ws_id where w.course_id = ${c.id} and w.phase = 'done' group by m.user_id
    )
    select st.id, coalesce(tp.p, 0) as tasks, coalesce(ap.p, 0) as attend, coalesce(bp.p, 0) as bonus,
      coalesce(np.p, 0) as net, coalesce(wp.p, 0) as ws
    from st left join tp on tp.user_id = st.id left join ap on ap.user_id = st.id left join bp on bp.user_id = st.id
      left join np on np.user_id = st.id left join wp on wp.user_id = st.id`;
  const m = new Map<number, Points>();
  for (const r of rows) m.set(r.id, { ...r, total: r.tasks + r.attend + r.bonus + r.net + r.ws });
  return m;
}

/** Bitta o'quvchining vazifadagi holati */
export type TaskState = "locked" | "todo" | "late" | "pending" | "done" | "rejected";

export function taskState(t: Task, subs: Sub[]): TaskState {
  if (!taskOpen(t)) return "locked";
  const mine = subs.filter((s) => s.task_id === t.id && s.status !== "cancelled");
  if (t.kind === "repeat") return mine.some((s) => s.status === "pending") ? "pending" : "todo";
  if (mine.some((s) => s.status === "approved")) return "done";
  if (mine.some((s) => s.status === "pending")) return "pending";
  if (mine.some((s) => s.status === "rejected")) return "rejected";
  if (t.due_at && new Date(t.due_at) < new Date()) return "late";
  return "todo";
}

/** Takroriy vazifa limiti: bugun / shu hafta yuborilganlar soni */
export function repeatUsage(t: Task, subs: Sub[], tz: string) {
  const live = subs.filter((s) => s.task_id === t.id && (s.status === "pending" || s.status === "approved"));
  const today = dayKey(new Date(), tz);
  const day = live.filter((s) => dayKey(s.created_at, tz) === today).length;
  const now = new Date();
  const weekStart = new Date(now.getTime() - weekdayMon(now, tz) * 86400000);
  const wk = dayKey(weekStart, tz);
  const week = live.filter((s) => dayKey(s.created_at, tz) >= wk).length;
  return { day, week };
}

/** Qarzlar: muddati o'tgan, topshirilmagan (yoki qaytarilgan) vazifalar */
export function debts(tasks: Task[], subs: Sub[]) {
  return tasks.filter((t) => t.kind !== "repeat" && t.due_at && new Date(t.due_at) < new Date() &&
    ["late", "rejected"].includes(taskState(t, subs)));
}

/** Davomat kodi: har daqiqada almashadigan 6 xonali kod */
export function attCode(lessonId: number, slot = Math.floor(Date.now() / 60000)) {
  const h = createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me").update(`${lessonId}:${slot}`).digest();
  return String(h.readUInt32BE(0) % 1000000).padStart(6, "0");
}
export function checkAttCode(lessonId: number, code: string) {
  const s = Math.floor(Date.now() / 60000);
  return [s, s - 1].some((x) => attCode(lessonId, x) === code.trim());
}
export function attWindow(l: Lesson, c: Course) {
  const st = new Date(l.starts_at).getTime();
  return { from: new Date(st - 2 * 3600000), to: new Date(st + c.points.window_after_min * 60000) };
}
export function attStatusFor(l: Lesson, c: Course, at = new Date()) {
  const late = Math.max(0, Math.floor((at.getTime() - new Date(l.starts_at).getTime()) / 60000));
  return { status: late <= c.points.late_ok_min ? "ontime" : "late", late_min: late };
}

export async function notify(userIds: number[], title: string, body = "", url = "") {
  if (!userIds.length) return;
  await sql`insert into notifications ${sql(userIds.map((user_id) => ({ user_id, title, body, url })))}`;
}

/** O'quvchi biror narsa yuborganda: uning guruhi kuratori va platforma adminlariga xabar */
export async function notifyStaff(studentId: number, title: string, body = "", url = "/tekshirish") {
  const ids = await sql<{ id: number }[]>`
    select g.curator_id as id from users s join groups g on g.id = s.group_id where s.id = ${studentId} and g.curator_id is not null
    union
    select a.id from users a join users s on s.platform_id = a.platform_id
    where s.id = ${studentId} and a.role = 'admin' and a.active`;
  await notify(ids.map((x) => x.id), title, body, url);
}

/** Workbook to'liqmi: har maydon to'ldirilgan bo'lishi kerak (recall/quiz — javob berilgan) */
export function wbMissing(wb: Workbook, data: Record<string, unknown>) {
  const miss: string[] = [];
  for (const s of wb.sections) for (const f of s.f ?? []) {
    const v = data[f.k];
    if (f.t === "table") {
      const rows = (v as string[][] | undefined) ?? [];
      const need = f.rows?.length ?? 1;
      const filled = rows.filter((r) => r?.some((c) => c?.trim())).length;
      if (filled < need) miss.push(f.l);
    } else if (f.t === "chips") {
      if (!Array.isArray(v) || !v.length) miss.push(f.l);
    } else if (v === undefined || v === null || String(v).trim() === "") miss.push(f.l);
  }
  return miss;
}

/** Workbook javoblarini tekshiruvchi uchun matnga aylantiradi */
export function wbText(wb: Workbook, data: Record<string, unknown>) {
  const out: string[] = [];
  for (const s of wb.sections) {
    const fs = s.f ?? [];
    if (!fs.length) continue;
    out.push(`## ${s.t}`);
    for (const f of fs) {
      const v = data[f.k];
      out.push(`**${f.l}**`);
      if (f.t === "table") {
        const rows = (v as string[][] | undefined) ?? [];
        const n = Math.max(rows.length, f.rows?.length ?? 0);
        for (let i = 0; i < n; i++) {
          const r = rows[i] ?? [];
          const label = f.rows?.[i] ? `${f.rows[i]}: ` : "";
          const cells = (f.cols ?? []).map((c, j) => ((f.cols?.length ?? 0) > 1 ? `${c} — ` : "") + (r[j] ?? "")).join("; ");
          out.push(`• ${label}${cells}`);
        }
      } else if (f.t === "quiz") {
        const i = Number(v);
        out.push(`${f.o?.[i] ?? "—"} ${i === f.c ? "✅" : "❌"}`);
      } else if (f.t === "chips") {
        out.push(((v as number[] | undefined) ?? []).map((i) => f.o?.[i]).join(", "));
      } else out.push(String(v ?? "—"));
    }
  }
  return out.join("\n");
}

export function attPoints(c: Course, a: { status: string; late_min: number } | undefined) {
  const P = c.points;
  if (!a || a.status === "absent") return P.att_absent;
  if (a.status === "excused") return 0;
  if (a.status === "ontime") return P.att_ontime;
  if (a.late_min <= P.late1_max) return P.att_late1;
  if (a.late_min <= P.late2_max) return P.att_late2;
  return P.att_absent;
}

/** O'quvchining ball tarixi (grafik uchun): har bir ball qachon va nimadan kelgan */
export async function timeline(c: Course, uid: number) {
  const [subs, att, bon, [usr], lessons] = await Promise.all([
    sql<{ at: Date; pts: number; title: string }[]>`
      select coalesce(s.graded_at, s.created_at) as at, s.points as pts, t.title from submissions s join tasks t on t.id = s.task_id
      where s.user_id = ${uid} and t.course_id = ${c.id} and s.status = 'approved'`,
    sql<{ lesson_id: number; status: string; late_min: number }[]>`
      select a.lesson_id, a.status, a.late_min from attendance a join lessons l on l.id = a.lesson_id where a.user_id = ${uid} and l.course_id = ${c.id}`,
    sql<{ at: Date; pts: number; title: string }[]>`select created_at as at, points as pts, note as title from bonuses where user_id = ${uid}`,
    sql<{ created_at: Date }[]>`select created_at from users where id = ${uid}`,
    getLessons(c.id),
  ]);
  const [net, ws] = await Promise.all([
    sql<{ at: Date; pts: number; title: string }[]>`
      select pr.created_at as at, pr.points as pts, 'Networking: ' || u.name as title from net_proofs pr
      join net_pairs pa on pa.id = pr.pair_id join net_rounds r on r.id = pa.round_id
      join users u on u.id = case when pa.a_id = ${uid} then pa.b_id else pa.a_id end
      where pr.user_id = ${uid} and r.course_id = ${c.id} and pr.status = 'approved'`,
    sql<{ at: Date; pts: number; title: string }[]>`
      select w.created_at as at, (w.res ->> m.team::text)::int as pts, 'Workshop: ' || w.title as title from ws_members m
      join workshops w on w.id = m.ws_id where m.user_id = ${uid} and w.course_id = ${c.id} and w.phase = 'done'`,
  ]);
  const ev: { at: Date; pts: number; title: string; kind: "task" | "att" | "bonus" | "net" | "ws" }[] = [
    ...net.map((x) => ({ ...x, kind: "net" as const })),
    ...ws.filter((x) => x.pts).map((x) => ({ ...x, kind: "ws" as const })),
    ...subs.map((s) => ({ ...s, kind: "task" as const })),
    ...bon.map((b) => ({ ...b, kind: "bonus" as const })),
  ];
  const now = Date.now();
  for (const l of lessons) {
    if (!l.attendance) continue;
    const a = att.find((x) => x.lesson_id === l.id);
    const closed = new Date(l.starts_at).getTime() + c.points.window_after_min * 60000 < now;
    const joined = new Date(l.starts_at).getTime() > new Date(usr.created_at).getTime() - 86400000;
    if (a || (closed && joined)) ev.push({ at: new Date(l.starts_at), pts: attPoints(c, a), title: `${l.n}-dars davomati`, kind: "att" });
  }
  return ev.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}
