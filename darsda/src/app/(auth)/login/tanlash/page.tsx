import { redirect } from "next/navigation";
import { getSigned } from "@/lib/auth";
import { sql } from "@/lib/db";
import { pickAccount } from "@/app/actions/auth";

const ROLE: Record<string, string> = { super: "Super admin", admin: "Administrator", curator: "Kurator", student: "O'quvchi" };

export default async function Tanlash() {
  const p = await getSigned<{ ids: number[] }>("pick");
  if (!p?.ids?.length) redirect("/login");
  const rows = await sql<{ id: number; role: string; name: string; platform: string | null; color: string | null }[]>`
    select u.id, u.role, u.name, pl.name as platform, pl.color from users u left join platforms pl on pl.id = u.platform_id
    where u.id = any(${p.ids}) and u.active order by u.platform_id nulls first, u.id`;
  return (
    <main className="page plain" style={{ minHeight: "100dvh", justifyContent: "center" }}>
      <h1 className="h1">Qayerga kirasiz?</h1>
      <p className="sub" style={{ marginTop: -6 }}>Bu raqam bir nechta platformada bor.</p>
      {rows.map((r) => (
        <form key={r.id} action={pickAccount}>
          <input type="hidden" name="id" value={r.id} />
          <button className="card tight row" style={{ width: "100%", border: 0, textAlign: "left" }}>
            <span className="avatar" style={{ background: r.color ?? "#1c2533", color: "#fff" }}>{(r.platform ?? "S").slice(0, 1)}</span>
            <span className="grow">
              <span className="h3" style={{ display: "block" }}>{r.platform ?? "Super admin paneli"}</span>
              <span className="tiny muted">{ROLE[r.role]} · {r.name}</span>
            </span>
          </button>
        </form>
      ))}
    </main>
  );
}
