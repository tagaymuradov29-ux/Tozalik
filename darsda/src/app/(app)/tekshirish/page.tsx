import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { fmtDT, STATUS_LABEL } from "@/lib/util";
import { Head, Avatar } from "@/components/ui";
import { Files } from "@/components/Files";
import { ActionForm, Submit } from "@/components/Form";
import { gradeSubmission, reopenSubmission } from "@/app/actions/staff";
import { reviewProof } from "@/app/actions/net";
import type { User } from "@/lib/auth";

type Row = {
  id: number; text: string; link: string; files: { id: string; name: string; type: string; size: number }[];
  status: string; points: number | null; late: boolean; feedback: string; created_at: Date; graded_at: Date | null;
  task_id: number; title: string; kind: string; max_points: number; late_points: number | null;
  user_id: number; name: string; group_name: string;
};

export default async function Tekshirish({ searchParams }: { searchParams: Promise<{ t?: string; g?: string; v?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  if (u.role === "student") redirect("/");
  const course = await currentCourse(u);
  if (!course) return <main className="page"><Head title="Tekshirish" /><div className="card empty">Kurs yo&apos;q</div></main>;
  if (sp.v === "net") return <NetReview u={u} courseId={course.id} />;
  const done = sp.v === "done";
  const tid = Number(sp.t || 0);
  const gid = Number(sp.g || 0);
  const rows = await sql<Row[]>`
    select s.id, s.text, s.link, s.files, s.status, s.points, s.late, s.feedback, s.created_at, s.graded_at,
      t.id as task_id, t.title, t.kind, t.max_points, t.late_points, su.id as user_id, su.name, g.name as group_name
    from submissions s join tasks t on t.id = s.task_id join users su on su.id = s.user_id join groups g on g.id = su.group_id
    where t.course_id = ${course.id}
      and (${u.role === "admin"} or g.curator_id = ${u.id})
      and (${tid} = 0 or t.id = ${tid}) and (${gid} = 0 or g.id = ${gid})
      and ${done ? sql`s.status in ('approved','rejected')` : sql`s.status = 'pending'`}
    order by ${done ? sql`s.graded_at desc nulls last` : sql`s.created_at`} limit 60`;
  const byTask = !done
    ? await sql<{ id: number; title: string; n: number }[]>`
        select t.id, t.title, count(*)::int as n from submissions s join tasks t on t.id = s.task_id
        join users su on su.id = s.user_id join groups g on g.id = su.group_id
        where t.course_id = ${course.id} and s.status = 'pending' and (${u.role === "admin"} or g.curator_id = ${u.id})
        group by t.id, t.title order by min(s.created_at)`
    : [];

  return (
    <main className="page">
      <Head title="Tekshirish" />
      <Tabs v={done ? "done" : ""} />
      {byTask.length > 1 && (
        <div className="row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          <Link href="/tekshirish" className={`pill ${!tid ? "ok" : ""}`}>Hammasi</Link>
          {byTask.map((t) => (
            <Link key={t.id} href={`/tekshirish?t=${t.id}`} className={`pill ${tid === t.id ? "ok" : ""}`}>{t.title} · {t.n}</Link>
          ))}
        </div>
      )}
      {rows.map((r) => {
        const cap = r.late ? r.late_points ?? r.max_points : r.max_points;
        return (
          <div key={r.id} className="card">
            <div className="row">
              <Link href={`/oquvchi/${r.user_id}`}><Avatar name={r.name} /></Link>
              <div className="grow">
                <Link href={`/oquvchi/${r.user_id}`} className="h3 trunc" style={{ display: "block" }}>{r.name}</Link>
                <div className="tiny muted">{r.group_name} · {fmtDT(r.created_at, u.tz)}</div>
              </div>
              {r.late && <span className="pill warn">kechikib</span>}
            </div>
            <Link href={`/vazifa/${r.task_id}`} className="pill info" style={{ alignSelf: "flex-start" }}>{r.title}</Link>
            {r.text && (r.kind === "workbook" ? (
              <details>
                <summary className="btn sm ghost">📘 Workbook javoblarini ochish</summary>
                <div className="small" style={{ whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.5 }}>{r.text}</div>
              </details>
            ) : <div className="small" style={{ whiteSpace: "pre-wrap" }}>{r.text}</div>)}
            {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="small trunc" style={{ color: "var(--blue)" }}>🔗 {r.link}</a>}
            <Files files={r.files} />
            {done ? (
              <div className="row between">
                <span className={`pill ${r.status === "approved" ? "ok" : "bad"}`}>{STATUS_LABEL[r.status]}{r.status === "approved" ? ` · ${r.points}` : ""}</span>
                <form action={reopenSubmission}><input type="hidden" name="id" value={r.id} /><button className="btn sm ghost">Qayta ochish</button></form>
              </div>
            ) : (
              <ActionForm action={gradeSubmission}>
                <input type="hidden" name="id" value={r.id} />
                <div className="row">
                  <label className="field grow">
                    <span>Ball (0–{cap})</span>
                    <input className="input" name="points" type="number" min={0} max={cap} defaultValue={cap} inputMode="numeric" />
                  </label>
                </div>
                <textarea className="input" name="feedback" rows={2} placeholder="Izoh (qaytarishda — majburiy)" style={{ minHeight: 60 }} />
                <div className="grid2">
                  <Submit name="decision" value="reject" className="btn danger">Qaytarish</Submit>
                  <Submit name="decision" value="approve" className="btn">Qabul qilish</Submit>
                </div>
              </ActionForm>
            )}
            {done && r.feedback && <div className="tiny sub">💬 {r.feedback}</div>}
          </div>
        );
      })}
      {!rows.length && <div className="card empty">{done ? "Hali tekshirilgan ish yo'q" : "Hammasi tekshirilgan 🎉"}</div>}
    </main>
  );
}

function Tabs({ v }: { v: string }) {
  return (
    <div className="seg">
      <Link href="/tekshirish" className={!v ? "on" : ""}>Kutmoqda</Link>
      <Link href="/tekshirish?v=net" className={v === "net" ? "on" : ""}>Networking</Link>
      <Link href="/tekshirish?v=done" className={v === "done" ? "on" : ""}>Tekshirilgan</Link>
    </div>
  );
}

/** 🤝 Networking isbotlari: 2 ta rasm → tasdiqlash (+ball) yoki sabab bilan qaytarish */
async function NetReview({ u, courseId }: { u: User; courseId: number }) {
  const rows = await sql<{ id: number; files: Row["files"]; text: string; created_at: Date; user_id: number; name: string; group_name: string; partner: string; week: number; points: number }[]>`
    select pr.id, pr.files, pr.text, pr.created_at, su.id as user_id, su.name, g.name as group_name, pu.name as partner, pa.week, r.points
    from net_proofs pr join net_pairs pa on pa.id = pr.pair_id join net_rounds r on r.id = pa.round_id
    join users su on su.id = pr.user_id join groups g on g.id = su.group_id
    join users pu on pu.id = case when pa.a_id = pr.user_id then pa.b_id else pa.a_id end
    where r.course_id = ${courseId} and pr.status = 'pending' and (${u.role === "admin"} or g.curator_id = ${u.id})
    order by pr.created_at limit 60`;
  return (
    <main className="page">
      <Head title="Tekshirish" />
      <Tabs v="net" />
      {rows.map((r) => (
        <div key={r.id} className="card">
          <div className="row">
            <Avatar name={r.name} />
            <div className="grow">
              <div className="h3 trunc">{r.name} 🤝 {r.partner}</div>
              <div className="tiny muted">{r.group_name} · {r.week}-hafta · {fmtDT(r.created_at, u.tz)}</div>
            </div>
          </div>
          <Files files={r.files} />
          {r.text && <div className="small">{r.text}</div>}
          <ActionForm action={reviewProof}>
            <input type="hidden" name="id" value={r.id} />
            <textarea className="input" name="feedback" rows={2} placeholder="Izoh (qaytarishda — majburiy: masalan, «ikkovingiz ko'rinmayapti»)" style={{ minHeight: 60 }} />
            <div className="grid2">
              <Submit name="decision" value="reject" className="btn danger">Qaytarish</Submit>
              <Submit name="decision" value="approve" className="btn">+{r.points} Tasdiqlash</Submit>
            </div>
          </ActionForm>
        </div>
      ))}
      {!rows.length && <div className="card empty">Networking isbotlari tekshirilgan 🎉</div>}
    </main>
  );
}

