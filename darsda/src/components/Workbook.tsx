"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Workbook as WB, WbField } from "@/lib/course";
import { submitWorkbook } from "@/app/actions/student";

type Data = Record<string, unknown>;

export function Workbook({ taskId, wb, initial, readOnly }: { taskId: number; wb: WB; initial: Data; readOnly: boolean }) {
  const [data, setData] = useState<Data>(initial);
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (readOnly) return;
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch("/api/wb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: taskId, data }) });
      setSaved("saved");
    }, 1000);
    return () => clearTimeout(timer.current);
  }, [data, taskId, readOnly]);

  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const total = wb.sections.reduce((s, x) => s + (x.f?.length ?? 0), 0);
  const filled = wb.sections.reduce((s, x) => s + (x.f ?? []).filter((f) => isFilled(f, data[f.k])).length, 0);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card tight">
        <div className="row between">
          <span className="sub small">To&apos;ldirildi: {filled}/{total}</span>
          <span className="tiny muted">{readOnly ? "Yuborilgan" : saved === "saving" ? "Saqlanmoqda…" : saved === "saved" ? "✓ Saqlandi" : "Avtomatik saqlanadi"}</span>
        </div>
        <div className="progress"><i style={{ width: `${total ? (filled / total) * 100 : 0}%` }} /></div>
      </div>

      {wb.sections.map((s, i) => (
        <div className="card" key={i}>
          <div className="row" style={{ gap: 10 }}>
            <span className="num now">{i + 1}</span>
            <h2 className="h2 grow">{s.t}</h2>
          </div>
          {s.quote && <div className="quote">{s.quote}</div>}
          {s.theory?.map((h, j) => (
            <details key={j} className="stack">
              <summary className="pill info" style={{ alignSelf: "flex-start" }}>📖 Nazariya {s.theory!.length > 1 ? j + 1 : ""}</summary>
              <div className="prose" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: h }} />
            </details>
          ))}
          {(s.f ?? []).map((f) => (
            <Field key={f.k} f={f} v={data[f.k]} set={(v) => set(f.k, v)} ro={readOnly} />
          ))}
        </div>
      ))}

      {!readOnly && (
        <div className="stack">
          <button
            className="btn full"
            disabled={pending}
            onClick={() => start(async () => {
              await fetch("/api/wb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: taskId, data }) });
              const fd = new FormData();
              fd.set("task_id", String(taskId));
              setMsg(await submitWorkbook(undefined, fd));
            })}
          >
            {pending ? "Yuborilmoqda…" : "Workbookni yuborish"}
          </button>
          {msg?.error && <div className="err">{msg.error}</div>}
          {msg?.ok && <div className="okmsg">{msg.ok}</div>}
        </div>
      )}
    </div>
  );
}

function isFilled(f: WbField, v: unknown) {
  if (f.t === "table") return Array.isArray(v) && (v as string[][]).some((r) => r?.some((c) => c?.trim()));
  if (f.t === "chips") return Array.isArray(v) && v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function Field({ f, v, set, ro }: { f: WbField; v: unknown; set: (v: unknown) => void; ro: boolean }) {
  const [reveal, setReveal] = useState(false);
  const label = <div className="h3" style={{ fontSize: 15, lineHeight: 1.35 }}>{f.l}</div>;

  if (f.t === "text")
    return <label className="field">{label}<input className="input" value={String(v ?? "")} onChange={(e) => set(e.target.value)} readOnly={ro} /></label>;
  if (f.t === "area" || f.t === "recall")
    return (
      <div className="field">
        {label}
        <textarea className="input" rows={4} value={String(v ?? "")} onChange={(e) => set(e.target.value)} readOnly={ro} />
        {f.t === "recall" && f.a && (String(v ?? "").trim() || ro) && (
          reveal ? <div className="okmsg small">{f.a}</div>
            : <button type="button" className="btn sm soft" style={{ alignSelf: "flex-start" }} onClick={() => setReveal(true)}>Javobni ko&apos;rish</button>
        )}
      </div>
    );
  if (f.t === "quiz") {
    const sel = v === undefined || v === null || v === "" ? -1 : Number(v);
    return (
      <div className="field">
        {label}
        <div className="stack" style={{ gap: 6 }}>
          {f.o?.map((o, i) => {
            const show = sel >= 0;
            const cls = show && i === f.c ? "okmsg" : show && i === sel ? "err" : "";
            return (
              <button type="button" key={i} disabled={ro || show} onClick={() => set(i)}
                className={`input ${cls}`} style={{ textAlign: "left", border: sel === i ? "1px solid var(--brand)" : undefined }}>
                {o}
              </button>
            );
          })}
        </div>
        {sel >= 0 && f.x && <div className="tiny sub">{f.x}</div>}
      </div>
    );
  }
  if (f.t === "chips") {
    const arr = Array.isArray(v) ? (v as number[]) : [];
    return (
      <div className="field">
        {label}
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {f.o?.map((o, i) => {
            const on = arr.includes(i);
            return (
              <button type="button" key={i} disabled={ro} className={`pill ${on ? "ok" : ""}`} style={{ border: 0, padding: "8px 12px", fontSize: 13 }}
                onClick={() => set(f.multi ? (on ? arr.filter((x) => x !== i) : [...arr, i]) : on ? [] : [i])}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // table
  const cols = f.cols ?? ["Javob"];
  const rowsData = Array.isArray(v) ? (v as string[][]) : [];
  const nRows = Math.max(f.rows?.length ?? 0, rowsData.length, f.rows ? 0 : f.dyn ?? 3);
  const setCell = (r: number, c: number, val: string) => {
    const next = Array.from({ length: Math.max(nRows, r + 1) }, (_, i) => [...(rowsData[i] ?? Array(cols.length).fill(""))]);
    next[r][c] = val;
    set(next);
  };
  return (
    <div className="field">
      {label}
      <div className="stack" style={{ gap: 10 }}>
        {Array.from({ length: nRows }, (_, r) => (
          <div key={r} className="stack" style={{ gap: 6, background: "var(--sunk)", borderRadius: 14, padding: 10 }}>
            {f.rows?.[r] && <div className="small" style={{ fontWeight: 600 }}>{f.rows[r]}</div>}
            {cols.map((c, ci) => (
              <textarea key={ci} className="input" rows={1} placeholder={cols.length > 1 || !f.rows ? c : "Javob"}
                style={{ minHeight: 44, background: "var(--card)" }}
                value={rowsData[r]?.[ci] ?? ""} onChange={(e) => setCell(r, ci, e.target.value)} readOnly={ro} />
            ))}
          </div>
        ))}
        {!f.rows && !ro && (
          <button type="button" className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => setCell(nRows, 0, "")}>+ Qator</button>
        )}
      </div>
    </div>
  );
}
