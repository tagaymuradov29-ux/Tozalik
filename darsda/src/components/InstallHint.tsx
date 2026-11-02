"use client";
import { useEffect, useState } from "react";

/** iPhone'da ilova hali bosh ekranga qo'shilmagan bo'lsa — qanday qo'shishni ko'rsatadi */
export function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    setShow(!standalone);
  }, []);
  if (!show) return null;
  return (
    <div className="card tight" style={{ background: "var(--brand-soft)" }}>
      <div className="h3">📲 Ilovani telefonga o&apos;rnating</div>
      <div className="small sub">
        <b>iPhone:</b> Safari&apos;da pastdagi «Поделиться / Share» tugmasi → «На экран Домой / Add to Home Screen».<br />
        <b>Android:</b> Chrome menyusi (⋮) → «Ilovani o&apos;rnatish / Install app».
      </div>
    </div>
  );
}
