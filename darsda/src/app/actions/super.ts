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
