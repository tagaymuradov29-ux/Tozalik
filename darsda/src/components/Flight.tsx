"use client";
import { useEffect, useRef, useState } from "react";
import type { FlightData } from "@/lib/space";
import { journey, type Journey } from "@/lib/journeys";
import { skH } from "./Sky";

export const FLC = ["#FFC93C", "#4FC3F7", "#4CD08A", "#B48CFF"];
const FLN = ["Davomat", "Konspekt", "Workbook", "Vazifa"];
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

let SEEN = false;

/** Namuna ma'lumot — dizayn tanlash sahifasidagi ko'rinishlar uchun */
export function demoFlight(): FlightData {
  const st = ["done", "done", "done", "review", "debt", "todo"] as const;
  return {
    pts: 640, orbit: { pts: 800, label: "1-maqsad" }, moon: { pts: 1200, label: "Bosh maqsad" },
    L: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, t: `${i + 1}-dars`, fut: i > 6,
      cells: i > 6 ? [] : [0, 1, 2].map((k) => ({ k, st: st[(i + k) % 6] === "todo" && i < 4 ? "done" : st[(i * 2 + k) % 6], label: FLN[k] })) })),
    A: [{ k: 1, t: "", st: "done" }, { k: 2, t: "", st: "done" }, { k: 3, t: "", st: "review" }, { k: 4, t: "", st: "debt" }, { k: 5, t: "", st: "todo" }],
    done: 14, total: 21, parts: [],
  };
}

