import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse, scopeStudents } from "@/lib/course";
import { classStats, stats, wordsFor } from "@/lib/til";
import { langOf } from "@/lib/lang";
import { Avatar, Head, Progress } from "@/components/ui";

/** 🗣️ Til paketi: lug'at, talaffuz, alifbo, AI suhbat */
export default async function Til() {
  const u = await requireUser();
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  const title = `${L?.flag ?? "🗣️"} ${L?.name ?? "Til"}`;

  if (u.role !== "student") {
    const [ws, st] = await Promise.all([wordsFor(c.id, 0, 0, false), scopeStudents(u, c.id)]);
    const cs = await classStats(c.id, st.map((s) => s.id));
    return (
      <main className="page">
        <Head title={title} back="/" sub="Til paketi: o'quvchilar lug'ati va talaffuzi" />
        <div className="grid2">
          <div className="stat"><span className="tiny muted">Lug&apos;atda</span><b>{ws.length} ta so&apos;z</b></div>
          <div className="stat"><span className="tiny muted">O&apos;quvchilar</span><b>{st.length}</b></div>
        </div>
        {u.role === "admin" && <Link href="/til/sozlar" className="btn full">📚 So&apos;zlarni boshqarish</Link>}
        {c.lang === "ar" && <Link href="/til/alifbo" className="btn soft full">🔤 Arab alifbosi</Link>}
        <div className="card">
          <h2 className="h2">O&apos;quvchilar natijasi</h2>
          <div className="list">
            {st.map((s) => ({ ...s, r: cs.find((x) => x.user_id === s.id) })).sort((a, b) => (b.r?.learned ?? 0) - (a.r?.learned ?? 0)).map((s) => (
              <Link key={s.id} href={`/oquvchi/${s.id}`} className="li">
                <Avatar name={s.name} size={32} />
                <div className="grow">
                  <div className="small trunc" style={{ fontWeight: 600 }}>{s.name}</div>
                  <Progress value={ws.length ? ((s.r?.learned ?? 0) / ws.length) * 100 : 0} />
                </div>
                <div className="stack" style={{ gap: 0, alignItems: "flex-end" }}>
                  <b className="small">{s.r?.learned ?? 0}/{ws.length}</b>
                  <span className="tiny muted">{s.r?.pron != null ? `🎙 ${s.r.pron}` : "—"}</span>
                </div>
              </Link>
            ))}
            {!st.length && <div className="empty">O&apos;quvchi yo&apos;q</div>}
          </div>
        </div>
      </main>
    );
  }

  const ws = await wordsFor(c.id, u.id);
  const S = stats(ws);
  const today = S.due + Math.min(S.fresh, 10);
  return (
    <main className="page">
      <Head title={title} back="/" sub={c.title} />
      <div className="card">
        <div className="row between">
          <div className="stack" style={{ gap: 0 }}><span className="tiny muted">Yodlangan so&apos;zlar</span><span className="big">{S.learned}<span className="muted" style={{ fontSize: 18 }}> / {S.total}</span></span></div>
          {S.pron != null && <div className="stack" style={{ gap: 0, alignItems: "flex-end" }}><span className="tiny muted">Talaffuz</span><b style={{ fontSize: 20 }}>{S.pron}/100</b></div>}
        </div>
        <Progress value={S.total ? (S.learned / S.total) * 100 : 0} />
      </div>

      <Link href="/til/mashq" className="card row" style={{ gap: 12, background: today ? "var(--brand-soft)" : undefined }}>
        <span style={{ fontSize: 28 }}>🃏</span>
        <div className="grow"><div className="h3">So&apos;z kartochkalari</div><div className="tiny muted">{today ? `Bugun ${today} ta so'z: ${S.due} takrorlash, ${Math.min(S.fresh, 10)} yangi` : "Bugungi mashq bajarildi ✓"}</div></div>
        <span className="muted">›</span>
      </Link>
      <Link href="/til/mashq?m=bilmagan" className="card row" style={{ gap: 12 }}>
        <span style={{ fontSize: 28 }}>🔁</span>
        <div className="grow"><div className="h3">Bilmagan so&apos;zlarim</div><div className="tiny muted">{S.unknown ? `${S.unknown} ta so'z — qayta takrorlang` : "Hozircha yo'q — «Bilmadim» desangiz shu yerga tushadi"}</div></div>
        <span className={`pill ${S.unknown ? "bad" : ""}`}>{S.unknown}</span>
      </Link>
      <Link href="/til/talaffuz" className="card row" style={{ gap: 12 }}>
        <span style={{ fontSize: 28 }}>🎙</span>
        <div className="grow"><div className="h3">Talaffuz</div><div className="tiny muted">Eshiting, ayting — telefon tekshiradi va ball qo&apos;yadi</div></div>
        <span className="muted">›</span>
      </Link>
      {c.lang === "ar" && (
        <Link href="/til/alifbo" className="card row" style={{ gap: 12 }}>
          <span style={{ fontSize: 28 }}>🔤</span>
          <div className="grow"><div className="h3">Arab alifbosi</div><div className="tiny muted">28 harf, shakllari, maxraji va harakatlar</div></div>
          <span className="muted">›</span>
        </Link>
      )}
      <Link href="/til/suhbat" className="card row" style={{ gap: 12, background: "linear-gradient(135deg, var(--brand-soft), var(--card))" }}>
        <span style={{ fontSize: 28 }}>🤖</span>
        <div className="grow"><div className="h3">AI bilan suhbat</div><div className="tiny muted">Robot o&apos;qituvchi bilan razgovor: tanishuv, kafe, aeroport</div></div>
        <span className="muted">›</span>
      </Link>
    </main>
  );
}
