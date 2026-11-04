"use client";
import { useState } from "react";

/** Segmentli yorliqlar (Dars · Materiallar · Vazifa) — panellar serverda tayyorlanadi */
export function Tabs({ labels, children }: { labels: string[]; children: React.ReactNode[] }) {
  const [i, setI] = useState(0);
  return (
    <>
      <div className="seg" role="tablist">
        {labels.map((l, k) => (
          <button key={k} type="button" role="tab" aria-selected={i === k} className={i === k ? "on" : ""} onClick={() => setI(k)}>{l}</button>
        ))}
      </div>
      {children.map((c, k) => <div key={k} role="tabpanel" hidden={i !== k} className="stack" style={{ gap: 10 }}>{c}</div>)}
    </>
  );
}
