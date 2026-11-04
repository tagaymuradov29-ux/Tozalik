"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./Form";

type Act = (s: { error?: string; ok?: string } | undefined, fd: FormData) => Promise<{ error?: string; ok?: string } | undefined>;

/** Ishni baholash: tez ball tugmalari (yoki «Boshqa»), o'quvchiga izoh, Qaytarish / Qabul */
export function GradeBox({ id, cap, action }: { id: number; cap: number; action: Act }) {
  const picks = [...new Set([Math.round(cap / 3), Math.round((cap * 2) / 3), cap].filter((x) => x > 0))];
  const [pts, setPts] = useState(cap);
  const [other, setOther] = useState(false);
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="row between"><b className="small">Ball</b><span className="tiny muted">maks. {cap}</span></div>
      <div className="ptsel">
        {picks.map((p) => (
          <button key={p} type="button" className={!other && pts === p ? "on" : ""} onClick={() => { setOther(false); setPts(p); }}>{p}</button>
        ))}
        {other
          ? <input className="input" type="number" min={0} max={cap} value={pts} autoFocus inputMode="numeric" aria-label="Ball"
              onChange={(e) => setPts(Math.max(0, Math.min(cap, Number(e.target.value) || 0)))} />
          : <button type="button" onClick={() => setOther(true)}>Boshqa</button>}
      </div>
      <input type="hidden" name="points" value={pts} />
      <label className="field"><span>Izoh o&apos;quvchiga</span>
        <textarea className="input" name="feedback" rows={2} placeholder="Qaytarishda — majburiy" style={{ minHeight: 64 }} />
      </label>
      <div className="grid2">
        <Submit name="decision" value="reject" className="btn danger">Qaytarish</Submit>
        <Submit name="decision" value="approve" className="btn okb">Qabul · +{pts}</Submit>
      </div>
    </ActionForm>
  );
}
