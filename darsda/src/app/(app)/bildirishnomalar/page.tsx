import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fmtDT } from "@/lib/util";
import { Head } from "@/components/ui";
import { markRead } from "@/app/actions/student";

export default async function Notifs() {
  const u = await requireUser();
  const rows = await sql<{ id: number; title: string; body: string; url: string; read_at: Date | null; created_at: Date }[]>`
    select * from notifications where user_id = ${u.id} order by id desc limit 50`;
  const unread = rows.some((r) => !r.read_at);
  return (
    <main className="page">
      <Head title="Bildirishnomalar" back="/" right={unread ? <form action={markRead}><button className="btn sm ghost">O&apos;qildi</button></form> : undefined} />
      <div className="card">
        <div className="list">
          {rows.map((r) => {
            const inner = (
              <div className="grow">
                <div className="h3" style={{ fontWeight: r.read_at ? 500 : 700 }}>{!r.read_at && <span style={{ color: "var(--brand)" }}>● </span>}{r.title}</div>
                {r.body && <div className="small sub" style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>}
                <div className="tiny muted">{fmtDT(r.created_at, u.tz)}</div>
              </div>
            );
            return r.url ? <Link key={r.id} href={r.url} className="li">{inner}</Link> : <div key={r.id} className="li">{inner}</div>;
          })}
          {!rows.length && <div className="empty">Bildirishnoma yo&apos;q</div>}
        </div>
      </div>
    </main>
  );
}
