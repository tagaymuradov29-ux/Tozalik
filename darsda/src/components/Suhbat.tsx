"use client";
import { useEffect, useRef, useState } from "react";
import { robotSvg, type RobotState } from "@/lib/robots";
import { dialogsFor } from "@/lib/dialogs";
import { similarity } from "@/lib/lang";
import { canListen, listen, speak, speakWait } from "./speech";

const PICK = [["robi", "Robi"], ["mushuk", "Mushuk"], ["sova", "Sova"]] as const;
type Msg = { who: "ai" | "me"; text: string; tr?: string; score?: number };

/** 🤖 AI bilan suhbat (demo ssenariylar): robot gapiradi, o'quvchi mikrofonga javob beradi */
export function Suhbat({ lang, speech, rtl }: { lang: string; speech: string; rtl?: boolean }) {
  const dialogs = dialogsFor(lang);
  const [robot, setRobot] = useState("robi");
  const [d, setD] = useState(0);
  const [step, setStep] = useState(-1);          // -1 — boshlanmagan
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [rs, setRs] = useState<RobotState>("idle");
  const [mic, setMic] = useState<boolean | null>(null);
  const [showTr, setShowTr] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const D = dialogs[d];

  useEffect(() => { setMic(canListen()); try { const r = localStorage.getItem("robot"); if (r) setRobot(r); } catch {} }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);

  const say = async (text: string, tr: string) => {
    setMsgs((m) => [...m, { who: "ai", text, tr }]);
    setRs("speak"); await speakWait(text, speech); setRs("idle");
  };
  const start = async (i = d) => {
    setD(i); setMsgs([]); setStep(0); setErr("");
    const T = dialogs[i].turns[0];
    await say(T[0], T[1]);
  };
  const next = async (reply: string, score?: number) => {
    setMsgs((m) => [...m, { who: "me", text: reply, score }]);
    const n = step + 1;
    setStep(n);
    if (n < D.turns.length) await say(D.turns[n][0], D.turns[n][1]);
    else await say(D.bye[0], D.bye[1]);
  };
  const answer = async () => {
    setErr(""); setRs("listen");
    try {
      const alts = await listen(speech);
      setRs("idle");
      if (!alts.length) { setErr("Ovoz eshitilmadi — qayta urinib ko'ring"); return; }
      const hint = D.turns[step][2];
      const best = alts.map((a) => ({ a, s: similarity(a, hint) })).sort((x, y) => y.s - x.s)[0];
      await next(alts[0], best.s);
    } catch (e) {
      setRs("idle");
      setErr((e as Error).message === "not-allowed" ? "Mikrofonga ruxsat bering" : "Ovozni tanib bo'lmadi — pastdagi tugma bilan javob bering");
    }
  };
  const finished = step >= D.turns.length;
  const scores = msgs.filter((m) => m.score != null).map((m) => m.score!);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const col = (s: number) => (s >= 80 ? "var(--ok)" : s >= 55 ? "var(--amber)" : "var(--red)");

  return (
    <>
      <div className="card" style={{ alignItems: "center", background: "linear-gradient(180deg, var(--brand-soft), var(--card))" }}>
        <div dangerouslySetInnerHTML={{ __html: robotSvg(robot, rs, 150) }} />
        <div className="tiny muted">{rs === "speak" ? "Gapirmoqda…" : rs === "listen" ? "Tinglamoqda… gapiring" : "AI o'qituvchi"}</div>
        <div className="row" style={{ gap: 6 }}>
          {PICK.map(([k, n]) => (
            <button key={k} type="button" className={`pill ${robot === k ? "ok" : ""}`} style={{ padding: "6px 10px" }}
              onClick={() => { setRobot(k); try { localStorage.setItem("robot", k); } catch {} }}>{n}</button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {dialogs.map((x, i) => (
          <button key={x.key} type="button" className={`pill ${d === i ? "info" : ""}`} style={{ padding: "8px 12px" }} onClick={() => start(i)}>{x.name}</button>
        ))}
      </div>

      {step < 0 ? (
        <button type="button" className="btn full" onClick={() => start()}>▶ Suhbatni boshlash · {D.name}</button>
      ) : (
        <div className="card">
          <div className="stack" style={{ gap: 8 }}>
            {msgs.map((m, i) => (
              <div key={i} className={`chatb ${m.who}`} onClick={() => m.who === "ai" && setShowTr(showTr === i ? null : i)}>
                <div dir={rtl ? "auto" : undefined}>{m.text}</div>
                {m.who === "ai" && (showTr === i ? <div className="tiny" style={{ opacity: 0.75 }}>{m.tr}</div> : <div className="tiny" style={{ opacity: 0.5 }}>bosing — tarjima</div>)}
                {m.score != null && <div className="tiny" style={{ fontWeight: 700, color: col(m.score) }}>Talaffuz: {m.score}/100</div>}
                {m.who === "ai" && <button type="button" className="chatb-say" onClick={(e) => { e.stopPropagation(); speak(m.text, speech); }} aria-label="Qayta eshitish">🔊</button>}
              </div>
            ))}
            <div ref={end} />
          </div>
        </div>
      )}

      {step >= 0 && !finished && rs !== "speak" && (
        <div className="card tight">
          <span className="tiny muted">Javob bering, masalan:</span>
          <div className="row between" style={{ gap: 8 }}>
            <b dir={rtl ? "auto" : undefined} style={{ fontSize: 17 }}>{D.turns[step][2]}</b>
            <button type="button" className="btn sm soft" onClick={() => speak(D.turns[step][2], speech)}>🔊</button>
          </div>
          <span className="tiny muted">{D.turns[step][3]}</span>
          {err && <div className="err small">{err}</div>}
          <div className="grid2">
            {mic ? <button type="button" className="btn" onClick={answer} disabled={rs === "listen"}>{rs === "listen" ? "● Gapiring…" : "🎙 Gapirish"}</button>
              : <span className="tiny muted" style={{ alignSelf: "center" }}>Bu brauzerda mikrofon tanilmaydi</span>}
            <button type="button" className="btn ghost" onClick={() => next(D.turns[step][2])}>Shu javob</button>
          </div>
        </div>
      )}

      {finished && rs !== "speak" && (
        <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
          <b style={{ fontSize: 18 }}>Suhbat yakunlandi 🎉</b>
          {avg != null && <span className="small">O&apos;rtacha talaffuz: <b style={{ color: col(avg) }}>{avg}/100</b></span>}
          <button type="button" className="btn full" onClick={() => start()}>Qaytadan</button>
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>Demo: hozir tayyor ssenariylar bo&apos;yicha. AI ulanganda robot istalgan mavzuda erkin gaplashadi.</p>
    </>
  );
}
