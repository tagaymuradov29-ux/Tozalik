"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SkyData } from "@/lib/space";

const SKYC = ["#9FC8FF", "#A8F0C0", "#FFC8A0", "#D8B8FF", "#FFE38A", "#C9D1DC"];
/** Barqaror tasodif: bir xil id — har safar bir xil joy */
export const skH = (id: number | string, k: string) => {
  let h = 2166136261;
  const t = String(id) + ":" + k;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
};

type Pt = { x: number; y: number; s: number; n: SkyData["nodes"][number] };

function layout(K: SkyData, W: number, H: number) {
  const P: Record<number, Pt> = {};
  const cx = W / 2, cy = H * 0.53, R = Math.min(W, H) * 0.46;
  if (K.acc === "student") {
    const st: Record<number, number> = {};
    K.edges.forEach(([a, b, s]) => { const o = a === K.me ? b : a; st[o] = s === "ok" ? 2 : Math.max(st[o] || 0, 1); });
    const wk = new Set(K.week);
    const rk = (n: Pt["n"]) => (n.id === K.me ? -1 : st[n.id] === 2 ? 0 : st[n.id] === 1 ? 1 : wk.has(n.id) ? 2 : 3);
    const list = K.nodes.slice().sort((a, b) => rk(a) - rk(b) || skH(a.id, "r") - skH(b.id, "r"));
    const N = list.length;
    let i = 0;
    list.forEach((n) => {
      if (n.id === K.me) { P[n.id] = { x: cx, y: cy, s: 9, n }; return; }
      i++;
      const a = skH(n.id, "a") * 6.2832, r = R * (0.17 + 0.8 * Math.sqrt(i / N)) * (0.92 + 0.12 * skH(n.id, "j"));
      P[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.92, s: st[n.id] === 2 ? 2 : st[n.id] === 1 ? 1 : wk.has(n.id) ? 3 : 0, n };
    });
  } else {
    const G = Math.max(1, Math.min(6, K.gn.length));
    K.nodes.forEach((n) => {
      const g = n.g >= G ? 0 : n.g;
      const a = ((g + 0.08 + 0.84 * skH(n.id, "a")) / G) * 6.2832 - 1.5708, r = R * (0.22 + 0.76 * Math.sqrt(skH(n.id, "r")));
      P[n.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.92, s: 0, n };
    });
  }
  return P;
}

let SEEN = false;

