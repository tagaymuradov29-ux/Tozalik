"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { answerCard, savePron } from "@/app/actions/til";
import { ARABIC, arForms, HARAKAT, similarity } from "@/lib/lang";
import { canListen, listen, speak } from "./speech";

type Card = { id: number; word: string; tr: string; translit: string; example: string; image?: string; pron?: number | null };

function Say({ text, lang, size = 20 }: { text: string; lang: string; size?: number }) {
  return (
    <button type="button" className="btn sm soft" aria-label="Eshitish" onClick={(e) => { e.stopPropagation(); speak(text, lang); }} style={{ fontSize: size * 0.8, padding: "6px 10px" }}>🔊</button>
  );
}

/** Kartochkalar: bir bosishda tarjima; svayp — o'ngga «bildim», chapga «bilmadim» (Bilmagan so'zlarimga), tepaga «juda oson».
 *  dir="rev" — o'zbekchadan chet tiliga. */
export function Flashcards({ cards, lang, rtl, back, dir = "fwd" }: { cards: Card[]; lang: string; rtl?: boolean; back: string; dir?: "fwd" | "rev" }) {
  const [q, setQ] = useState(cards);
  const total = cards.length;
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(0);
  const [bad, setBad] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [exit, setExit] = useState<"" | "r" | "l" | "u">("");
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [, startT] = useTransition();
  const c = q[0];
  useEffect(() => { if (c && dir === "fwd") speak(c.word, lang); }, [c, lang, dir]);
  if (!c) return (
    <div className="card" style={{ textAlign: "center", alignItems: "center" }}>
      <span style={{ fontSize: 44 }}>🎉</span>
      <b style={{ fontSize: 18 }}>Bugungi mashq tugadi!</b>
      <span className="small sub">✅ {ok} ta bildingiz · 🔁 {bad} ta «Bilmagan so&apos;zlarim»ga tushdi</span>
      <Link href={back} className="btn full">Orqaga</Link>
    </div>
  );
  const answer = (kind: "r" | "l" | "u") => {
    if (exit) return;
    const yes = kind !== "l";
    startT(() => answerCard(c.id, yes, kind === "u"));
    if (yes) setOk((x) => x + 1); else setBad((x) => x + 1);
    setExit(kind);
    setTimeout(() => { setQ((x) => (yes ? x.slice(1) : [...x.slice(1), x[0]])); setOpen(false); setExit(""); setDrag(null); }, 230);
  };
  const front = dir === "fwd"
    ? <><div dir={rtl ? "rtl" : undefined} style={{ fontSize: rtl ? 40 : 32, fontWeight: 700, lineHeight: 1.3 }}>{c.word}</div>{c.translit && <div className="small muted">{c.translit}</div>}</>
    : <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.3 }}>{c.tr || "—"}</div>;
  const backSide = dir === "fwd"
    ? <><div style={{ fontSize: 22, fontWeight: 600, color: "var(--brand-ink)" }}>{c.tr || "—"}</div>{c.example && <div className="small sub" dir={rtl ? "rtl" : undefined}>{c.example}</div>}</>
    : <><div dir={rtl ? "rtl" : undefined} style={{ fontSize: rtl ? 34 : 26, fontWeight: 700, color: "var(--brand-ink)" }}>{c.word}</div>{c.translit && <div className="small muted">{c.translit}</div>}{c.example && <div className="small sub" dir={rtl ? "rtl" : undefined}>{c.example}</div>}</>;
  const dx = exit === "r" ? 480 : exit === "l" ? -480 : drag?.x ?? 0, dy = exit === "u" ? -700 : drag?.y ?? 0;
  const hint = dx > 40 ? "Bildim ✓" : dx < -40 ? "Bilmadim" : dy < -40 ? "Juda oson ↑" : "";
  return (
    <>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row between small"><b>{Math.min(total, total - q.length + 1)} / {total}</b><span className="muted">✅ {ok} · 🔁 {bad}</span></div>
        <div className="progress"><i style={{ width: `${((total - q.length) / Math.max(1, total)) * 100}%` }} /></div>
      </div>
      <div role="button" tabIndex={0} className="card flash"
        style={{ transform: `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`, transition: drag && !exit ? "none" : "transform .23s ease", touchAction: "none", userSelect: "none",
          boxShadow: hint ? `0 0 0 3px ${dx > 40 || dy < -40 ? "var(--ok)" : "var(--red)"}` : undefined }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (start.current) setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) }); }}
        onPointerUp={() => {
          const d = drag; start.current = null;
          if (d && d.x > 90) return answer("r");
          if (d && d.x < -90) return answer("l");
          if (d && d.y < -90) return answer("u");
          if (!d || (Math.abs(d.x) < 8 && Math.abs(d.y) < 8)) setOpen((o) => !o);
          setDrag(null);
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => !o); if (e.key === "ArrowRight") answer("r"); if (e.key === "ArrowLeft") answer("l"); if (e.key === "ArrowUp") answer("u"); }}
        aria-label="Kartochka: bosing — tarjima, o'ngga — bildim, chapga — bilmadim">
        <div className="row between" style={{ width: "100%" }}>
          <span className="tiny" style={{ fontWeight: 700, color: hint ? (dx > 40 || dy < -40 ? "var(--ok)" : "var(--red)") : "var(--ink-3)" }}>{hint || (open ? "Tarjima" : "Bosing — tarjimasi chiqadi")}</span>
          <Say text={c.word} lang={lang} />
        </div>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" style={{ width: 140, height: 110, objectFit: "cover", borderRadius: 20, background: "#FFF6D6" }} draggable={false} />
        )}
        {front}
        {open && <><div style={{ height: 1, background: "var(--line)", width: "100%" }} />{backSide}</>}
      </div>
      <div className="swipe3">
        <button type="button" className="no" onClick={() => answer("l")}><span aria-hidden="true">←</span>Bilmadim</button>
        <button type="button" className="easy" onClick={() => answer("u")}><span aria-hidden="true">↑</span>Juda oson</button>
        <button type="button" className="yes" onClick={() => answer("r")}><span aria-hidden="true">→</span>Bildim</button>
      </div>
    </>
  );
}

