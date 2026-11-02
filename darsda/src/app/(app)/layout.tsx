import { redirect } from "next/navigation";
import { getSigned, requireUser } from "@/lib/auth";
import { backToSuper } from "@/app/actions/auth";
import { sql } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { SW } from "@/components/SW";
import { getBrand, on } from "@/lib/platform";
import { BrandStyle } from "@/components/BrandStyle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (u.role === "super") redirect("/super");
  const [{ review, unread }] = await sql<{ review: number; unread: number }[]>`
    select
      (select count(*)::int from submissions s join tasks t on t.id = s.task_id join courses c on c.id = t.course_id
        join users su on su.id = s.user_id left join groups g on g.id = su.group_id
        where c.platform_id = ${u.platform_id} and s.status = 'pending'
          and (${u.role === "admin"} or (${u.role === "curator"} and g.curator_id = ${u.id})))
      + (select count(*)::int from net_proofs pr join users su on su.id = pr.user_id left join groups g on g.id = su.group_id
        where su.platform_id = ${u.platform_id} and pr.status = 'pending'
          and (${u.role === "admin"} or (${u.role === "curator"} and g.curator_id = ${u.id}))) as review,
      (select count(*)::int from notifications where user_id = ${u.id} and read_at is null) as unread`;
  const [back, b] = await Promise.all([getSigned<{ uid: number }>("back"), getBrand(u.platform_id)]);
  return (
    <div>
      <BrandStyle b={b} />
      {back && (
        <form action={backToSuper} className="superbar">
          <span>👑 {u.platform_name} · admin sifatida</span>
          <button>Super panelga qaytish</button>
        </form>
      )}
      {children}
      <Nav role={u.role} review={review} unread={unread} chat={on(b, "chat")} />
      <SW />
    </div>
  );
}
