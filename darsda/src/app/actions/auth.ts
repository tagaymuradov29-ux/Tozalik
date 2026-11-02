"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { clearSigned, endSession, getSigned, normPhone, setSigned, startSession } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normPhone(String(fd.get("phone") || ""));
  const pass = String(fd.get("password") || "");
  const pid = Number(fd.get("platform") || 0);
  if (!phone || !pass) return { error: "Telefon va parolni kiriting" };
  const rows = await sql<{ id: number; password_hash: string; platform_id: number | null }[]>`
    select id, password_hash, platform_id from users
    where phone = ${phone} and active and (${pid} = 0 or platform_id = ${pid})`;
  const ok = rows.filter((r) => bcrypt.compareSync(pass, r.password_hash));
  if (!ok.length) return { error: "Telefon yoki parol noto'g'ri" };
  if (ok.length > 1) {
    // Bir raqam bir nechta platformada — qaysi biriga kirishni tanlaydi
    await setSigned("pick", { ids: ok.map((r) => r.id) }, 600);
    redirect("/login/tanlash");
  }
  await startSession(ok[0].id);
  redirect(ok[0].platform_id ? "/" : "/super");
}

export async function pickAccount(fd: FormData) {
  const p = await getSigned<{ ids: number[] }>("pick");
  const id = Number(fd.get("id"));
  if (!p?.ids?.includes(id)) redirect("/login");
  const [u] = await sql<{ platform_id: number | null }[]>`select platform_id from users where id = ${id} and active`;
  if (!u) redirect("/login");
  await clearSigned("pick");
  await startSession(id);
  redirect(u.platform_id ? "/" : "/super");
}

export async function backToSuper() {
  const b = await getSigned<{ uid: number }>("back");
  await clearSigned("back");
  const [u] = b ? await sql`select 1 from users where id = ${b.uid} and role = 'super' and active` : [];
  if (!u || !b) redirect("/login");
  await startSession(b.uid);
  redirect("/super");
}

export async function logout(fd?: FormData) {
  const phone = String(fd?.get("phone") || "").replace(/\D/g, "");
  await endSession();
  await clearSigned("back");
  redirect(phone ? `/login?phone=${phone}` : "/login");
}

export async function join(_: FormState, fd: FormData): Promise<FormState> {
  const code = String(fd.get("code") || "");
  const name = String(fd.get("name") || "").trim().replace(/\s+/g, " ");
  const phone = normPhone(String(fd.get("phone") || ""));
  const pass = String(fd.get("password") || "");
  if (name.length < 3) return { error: "Ism va familiyani to'liq yozing" };
  if (phone.length < 9) return { error: "Telefon raqamini to'g'ri kiriting" };
  if (pass.length < 6) return { error: "Parol kamida 6 belgidan iborat bo'lsin" };
  const [inv] = await sql<{ platform_id: number; role: string; group_id: number | null }[]>`
    select platform_id, role, group_id from invites where code = ${code} and active`;
  if (!inv) return { error: "Taklif havolasi eskirgan yoki noto'g'ri" };
  const [ex] = await sql`select id from users where platform_id = ${inv.platform_id} and phone = ${phone}`;
  if (ex) return { error: "Bu raqam allaqachon ro'yxatdan o'tgan — kirish sahifasidan kiring" };
  const [u] = await sql<{ id: number }[]>`
    insert into users (platform_id, phone, password_hash, name, role, group_id)
    values (${inv.platform_id}, ${phone}, ${bcrypt.hashSync(pass, 10)}, ${name}, ${inv.role}, ${inv.role === "student" ? inv.group_id : null})
    returning id`;
  if (inv.role === "curator" && inv.group_id) {
    await sql`update groups set curator_id = ${u.id} where id = ${inv.group_id}`;
  }
  await sql`update invites set uses = uses + 1 where code = ${code}`;
  await startSession(u.id);
  redirect("/");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const { requireUser } = await import("@/lib/auth");
  const u = await requireUser();
  const old = String(fd.get("old") || "");
  const pass = String(fd.get("password") || "");
  if (pass.length < 6) return { error: "Yangi parol kamida 6 belgi" };
  const [r] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
  if (!bcrypt.compareSync(old, r.password_hash)) return { error: "Eski parol noto'g'ri" };
  await sql`update users set password_hash = ${bcrypt.hashSync(pass, 10)} where id = ${u.id}`;
  return { ok: "Parol o'zgartirildi" };
}
