import { redirect } from "next/navigation";
import { getBrand, label, on } from "@/lib/platform";
import { requireUser } from "@/lib/auth";
import { currentCourse, scopeStudents } from "@/lib/course";
import { studentCtx } from "@/lib/student";
import { flightData } from "@/lib/space";
import { Head } from "@/components/ui";
import { Flight, FlightLegend } from "@/components/Flight";

/** 🚀 Bozorga parvoz: ballar — raketa balandligi. Xodim ?u=<id> bilan o'z o'quvchisinikini ko'radi. */
export default async function Parvoz({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  const b = await getBrand(u.platform_id);
  if (!on(b, "parvoz")) redirect("/");
  let uid = u.id, who = "";
  if (u.role !== "student") {
    const c = await currentCourse(u);
    const s = c && (await scopeStudents(u, c.id)).find((x) => x.id === Number(sp.u));
    if (!s) redirect("/");
    uid = s.id; who = s.name;
  }
  const ctx = await studentCtx(u, uid);
  if (!ctx) redirect("/");
  const F = await flightData(ctx, uid);
  const sat = F.A.filter((a) => a.st === "done").length, given = F.A.filter((a) => a.st !== "locked").length;
  return (
    <main className="page">
      <Head title={`🚀 ${label(b, "parvoz")}`} back={who ? `/oquvchi/${uid}` : "/"} sub={who || undefined} />
      <div className="card">
        <div className="tiny sub">
          Raketa ballaringiz bilan ko&apos;tariladi: <b>{F.orbit.pts}</b> ballda orbitaga chiqasiz ({F.orbit.label}), <b>{F.moon.pts}</b> da Oyga qo&apos;nasiz ({F.moon.label}).
        </div>
        <div className="grid3">
          <div className="stat"><b>{F.pts}</b><span className="tiny muted">ball</span></div>
          <div className="stat"><b>{F.done}/{F.total}</b><span className="tiny muted">vazifa</span></div>
          <div className="stat"><b>{sat}/{given}</b><span className="tiny muted">amaliy</span></div>
        </div>
      </div>
      <Flight F={F} />
      <div className="card">
        <FlightLegend />
        <div className="tiny muted">O&apos;ngdagi yoqilg&apos;i shkalasi — {F.L.length} ta dars, har birida davomat va vazifa kataklari. Sun&apos;iy yo&apos;ldoshlar — amaliy vazifalar.</div>
      </div>
      <div className="card">
        <h2 className="h2">📊 Ballar tarkibi</h2>
        <div className="list">
          {F.parts.map(([t, v]) => (
            <div key={t} className="li"><span className="grow small">{t}</span><b style={{ color: v < 0 ? "var(--red)" : undefined }}>{v > 0 ? "+" : ""}{v}</b></div>
          ))}
          {!F.parts.length && <div className="empty">Hali ball yo&apos;q — birinchi vazifadan boshlang</div>}
          <div className="li"><span className="grow small"><b>Jami</b></span><b>{F.pts}</b></div>
        </div>
      </div>
    </main>
  );
}
