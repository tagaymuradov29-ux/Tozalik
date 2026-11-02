import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { attPoints, currentCourse, getLessons, getTasks, taskState, type Sub } from "@/lib/course";
import { fmtDate } from "@/lib/util";
import { Head, StateBadge, Avatar, ActBtn } from "@/components/ui";
import { PointsCard } from "@/components/PointsCard";
import { Roadmap, RoadLegend } from "@/components/Roadmap";
import { road, studentCtx } from "@/lib/student";
import { ActionForm, Submit } from "@/components/Form";
import { addBonus, deleteBonus, markAttendance, nudge, toggleActive, updateStudent } from "@/app/actions/staff";

export default async function Oquvchi({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser(["admin", "curator"]);
  const course = await currentCourse(u);
  if (!course) notFound();
  const [s] = await sql<{ id: number; name: string; phone: string; group_id: number; group_name: string; active: boolean; created_at: Date }[]>`
    select su.id, su.name, su.phone, su.group_id, g.name as group_name, su.active, su.created_at from users su join groups g on g.id = su.group_id
    where su.id = ${Number(id) || 0} and su.platform_id = ${u.platform_id} and su.role = 'student'
      and (${u.role === "admin"} or g.curator_id = ${u.id})`;
  if (!s) notFound();
  const [lessons, tasks, subs, att, bon, groups] = await Promise.all([
    getLessons(course.id),
    getTasks(course.id),
    sql<Sub[]>`select * from submissions where user_id = ${s.id}`,
    sql<{ lesson_id: number; status: string; late_min: number; reason: string }[]>`select lesson_id, status, late_min, reason from attendance where user_id = ${s.id}`,
    sql<{ id: number; points: number; note: string; created_at: Date }[]>`select id, points, note, created_at from bonuses where user_id = ${s.id} order by created_at desc`,
    u.role === "admin" ? sql<{ id: number; name: string }[]>`select id, name from groups where course_id = ${course.id} order by name` : [],
  ]);
  const started = lessons.filter((l) => new Date(l.starts_at) <= new Date());
  const ctx = await studentCtx(u, s.id);
  const R = ctx ? road(ctx) : null;
  const ATT: Record<string, [string, string]> = { ontime: ["ok", "Vaqtida"], late: ["warn", "Kechikdi"], absent: ["bad", "Kelmadi"], excused: ["info", "Sababli"] };

  return (
    <main className="page">
      <Head title={s.name} back="/guruh" />
      <div className="card tight row">
        <Avatar name={s.name} size={48} />
        <div className="grow">
          <div className="h3">{s.name}</div>
          <div className="tiny muted">{s.group_name} · +{s.phone}{s.active ? "" : " · bloklangan"}</div>
        </div>
      </div>
      <div className="grid2">
        <a href={`tel:+${s.phone}`} className="btn ghost">📞 Qo&apos;ng&apos;iroq</a>
        <form action={nudge}><input type="hidden" name="user_id" value={s.id} /><button className="btn ghost full">🔔 Eslatish</button></form>
      </div>

      {R && ctx && (
        <div className="card">
          <div className="row between">
            <h2 className="h2">Yo&apos;l xaritasi</h2>
            <span className={`pill ${R.debts ? "bad" : "ok"}`}>{R.closed}/{R.opened} yopilgan{R.debts ? ` · ${R.debts} qarz` : ""}</span>
          </div>
          <RoadLegend />
          <Roadmap lessons={ctx.lessons} states={R.states} here={R.here} tz={u.tz} />
        </div>
      )}
      {u.role !== "student" && (
        <Link href={`/parvoz?u=${s.id}`} className="card space-card flight">
          <span className="emo">📈</span>
          <div className="grow"><b>Ballar animatsiyasi</b><div className="tiny" style={{ opacity: 0.85 }}>Ballari raketa ko&apos;rinishida</div></div>
          <span style={{ fontSize: 20, opacity: 0.8 }}>›</span>
        </Link>
      )}

      <PointsCard u={u} course={course} uid={s.id} p={sp.p} base={`/oquvchi/${s.id}`} />

      <div className="card">
        <h2 className="h2">Darslar bo&apos;yicha</h2>
        {started.slice().reverse().map((l) => {
          const a = att.find((x) => x.lesson_id === l.id);
          const lt = tasks.filter((t) => t.lesson_id === l.id);
          const before = new Date(l.starts_at).getTime() <= new Date(s.created_at).getTime() - 86400000;
          const open = new Date(l.starts_at).getTime() + course.points.window_after_min * 60000 > Date.now();
          return (
            <details key={l.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <summary className="row">
                <span className="num">{l.n}</span>
                <div className="grow">
                  <div className="small trunc" style={{ fontWeight: 600 }}>{l.title}</div>
                  <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {l.attendance && (a ? <span className={`pill ${ATT[a.status][0]}`}>{ATT[a.status][1]} {attPoints(course, a)}</span>
                      : before || open ? <span className="pill">Davomat —</span>
                      : <span className="pill bad">Kelmadi {attPoints(course, a)}</span>)}
                    {lt.map((t) => { const st = taskState(t, subs); return <span key={t.id} className={`pill ${st === "done" ? "ok" : st === "pending" ? "warn" : st === "locked" || st === "todo" ? "" : "bad"}`}>{short(t.title, t.kind)}</span>; })}
                  </div>
                </div>
              </summary>
              <div className="stack" style={{ marginTop: 10 }}>
                {lt.map((t) => (
                  <Link key={t.id} href={`/tekshirish?t=${t.id}`} className="row between small">
                    <span className="trunc">{t.title}</span><StateBadge s={taskState(t, subs)} />
                  </Link>
                ))}
                {l.attendance && (
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                    {(["ontime", "late", "absent", "excused"] as const).map((k) => (
                      <ActBtn key={k} action={markAttendance} fields={{ lesson_id: l.id, user_id: s.id, status: k }} className={`pill ${a?.status === k ? ATT[k][0] : ""}`} style={{ border: 0, padding: "7px 11px" }}>{ATT[k][1]}</ActBtn>
                    ))}
                  </div>
                )}
                {a?.reason && <div className="tiny sub">Sabab: {a.reason}</div>}
              </div>
            </details>
          );
        })}
        {!started.length && <div className="empty">Hali dars bo&apos;lmagan</div>}
      </div>

      <div className="card">
        <h2 className="h2">Bonus / jarima ball</h2>
        <ActionForm action={addBonus} reset>
          <input type="hidden" name="user_id" value={s.id} />
          <div className="row" style={{ gap: 8 }}>
            <input className="input" name="points" type="number" placeholder="+20 yoki -10" style={{ width: 120 }} required />
            <input className="input" name="note" placeholder="Nima uchun" required />
          </div>
          <Submit className="btn soft full">Qo&apos;shish</Submit>
        </ActionForm>
        {bon.map((b) => (
          <div key={b.id} className="row between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <span className="grow trunc">{b.note} <span className="muted">· {fmtDate(b.created_at, u.tz)}</span></span>
            <b style={{ color: b.points < 0 ? "var(--red)" : "var(--brand)" }}>{b.points > 0 ? "+" : ""}{b.points}</b>
            {u.role === "admin" && <form action={deleteBonus}><input type="hidden" name="id" value={b.id} /><button className="pill" style={{ border: 0 }}>✕</button></form>}
          </div>
        ))}
      </div>

      <details className="card">
        <summary className="row between"><span className="h2">Tahrirlash</span><span className="pill">ochish</span></summary>
        <ActionForm action={updateStudent}>
          <input type="hidden" name="user_id" value={s.id} />
          <label className="field"><span>Ism familiya</span><input className="input" name="name" defaultValue={s.name} /></label>
          <label className="field"><span>Yangi parol (o&apos;zgartirish uchun)</span><input className="input" name="password" type="text" minLength={6} /></label>
          {u.role === "admin" && (
            <label className="field"><span>Guruh</span>
              <select className="input" name="group_id" defaultValue={s.group_id}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </label>
          )}
          <Submit>Saqlash</Submit>
        </ActionForm>
        {u.role === "admin" && (
          <form action={toggleActive}>
            <input type="hidden" name="user_id" value={s.id} />
            <Submit className="btn danger full" confirm={s.active ? "O'quvchi bloklanadi va kira olmaydi. Davom etasizmi?" : undefined}>{s.active ? "Bloklash" : "Faollashtirish"}</Submit>
          </form>
        )}
      </details>
    </main>
  );
}

function short(title: string, kind: string) {
  if (kind === "workbook") return "Workbook";
  const t = title.replace(/^\d+-dars\s*/i, "").replace(/^Amaliy:\s*/i, "Amaliy: ");
  return t.length > 16 ? t.slice(0, 15) + "…" : t.charAt(0).toUpperCase() + t.slice(1);
}
