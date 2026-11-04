"use client";
/** Brauzerning o'zidagi bepul ovoz: so'zni o'qib berish va o'quvchi aytganini tanish */

export function speak(text: string, lang: string, rate = 0.85) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate;
  const v = speechSynthesis.getVoices().find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}

type Rec = { lang: string; maxAlternatives: number; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export const canListen = () => typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

/** Bir marta tinglaydi va topilgan variantlarni qaytaradi */
export function listen(lang: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const W = window as unknown as Record<string, new () => Rec>;
    const C = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!C) return reject(new Error("unsupported"));
    const r = new C();
    r.lang = lang; r.maxAlternatives = 5; r.interimResults = false; r.continuous = false;
    let got: string[] = [];
    r.onresult = (e) => { const res = e.results[0]; got = Array.from({ length: res.length }, (_, i) => res[i].transcript); };
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => resolve(got);
    r.start();
    setTimeout(() => { try { r.stop(); } catch {} }, 6000);
  });
}

/** O'qib berish va tugashini kutish (robot gapirayotganini ko'rsatish uchun) */
export function speakWait(text: string, lang: string, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate;
    const v = speechSynthesis.getVoices().find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    const done = () => resolve();
    u.onend = done; u.onerror = done;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setTimeout(done, Math.min(12000, 1500 + text.length * 90));
  });
}
