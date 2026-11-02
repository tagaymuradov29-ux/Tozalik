import Link from "next/link";
import { requireUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { attWindow, currentCourse, debts, getLessons, getTasks, pointsAll, scopeStudents, taskOpen, taskState } from "@/lib/course";
import { nextLesson, ranking, studentCtx } from "@/lib/student";
import { fmtDay, fmtDT, fmtTime, left } from "@/lib/util";
import { Head, Progress, RowLink, StateBadge, Avatar } from "@/components/ui";
import { IBell, IPlay, IQr } from "@/components/icons";

export default async function Home() {
  const u = await requireUser();
  return u.role === "student" ? <StudentHome u={u} /> : <StaffHome u={u} />;
}

function Bell() {
  return <Link href="/bildirishnomalar" className="back" aria-label="Bildirishnomalar"><IBell size={20} /></Link>;
}

function NoCourse({ u }: { u: User }) {
  return (
    <main className="page">
      <Head title="Bugun" right={<Bell />} />
      <div className="card empty">
        {u.role === "student" ? "Siz hali guruhga biriktirilmagansiz. Kurator yoki admin tez orada qo'shadi." : "Hali kurs yo'q."}
      </div>
      <Link href="/profil" className="btn ghost full">Profil</Link>
    </main>
  );
}

async function StudentHome({ u }: { u: User }) {
  const ctx = await studentCtx(u);
  if (!ctx) return <NoCourse u={u} />;
  const { course, lessons, tasks, subs, att } = ctx;
  const rank = await ranking(course, u.group_id);
  const me = rank.find((r) => r.id === u.id);
  const next = nextLesson(lessons);
  const open = tasks
    .filter((t) => taskOpen(t) && t.kind !== "repeat")
    .map((t) => ({ t, s: taskState(t, subs) }))
    .filter((x) => ["todo", "rejected", "late"].includes(x.s))
    .sort((a, b) => +new Date(a.t.due_at ?? 8.64e15) - +new Date(b.t.due_at ?? 8.64e15));
  const debt = debts(tasks, subs).length;
  const goal = course.points.goals.find((g) => (me?.total ?? 0) < g.pts) ?? course.points.goals.at(-1);
  const win = next ? attWindow(next, course) : null;
  const canCheck = next && win && new Date() >= win.from && new Date() <= win.to && next.attendance && !att.some((a) => a.lesson_id === next.id);
  const first = u.name.split(" ")[0];

  return (
    <main className="page">
      <Head title={`Salom, ${first}`} right={<Bell />} sub={course.title} />

      <div className="card">
        <div className="row between">
          <div>
            <div className="sub small">Jami ballingiz</div>
            <div className="big">{me?.total ?? 0}</div>
          </div>
          <Link href="/natijalar" className="stat" style={{ alignItems: "center", minWidth: 92 }}>
            <span className="tiny muted">Guruhda</span>
            <b>{me?.rank ?? "—"}-o&apos;rin</b>
            <span className="tiny muted">{rank.length} kishidan</span>
          </Link>
        </div>
        {goal && (
          <div className="stack" style={{ gap: 6 }}>
            <Progress value={((me?.total ?? 0) / goal.pts) * 100} />
            <div className="tiny sub">{goal.label} — {goal.pts} ball{(me?.total ?? 0) < goal.pts ? `, yana ${goal.pts - (me?.total ?? 0)}` : " ✓"}</div>
          </div>
        )}
        {debt > 0 && <Link href="/darslar" className="pill bad" style={{ alignSelf: "flex-start" }}>⚠️ {debt} ta qarz vazifa</Link>}
      </div>

      {next && (
        <div className="card">
          <div className="row between">
            <span className="pill ok">{new Date(next.starts_at) <= new Date() ? "Hozir efirda" : "Keyingi dars"}</span>
            <span className="tiny muted">{fmtDay(next.starts_at, u.tz)}, {fmtTime(next.starts_at, u.tz)}</span>
          </div>
          <Link href={`/darslar/${next.id}`} className="stack" style={{ gap: 2 }}>
            <div className="h2">{next.n}-dars. {next.title}</div>
            {next.speaker && <div className="sub">{next.speaker}</div>}
          </Link>
          {canCheck && (
            <Link href="/davomat" className="btn full"><IQr size={20} /> Davomatni belgilash</Link>
          )}
          {att.find((a) => a.lesson_id === next.id) && <span className="pill ok" style={{ alignSelf: "flex-start" }}>✓ Davomat belgilandi</span>}
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h2 className="h2">Vazifalar</h2>
          <Link href="/yuborish" className="tiny" style={{ color: "var(--brand)", fontWeight: 600 }}>Yuborish</Link>
        </div>
        {open.length ? (
          <div className="list">
            {open.slice(0, 6).map(({ t, s }) => (
              <RowLink key={t.id} href={`/vazifa/${t.id}`}>
                <div className="grow">
                  <div className="h3 trunc">{t.title}</div>
                  <div className="tiny muted">{t.due_at ? `${fmtDT(t.due_at, u.tz)} · ${left(t.due_at)}` : "Muddatsiz"} · {t.max_points} ball</div>
                </div>
                <StateBadge s={s} />
              </RowLink>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: 12 }}>Hamma vazifa topshirilgan 🎉</div>
        )}
      </div>

      <Extras u={u} courseId={course.id} />

      {lessons.filter((l) => l.video_url && new Date(l.starts_at) <= new Date()).slice(-1).map((l) => (
        <Link key={l.id} href={`/darslar/${l.id}`} className="card tight">
          <div className="row">
            <span className="num ok"><IPlay size={16} /></span>
            <div className="grow">
              <div className="tiny muted">Dars yozuvi</div>
              <div className="h3 trunc">{l.n}-dars. {l.title}</div>
            </div>
          </div>
        </Link>
      ))}
    </main>
  );
}

async function StaffHome({ u }: { u: User }) {
  const course = await currentCourse(u);
  if (!course) return <NoCourse u={u} />;
  const [students, lessons, tasks, pts] = await Promise.all([
    scopeStudents(u, course.id), getLessons(course.id), getTasks(course.id), pointsAll(course),
  ]);
  const ids = students.map((s) => s.id);
  const [pending, subs, groups] = await Promise.all([
    sql<{ n: number }[]>`select count(*)::int as n from submissions where status = 'pending' and user_id = any(${ids})`,
    sql<{ user_id: number; task_id: number; status: string }[]>`
      select user_id, task_id, status from submissions where user_id = any(${ids}) and status in ('pending','approved','rejected')`,
    sql<{ id: number; name: string; curator: string | null; n: number }[]>`
      select g.id, g.name, cu.name as curator, (select count(*)::int from users s where s.group_id = g.id and s.role='student' and s.active) as n
      from groups g left join users cu on cu.id = g.curator_id
      where g.course_id = ${course.id} and (${u.role !== "curator"} or g.curator_id = ${u.id}) order by g.name`,
  ]);
  const next = nextLesson(lessons);
  const past = lessons.filter((l) => new Date(l.starts_at) <= new Date());
  const last = past.at(-1);
  const att = last
    ? await sql<{ status: string; n: number }[]>`select status, count(*)::int as n from attendance where lesson_id = ${last.id} and user_id = any(${ids}) group by status`
    : [];
  const came = att.filter((a) => a.status === "ontime" || a.status === "late").reduce((s, a) => s + a.n, 0);
  const dueTasks = tasks.filter((t) => t.kind !== "repeat" && t.due_at && new Date(t.due_at) < new Date());
  const debtors = students
    .map((s) => ({
      ...s,
      debt: dueTasks.filter((t) => !subs.some((x) => x.user_id === s.id && x.task_id === t.id && x.status !== "rejected")).length,
    }))
    .filter((s) => s.debt > 0)
    .sort((a, b) => b.debt - a.debt);
  const top = [...students].sort((a, b) => (pts.get(b.id)?.total ?? 0) - (pts.get(a.id)?.total ?? 0)).slice(0, 5);

  return (
    <main className="page">
      <Head title="Bugun" right={<Bell />} sub={`${course.title} · ${u.role === "admin" ? "Administrator" : "Kurator"}`} />

      <div className="grid2">
        <Link href="/tekshirish" className="card tight">
          <span className="tiny muted">Tekshirish kutmoqda</span>
          <span className="big" style={{ color: pending[0].n ? "var(--amber)" : undefined }}>{pending[0].n}</span>
        </Link>
        <Link href="/guruh" className="card tight">
          <span className="tiny muted">O&apos;quvchilar</span>
          <span className="big">{students.length}</span>
        </Link>
        <div className="card tight">
          <span className="tiny muted">Oxirgi dars davomati</span>
          <span className="big">{students.length ? Math.round((came / students.length) * 100) : 0}%</span>
        </div>
        <div className="card tight">
          <span className="tiny muted">Qarzdorlar</span>
          <span className="big" style={{ color: debtors.length ? "var(--red)" : undefined }}>{debtors.length}</span>
        </div>
      </div>

      {next && (
        <div className="card">
          <div className="row between">
            <span className="pill ok">{new Date(next.starts_at) <= new Date() ? "Hozir efirda" : "Keyingi dars"}</span>
            <span className="tiny muted">{fmtDay(next.starts_at, u.tz)}, {fmtTime(next.starts_at, u.tz)}</span>
          </div>
          <div className="h2">{next.n}-dars. {next.title}</div>
          <div className="row">
            <Link href="/davomat" className="btn sm"><IQr size={18} /> Davomat kodi</Link>
            <Link href={`/darslar/${next.id}`} className="btn sm ghost">Dars sahifasi</Link>
          </div>
        </div>
      )}

      {debtors.length > 0 && (
        <div className="card">
          <h2 className="h2">Qarzdorlar</h2>
          <div className="list">
            {debtors.slice(0, 6).map((s) => (
              <RowLink key={s.id} href={`/oquvchi/${s.id}`}>
                <Avatar name={s.name} size={36} />
                <div className="grow"><div className="h3 trunc">{s.name}</div><div className="tiny muted">{s.group_name}</div></div>
                <span className="pill bad">{s.debt} qarz</span>
              </RowLink>
            ))}
          </div>
          {debtors.length > 6 && <Link href="/guruh?f=qarz" className="tiny" style={{ color: "var(--brand)", fontWeight: 600 }}>Hammasi ({debtors.length})</Link>}
        </div>
      )}

      <div className="card">
        <div className="row between"><h2 className="h2">Reyting</h2><Link href="/natijalar" className="tiny" style={{ color: "var(--brand)", fontWeight: 600 }}>To&apos;liq</Link></div>
        <div className="list">
          {top.map((s, i) => (
            <RowLink key={s.id} href={`/oquvchi/${s.id}`}>
              <span className={`num ${i === 0 ? "ok" : ""}`}>{i + 1}</span>
              <div className="grow"><div className="h3 trunc">{s.name}</div><div className="tiny muted">{s.group_name}</div></div>
              <b>{pts.get(s.id)?.total ?? 0}</b>
            </RowLink>
          ))}
          {!top.length && <div className="empty">Hali o&apos;quvchi yo&apos;q. «{u.role === "admin" ? "Odamlar" : "Guruh"}» bo&apos;limidan taklif havolasini yuboring.</div>}
        </div>
      </div>

      <div className="card">
        <h2 className="h2">Guruhlar</h2>
        <div className="list">
          {groups.map((g) => (
            <RowLink key={g.id} href={`/guruh?g=${g.id}`}>
              <div className="grow"><div className="h3">{g.name}</div><div className="tiny muted">{g.curator ?? "Kurator yo'q"} · {g.n} o&apos;quvchi</div></div>
            </RowLink>
          ))}
        </div>
      </div>
      <Extras u={u} courseId={course.id} />
      <Link href="/profil" className="btn ghost full">Profil va sozlamalar</Link>
    </main>
  );
}

/** Networking va Workshop kirish kartalari (hozirgi holati bilan) */
async function Extras({ u, courseId }: { u: User; courseId: number }) {
  const [[ws], [net]] = await Promise.all([
    sql<{ id: number; title: string; phase: string }[]>`
      select id, title, phase from workshops where course_id = ${courseId} order by (phase = 'done'), created_at desc limit 1`,
    sql<{ total: number; ok: number }[]>`
      select count(*)::int as total, count(*) filter (where exists (select 1 from net_proofs x where x.pair_id = pa.id and x.user_id = ${u.id} and x.status = 'approved'))::int as ok
      from net_pairs pa join net_rounds r on r.id = pa.round_id
      where r.course_id = ${courseId} and (pa.a_id = ${u.id} or pa.b_id = ${u.id})
        and r.starts_at + (pa.week - 1) * interval '7 days' <= now()`,
  ]);
  const wsTxt = !ws ? "Hali yo'q" : ws.phase === "join" ? "Jamoaga yozilish ochiq" : ws.phase === "vote" ? "Baholash ketmoqda" : "Natijalar";
  return (
    <div className="grid2">
      <Link href="/networking" className="card tight">
        <span style={{ fontSize: 22 }}>🤝</span>
        <span className="h3">Networking</span>
        <span className="tiny muted">{u.role === "student" ? (net?.total ? `${net.ok}/${net.total} tanishuv` : "Tez orada") : "Juftliklar va isbotlar"}</span>
      </Link>
      <Link href={ws ? `/workshop/${ws.id}` : "/workshop"} className="card tight">
        <span style={{ fontSize: 22 }}>🏆</span>
        <span className="h3">Workshop</span>
        <span className="tiny muted" style={ws && ws.phase !== "done" ? { color: "var(--brand)", fontWeight: 600 } : undefined}>{wsTxt}</span>
      </Link>
    </div>
  );
}

