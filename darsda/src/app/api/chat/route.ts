import { NextResponse } from "next/server";
import { getUser, type User } from "@/lib/auth";
import { sql } from "@/lib/db";

async function canUse(u: User, gid: number) {
  if (u.role === "student") return u.group_id === gid;
  const [g] = await sql`select 1 from groups where id = ${gid} and platform_id = ${u.platform_id}
    and (${u.role === "admin"} or curator_id = ${u.id})`;
  return !!g;
}

export async function GET(req: Request) {
  const u = await getUser();
  const p = new URL(req.url).searchParams;
  const gid = Number(p.get("g"));
  const after = Number(p.get("after") || 0);
  if (!u || !(await canUse(u, gid))) return NextResponse.json({ msgs: [] }, { status: 403 });
  const msgs = await sql`
    select m.id::int, m.text, m.created_at, m.user_id, u.name, u.role from messages m join users u on u.id = m.user_id
    where m.group_id = ${gid} and m.id > ${after} order by m.id desc limit 100`;
  return NextResponse.json({ msgs: msgs.reverse() });
}

export async function POST(req: Request) {
  const u = await getUser();
  const b = await req.json().catch(() => ({}));
  const gid = Number(b.g);
  const text = String(b.text || "").trim().slice(0, 4000);
  if (!u || !text || !(await canUse(u, gid))) return NextResponse.json({ ok: false }, { status: 403 });
  await sql`insert into messages (group_id, user_id, text) values (${gid}, ${u.id}, ${text})`;
  return NextResponse.json({ ok: true });
}
