"use client";
import { useState, useTransition } from "react";
import { sendProof } from "@/app/actions/net";
import { compress } from "./SubmitForm";

/** Networking isboti: 1) Zoom skrinshoti yoki ikkovingiz ko'ringan selfi, 2) hamkor kontaktga saqlangan holati */
export function NetProof({ pairId, partner }: { pairId: number; partner: string }) {
  const [z, setZ] = useState<File | null>(null);
  const [k, setK] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const pick = (label: string, f: File | null, set: (f: File | null) => void) => (
    <label className="stack" style={{ gap: 6, flex: 1 }}>
      <span className="tiny sub">{label}</span>
      {f ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={URL.createObjectURL(f)} alt="" className="thumb" style={{ width: "100%", height: 110 }} />
      ) : (
        <span className="btn ghost" style={{ height: 110, flexDirection: "column", fontSize: 13 }}>📷<span>Rasm tanlash</span></span>
      )}
      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => set(e.target.files?.[0] ?? null)} />
    </label>
  );
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
        {pick("1. Zoom yoki selfi (ikkovingiz)", z, setZ)}
        {pick(`2. «${partner}» kontaktingizda`, k, setK)}
      </div>
      <button
        className="btn full"
        disabled={pending || !z || !k}
        onClick={() => start(async () => {
          const fd = new FormData();
          fd.set("pair_id", String(pairId));
          fd.append("files", await compress(z!));
          fd.append("files", await compress(k!));
          setMsg(await sendProof(undefined, fd));
        })}
      >
        {pending ? "Yuborilmoqda…" : "Isbotni yuborish"}
      </button>
      {msg?.error && <div className="err">{msg.error}</div>}
      {msg?.ok && <div className="okmsg">{msg.ok}</div>}
    </div>
  );
}
