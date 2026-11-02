"use client";
import { useEffect, useRef, useState } from "react";
import type { FlightData } from "@/lib/space";
import { skH } from "./Sky";

export const FLC = ["#FFC93C", "#4FC3F7", "#4CD08A", "#B48CFF"];
const FLN = ["Davomat", "Konspekt", "Workbook", "Vazifa"];
const HINT = "👆 Yoqilg'i katagini, yo'ldoshni yoki raketani bosing";
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

let SEEN = false;

/** «Bozorga parvoz»: raketa ballar bilan ko'tariladi. Orbita — birinchi maqsad, Oy — oxirgi maqsad.
 *  O'ngda yoqilg'i shkalasi (har dars — bir qator kataklar), chapda yo'ldoshlar — amaliy vazifalar. */
export function Flight({ F }: { F: FlightData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState(HINT);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const anim = !SEEN && !reduce;
    SEEN = true;
    const d = devicePixelRatio || 1, r = cv.getBoundingClientRect(), W = r.width, H = r.height;
    cv.width = W * d; cv.height = H * d;
    const c = cv.getContext("2d")!;
    c.setTransform(d, 0, 0, d, 0, 0);
    const ST = Array.from({ length: 90 }, (_, i) => ({ x: skH(i, "fx"), y: skH(i, "fy") * 0.45, r: skH(i, "fr") * 1.1 + 0.2, p: skH(i, "fp") * 6 }));
    const t0 = performance.now();
    type Hit = { x: number; y: number; r: number; l?: FlightData["L"][number]; a?: FlightData["A"][number]; rk?: 1 };
    let hits: Hit[] = [];
    const O = F.orbit.pts, M = F.moon.pts, pts = F.pts;
    const y0 = H * 0.9, yo = H * 0.36, ym = H * 0.13;
    const altY = (p: number) => (p <= O ? y0 - (Math.max(p, 0) / O) * (y0 - yo) : yo - ((Math.min(p, M) - O) / Math.max(1, M - O)) * (yo - ym));
    const txt = (s: string, x: number, y: number, f: string, col: string, al: CanvasTextAlign = "left") => { c.font = f + " Inter,system-ui,sans-serif"; c.fillStyle = col; c.textAlign = al; c.fillText(s, x, y); };
    const rr = (x: number, y: number, w: number, h: number, q: number) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, q); else c.rect(x, y, w, h); };
    const col = (s: string, k: number) => (s === "done" ? FLC[k] : s === "debt" ? "#E0463E" : s === "review" ? "rgba(160,175,200,.55)" : s === "na" ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.14)");
    const ICO: Record<string, string> = { done: "✅", debt: "❌", review: "⏳", todo: "▫️", na: "➖" };
    const tipL = (l: FlightData["L"][number]) => `<b>${l.n}-dars · ${esc(l.t)}</b><br>` + (l.fut ? "Hali o'tilmagan" : l.cells.length ? l.cells.map((x) => `${ICO[x.st]} ${esc(x.label)}`).join(" · ") : "Bu darsda vazifa yo'q")
      + (l.cells.some((x) => x.st === "debt") ? `<br><span style="color:#E0463E">Qarzni topshirsangiz, raketa yuqoriroq ko'tariladi</span>` : "");
    const tipA = (x: FlightData["A"][number]) => `<b>Amaliy №${x.k} · ${esc(x.t)}</b><br>${{ done: "✅ Qabul qilindi", review: "⏳ Tekshiruvda", debt: "❌ Topshirilmagan", todo: "🕒 Muddat hali bor — topshiring", locked: "🔒 Hali berilmagan" }[x.st]}`;
    cv.onclick = (e) => {
      const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
      let best: Hit | null = null, bd = 1e9;
      hits.forEach((h) => { const q = Math.hypot(h.x - mx, h.y - my); if (q <= h.r && q < bd) { bd = q; best = h; } });
      const h = best as Hit | null;
      setTip(!h ? HINT : h.l ? tipL(h.l) : h.a ? tipA(h.a)
        : `<b>Raketangiz · ${pts} ball</b><br>${pts < O ? `Orbitagacha (${esc(F.orbit.label)}) yana <b>${O - pts}</b> ball` : pts < M ? `Orbitadasiz! Oygacha (${esc(F.moon.label)}) yana <b>${M - pts}</b> ball` : "Oydasiz! 🏆"}`);
    };
    let raf = 0;
    const frame = (now: number) => {
      const t = reduce ? 0 : now;
      hits = [];
      const g = c.createLinearGradient(0, 0, 0, H);
      ["#060A1C", "#14214A", "#2F5E9E", "#7FB7E6", "#CDEBFA"].forEach((s, i) => g.addColorStop(i / 4, s));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      ST.forEach((s) => { c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + s.p)); c.fillStyle = "#fff"; c.fillRect(s.x * W, s.y * H, s.r, s.r); });
      c.globalAlpha = 1;
      // Oy
      c.fillStyle = "#F2EFD9"; c.beginPath(); c.arc(W * 0.42, ym - 4, 15, 0, 7); c.fill();
      c.fillStyle = "#D9D4B8"; c.beginPath(); c.arc(W * 0.42 - 4, ym - 7, 3.5, 0, 7); c.arc(W * 0.42 + 5, ym, 2.5, 0, 7); c.fill();
      const c1 = Math.round(O / 3), c2 = Math.round((O * 2) / 3);
      ([[y0, "YER · 0"], [altY(c1), `BULUTLAR · ${c1}`], [altY(c2), `STRATOSFERA · ${c2}`], [yo, `ORBITA · ${O}`], [ym, `OY · ${M}`]] as [number, string][]).forEach(([y, s], i) => {
        c.strokeStyle = "rgba(255,255,255,.18)"; c.setLineDash([2, 5]); c.beginPath(); c.moveTo(10, y); c.lineTo(W - 50, y); c.stroke(); c.setLineDash([]);
        txt(s, 12, y - 4, "700 9px", i >= 3 ? "#FFE6A0" : "rgba(255,255,255,.6)");
      });
      // Bulutlar
      c.fillStyle = "rgba(255,255,255,.8)";
      for (let i = 0; i < 4; i++) { const x = ((i * 0.31 + t / 40000) % 1.2 - 0.1) * W, y = altY(c1) + 14 + (i % 2) * 14; c.beginPath(); c.ellipse(x, y, 24, 7, 0, 0, 7); c.ellipse(x + 15, y - 5, 15, 7, 0, 0, 7); c.fill(); }
      // Yoqilg'i shkalasi
      const top = H * 0.08, bot = H * 0.96, n = Math.max(1, F.L.length), ch = (bot - top) / n, gx = W - 36;
      txt("YOQILG'I", gx + 13, top - 4, "800 8.5px", "rgba(255,255,255,.75)", "center");
      F.L.forEach((l, i) => {
        const y = bot - (i + 1) * ch;
        const cells = l.fut ? [0, 1, 2, 3].map(() => null) : l.cells;
        const w = Math.min(5.2, 26 / Math.max(1, cells.length) - 1.3);
        cells.forEach((s, k) => { c.fillStyle = s ? col(s.st, s.k) : "rgba(255,255,255,.14)"; rr(gx + k * (w + 1.3), y + 1, w, Math.max(1, ch - 2), 1.5); c.fill(); });
        hits.push({ x: gx + 13, y: y + ch / 2, r: Math.max(10, ch), l });
      });
      // Raketa
      const k = anim ? Math.min(1, (now - t0) / 1800) : 1, e = 1 - Math.pow(1 - k, 3);
      const ry = y0 - (y0 - altY(pts)) * e, rx = W * 0.55 + (reduce ? 0 : Math.sin(t / 900) * 4);
      // Yo'ldoshlar — amaliy vazifalar
      const span = Math.max(1, F.A.length);
      F.A.forEach((x, j) => {
        if (x.st === "locked") return;
        const y = Math.min(y0 - 20, Math.max(ym + 20, altY((O * (j + 0.6)) / (span * 0.75)))), sx = W * (0.24 + (j % 2) * 0.13) + (reduce ? 0 : Math.sin(t / 1500 + j) * 5);
        c.save(); c.translate(sx, y); c.rotate(reduce ? 0 : Math.sin(t / 2000 + j) * 0.3); c.globalAlpha = x.st === "done" ? 1 : 0.55;
        c.fillStyle = x.st === "done" ? "#3390EC" : x.st === "debt" ? "#E0463E" : "#8B97AE"; c.fillRect(-15, -4, 10, 8); c.fillRect(5, -4, 10, 8);
        c.fillStyle = x.st === "done" ? "#FFD86B" : "#AAB"; c.fillRect(-5, -6, 10, 12); c.restore();
        txt("A" + x.k, sx + 21, y + 4, "700 9px", x.st === "done" ? "#FFE6A0" : "rgba(255,255,255,.6)", "center");
        hits.push({ x: sx, y, r: 17, a: x });
      });
      c.setLineDash([3, 6]); c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = 2; c.beginPath(); c.moveTo(rx, H); c.lineTo(rx, ry + 34); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
      const fl = 18 + (reduce ? 0 : Math.sin(t / 50) * 5) + (k < 1 ? 14 : 0), fg = c.createLinearGradient(0, ry + 18, 0, ry + 18 + fl);
      fg.addColorStop(0, "#FFE07A"); fg.addColorStop(1, "rgba(255,90,40,0)"); c.fillStyle = fg;
      c.beginPath(); c.moveTo(rx - 7, ry + 18); c.lineTo(rx, ry + 18 + fl); c.lineTo(rx + 7, ry + 18); c.fill();
      c.fillStyle = "#E0463E"; c.beginPath(); c.moveTo(rx - 9, ry + 8); c.lineTo(rx - 16, ry + 22); c.lineTo(rx - 8, ry + 18); c.moveTo(rx + 9, ry + 8); c.lineTo(rx + 16, ry + 22); c.lineTo(rx + 8, ry + 18); c.fill();
      c.fillStyle = "#F6F8FB"; c.beginPath(); c.moveTo(rx, ry - 30); c.quadraticCurveTo(rx + 11, ry - 14, rx + 9, ry + 18); c.lineTo(rx - 9, ry + 18); c.quadraticCurveTo(rx - 11, ry - 14, rx, ry - 30); c.fill();
      c.fillStyle = "#E0463E"; c.beginPath(); c.moveTo(rx, ry - 30); c.quadraticCurveTo(rx + 6, ry - 22, rx + 7.5, ry - 17); c.lineTo(rx - 7.5, ry - 17); c.quadraticCurveTo(rx - 6, ry - 22, rx, ry - 30); c.fill();
      c.fillStyle = "#3390EC"; c.beginPath(); c.arc(rx, ry - 4, 4.5, 0, 7); c.fill();
      c.fillStyle = "rgba(11,20,48,.75)"; rr(rx + 15, ry - 17, 72, 22, 8); c.fill();
      txt(Math.round(pts * e) + " ball", rx + 51, ry - 2, "800 12px", "#fff", "center");
      hits.push({ x: rx, y: ry, r: 28, rk: 1 });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [F]);
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <canvas ref={ref} style={{ width: "100%", aspectRatio: "1 / 1.25", display: "block", cursor: "pointer" }} aria-label="Bozorga parvoz" />
      <div className="small" style={{ padding: "10px 14px", minHeight: 58 }} dangerouslySetInnerHTML={{ __html: tip }} />
    </div>
  );
}

export function FlightLegend() {
  return (
    <div className="legend">
      {FLN.map((t, k) => <span key={t}><i className="lg" style={{ background: FLC[k], borderColor: FLC[k] }} />{t}</span>)}
      <span><i className="lg" style={{ background: "#E0463E", borderColor: "#E0463E" }} />Qarz</span>
      <span><i className="lg" style={{ background: "#8B97AE", borderColor: "#8B97AE" }} />Tekshiruvda</span>
    </div>
  );
}
