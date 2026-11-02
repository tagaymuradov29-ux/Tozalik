import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import wb1 from "@/data/1.json";
import wb2 from "@/data/2.json";

const LESSONS: [string, string][] = [
  ["To'g'ri maqsad qo'yish va mindsetni to'g'irlash", "Akbarjon Botiraliyev"],
  ["Qimmat chekga, katta qiymatda sotish", "Akbarjon Botiraliyev"],
  ["Performance marketing Roadmap va narx belgilash", "Akbarjon Botiraliyev"],
  ["Bozor tahlili", "Akbarjon Botiraliyev"],
  ["Marketing tahlillar (CustDev)", "Akbarjon Botiraliyev"],
  ["Ishlaydigan marketing strategiya, produkt va marketing plan", "Akbarjon Botiraliyev"],
  ["Marketing voronkalar va loyihani natijaga olib chiqish", "Akbarjon Botiraliyev"],
  ["2X ko'proq sotuvchi bo'lim qurish", "Abdulboriy Abduqodirov"],
  ["Sotuv bo'limi — davomi", "Abdulboriy Abduqodirov"],
  ["Brend strategiya va marketing reja", "Akbarjon Botiraliyev"],
  ["AI ni marketingga integratsiya qilish", "Yusufbay Kodirov"],
  ["Content marketing va shaxsiy brend", "Asror Iskandarov"],
];

const AMALIY: [number, string][] = [
  [1, "Kontent plan tuzish"],
  [2, "Peregovor o'tkazish va sotuv"],
  [3, "1 ta mijoz uchun to'liq strategik ish (Performance roadmap)"],
  [5, "Mijoz va bozor tahlili — CustDev o'tkazish"],
  [6, "Ishlaydigan marketing strategiyasini tuzish"],
  [7, "Marketing loyihada natija qilish — voronka tuzish"],
];

const DEMO_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

/** Namuna kurs: RM 6.0 tuzilmasi — darslar (du/ju 18:00), konspekt, workbook, amaliy, stories, reels. */
export async function seedDemoCourse(platformId: number) {
  const [c] = await sql<{ id: number }[]>`
    insert into courses (platform_id, title, description, points)
    values (${platformId}, 'Real Marketing 6.0', 'Marketolog va agentlik egalari uchun 12 haftalik amaliy kurs',
      ${sql.json({ goals: [{ pts: 800, label: "🎓 Kurs tugagach 3 oy qo'shimcha dostup" }, { pts: 1200, label: "🏆 Bosh sovrinlar uchun kurashga kirish" }] })})
    returning id`;
  await sql`insert into groups (platform_id, course_id, name) values
    (${platformId}, ${c.id}, '1-guruh'), (${platformId}, ${c.id}, '2-guruh')`;

  // Birinchi dars — 3 hafta oldingi dushanba, 18:00 Toshkent (13:00 UTC)
  const now = new Date();
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0));
  mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7) - 21);
  const lessonIds: number[] = [];
  for (let i = 0; i < LESSONS.length; i++) {
    const d = new Date(mon.getTime() + (Math.floor(i / 2) * 7 + (i % 2 ? 4 : 0)) * 86400000);
    const [l] = await sql<{ id: number }[]>`
      insert into lessons (course_id, n, title, speaker, starts_at, duration_min, video_url, content)
      values (${c.id}, ${i + 1}, ${LESSONS[i][0]}, ${LESSONS[i][1]}, ${d}, 240,
        ${i === 0 ? DEMO_VIDEO : ""},
        ${i === 0 ? "<p>Bu — namunaviy dars. Video o'rniga Kinescope, YouTube yoki istalgan .mp4 havolasini qo'yish mumkin.</p><ul><li>Maqsadni SMART bo'yicha qo'yish</li><li>Mindset: bahona emas, vaziyat yaratish</li><li>Haftalik reja</li></ul>" : ""})
      returning id`;
    lessonIds.push(l.id);
    const end = new Date(d.getTime() + 4 * 3600000);
    // ertasi kun 12:00 Toshkent = 07:00 UTC
    const nextDay12 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 7, 0));
    await sql`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, position)
      values (${c.id}, ${l.id}, ${`${i + 1}-dars konspekti`}, 'file',
        'Darsda yozgan konspektingizni rasm yoki PDF qilib yuboring. Matn ko''rinishida ham bo''ladi.',
        10, 8, ${d}, ${nextDay12}, 1)`;
    const wb = i === 0 ? wb1 : i === 1 ? wb2 : null;
    if (wb) {
      const nextLesson = new Date(mon.getTime() + (Math.floor((i + 1) / 2) * 7 + ((i + 1) % 2 ? 4 : 0)) * 86400000);
      await sql`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, workbook, position)
        values (${c.id}, ${l.id}, ${`${i + 1}-dars workbook`}, 'workbook', ${(wb as { goal?: string }).goal ?? ""},
          20, 15, ${end}, ${new Date(nextLesson.getTime() - 24 * 3600000)}, ${sql.json(wb)}, 2)`;
    }
    const am = AMALIY.find(([n]) => n === i + 1);
    if (am) {
      await sql`insert into tasks (course_id, lesson_id, title, kind, instructions, max_points, late_points, opens_at, due_at, position)
        values (${c.id}, ${l.id}, ${`Amaliy: ${am[1]}`}, 'file',
          'Topshiriqni bajarib, fayl, rasm yoki havola ko''rinishida yuboring. Kurator 0–50 ball bilan baholaydi.',
          50, 40, ${end}, ${new Date(end.getTime() + 7 * 86400000)}, 3)`;
    }
  }
  await sql`insert into tasks (course_id, title, kind, instructions, max_points, per_day, opens_at, position) values
    (${c.id}, 'Instagram stories', 'repeat', 'Kurs haqida stories joylang va skrinshotini yuboring. Kuniga 5 tagacha, har biri 1 ball.', 1, 5, ${mon}, 10),
    (${c.id}, 'Reels', 'repeat', 'Reels havolasini yuboring. Haftasiga 3 tagacha, har biri 10 ballgacha.', 10, null, ${mon}, 11)`;
  await sql`update tasks set per_week = 3 where course_id = ${c.id} and title = 'Reels'`;
  return c.id;
}

