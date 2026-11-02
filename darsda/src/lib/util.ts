const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const WD_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: +g("year"), m: +g("month"), d: +g("day"),
    hh: g("hour") === "24" ? "00" : g("hour"), mm: g("minute"), wd: wdMap[g("weekday")] ?? 0,
  };
}

export function fmtDate(d: Date | string, tz: string) {
  const p = parts(new Date(d), tz);
  return `${p.d}-${MONTHS[p.m - 1]}`;
}
export function fmtTime(d: Date | string, tz: string) {
  const p = parts(new Date(d), tz);
  return `${p.hh}:${p.mm}`;
}
export function fmtDT(d: Date | string, tz: string) {
  return `${fmtDate(d, tz)}, ${fmtTime(d, tz)}`;
}
export function fmtDay(d: Date | string, tz: string) {
  const p = parts(new Date(d), tz);
  return `${WD[p.wd]}, ${p.d}-${MONTHS[p.m - 1]}`;
}
/** Mahalliy kun kaliti: 2026-11-02 */
export function dayKey(d: Date | string, tz: string) {
  const p = parts(new Date(d), tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
/** Haftaning kuni, 0 = dushanba */
export function weekdayMon(d: Date | string, tz: string) {
  return (parts(new Date(d), tz).wd + 6) % 7;
}

/** Mahalliy vaqtdagi "2026-11-02T18:00" ni UTC Date ga aylantiradi */
export function localToUtc(local: string, tz: string) {
  const asUtc = new Date(local + (local.length === 16 ? ":00" : "") + "Z");
  const p = parts(asUtc, tz);
  const shown = Date.UTC(p.y, p.m - 1, p.d, +p.hh, +p.mm);
  return new Date(asUtc.getTime() - (shown - asUtc.getTime()));
}
/** UTC Date → <input type=datetime-local> qiymati */
export function utcToLocalInput(d: Date | string | null, tz: string) {
  if (!d) return "";
  const p = parts(new Date(d), tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${p.hh}:${p.mm}`;
}

export function left(d: Date | string) {
  const ms = new Date(d).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const days = Math.floor(h / 24);
  const txt = days >= 1 ? `${days} kun` : h >= 1 ? `${h} soat` : `${Math.max(1, Math.floor(abs / 60000))} daqiqa`;
  return ms >= 0 ? `${txt} qoldi` : `${txt} o'tdi`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
}

export function plural(n: number, w: string) {
  return `${n} ${w}`;
}

export const KIND_LABEL: Record<string, string> = {
  file: "Fayl / rasm",
  text: "Matn",
  link: "Havola",
  workbook: "Workbook",
  repeat: "Takroriy (kunlik/haftalik)",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Tekshirilmoqda",
  approved: "Qabul qilindi",
  rejected: "Qaytarildi",
  cancelled: "Bekor qilindi",
};

/** Admin yozgan HTML'ni xavfsizlashtiradi (script, iframe, on* atributlar, javascript: havolalar olib tashlanadi).
 *  Oddiy matn bo'lsa — paragraflarga bo'linadi. */
export function safeHtml(src: string) {
  if (!src) return "";
  if (!/<[a-z]/i.test(src)) {
    const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  }
  return src
    .replace(/<\s*(script|style|iframe|object|embed|form|input|textarea|button|link|meta|base)\b[\s\S]*?(<\/\s*\1\s*>|\/?>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}
