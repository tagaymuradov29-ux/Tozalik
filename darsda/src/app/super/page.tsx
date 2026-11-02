import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createPlatform, enterPlatform, testAccounts } from "@/app/actions/super";
import { changePassword, logout } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/Form";
import { ThemeToggle } from "@/components/Theme";

export default async function SuperPage({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const me = await requireUser(["super"]);
  const testPid = Number((await searchParams).test || 0);
  const rows = await sql<{ id: number; name: string; slug: string; color: string; students: number; staff: number; courses: number; admins: string | null }[]>`
    select p.id, p.name, p.slug, p.color,
      (select count(*)::int from users u where u.platform_id = p.id and u.role = 'student') as students,
      (select count(*)::int from users u where u.platform_id = p.id and u.role in ('admin','curator')) as staff,
      (select count(*)::int from courses c where c.platform_id = p.id) as courses,
      (select string_agg(u.name || ' · +' || u.phone, ', ') from users u where u.platform_id = p.id and u.role = 'admin') as admins
    from platforms p order by p.id desc`;
  return (
    <main className="page plain">
      <div className="row between">
        <h1 className="h1">Platformalar</h1>
        <div className="row" style={{ gap: 8 }}>
          <ThemeToggle />
          <form action={logout}><input type="hidden" name="phone" value={me.phone} /><button className="btn sm ghost">Chiqish</button></form>
        </div>
      </div>
      <p className="sub" style={{ marginTop: -8 }}>Har bir mijoz (o&apos;quv markazi, ekspert) — alohida platforma: o&apos;z kurslari, o&apos;quvchilari va adminlari.</p>

      {rows.map((p) => (
        <div className="card tight" key={p.id}>
          <div className="row">
            <span className="avatar" style={{ background: p.color, color: "#fff" }}>{p.name.slice(0, 1)}</span>
            <div className="grow">
              <div className="h3">{p.name}</div>
              <div className="tiny muted">/{p.slug} · {p.courses} kurs · {p.students} o&apos;quvchi · {p.staff} xodim</div>
            </div>
          </div>
          {p.admins && <div className="tiny sub">Admin: {p.admins}</div>}
          <div className="grid2">
            <form action={enterPlatform}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn sm soft full">Kirish →</button>
            </form>
            <form action={testAccounts}>
              <input type="hidden" name="id" value={p.id} />
              <Submit className="btn sm ghost full" confirm={`«${p.name}» da sizning raqamingiz bilan test akkauntlar yaratiladi (parollar: admin / kurator / student), super admin paroli «super» bo'ladi. Davom etasizmi?`}>🧪 Test akkauntlar</Submit>
            </form>
          </div>
          {testPid === p.id && (
            <div className="okmsg small">
              Tayyor! Kirish: telefon <b>+{me.phone}</b><br />
              Parollar: <b>super</b> — super admin · <b>admin</b> — admin · <b>kurator</b> — kurator · <b>student</b> — o&apos;quvchi
            </div>
          )}
        </div>
      ))}
      {!rows.length && <div className="card empty">Hali platforma yo&apos;q. Birinchisini quyida yarating.</div>}

      <div className="card">
        <h2 className="h2">Yangi platforma</h2>
        <ActionForm action={createPlatform} reset>
          <label className="field"><span>Nomi</span><input className="input" name="name" placeholder="Real Marketing" required /></label>
          <label className="field"><span>Qisqa nom (lotin, havolada)</span><input className="input" name="slug" placeholder="realmarketing" required /></label>
          <label className="field"><span>Brend rangi</span><input className="input" name="color" type="color" defaultValue="#0B5D46" style={{ height: 50, padding: 4 }} /></label>
          <div className="h3" style={{ marginTop: 6 }}>Platforma admini</div>
          <label className="field"><span>Ism familiya</span><input className="input" name="admin_name" required /></label>
          <label className="field"><span>Telefon</span><input className="input" name="admin_phone" type="tel" inputMode="tel" required /></label>
          <label className="field"><span>Parol</span><input className="input" name="admin_password" type="text" minLength={6} required /></label>
          <label className="row small"><input type="checkbox" name="demo" defaultChecked /> Namuna kurs bilan (RM 6.0 tuzilmasi: darslar, workbook, amaliy, stories, reels)</label>
          <Submit>Yaratish</Submit>
        </ActionForm>
      </div>
      <details className="card">
        <summary className="row between"><span className="h2">Parolni o&apos;zgartirish</span><span className="pill">ochish</span></summary>
        <ActionForm action={changePassword} reset>
          <input className="input" name="old" type="password" placeholder="Eski parol" autoComplete="current-password" required />
          <input className="input" name="password" type="password" placeholder="Yangi parol" autoComplete="new-password" minLength={6} required />
          <Submit>O&apos;zgartirish</Submit>
        </ActionForm>
      </details>
    </main>
  );
}
