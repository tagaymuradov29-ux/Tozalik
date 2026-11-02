import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { attCode } from "@/lib/course";

/** Davomat kodi (faqat xodim uchun) va kelganlar soni */
export async function GET(req: Request) {
  const u = await getUser();
  const id = Number(new URL(req.url).searchParams.get("l"));
  if (!u || (u.role !== "admin" && u.role !== "curator")) return NextResponse.json({}, { status: 403 });
  const [l] = await sql`select l.id from lessons l join courses c on c.id = l.course_id where l.id = ${id} and c.platform_id = ${u.platform_id}`;
  if (!l) return NextResponse.json({}, { status: 404 });
  const [st] = await sql<{ came: number; late: number }[]>`
    select count(*) filter (where status = 'ontime')::int as came, count(*) filter (where status = 'late')::int as late
    from attendance where lesson_id = ${id}`;
  const left = 60 - (Math.floor(Date.now() / 1000) % 60);
  return NextResponse.json({ code: attCode(id), left, ...st }, { headers: { "cache-control": "no-store" } });
}
