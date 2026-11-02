"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./Form";
import { saveBrand } from "@/app/actions/build";


/** Logoni telefonda 256px gacha kichraytiradi va matn (data:) ko'rinishida yuboradi */
async function shrink(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export function BrandForm({ name, slug, color, welcome, logo }: { name: string; slug: string; color: string; welcome: string; logo?: string }) {
  const c = color;
  const [n, setN] = useState(name);
  const [lg, setLg] = useState(logo ?? "");
  const [w, setW] = useState(welcome);
  const [rm, setRm] = useState(false);
  return (
    <ActionForm action={saveBrand}>
      {/* Jonli ko'rinish */}
      <div className="card tight" style={{ background: "var(--sunk)", alignItems: "center", textAlign: "center" }}>
        <div className="tiny muted">O&apos;quvchi kirish sahifasida shunday ko&apos;radi</div>
        {lg && !rm
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={lg} alt="" width={64} height={64} style={{ borderRadius: 16, objectFit: "contain", background: "#fff" }} />
          : <span style={{ width: 64, height: 64, borderRadius: 16, background: c, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 26 }}>{n.trim()[0]?.toUpperCase() ?? "?"}</span>}
        <b style={{ fontSize: 18 }}>{n || "Platforma nomi"}</b>
        {w && <span className="tiny sub">{w}</span>}
        <span className="btn sm" style={{ background: c, color: "#fff", pointerEvents: "none" }}>Kirish</span>
      </div>

      <label className="field"><span>Platforma nomi</span><input className="input" name="name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} /></label>
      <label className="field">
        <span>Kirish havolasi (lotin harflari)</span>
        <div className="row" style={{ gap: 6 }}><span className="tiny muted">…/k/</span><input className="input" name="slug" defaultValue={slug} maxLength={30} pattern="[a-zA-Z0-9-]+" /></div>
      </label>
      <label className="field"><span>Kirish sahifasidagi matn</span><textarea className="input" name="welcome" rows={2} maxLength={300} value={w} onChange={(e) => setW(e.target.value)} placeholder="Masalan: Real Marketing 6.0 o'quvchilari uchun" /></label>

      <div className="field">
        <span>Logo (kvadrat rasm yaxshi chiqadi)</span>
        <div className="row" style={{ gap: 8 }}>
          <label className="btn sm soft" style={{ cursor: "pointer" }}>
            Rasm tanlash
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setLg(await shrink(f)); setRm(false); } }} />
          </label>
          {lg && !rm && <button type="button" className="btn sm ghost" onClick={() => setRm(true)}>Olib tashlash</button>}
        </div>
        <input type="hidden" name="logo" value={lg.startsWith("data:") && lg !== logo ? lg : ""} />
        <input type="hidden" name="logo_remove" value={rm ? "1" : ""} />
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Rang, shrift va ballar animatsiyasi — «🎨 Dizayn» bo&apos;limida.</p>
      <Submit>Saqlash</Submit>
    </ActionForm>
  );
}
