import { sql } from "@/lib/db";
import { join } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/Form";

const ROLE: Record<string, string> = { student: "o'quvchi", curator: "kurator", admin: "administrator" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [inv] = await sql<{ role: string; platform: string; group_name: string | null; course: string | null }[]>`
    select i.role, p.name as platform, g.name as group_name, c.title as course
    from invites i join platforms p on p.id = i.platform_id
    left join groups g on g.id = i.group_id left join courses c on c.id = g.course_id
    where i.code = ${code} and i.active`;
  return (
    <main className="page plain" style={{ minHeight: "100dvh", justifyContent: "center" }}>
      {!inv ? (
        <div className="card"><p className="err">Bu taklif havolasi eskirgan yoki noto&apos;g&apos;ri.</p></div>
      ) : (
        <>
          <div className="stack" style={{ marginBottom: 6 }}>
            <span className="pill ok" style={{ alignSelf: "flex-start" }}>{inv.platform}</span>
            <h1 className="h1" style={{ margin: 0 }}>Ro&apos;yxatdan o&apos;tish</h1>
            <p className="sub" style={{ margin: 0 }}>
              Siz {inv.course ? <b>{inv.course}</b> : "platformaga"}
              {inv.group_name ? <> · {inv.group_name}</> : null} — {ROLE[inv.role]} sifatida qo&apos;shilasiz.
            </p>
          </div>
          <div className="card">
            <ActionForm action={join}>
              <input type="hidden" name="code" value={code} />
              <label className="field">
                <span>Ism va familiya</span>
                <input className="input" name="name" autoComplete="name" required />
              </label>
              <label className="field">
                <span>Telefon raqam</span>
                <input className="input" name="phone" type="tel" inputMode="tel" placeholder="+998 90 123 45 67" autoComplete="tel" required />
              </label>
              <label className="field">
                <span>Parol o&apos;ylab toping</span>
                <input className="input" name="password" type="password" autoComplete="new-password" minLength={6} required />
              </label>
              <Submit>Ro&apos;yxatdan o&apos;tish</Submit>
            </ActionForm>
          </div>
        </>
      )}
    </main>
  );
}
