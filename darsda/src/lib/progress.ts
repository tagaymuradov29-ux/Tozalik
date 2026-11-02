import "server-only";
import { sql } from "./db";
import { attWindow, taskState, type Course, type Lesson, type Sub, type Task } from "./course";

/** Dars holati (yo'l xaritasidagi tugun rangi) */
export type LState = "locked" | "done" | "review" | "current" | "debt";
/** Darsni yopish shartidagi bitta qator holati */
export type IState = "done" | "review" | "todo" | "late" | "na";

export type Item = { key: string; label: string; st: IState; note: string; href?: string; pts?: number };
export type Att = { lesson_id: number; status: string; late_min: number };
export type Watch = { lesson_id: number; done: boolean; max_pos: number; duration: number };

const ATT_TXT: Record<string, string> = { ontime: "Vaqtida keldingiz", late: "Kechikib keldingiz", excused: "Sababli", absent: "Kelmagansiz" };

/** Bitta dars bo'yicha: holat + «darsni yopish shartlari» ro'yxati (RM6 dagi kabi) */
export function lessonProgress(
  l: Lesson, c: Course, tasks: Task[], subs: Sub[], att: Att | undefined, watch: Watch | undefined, joinedAt: Date, now = new Date(),
): { st: LState; items: Item[] } {
  const start = new Date(l.starts_at);
  if (now < start) return { st: "locked", items: [] };
  const items: Item[] = [];
  if (l.attendance) {
    const before = start.getTime() < joinedAt.getTime() - 86400000;
    const open = now <= attWindow(l, c).to;
    let st: IState = "todo";
    if (att) st = att.status === "absent" ? "late" : "done";
    else if (before) st = "na";
    else if (!open) st = "late";
    items.push({ key: "att", label: "Darsga kelish", st, note: att ? ATT_TXT[att.status] ?? "" : before ? "Kursga keyin qo'shilgansiz" : open ? "Kod yoki QR orqali belgilang" : "Belgilanmagan", href: open && !att ? "/davomat" : undefined });
  }
  if (l.video_url) {
    const seen = !!watch && (watch.done || watch.max_pos >= 60);
    const pct = watch?.duration ? Math.min(100, Math.round((watch.max_pos / watch.duration) * 100)) : 0;
    items.push({ key: "vid", label: "Dars videosini ko'rish", st: watch?.done ? "done" : seen ? "review" : "todo", note: watch?.done ? "Ko'rildi" : seen ? `${pct}% ko'rilgan` : "Ko'rilmagan", href: `/darslar/${l.id}` });
  }
  for (const t of tasks.filter((x) => x.lesson_id === l.id)) {
    const s = taskState(t, subs);
    const map: Record<string, IState> = { done: "done", pending: "review", late: "late", rejected: "late", todo: "todo", locked: "na" };
    const ap = subs.find((x) => x.task_id === t.id && x.status === "approved");
    const note = s === "done" ? `Qabul qilindi · +${ap?.points ?? 0}` : s === "pending" ? "Kurator tekshirmoqda" : s === "rejected" ? "Qaytarildi — qayta yuboring" : s === "late" ? "Muddati o'tgan" : s === "locked" ? "Hali ochilmagan" : "Yuborish kerak";
    items.push({ key: `t${t.id}`, label: t.title.replace(/^\d+-dars\s*/i, "").replace(/^./, (x) => x.toUpperCase()), st: map[s], note, href: `/vazifa/${t.id}`, pts: t.max_points });
  }
  const req = items.filter((i) => i.key !== "vid" && i.st !== "na");
  let st: LState;
  if (req.some((i) => i.st === "late")) st = "debt";
  else if (req.length && req.every((i) => i.st === "done")) st = "done";
  else if (req.length && req.every((i) => i.st === "done" || i.st === "review")) st = "review";
  else if (!req.length) st = "done";
  else st = "current";
  return { st, items };
}

/** Kurator/admin jurnali: har o'quvchi × har dars holati va «qayerda to'xtagan» */
export async function journal(c: Course, lessons: Lesson[], tasks: Task[], students: { id: number; name: string; group_name: string; created_at: Date }[]) {
  const ids = students.map((s) => s.id);
  const [subs, att, watch] = await Promise.all([
    sql<Sub[]>`select s.* from submissions s join tasks t on t.id = s.task_id where t.course_id = ${c.id} and s.user_id = any(${ids})`,
    sql<(Att & { user_id: number })[]>`select a.user_id, a.lesson_id, a.status, a.late_min from attendance a join lessons l on l.id = a.lesson_id where l.course_id = ${c.id} and a.user_id = any(${ids})`,
    sql<(Watch & { user_id: number })[]>`select v.user_id, v.lesson_id, v.done, v.max_pos, v.duration from video_progress v join lessons l on l.id = v.lesson_id where l.course_id = ${c.id} and v.user_id = any(${ids})`,
  ]);
  const now = new Date();
  const started = lessons.filter((l) => new Date(l.starts_at) <= now);
  const rows = students.map((s) => {
    const my = subs.filter((x) => x.user_id === s.id);
    const cells = started.map((l) => lessonProgress(l, c, tasks, my,
      att.find((a) => a.user_id === s.id && a.lesson_id === l.id), watch.find((w) => w.user_id === s.id && w.lesson_id === l.id),
      new Date(s.created_at), now).st);
    const stop = cells.findIndex((x) => x !== "done");
    const debt = cells.filter((x) => x === "debt").length;
    return { ...s, cells, stop: stop < 0 ? null : started[stop], debt };
  });
  // Har dars bo'yicha: necha kishi yopgan / qarzda
  const perLesson = started.map((l, i) => ({
    l, done: rows.filter((r) => r.cells[i] === "done").length, debt: rows.filter((r) => r.cells[i] === "debt").length,
  }));
  return { started, rows, perLesson };
}
