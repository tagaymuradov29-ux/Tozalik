import "server-only";
import { cache } from "react";
import { sql } from "./db";
import { FONTS, journey } from "./journeys";

/** Yoqib-o'chiriladigan modullar. Har bir mijoz o'ziga keraklisini tanlaydi va nomini o'zgartira oladi. */
export const MODS = [
  { key: "parvoz", label: "Bozorga parvoz", emoji: "🚀", about: "Ballar raketa ko'rinishida: orbita va Oy — kurs maqsadlari", why: "O'quvchi o'z o'sishini ko'radi — maqsadga intilish kuchayadi" },
  { key: "osmon", label: "Tanishuvlar osmoni", emoji: "✨", about: "Networking tanishuvlari yulduzlar xaritasida", why: "Tanishuvlar ko'rinadigan bo'ladi — o'quvchilar faolroq tanishadi" },
  { key: "networking", label: "Networking", emoji: "🤝", about: "Har hafta juftliklar, isbot va ball", why: "O'quvchilar bir-biri bilan tanishadi, jamoa va sodiqlik oshadi" },
  { key: "workshop", label: "Workshop", emoji: "🏆", about: "Jamoaviy topshiriq va ovoz berish", why: "Jamoada ishlash va raqobat — darsdan keyin ham qiziqish" },
  { key: "chat", label: "Chat", emoji: "💬", about: "Guruh chati va kurator bilan yozishma", why: "Savollar platforma ichida qoladi — Telegram'ga chiqib ketmaydi" },
  { key: "reyting", label: "Reyting", emoji: "📊", about: "O'quvchilar o'rtasida ball bo'yicha o'rinlar", why: "Raqobat — vazifalarni o'z vaqtida bajarishga undaydi" },
] as const;
export type ModKey = (typeof MODS)[number]["key"];

export type Settings = {
  logo?: string;          // kichik rasm (data:image/...), 256px gacha
  welcome?: string;       // kirish sahifasidagi matn
  mods?: Partial<Record<ModKey, boolean>>;
  labels?: Partial<Record<ModKey, string>>;
  font?: string;          // FONTS dagi kalit ("" — standart)
  journey?: string;       // ballar animatsiyasi varianti (JOURNEYS)
  tint?: boolean;         // fon platforma rangida biroz bo'yalgan
  road?: string;          // yo'l xaritasi manzarasi (ROAD_CHOICES)
};

export type Brand = { id: number; slug: string; name: string; color: string; settings: Settings };

export const getBrand = cache(async (pid: number | null): Promise<Brand | null> => {
  if (!pid) return null;
  const [p] = await sql<Brand[]>`select id, slug, name, color, settings from platforms where id = ${pid}`;
  return p ?? null;
});

export const brandBySlug = cache(async (slug: string): Promise<Brand | null> => {
  const [p] = await sql<Brand[]>`select id, slug, name, color, settings from platforms where slug = ${slug.toLowerCase()}`;
  return p ?? null;
});

/** Modul yoqilganmi (sukut bo'yicha — hammasi yoqilgan) */
export const on = (b: Brand | null, k: ModKey) => b?.settings?.mods?.[k] !== false;
/** Modulning mijoz bergan nomi yoki asl nomi */
export const label = (b: Brand | null, k: ModKey) =>
  b?.settings?.labels?.[k]?.trim() || (k === "parvoz" ? journey(b?.settings?.journey).title : MODS.find((m) => m.key === k)!.label);

/** Tanlangan shrift (Google Fonts nomi) yoki bo'sh */
export const fontOf = (b: Brand | null) => FONTS.find((f) => f.key === b?.settings?.font)?.family ?? "";

export const okColor = (c: string | null | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : "#3390EC");

/** Platforma rangini butun ilovaga qo'llaydigan CSS (kunduzgi va tungi rejim uchun) */
export function brandCss(color: string, font = "", tint = false) {
  const c = okColor(color);
  const f = font ? `:root:root:root { --font: "${font.replace(/[^a-zA-Z ]/g, "")}", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }` : "";
  const bgL = tint ? `--bg: color-mix(in srgb, ${c} 6%, #f4f6f9);` : "";
  const bgD = tint ? `--bg: color-mix(in srgb, ${c} 10%, #0d1220);` : "";
  const dark = `${bgD} --brand: color-mix(in srgb, ${c} 78%, #fff); --brand-ink: color-mix(in srgb, ${c} 55%, #fff);
    --brand-soft: color-mix(in srgb, ${c} 24%, #161d2f); --fab: var(--brand); --blue: var(--brand-ink); --blue-soft: var(--brand-soft);`;
  return `${f} :root { ${bgL} --brand: ${c}; --brand-ink: color-mix(in srgb, ${c} 80%, #000); --brand-soft: color-mix(in srgb, ${c} 11%, #fff);
    --chart-on: ${c}; --blue: var(--brand-ink); --blue-soft: var(--brand-soft);
    --fab: color-mix(in srgb, ${c} 72%, #000); --fab-shadow: color-mix(in srgb, ${c} 40%, transparent); }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }
  :root[data-theme="dark"] { ${dark} }`;
}
