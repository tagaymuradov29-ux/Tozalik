import Link from "next/link";
import type { User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { timeline, type Course } from "@/lib/course";
import { dayKey, fmtDate, WD_SHORT, weekdayMon } from "@/lib/util";

/** Ball grafigi: haftalik (kunlar), oylik (haftalar), kurs bo'yicha (oylar) */
export async function PointsCard({ u, course, uid, p, base }: { u: User; course: Course; uid: number; p?: string; base: string }) {
  const ev = await timeline(course, uid);
  const mode = p === "oy" ? "oy" : p === "kurs" ? "kurs" : "hafta";
  const now = new Date();
  const today = dayKey(now, u.tz);
  type B = { label: string; pts: number; on: boolean };
  let bars: B[] = [];
  if (mode === "hafta") {
    const mon = new Date(now.getTime() - weekdayMon(now, u.tz) * 86400000);
    bars = WD_SHORT.map((label, i) => {
      const k = dayKey(new Date(mon.getTime() + i * 86400000), u.tz);
      return { label, pts: ev.filter((e) => dayKey(e.at, u.tz) === k).reduce((s, e) => s + e.pts, 0), on: k === today };
    });
  } else if (mode === "oy") {
    const mon = new Date(now.getTime() - weekdayMon(now, u.tz) * 86400000);
    bars = [4, 3, 2, 1, 0].map((w) => {
      const from = dayKey(new Date(mon.getTime() - w * 7 * 86400000), u.tz);
      const to = dayKey(new Date(mon.getTime() - (w - 1) * 7 * 86400000), u.tz);
      return {
        label: w === 0 ? "Shu" : fmtDate(new Date(mon.getTime() - w * 7 * 86400000), u.tz).replace(/-.*/, "") + "",
        pts: ev.filter((e) => { const k = dayKey(e.at, u.tz); return k >= from && k < to; }).reduce((s, e) => s + e.pts, 0),
        on: w === 0,
      };
    });
  } else {
    const months = new Map<string, number>();
    for (const e of ev) { const k = dayKey(e.at, u.tz).slice(0, 7); months.set(k, (months.get(k) ?? 0) + e.pts); }
    const M = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
    bars = [...months.entries()].map(([k, pts]) => ({ label: M[Number(k.slice(5)) - 1], pts, on: k === today.slice(0, 7) }));
    if (!bars.length) bars = [{ label: M[Number(today.slice(5, 7)) - 1], pts: 0, on: true }];
  }
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.pts)));
  const total = ev.reduce((s, e) => s + e.pts, 0);
  const cat = (k: string) => ev.filter((e) => e.kind === k).reduce((s, e) => s + e.pts, 0);
  const avg = bars.length ? Math.round(bars.reduce((s, b) => s + b.pts, 0) / bars.length) : 0;
  const unit = mode === "hafta" ? "kuniga" : mode === "oy" ? "haftasiga" : "oyiga";
  const [vp] = await sql<{ n: number }[]>`select count(*)::int as n from video_progress v join lessons l on l.id = v.lesson_id
    where v.user_id = ${uid} and l.course_id = ${course.id} and (v.done or v.max_pos > 60)`;
  const recent = [...ev].reverse().slice(0, 6);

  return (
    <>
      <div className="card">
        <div>
          <h2 className="h2">Ballar</h2>
          <div className="sub small">O&apos;rtacha {avg} ball {unit} · jami {total}</div>
        </div>
        <div className="seg">
          {[["hafta", "Haftalik"], ["oy", "Oylik"], ["kurs", "Umumiy"]].map(([k, t]) => (
            <Link key={k} href={`${base}${base.includes("?") ? "&" : "?"}p=${k}`} className={mode === k ? "on" : ""} scroll={false}>{t}</Link>
          ))}
        </div>
        <div className="chart">
          {bars.map((b, i) => (
            <div className="col" key={i}>
              {b.pts !== 0 && <span className="tiny" style={{ fontWeight: 600, color: b.on ? "var(--brand)" : "var(--ink-3)" }}>{b.pts}</span>}
              <div className={`bar ${b.on ? "on" : ""}`} style={{ height: `${(Math.abs(b.pts) / max) * 78}%`, opacity: b.pts < 0 ? 0.5 : 1 }} />
              <span className="lbl">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid2">
        <div className="stat"><span className="tiny muted">Vazifalar</span><b>{cat("task")}</b></div>
        <div className="stat"><span className="tiny muted">Davomat</span><b>{cat("att")}</b></div>
        <div className="stat"><span className="tiny muted">Bonus</span><b>{cat("bonus")}</b></div>
        <div className="stat"><span className="tiny muted">Ko&apos;rilgan darslar</span><b>{vp.n}</b></div>
      </div>
      {recent.length > 0 && (
        <div className="card">
          <h2 className="h2">Oxirgi ballar</h2>
          <div className="list">
            {recent.map((e, i) => (
              <div key={i} className="li">
                <div className="grow"><div className="small trunc">{e.title}</div><div className="tiny muted">{fmtDate(e.at, u.tz)}</div></div>
                <b style={{ color: e.pts < 0 ? "var(--red)" : "var(--brand)" }}>{e.pts > 0 ? "+" : ""}{e.pts}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

