import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse, DEFAULT_POINTS } from "@/lib/course";
import { getBrand, label, on } from "@/lib/platform";
import { Head } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { saveCourse } from "@/app/actions/admin";
import { CATEGORIES, LANGS } from "@/lib/lang";

const PF: [keyof typeof DEFAULT_POINTS, string, string][] = [
  ["att_ontime", "Vaqtida kelsa", "O'quvchi darsga vaqtida belgilansa shuncha ball oladi. Davomatni rag'batlantiradi."],
  ["att_late1", "Kechiksa (1-bosqich)", "Ozgina kechikkanga beriladigan ball yoki jarima (manfiy son — jarima)."],
  ["att_late2", "Kechiksa (2-bosqich)", "Ko'proq kechikkanga. Odatda 1-bosqichdan kattaroq jarima."],
  ["att_absent", "Kelmasa", "Darsga umuman kelmaganga jarima. 0 qo'ysangiz — jarima yo'q."],
  ["late_ok_min", "«Vaqtida» hisoblanadigan daqiqa", "Dars boshlangandan necha daqiqagacha kelgan «vaqtida» hisoblanadi."],
  ["late1_max", "1-bosqich chegarasi (daq)", "Shu daqiqagacha kechikkan — 1-bosqich."],
  ["late2_max", "2-bosqich chegarasi (daq)", "Shu daqiqagacha — 2-bosqich, undan keyin «kelmadi»."],
  ["window_after_min", "Davomat kodi ochiq (daq)", "Dars boshlangach kod yoki QR necha daqiqa ishlaydi."],
];

export default async function Ballar() {
  const u = await requireUser(["admin"]);
  const [c, b] = await Promise.all([currentCourse(u), getBrand(u.platform_id)]);
  if (!c) redirect("/sozlash/kurs");
  const goals = [...c.points.goals].sort((a, z) => a.pts - z.pts);
  return (
    <main className="page">
      <Head title="🎯 Ball tizimi" back="/sozlash" sub={`«${c.title}» kursi uchun. Vazifa ballari har bir vazifaning o'zida belgilanadi.`} />
      <ActionForm action={saveCourse}>
        <div className="card">
          <h2 className="h2">Kurs</h2>
          <label className="field"><span>Kurs nomi</span><input className="input" name="title" defaultValue={c.title} /></label>
          <label className="field"><span>Qisqa tavsif</span><textarea className="input" name="description" defaultValue={c.description} rows={2} /></label>
          <div className="grid2">
            <label className="field"><span>Yo&apos;nalish</span>
              <select className="input" name="category" defaultValue={c.category}>{CATEGORIES.map((x) => <option key={x.key} value={x.key}>{x.emoji} {x.name}</option>)}</select>
            </label>
            <label className="field"><span>Til (til kursi uchun)</span>
              <select className="input" name="lang" defaultValue={c.lang}><option value="">—</option>{LANGS.map((x) => <option key={x.key} value={x.key}>{x.flag} {x.name}</option>)}</select>
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="h2">Mukofot maqsadlari</h2>
          <div className="tiny sub">Har qatorda: <b>ball — mukofot</b>. O&apos;quvchi bosh sahifada keyingi maqsadgacha qancha qolganini ko&apos;radi.
            {on(b, "parvoz") && <> «{label(b, "parvoz")}»da birinchi maqsad — orbita, oxirgisi — Oy.</>}</div>
          <textarea className="input" name="goals" rows={4} defaultValue={goals.map((g) => `${g.pts} — ${g.label}`).join("\n")} placeholder={"800 — 🎓 3 oy qo'shimcha dostup\n1200 — 🏆 Bosh sovrinlar uchun kurash"} />
        </div>

        <div className="card">
          <h2 className="h2">Davomat ballari</h2>
          <div className="tiny sub">Minus ball — jarima. Masalan, kelmasa −20.</div>
          <div className="grid2">
            {PF.map(([k, l, d]) => (
              <label key={k} className="field"><span>{l}</span><input className="input" name={k} type="number" defaultValue={c.points[k] as number} /><span className="tiny muted" style={{ fontWeight: 400 }}>{d}</span></label>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="h2">O&apos;z qoidalaringiz</h2>
          <div className="tiny sub"><b>Bu nima?</b> Istalgan harakat uchun ball qo&apos;shish yoki ayirish. Har qatorda: <b>ball — harakat</b> (jarima uchun minus).
            <br /><b>Yoqsam nima beradi?</b> Kurator o&apos;quvchi sahifasida shu qoidalarni bir bosishda beradi, o&apos;quvchiga darhol xabar boradi.</div>
          <textarea className="input" name="rules" rows={5} defaultValue={c.points.rules.map((r) => `${r.pts > 0 ? "+" : ""}${r.pts} — ${r.label}`).join("\n")} placeholder={"+10 — Darsda faol qatnashdi\n+5 — Guruhda boshqalarga yordam berdi\n-5 — Kamerasiz qatnashdi\n-10 — Darsni bezovta qildi"} />
        </div>
        <Submit>Saqlash</Submit>
      </ActionForm>
    </main>
  );
}