function draw(cv: HTMLCanvasElement, F: FlightData, j: Journey, opts: { still?: boolean; onTip?: (h: string) => void }) {
  const reduce = opts.still || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const anim = !opts.still && !SEEN && !reduce;
  if (!opts.still) SEEN = true;
  const d = devicePixelRatio || 1, r = cv.getBoundingClientRect(), W = r.width, H = r.height;
  cv.width = W * d; cv.height = H * d;
  const c = cv.getContext("2d")!;
  c.setTransform(d, 0, 0, d, 0, 0);
  const S = Math.min(1, W / 360);       // kichik ko'rinishda hammasi mutanosib kichrayadi
  const ST = Array.from({ length: 90 }, (_, i) => ({ x: skH(i, "fx"), y: skH(i, "fy") * 0.45, r: skH(i, "fr") * 1.1 + 0.2, p: skH(i, "fp") * 6 }));
  const t0 = performance.now();
  type Hit = { x: number; y: number; r: number; l?: FlightData["L"][number]; a?: FlightData["A"][number]; rk?: 1 };
  let hits: Hit[] = [];
  const O = F.orbit.pts, M = Math.max(F.moon.pts, O + 1), pts = F.pts;
  const y0 = H * 0.9, yo = H * 0.36, ym = H * 0.13;
  const altY = (p: number) => (p <= O ? y0 - (Math.max(p, 0) / O) * (y0 - yo) : yo - ((Math.min(p, M) - O) / (M - O)) * (yo - ym));
  const ink2 = j.dark ? "rgba(255,255,255,.6)" : "rgba(26,35,48,.55)", hi = j.dark ? "#FFE6A0" : "#8A5A00";
  const txt = (s: string, x: number, y: number, f: string, col: string, al: CanvasTextAlign = "left") => { c.font = f + " Inter,system-ui,sans-serif"; c.fillStyle = col; c.textAlign = al; c.textBaseline = "alphabetic"; c.fillText(s, x, y); };
  const emo = (s: string, x: number, y: number, size: number, rot = 0, alpha = 1) => {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.globalAlpha = alpha;
    c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, 0, 0); c.restore();
  };
  const rr = (x: number, y: number, w: number, h: number, q: number) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, q); else c.rect(x, y, w, h); };
  const empty = j.dark ? "rgba(255,255,255,.14)" : "rgba(26,35,48,.12)";
  const col = (s: string, k: number) => (s === "done" ? FLC[k] : s === "debt" ? "#E0463E" : s === "review" ? "rgba(140,155,180,.7)" : s === "na" ? "rgba(128,128,128,.08)" : empty);
  const ICO: Record<string, string> = { done: "✅", debt: "❌", review: "⏳", todo: "▫️", na: "➖" };
  const tipL = (l: FlightData["L"][number]) => `<b>${l.n}-dars · ${esc(l.t)}</b><br>` + (l.fut ? "Hali o'tilmagan" : l.cells.length ? l.cells.map((x) => `${ICO[x.st]} ${esc(x.label)}`).join(" · ") : "Bu darsda vazifa yo'q")
    + (l.cells.some((x) => x.st === "debt") ? `<br><span style="color:#E0463E">Qarzni topshirsangiz, yuqoriroq ko'tarilasiz</span>` : "");
  const tipA = (x: FlightData["A"][number]) => `<b>Amaliy №${x.k}${x.t ? " · " + esc(x.t) : ""}</b><br>${{ done: "✅ Qabul qilindi", review: "⏳ Tekshiruvda", debt: "❌ Topshirilmagan", todo: "🕒 Muddat hali bor — topshiring", locked: "🔒 Hali berilmagan" }[x.st]}`;
  const g1 = cap(j.lines[3]), g2 = cap(j.lines[4]);
  if (opts.onTip) {
    const onTip = opts.onTip;
    cv.onclick = (e) => {
      const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
      let best: Hit | null = null, bd = 1e9;
      hits.forEach((h) => { const q = Math.hypot(h.x - mx, h.y - my); if (q <= h.r && q < bd) { bd = q; best = h; } });
      const h = best as Hit | null;
      onTip(!h ? "" : h.l ? tipL(h.l) : h.a ? tipA(h.a)
        : `<b>${j.who} · ${pts} ball</b><br>${pts < O ? `${g1}gacha (${esc(F.orbit.label)}) yana <b>${O - pts}</b> ball` : pts < M ? `${g1} — yetdingiz! ${g2}gacha (${esc(F.moon.label)}) yana <b>${M - pts}</b> ball` : `${g2} — yetdingiz! 🏆`}`);
    };
  }
  const frac = Math.min(1, Math.max(0, pts) / M);
  const rx = W * 0.55;
  let raf = 0;

  const frame = (now: number) => {
    const t = reduce ? 0 : now;
    hits = [];
    // Fon
    const g = c.createLinearGradient(0, 0, 0, H);
    j.sky.forEach((s, i) => g.addColorStop(i / (j.sky.length - 1), s));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (j.stars) ST.forEach((s) => { c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + s.p)); c.fillStyle = "#fff"; c.fillRect(s.x * W, s.y * H, s.r, s.r); });
    c.globalAlpha = 1;

    // Sahna
    if (j.scene === "mountain") {
      c.fillStyle = j.dark ? "rgba(255,255,255,.07)" : "rgba(70,90,110,.18)";
      c.beginPath(); c.moveTo(0, H); for (let i = 0; i <= 8; i++) c.lineTo((i / 8) * W, H * (0.55 + 0.18 * skH(i, "m1"))); c.lineTo(W, H); c.fill();
      const px = W * 0.5, py = ym + 26 * S;
      c.fillStyle = j.dark ? "rgba(30,10,60,.55)" : "rgba(85,105,95,.55)";
      c.beginPath(); c.moveTo(-W * 0.1, H); c.lineTo(px, py); c.lineTo(W * 1.05, H); c.fill();
      c.fillStyle = j.dark ? "rgba(220,200,255,.5)" : "rgba(255,255,255,.9)";
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - 22 * S, py + 30 * S); c.lineTo(px - 6 * S, py + 24 * S); c.lineTo(px + 6 * S, py + 33 * S); c.lineTo(px + 20 * S, py + 26 * S); c.fill();
    } else if (j.scene === "hills") {
      c.fillStyle = "rgba(76,140,60,.55)"; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) c.lineTo(x, y0 + 4 + Math.sin(x / 40) * 6); c.lineTo(W, H); c.fill();
    } else if (j.scene === "tower") {
      const bw = 64 * S, bx = rx - bw / 2, top = ym + 40 * S;
      c.fillStyle = "rgba(20,25,45,.75)"; c.fillRect(bx, top, bw, H - top);
      c.fillRect(rx - 2, top - 26 * S, 4, 26 * S);
      const lit = y0 - (y0 - altY(pts));
      for (let y = H - 12 * S; y > top + 6; y -= 11 * S) for (let k = 0; k < 4; k++) {
        c.fillStyle = y > lit ? "rgba(255,214,102,.9)" : "rgba(255,255,255,.12)";
        c.fillRect(bx + 7 * S + k * 13.5 * S, y, 8 * S, 6 * S);
      }
    } else if (j.scene === "road") {
      const rw = 58 * S;
      c.fillStyle = "#4A4F57"; c.fillRect(rx - rw / 2, ym + 20 * S, rw, H);
      c.fillStyle = "#fff"; c.fillRect(rx - rw / 2, ym + 20 * S, 2, H); c.fillRect(rx + rw / 2 - 2, ym + 20 * S, 2, H);
      c.fillStyle = "rgba(255,255,255,.75)";
      for (let y = ym + 20 * S - 30 + ((t / 30) % 30); y < H; y += 30) if (y > ym + 20 * S) c.fillRect(rx - 1.5, y, 3, 14);
      c.fillStyle = "#000"; for (let k = 0; k < 8; k++) { if (k % 2) c.fillRect(rx - rw / 2 + k * (rw / 8), ym + 14 * S, rw / 8, 6 * S); }
    } else if (j.scene === "water") {
      c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= W; x += 6) c.lineTo(x, ym + 16 * S + Math.sin(x / 18 + t / 600) * 3); c.stroke(); c.lineWidth = 1;
    }

    // Maqsad belgisi
    if (j.key === "kosmos") {
      c.fillStyle = "#F2EFD9"; c.beginPath(); c.arc(W * 0.42, ym - 4, 15 * S, 0, 7); c.fill();
      c.fillStyle = "#D9D4B8"; c.beginPath(); c.arc(W * 0.42 - 4 * S, ym - 7 * S, 3.5 * S, 0, 7); c.arc(W * 0.42 + 5 * S, ym, 2.5 * S, 0, 7); c.fill();
    } else emo(j.goal, j.scene === "mountain" ? W * 0.5 : W * 0.42, j.scene === "mountain" ? ym + 8 * S : ym - 4, 28 * S);

    // Balandlik chiziqlari
    const c1 = Math.round(O / 3), c2 = Math.round((O * 2) / 3);
    ([[y0, `${j.lines[0]} · 0`], [altY(c1), `${j.lines[1]} · ${c1}`], [altY(c2), `${j.lines[2]} · ${c2}`], [yo, `${j.lines[3]} · ${O}`], [ym, `${j.lines[4]} · ${M}`]] as [number, string][]).forEach(([y, s], i) => {
      c.strokeStyle = j.dark ? "rgba(255,255,255,.2)" : "rgba(26,35,48,.18)"; c.setLineDash([2, 5]); c.beginPath(); c.moveTo(10, y); c.lineTo(W - 50 * S, y); c.stroke(); c.setLineDash([]);
      txt(s, 12, y - 4, `700 ${Math.max(7, 9 * S)}px`, i >= 3 ? hi : ink2);
    });

    // Bezaklar
    if (j.deco === "🫧") {
      for (let i = 0; i < 9; i++) { const x = W * (0.08 + 0.1 * i) % (W - 60), y = H - ((t / 25 + i * 70) % (H * 0.85)); emo("🫧", x, y, (10 + (i % 3) * 4) * S, 0, 0.7); }
    } else if (j.deco === "✨") {
      for (let i = 0; i < 6; i++) emo("✨", W * (0.08 + 0.13 * i), H * (0.2 + 0.1 * (i % 4)), 12 * S, 0, 0.4 + 0.5 * Math.abs(Math.sin(t / 700 + i)));
    } else if (j.deco === "🌳") {
      for (let i = 0; i < 6; i++) { const y = (i * 0.17 * H + (t / 30)) % H; emo("🌳", rx - 52 * S, y, 18 * S); emo("🌳", rx + 52 * S, (y + H * 0.08) % H, 18 * S); }
    } else if (j.deco === "🦋") {
      for (let i = 0; i < 3; i++) emo("🦋", ((i * 0.33 + t / 30000) % 1) * (W - 60), altY(c2) + Math.sin(t / 500 + i) * 10, 14 * S);
    } else {
      for (let i = 0; i < 4; i++) emo(j.deco, ((i * 0.31 + t / 40000) % 1.2 - 0.1) * W, altY(c1) + (i % 2) * 16, 26 * S, 0, j.dark ? 0.85 : 0.95);
    }

    // Dars kataklari shkalasi
    const top = H * 0.08, bot = H * 0.96, n = Math.max(1, F.L.length), ch = (bot - top) / n, gx = W - 36 * S;
    txt(j.gauge, gx + 13 * S, top - 4, `800 ${Math.max(7, 8.5 * S)}px`, ink2, "center");
    F.L.forEach((l, i) => {
      const y = bot - (i + 1) * ch;
      const cells = l.fut ? [0, 1, 2, 3].map(() => null) : l.cells;
      const w = Math.min(5.2 * S, (26 * S) / Math.max(1, cells.length) - 1.3);
      c.fillStyle = j.dark ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.35)"; rr(gx - 2, y, 30 * S, ch, 2); c.fill();
      cells.forEach((s, k) => { c.fillStyle = s ? col(s.st, s.k) : empty; rr(gx + k * (w + 1.3), y + 1, w, Math.max(1, ch - 2), 1.5); c.fill(); });
      hits.push({ x: gx + 13, y: y + ch / 2, r: Math.max(10, ch), l });
    });

    // Qahramon
    const k = anim ? Math.min(1, (now - t0) / 1800) : 1, e = 1 - Math.pow(1 - k, 3);
    const ry = y0 - (y0 - altY(pts)) * e, sway = reduce ? 0 : Math.sin(t / 900) * 4, mx = rx + sway;

    // Amaliy vazifalar
    const span = Math.max(1, F.A.length);
    F.A.forEach((x, jj) => {
      if (x.st === "locked") return;
      const y = Math.min(y0 - 20, Math.max(ym + 24, altY((O * (jj + 0.6)) / (span * 0.75)))), sx = W * (0.2 + (jj % 2) * 0.14) + (reduce ? 0 : Math.sin(t / 1500 + jj) * 5);
      const ring = x.st === "done" ? "#4CD08A" : x.st === "debt" ? "#E0463E" : x.st === "review" ? "#8B97AE" : "rgba(160,170,190,.6)";
      c.strokeStyle = ring; c.lineWidth = 2; c.beginPath(); c.arc(sx, y, 13 * S, 0, 7); c.stroke(); c.lineWidth = 1;
      if (j.key === "kosmos") {
        c.save(); c.translate(sx, y); c.scale(S, S); c.rotate(reduce ? 0 : Math.sin(t / 2000 + jj) * 0.3); c.globalAlpha = x.st === "done" ? 1 : 0.55;
        c.fillStyle = x.st === "done" ? "#3390EC" : x.st === "debt" ? "#E0463E" : "#8B97AE"; c.fillRect(-15, -4, 10, 8); c.fillRect(5, -4, 10, 8);
        c.fillStyle = x.st === "done" ? "#FFD86B" : "#AAB"; c.fillRect(-5, -6, 10, 12); c.restore();
      } else emo(j.sat, sx, y, 16 * S, 0, x.st === "done" ? 1 : 0.45);
      txt("A" + x.k, sx + 22 * S, y + 4, `700 ${Math.max(7, 9 * S)}px`, x.st === "done" ? hi : ink2, "center");
      hits.push({ x: sx, y, r: 17, a: x });
    });

    // Iz
    if (j.scene !== "road" && j.scene !== "tower") {
      c.setLineDash([3, 6]); c.strokeStyle = j.dark ? "rgba(255,255,255,.45)" : "rgba(26,35,48,.3)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(mx, H); c.lineTo(mx, ry + 30 * S); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
    }
    if (j.mover === "rocket") {
      c.save(); c.translate(mx, ry); c.scale(S, S); c.translate(-mx, -ry);
      const fl = 18 + (reduce ? 0 : Math.sin(t / 50) * 5) + (k < 1 ? 14 : 0), fg = c.createLinearGradient(0, ry + 18, 0, ry + 18 + fl);
      fg.addColorStop(0, "#FFE07A"); fg.addColorStop(1, "rgba(255,90,40,0)"); c.fillStyle = fg;
      c.beginPath(); c.moveTo(mx - 7, ry + 18); c.lineTo(mx, ry + 18 + fl); c.lineTo(mx + 7, ry + 18); c.fill();
      c.fillStyle = "#E0463E"; c.beginPath(); c.moveTo(mx - 9, ry + 8); c.lineTo(mx - 16, ry + 22); c.lineTo(mx - 8, ry + 18); c.moveTo(mx + 9, ry + 8); c.lineTo(mx + 16, ry + 22); c.lineTo(mx + 8, ry + 18); c.fill();
      c.fillStyle = "#F6F8FB"; c.beginPath(); c.moveTo(mx, ry - 30); c.quadraticCurveTo(mx + 11, ry - 14, mx + 9, ry + 18); c.lineTo(mx - 9, ry + 18); c.quadraticCurveTo(mx - 11, ry - 14, mx, ry - 30); c.fill();
      c.fillStyle = "#E0463E"; c.beginPath(); c.moveTo(mx, ry - 30); c.quadraticCurveTo(mx + 6, ry - 22, mx + 7.5, ry - 17); c.lineTo(mx - 7.5, ry - 17); c.quadraticCurveTo(mx - 6, ry - 22, mx, ry - 30); c.fill();
      c.fillStyle = "#3390EC"; c.beginPath(); c.arc(mx, ry - 4, 4.5, 0, 7); c.fill();
      c.restore();
    } else {
      const list = Array.isArray(j.mover) ? j.mover : [j.mover];
      const glyph = list[Math.min(list.length - 1, Math.floor(frac * e * list.length))];
      const size = (Array.isArray(j.mover) ? 24 + 22 * frac * e : 36) * S;
      const bob = reduce ? 0 : Math.sin(t / 400) * 2;
      emo(glyph, j.scene === "road" || j.scene === "tower" ? rx : mx, ry + bob, size, j.rot ?? 0);
    }
    if (!opts.still) {
      c.fillStyle = j.dark ? "rgba(11,20,48,.75)" : "rgba(255,255,255,.9)"; rr(rx + 22 * S, ry - 17, 72, 22, 8); c.fill();
      txt(Math.round(pts * e) + " ball", rx + 22 * S + 36, ry - 2, "800 12px", j.dark ? "#fff" : "#1A2330", "center");
    }
    hits.push({ x: rx, y: ry, r: 28, rk: 1 });
    if (!opts.still) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Ballar animatsiyasi: qahramon ball bilan ko'tariladi (10 xil sahna — `theme`) */
