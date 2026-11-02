import Link from "next/link";
import type { Lesson } from "@/lib/course";
import type { LState } from "@/lib/progress";
import { fmtDate } from "@/lib/util";

const GAP = 84;
const W = 340;

/** Yo'l xaritasi: har dars — tugun. Yashil — yopilgan, sariq — tekshiruvda, ko'k — joriy, qizil — qarz, kulrang — hali ochilmagan. */
export function Roadmap({ lessons, states, here, tz, hrefBase = "/darslar/" }: {
  lessons: Lesson[]; states: LState[]; here: number; tz: string; hrefBase?: string;
}) {
  const pos = (i: number) => [W / 2 + 78 * Math.sin(0.85 * i + 0.5), 46 + GAP * i] as const;
  const H = 46 + GAP * (lessons.length - 1) + 60;
  const path = lessons.map((_, i) => `${i ? "L" : "M"}${pos(i)[0].toFixed(1)} ${pos(i)[1]}`).join(" ");
  const upTo = Math.max(0, here);
  const done = lessons.slice(0, upTo + 1).map((_, i) => `${i ? "L" : "M"}${pos(i)[0].toFixed(1)} ${pos(i)[1]}`).join(" ");
  return (
    <svg className="road" viewBox={`0 0 ${W} ${H}`} width="100%" role="list" aria-label="Yo'l xaritasi">
      <path d={path} className="road-trail" />
      {here >= 0 && <path d={done} className="road-trail on" />}
      {lessons.map((l, i) => {
        const [x, y] = pos(i);
        const st = states[i] ?? "locked";
        const side = x > W / 2 ? -1 : 1;
        const tx = x + side * 40;
        const anchor = side > 0 ? "start" : "end";
        const title = l.title.length > 24 ? l.title.slice(0, 23) + "…" : l.title;
        const glyph = st === "done" ? "✓" : st === "locked" ? "" : String(l.n);
        return (
          <Link key={l.id} href={`${hrefBase}${l.id}`} role="listitem" aria-label={`${l.n}-dars, ${l.title}`}>
            <g className={`rn ${st}${i === here ? " here" : ""}`}>
              {i === here && <circle cx={x} cy={y} r={32} className="rn-ring" />}
              <circle cx={x} cy={y} r={24} className="rn-dot" />
              {st === "locked" ? (
                <path d={`M${x - 6} ${y - 1}h12v9h-12z M${x - 4} ${y - 1}v-3a4 4 0 0 1 8 0v3`} className="rn-lock" />
              ) : (
                <text x={x} y={y + 5} className="rn-g">{glyph}</text>
              )}
              <text x={tx} y={y - 5} textAnchor={anchor} className="rn-l">{l.n}-dars · {fmtDate(l.starts_at, tz)}</text>
              <text x={tx} y={y + 11} textAnchor={anchor} className="rn-t">{title}</text>
              {i === here && <text x={tx} y={y + 27} textAnchor={anchor} className="rn-here">● Siz shu yerdasiz</text>}
            </g>
          </Link>
        );
      })}
    </svg>
  );
}

export function RoadLegend() {
  return (
    <div className="legend">
      <span><i className="lg done" />Yopilgan</span>
      <span><i className="lg review" />Tekshiruvda</span>
      <span><i className="lg current" />Joriy</span>
      <span><i className="lg debt" />Qarz</span>
      <span><i className="lg locked" />Yopiq</span>
    </div>
  );
}