function useSky(K: SkyData, mini: boolean, gsel: number | null, onTip?: (h: string) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const anim = !SEEN && !reduce && !mini;
    if (!mini) SEEN = true;
    const d = devicePixelRatio || 1, rc = cv.getBoundingClientRect(), W = rc.width, H = rc.height;
    cv.width = W * d; cv.height = H * d;
    const x = cv.getContext("2d")!;
    x.setTransform(d, 0, 0, d, 0, 0);
    const P = layout(K, W, H);
    const bg = Array.from({ length: mini ? 30 : 90 }, (_, i) => ({ x: skH(i, "bx"), y: skH(i, "by"), r: skH(i, "br") * 0.9 + 0.2, p: skH(i, "bp") * 6 }));
    const my = new Set(K.my);
    const okE = K.edges.filter((e) => e[2] === "ok"), wE = K.edges.filter((e) => e[2] !== "ok");
    const deg: Record<number, number> = {};
    okE.forEach(([a, b]) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; });
    const names = new Map(K.nodes.map((n) => [n.id, n]));
    let sel: Pt | null = null;
    const t0 = performance.now();
    let raf = 0;

    if (!mini && onTip) {
      cv.onclick = (e) => {
        const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my2 = e.clientY - r.top;
        let b: Pt | null = null, bd = 24;
        Object.values(P).forEach((p) => { const dd = Math.hypot(p.x - mx, p.y - my2); if (dd < bd) { bd = dd; b = p; } });
        sel = b;
        if (!b) return onTip("✨ Yulduzni bosing — kim ekanini ko'rasiz");
        const p = b as Pt;
        const gn = K.gn[p.n.g] ?? "";
        const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
        if (K.acc === "student") {
          onTip(p.n.id === K.me ? "<b>Siz</b> · osmon markazi"
            : `<b>${esc(p.n.n)}</b> · ${esc(gn)}<br>${({ 2: "✅ Tanishgansiz", 1: "⏳ Isbot tekshiruvda", 3: "🤝 Shu haftaning sherigi — tanishing!", 0: "🌑 Hali tanishmagansiz" } as Record<number, string>)[p.s]}`);
        } else {
          const who = okE.filter(([a2, b2]) => a2 === p.n.id || b2 === p.n.id).map(([a2, b2]) => names.get(a2 === p.n.id ? b2 : a2)?.n.split(" ")[0]).filter(Boolean);
          onTip(`<b>${esc(p.n.n)}</b> · ${esc(gn)}<br>✅ ${deg[p.n.id] || 0} ta tanishuv${who.length ? ": " + esc(who.slice(0, 6).join(", ")) + (who.length > 6 ? "…" : "") : ""}`);
        }
      };
    }

    const frame = (now: number) => {
      const t = now - t0;
      x.clearRect(0, 0, W, H);
      if (mini) { x.fillStyle = "#0B1430"; x.fillRect(0, 0, W, H); }
      bg.forEach((b) => { x.globalAlpha = 0.2 + 0.25 * Math.sin((reduce ? 0 : now) / 900 + b.p); x.fillStyle = "#fff"; x.beginPath(); x.arc(b.x * W, b.y * H, mini ? 0.5 : b.r, 0, 7); x.fill(); });
      x.globalAlpha = 1;
      const n = anim ? Math.max(0, Math.floor((t - 500) / (K.acc === "student" ? 150 : 25))) : 1e9;
      if (litRef.current) litRef.current.textContent = String(Math.min(okE.length, n));
      okE.forEach(([a, b], k) => {
        if (k >= n) return;
        const A = P[a], B = P[b];
        if (!A || !B) return;
        let al = mini ? 0.5 : K.acc === "student" ? 0.75 : 0.22;
        if (!mini && K.acc !== "student") {
          const inG = gsel === null || A.n.g === gsel || B.n.g === gsel;
          const inMy = !my.size || my.has(a) || my.has(b);
          if (!inG) al = 0.04; else if (!inMy) al = 0.08;
          if (sel) al = sel.n.id === a || sel.n.id === b ? 0.95 : 0.05;
        }
        const gr = x.createLinearGradient(A.x, A.y, B.x, B.y);
        gr.addColorStop(0, `rgba(255,233,168,${al})`); gr.addColorStop(1, `rgba(255,233,168,${al * 0.35})`);
        x.strokeStyle = gr; x.lineWidth = mini ? 0.7 : 1.2; x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.stroke();
      });
      if (!mini) {
        x.setLineDash([3, 4]);
        wE.forEach(([a, b]) => { const A = P[a], B = P[b]; if (!A || !B) return; x.strokeStyle = "rgba(255,227,138,.45)"; x.lineWidth = 1; x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.stroke(); });
        x.setLineDash([]);
      }
      Object.values(P).forEach((p) => {
        const c = SKYC[p.n.g] || SKYC[5];
        let r = mini ? 1.2 : 1.8, col = "rgba(200,215,255,.45)", gl = 0;
        if (K.acc === "student") {
          if (p.n.id === K.me) return;
          if (p.s === 2) { r = mini ? 2.2 : 3.4; col = c; gl = 12; }
          else if (p.s === 1) { r = 2.8; col = "#FFE38A"; }
          else if (p.s === 3 && !mini) { const pu = 0.5 + 0.5 * Math.sin(now / 380 + skH(p.n.id, "t") * 6); r = 2.2 + pu * 1.6; col = `rgba(255,255,255,${0.45 + pu * 0.5})`; gl = 6 * pu; }
        } else {
          const dg = deg[p.n.id] || 0;
          r = (mini ? 1 : 1.6) + Math.min(dg, 20) * (mini ? 0.08 : 0.17); col = c; gl = dg ? 8 : 0;
          if (!mini && ((gsel !== null && p.n.g !== gsel) || (my.size && !my.has(p.n.id)))) { col = "rgba(200,215,255,.35)"; gl = 0; }
        }
        x.shadowColor = col; x.shadowBlur = gl; x.fillStyle = col; x.beginPath(); x.arc(p.x, p.y, r, 0, 7); x.fill(); x.shadowBlur = 0;
        if (K.acc === "student" && p.s === 1 && !mini) { x.strokeStyle = "#E0A800"; x.lineWidth = 1.5; x.beginPath(); x.arc(p.x, p.y, 7 + Math.sin(now / 300) * 1.2, 0, 7); x.stroke(); }
        if (sel === p && !mini) { x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.beginPath(); x.arc(p.x, p.y, 10, 0, 7); x.stroke(); }
      });
      if (K.acc === "student" && K.me) {
        const m = P[K.me];
        if (m) {
          const pu = 1 + 0.06 * Math.sin(now / 600);
          x.shadowColor = "#FFE9A8"; x.shadowBlur = 22; x.fillStyle = "#FFE9A8"; x.beginPath(); x.arc(m.x, m.y, (mini ? 5 : 11) * pu, 0, 7); x.fill(); x.shadowBlur = 0;
          if (!mini) { x.fillStyle = "#0B1430"; x.font = "800 8.5px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("SIZ", m.x, m.y); }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [K, mini, gsel, onTip]);
  return { ref, litRef };
}

/** Bosh sahifadagi kichik karta — networking sahifasiga olib boradi */
export function SkyMini({ K }: { K: SkyData }) {
  const { ref } = useSky(K, true, null);
  const ok = K.edges.filter((e) => e[2] === "ok").length;
  return (
    <Link href="/networking" className="card space-card">
      <canvas ref={ref} style={{ width: 56, height: 56, flex: "none", borderRadius: 10 }} />
      <div className="grow">
        <b>✨ Tanishuvlar osmoni</b>
        <div className="tiny" style={{ opacity: 0.85 }}>{ok} ta yulduz yongan{K.items.all ? ` · bu hafta ${K.items.ok}/${K.items.all}` : ""}</div>
      </div>
      <span style={{ fontSize: 20, opacity: 0.8 }}>›</span>
    </Link>
  );
}

/** Katta osmon: o'quvchida — o'zi markazda, xodimda — butun kurs, guruhlar bo'yicha */
export function Sky({ K }: { K: SkyData }) {
  const [tip, setTip] = useState("✨ Yulduzni bosing — kim ekanini ko'rasiz");
  const [g, setG] = useState<number | null>(null);
  const { ref, litRef } = useSky(K, false, g, setTip);
  const stu = K.acc === "student", nn = K.nodes.length;
  const ok = K.edges.filter((e) => e[2] === "ok").length;
  return (
    <div className="card" style={{ padding: 8 }}>
      <div className="sky-box">
        <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }} aria-label="Tanishuvlar osmoni" />
        <div className="sky-top">
          <div>
            <small>{stu ? "Yoqilgan yulduzlar" : "Jami tanishuvlar"}</small>
            <b ref={litRef as React.RefObject<HTMLElement>}>{ok}</b>{stu && <b style={{ opacity: 0.5 }}>/{Math.max(0, nn - 1)}</b>}
          </div>
          <div style={{ textAlign: "right" }}>
            <small>{stu ? "Shu hafta" : "O'rtacha"}</small>
            {stu ? <><b>{K.items.ok}</b><b style={{ opacity: 0.5 }}>/{K.items.all}</b></> : <><b>{nn ? ((ok * 2) / nn).toFixed(1) : 0}</b><span style={{ opacity: 0.6, fontSize: 12 }}> / kishi</span></>}
          </div>
        </div>
        <div className="sky-tip" dangerouslySetInnerHTML={{ __html: tip }} />
      </div>
      <div className="tiny muted" style={{ marginTop: 8 }}>
        {stu
          ? "Har kursdosh — bitta yulduz. Tanishsangiz yulduzi yonadi va siz bilan nur bog'lanadi. Miltillayotganlari — shu haftaning sheriklari, sariq halqali — isboti tekshiruvda."
          : `Har yulduz — o'quvchi (rangi — guruhi), nur — tasdiqlangan tanishuv, sariq punktir — tekshiruvda.${K.my.length ? " Yorqinlari — sizning guruhingiz." : ""} Yulduzni bosing — uning tanishuvlari ajralib ko'rinadi.`}
      </div>
      {!stu && K.gn.length > 1 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" className={`pill ${g === null ? "ok" : ""}`} onClick={() => setG(null)}>Hammasi</button>
          {K.gn.map((n, i) => (
            <button type="button" key={i} className={`pill ${g === i ? "ok" : ""}`} onClick={() => setG(i)}>
              <i style={{ width: 8, height: 8, borderRadius: 4, background: SKYC[i] ?? SKYC[5], display: "inline-block", marginRight: 4 }} />{n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
