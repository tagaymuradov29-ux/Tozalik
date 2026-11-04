import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { getBrand, MODS, on } from "@/lib/platform";
import { FONTS, journey } from "@/lib/journeys";
import { Head, Progress } from "@/components/ui";
import { CopyLink } from "@/components/Copy";

/** ⚙️ Konstruktor: platformani sotib olgan kurs egasi hammasini shu yerdan o'ziga moslaydi */
export default async function Sozlash() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  const [b, c] = await Promise.all([getBrand(u.platform_id), currentCourse(u)]);
  if (!b) redirect("/");
  const [s] = await sql<{ words: number; lessons: number; tasks: number; groups: number; curated: number; students: number; invites: number; courses: number }[]>`
    select
      (select count(*)::int from vocab where course_id = ${c?.id ?? 0}) as words,
      (select count(*)::int from lessons where course_id = ${c?.id ?? 0}) as lessons,
      (select count(*)::int from tasks where course_id = ${c?.id ?? 0}) as tasks,
      (select count(*)::int from groups where course_id = ${c?.id ?? 0}) as groups,
      (select count(*)::int from groups where course_id = ${c?.id ?? 0} and curator_id is not null) as curated,
      (select count(*)::int from users u join groups g on g.id = u.group_id where g.course_id = ${c?.id ?? 0} and u.role = 'student') as students,
      (select count(*)::int from invites where platform_id = ${b.id} and active) as invites,
      (select count(*)::int from courses where platform_id = ${b.id}) as courses`;
  const goals = c?.points.goals.length ?? 0;
  const mods = MODS.filter((m) => on(b, m.key)).length;
  const steps = [
    { href: "/sozlash/brend", emoji: "🏷️", t: "Brend", d: "Nom, logo va o'quvchilar kiradigan havola", ok: !!b.settings.logo || b.name.length > 1 },
    { href: "/sozlash/dizayn", emoji: "🎨", t: "Dizayn", d: `Rang, shrift (${FONTS.find((f) => f.key === (b.settings.font ?? ""))?.name ?? "Standart"}) va animatsiya: ${journey(b.settings.journey).title}`, ok: !!(b.settings.journey || b.settings.font) || b.color.toLowerCase() !== "#0b5d46" },
    { href: "/sozlash/kurs", emoji: "📚", t: "Kurs tuzilmasi", d: c ? `«${c.title}» · ${s.courses} ta kurs` : "Kurs yarating: jadval, namuna yoki nusxa", ok: !!c },
    ...(c?.category === "til" ? [{ href: "/til/sozlar", emoji: "📚", t: "Til paketi: lug'at", d: `${s.words} ta so'z — darslarga biriktiring, talaffuz va kartochkalar shundan tuziladi`, ok: s.words > 0 }] : []),
    { href: "/darslar", emoji: "🎬", t: "Darslar va vazifalar", d: `${s.lessons} ta dars · ${s.tasks} ta vazifa — mavzu, video, material, muddat`, ok: s.lessons > 0 && s.tasks > 0 },
    { href: "/sozlash/ballar", emoji: "🎯", t: "Ball tizimi va maqsadlar", d: goals ? `${goals} ta maqsad · davomat ballari` : "Davomat ballari, mukofot maqsadlari", ok: goals > 0 },
    { href: "/sozlash/modullar", emoji: "🧩", t: "Modullar", d: `${mods}/${MODS.length} ta yoqilgan — keraklisini qoldiring, nomini o'zgartiring`, ok: true },
    { href: "/guruh", emoji: "👥", t: "Guruhlar va kuratorlar", d: `${s.groups} ta guruh · ${s.curated} tasida kurator`, ok: s.groups > 0 && s.curated > 0 },
    { href: "/guruh", emoji: "🔗", t: "O'quvchilarni taklif qilish", d: `${s.students} ta o'quvchi · ${s.invites} ta faol taklif havolasi`, ok: s.students > 0 },
  ];
  const done = steps.filter((x) => x.ok).length;

  return (
    <main className="page">
      <Head title="⚙️ Platformani sozlash" back="/" sub="Platformangizni o'z kursingizga moslang — qadamma-qadam" />

      <div className="card">
        <div className="row between">
          <span className="h3">Tayyorlik</span>
          <b>{done}/{steps.length}</b>
        </div>
        <Progress value={(done / steps.length) * 100} />
        <div className="tiny sub">{done === steps.length ? "Hammasi tayyor — o'quvchilarni taklif qilishingiz mumkin 🎉" : "Yashil belgisi yo'q qadamlarni to'ldiring"}</div>
      </div>

      <div className="card">
        <div className="list">
          {steps.map((x, i) => (
            <Link key={i} href={x.href} className="li">
              <span className={`num ${x.ok ? "ok" : ""}`}>{x.ok ? "✓" : i + 1}</span>
              <div className="grow">
                <div className="h3">{x.emoji} {x.t}</div>
                <div className="tiny muted">{x.d}</div>
              </div>
              <span className="muted">›</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="h2">O&apos;quvchilaringiz uchun kirish havolasi</h2>
        <div className="tiny sub">Shu havolada sizning logongiz, nomingiz va rangingiz chiqadi.</div>
        <div className="row between" style={{ gap: 8 }}>
          <code className="small trunc" style={{ color: "var(--brand-ink)" }}>…/k/{b.slug}</code>
          <CopyLink path={`/k/${b.slug}`} label={b.name} />
        </div>
      </div>
    </main>
  );
}
