import Link from "next/link";
import { requireUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getLessons, getTasks, pointsAll, scopeStudents } from "@/lib/course";
import { nextLesson, ranking, road, studentCtx } from "@/lib/student";
import { Roadmap, RoadLegend } from "@/components/Roadmap";
import { journal } from "@/lib/progress";
import { flightData, skyData } from "@/lib/space";
import { getBrand, label, on, type Brand } from "@/lib/platform";
import { journey } from "@/lib/journeys";
import { stats as wstats, wordsFor } from "@/lib/til";
import { langOf } from "@/lib/lang";
import { myCourses } from "@/lib/accounts";
import { SkyMini } from "@/components/Sky";
import { fmtDay, fmtTime } from "@/lib/util";
import { ActBtn, Head, Progress, RowLink, Avatar } from "@/components/ui";
import { nudge } from "@/app/actions/staff";
import { IBell, ICheck, IClock, ILock, IPlay, IQr } from "@/components/icons";
import { ThemeToggle } from "@/components/Theme";

export default async function Home() {
  const u = await requireUser();
  return u.role === "student" ? <StudentHome u={u} /> : <StaffHome u={u} />;
}

function Bell({ name }: { name: string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <ThemeToggle />
      <Link href="/bildirishnomalar" className="back" aria-label="Bildirishnomalar"><IBell size={18} /></Link>
      <Link href="/profil" aria-label="Profil va chiqish" className="me-btn"><Avatar name={name} size={34} /></Link>
    </div>
  );
}

