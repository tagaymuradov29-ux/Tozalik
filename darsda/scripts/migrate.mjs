// Bazani yaratadi/yangilaydi va SUPER_PHONE + SUPER_PASSWORD bo'lsa super adminni qo'shadi.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL yo'q — o'tkazib yuborildi");
  process.exit(0);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);
console.log("[migrate] sxema tayyor");

// Bir martalik ko'chirish: COPY_FROM_URL berilgan va yangi baza bo'sh bo'lsa — eski bazadagi hamma ma'lumot nusxalanadi.
// Jadvallar bog'liqlik tartibida; users ↔ groups halqa bog'lanishi uchun bitta cheklov vaqtincha olib turiladi.
const TABLES = ["platforms", "users", "courses", "groups", "invites", "lessons", "tasks", "files", "submissions", "wb_answers",
  "attendance", "bonuses", "messages", "video_progress", "notifications", "workshops", "ws_members", "ws_votes",
  "net_rounds", "net_pairs", "net_proofs"];
const from = process.env.COPY_FROM_URL;
if (from && from !== url) {
  const [{ n }] = await sql`select count(*)::int as n from platforms`;
  if (n === 0) {
    const old = postgres(from, { max: 1, onnotice: () => {} });
    await sql.begin(async (tx) => {
      await tx`alter table users drop constraint if exists users_group_fk`;
      await tx`delete from users`;
      for (const t of TABLES) {
        const [{ rows }] = await old.unsafe(`select coalesce(json_agg(x), '[]'::json)::text as rows from ${t} x`);
        const cnt = JSON.parse(rows).length;
        if (cnt) await tx.unsafe(`insert into ${t} select * from json_populate_recordset(null::${t}, $1::text::json)`, [rows]);
        console.log(`[copy] ${t}: ${cnt}`);
      }
      await tx`alter table users add constraint users_group_fk foreign key (group_id) references groups(id) on delete set null`;
      // serial hisoblagichlar — ko'chirilgan eng katta id'dan davom etadi (id ustuni bor jadvallar)
      const serial = await tx`select table_name as t from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and column_default like 'nextval%'`;
      for (const { t } of serial) {
        await tx.unsafe(`select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 1), (select count(*) > 0 from ${t}))`);
      }
    });
    await old.end();
    console.log("[copy] eski bazadan ko'chirish tugadi");
  } else console.log("[copy] yangi bazada ma'lumot bor — ko'chirish o'tkazib yuborildi");
}

const phone = (process.env.SUPER_PHONE || "").replace(/\D/g, "");
const pass = process.env.SUPER_PASSWORD;
if (phone && pass) {
  const [ex] = await sql`select id from users where platform_id is null and phone = ${phone}`;
  if (!ex) {
    await sql`insert into users (platform_id, phone, password_hash, name, role)
      values (null, ${phone}, ${bcrypt.hashSync(pass, 10)}, 'Super admin', 'super')`;
    console.log("[migrate] super admin yaratildi:", phone);
  }
}
await sql.end();
