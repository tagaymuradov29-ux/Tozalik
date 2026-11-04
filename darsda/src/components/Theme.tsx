"use client";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "auto";
const BG = { light: "#F3F4F8", dark: "#0E0F1A" };

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "auto") {
    delete root.dataset.theme;
    document.cookie = "theme=; path=/; max-age=0";
  } else {
    root.dataset.theme = mode;
    document.cookie = `theme=${mode}; path=/; max-age=31536000; samesite=lax`;
  }
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? BG.dark : BG.light));
}

function current(): Mode {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
}
const isDark = (m: Mode) => m === "dark" || (m === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);

/** ☀️/🌙 — kunduzgi va tungi rejimni bir bosishda almashtiradi */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(isDark(current())), []);
  return (
    <button
      className="themebtn"
      aria-label={dark ? "Kunduzgi rejim" : "Tungi rejim"}
      onClick={() => { const next: Mode = isDark(current()) ? "light" : "dark"; apply(next); setDark(next === "dark"); }}
    >
      {dark === null ? "" : dark ? "☀️" : "🌙"}
    </button>
  );
}

/** Profil: Kunduzgi / Tungi / Avtomatik (telefon sozlamasi bo'yicha) */
export function ThemePicker() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => setMode(current()), []);
  const opts: [Mode, string, string][] = [["light", "☀️", "Kunduzgi"], ["dark", "🌙", "Tungi"], ["auto", "📱", "Avtomatik"]];
  return (
    <div className="themeseg">
      {opts.map(([m, ic, t]) => (
        <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => { apply(m); setMode(m); }}>
          <span style={{ fontSize: 17 }}>{ic}</span>{t}
        </button>
      ))}
    </div>
  );
}
