import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, getTasks, pointsAll, scopeStudents } from "@/lib/course";
import { Head, RowLink, Avatar } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { CopyLink } from "@/components/Copy";
import { addUser, createInvite, revokeInvite, saveGroup, toggleActive } from "@/app/actions/staff";

const ROLE: Record<string, string> = { student: "O'quvchi", curator: "Kurator", admin: "Admin" };

export default async function Guruh({ searchParams }: { searchParams: Promise<{ g?: string; f?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  if (u.role === "student") redirect("/");
  const course = await currentCourse(u);
  if (!course) return <main className="page"><Head title="Guruh" /><div className="card empty">Kurs yo&apos;q</div></main>;
  const isAdmin = u.role === "admin";
  const groups = await sql<{ id: number; name: string; curator_id: number | null; curator: string | null }[]>`
    select g.id, g.name, g.curator_id, cu.name as curator from groups g left join users cu on cu.id = g.curator_id
    where g.course_id = ${course.id} and (${isAdmin} or g.curator_id = ${u.id}) order by g.name`;
  const gid = Number(sp.g || 0);
  const [all, tasks, pts] = await Promise.all([scopeStudents(u, course.id), getTasks(course.id), pointsAll(course)]);
  const ids = all.map((s) => s.id);
  const subs = await sql<{ user_id: number; task_id: number; status: string }[]>`
    select user_id, task_id, status from submissions where user_id = any(${ids}) and status in ('pending','approved')`;
  const due = tasks.filter((t) => t.kind !== "repeat" && t.due_at && new Date(t.due_at) < new Date());
  let students = all
    .filter((s) => !gid || s.group_id === gid)
    .map((s) => ({ ...s, pts: pts.get(s.id)?.total ?? 0, debt: due.filter((t) => !subs.some((x) => x.user_id === s.id && x.task_id === t.id)).length }));
  if (sp.f === "qarz") students = students.filter((s) => s.debt > 0).sort((a, b) => b.debt - a.debt);
  const invites = await sql<{ code: string; role: string; group_name: string | null; uses: number }[]>`
    select i.code, i.role, g.name as group_name, i.uses from invites i left join groups g on g.id = i.group_id
    where i.platform_id = ${u.platform_id} and i.active and (${isAdmin} or i.created_by = ${u.id} or g.curator_id = ${u.id})
      and (i.group_id is null or g.course_id = ${course.id})
    order by i.created_at desc`;
  const staff = isAdmin
    ? await sql<{ id: number; name: string; phone: string; role: string; active: boolean }[]>`
        select id, name, phone, role, active from users where platform_id = ${u.platform_id} and role in ('admin','curator') order by role, name`
    : [];
  const curators = staff.filter((s) => s.active);

  return (
    <main className="page">
      <Head title={isAdmin ? "Odamlar" : "Guruhim"} sub={`${course.title} · ${all.length} o'quvchi`} />

      <div className="row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Link href="/guruh" className={`pill ${!gid && sp.f !== "qarz" ? "ok" : ""}`}>Hammasi</Link>
        <Link href={`/guruh?f=qarz${gid ? `&g=${gid}` : ""}`} className={`pill ${sp.f === "qarz" ? "bad" : ""}`}>Qarzdorlar</Link>
        {groups.map((g) => <Link key={g.id} href={`/guruh?g=${g.id}`} className={`pill ${gid === g.id ? "ok" : ""}`}>{g.name}</Link>)}
      </div>

      <div className="card">
        <div className="list">
          {students.map((s) => (
            <RowLink key={s.id} href={`/oquvchi/${s.id}`}>
              <Avatar name={s.name} size={38} />
              <div className="grow">
                <div className="h3 trunc">{s.name}</div>
                <div className="tiny muted">{s.group_name} · +{s.phone}</div>
              </div>
              <div className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                <b>{s.pts}</b>
                {s.debt > 0 && <span className="pill bad" style={{ padding: "1px 7px" }}>{s.debt} qarz</span>}
              </div>
            </RowLink>
          ))}
          {!students.length && <div className="empty">Bu yerda hali o&apos;quvchi yo&apos;q</div>}
        </div>
      </div>

      <div className="card">
        <h2 className="h2">Taklif havolalari</h2>
        <p className="sub small" style={{ margin: 0 }}>Havolani o&apos;quvchilarga yuboring — ular o&apos;zi ro&apos;yxatdan o&apos;tib, kerakli guruhga tushadi.</p>
        {invites.map((i) => (
          <div key={i.code} className="stack" style={{ gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <div className="row between">
              <div>
                <div className="h3">{ROLE[i.role]}{i.group_name ? ` · ${i.group_name}` : ""}</div>
                <div className="tiny muted">/join/{i.code} · {i.uses} kishi qo&apos;shildi</div>
              </div>
              <form action={revokeInvite}><input type="hidden" name="code" value={i.code} /><button className="btn sm ghost">O&apos;chirish</button></form>
            </div>
            <CopyLink path={`/join/${i.code}`} label={`${course.title} — ro'yxatdan o'tish`} />
          </div>
        ))}
        <ActionForm action={createInvite}>
          <div className="grid2">
            <select className="input" name="role" defaultValue="student">
              <option value="student">O&apos;quvchi</option>
              {isAdmin && <option value="curator">Kurator</option>}
              {isAdmin && <option value="admin">Admin</option>}
            </select>
            <select className="input" name="group_id" defaultValue={gid || groups[0]?.id}>
              <option value="">— Guruhsiz —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <Submit className="btn soft full">Havola yaratish</Submit>
        </ActionForm>
      </div>

      <details className="card">
        <summary className="row between"><span className="h2">Qo&apos;lda qo&apos;shish</span><span className="pill">ochish</span></summary>
        <ActionForm action={addUser} reset>
          <label className="field"><span>Ism familiya</span><input className="input" name="name" required /></label>
          <label className="field"><span>Telefon</span><input className="input" name="phone" type="tel" inputMode="tel" required /></label>
          <label className="field"><span>Vaqtinchalik parol</span><input className="input" name="password" type="text" minLength={6} required /></label>
          <div className="grid2">
            <select className="input" name="role" defaultValue="student" disabled={!isAdmin}>
              <option value="student">O&apos;quvchi</option>
              {isAdmin && <option value="curator">Kurator</option>}
              {isAdmin && <option value="admin">Admin</option>}
            </select>
            <select className="input" name="group_id" defaultValue={gid || groups[0]?.id}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <Submit>Qo&apos;shish</Submit>
        </ActionForm>
      </details>

      {isAdmin && (
        <>
          <div className="card">
            <h2 className="h2">Guruhlar</h2>
            {groups.map((g) => (
              <ActionForm key={g.id} action={saveGroup} className="stack">
                <input type="hidden" name="id" value={g.id} />
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" name="name" defaultValue={g.name} style={{ flex: 1 }} />
                  <select className="input" name="curator_id" defaultValue={g.curator_id ?? ""} style={{ flex: 1 }}>
                    <option value="">Kurator yo&apos;q</option>
                    {curators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Submit className="btn sm ghost">Saqlash</Submit>
              </ActionForm>
            ))}
            <ActionForm action={saveGroup} reset>
              <div className="row" style={{ gap: 8 }}>
                <input className="input" name="name" placeholder="Yangi guruh nomi" style={{ flex: 1 }} />
                <Submit className="btn sm">+ Guruh</Submit>
              </div>
            </ActionForm>
          </div>

          <div className="card">
            <h2 className="h2">Xodimlar</h2>
            <div className="list">
              {staff.map((s) => (
                <div key={s.id} className="li">
                  <Avatar name={s.name} size={36} />
                  <div className="grow">
                    <div className="h3 trunc" style={{ opacity: s.active ? 1 : 0.5 }}>{s.name}</div>
                    <div className="tiny muted">{ROLE[s.role]} · +{s.phone}{s.active ? "" : " · bloklangan"}</div>
                  </div>
                  {s.id !== u.id && (
                    <form action={toggleActive}>
                      <input type="hidden" name="user_id" value={s.id} />
                      <button className="btn sm ghost">{s.active ? "Bloklash" : "Faollashtirish"}</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
