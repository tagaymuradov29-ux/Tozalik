import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { seedDemoCourse, seedDemoNet, seedDemoProgress, seedDemoVideo } from "@/lib/demo";

/** Bir martalik: bazani tozalab, 4 ta kirish (super / admin / kurator / o'quvchi) va namuna kursni tayyorlaydi.
 *  Faqat SETUP_TOKEN bilan ishlaydi va har bir token faqat bir marta bazani tozalaydi; keyin faqat tekshiruv hisobotini qaytaradi. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) return new NextResponse("Not found", { status: 404 });
  const phone = (process.env.SUPER_PHONE || "").replace(/\D/g, "");
  if (!phone) return NextResponse.json({ error: "SUPER_PHONE yo'q" }, { status: 500 });
  const key = `setup:${token.slice(0, 12)}`;
  const [done] = await sql`select 1 from app_meta where key = ${key}`;
  if (!done) {
    await sql.begin(async (tx) => {
      await tx`truncate table platforms, users restart identity cascade`;
      await tx`insert into users (platform_id, phone, password_hash, name, role) values (null, ${phone}, ${bcrypt.hashSync("super", 10)}, 'Super admin', 'super')`;
    });
    const [p] = await sql<{ id: number }[]>`insert into platforms (slug, name, color) values ('realmarketing', 'Real Marketing', '#3390EC') returning id`;
    const courseId = await seedDemoCourse(p.id);
    const groups = await sql<{ id: number }[]>`select id from groups where course_id = ${courseId} order by id`;
    const [first] = await sql<{ starts_at: Date }[]>`select starts_at from lessons where course_id = ${courseId} order by n limit 1`;
    const joined = new Date(new Date(first.starts_at).getTime() - 86400000);
    const add = async (name: string, ph: string, pass: string, role: string, gid: number | null) => {
      const [u] = await sql<{ id: number }[]>`
        insert into users (platform_id, phone, password_hash, name, role, group_id, created_at)
        values (${p.id}, ${ph}, ${bcrypt.hashSync(pass, 10)}, ${name}, ${role}, ${gid}, ${joined}) returning id`;
      return u.id;
    };
    await add("Shahzod (admin)", phone, "admin", "admin", null);
    const cur = await add("Shahzod (kurator)", phone, "kurator", "curator", null);
    await sql`update groups set curator_id = ${cur} where id = ${groups[0].id}`;
    const me = await add("Shahzod (o'quvchi)", phone, "student", "student", groups[0].id);
    await seedDemoProgress(courseId, me, 3);
    // Namuna o'quvchilar (kirish uchun emas — jurnal va reyting jonli ko'rinishi uchun)
    const demo: [string, number, number][] = [
      ["Malika Karimova (namuna)", 0, 6], ["Jasur Toshmatov (namuna)", 0, 5], ["Dilnoza Rahimova (namuna)", 0, 2],
      ["Bekzod Aliyev (namuna)", 0, 1], ["Nodira Yusupova (namuna)", 1, 4], ["Sardor Qodirov (namuna)", 1, 0],
    ];
    for (const [i, [name, g, closed]] of demo.entries()) {
      const id = await add(name, `99800000000${i}`, randomBytes(12).toString("hex"), "student", groups[g]?.id ?? groups[0].id);
      await seedDemoProgress(courseId, id, closed);
    }
    await sql`insert into app_meta (key, value) values (${key}, 'done')`;
  }
  // Namuna networking (Tanishuvlar osmoni uchun) — namuna kursda hali networking bo'lmasa bir marta qo'shiladi
  const [demoCourse] = await sql<{ id: number }[]>`select c.id from courses c join platforms p on p.id = c.platform_id
    where p.slug = 'realmarketing' and c.title = 'Real Marketing 6.0' order by c.id limit 1`;
  const net = demoCourse ? await seedDemoNet(demoCourse.id) : false;
  const video = demoCourse ? await seedDemoVideo(demoCourse.id) : false;
  // Tekshiruv: har bir parol aynan bitta akkauntga kiradimi
  const rows = await sql<{ role: string; password_hash: string; platform: string | null }[]>`
    select u.role, u.password_hash, p.name as platform from users u left join platforms p on p.id = u.platform_id
    where u.phone = ${phone} and u.active`;
  const check = ["super", "admin", "kurator", "student"].map((pw) => {
    const m = rows.filter((r) => bcrypt.compareSync(pw, r.password_hash));
    return { parol: pw, mos: m.length, kiradi: m.map((r) => `${r.role}${r.platform ? " · " + r.platform : ""}`) };
  });
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from users`;
  return NextResponse.json({ reset: !done, net, video, phone, users: n, check });
}
