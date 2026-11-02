import Link from "next/link";
import { getBrand, label, on } from "@/lib/platform";
import { redirect } from "next/navigation";
import { requireUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, scopeStudents, type Course } from "@/lib/course";
import { fmtDate, utcToLocalInput } from "@/lib/util";
import { Head, Avatar, Progress } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { NetProof } from "@/components/NetProof";
import { createRound, deleteRound } from "@/app/actions/net";
import { skyData } from "@/lib/space";
import { Sky } from "@/components/Sky";

type Round = { id: number; title: string; starts_at: Date; weeks: number; per_week: number; points: number };
const WEEK = 7 * 86400000;
const curWeek = (r: Round) => Math.floor((Date.now() - new Date(r.starts_at).getTime()) / WEEK) + 1;

export default async function Networking() {
  const u = await requireUser();
  const b = await getBrand(u.platform_id);
  if (!on(b, "networking")) redirect("/");
  const T = label(b, "networking");
  const c = await currentCourse(u);
  if (!c) return <main className="page"><Head title={T} back="/" /><div className="card empty">Kurs yo&apos;q</div></main>;
  const [rounds, K] = await Promise.all([sql<Round[]>`select * from net_rounds where course_id = ${c.id} order by starts_at desc`, on(b, "osmon") ? skyData(u, c) : null]);
  const sky = K && K.nodes.length > 1 ? <Sky K={K} title={label(b, "osmon")} /> : null;
  return u.role === "student" ? <Student u={u} rounds={rounds} sky={sky} T={T} /> : <Staff u={u} c={c} rounds={rounds} sky={sky} T={T} />;
}

async function Student({ u, rounds, sky, T }: { u: User; rounds: Round[]; sky: React.ReactNode; T: string }) {
  const pairs = await sql<{ id: number; round_id: number; week: number; pid: number; name: string; phone: string; group_name: string | null; st: string | null; fb: string | null; pts: number | null }[]>`
    select pa.id, pa.round_id, pa.week, pu.id as pid, pu.name, pu.phone, g.name as group_name,
      (select status from net_proofs x where x.pair_id = pa.id and x.user_id = ${u.id} order by x.id desc limit 1) as st,
      (select feedback from net_proofs x where x.pair_id = pa.id and x.user_id = ${u.id} order by x.id desc limit 1) as fb,
      (select points from net_proofs x where x.pair_id = pa.id and x.user_id = ${u.id} and x.status = 'approved' limit 1) as pts
    from net_pairs pa join users pu on pu.id = case when pa.a_id = ${u.id} then pa.b_id else pa.a_id end
    left join groups g on g.id = pu.group_id
    where (pa.a_id = ${u.id} or pa.b_id = ${u.id}) and pa.round_id = any(${rounds.map((r) => r.id)})
    order by pa.week, pu.name`;
  const r = rounds.find((x) => curWeek(x) >= 1 && curWeek(x) <= x.weeks) ?? rounds.find((x) => curWeek(x) > x.weeks) ?? rounds[0];
  if (!r) return <main className="page"><Head title={T} back="/" /><div className="card empty">Networking hali boshlanmagan. Boshlanganda har hafta yangi tanishlar shu yerda chiqadi.</div></main>;
  const wk = Math.min(curWeek(r), r.weeks);
  const mine = pairs.filter((p) => p.round_id === r.id);
  const now = mine.filter((p) => p.week === wk);
  const left = mine.filter((p) => p.week < wk && p.st !== "approved" && p.st !== "pending");
  const open = mine.filter((p) => p.week <= wk);
  const met = open.filter((p) => p.st === "approved").length;

  const Card = ({ p }: { p: (typeof pairs)[number] }) => (
    <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div className="row">
        <Avatar name={p.name} />
        <div className="grow">
          <div className="h3">{p.name}</div>
          <div className="tiny muted">{p.group_name ?? ""} · <a href={`tel:+${p.phone}`} style={{ color: "var(--blue)" }}>+{p.phone}</a></div>
        </div>
        {p.st === "approved" ? <span className="pill ok">+{p.pts}</span> : p.st === "pending" ? <span className="pill warn">Tekshiruvda</span> : p.st === "rejected" ? <span className="pill bad">Qaytarildi</span> : <span className="pill">Tanishilmagan</span>}
      </div>
      {p.st === "rejected" && p.fb && <div className="err small">💬 {p.fb}</div>}
      {(!p.st || p.st === "rejected") && (
        <details>
          <summary className="btn sm soft" style={{ width: "100%" }}>Tanishdim — isbot yuborish</summary>
          <div style={{ marginTop: 10 }}><NetProof pairId={p.id} partner={p.name} /></div>
        </details>
      )}
    </div>
  );

  return (
    <main className="page">
      <Head title={T} back="/" sub={`${r.title} · ${wk}/${r.weeks}-hafta`} />
      <div className="card">
        <div className="row between">
          <div><div className="sub small">Tanishuvlar</div><div className="big">{met}<span className="muted" style={{ fontSize: 18 }}> / {open.length}</span></div></div>
          <span className="pill ok">har biri +{r.points} ball</span>
        </div>
        <Progress value={open.length ? (met / open.length) * 100 : 0} />
        <div className="tiny sub">Har bir hamkor bilan 15–20 daqiqa Zoom yoki uchrashuv. Isbot: 2 ta rasm — ikkovingiz ko&apos;ringan Zoom/selfi va hamkorni kontaktga saqlaganingiz.</div>
      </div>
      {sky}
      <div className="card">
        <h2 className="h2">Bu haftaning hamkorlari</h2>
        {now.map((p) => <Card key={p.id} p={p} />)}
        {!now.length && <div className="empty">Bu hafta sizga juftlik tushmadi</div>}
      </div>
      {left.length > 0 && (
        <div className="card">
          <h2 className="h2">Tanishmaganlarim ({left.length})</h2>
          <p className="sub small" style={{ margin: 0 }}>O&apos;tgan haftalardagi hamkorlar — hali ham tanishib, isbot yuborsangiz ball beriladi.</p>
          {left.map((p) => <Card key={p.id} p={p} />)}
        </div>
      )}
    </main>
  );
}

