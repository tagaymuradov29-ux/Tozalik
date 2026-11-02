import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { Head, Avatar } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { changePassword, logout } from "@/app/actions/auth";
import { switchCourse } from "@/app/actions/admin";
import { InstallHint } from "@/components/InstallHint";
import { ThemePicker } from "@/components/Theme";

const ROLE: Record<string, string> = { student: "O'quvchi", curator: "Kurator", admin: "Administrator", super: "Super admin" };

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

      {u.role === "admin" && (
        <Link href="/sozlash" className="card row" style={{ gap: 12 }}>
          <span style={{ fontSize: 26 }}>⚙️</span>
          <div className="grow"><div className="h3">Platformani sozlash</div><div className="tiny muted">Brend, kurs tuzilmasi, ball tizimi, modullar</div></div>
          <span className="muted">›</span>
        </Link>
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
