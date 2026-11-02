import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { repeatUsage, taskOpen, taskState } from "@/lib/course";
import { studentCtx } from "@/lib/student";
import { fmtDT, left } from "@/lib/util";
import { Head, RowLink, StateBadge } from "@/components/ui";

export default async function Yuborish() {
  const u = await requireUser();
  if (u.role !== "student") redirect("/");
  const ctx = await studentCtx(u);
  if (!ctx) return <main className="page"><Head title="Yuborish" /><div className="card empty">Kurs topilmadi</div></main>;
  const { tasks, subs, lessons } = ctx;
  const repeat = tasks.filter((t) => t.kind === "repeat" && taskOpen(t));
  const items = tasks
    .filter((t) => t.kind !== "repeat" && taskOpen(t))
    .map((t) => ({ t, s: taskState(t, subs) }))
    .filter((x) => ["todo", "late", "rejected"].includes(x.s))
    .sort((a, b) => +new Date(a.t.due_at ?? 8.64e15) - +new Date(b.t.due_at ?? 8.64e15));
  const ln = (id: number | null) => lessons.find((l) => l.id === id);

  return (
    <main className="page">
      <Head title="Nima yuborasiz?" />
      {repeat.length > 0 && (
        <div className="grid2">
          {repeat.map((t) => {
            const use = repeatUsage(t, subs, u.tz);
            const lim = t.per_day ? `${use.day}/${t.per_day} bugun` : t.per_week ? `${use.week}/${t.per_week} shu hafta` : "";
            return (
              <a key={t.id} href={`/vazifa/${t.id}`} className="card tight">
                <span className="h3">{t.title}</span>
                <span className="tiny muted">{lim}</span>
                <span className="pill ok" style={{ alignSelf: "flex-start" }}>+{t.max_points}</span>
              </a>
            );
          })}
        </div>
      )}
      <div className="card">
        <h2 className="h2">Topshiriladigan vazifalar</h2>
        <div className="list">
          {items.map(({ t, s }) => (
            <RowLink key={t.id} href={`/vazifa/${t.id}`}>
              <div className="grow">
                <div className="h3 trunc">{t.title}</div>
                <div className="tiny muted">
                  {ln(t.lesson_id) ? `${ln(t.lesson_id)!.n}-dars · ` : ""}{t.due_at ? `${fmtDT(t.due_at, u.tz)} · ${left(t.due_at)}` : "Muddatsiz"}
                </div>
              </div>
              <StateBadge s={s} />
            </RowLink>
          ))}
          {!items.length && <div className="empty">Hozircha topshiriladigan vazifa yo&apos;q 🎉</div>}
        </div>
      </div>
    </main>
  );
}