function NoCourse({ u }: { u: User }) {
  return (
    <main className="page">
      <Head title="Bugun" right={<Bell name={u.name} />} />
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
  const { course, lessons } = ctx;
  const b = await getBrand(u.platform_id);
  const [rank, F, K] = await Promise.all([ranking(course, u.group_id), flightData(ctx, u.id), on(b, "osmon") ? skyData(u, course) : null]);
  const R = road(ctx);
  const [mine, [{ unread }]] = await Promise.all([myCourses(u),
    sql<{ unread: number }[]>`select count(*)::int as unread from notifications where user_id = ${u.id} and read_at is null`]);
  const TS = course.category === "til" ? wstats(await wordsFor(course.id, u.id)) : null;
  const TL = langOf(course.lang);
  const sat = F.A.filter((a) => a.st === "done").length;
  const me = rank.find((r) => r.id === u.id);
  const goal = course.points.goals.find((g) => (me?.total ?? 0) < g.pts) ?? course.points.goals.at(-1);
  const hl = lessons[R.here];
  const hp = R.prog[R.here];
  // Keyingi qadam: avval qarz, keyin bajarilmagan shart
  const nextItem = hp?.items.find((i) => i.st === "late" && i.href) ?? hp?.items.find((i) => i.st === "todo" && i.href);
  const first = u.name.split(" ")[0];
  const vid = hp?.items.find((i) => i.key === "vid");
  const w = hl ? ctx.watch.find((x) => x.lesson_id === hl.id) : undefined;
  const vpct = w?.duration ? Math.min(100, Math.round((w.max_pos / w.duration) * 100)) : w?.done ? 100 : 0;
  const left = w?.duration && !w.done ? Math.max(0, Math.round(w.duration - w.max_pos)) : 0;
  const req = hp?.items.filter((i) => i.st !== "na") ?? [];
  const okN = req.filter((i) => i.st === "done").length;
  const isDebt = R.states[R.here] === "debt";
  const stepTxt = nextItem
    ? `${nextItem.key === "vid" ? (vpct ? "videoni tugatish" : "videoni ko'rish") : nextItem.label.toLowerCase()}${nextItem.key === "vid" && left ? ` — ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} qoldi` : nextItem.st === "late" ? " — muddati o'tgan" : ""}`
    : null;
  const other = R.debts - (isDebt ? 1 : 0);
  const grp = mine.find((c) => c.current)?.group_name;

  return (
    <main className="page">
      <div className="row" style={{ gap: 12, padding: "4px 0 2px" }}>
        <Link href="/profil" aria-label="Profil"><Avatar name={u.name} size={48} /></Link>
        <div className="grow stack" style={{ gap: 2 }}>
          <b style={{ fontSize: 17 }} className="trunc">Salom, {first}</b>
          {mine.length > 1
            ? <Link href="/kurslar" className="small" style={{ color: "var(--brand)", fontWeight: 600 }}>{course.title} · {mine.length} ta kurs ▾</Link>
            : <span className="small muted trunc">{course.title}{grp ? ` · ${grp}` : ""}</span>}
        </div>
        <Link href="/bildirishnomalar" className="back" aria-label="Bildirishnomalar" style={{ position: "relative" }}>
          <IBell size={20} />{unread > 0 && <i className="dot" />}
        </Link>
      </div>

      {hl && (
        <div className={`hero${isDebt ? " debt" : ""}`}>
          <div className="row between">
            <span className="hero-meta">{hl.n}-dars{hl.speaker ? ` · ${hl.speaker}` : ""}</span>
            <span className="hero-tag">{isDebt ? "Qarz" : R.states[R.here] === "review" ? "Tekshiruvda" : R.states[R.here] === "done" ? "Yopilgan" : "Bugun"}</span>
          </div>
          <Link href={`/darslar/${hl.id}`} className="hero-title">{hl.title}</Link>
          {req.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <div className="hero-bar"><i style={{ width: `${vid ? vpct : (okN / req.length) * 100}%` }} /></div>
              <div className="row between hero-meta"><span>{vid ? `Video ${vpct}% ko'rildi` : `${okN} ta shart bajarildi`}</span><span>{okN} / {req.length} shart</span></div>
            </div>
          )}
          {stepTxt && (
            <div className="hero-next"><IClock size={18} /><span><b>Keyingi qadam:</b> {stepTxt}</span></div>
          )}
          <Link href={nextItem?.href ?? `/darslar/${hl.id}`} className="btn light full"><IPlay size={16} /> {nextItem?.st === "late" ? "Qarzni yopish" : nextItem ? "Davom etish" : "Darsni ochish"}</Link>
        </div>
      )}
      {other > 0 && <Link href="#xarita" className="err" style={{ fontWeight: 600 }}>{isDebt ? "Yana " : ""}{other} ta darsda qarz bor — xaritada qizil ›</Link>}

      {hp && hp.items.length > 0 && (
        <div className="card">
          <h2 className="h2">Darsni yopish uchun</h2>
          <div className="checks">
            {hp.items.map((i) => {
              const right = i.key === "vid" ? (i.st === "done" ? "Ko'rildi" : `${vpct}%`) : i.st === "done" ? (i.pts ? `+${i.pts}` : "Bajarildi") : i.st === "review" ? "Tekshiruvda" : i.st === "late" ? "Qarz" : i.st === "na" ? "" : i.pts ? `+${i.pts}` : "";
              const body = (
                <>
                  <span className={`ck ${i.key === "vid" && i.st !== "done" ? "now" : i.st}`}>{i.st === "done" ? <ICheck size={14} /> : i.st === "late" ? "!" : i.st === "na" ? <ILock size={12} /> : null}</span>
                  <span className="grow">{i.key === "vid" ? "Videoni ko'rish" : i.label}</span>
                  <span className={`ck-r ${i.st}`}>{right}</span>
                </>
              );
              return i.href ? <Link key={i.key} href={i.href} className={`ck-row ${i.st}`}>{body}</Link> : <div key={i.key} className={`ck-row ${i.st}`}>{body}</div>;
            })}
          </div>
        </div>
      )}

      <div className="grid2">
        <Link href="/natijalar" className="card tight">
          <span className="small muted">Ballim</span>
          <b className="tile-n">{(me?.total ?? 0).toLocaleString("ru-RU")}</b>
          {on(b, "reyting") && me ? <span className="small" style={{ color: "var(--ok-ink)", fontWeight: 600 }}>{me.rank}-o&apos;rin guruhda</span>
            : goal ? <span className="small muted">{goal.label}: {goal.pts}</span> : null}
        </Link>
        <Link href="#xarita" className="card tight">
          <span className="small muted">Yo&apos;l xaritasi</span>
          <b className="tile-n">{R.closed} / {lessons.length}</b>
          {R.debts ? <span className="small" style={{ color: "var(--red-ink)", fontWeight: 600 }}>{R.debts} ta qarz</span> : <span className="small" style={{ color: "var(--ok-ink)", fontWeight: 600 }}>Qarz yo&apos;q</span>}
        </Link>
      </div>
      {goal && (
        <div className="card tight">
          <div className="row between small"><span className="muted">Keyingi maqsad: <b style={{ color: "var(--ink)" }}>{goal.label}</b></span><b style={{ color: "var(--brand)" }}>{(me?.total ?? 0) < goal.pts ? `${goal.pts - (me?.total ?? 0)} ball qoldi` : "✓"}</b></div>
          <Progress value={((me?.total ?? 0) / goal.pts) * 100} />
        </div>
      )}

      {TS && (
        <Link href="/til" className="card row" style={{ gap: 12, background: TS.due + TS.fresh ? "var(--brand-soft)" : undefined }}>
          <span style={{ fontSize: 30 }}>{TL?.flag ?? "🗣️"}</span>
          <div className="grow">
            <div className="h3">{TL?.name ?? "Til"} mashqlari</div>
            <div className="tiny muted">{TS.due + Math.min(TS.fresh, 10) ? `Bugun ${TS.due + Math.min(TS.fresh, 10)} ta so'z · ` : "Bugungi mashq bajarildi ✓ · "}{TS.learned}/{TS.total} yodlangan{TS.pron != null ? ` · talaffuz ${TS.pron}` : ""}</div>
          </div>
          <span className="muted">›</span>
        </Link>
      )}
      {on(b, "parvoz") && <Link href="/parvoz" className="card space-card flight" style={{ background: `linear-gradient(135deg, ${journey(b?.settings.journey).banner[0]}, ${journey(b?.settings.journey).banner[1]})` }}>
        <span className="emo">{journey(b?.settings.journey).emoji}</span>
        <div className="grow">
          <b>Ballarim · {label(b, "parvoz")}</b>
          <div className="tiny" style={{ opacity: 0.85 }}>{F.pts} ball · {F.done}/{F.total} vazifa · {sat} ta amaliy</div>
        </div>
        <span style={{ fontSize: 20, opacity: 0.8 }}>›</span>
      </Link>}
      {K && <SkyMini K={K} title={label(b, "osmon")} />}

      <div className="card" id="xarita" style={{ scrollMarginTop: 12 }}>
        <div className="row between">
          <h2 className="h2">Yo&apos;l xaritasi</h2>
          <span className="tiny muted">{R.closed} ta dars yopilgan</span>
        </div>
        <RoadLegend />
        <Roadmap lessons={lessons} states={R.states} here={R.here} tz={u.tz} theme={b?.settings.road} />
      </div>

      <Extras u={u} courseId={course.id} b={b} />
      <ProfileRow u={u} />
    </main>
  );
}

