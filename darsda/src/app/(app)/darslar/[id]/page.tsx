import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getTasks, taskState, type Lesson, type Sub } from "@/lib/course";
import { studentCtx } from "@/lib/student";
import { fmtDay, fmtDT, fmtTime, left, safeHtml, utcToLocalInput } from "@/lib/util";
import { Head, RowLink, StateBadge } from "@/components/ui";
import { Video } from "@/components/Video";
import { ActionForm, Submit } from "@/components/Form";
import { deleteLesson, saveLesson } from "@/app/actions/admin";
import { IFile, ILock } from "@/components/icons";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const isStudent = u.role === "student";
  const course = isStudent ? (await studentCtx(u))?.course : await currentCourse(u);
  if (!course) notFound();

  if (id === "yangi") {
    if (u.role !== "admin") notFound();
    const [mx] = await sql<{ n: number }[]>`select coalesce(max(n), 0) + 1 as n from lessons where course_id = ${course.id}`;
    return (
      <main className="page">
        <Head title="Yangi dars" back="/darslar" />
        <LessonForm tz={u.tz} n={mx.n} />
      </main>
    );
  }

  const [l] = await sql<Lesson[]>`select * from lessons where id = ${Number(id) || 0} and course_id = ${course.id}`;
  if (!l) notFound();
  const started = new Date(l.starts_at) <= new Date();
  const tasks = (await getTasks(course.id)).filter((t) => t.lesson_id === l.id);
  const subs = isStudent ? await sql<Sub[]>`select * from submissions where user_id = ${u.id} and task_id = any(${tasks.map((t) => t.id)})` : [];
  const [vp] = isStudent ? await sql<{ position: number; done: boolean }[]>`select position, done from video_progress where user_id = ${u.id} and lesson_id = ${l.id}` : [];
  const [att] = isStudent ? await sql<{ status: string; late_min: number }[]>`select status, late_min from attendance where user_id = ${u.id} and lesson_id = ${l.id}` : [];
  const stats = !isStudent
    ? await sql<{ watched: number; came: number }[]>`
        select (select count(*)::int from video_progress where lesson_id = ${l.id} and (done or max_pos > 60)) as watched,
               (select count(*)::int from attendance where lesson_id = ${l.id} and status in ('ontime','late')) as came`
    : [];
  const locked = isStudent && !started;

  return (
    <main className="page">
      <Head title={`${l.n}-dars`} back="/darslar" />
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="h2" style={{ fontSize: 19 }}>{l.title}</h1>
        <div className="sub">{fmtDay(l.starts_at, u.tz)}, {fmtTime(l.starts_at, u.tz)}{l.speaker ? ` · ${l.speaker}` : ""}</div>
      </div>

      {locked ? (
        <div className="card empty"><ILock /> <div>Dars {fmtDay(l.starts_at, u.tz)} kuni ochiladi</div></div>
      ) : (
        <>
          {l.video_url ? (
            <Video url={l.video_url} lessonId={l.id} start={vp?.position ?? 0} done={!!vp?.done} track={isStudent} />
          ) : (
            started && <div className="card tight sub small">Dars yozuvi hali joylanmagan.</div>
          )}

          {isStudent && l.attendance && started && (
            <div className="card tight row between">
              <span className="sub small">Davomat</span>
              {att ? (
                <span className={`pill ${att.status === "ontime" ? "ok" : att.status === "excused" ? "info" : att.status === "late" ? "warn" : "bad"}`}>
                  {att.status === "ontime" ? "Vaqtida" : att.status === "late" ? `${att.late_min} daq kechikdi` : att.status === "excused" ? "Sababli" : "Kelmadi"}
                </span>
              ) : new Date(l.starts_at).getTime() + course.points.window_after_min * 60000 > Date.now() ? (
                <Link href="/davomat" className="btn sm">Belgilash</Link>
              ) : (
                <span className="pill bad">Belgilanmagan</span>
              )}
            </div>
          )}

          {!isStudent && (
            <div className="grid2">
              <Link href={`/davomat?l=${l.id}`} className="card tight"><span className="tiny muted">Darsga keldi</span><span className="big">{stats[0]?.came ?? 0}</span></Link>
              <div className="card tight"><span className="tiny muted">Yozuvni ko&apos;rdi</span><span className="big">{stats[0]?.watched ?? 0}</span></div>
            </div>
          )}

          {l.content && (
            <div className="card">
              <h2 className="h2">Dars konspekti</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: safeHtml(l.content) }} />
            </div>
          )}

          {l.materials.length > 0 && (
            <div className="card">
              <h2 className="h2">Materiallar</h2>
              <div className="list">
                {l.materials.map((m, i) => (
                  <a key={i} href={m.url} target="_blank" rel="noreferrer" className="li">
                    <span className="num"><IFile size={18} /></span>
                    <div className="grow h3 trunc">{m.title}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(tasks.length > 0 || u.role === "admin") && (
        <div className="card">
          <div className="row between">
            <h2 className="h2">Vazifalar</h2>
            {u.role === "admin" && <Link href={`/vazifa/yangi?l=${l.id}`} className="btn sm soft">+ Vazifa</Link>}
          </div>
          <div className="list">
            {tasks.map((t) => {
              const s = isStudent ? taskState(t, subs) : null;
              return (
                <RowLink key={t.id} href={`/vazifa/${t.id}`}>
                  <div className="grow">
                    <div className="h3 trunc">{t.title}</div>
                    <div className="tiny muted">
                      {t.max_points} ball{t.due_at ? ` · ${fmtDT(t.due_at, u.tz)}` : ""}{s === "todo" && t.due_at ? ` · ${left(t.due_at)}` : ""}
                    </div>
                  </div>
                  {s && <StateBadge s={s} />}
                </RowLink>
              );
            })}
            {!tasks.length && <div className="empty">Vazifa yo&apos;q</div>}
          </div>
        </div>
      )}

      {u.role === "admin" && (
        <details className="card">
          <summary className="row between"><span className="h2">Darsni tahrirlash</span><span className="pill">ochish</span></summary>
          <LessonForm tz={u.tz} l={l} />
          <form action={deleteLesson}>
            <input type="hidden" name="id" value={l.id} />
            <Submit className="btn danger full" confirm="Dars va unga bog'langan davomat o'chiriladi. Davom etasizmi?">Darsni o&apos;chirish</Submit>
          </form>
        </details>
      )}
    </main>
  );
}

function LessonForm({ l, tz, n }: { l?: Lesson; tz: string; n?: number }) {
  return (
    <ActionForm action={saveLesson}>
      <input type="hidden" name="id" value={l?.id ?? ""} />
      <div className="grid2">
        <label className="field"><span>Raqami</span><input className="input" name="n" type="number" defaultValue={l?.n ?? n ?? 1} /></label>
        <label className="field"><span>Davomiyligi (daq)</span><input className="input" name="duration_min" type="number" defaultValue={l?.duration_min ?? 240} /></label>
      </div>
      <label className="field"><span>Mavzu</span><input className="input" name="title" defaultValue={l?.title} required /></label>
      <label className="field"><span>Spiker</span><input className="input" name="speaker" defaultValue={l?.speaker} /></label>
      <label className="field"><span>Boshlanish vaqti</span><input className="input" name="starts_at" type="datetime-local" defaultValue={utcToLocalInput(l?.starts_at ?? null, tz)} required /></label>
      <label className="field">
        <span>Video havolasi (Kinescope, YouTube, Vimeo yoki .mp4)</span>
        <input className="input" name="video_url" type="url" defaultValue={l?.video_url} placeholder="https://kinescope.io/…" />
      </label>
      <label className="field"><span>Konspekt / matn (oddiy matn yoki HTML)</span><textarea className="input" name="content" defaultValue={l?.content} rows={6} /></label>
      <label className="field">
        <span>Materiallar — har qatorda: Nomi https://havola</span>
        <textarea className="input" name="materials" rows={3} defaultValue={l?.materials.map((m) => `${m.title} ${m.url}`).join("\n")} placeholder="Prezentatsiya https://…" />
      </label>
      <label className="row small"><input type="checkbox" name="attendance" defaultChecked={l?.attendance ?? true} /> Davomat olinadi</label>
      <Submit>Saqlash</Submit>
    </ActionForm>
  );
}