/** Namuna natijalar: o'quvchi birinchi `closed` ta darsni to'liq yopgan, keyingisi tekshiruvda, undan keyingisida qarz.
 *  Jurnal va yo'l xaritasi bo'sh ko'rinmasligi uchun. */
export async function seedDemoProgress(courseId: number, userId: number, closed: number) {
  const lessons = await sql<{ id: number; starts_at: Date }[]>`
    select id, starts_at from lessons where course_id = ${courseId} and starts_at <= now() order by n`;
  const tasks = await sql<{ id: number; lesson_id: number | null; max_points: number; kind: string }[]>`
    select id, lesson_id, max_points, kind from tasks where course_id = ${courseId} and lesson_id is not null`;
  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    const at = new Date(new Date(l.starts_at).getTime() + 20 * 3600000);
    if (i < closed + 1) {
      const late = (i * 7 + userId) % 5 === 0 ? 12 : 0;
      await sql`insert into attendance (lesson_id, user_id, status, late_min, src) values (${l.id}, ${userId}, ${late ? "late" : "ontime"}, ${late}, 'kod')
        on conflict do nothing`;
    }
    for (const t of tasks.filter((x) => x.lesson_id === l.id)) {
      if (i < closed) {
        await sql`insert into submissions (task_id, user_id, text, status, points, graded_at, created_at)
          values (${t.id}, ${userId}, 'Namuna javob', 'approved', ${t.max_points}, ${at}, ${at})`;
      } else if (i === closed && t.kind !== "workbook") {
        await sql`insert into submissions (task_id, user_id, text, status, created_at) values (${t.id}, ${userId}, 'Namuna javob', 'pending', ${at})`;
      }
    }
  }
}

