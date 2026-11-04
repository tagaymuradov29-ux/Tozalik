import type { Lesson } from "@/lib/course";
import type { LState } from "@/lib/progress";
import { fmtDate } from "@/lib/util";
import { roadSvg } from "@/lib/roadmapSvg";

/** Jonli yo'l xaritasi: tabiat manzarasida ilon yo'li, raqamli bekatlar. Manzara — platforma «Dizayn»ida tanlanadi. */
export function Roadmap({ lessons, states, here, tz, hrefBase = "/darslar/", theme }: {
  lessons: Lesson[]; states: LState[]; here: number; tz: string; hrefBase?: string; theme?: string;
}) {
  const svg = roadSvg({
    lessons: lessons.map((l) => ({ id: l.id, n: l.n, title: l.title, date: fmtDate(l.starts_at, tz) })),
    states, here, theme, hrefBase,
  });
  return <div className="nroad-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
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
