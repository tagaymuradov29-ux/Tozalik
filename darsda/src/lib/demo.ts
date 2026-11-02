import "server-only";
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
