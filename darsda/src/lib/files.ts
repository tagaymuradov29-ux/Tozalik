import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";
import type { User } from "./auth";

export type StoredFile = { id: string; name: string; type: string; size: number };

const MAX_FILE = 4 * 1024 * 1024;
const MAX_TOTAL = 4.3 * 1024 * 1024;

/** Fayllarni bazaga saqlaydi. Avval hammasini tekshiradi (hajm, avval yuborilganmi), keyin yozadi — yarim saqlanib qolmaydi. */
export async function storeFiles(u: User, files: File[]): Promise<{ error: string } | { stored: StoredFile[] }> {
  if (files.some((f) => f.size > MAX_FILE)) return { error: "Har bir fayl 4 MB dan oshmasin" };
  if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) return { error: "Fayllar jami 4 MB dan oshmasin — kamroq yuboring" };
  const items = await Promise.all(files.map(async (f) => {
    const buf = Buffer.from(await f.arrayBuffer());
    return { f, buf, sha: createHash("sha256").update(buf).digest("hex") };
  }));
  if (new Set(items.map((x) => x.sha)).size !== items.length) return { error: "Bir xil fayl ikki marta tanlangan" };
  const shas = items.map((x) => x.sha);
  // Avval qabul qilingan yoki tekshiruvdagi javoblarda ishlatilgan fayl qayta yuborilmaydi (vazifa ham, networking ham)
  const [used] = await sql<{ name: string }[]>`
    select fl.name from files fl where fl.platform_id = ${u.platform_id} and fl.sha256 = any(${shas}) and (
      exists (select 1 from submissions s, jsonb_array_elements(s.files) e
              where (e->>'id')::uuid = fl.id and s.status in ('pending','approved'))
      or exists (select 1 from net_proofs p, jsonb_array_elements(p.files) e
              where (e->>'id')::uuid = fl.id and p.status in ('pending','approved')))
    limit 1`;
  if (used) return { error: `Bu rasm/fayl avval boshqa javobda yuborilgan` };
  const stored: StoredFile[] = [];
  for (const { f, buf, sha } of items) {
    const name = f.name.slice(0, 120) || "fayl";
    const [row] = await sql<{ id: string }[]>`
      insert into files (platform_id, user_id, name, type, size, sha256, data)
      values (${u.platform_id}, ${u.id}, ${name}, ${f.type || "application/octet-stream"}, ${buf.length}, ${sha}, ${buf})
      returning id`;
    stored.push({ id: row.id, name, type: f.type, size: buf.length });
  }
  return { stored };
}
