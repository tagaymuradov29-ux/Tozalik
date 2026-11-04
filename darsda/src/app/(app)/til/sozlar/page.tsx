import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse, getLessons } from "@/lib/course";
import { wordsFor } from "@/lib/til";
import { langOf, STARTER } from "@/lib/lang";
import { Head } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { addStarter, addWords, deleteWord } from "@/app/actions/til";

export default async function Sozlar({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const lid = Number((await searchParams).l || 0);
  const u = await requireUser(["admin"]);
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  const [lessons, ws] = await Promise.all([getLessons(c.id), wordsFor(c.id, 0, 0, false)]);
  const groups = [{ id: 0, name: "Umumiy (darsga bog'lanmagan)" }, ...lessons.map((l) => ({ id: l.id, name: `${l.n}-dars. ${l.title}` }))];
  return (
    <main className="page">
      <Head title="📚 Lug'at" back="/til" sub={`${L?.flag ?? ""} ${L?.name ?? ""} · ${ws.length} ta so'z. Har darsga so'z biriktirsangiz, dars ochilganda o'quvchiga chiqadi.`} />
      <div className="card">
        <h2 className="h2">So&apos;z qo&apos;shish</h2>
        <ActionForm action={addWords} reset>
          <label className="field"><span>Qaysi darsga</span>
            <select className="input" name="lesson_id" defaultValue={lid || ""}>{groups.map((g) => <option key={g.id} value={g.id || ""}>{g.name}</option>)}</select>
          </label>
          <label className="field">
            <span>Har qatorda bitta so&apos;z: <b>so&apos;z — tarjima — o&apos;qilishi — misol</b> (oxirgi ikkisi ixtiyoriy)</span>
            <textarea className="input" name="lines" rows={6} dir="auto" placeholder={(STARTER[c.lang] ?? STARTER.en).slice(0, 3).map(([w, t, r]) => `${w} — ${t} — ${r}`).join("\n")} />
          </label>
          <Submit>Qo&apos;shish</Submit>
        </ActionForm>
        {!ws.length && STARTER[c.lang] && (
          <form action={addStarter}><button className="btn soft full">✨ 20 ta boshlang&apos;ich so&apos;zni qo&apos;shish (namuna)</button></form>
        )}
      </div>
      {groups.map((g) => {
        const list = ws.filter((w) => (w.lesson_id ?? 0) === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id} className="card">
            <div className="row between"><h2 className="h2 trunc">{g.name}</h2><span className="pill">{list.length}</span></div>
            <div className="list">
              {list.map((w) => (
                <div key={w.id} className="li">
                  <div className="grow">
                    <div dir={L?.rtl ? "rtl" : undefined} style={{ fontWeight: 700, fontSize: L?.rtl ? 20 : 15, textAlign: L?.rtl ? "right" : undefined }}>{w.word}</div>
                    <div className="tiny muted">{w.translit ? `${w.translit} · ` : ""}{w.tr}</div>
                  </div>
                  <form action={deleteWord}><input type="hidden" name="id" value={w.id} /><Submit className="btn sm ghost" confirm="So'z o'chirilsinmi?">✕</Submit></form>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}
