import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { Head, Avatar, ActBtn } from "@/components/ui";
import { Submit } from "@/components/Form";
import { deleteWorkshop, joinTeam, setPhase, vote } from "@/app/actions/ws";

type W = { id: number; title: string; teams: number; phase: "join" | "vote" | "done"; points: number[]; res: Record<string, number>; lesson: string | null };

export default async function WorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const c = await currentCourse(u);
  const [w] = await sql<W[]>`
    select w.id, w.title, w.teams, w.phase, w.points, w.res, l.n || '-dars. ' || l.title as lesson
    from workshops w left join lessons l on l.id = w.lesson_id where w.id = ${Number(id) || 0} and w.course_id = ${c?.id ?? 0}`;
  if (!w) notFound();
  const [members, votes, myVotes] = await Promise.all([
    sql<{ user_id: number; team: number; name: string }[]>`
      select m.user_id, m.team, u.name from ws_members m join users u on u.id = m.user_id where m.ws_id = ${w.id} order by u.name`,
    sql<{ team: number; avg: number; n: number }[]>`
      select team, avg(score)::float as avg, count(*)::int as n from ws_votes where ws_id = ${w.id} group by team`,
    sql<{ team: number; score: number }[]>`select team, score from ws_votes where ws_id = ${w.id} and voter_id = ${u.id}`,
  ]);
  const teams = Array.from({ length: w.teams }, (_, i) => i + 1);
  const my = members.find((m) => m.user_id === u.id)?.team ?? null;
  const isStudent = u.role === "student";
  const ranked = teams
    .filter((t) => members.some((m) => m.team === t))
    .map((t) => ({ t, avg: votes.find((v) => v.team === t)?.avg ?? 0, n: votes.find((v) => v.team === t)?.n ?? 0 }))
    .sort((a, b) => b.avg - a.avg || a.t - b.t);
  const PH = { join: "Jamoaga yozilish", vote: "Taqdimot va baholash", done: "Natija" };
  const STEP = { join: "1 · Yozilish", vote: "2 · Baholash", done: "3 · Natija" };

  return (
    <main className="page">
      <Head title={w.title} back="/workshop" sub={`${w.lesson ? w.lesson + " · " : ""}${PH[w.phase]}`} />

      <div className="row" style={{ gap: 6 }}>
        {(["join", "vote", "done"] as const).map((p) => (
          <span key={p} className={`pill ${w.phase === p ? "ok" : ""}`} style={{ flex: 1, justifyContent: "center" }}>{STEP[p]}</span>
        ))}
      </div>

      {w.phase === "join" && (
        <div className="card">
          <h2 className="h2">{isStudent ? (my ? `Siz ${my}-jamoadasiz` : "Jamoani tanlang") : "Jamoalar"}</h2>
          {isStudent && <p className="sub small" style={{ margin: 0 }}>Baholash boshlanguncha jamoani almashtirish mumkin.</p>}
          {teams.map((t) => {
            const ms = members.filter((m) => m.team === t);
            return (
              <form key={t} action={joinTeam} className="stack" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="team" value={t} />
                <div className="row between">
                  <b>{t}-jamoa <span className="muted small">· {ms.length} kishi</span></b>
                  {isStudent && (my === t ? <span className="pill ok">✓ Siz shu yerdasiz</span> : <button className="btn sm soft">Qo&apos;shilish</button>)}
                </div>
                {ms.length > 0 && <div className="tiny sub">{ms.map((m) => m.name).join(", ")}</div>}
              </form>
            );
          })}
        </div>
      )}

      {w.phase === "vote" && (
        <div className="card">
          <h2 className="h2">{isStudent ? "Jamoalarni baholang (1–10)" : "Baholash jarayoni"}</h2>
          {isStudent && <p className="sub small" style={{ margin: 0 }}>Har jamoa taqdimotidan keyin ball bering. O&apos;z jamoangizga ovoz berilmaydi. Bahoni o&apos;zgartirish mumkin.</p>}
          {ranked.map(({ t, n }) => {
            const mine = myVotes.find((v) => v.team === t)?.score;
            return (
              <div key={t} className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div className="row between">
                  <b>{t}-jamoa</b>
                  <span className="tiny muted">{n} ta baho{!isStudent ? "" : mine ? ` · siz: ${mine}` : ""}</span>
                </div>
                <div className="tiny sub">{members.filter((m) => m.team === t).map((m) => m.name).join(", ")}</div>
                {isStudent && my !== t && (
                  <div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((sc) => (
                      <ActBtn key={sc} action={vote} fields={{ id: w.id, team: t, score: sc }} className={`pill ${mine === sc ? "ok" : ""}`} style={{ border: 0, width: 36, justifyContent: "center", padding: "8px 0" }}>{sc}</ActBtn>
                    ))}
                  </div>
                )}
                {isStudent && my === t && <span className="pill">Bu sizning jamoangiz</span>}
              </div>
            );
          })}
          {!ranked.length && <div className="empty">Hech kim jamoaga yozilmagan</div>}
        </div>
      )}

      {(w.phase === "done" || (!isStudent && w.phase === "vote")) && (
        <div className="card">
          <h2 className="h2">{w.phase === "done" ? "🏁 Natija" : "Joriy holat"}</h2>
          {ranked.map((r, i) => (
            <div key={r.t} className="li">
              <span className={`num ${i === 0 ? "ok" : ""}`}>{i + 1}</span>
              <div className="grow">
                <div className="h3">{r.t}-jamoa {my === r.t && <span className="pill ok">siz</span>}</div>
                <div className="tiny muted">o&apos;rtacha {r.avg.toFixed(1)} · {r.n} ta baho</div>
              </div>
              {w.phase === "done" ? <b style={{ color: "var(--brand)" }}>+{w.res[String(r.t)] ?? 0}</b> : <b>{w.points[i] ?? 0}</b>}
            </div>
          ))}
        </div>
      )}

      {!isStudent && w.phase !== "join" && (
        <div className="card">
          <h2 className="h2">Ishtirokchilar ({members.length})</h2>
          <div className="list">
            {members.map((m) => (
              <div key={m.user_id} className="li"><Avatar name={m.name} size={32} /><div className="grow small">{m.name}</div><span className="pill">{m.team}-jamoa</span></div>
            ))}
          </div>
        </div>
      )}

      {u.role === "admin" && (
        <div className="card">
          <h2 className="h2">Boshqaruv</h2>
          {w.phase === "join" && <ActBtn action={setPhase} fields={{ id: w.id, phase: "vote" }} className="btn full">Baholashni boshlash →</ActBtn>}
          {w.phase === "vote" && <ActBtn action={setPhase} fields={{ id: w.id, phase: "done" }} className="btn full" confirm="Baholash yopiladi va ball beriladi. Davom etasizmi?">Yakunlash va ball berish 🏁</ActBtn>}
          {w.phase !== "join" && <ActBtn action={setPhase} fields={{ id: w.id, phase: "join" }} className="btn ghost full">← Jamoaga yozilishga qaytarish</ActBtn>}
          <p className="tiny muted" style={{ margin: 0 }}>O&apos;rinlar bo&apos;yicha ball: {w.points.join(" / ")}</p>
          <form action={deleteWorkshop}>
            <input type="hidden" name="id" value={w.id} />
            <Submit className="btn danger full" confirm="Workshop va uning natijalari o'chiriladi. Davom etasizmi?">O&apos;chirish</Submit>
          </form>
        </div>
      )}
    </main>
  );
}
