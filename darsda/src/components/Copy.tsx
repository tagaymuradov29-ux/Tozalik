"use client";
import { useState } from "react";

/** Taklif havolasini nusxalash yoki ulashish (telefonda — Telegram'ga yuborish oynasi ochiladi) */
export function CopyLink({ path, label }: { path: string; label: string }) {
  const [ok, setOk] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  return (
    <div className="row" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn sm soft"
        onClick={async () => {
          await navigator.clipboard?.writeText(url()).catch(() => {});
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
      >
        {ok ? "✓ Nusxalandi" : "Nusxa"}
      </button>
      <button
        type="button"
        className="btn sm ghost"
        onClick={() => {
          if (navigator.share) navigator.share({ title: label, text: label, url: url() }).catch(() => {});
          else window.open(`https://t.me/share/url?url=${encodeURIComponent(url())}&text=${encodeURIComponent(label)}`);
        }}
      >
        Ulashish
      </button>
    </div>
  );
}
