import { redirect } from "next/navigation";
import { getSigned } from "@/lib/auth";
import { sql } from "@/lib/db";
import { pickAccount } from "@/app/actions/auth";
import { CourseTile } from "@/components/ui";
import { abbr } from "@/components/LoginScreen";

const ROLE: Record<string, string> = { super: "Super admin", admin: "Administrator", curator: "Kurator", student: "O'quvchi" };

export default async function Tanlash() {
  const p = await getSigned<{ ids: number[] }>("pick");
  if (!p?.ids?.length) redirect("/login");
  const rows = await sql<{ id: number; role: string; name: string; platform: string | null; color: string | null; course: string | null; lang: string | null; grp: string | null }[]>`
    select u.id, u.role, u.name, pl.name as platform, pl.color, c.title as course, c.lang, g.name as grp from users u left join platforms pl on pl.id = u.platform_id
    left join groups g on g.id = u.group_id left join courses c on c.id = g.course_id
    where u.id = any(${p.ids}) and u.active order by u.platform_id nulls first, u.role, c.id desc`;
  const allStudents = rows.every((r) => r.role === "student");
  return (
    <main className="page plain" style={{ minHeight: "100dvh", paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}>
      <div className="stack" style={{ gap: 6, padding: "0 4px 6px" }}>
        <h1 className="h1" style={{ fontSize: 26 }}>{allStudents ? "Qaysi kursga kirmoqchisiz?" : "Qayerga kirasiz?"}</h1>
        <p className="sub" style={{ margin: 0, fontSize: 15 }}>Bu raqamga {rows.length} ta {allStudents ? "kurs" : "panel"} ulangan.</p>
      </div>
      {rows.map((r, i) => {
        const title = r.role === "student" && r.course ? r.course : r.platform ?? "Super admin paneli";
        const code = r.role === "student" && r.lang && r.lang !== "" && r.course ? r.lang.toUpperCase().slice(0, 2) : abbr(title);
        return (
          <form key={r.id} action={pickAccount}>
            <input type="hidden" name="id" value={r.id} />
            <button className="pickbtn">
              <CourseTile i={i} code={code} title={title} role={ROLE[r.role]}
                sub={r.role === "student" ? [r.grp, r.platform].filter(Boolean).join(" · ") : r.name} />
            </button>
          </form>
        );
      })}
      <p className="sub small" style={{ textAlign: "center", marginTop: 8 }}>Keyin profil orqali boshqa kursga yoki panelga o&apos;tishingiz mumkin.</p>
    </main>
  );
}
