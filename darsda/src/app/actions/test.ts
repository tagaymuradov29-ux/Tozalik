"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTester } from "@/lib/tester";

/** 🧪 Sinov akkaunti boshqa kursga o'tadi:
 *  admin/kurator — tanlangan kurs; kurator — kuratori yo'q guruhga biriktiriladi; o'quvchi — kursning birinchi guruhiga o'tkaziladi */
export async function testSwitch(fd: FormData) {
  const u = await requireUser(["admin", "curator", "student"]);
  if (!isTester(u)) return;
  const id = Number(fd.get("course"));
  const [c] = await sql<{ id: number }[]>`select id from courses where id = ${id} and platform_id = ${u.platform_id}`;
  if (!c) return;
  (await cookies()).set("course", String(c.id), { path: "/", maxAge: 31536000 });
  let [g] = await sql<{ id: number; curator_id: number | null }[]>`select id, curator_id from groups where course_id = ${c.id} order by id limit 1`;
  if (!g) [g] = await sql<{ id: number; curator_id: number | null }[]>`
    insert into groups (platform_id, course_id, name) values (${u.platform_id}, ${c.id}, '1-guruh') returning id, curator_id`;
  if (u.role === "student") await sql`update users set group_id = ${g.id} where id = ${u.id}`;
  if (u.role === "curator") {
    const [mine] = await sql`select 1 from groups where course_id = ${c.id} and curator_id = ${u.id}`;
    if (!mine) await sql`update groups set curator_id = ${u.id} where id = (
      select id from groups where course_id = ${c.id} and curator_id is null order by id limit 1)`;
  }
  revalidatePath("/", "layout");
  redirect("/");
}
