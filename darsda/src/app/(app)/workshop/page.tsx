import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getLessons } from "@/lib/course";
import { fmtDate } from "@/lib/util";
import { Head, RowLink } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { createWorkshop } from "@/app/actions/ws";

const PHASE: Record<string, [string, string]> = { join: ["info", "Jamoaga yozilish"], vote: ["warn", "Baholash"], done: ["ok", "Yakunlangan"] };

export default async function Workshops() {
  const u = await requireUser();
  const c = await currentCourse(u);
  if (!c) return <main className="page"><Head title="Workshop" back="/" /><div className="card empty">Kurs yo&apos;q</div></main>;
  const [list, lessons] = await Promise.all([
    sql<{ id: number; title: string; phase: string; teams: number; n: number | null; members: number; created_at: Date; my_team: number | null; my_pts: number | null }[]>`
      select w.id, w.title, w.phase, w.teams, l.n, w.created_at,
        (select count(*)::int from ws_members m where m.ws_id = w.id) as members,
        (select team from ws_members m where m.ws_id = w.id and m.user_id = ${u.id}) as my_team,
        (select (w.res ->> m.team::text)::int from ws_members m where m.ws_id = w.id and m.user_id = ${u.id}) as my_pts
      from workshops w left join lessons l on l.id = w.lesson_id where w.course_id = ${c.id} order by w.created_at desc`,
    getLessons(c.id),
  ]);
  return (
    <main className="page">
      <Head title="Workshop" back="/" sub="Jamoalarga bo'linib vazifa bajarasiz, taqdimot qilasiz va bir-biringizni 1–10 ball bilan baholaysiz. O'rin bo'yicha ball beriladi." />
      <div className="card">
        <div className="list">
          {list.map((w) => (
            <RowLink key={w.id} href={`/workshop/${w.id}`}>
              <span className="num now">🏆</span>
              <div className="grow">
                <div className="h3 trunc">{w.title}</div>
                <div className="tiny muted">{w.n ? `${w.n}-dars · ` : ""}{fmtDate(w.created_at, u.tz)} · {w.members} ishtirokchi{w.my_team ? ` · siz: ${w.my_team}-jamoa` : ""}</div>
              </div>
              {w.phase === "done" && w.my_pts ? <span className="pill ok">+{w.my_pts}</span> : <span className={`pill ${PHASE[w.phase][0]}`}>{PHASE[w.phase][1]}</span>}
            </RowLink>
          ))}
          {!list.length && <div className="empty">Hali workshop bo&apos;lmagan</div>}
        </div>
      </div>
      {u.role === "admin" && (
        <div className="card">
          <h2 className="h2">Yangi workshop</h2>
          <ActionForm action={createWorkshop}>
            <label className="field"><span>Mavzu</span><input className="input" name="title" placeholder="Sotish" required /></label>
            <label className="field"><span>Dars</span>
              <select className="input" name="lesson_id" defaultValue="">
                <option value="">— Darsga bog&apos;lanmagan —</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.n}. {l.title}</option>)}
              </select>
            </label>
            <div className="grid2">
              <label className="field"><span>Jamoalar soni</span><input className="input" name="teams" type="number" min={2} max={12} defaultValue={5} /></label>
              <label className="field"><span>O&apos;rinlar bo&apos;yicha ball</span><input className="input" name="points" defaultValue="50,40,30,20,10" /></label>
            </div>
            <Submit>Yaratish</Submit>
          </ActionForm>
        </div>
      )}
    </main>
  );
}
