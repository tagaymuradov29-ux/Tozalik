import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getTasks, scopeStudents, taskState, type Lesson, type Sub, type Task } from "@/lib/course";
import { lessonProgress, type Att, type Watch } from "@/lib/progress";
import { studentCtx } from "@/lib/student";
import { fmtDay, fmtDT, fmtTime, left, safeHtml, utcToLocalInput } from "@/lib/util";
import { Head, RowLink, StateBadge, Avatar } from "@/components/ui";
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
  const [vp] = isStudent ? await sql<(Watch & { position: number })[]>`select lesson_id, position, done, max_pos, duration from video_progress where user_id = ${u.id} and lesson_id = ${l.id}` : [];
  const [att] = isStudent ? await sql<Att[]>`select lesson_id, status, late_min from attendance where user_id = ${u.id} and lesson_id = ${l.id}` : [];
  const [me] = isStudent ? await sql<{ created_at: Date }[]>`select created_at from users where id = ${u.id}` : [];
  const prog = isStudent ? lessonProgress(l, course, tasks, subs, att, vp, new Date(me?.created_at ?? 0)) : null;
  // Xodim uchun: shu darsni kim yopdi, kim qayerda qoldi
  const staffRows = !isStudent && started ? await lessonStaff(u, course, l, tasks) : [];
  const stats = !isStudent
    ? await sql<{ watched: number; came: number }[]>`
        select (select count(*)::int from video_progress where lesson_id = ${l.id} and (done or max_pos > 60)) as watched,
               (select count(*)::int from attendance where lesson_id = ${l.id} and status in ('ontime','late')) as came`
    : [];
  const locked = isStudent && !started;
  const [{ words }] = course.category === "til" ? await sql<{ words: number }[]>`select count(*)::int as words from vocab where lesson_id = ${l.id}` : [{ words: 0 }];

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

          {course.category === "til" && (words > 0 || u.role === "admin") && (
            <div className="card">
              <div className="row between"><h2 className="h2">📚 Dars so&apos;zlari</h2><span className="pill">{words} ta</span></div>
              {isStudent ? (
                <div className="grid2">
                  <Link href={`/til/mashq?l=${l.id}`} className="btn soft">🃏 Kartochkalar</Link>
                  <Link href={`/til/talaffuz?l=${l.id}`} className="btn soft">🎙 Talaffuz</Link>
                </div>
              ) : <Link href={`/til/sozlar?l=${l.id}`} className="btn soft full">{words ? "So'zlarni ko'rish va qo'shish" : "+ Shu darsga so'z qo'shish"}</Link>}
            </div>
          )}

          {prog && prog.items.length > 0 && (
            <div className="card">
              <div className="row between">
                <h2 className="h2">Darsni yopish shartlari</h2>
                <span className={`pill ${prog.st === "done" ? "ok" : prog.st === "debt" ? "bad" : prog.st === "review" ? "warn" : "info"}`}>
                  {prog.st === "done" ? "Yopilgan ✓" : prog.st === "debt" ? "Qarz bor" : prog.st === "review" ? "Tekshirilmoqda" : "Davom etmoqda"}
                </span>
              </div>
              <div>
                {prog.items.map((i) => {
                  const inner = (
                    <>
                      <span className="ic">{i.st === "done" ? "✓" : i.st === "late" ? "!" : i.st === "review" ? "…" : ""}</span>
                      <div className="grow"><div className="t">{i.label}</div><div className="n">{i.note}</div></div>
                      {i.st === "todo" || i.st === "late" ? <span className="btn sm soft">{i.key === "att" ? "Belgilash" : i.key === "vid" ? "Ko'rish" : "Yuborish"}</span> : i.pts ? <span className="tiny muted">{i.pts} ball</span> : null}
                    </>
                  );
                  return i.href && i.key !== "vid" ? (
                    <Link key={i.key} href={i.href} className={`req ${i.st}`}>{inner}</Link>
                  ) : (
                    <div key={i.key} className={`req ${i.st}`}>{inner}</div>
                  );
                })}
              </div>
            </div>
          )}

          {!isStudent && (
            <div className="grid2">
              <Link href={`/davomat?l=${l.id}`} className="card tight"><span className="tiny muted">Darsga keldi</span><span className="big">{stats[0]?.came ?? 0}</span></Link>
              <div className="card tight"><span className="tiny muted">Yozuvni ko&apos;rdi</span><span className="big">{stats[0]?.watched ?? 0}</span></div>
            </div>
          )}

          {!isStudent && started && l.video_url && <VideoStats u={u} courseId={course.id} lessonId={l.id} />}

          {staffRows.length > 0 && (
            <div className="card">
              <div className="row between">
                <h2 className="h2">Kim yopdi</h2>
                <span className="tiny muted">{staffRows.filter((r) => r.st === "done").length}/{staffRows.length}</span>
              </div>
              <div className="list">
                {staffRows.filter((r) => r.st !== "done").map((r) => (
                  <RowLink key={r.id} href={`/oquvchi/${r.id}`}>
                    <Avatar name={r.name} size={30} />
                    <div className="grow"><div className="small trunc" style={{ fontWeight: 600 }}>{r.name}</div><div className="tiny muted">{r.missing || r.group_name}</div></div>
                    <span className={`pill ${r.st === "debt" ? "bad" : r.st === "review" ? "warn" : "info"}`}>{r.st === "debt" ? "Qarz" : r.st === "review" ? "Tekshiruvda" : "Jarayonda"}</span>
                  </RowLink>
                ))}
                {staffRows.every((r) => r.st === "done") && <div className="empty">Hamma bu darsni yopgan 🎉</div>}
              </div>
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

      {!isStudent && (tasks.length > 0 || u.role === "admin") && (
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

async function lessonStaff(u: Parameters<typeof scopeStudents>[0], course: NonNullable<Awaited<ReturnType<typeof currentCourse>>>, l: Lesson, tasks: Task[]) {
  const students = await scopeStudents(u, course.id);
  const ids = students.map((s) => s.id);
  const [subs, att, watch] = await Promise.all([
    sql<Sub[]>`select * from submissions where user_id = any(${ids}) and task_id = any(${tasks.map((t) => t.id)})`,
    sql<(Att & { user_id: number })[]>`select user_id, lesson_id, status, late_min from attendance where lesson_id = ${l.id} and user_id = any(${ids})`,
    sql<(Watch & { user_id: number })[]>`select user_id, lesson_id, done, max_pos, duration from video_progress where lesson_id = ${l.id} and user_id = any(${ids})`,
  ]);
  return students.map((s) => {
    const p = lessonProgress(l, course, tasks, subs.filter((x) => x.user_id === s.id),
      att.find((a) => a.user_id === s.id), watch.find((w) => w.user_id === s.id), new Date(s.created_at));
    const missing = p.items.filter((i) => i.key !== "vid" && (i.st === "late" || i.st === "todo")).map((i) => i.label).join(", ");
    return { ...s, st: p.st, missing };
  }).sort((a, b) => (a.st === "debt" ? 0 : 1) - (b.st === "debt" ? 0 : 1));
}


const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** 📊 Video darslar analitikasi: har o'quvchi videoning necha foizini ko'rdi va qayerda to'xtadi */
async function VideoStats({ u, courseId, lessonId }: { u: Parameters<typeof scopeStudents>[0]; courseId: number; lessonId: number }) {
  const students = await scopeStudents(u, courseId);
  const rows = await sql<{ user_id: number; max_pos: number; duration: number; done: boolean }[]>`
    select user_id, max_pos, duration, done from video_progress where lesson_id = ${lessonId} and user_id = any(${students.map((x) => x.id)})`;
  const dur = Math.max(0, ...rows.map((r) => r.duration));
  const list = students.map((st) => {
    const r = rows.find((x) => x.user_id === st.id);
    const pct = !r ? 0 : r.done ? 100 : r.duration ? Math.min(100, Math.round((r.max_pos / r.duration) * 100)) : 0;
    return { ...st, pct, pos: r?.max_pos ?? 0, opened: !!r, done: !!r?.done || pct >= 95 };
  }).sort((a, b) => b.pct - a.pct);
  const opened = list.filter((x) => x.opened);
  const avg = opened.length ? Math.round(opened.reduce((a, b) => a + b.pct, 0) / opened.length) : 0;
  // Qayerda to'xtashdi: 10 ta bo'lak bo'yicha (to'liq ko'rganlar hisobga olinmaydi)
  const buckets = Array.from({ length: 10 }, (_, k) => opened.filter((x) => !x.done && Math.min(9, Math.floor(x.pct / 10)) === k).length);
  const peak = buckets.indexOf(Math.max(...buckets));
  const mx = Math.max(1, ...buckets);
  const col = (p: number) => (p >= 95 ? "var(--ok)" : p >= 60 ? "var(--amber)" : "var(--red)");
  return (
    <div className="card">
      <div className="row between"><h2 className="h2">📊 Video: kim qancha ko&apos;rdi</h2><span className="tiny muted">{dur ? mmss(dur) : ""}</span></div>
      <div className="grid3">
        <div className="stat"><b>{avg}%</b><span className="tiny muted">o&apos;rtacha</span></div>
        <div className="stat"><b>{opened.length}/{list.length}</b><span className="tiny muted">ochdi</span></div>
        <div className="stat"><b>{list.filter((x) => x.done).length}</b><span className="tiny muted">oxirigacha</span></div>
      </div>
      {opened.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny muted">Qayerda to&apos;xtashdi{buckets[peak] ? ` — ko'pchilik ${peak * 10}–${peak * 10 + 10}% oralig'ida${dur ? ` (${mmss((dur * peak) / 10)}–${mmss((dur * (peak + 1)) / 10)})` : ""}` : ""}</span>
          <div className="vdrop">{buckets.map((b, k) => <i key={k} style={{ height: `${8 + (b / mx) * 56}px`, background: k === peak && b ? "var(--red)" : "var(--brand)", opacity: b ? 1 : 0.25 }} />)}</div>
          <div className="row between tiny muted"><span>0:00</span><span>{dur ? mmss(dur / 2) : "50%"}</span><span>{dur ? mmss(dur) : "100%"}</span></div>
        </div>
      )}
      <div className="list">
        {list.map((x) => (
          <Link key={x.id} href={`/oquvchi/${x.id}`} className="li">
            <Avatar name={x.name} size={30} />
            <div className="grow stack" style={{ gap: 4 }}>
              <div className="row between"><span className="small trunc" style={{ fontWeight: 600 }}>{x.name}</span><b className="small" style={{ color: x.opened ? col(x.pct) : "var(--ink-3)" }}>{x.pct}%</b></div>
              <div className="vbar2"><i style={{ width: `${x.pct}%`, background: col(x.pct) }} /></div>
              <span className="tiny muted">{!x.opened ? "Ochmagan" : x.done ? "✓ Oxirigacha ko'rdi" : `${mmss(x.pos)} da to'xtadi`}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
