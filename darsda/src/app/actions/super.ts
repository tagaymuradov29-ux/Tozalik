"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { normPhone, requireUser, setSigned, startSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { seedDemoCourse } from "@/lib/demo";
import type { FormState } from "./auth";

export async function createPlatform(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser(["super"]);
  const name = String(fd.get("name") || "").trim();
  const slug = String(fd.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const color = /^#[0-9a-f]{6}$/i.test(String(fd.get("color"))) ? String(fd.get("color")) : "#0B5D46";
  const aname = String(fd.get("admin_name") || "").trim();
  const phone = normPhone(String(fd.get("admin_phone") || ""));
  const pass = String(fd.get("admin_password") || "");
  if (!name || slug.length < 2) return { error: "Nom va qisqa nom (lotin harflarda) kerak" };
  if (!aname || phone.length < 9 || pass.length < 6) return { error: "Admin ismi, telefoni va paroli (6+ belgi) kerak" };
  const [ex] = await sql`select 1 from platforms where slug = ${slug}`;
  if (ex) return { error: "Bu qisqa nom band" };
  const [p] = await sql<{ id: number }[]>`insert into platforms (slug, name, color) values (${slug}, ${name}, ${color}) returning id`;
  await sql`insert into users (platform_id, phone, password_hash, name, role)
    values (${p.id}, ${phone}, ${bcrypt.hashSync(pass, 10)}, ${aname}, 'admin')`;
  if (fd.get("demo")) await seedDemoCourse(p.id);
  else await sql`insert into courses (platform_id, title) values (${p.id}, 'Birinchi kurs')`;
  revalidatePath("/super");
  return { ok: `«${name}» yaratildi. Admin ${phone} raqami bilan kira oladi.` };
}

export async function togglePlatformUser(fd: FormData) {
  await requireUser(["super"]);
  const id = Number(fd.get("id"));
  await sql`update users set active = not active where id = ${id} and role = 'admin'`;
  revalidatePath("/super");
}

/** Super admin platformaga uning admini sifatida kiradi; tepada «Super panelga qaytish» chiqadi */
export async function enterPlatform(fd: FormData) {
  const me = await requireUser(["super"]);
  const pid = Number(fd.get("id"));
  const [a] = await sql<{ id: number }[]>`
    select id from users where platform_id = ${pid} and role = 'admin' and active order by id limit 1`;
  if (!a) return;
  await setSigned("back", { uid: me.id }, 60 * 60 * 24 * 7);
  await startSession(a.id);
  redirect("/");
}

/** 🧪 Sinash uchun: super adminning o'z raqami bilan shu platformada admin / kurator / o'quvchi akkauntlari.
 *  Parollar rolga teng: admin, kurator, student; super adminning o'z paroli — super. Rolni parol ajratadi. */
export async function testAccounts(fd: FormData) {
  const me = await requireUser(["super"]);
  const pid = Number(fd.get("id"));
  const [p] = await sql<{ id: number }[]>`select id from platforms where id = ${pid}`;
  if (!p) return;
  let [c] = await sql<{ id: number }[]>`select id from courses where platform_id = ${pid} order by id limit 1`;
  if (!c) [c] = await sql<{ id: number }[]>`insert into courses (platform_id, title) values (${pid}, 'Birinchi kurs') returning id`;
  let [g] = await sql<{ id: number; curator_id: number | null }[]>`select id, curator_id from groups where course_id = ${c.id} order by id limit 1`;
  if (!g) [g] = await sql<{ id: number; curator_id: number | null }[]>`
    insert into groups (platform_id, course_id, name) values (${pid}, ${c.id}, '1-guruh') returning id, curator_id`;
  const upsert = async (role: string, pass: string, name: string, groupId: number | null) => {
    const hash = bcrypt.hashSync(pass, 10);
    const [ex] = await sql<{ id: number }[]>`select id from users where platform_id = ${pid} and phone = ${me.phone} and role = ${role}`;
    if (ex) {
      await sql`update users set password_hash = ${hash}, active = true, group_id = coalesce(group_id, ${groupId}) where id = ${ex.id}`;
      return ex.id;
    }
    const [n] = await sql<{ id: number }[]>`
      insert into users (platform_id, phone, password_hash, name, role, group_id)
      values (${pid}, ${me.phone}, ${hash}, ${name}, ${role}, ${groupId}) returning id`;
    return n.id;
  };
  await upsert("admin", "admin", "Test admin", null);
  const cur = await upsert("curator", "kurator", "Test kurator", null);
  await upsert("student", "student", "Test o'quvchi", g.id);
  if (!g.curator_id) await sql`update groups set curator_id = ${cur} where id = ${g.id}`;
  await sql`update users set password_hash = ${bcrypt.hashSync("super", 10)} where id = ${me.id}`;
  revalidatePath("/super");
  redirect(`/super?test=${pid}`);
}