const MORE = ["Aziza Nurmatova", "Otabek Rasulov", "Kamola Ismoilova", "Javohir Ergashev", "Shahnoza Mirzayeva", "Ulug'bek Sobirov",
  "Feruza Hamidova", "Doniyor Xolmatov", "Gulnoza Abdullayeva", "Sherzod Nazarov", "Madina Saidova", "Rustam Jo'rayev",
  "Zarina Qosimova", "Akmal Tursunov"];

/** Namuna networking: qo'shimcha namuna o'quvchilar + 2 hafta oldin boshlangan tur, tasdiqlangan va tekshiruvdagi tanishuvlar.
 *  Kursda hali networking bo'lmasa ishlaydi, aks holda hech narsa qilmaydi. */
export async function seedDemoNet(courseId: number) {
  const [ex] = await sql`select 1 from net_rounds where course_id = ${courseId}`;
  if (ex) return false;
  const [c] = await sql<{ platform_id: number }[]>`select platform_id from courses where id = ${courseId}`;
  const groups = await sql<{ id: number }[]>`select id from groups where course_id = ${courseId} order by id`;
  const [first] = await sql<{ starts_at: Date }[]>`select starts_at from lessons where course_id = ${courseId} order by n limit 1`;
  const joined = new Date(new Date(first.starts_at).getTime() - 86400000);
  for (const [i, name] of MORE.entries()) {
    const [u] = await sql<{ id: number }[]>`
      insert into users (platform_id, phone, password_hash, name, role, group_id, created_at)
      values (${c.platform_id}, ${`99800000010${String(i).padStart(2, "0")}`}, ${bcrypt.hashSync(randomBytes(12).toString("hex"), 6)}, ${name + " (namuna)"}, 'student', ${groups[i % groups.length].id}, ${joined})
      returning id`;
    await seedDemoProgress(courseId, u.id, [6, 5, 4, 3, 2, 1, 0][i % 7]);
  }
  const ids = (await sql<{ id: number }[]>`select u.id from users u join groups g on g.id = u.group_id
    where g.course_id = ${courseId} and u.role = 'student' and u.active order by u.id`).map((x) => x.id);
  // Har kim har kim bilan bir marta: aylanma juftlash
  const a: (number | null)[] = [...ids];
  if (a.length % 2) a.push(null);
  const rounds: [number, number][][] = [];
  for (let r = 0; r < a.length - 1; r++) {
    const pr: [number, number][] = [];
    for (let i = 0; i < a.length / 2; i++) { const x = a[i], y = a[a.length - 1 - i]; if (x !== null && y !== null) pr.push([x, y]); }
    rounds.push(pr);
    a.splice(1, 0, a.pop()!);
  }
  const perWeek = 3, weeks = 4;
  const start = new Date(Date.now() - 15 * 86400000);
  const [r] = await sql<{ id: number }[]>`insert into net_rounds (course_id, title, starts_at, weeks, per_week, points)
    values (${courseId}, 'Networking 2.0', ${start}, ${weeks}, ${perWeek}, 5) returning id`;
  const me = ids[0];
  for (let k = 0; k < Math.min(rounds.length, weeks * perWeek); k++) {
    const week = Math.floor(k / perWeek) + 1;
    for (const [x, y] of rounds[k]) {
      const [p] = await sql<{ id: number }[]>`insert into net_pairs (round_id, week, a_id, b_id) values (${r.id}, ${week}, ${x}, ${y}) returning id`;
      // 1–2-haftalar: ko'pchiligi tasdiqlangan, ba'zilari tekshiruvda; 3-hafta (joriy): bir nechtasi yuborilgan
      const h = (x * 31 + y * 17 + k) % 10;
      const mine = x === me || y === me;
      const st = mine ? (week === 1 ? "approved" : week === 2 ? (h < 6 ? "approved" : "pending") : null)
        : week <= 2 ? (h < 7 ? "approved" : h < 9 ? "pending" : null) : week === 3 ? (h < 3 ? "approved" : h < 5 ? "pending" : null) : null;
      if (!st) continue;
      for (const uid of [x, y]) {
        await sql`insert into net_proofs (pair_id, user_id, text, status, points) values (${p.id}, ${uid}, 'Namuna', ${st}, ${st === "approved" ? 5 : null})`;
      }
    }
  }
  return true;
}
