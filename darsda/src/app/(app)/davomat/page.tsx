import Link from "next/link";
import { requireUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { attWindow, currentCourse, getLessons, scopeStudents, type Course } from "@/lib/course";
import { nextLesson } from "@/lib/student";
import { fmtDay, fmtTime } from "@/lib/util";
import { Head, Avatar } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { AttCode } from "@/components/AttCode";
import { checkIn } from "@/app/actions/student";
import { markAttendance } from "@/app/actions/staff";

export default async function Davomat({ searchParams }: { searchParams: Promise<{ l?: string; c?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const course = await currentCourse(u);
  if (!course) return <main className="page"><Head title="Davomat" /><div className="card empty">Kurs topilmadi</div></main>;
  return u.role === "student" ? <StudentAtt u={u} course={course} code={sp.c} /> : <StaffAtt u={u} course={course} lid={Number(sp.l || 0)} />;
}

async function StudentAtt({ u, course, code }: { u: User; course: Course; code?: string }) {
  const lessons = await getLessons(course.id);
  const now = new Date();
  const open = lessons.find((l) => { const w = attWindow(l, course); return l.attendance && now >= w.from && now <= w.to; });
  const next = nextLesson(lessons);
  const att = await sql<{ lesson_id: number; status: string; late_min: number }[]>`
    select a.lesson_id, a.status, a.late_min from attendance a join lessons l on l.id = a.lesson_id where a.user_id = ${u.id} and l.course_id = ${course.id}`;
  const done = open && att.find((a) => a.lesson_id === open.id);
  const lateNow = open && now.getTime() > new Date(open.starts_at).getTime() + course.points.late_ok_min * 60000;

  return (
    <main className="page">
      <Head title="Davomat" back="/" />
      {open ? (
        <div className="card">
          <span className="pill ok" style={{ alignSelf: "flex-start" }}>{open.n}-dars · {fmtTime(open.starts_at, u.tz)}</span>
          <div className="h2">{open.title}</div>
          {done ? (
            <div className="okmsg">✓ Davomatingiz belgilangan{done.status === "late" ? ` (${done.late_min} daq kechikish)` : ""}</div>
          ) : (
            <ActionForm action={checkIn}>
              <label className="field">
                <span>Ekrandagi 6 xonali kod</span>
                <input className="input code6" style={{ fontSize: 34, padding: "10px 0" }} name="code" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} defaultValue={code} autoFocus required />
              </label>
              {lateNow && <input className="input" name="reason" placeholder="Kechikish sababi" />}
              <Submit>Belgilash</Submit>
            </ActionForm>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>Darsda ekrandagi QR kodni telefon kamerasi bilan skanerlang yoki kodni shu yerga yozing. Kod har daqiqada almashadi.</p>
        </div>
      ) : (
        <div className="card empty">
          Hozir davomat oynasi ochiq emas.
          {next && <div style={{ marginTop: 8 }}>Keyingi dars: <b>{fmtDay(next.starts_at, u.tz)}, {fmtTime(next.starts_at, u.tz)}</b></div>}
        </div>
      )}
      <div className="card">
        <h2 className="h2">Mening davomatim</h2>
        <div className="list">
          {lessons.filter((l) => l.attendance && new Date(l.starts_at) <= now).reverse().map((l) => {
            const a = att.find((x) => x.lesson_id === l.id);
            const closed = attWindow(l, course).to < now;
            return (
              <div key={l.id} className="li">
                <span className="num">{l.n}</span>
                <div className="grow small trunc">{l.title}</div>
                {a ? (
                  <span className={`pill ${a.status === "ontime" ? "ok" : a.status === "late" ? "warn" : a.status === "excused" ? "info" : "bad"}`}>
                    {a.status === "ontime" ? "Vaqtida" : a.status === "late" ? `+${a.late_min} daq` : a.status === "excused" ? "Sababli" : "Kelmadi"}
                  </span>
                ) : closed ? <span className="pill bad">Kelmadi</span> : <span className="pill">—</span>}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

async function StaffAtt({ u, course, lid }: { u: User; course: Course; lid: number }) {
  const lessons = (await getLessons(course.id)).filter((l) => l.attendance);
  const l = lessons.find((x) => x.id === lid) ?? nextLesson(lessons) ?? lessons.at(-1);
  if (!l) return <main className="page"><Head title="Davomat" /><div className="card empty">Davomat olinadigan dars yo&apos;q</div></main>;
  const students = await scopeStudents(u, course.id);
  const att = await sql<{ user_id: number; status: string; late_min: number }[]>`select user_id, status, late_min from attendance where lesson_id = ${l.id}`;
  const w = attWindow(l, course);
  const now = new Date();
  const live = now >= w.from && now <= w.to;
  const idx = lessons.indexOf(l);
  const ATT: Record<string, [string, string]> = { ontime: ["ok", "Vaqtida"], late: ["warn", "Kechikdi"], absent: ["bad", "Kelmadi"], excused: ["info", "Sababli"] };

  return (
    <main className="page">
      <Head title="Davomat" />
      <div className="card tight row between">
        {idx > 0 ? <Link href={`/davomat?l=${lessons[idx - 1].id}`} className="btn sm ghost">‹</Link> : <span />}
        <div style={{ textAlign: "center" }} className="grow">
          <div className="h3 trunc">{l.n}-dars. {l.title}</div>
          <div className="tiny muted">{fmtDay(l.starts_at, u.tz)}, {fmtTime(l.starts_at, u.tz)}</div>
        </div>
        {idx < lessons.length - 1 ? <Link href={`/davomat?l=${lessons[idx + 1].id}`} className="btn sm ghost">›</Link> : <span />}
      </div>
      {live ? (
        <div className="card">
          <AttCode lessonId={l.id} />
          <Link href={`/qr/${l.id}`} target="_blank" className="btn soft full">Proyektorga chiqarish (to&apos;liq ekran)</Link>
        </div>
      ) : (
        <div className="card tight sub small">
          {now < w.from ? `Kod dars boshlanishidan 2 soat oldin (${fmtTime(w.from, u.tz)}) ochiladi.` : "Davomat oynasi yopilgan. Quyida qo'lda belgilash mumkin."}
        </div>
      )}
      <div className="card">
        <div className="row between">
          <h2 className="h2">O&apos;quvchilar</h2>
          <span className="tiny muted">{att.filter((a) => a.status === "ontime" || a.status === "late").length}/{students.length} keldi</span>
        </div>
        <div className="list">
          {students.map((s) => {
            const a = att.find((x) => x.user_id === s.id);
            return (
              <div key={s.id} className="li" style={{ flexWrap: "wrap" }}>
                <Avatar name={s.name} size={34} />
                <div className="grow">
                  <div className="small trunc" style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="tiny muted">{s.group_name}</div>
                </div>
                {a && <span className={`pill ${ATT[a.status][0]}`}>{ATT[a.status][1]}{a.status === "late" ? ` ${a.late_min}′` : ""}</span>}
                <form action={markAttendance} className="row" style={{ gap: 4, width: "100%", paddingLeft: 46 }}>
                  <input type="hidden" name="lesson_id" value={l.id} />
                  <input type="hidden" name="user_id" value={s.id} />
                  {(["ontime", "late", "absent", "excused"] as const).map((k) => (
                    <button key={k} name="status" value={k} className={`pill ${a?.status === k ? ATT[k][0] : ""}`} style={{ border: 0, padding: "6px 10px" }}>{ATT[k][1]}</button>
                  ))}
                </form>
              </div>
            );
          })}
          {!students.length && <div className="empty">O&apos;quvchi yo&apos;q</div>}
        </div>
      </div>
    </main>
  );
}