async function Staff({ u, c, rounds, sky, T }: { u: User; c: Course; rounds: Round[]; sky: React.ReactNode; T: string }) {
  const students = await scopeStudents(u, c.id);
  const ids = students.map((s) => s.id);
  const stats = await sql<{ round_id: number; pairs: number; ok: number; wait: number }[]>`
    select pa.round_id, count(distinct pa.id)::int * 2 as pairs,
      count(pr.id) filter (where pr.status = 'approved')::int as ok, count(pr.id) filter (where pr.status = 'pending')::int as wait
    from net_pairs pa left join net_proofs pr on pr.pair_id = pa.id and pr.user_id = any(${ids})
    where pa.round_id = any(${rounds.map((r) => r.id)}) and (pa.a_id = any(${ids}) or pa.b_id = any(${ids}))
    group by pa.round_id`;
  const per = await sql<{ user_id: number; ok: number }[]>`
    select user_id, count(*)::int as ok from net_proofs where status = 'approved' and user_id = any(${ids}) group by user_id`;
  return (
    <main className="page">
      <Head title={T} back="/" sub="Har hafta o'quvchilar yangi hamkorlar bilan tanishadi: 2 ta rasm isbot → kurator tasdiqlaydi → ball." />
      {sky}
      {rounds.map((r) => {
        const s = stats.find((x) => x.round_id === r.id);
        const wk = curWeek(r);
        return (
          <div key={r.id} className="card">
            <div className="row between">
              <div>
                <div className="h3">{r.title}</div>
                <div className="tiny muted">{fmtDate(r.starts_at, u.tz)} dan · {r.weeks} hafta × {r.per_week} ta · +{r.points} ball</div>
              </div>
              <span className={`pill ${wk >= 1 && wk <= r.weeks ? "ok" : ""}`}>{wk < 1 ? "Boshlanmagan" : wk > r.weeks ? "Tugagan" : `${wk}-hafta`}</span>
            </div>
            <div className="grid2">
              <div className="stat"><span className="tiny muted">Tasdiqlangan</span><b>{s?.ok ?? 0} / {s?.pairs ?? 0}</b></div>
              <Link href="/tekshirish?v=net" className="stat"><span className="tiny muted">Tekshiruvda</span><b style={{ color: s?.wait ? "var(--amber)" : undefined }}>{s?.wait ?? 0}</b></Link>
            </div>
            {u.role === "admin" && (
              <form action={deleteRound}><input type="hidden" name="id" value={r.id} />
                <Submit className="btn sm danger" confirm="Tur, juftliklar va isbotlar o'chiriladi. Davom etasizmi?">O&apos;chirish</Submit>
              </form>
            )}
          </div>
        );
      })}
      {!rounds.length && <div className="card empty">Hali networking boshlanmagan</div>}

      {students.length > 0 && rounds.length > 0 && (
        <div className="card">
          <h2 className="h2">O&apos;quvchilar bo&apos;yicha</h2>
          <div className="list">
            {students.map((s) => ({ ...s, ok: per.find((x) => x.user_id === s.id)?.ok ?? 0 })).sort((a, b) => b.ok - a.ok).map((s) => (
              <Link key={s.id} href={`/oquvchi/${s.id}`} className="li">
                <Avatar name={s.name} size={32} />
                <div className="grow"><div className="small trunc" style={{ fontWeight: 600 }}>{s.name}</div><div className="tiny muted">{s.group_name}</div></div>
                <span className={`pill ${s.ok ? "ok" : ""}`}>{s.ok} ta</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {u.role === "admin" && (
        <div className="card">
          <h2 className="h2">Yangi networking</h2>
          <ActionForm action={createRound}>
            <label className="field"><span>Nomi</span><input className="input" name="title" defaultValue="Networking 2.0" /></label>
            <label className="field"><span>Boshlanishi (1-hafta)</span><input className="input" name="starts_at" type="datetime-local" defaultValue={utcToLocalInput(new Date(), u.tz)} /></label>
            <div className="grid2">
              <label className="field"><span>Necha hafta</span><input className="input" name="weeks" type="number" min={1} max={20} defaultValue={7} /></label>
              <label className="field"><span>Haftasiga tanishuv</span><input className="input" name="per_week" type="number" min={1} max={10} defaultValue={3} /></label>
            </div>
            <label className="field"><span>Har tanishuv uchun ball</span><input className="input" name="points" type="number" defaultValue={5} /></label>
            <p className="tiny muted" style={{ margin: 0 }}>Hozirgi {students.length} ta o&apos;quvchi aralashtirilib juftlanadi: har kim har kim bilan faqat bir marta uchrashadi.</p>
            <Submit>Juftliklarni tuzish</Submit>
          </ActionForm>
        </div>
      )}
    </main>
  );
}
