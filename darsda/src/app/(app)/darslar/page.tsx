import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { currentCourse, getLessons, getTasks, taskState, type Sub } from "@/lib/course";
import { studentCtx } from "@/lib/student";
import { fmtDate, fmtTime } from "@/lib/util";
import { Head, Progress } from "@/components/ui";
import { ILock, IPlay } from "@/components/icons";

export default async function Darslar() {
  const u = await requireUser();
  const isStudent = u.role === "student";
  const ctx = isStudent ? await studentCtx(u) : null;
  const course = isStudent ? ctx?.course : await currentCourse(u);
  if (!course) return <main className="page"><Head title="Darslar" /><div className="card empty">Kurs topilmadi</div></main>;
  const [lessons, tasks] = ctx ? [ctx.lessons, ctx.tasks] : await Promise.all([getLessons(course.id), getTasks(course.id)]);
  const subs: Sub[] = ctx?.subs ?? [];
  const now = Date.now();
  const general = tasks.filter((t) => !t.lesson_id);

  return (
    <main className="page">
      <Head
        title="Darslar"
        sub={`${course.title} · ${lessons.length} ta dars`}
        right={u.role === "admin" ? <Link href="/darslar/yangi" className="btn sm">+ Dars</Link> : undefined}
      />

      {general.length > 0 && (
        <div className="card tight">
          <div className="tiny muted">Doimiy vazifalar</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {general.map((t) => (
              <Link key={t.id} href={`/vazifa/${t.id}`} className="pill info">{t.title}</Link>
            ))}
            {u.role === "admin" && <Link href="/vazifa/yangi" className="pill">+ Vazifa</Link>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="list">
          {lessons.map((l) => {
            const started = new Date(l.starts_at).getTime() <= now;
            const lt = tasks.filter((t) => t.lesson_id === l.id);
            const st = lt.map((t) => taskState(t, subs));
            const done = st.filter((s) => s === "done").length;
            const bad = st.filter((s) => s === "late" || s === "rejected").length;
            return (
              <Link key={l.id} href={`/darslar/${l.id}`} className="li" style={{ alignItems: "flex-start" }}>
                <span className={`num ${isStudent && lt.length && done === lt.length ? "ok" : started ? "now" : ""}`}>
                  {started ? l.n : <ILock size={16} />}
                </span>
                <div className="grow stack" style={{ gap: 4 }}>
                  <div className="h3">{l.title}</div>
                  <div className="tiny muted">
                    {fmtDate(l.starts_at, u.tz)}, {fmtTime(l.starts_at, u.tz)}{l.speaker ? ` · ${l.speaker}` : ""}
                  </div>
                  {isStudent && started && lt.length > 0 && (
                    <div className="row" style={{ gap: 8 }}>
                      <div className="grow"><Progress value={(done / lt.length) * 100} /></div>
                      <span className="tiny muted">{done}/{lt.length}</span>
                      {bad > 0 && <span className="pill bad">{bad} qarz</span>}
                    </div>
                  )}
                  {!isStudent && lt.length > 0 && <div className="tiny muted">{lt.length} ta vazifa</div>}
                </div>
                {l.video_url && started && <span style={{ color: "var(--brand)" }}><IPlay size={20} /></span>}
              </Link>
            );
          })}
          {!lessons.length && <div className="empty">Hali dars qo&apos;shilmagan</div>}
        </div>
      </div>
      {u.role === "admin" && !general.length && <Link href="/vazifa/yangi" className="btn ghost full">+ Darsga bog&apos;lanmagan vazifa (stories, reels…)</Link>}
    </main>
  );
}