/** Talaffuz: so'zni eshitadi, o'zi aytadi — telefon ovozni taniydi va 0–100 ball qo'yadi */
export function Pronounce({ words, lang, rtl }: { words: Card[]; lang: string; rtl?: boolean }) {
  const [res, setRes] = useState<Record<number, { s: number; heard: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(canListen()), []);
  const test = async (w: Card) => {
    setErr(""); setBusy(w.id);
    try {
      const alts = await listen(lang);
      if (!alts.length) { setErr("Ovoz eshitilmadi — mikrofonga yaqinroq, aniqroq ayting"); return; }
      const best = alts.map((a) => ({ a, s: similarity(a, w.word) })).sort((x, y) => y.s - x.s)[0];
      setRes((r) => ({ ...r, [w.id]: { s: best.s, heard: best.a } }));
      savePron(w.id, best.s);
    } catch (e) {
      setErr((e as Error).message === "not-allowed" ? "Mikrofonga ruxsat bering (brauzer sozlamalarida)" : "Ovozni tanib bo'lmadi, qayta urinib ko'ring");
    } finally { setBusy(null); }
  };
  const col = (s: number) => (s >= 85 ? "var(--ok)" : s >= 60 ? "var(--amber)" : "var(--red)");
  return (
    <>
      {ok === false && <div className="card tight" style={{ background: "var(--amber-soft)" }}><span className="small">Bu brauzerda ovozni tanish yo&apos;q. So&apos;zlarni eshitib, takrorlab mashq qilishingiz mumkin. Ball olish uchun Chrome (Android) yoki Safari (iPhone) da oching.</span></div>}
      {err && <div className="err small">{err}</div>}
      <div className="card">
        <div className="list">
          {words.map((w) => {
            const r = res[w.id];
            const best = Math.max(r?.s ?? 0, w.pron ?? 0);
            return (
              <div key={w.id} className="li" style={{ alignItems: "center" }}>
                <div className="grow stack" style={{ gap: 2 }}>
                  <span dir={rtl ? "rtl" : undefined} style={{ fontSize: rtl ? 24 : 18, fontWeight: 700, textAlign: rtl ? "right" : undefined }}>{w.word}</span>
                  <span className="tiny muted">{w.translit ? `${w.translit} · ` : ""}{w.tr}</span>
                  {r && <span className="tiny" style={{ color: col(r.s) }}>Eshitildi: «{r.heard}» — {r.s}/100</span>}
                </div>
                {best > 0 && <b style={{ color: col(best), minWidth: 34, textAlign: "right" }}>{best}</b>}
                <Say text={w.word} lang={lang} />
                {ok && <button type="button" className={`btn sm ${busy === w.id ? "danger" : ""}`} onClick={() => test(w)} disabled={busy !== null}>{busy === w.id ? "● Gapiring…" : "🎙"}</button>}
              </div>
            );
          })}
          {!words.length && <div className="empty">Hali so&apos;z yo&apos;q</div>}
        </div>
      </div>
    </>
  );
}

/** Arab alifbosi: 28 harf, 4 shakli, nomi va talaffuzi; harakatlar */
export function Alphabet() {
  const [i, setI] = useState(0);
  const L = ARABIC[i];
  const forms = arForms(L.ch, L.solo);
  return (
    <>
      <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
        <div className="row between" style={{ width: "100%" }}>
          <button type="button" className="btn sm ghost" onClick={() => setI((x) => (x + 27) % 28)}>‹</button>
          <span className="tiny muted">{i + 1} / 28</span>
          <button type="button" className="btn sm ghost" onClick={() => setI((x) => (x + 1) % 28)}>›</button>
        </div>
        <div dir="rtl" style={{ fontSize: 88, lineHeight: 1.1, fontWeight: 600 }}>{L.ch}</div>
        <b>{L.lat}</b>
        <div dir="rtl" className="small sub">{L.name}</div>
        <button type="button" className="btn sm" onClick={() => speak(L.name, "ar-SA", 0.7)}>🔊 Eshitish</button>
        {L.tip && <div className="small" style={{ background: "var(--brand-soft)", padding: "8px 12px", borderRadius: 10 }}>💡 {L.tip}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "100%" }} dir="rtl">
          {forms.map((f, k) => (
            <div key={k} className="stat" style={{ alignItems: "center" }}>
              <span style={{ fontSize: 30 }}>{f}</span>
              <span className="tiny muted">{["Alohida", "Boshida", "O'rtada", "Oxirida"][k]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="h2">Harflar</h2>
        <div dir="rtl" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {ARABIC.map((x, k) => (
            <button key={x.ch} type="button" onClick={() => { setI(k); speak(x.name, "ar-SA", 0.7); }}
              style={{ fontSize: 24, padding: "6px 0", borderRadius: 10, border: 0, cursor: "pointer", background: k === i ? "var(--brand)" : "var(--sunk)", color: k === i ? "#fff" : "var(--ink)" }}>{x.ch}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="h2">Harakatlar (unli belgilar)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {HARAKAT.map(([h, n, s]) => (
            <button key={h} type="button" className="stat" onClick={() => speak(h, "ar-SA", 0.7)} style={{ alignItems: "center", border: 0, cursor: "pointer" }}>
              <span dir="rtl" style={{ fontSize: 30 }}>{h}</span>
              <span className="tiny"><b>{n}</b> · {s}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
