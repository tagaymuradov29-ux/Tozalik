import Link from "next/link";
import { requireUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, type Course } from "@/lib/course";
import { ranking } from "@/lib/student";
import { Head, RowLink } from "@/components/ui";
import { PointsCard } from "@/components/PointsCard";
import { getBrand, on } from "@/lib/platform";

type SP = { p?: string; r?: string; g?: string };

export default async function Natijalar({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const course = await currentCourse(u);
  if (!course) return <main className="page"><Head title="Natijalar" /><div className="card empty">Kurs topilmadi</div></main>;
  return (
    <main className="page">
      <Head title="Natijalar" />
      {u.role === "student" && <PointsCard u={u} course={course} uid={u.id} p={sp.p} base="/natijalar" />}
      {(u.role !== "student" || on(await getBrand(u.platform_id), "reyting")) && <Rating u={u} course={course} sp={sp} />}
    </main>
  );
}

async function Rating({ u, course, sp }: { u: User; course: Course; sp: SP }) {
  const all = u.role !== "student" ? sp.r !== "guruh" : sp.r === "hamma";
  const groups = await sql<{ id: number; name: string; curator_id: number | null }[]>`select id, name, curator_id from groups where course_id = ${course.id} order by name`;
  const gFilter = u.role === "student" ? (all ? null : u.group_id) : Number(sp.g || 0) || null;
  let list = await ranking(course, gFilter);
  if (u.role === "curator" && !gFilter) list = list.filter((x) => groups.find((g) => g.id === x.group_id)?.curator_id === u.id).map((x, i) => ({ ...x, rank: i + 1 }));
  const staff = u.role !== "student";
  const avg = groups.map((g) => {
    const m = list.filter((x) => x.group_id === g.id);
    return { ...g, n: m.length, avg: m.length ? Math.round(m.reduce((s, x) => s + x.total, 0) / m.length) : 0 };
  }).filter((g) => g.n);

  return (
    <>
      <div className="card">
        <div className="row between">
          <h2 className="h2">Reyting</h2>
          {u.role === "student" && (
            <div className="row" style={{ gap: 6 }}>
              <Link href="/natijalar?r=guruh" className={`pill ${!all ? "ok" : ""}`}>Guruh</Link>
              <Link href="/natijalar?r=hamma" className={`pill ${all ? "ok" : ""}`}>Kurs</Link>
            </div>
          )}
        </div>
        {staff && groups.length > 1 && (
          <div className="row" style={{ gap: 6, overflowX: "auto" }}>
            <Link href="/natijalar" className={`pill ${!gFilter ? "ok" : ""}`}>Hammasi</Link>
            {groups.map((g) => <Link key={g.id} href={`/natijalar?g=${g.id}`} className={`pill ${gFilter === g.id ? "ok" : ""}`}>{g.name}</Link>)}
          </div>
        )}
        <div className="list">
          {list.slice(0, staff ? 500 : 50).map((x) => {
            const me = x.id === u.id;
            const inner = (
              <>
                <span className={`num ${x.rank <= 3 ? "ok" : ""}`}>{x.rank}</span>
                <div className="grow">
                  <div className="h3 trunc" style={me ? { color: "var(--brand)" } : undefined}>{x.name}{me ? " (siz)" : ""}</div>
                  <div className="tiny muted">{x.group_name} · vazifa {x.tasks} · davomat {x.attend}{x.net ? ` · net ${x.net}` : ""}{x.ws ? ` · ws ${x.ws}` : ""}{x.bonus ? ` · bonus ${x.bonus}` : ""}</div>
                </div>
                <b>{x.total}</b>
              </>
            );
            return staff ? <RowLink key={x.id} href={`/oquvchi/${x.id}`}>{inner}</RowLink> : <div key={x.id} className="li">{inner}</div>;
          })}
          {!list.length && <div className="empty">Hali o&apos;quvchi yo&apos;q</div>}
        </div>
      </div>
      {staff && avg.length > 1 && (
        <div className="card">
          <h2 className="h2">Guruhlar bo&apos;yicha (o&apos;rtacha ball)</h2>
          <div className="list">
            {avg.sort((a, b) => b.avg - a.avg).map((g, i) => (
              <div key={g.id} className="li"><span className="num">{i + 1}</span><div className="grow h3">{g.name}</div><span className="tiny muted">{g.n} kishi</span><b>{g.avg}</b></div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
