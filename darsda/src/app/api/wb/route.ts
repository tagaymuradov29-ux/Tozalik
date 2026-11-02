import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Workbook javoblarini avtomatik saqlash (yuborilgan bo'lsa — o'zgartirib bo'lmaydi) */
export async function POST(req: Request) {
  const u = await getUser();
  if (!u || u.role !== "student") return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const taskId = Number(b.task_id);
  const data = b.data && typeof b.data === "object" ? b.data : {};
  if (JSON.stringify(data).length > 200_000) return NextResponse.json({ ok: false, error: "too big" }, { status: 413 });
  const [t] = await sql`
    select 1 from tasks t join groups g on g.course_id = t.course_id
    where t.id = ${taskId} and g.id = ${u.group_id ?? 0} and t.kind = 'workbook'
      and not exists (select 1 from submissions s where s.task_id = t.id and s.user_id = ${u.id} and s.status in ('pending','approved'))`;
  if (!t) return NextResponse.json({ ok: false }, { status: 403 });
  await sql`insert into wb_answers (user_id, task_id, data) values (${u.id}, ${taskId}, ${sql.json(data)})
    on conflict (user_id, task_id) do update set data = excluded.data, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
