import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getLessons, getTasks, scopeStudents } from "@/lib/course";
import { journal } from "@/lib/progress";
import { Head, Progress } from "@/components/ui";
import { RoadLegend } from "@/components/Roadmap";

/** Kurator/admin jurnali: kim qaysi darsgacha yetib kelgan, qayerda to'xtab qolgan */
export default async function Jurnal({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  if (u.role === "student") redirect("/");
  const c = await currentCourse(u);
  if (!c) return <main className="page"><Head title="Jurnal" back="/" /><div className="card empty">Kurs yo&apos;q</div></main>;
  const gid = Number(sp.g || 0);
  const [lessons, tasks, all, groups] = await Promise.all([
    getLessons(c.id), getTasks(c.id), scopeStudents(u, c.id),
    sql<{ id: number; name: string }[]>`select id, name from groups where course_id = ${c.id}
      and (${u.role === "admin"} or curator_id = ${u.id}) order by name`,
  ]);
  const students = all.filter((s) => !gid || s.group_id === gid);
  const J = await journal(c, lessons, tasks, students);
  const rows = [...J.rows].sort((a, b) => (a.stop?.n ?? 999) - (b.stop?.n ?? 999) || b.debt - a.debt);

  return (
    <main className="page">
      <Head title="Jurnal" back="/" sub="Har o'quvchi qaysi darsgacha yopib kelgani va qayerda to'xtab qolgani" />

      {groups.length > 1 && (
        <div className="row" style={{ gap: 6, overflowX: "auto" }}>
          <Link href="/jurnal" className={`pill ${!gid ? "ok" : ""}`}>Hammasi</Link>
          {groups.map((g) => <Link key={g.id} href={`/jurnal?g=${g.id}`} className={`pill ${gid === g.id ? "ok" : ""}`}>{g.name}</Link>)}
        </div>
      )}

      <div className="card">
        <h2 className="h2">Darslar bo&apos;yicha</h2>
        {J.perLesson.slice().reverse().map(({ l, done, debt }) => (
          <Link key={l.id} href={`/darslar/${l.id}`} className="stack" style={{ gap: 4 }}>
            <div className="row between small">
              <span className="trunc" style={{ fontWeight: 600 }}>{l.n}-dars. {l.title}</span>
              <span className="tiny muted" style={{ flex: "none" }}>{done}/{students.length} yopdi{debt ? ` · ` : ""}{debt ? <b style={{ color: "var(--red)" }}>{debt} qarz</b> : null}</span>
            </div>
            <Progress value={students.length ? (done / students.length) * 100 : 0} />
          </Link>
        ))}
        {!J.perLesson.length && <div className="empty">Hali dars bo&apos;lmagan</div>}
      </div>

      <div className="card">
        <div className="row between"><h2 className="h2">O&apos;quvchilar × darslar</h2><span className="tiny muted">{students.length} kishi</span></div>
        <RoadLegend />
        <div className="jr">
          <table>
            <thead>
              <tr><th />{J.started.map((l) => <th key={l.id}>{l.n}</th>)}<th style={{ textAlign: "left", paddingLeft: 8 }}>To&apos;xtagan</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nm"><Link href={`/oquvchi/${r.id}`}>{r.name}</Link></td>
                  {r.cells.map((st, i) => <td key={i} className={`c ${st}`} title={`${J.started[i].n}-dars`} />)}
                  <td className="stop">{r.stop ? <span style={{ color: r.debt ? "var(--red)" : undefined }}>{r.stop.n}-dars{r.debt ? ` · ${r.debt} qarz` : ""}</span> : <span style={{ color: "var(--ok)" }}>✓ hammasi</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">O&apos;quvchi yo&apos;q</div>}
      </div>
    </main>
  );
}
