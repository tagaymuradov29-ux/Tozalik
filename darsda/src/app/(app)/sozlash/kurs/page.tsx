import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { Head } from "@/components/ui";
import { Submit } from "@/components/Form";
import { CourseWizard } from "@/components/CourseWizard";
import { switchCourse } from "@/app/actions/admin";
import { deleteCourse } from "@/app/actions/build";
import { utcToLocalInput } from "@/lib/util";

export default async function Kurslar() {
  const u = await requireUser(["admin"]);
  const cur = await currentCourse(u);
  const courses = await sql<{ id: number; title: string; lessons: number; students: number; first: Date | null }[]>`
    select c.id, c.title,
      (select count(*)::int from lessons l where l.course_id = c.id) as lessons,
      (select count(*)::int from users s join groups g on g.id = s.group_id where g.course_id = c.id and s.role = 'student') as students,
      (select min(starts_at) from lessons l where l.course_id = c.id) as first
    from courses c where c.platform_id = ${u.platform_id} order by c.id desc`;
  const today = utcToLocalInput(new Date(Date.now() + 7 * 86400000), u.tz).slice(0, 10);
  return (
    <main className="page">
      <Head title="📚 Kurslar" back="/sozlash" sub="Bir platformada bir nechta kurs yoki oqim bo'lishi mumkin" />
      <div className="card">
        <div className="list">
          {courses.map((c) => (
            <div key={c.id} className="li">
              <div className="grow">
                <div className="h3">{c.title} {c.id === cur?.id && <span className="pill ok">tanlangan</span>}</div>
                <div className="tiny muted">{c.lessons} ta dars · {c.students} ta o&apos;quvchi{c.first ? ` · ${new Date(c.first).toLocaleDateString("uz-UZ", { timeZone: u.tz })} dan` : ""}</div>
              </div>
              {c.id !== cur?.id && (
                <form action={switchCourse}><input type="hidden" name="id" value={c.id} /><button className="btn sm soft">Tanlash</button></form>
              )}
              {courses.length > 1 && c.students === 0 && (
                <form action={deleteCourse}><input type="hidden" name="id" value={c.id} />
                  <Submit className="btn sm ghost" confirm={`«${c.title}» kursi, darslari va vazifalari o'chiriladi. Davom etasizmi?`}>✕</Submit>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="h2">Yangi kurs yoki oqim</h2>
        <CourseWizard courses={courses.map((c) => ({ id: c.id, title: c.title }))} today={today} />
      </div>
    </main>
  );
}
