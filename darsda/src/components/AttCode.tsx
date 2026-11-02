"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Har daqiqada almashadigan davomat kodi va QR. QR telefon kamerasi bilan skanerlansa — ilovada kod avtomatik kiritiladi. */
export function AttCode({ lessonId, big }: { lessonId: number; big?: boolean }) {
  const [d, setD] = useState<{ code: string; left: number; came: number; late: number }>();
  const [qr, setQr] = useState("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/attcode?l=${lessonId}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok || stop) return;
      const j = await r.json();
      setD(j);
      setQr(await QRCode.toDataURL(`${window.location.origin}/davomat?c=${j.code}`, { margin: 1, width: big ? 520 : 260 }));
    };
    load();
    const t = setInterval(load, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [lessonId, big]);

  if (!d) return <div className="empty">Yuklanmoqda…</div>;
  return (
    <div className="stack" style={{ alignItems: "center", gap: big ? 24 : 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt="QR" style={{ width: big ? "min(60vh, 80vw)" : 220, height: "auto", borderRadius: 16, background: "#fff", padding: 8 }} />}
      <div className="code6" style={big ? { fontSize: "min(14vw, 120px)" } : undefined}>{d.code.slice(0, 3)} {d.code.slice(3)}</div>
      <div className="row" style={{ gap: 8 }}>
        <span className="pill">{d.left} soniyada yangilanadi</span>
        <span className="pill ok">Keldi: {d.came}</span>
        {d.late > 0 && <span className="pill warn">Kechikdi: {d.late}</span>}
      </div>
    </div>
  );
}
