import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getLessons, repeatUsage, taskOpen, taskState, type Sub, type Task, type Workbook as WB } from "@/lib/course";
import { fmtDT, KIND_LABEL, left, safeHtml, STATUS_LABEL, utcToLocalInput } from "@/lib/util";
import { Head, StateBadge } from "@/components/ui";
import { SubmitForm } from "@/components/SubmitForm";
import { Workbook } from "@/components/Workbook";
import { ActionForm, Submit } from "@/components/Form";
import { deleteTask, saveTask } from "@/app/actions/admin";
import { cancelSubmission } from "@/app/actions/student";
import { Files } from "@/components/Files";

export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ l?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  const course = await currentCourse(u);
  if (!course) notFound();
  const lessons = await getLessons(course.id);

  if (id === "yangi") {
    if (u.role !== "admin") notFound();
    const lid = Number(sp.l || 0) || null;
    return (
      <main className="page">
        <Head title="Yangi vazifa" back={lid ? `/darslar/${lid}` : "/darslar"} />
        <div className="card"><TaskForm tz={u.tz} lessons={lessons} lessonId={lid} /></div>
      </main>
    );
  }

  const [t] = await sql<Task[]>`select * from tasks where id = ${Number(id) || 0} and course_id = ${course.id}`;
  if (!t) notFound();
  const lesson = lessons.find((l) => l.id === t.lesson_id);
  const back = lesson ? `/darslar/${lesson.id}` : "/darslar";
  const isStudent = u.role === "student";
  const subs = isStudent ? await sql<Sub[]>`select * from submissions where task_id = ${t.id} and user_id = ${u.id} order by created_at desc` : [];
  const state = isStudent ? taskState(t, subs) : null;
  const wb = t.workbook ? { ...t.workbook, sections: t.workbook.sections.map((s) => ({ ...s, theory: s.theory?.map(safeHtml) })) } as WB : null;
  const [ans] = isStudent && wb ? await sql<{ data: Record<string, unknown> }[]>`select data from wb_answers where user_id = ${u.id} and task_id = ${t.id}` : [];
  const usage = isStudent && t.kind === "repeat" ? repeatUsage(t, subs, u.tz) : null;
  const canSend = isStudent && taskOpen(t) && (t.kind === "repeat" || ["todo", "late", "rejected"].includes(state!));
  const stats = !isStudent
    ? (await sql<{ status: string; n: number }[]>`select status, count(*)::int as n from submissions where task_id = ${t.id} group by status`)
    : [];
  const sn = (k: string) => stats.find((s) => s.status === k)?.n ?? 0;

  return (
    <main className="page">
      <Head title={t.title} back={back} />
      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {state && <StateBadge s={state} />}
          <span className="pill">{KIND_LABEL[t.kind]}</span>
          <span className="pill ok">{t.kind === "repeat" ? `har biri ${t.max_points} ball` : `${t.max_points} ball`}</span>
          {t.late_points !== null && t.kind !== "repeat" && <span className="pill warn">kechiksa {t.late_points}</span>}
        </div>
        {lesson && <Link href={back} className="sub small">{lesson.n}-dars. {lesson.title}</Link>}
        {t.due_at && <div className="small">Muddat: <b>{fmtDT(t.due_at, u.tz)}</b> <span className="muted">· {left(t.due_at)}</span></div>}
        {t.opens_at && !taskOpen(t) && <div className="small">Ochiladi: <b>{fmtDT(t.opens_at, u.tz)}</b></div>}
        {usage && (
          <div className="small">
            {t.per_day ? <>Bugun: <b>{usage.day}/{t.per_day}</b> </> : null}
            {t.per_week ? <>Shu hafta: <b>{usage.week}/{t.per_week}</b></> : null}
          </div>
        )}
        {t.instructions && t.kind !== "workbook" && <div className="prose" dangerouslySetInnerHTML={{ __html: safeHtml(t.instructions) }} />}
        {t.kind === "workbook" && t.instructions && <div className="quote">{t.instructions}</div>}
      </div>

      {isStudent && wb && taskOpen(t) && (
        <Workbook taskId={t.id} wb={wb} initial={ans?.data ?? {}} readOnly={state === "pending" || state === "done"} />
      )}

      {canSend && t.kind !== "workbook" && (
        <div className="card">
          <h2 className="h2">Javob yuborish</h2>
          <SubmitForm taskId={t.id} kind={t.kind} />
        </div>
      )}

      {isStudent && subs.length > 0 && (
        <div className="card">
          <h2 className="h2">Yuborganlarim</h2>
          {subs.map((s) => (
            <div key={s.id} className="stack" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <div className="row between">
                <span className="tiny muted">{fmtDT(s.created_at, u.tz)}{s.late ? " · kechikib" : ""}</span>
                <span className={`pill ${s.status === "approved" ? "ok" : s.status === "pending" ? "warn" : s.status === "rejected" ? "bad" : ""}`}>
                  {STATUS_LABEL[s.status]}{s.status === "approved" ? ` · +${s.points}` : ""}
                </span>
              </div>
              {s.text && t.kind !== "workbook" && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{s.text}</div>}
              {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="small trunc" style={{ color: "var(--blue)" }}>{s.link}</a>}
              <Files files={s.files} />
              {s.feedback && <div className={s.status === "rejected" ? "err small" : "okmsg small"}>💬 {s.feedback}</div>}
              {s.status === "pending" && (
                <form action={cancelSubmission}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn sm ghost">Qaytarib olish</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {!isStudent && (
        <div className="grid2">
          <Link href={`/tekshirish?t=${t.id}`} className="card tight"><span className="tiny muted">Tekshirish kutmoqda</span><span className="big">{sn("pending")}</span></Link>
          <div className="card tight"><span className="tiny muted">Qabul qilingan</span><span className="big">{sn("approved")}</span></div>
        </div>
      )}

      {u.role === "admin" && (
        <details className="card">
          <summary className="row between"><span className="h2">Vazifani tahrirlash</span><span className="pill">ochish</span></summary>
          <TaskForm t={t} tz={u.tz} lessons={lessons} lessonId={t.lesson_id} />
          <form action={deleteTask}>
            <input type="hidden" name="id" value={t.id} />
            <Submit className="btn danger full" confirm="Vazifa va unga yuborilgan barcha javoblar o'chiriladi. Davom etasizmi?">O&apos;chirish</Submit>
          </form>
        </details>
      )}
    </main>
  );
}

function TaskForm({ t, tz, lessons, lessonId }: { t?: Task; tz: string; lessons: { id: number; n: number; title: string }[]; lessonId: number | null }) {
  return (
    <ActionForm action={saveTask}>
      <input type="hidden" name="id" value={t?.id ?? ""} />
      <label className="field"><span>Nomi</span><input className="input" name="title" defaultValue={t?.title} required placeholder="3-dars konspekti" /></label>
      <label className="field">
        <span>Dars</span>
        <select className="input" name="lesson_id" defaultValue={lessonId ?? ""}>
          <option value="">— Darsga bog&apos;lanmagan —</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.n}. {l.title}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Turi</span>
        <select className="input" name="kind" defaultValue={t?.kind ?? "file"}>
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="field"><span>Yo&apos;riqnoma</span><textarea className="input" name="instructions" defaultValue={t?.instructions} rows={4} /></label>
      <div className="grid2">
        <label className="field"><span>Ball (maks.)</span><input className="input" name="max_points" type="number" defaultValue={t?.max_points ?? 10} /></label>
        <label className="field"><span>Kechiksa (maks.)</span><input className="input" name="late_points" type="number" defaultValue={t?.late_points ?? ""} placeholder="o'zgarmaydi" /></label>
      </div>
      <label className="field"><span>Ochiladi</span><input className="input" name="opens_at" type="datetime-local" defaultValue={utcToLocalInput(t?.opens_at ?? null, tz)} /></label>
      <label className="field"><span>Muddat</span><input className="input" name="due_at" type="datetime-local" defaultValue={utcToLocalInput(t?.due_at ?? null, tz)} /></label>
      <div className="grid2">
        <label className="field"><span>Kunlik limit (takroriy)</span><input className="input" name="per_day" type="number" defaultValue={t?.per_day ?? ""} /></label>
        <label className="field"><span>Haftalik limit</span><input className="input" name="per_week" type="number" defaultValue={t?.per_week ?? ""} /></label>
      </div>
      <label className="field"><span>Tartib raqami</span><input className="input" name="position" type="number" defaultValue={t?.position ?? 0} /></label>
      <label className="row small"><input type="checkbox" name="review" defaultChecked={t?.review ?? true} /> Kurator tekshiradi (o&apos;chirilsa — avtomatik qabul)</label>
      <label className="field">
        <span>Workbook (JSON, faqat «Workbook» turi uchun)</span>
        <textarea className="input" name="workbook" rows={5} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          defaultValue={t?.workbook ? JSON.stringify(t.workbook) : ""} placeholder={`{"sections":[{"t":"Bo'lim","f":[{"k":"a","t":"area","l":"Savol"}]}]}`} />
      </label>
      <Submit>Saqlash</Submit>
    </ActionForm>
  );
}