async function StaffHome({ u }: { u: User }) {
  const [course, b] = await Promise.all([currentCourse(u), getBrand(u.platform_id)]);
  if (!course) return <NoCourse u={u} />;
  const [students, lessons, tasks, pts] = await Promise.all([
    scopeStudents(u, course.id), getLessons(course.id), getTasks(course.id), pointsAll(course),
  ]);
  const ids = students.map((s) => s.id);
  const [pending, subs, groups] = await Promise.all([
    sql<{ n: number; oldest: Date | null; late: number }[]>`select count(*)::int as n, min(created_at) as oldest, count(*) filter (where late)::int as late
      from submissions where status = 'pending' and user_id = any(${ids})`,
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
  const J = await journal(course, lessons, tasks, students);
  const behind = J.rows.filter((r) => r.stop).sort((a, b) => a.stop!.n - b.stop!.n || b.debt - a.debt);
  const lastStat = J.perLesson.at(-1);

  return (
    <main className="page">
      <Head title="Bugun" right={<Bell name={u.name} />} sub={`${course.title} · ${u.role === "admin" ? "Administrator" : "Kurator"}`} />
      {course.category === "til" && (
        <Link href="/til" className="card row" style={{ gap: 12 }}>
          <span style={{ fontSize: 26 }}>{langOf(course.lang)?.flag ?? "🗣️"}</span>
          <div className="grow"><div className="h3">Til paketi</div><div className="tiny muted">Lug&apos;at, o&apos;quvchilar yodlagan so&apos;zlar va talaffuz natijalari</div></div>
          <span className="muted">›</span>
        </Link>
      )}
      {u.role === "admin" && (
        <Link href="/sozlash" className="card row" style={{ gap: 12, background: "var(--brand-soft)" }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <div className="grow"><div className="h3">Platformani sozlash</div><div className="tiny muted">Brend, kurslar, darslar jadvali, ball tizimi, modullar</div></div>
          <span className="muted">›</span>
        </Link>
      )}

      <div className="hero">
        <span className="hero-meta">Tekshirish kutmoqda</span>
        <b style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{pending[0].n}</b>
        <span className="hero-meta">{pending[0].oldest ? `Eng eskisi: ${ago(pending[0].oldest)}${pending[0].late ? ` · ${pending[0].late} tasi muddatdan o'tgan` : ""}` : "Hamma ish tekshirilgan — yangi ish kelsa, xabar keladi"}</span>
        <Link href="/tekshirish" className="btn light full">{pending[0].n ? "Tekshirishni boshlash" : "Tekshirilganlar"}</Link>
      </div>

      <div className="grid3">
        <Link href="/jurnal" className="card tight"><b className="tile-n">{students.length - debtors.length}</b><span className="tiny muted">o&apos;z vaqtida</span></Link>
        <Link href="/jurnal" className="card tight"><b className="tile-n" style={{ color: debtors.length ? "#B45309" : undefined }}>{debtors.length}</b><span className="tiny muted">qarzdor</span></Link>
        <Link href={`/davomat${last ? `?l=${last.id}` : ""}`} className="card tight"><b className="tile-n">{students.length ? Math.round((came / students.length) * 100) : 0}%</b><span className="tiny muted">davomat</span></Link>
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

      <div className="card">
        <div className="row between">
          <h2 className="h2">Kim qayerda to&apos;xtagan</h2>
          <Link href="/jurnal" className="tiny" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>Jurnal →</Link>
        </div>
        <div className="list">
          {behind.slice(0, 6).map((r) => (
            <div key={r.id} className="li">
              <Link href={`/oquvchi/${r.id}`} className="row grow" style={{ gap: 10, minWidth: 0 }}>
                <Avatar name={r.name} size={36} />
                <div className="grow">
                  <div className="h3 trunc">{r.name}</div>
                  <div className="tiny" style={{ color: r.debt ? "var(--red-ink)" : "var(--ink-2)" }}>{r.stop!.n}-dars{r.debt ? ` · ${r.debt} ta qarz` : " · jarayonda"}</div>
                </div>
              </Link>
              <ActBtn action={nudge} fields={{ user_id: r.id }} className="btn sm line">Eslatish</ActBtn>
            </div>
          ))}
          {!behind.length && <div className="empty">{students.length ? "Hamma o'quvchi barcha darslarni yopgan 🎉" : "Hali o'quvchi yo'q"}</div>}
        </div>
        {lastStat && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="row between tiny"><span className="muted">{lastStat.l.n}-darsni yopganlar</span><b>{lastStat.done}/{students.length}</b></div>
            <Progress value={students.length ? (lastStat.done / students.length) * 100 : 0} />
          </div>
        )}
      </div>

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
      <Extras u={u} courseId={course.id} b={b} />
      <ProfileRow u={u} />
    </main>
  );
}

/** Networking va Workshop kirish kartalari (hozirgi holati bilan) */
const ROLE_UZ: Record<string, string> = { student: "O'quvchi", curator: "Kurator", admin: "Administrator" };

/** Pastdagi aniq ko'rinadigan qator: profil, chiqish va boshqa panelga o'tish */
function ProfileRow({ u }: { u: User }) {
  return (
    <Link href="/profil" className="card row" style={{ gap: 12 }}>
      <Avatar name={u.name} size={40} />
      <div className="grow">
        <div className="h3">Profil · Chiqish</div>
        <div className="tiny muted">{ROLE_UZ[u.role] ?? u.role} paneli · boshqa panelga o&apos;tish shu yerda</div>
      </div>
      <span className="muted" style={{ fontSize: 20 }}>›</span>
    </Link>
  );
}

async function Extras({ u, courseId, b }: { u: User; courseId: number; b: Brand | null }) {
  const showNet = on(b, "networking"), showWs = on(b, "workshop");
  if (!showNet && !showWs) return null;
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
      {showNet && <Link href="/networking" className="card tight">
        <span style={{ fontSize: 18 }}>🤝</span>
        <span className="h3">{label(b, "networking")}</span>
        <span className="tiny muted">{u.role === "student" ? (net?.total ? `${net.ok}/${net.total} tanishuv` : "Tez orada") : "Juftliklar va isbotlar"}</span>
      </Link>}
      {showWs && <Link href={ws ? `/workshop/${ws.id}` : "/workshop"} className="card tight">
        <span style={{ fontSize: 18 }}>🏆</span>
        <span className="h3">{label(b, "workshop")}</span>
        <span className="tiny muted" style={ws && ws.phase !== "done" ? { color: "var(--brand)", fontWeight: 600 } : undefined}>{wsTxt}</span>
      </Link>}
    </div>
  );
}


function ago(d: Date) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  return h < 1 ? "hozirgina" : h < 48 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`;
}
