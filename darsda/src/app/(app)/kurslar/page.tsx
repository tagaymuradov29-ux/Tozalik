import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { myCourses } from "@/lib/accounts";
import { catOf, langOf } from "@/lib/lang";
import { CourseTile, Head } from "@/components/ui";
import { abbr } from "@/components/LoginScreen";
import { switchMyCourse } from "@/app/actions/auth";
import { switchCourse } from "@/app/actions/admin";

/** «Qaysi kursga kirmoqchisiz?» — o'quvchi o'z kurslari, xodim esa platformadagi kurslar orasida o'tadi */
export default async function Kurslar() {
  const u = await requireUser();
  const isStudent = u.role === "student";
  const list = isStudent
    ? (await myCourses(u)).map((c) => ({ key: c.id, course: c.course, sub: c.group_name, lang: c.lang, category: c.category, current: c.current, action: switchMyCourse, value: c.id }))
    : await (async () => {
        const cur = await currentCourse(u);
        const rows = await sql<{ id: number; title: string; lang: string; category: string; groups: number; students: number }[]>`
          select c.id, c.title, c.lang, c.category,
            (select count(*)::int from groups g where g.course_id = c.id and (${u.role === "admin"} or g.curator_id = ${u.id})) as groups,
            (select count(*)::int from users s join groups g on g.id = s.group_id where g.course_id = c.id and s.role = 'student' and s.active) as students
          from courses c where c.platform_id = ${u.platform_id} order by c.id desc`;
        return rows.filter((r) => u.role === "admin" || r.groups > 0)
          .map((r) => ({ key: r.id, course: r.title, sub: `${r.students} ta o'quvchi`, lang: r.lang, category: r.category, current: r.id === cur?.id, action: switchCourse, value: r.id }));
      })();
  return (
    <main className="page">
      <Head title="Qaysi kursga kirmoqchisiz?" back="/" sub={list.length > 1 ? `${list.length} ta kurs` : undefined} />
      {list.map((c, i) => {
        const L = langOf(c.lang), C = catOf(c.category);
        return (
          <form key={c.key} action={c.action}>
            <input type="hidden" name="id" value={c.value} />
            <button className="pickbtn">
              <CourseTile i={i} current={c.current} code={L ? L.key.toUpperCase() : abbr(c.course)} title={c.course}
                sub={`${C.name}${c.sub ? ` · ${c.sub}` : ""}`} role={c.current ? "Hozir" : undefined} />
            </button>
          </form>
        );
      })}
      <p className="sub small" style={{ textAlign: "center" }}>Keyin profil orqali boshqa kursga o&apos;tishingiz mumkin.</p>
      {!list.length && <div className="card empty">Hali kurs yo&apos;q</div>}
    </main>
  );
}