export function Flight({ F, theme }: { F: FlightData; theme?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const j = journey(theme);
  const hint = `👆 Shkaladagi katakni, ${j.key === "kosmos" ? "yo'ldoshni" : "belgini"} yoki qahramonni bosing`;
  const [tip, setTip] = useState("");
  useEffect(() => (ref.current ? draw(ref.current, F, j, { onTip: setTip }) : undefined), [F, j]);
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <canvas ref={ref} style={{ width: "100%", aspectRatio: "1 / 1.25", display: "block", cursor: "pointer" }} aria-label={j.title} />
      <div className="small" style={{ padding: "10px 14px", minHeight: 58 }} dangerouslySetInnerHTML={{ __html: tip || hint }} />
    </div>
  );
}

/** Kichik jonsiz ko'rinish — dizayn tanlash sahifasi uchun */
export function FlightPreview({ theme }: { theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    // Emoji shriftlari yuklanishini kutib chizamiz
    let stop: (() => void) | undefined;
    const go = () => { stop = draw(cv, demoFlight(), journey(theme), { still: true }); };
    if (document.fonts?.ready) document.fonts.ready.then(go); else go();
    return () => stop?.();
  }, [theme]);
  return <canvas ref={ref} style={{ width: "100%", aspectRatio: "1 / 1.25", display: "block", borderRadius: 10 }} aria-hidden />;
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
