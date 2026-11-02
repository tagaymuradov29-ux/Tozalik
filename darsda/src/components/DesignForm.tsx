"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./Form";
import { FlightPreview } from "./Flight";
import { saveDesign } from "@/app/actions/build";
import { COLORS, FONTS, JOURNEYS } from "@/lib/journeys";

const ff = (f: string) => (f ? `"${f}", system-ui, sans-serif` : "var(--font)");

export function DesignForm({ color, font, journey, tint }: { color: string; font: string; journey: string; tint: boolean }) {
  const [c, setC] = useState(color);
  const [f, setF] = useState(font);
  const [j, setJ] = useState(journey);
  const [tn, setTn] = useState(tint);
  const [tab, setTab] = useState<"rang" | "shrift" | "anim">("rang");
  return (
    <ActionForm action={saveDesign}>
      <input type="hidden" name="color" value={c} />
      <input type="hidden" name="font" value={f} />
      <input type="hidden" name="journey" value={j} />

      {/* Jonli namuna */}
      <div className="card tight" style={{ fontFamily: ff(f), background: tn ? `color-mix(in srgb, ${c} 7%, var(--sunk))` : "var(--sunk)" }}>
        <div className="tiny muted">Namuna</div>
        <b style={{ fontSize: 18 }}>Salom, Malika! 👋</b>
        <span className="small sub">4-dars. Bozor tahlili · bugun 18:00</span>
        <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}><div style={{ width: "62%", height: "100%", background: c }} /></div>
        <span className="btn sm" style={{ background: c, color: "#fff", pointerEvents: "none", alignSelf: "flex-start" }}>Davom etish</span>
      </div>

      <div className="row" style={{ gap: 6 }}>
        {([["rang", "🎨 Rang"], ["shrift", "🔤 Shrift"], ["anim", "🚀 Animatsiya"]] as const).map(([k, t]) => (
          <button key={k} type="button" className={`pill ${tab === k ? "ok" : ""}`} style={{ padding: "8px 12px" }} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === "rang" && (
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {COLORS.map(([hex, name]) => (
              <button key={hex} type="button" onClick={() => setC(hex)} className="stack" aria-pressed={c.toLowerCase() === hex.toLowerCase()}
                style={{ gap: 4, alignItems: "center", background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit", padding: 0 }}>
                <span style={{ width: "100%", height: 38, borderRadius: 12, background: hex, outline: c.toLowerCase() === hex.toLowerCase() ? "3px solid var(--ink)" : "none", outlineOffset: 2 }} />
                <span className="tiny muted" style={{ textAlign: "center" }}>{name}</span>
              </button>
            ))}
          </div>
          <label className="row between" style={{ gap: 8 }}>
            <span className="small"><b>O&apos;z rangingiz</b> — istalgan rangni tanlang</span>
            <input type="color" value={c} onChange={(e) => setC(e.target.value)} style={{ width: 56, height: 38, padding: 2, border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)" }} />
          </label>
          <label className="row between" style={{ gap: 8, cursor: "pointer" }}>
            <span className="small"><b>Rangli fon</b> — sahifa foni ham shu rangda biroz bo&apos;yaladi</span>
            <input type="checkbox" className="switch" name="tint" checked={tn} onChange={(e) => setTn(e.target.checked)} />
          </label>
        </div>
      )}
      {tab !== "rang" && <input type="hidden" name="tint" value={tn ? "on" : ""} />}

      {tab === "shrift" && (
        <div className="list">
          {FONTS.map((x) => (
            <button key={x.key} type="button" onClick={() => setF(x.key)} className="li"
              style={{ background: f === x.key ? "var(--brand-soft)" : "none", border: 0, borderRadius: 10, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left", padding: "8px 10px" }}>
              <div className="grow stack" style={{ gap: 0 }}>
                <span className="tiny muted">{x.name}</span>
                <span style={{ fontFamily: ff(x.family), fontSize: 17, fontWeight: 600 }}>Salom, o&apos;quvchi! Аа Ўў 123</span>
              </div>
              {f === x.key && <span style={{ color: "var(--brand)", fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "anim" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {JOURNEYS.map((x) => (
            <button key={x.key} type="button" onClick={() => setJ(x.key)} className="stack"
              style={{ gap: 6, padding: 6, borderRadius: 14, border: `2px solid ${j === x.key ? c : "var(--line)"}`, background: "var(--card)", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" }}>
              <FlightPreview theme={x.key} />
              <span className="small" style={{ fontWeight: 700 }}>{x.emoji} {x.title}{j === x.key ? " ✓" : ""}</span>
              <span className="tiny muted">{x.lines[0].toLowerCase()} → {x.lines[4].toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}
      <Submit>Saqlash</Submit>
    </ActionForm>
  );
}
