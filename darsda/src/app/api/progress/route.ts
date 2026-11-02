import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const u = await getUser();
  if (!u || u.role !== "student") return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const lessonId = Number(b.lesson_id);
  const [l] = await sql`select 1 from lessons l join groups g on g.course_id = l.course_id where l.id = ${lessonId} and g.id = ${u.group_id ?? 0}`;
  if (!l) return NextResponse.json({ ok: false }, { status: 404 });
  const pos = Math.max(0, Math.floor(Number(b.position) || 0));
  const dur = Math.max(0, Math.floor(Number(b.duration) || 0));
  const done = b.done === true || (dur > 0 && pos / dur > 0.9);
  await sql`insert into video_progress (user_id, lesson_id, position, duration, max_pos, done)
    values (${u.id}, ${lessonId}, ${pos}, ${dur}, ${pos}, ${done})
    on conflict (user_id, lesson_id) do update set
      position = excluded.position,
      duration = greatest(video_progress.duration, excluded.duration),
      max_pos = greatest(video_progress.max_pos, excluded.max_pos),
      done = video_progress.done or excluded.done,
      updated_at = now()`;
  return NextResponse.json({ ok: true });
}
