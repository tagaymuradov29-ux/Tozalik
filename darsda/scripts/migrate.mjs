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
