"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentCourse, notify } from "@/lib/course";
import { storeFiles } from "@/lib/files";
import { localToUtc } from "@/lib/util";
import type { FormState } from "./auth";

/** Round-robin (aylana usuli): har kim har kim bilan bir martadan uchrashadi. Toq bo'lsa — bittasi o'sha turda dam oladi. */
function roundRobin(ids: number[]): [number, number][][] {
  const a: (number | null)[] = [...ids];
  if (a.length % 2) a.push(null);
  const n = a.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = a[i], y = a[n - 1 - i];
      if (x !== null && y !== null) pairs.push([x, y]);
    }
    rounds.push(pairs);
    a.splice(1, 0, a.pop()!);       // birinchisi joyida, qolganlari aylanadi
  }
  return rounds;
}

export async function createRound(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin"]);
  const c = await currentCourse(u);
  if (!c) return { error: "Kurs yo'q" };
  const title = String(fd.get("title") || "Networking").trim();
  const start = String(fd.get("starts_at") || "");
  const weeks = Math.round(Number(fd.get("weeks") || 4));
  const perWeek = Math.round(Number(fd.get("per_week") || 3));
  const points = Math.round(Number(fd.get("points") || 5));
  if (!start) return { error: "Boshlanish sanasini tanlang" };
  if (weeks < 1 || weeks > 20 || perWeek < 1 || perWeek > 10) return { error: "Hafta 1–20, haftasiga 1–10 tanishuv" };
  const st = await sql<{ id: number }[]>`
    select u.id from users u join groups g on g.id = u.group_id where g.course_id = ${c.id} and u.role = 'student' and u.active`;
  if (st.length < 2) return { error: "Kamida 2 ta o'quvchi kerak" };
  const ids = st.map((x) => x.id).sort(() => Math.random() - 0.5);
  const rounds = roundRobin(ids);
  const need = weeks * perWeek;
  const [r] = await sql<{ id: number }[]>`
    insert into net_rounds (course_id, title, starts_at, weeks, per_week, points)
    values (${c.id}, ${title}, ${localToUtc(start, u.tz)}, ${weeks}, ${perWeek}, ${points}) returning id`;
  const rows: { round_id: number; week: number; a_id: number; b_id: number }[] = [];
  for (let k = 0; k < Math.min(need, rounds.length); k++) {
    for (const [a, b] of rounds[k]) rows.push({ round_id: r.id, week: Math.floor(k / perWeek) + 1, a_id: a, b_id: b });
  }
  for (let i = 0; i < rows.length; i += 500) await sql`insert into net_pairs ${sql(rows.slice(i, i + 500))}`;
  revalidatePath("/", "layout");
  const short = need > rounds.length ? ` O'quvchilar soni kamligi uchun ${Math.ceil(rounds.length / perWeek)} haftalik juftlik tuzildi (har kim har kim bilan bir marta).` : "";
  return { ok: `Tayyor: ${rows.length} ta juftlik.${short}` };
}

export async function deleteRound(fd: FormData) {
  const u = await requireUser(["admin"]);
  const c = await currentCourse(u);
  await sql`delete from net_rounds where id = ${Number(fd.get("id"))} and course_id = ${c?.id ?? 0}`;
  revalidatePath("/", "layout");
}

export async function sendProof(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["student"]);
  const pairId = Number(fd.get("pair_id"));
  const [p] = await sql<{ id: number; starts_at: Date; week: number }[]>`
    select pa.id, r.starts_at, pa.week from net_pairs pa join net_rounds r on r.id = pa.round_id
    where pa.id = ${pairId} and (pa.a_id = ${u.id} or pa.b_id = ${u.id})`;
  if (!p) return { error: "Juftlik topilmadi" };
  if (new Date(p.starts_at).getTime() + (p.week - 1) * 7 * 86400000 > Date.now()) return { error: "Bu hafta hali boshlanmagan" };
  const [ex] = await sql<{ status: string }[]>`
    select status from net_proofs where pair_id = ${p.id} and user_id = ${u.id} and status in ('pending','approved')`;
  if (ex) return { error: ex.status === "approved" ? "Allaqachon tasdiqlangan" : "Tekshirilmoqda" };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < 2) return { error: "2 ta rasm kerak: Zoom/selfi va kontaktga saqlangan holati" };
  const saved = await storeFiles(u, files.slice(0, 4));
  if ("error" in saved) return { error: saved.error };
  await sql`insert into net_proofs (pair_id, user_id, files, text) values (${p.id}, ${u.id}, ${sql.json(saved.stored)}, ${String(fd.get("text") || "").trim()})`;
  revalidatePath("/", "layout");
  return { ok: "Yuborildi! Kurator tasdiqlagach ball qo'shiladi." };
}

export async function reviewProof(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser(["admin", "curator"]);
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision"));
  const feedback = String(fd.get("feedback") || "").trim();
  const [p] = await sql<{ user_id: number; points: number; partner: string }[]>`
    select pr.user_id, r.points, pu.name as partner from net_proofs pr join net_pairs pa on pa.id = pr.pair_id
    join net_rounds r on r.id = pa.round_id join users su on su.id = pr.user_id join groups g on g.id = su.group_id
    join users pu on pu.id = case when pa.a_id = pr.user_id then pa.b_id else pa.a_id end
    where pr.id = ${id} and su.platform_id = ${u.platform_id} and (${u.role === "admin"} or g.curator_id = ${u.id})`;
  if (!p) return { error: "Ruxsat yo'q" };
  if (decision === "reject") {
    if (!feedback) return { error: "Qaytarish sababini yozing" };
    await sql`update net_proofs set status = 'rejected', points = null, feedback = ${feedback}, reviewed_by = ${u.id} where id = ${id}`;
    await notify([p.user_id], `🤝 Networking isboti qaytarildi (${p.partner})`, feedback, "/networking");
  } else {
    await sql`update net_proofs set status = 'approved', points = ${p.points}, feedback = ${feedback}, reviewed_by = ${u.id} where id = ${id}`;
    await notify([p.user_id], `🤝 Tanishuv tasdiqlandi: +${p.points} ball`, p.partner, "/networking");
  }
  revalidatePath("/", "layout");
  return { ok: decision === "reject" ? "Qaytarildi" : "Tasdiqlandi" };
}
