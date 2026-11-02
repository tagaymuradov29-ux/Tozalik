"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./Form";
import { newCourse } from "@/app/actions/build";

const DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MODES = [
  { k: "schedule", t: "📅 Jadval bo'yicha", d: "Darslar sonini, kunlarini va soatini bering — darslar avtomatik tuziladi" },
  { k: "copy", t: "📋 Mavjud kursdan nusxa", d: "Yangi oqim: darslar, vazifalar, workbooklar ko'chadi, sanalar suriladi" },
  { k: "rm6", t: "⭐ Namuna (RM 6.0 tuzilmasi)", d: "12 dars, konspekt, workbook, amaliy, stories/reels — tayyor andoza" },
];

export function CourseWizard({ courses, today }: { courses: { id: number; title: string }[]; today: string }) {
  const [mode, setMode] = useState(courses.length ? "copy" : "schedule");
  return (
    <ActionForm action={newCourse}>
      <input type="hidden" name="mode" value={mode} />
      <div className="stack" style={{ gap: 6 }}>
        {MODES.filter((m) => m.k !== "copy" || courses.length).map((m) => (
          <button key={m.k} type="button" onClick={() => setMode(m.k)} className="li" aria-pressed={mode === m.k}
            style={{ textAlign: "left", borderRadius: 12, padding: "10px 12px", border: `2px solid ${mode === m.k ? "var(--brand)" : "var(--line)"}`, background: mode === m.k ? "var(--brand-soft)" : "var(--card)", cursor: "pointer", font: "inherit", color: "inherit" }}>
            <div className="stack" style={{ gap: 2 }}><b>{m.t}</b><span className="tiny muted">{m.d}</span></div>
          </button>
        ))}
      </div>

      <label className="field"><span>Kurs nomi</span><input className="input" name="title" placeholder="Masalan: SMM Pro 3.0" required /></label>

      {mode === "copy" && (
        <label className="field"><span>Qaysi kursdan nusxa olinadi</span>
          <select className="input" name="source">{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </label>
      )}

      {mode !== "rm6" && (
        <div className="grid2">
          <label className="field"><span>Birinchi dars sanasi</span><input className="input" type="date" name="date" defaultValue={today} required /></label>
          <label className="field"><span>Soati</span><input className="input" type="time" name="time" defaultValue="18:00" /></label>
        </div>
      )}

      {mode === "schedule" && (
        <>
          <div className="field">
            <span>Dars kunlari</span>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {DAYS.map((d, i) => (
                <label key={d} className="pill" style={{ cursor: "pointer", padding: "7px 10px" }}>
                  <input type="checkbox" name="days" value={i} defaultChecked={i === 0 || i === 4} style={{ marginRight: 4 }} />{d}
                </label>
              ))}
            </div>
          </div>
          <div className="grid2">
            <label className="field"><span>Darslar soni</span><input className="input" type="number" name="count" min={1} max={100} defaultValue={12} /></label>
            <label className="field"><span>Davomiyligi (daq)</span><input className="input" type="number" name="duration" min={15} max={600} defaultValue={120} /></label>
          </div>
          <div className="field">
            <span>Har darsga avtomatik vazifa</span>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" name="t_kons" defaultChecked /> Konspekt (10 ball, ertasi kungacha)</label>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" name="t_amaliy" /> Amaliy topshiriq (50 ball, 7 kun)</label>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Keyin har bir darsning mavzusi, spikeri, videosi va materiallarini «Darslar» bo&apos;limida to&apos;ldirasiz.</p>
        </>
      )}
      {mode === "copy" && <p className="tiny muted" style={{ margin: 0 }}>O&apos;quvchilar, topshiriqlar va ballar ko&apos;chmaydi — faqat kurs tuzilmasi. Yangi kursda «1-guruh» ochiladi.</p>}
      <Submit>Kursni yaratish</Submit>
    </ActionForm>
  );
}
