import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse, DEFAULT_POINTS } from "@/lib/course";
import { Head, Avatar } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { changePassword, logout } from "@/app/actions/auth";
import { createCourse, saveCourse, savePlatform, switchCourse } from "@/app/actions/admin";
import { InstallHint } from "@/components/InstallHint";
import { ThemePicker } from "@/components/Theme";

const ROLE: Record<string, string> = { student: "O'quvchi", curator: "Kurator", admin: "Administrator", super: "Super admin" };
const PF: [keyof typeof DEFAULT_POINTS, string][] = [
  ["att_ontime", "Vaqtida kelsa"],
  ["att_late1", "Kechiksa (1-bosqich)"],
  ["att_late2", "Kechiksa (2-bosqich)"],
  ["att_absent", "Kelmasa"],
  ["late_ok_min", "Vaqtida hisoblanadi (daq)"],
  ["late1_max", "1-bosqich chegarasi (daq)"],
  ["late2_max", "2-bosqich chegarasi (daq)"],
  ["window_after_min", "Kod ochiq turadi, boshlanishdan keyin (daq)"],
];

export default async function Profil() {
  const u = await requireUser();
  const course = await currentCourse(u);
  const courses = u.role !== "student" ? await sql<{ id: number; title: string }[]>`select id, title from courses where platform_id = ${u.platform_id} order by id` : [];
  const [grp] = u.group_id ? await sql<{ name: string }[]>`select name from groups where id = ${u.group_id}` : [];
  // Shu raqamdagi boshqa panellar (masalan, bitta odam ham admin, ham o'quvchi)
  const other = await sql<{ role: string; platform: string | null }[]>`
    select u.role, p.name as platform from users u left join platforms p on p.id = u.platform_id
    where u.phone = ${u.phone} and u.active and u.id <> ${u.id} order by u.platform_id nulls first, u.role`;

  return (
    <main className="page">
      <Head title="Profil" back="/" />
      <div className="card row">
        <Avatar name={u.name} size={56} />
        <div className="grow">
          <div className="h2">{u.name}</div>
          <div className="sub small">{ROLE[u.role]} · {u.platform_name}{grp ? ` · ${grp.name}` : ""}</div>
          <div className="tiny muted">+{u.phone}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="h2">Boshqa panelga o&apos;tish</h2>
        {other.length > 0 ? (
          <>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {other.map((o, i) => <span key={i} className="pill">{ROLE[o.role] ?? o.role}{o.platform ? ` · ${o.platform}` : ""}</span>)}
            </div>
            <p className="tiny sub" style={{ margin: 0 }}>Bu raqamda yana {other.length} ta panel bor. Chiqasiz-u, kirish sahifasida raqamingiz tayyor turadi — o&apos;sha panel parolini yozasiz.</p>
          </>
        ) : (
          <p className="tiny sub" style={{ margin: 0 }}>Boshqa akkauntga kirish uchun chiqing va boshqa raqam yoki parol bilan kiring.</p>
        )}
        <form action={logout}>
          <input type="hidden" name="phone" value={u.phone} />
          <button className="btn full">Chiqish va boshqa panelga kirish</button>
        </form>
      </div>

      <div className="card">
        <h2 className="h2">Ko&apos;rinish</h2>
        <ThemePicker />
      </div>

      <InstallHint />

      {courses.length > 1 && (
        <div className="card">
          <h2 className="h2">Kurs</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {courses.map((c) => (
              <form key={c.id} action={switchCourse}>
                <input type="hidden" name="id" value={c.id} />
                <button className={`pill ${c.id === course?.id ? "ok" : ""}`} style={{ border: 0, padding: "8px 12px" }}>{c.title}</button>
              </form>
            ))}
          </div>
        </div>
      )}

      {u.role === "admin" && course && (
        <details className="card">
          <summary className="row between"><span className="h2">Kurs sozlamalari va ball tizimi</span><span className="pill">ochish</span></summary>
          <ActionForm action={saveCourse}>
            <label className="field"><span>Kurs nomi</span><input className="input" name="title" defaultValue={course.title} /></label>
            <label className="field"><span>Tavsif</span><textarea className="input" name="description" defaultValue={course.description} rows={2} /></label>
            <div className="h3">Davomat ballari</div>
            <div className="grid2">
              {PF.map(([k, l]) => (
                <label key={k} className="field"><span>{l}</span><input className="input" name={k} type="number" defaultValue={course.points[k] as number} /></label>
              ))}
            </div>
            <label className="field">
              <span>Maqsadlar — har qatorda: ball — mukofot</span>
              <textarea className="input" name="goals" rows={3} defaultValue={course.points.goals.map((g) => `${g.pts} — ${g.label}`).join("\n")} placeholder={"1800 — 3 oy qo'shimcha dostup\n2700 — Bosh sovrinlar"} />
            </label>
            <Submit>Saqlash</Submit>
          </ActionForm>
        </details>
      )}

      {u.role === "admin" && (
        <details className="card">
          <summary className="row between"><span className="h2">Platforma</span><span className="pill">ochish</span></summary>
          <ActionForm action={savePlatform}>
            <label className="field"><span>Nomi</span><input className="input" name="name" defaultValue={u.platform_name ?? ""} /></label>
            <label className="field"><span>Brend rangi</span><input className="input" name="color" type="color" defaultValue={u.color} style={{ height: 50, padding: 4 }} /></label>
            <Submit>Saqlash</Submit>
          </ActionForm>
          <div className="h3" style={{ marginTop: 8 }}>Yangi kurs</div>
          <ActionForm action={createCourse} reset>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" name="title" placeholder="Kurs nomi" />
              <Submit className="btn sm">Yaratish</Submit>
            </div>
          </ActionForm>
        </details>
      )}

      <details className="card">
        <summary className="row between"><span className="h2">Parolni o&apos;zgartirish</span><span className="pill">ochish</span></summary>
        <ActionForm action={changePassword} reset>
          <input className="input" name="old" type="password" placeholder="Eski parol" autoComplete="current-password" required />
          <input className="input" name="password" type="password" placeholder="Yangi parol" autoComplete="new-password" minLength={6} required />
          <Submit>O&apos;zgartirish</Submit>
        </ActionForm>
      </details>

      <form action={logout}><button className="btn danger full">Chiqish</button></form>
    </main>
  );
}
