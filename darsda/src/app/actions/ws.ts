"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentCourse, notify } from "@/lib/course";
import type { FormState } from "./auth";

type Ws = { id: number; course_id: number; teams: number; phase: string; points: number[]; title: string };

async function load(id: number) {
  const u = await requireUser();
  const c = await currentCourse(u);
  const [w] = await sql<Ws[]>`select * from workshops where id = ${id} and course_id = ${c?.id ?? 0}`;
  return { u, w };
}

export async function createWorkshop(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin"]);
  const c = await currentCourse(u);
  if (!c) return { error: "Kurs yo'q" };
  const title = String(fd.get("title") || "").trim();
  const teams = Math.round(Number(fd.get("teams") || 5));
  const points = String(fd.get("points") || "50,40,30,20,10").split(/[,\s]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0);
  const lessonId = Number(fd.get("lesson_id") || 0) || null;
  if (!title) return { error: "Workshop mavzusini yozing" };
  if (teams < 2 || teams > 12) return { error: "Jamoalar soni 2–12" };
  const [w] = await sql<{ id: number }[]>`
    insert into workshops (course_id, lesson_id, title, teams, points)
    values (${c.id}, ${lessonId}, ${title}, ${teams}, ${sql.json(points)}) returning id`;
  revalidatePath("/", "layout");
  redirect(`/workshop/${w.id}`);
}

export async function joinTeam(fd: FormData) {
  const { u, w } = await load(Number(fd.get("id")));
  const team = Number(fd.get("team"));
  if (!w || u.role !== "student" || w.phase !== "join" || team < 1 || team > w.teams) return;
  await sql`insert into ws_members (ws_id, user_id, team) values (${w.id}, ${u.id}, ${team})
    on conflict (ws_id, user_id) do update set team = excluded.team`;
  revalidatePath(`/workshop/${w.id}`);
}

export async function vote(fd: FormData) {
  const { u, w } = await load(Number(fd.get("id")));
  const team = Number(fd.get("team"));
  const score = Number(fd.get("score"));
  if (!w || u.role !== "student" || w.phase !== "vote" || !(score >= 1 && score <= 10)) return;
  const [mine] = await sql<{ team: number }[]>`select team from ws_members where ws_id = ${w.id} and user_id = ${u.id}`;
  if (mine?.team === team) return;     // o'z jamoasiga ovoz berilmaydi
  await sql`insert into ws_votes (ws_id, voter_id, team, score) values (${w.id}, ${u.id}, ${team}, ${score})
    on conflict (ws_id, voter_id, team) do update set score = excluded.score`;
  revalidatePath(`/workshop/${w.id}`);
}

/** Admin: bosqichni almashtiradi. «done» — natija hisoblanadi: o'rtacha ball bo'yicha o'rin → o'ringa qarab ball */
export async function setPhase(fd: FormData) {
  const { u, w } = await load(Number(fd.get("id")));
  const phase = String(fd.get("phase"));
  if (!w || u.role !== "admin" || !["join", "vote", "done"].includes(phase)) return;
  let res: Record<string, number> = {};
  if (phase === "done") {
    const rows = await sql<{ team: number; avg: number; n: number }[]>`
      select m.team, coalesce(avg(v.score), 0)::float as avg, count(distinct m.user_id)::int as n
      from ws_members m left join ws_votes v on v.ws_id = m.ws_id and v.team = m.team
      where m.ws_id = ${w.id} group by m.team order by avg desc, m.team`;
    res = Object.fromEntries(rows.map((r, i) => [String(r.team), w.points[i] ?? 0]));
  }
  await sql`update workshops set phase = ${phase}, res = ${sql.json(res)} where id = ${w.id}`;
  const members = await sql<{ user_id: number; team: number }[]>`select user_id, team from ws_members where ws_id = ${w.id}`;
  if (phase === "vote") {
    const all = await sql<{ id: number }[]>`
      select u.id from users u join groups g on g.id = u.group_id where g.course_id = ${w.course_id} and u.role = 'student' and u.active`;
    await notify(all.map((x) => x.id), `🏆 Workshop: baholash boshlandi`, w.title, `/workshop/${w.id}`);
  }
  if (phase === "done") {
    for (const m of members) {
      const pts = res[String(m.team)] ?? 0;
      await notify([m.user_id], `🏆 Workshop natijasi: ${m.team}-jamoa${pts ? ` +${pts} ball` : ""}`, w.title, `/workshop/${w.id}`);
    }
  }
  revalidatePath("/", "layout");
}

export async function deleteWorkshop(fd: FormData) {
  const { u, w } = await load(Number(fd.get("id")));
  if (!w || u.role !== "admin") return;
  await sql`delete from workshops where id = ${w.id}`;
  revalidatePath("/", "layout");
  redirect("/workshop");
}
