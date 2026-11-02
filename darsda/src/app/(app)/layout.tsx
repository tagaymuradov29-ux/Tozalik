import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { SW } from "@/components/SW";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (u.role === "super") redirect("/super");
  const [{ review, unread }] = await sql<{ review: number; unread: number }[]>`
    select
      (select count(*)::int from submissions s join tasks t on t.id = s.task_id join courses c on c.id = t.course_id
        join users su on su.id = s.user_id left join groups g on g.id = su.group_id
        where c.platform_id = ${u.platform_id} and s.status = 'pending'
          and (${u.role === "admin"} or (${u.role === "curator"} and g.curator_id = ${u.id}))) as review,
      (select count(*)::int from notifications where user_id = ${u.id} and read_at is null) as unread`;
  return (
    <div style={{ ["--brand" as string]: u.color }}>
      {children}
      <Nav role={u.role} review={review} unread={unread} />
      <SW />
    </div>
  );
}
