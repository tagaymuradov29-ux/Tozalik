/** Ballar animatsiyasining 10 xil varianti. Kurs egasi «Dizayn» bo'limida birini tanlaydi.
 *  Hammasida bir xil mantiq: ball oshgan sari qahramon yuqoriga ko'tariladi; 1-maqsad va oxirgi maqsad — chiziqlar,
 *  o'ngda dars kataklari shkalasi, yon tomonda amaliy vazifalar belgilari. */
export type Journey = {
  key: string;
  title: string;            // sukut bo'yicha modul nomi
  emoji: string;            // bosh sahifa kartasi ikonkasi
  banner: [string, string]; // karta gradienti
  sky: string[];            // fon gradienti (tepadan pastga)
  dark: boolean;            // fon qorong'i — yozuvlar oq
  stars?: boolean;
  scene?: "mountain" | "tower" | "road" | "water" | "hills";
  lines: [string, string, string, string, string]; // pastdan: start, 2 oraliq, 1-maqsad, oxirgi maqsad
  goal: string;             // tepadagi belgi
  mover: string | string[]; // qahramon (massiv — ball oshgan sari almashadi)
  rot?: number;             // qahramonni burish (radian)
  sat: string;              // amaliy vazifa belgisi
  deco: string;             // suzib yuruvchi bezak
  gauge: string;            // o'ngdagi shkala nomi
  who: string;              // izohda: «Raketangiz», «Alpinistingiz»...
};

export const JOURNEYS: Journey[] = [
  { key: "kosmos", title: "Bozorga parvoz", emoji: "🚀", banner: ["#0B1430", "#2F5E9E"], sky: ["#060A1C", "#14214A", "#2F5E9E", "#7FB7E6", "#CDEBFA"], dark: true, stars: true,
    lines: ["YER", "BULUTLAR", "STRATOSFERA", "ORBITA", "OY"], goal: "🌕", mover: "rocket", sat: "🛰️", deco: "☁️", gauge: "YOQILG'I", who: "Raketangiz" },
  { key: "tog", title: "Cho'qqi sari", emoji: "🏔️", banner: ["#1B5E20", "#7CB342"], sky: ["#7EC8F2", "#B8E1F8", "#E3F3FC", "#CFE3C4", "#8DB77A"], dark: false, scene: "mountain",
    lines: ["ETAK", "O'RMON", "QOYALAR", "DOVON", "CHO'QQI"], goal: "🚩", mover: "🧗", sat: "⛺", deco: "☁️", gauge: "KUCH", who: "Alpinistingiz" },
  { key: "bog", title: "Bilim daraxti", emoji: "🌳", banner: ["#2E7D32", "#9CCC65"], sky: ["#D7F5E0", "#E9FAEE", "#F6FFF4", "#E3F2D0", "#A5C882"], dark: false, scene: "hills",
    lines: ["URUG'", "NIHOL", "KO'CHAT", "GULLASH", "HOSIL"], goal: "🍎", mover: ["🌱", "🌿", "🪴", "🌳", "🌳"], sat: "🐝", deco: "🦋", gauge: "SUV", who: "Daraxtingiz" },
  { key: "shar", title: "Havo shari", emoji: "🎈", banner: ["#FF7E5F", "#FEB47B"], sky: ["#FF9A8B", "#FFC3A0", "#FFE29F", "#BFE6FF", "#E8F7FF"], dark: false, scene: "hills",
    lines: ["YER", "DARAXTLAR", "BULUTLAR", "QUSHLAR YO'LI", "QUYOSH"], goal: "☀️", mover: "🎈", sat: "🪁", deco: "☁️", gauge: "GAZ", who: "Sharingiz" },
  { key: "samolyot", title: "Orzular parvozi", emoji: "✈️", banner: ["#1565C0", "#42A5F5"], sky: ["#0D47A1", "#1E88E5", "#64B5F6", "#BBDEFB", "#E3F2FD"], dark: true,
    lines: ["AEROPORT", "UCHISH", "BULUTLAR", "BALANDLIK", "MANZIL"], goal: "🏝️", mover: "✈️", rot: -Math.PI / 4, sat: "🪂", deco: "☁️", gauge: "YOQILG'I", who: "Samolyotingiz" },
  { key: "bino", title: "Osmono'par", emoji: "🏙️", banner: ["#263238", "#78909C"], sky: ["#1A237E", "#3949AB", "#7986CB", "#C5CAE9", "#ECEFF1"], dark: true, stars: true, scene: "tower",
    lines: ["1-QAVAT", "OFIS", "BIZNES-MARKAZ", "TOM", "OSMON"], goal: "🚁", mover: "🧑‍💼", sat: "⭐", deco: "☁️", gauge: "ENERGIYA", who: "Siz" },
  { key: "okean", title: "Chuqurlikdan yuzaga", emoji: "🐳", banner: ["#01579B", "#26C6DA"], sky: ["#B3E5FC", "#4FC3F7", "#0288D1", "#01579B", "#002F6C"], dark: true, scene: "water",
    lines: ["TUBI", "QORONG'ULIK", "MARJONLAR", "YORUG'LIK", "YUZA"], goal: "☀️", mover: "🐳", sat: "🐚", deco: "🫧", gauge: "HAVO", who: "Kitingiz" },
  { key: "poyga", title: "Marra sari", emoji: "🏎️", banner: ["#212121", "#E53935"], sky: ["#90CAF9", "#C5E1A5", "#AED581", "#9CCC65", "#7CB342"], dark: false, scene: "road",
    lines: ["START", "1-AYLANMA", "2-AYLANMA", "PIT-STOP", "MARRA"], goal: "🏁", mover: "🏎️", rot: -Math.PI / 2, sat: "⛽", deco: "🌳", gauge: "BENZIN", who: "Mashinangiz" },
  { key: "burgut", title: "Burgut parvozi", emoji: "🦅", banner: ["#4E342E", "#FFB74D"], sky: ["#FFCC80", "#FFE0B2", "#FFF3E0", "#D7CCC8", "#A1887F"], dark: false, scene: "mountain",
    lines: ["IN", "DARAXTLAR", "QOYALAR", "BULUTLAR", "QUYOSH"], goal: "☀️", mover: "🦅", sat: "🪶", deco: "☁️", gauge: "KUCH", who: "Burgutingiz" },
  { key: "sehr", title: "Sehrli yo'l", emoji: "🐉", banner: ["#4A148C", "#BA68C8"], sky: ["#12002F", "#2E0854", "#5B2A86", "#9C6ADE", "#E1C8FF"], dark: true, stars: true, scene: "mountain",
    lines: ["QISHLOQ", "O'RMON", "TOG'LAR", "BULUTLAR", "QAL'A"], goal: "🏰", mover: "🐉", sat: "🔮", deco: "✨", gauge: "SEHR", who: "Ajdaringiz" },
];

export const journey = (key?: string | null) => JOURNEYS.find((j) => j.key === key) ?? JOURNEYS[0];

/** Eng ko'p ishlatiladigan shriftlar — lotin va kirill harflarini qo'llaydi */
export const FONTS = [
  { key: "", name: "Standart (Onest)", family: "" },
  { key: "Inter", name: "Inter", family: "Inter" },
  { key: "Onest", name: "Onest", family: "Onest" },
  { key: "Roboto", name: "Roboto", family: "Roboto" },
  { key: "Montserrat", name: "Montserrat", family: "Montserrat" },
  { key: "Manrope", name: "Manrope", family: "Manrope" },
  { key: "Nunito", name: "Nunito", family: "Nunito" },
  { key: "Open Sans", name: "Open Sans", family: "Open Sans" },
  { key: "Rubik", name: "Rubik", family: "Rubik" },
  { key: "Golos Text", name: "Golos Text", family: "Golos Text" },
  { key: "Raleway", name: "Raleway", family: "Raleway" },
  { key: "Poppins", name: "Poppins", family: "Poppins" },
  { key: "Ubuntu", name: "Ubuntu", family: "Ubuntu" },
] as const;

export const fontUrl = (families: string[]) =>
  "https://fonts.googleapis.com/css2?" + families.filter(Boolean).map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&") + "&display=swap";

/** Tayyor ranglar */
export const COLORS: [string, string][] = [
  ["#3390EC", "Telegram ko'k"], ["#1F6FC4", "To'q ko'k"], ["#0EA5E9", "Osmon"], ["#06B6D4", "Feruza"],
  ["#0E9AA7", "Dengiz"], ["#10B981", "Zumrad"], ["#0B5D46", "O'rmon"], ["#65A30D", "Yashil choy"],
  ["#F59E0B", "Oltin"], ["#F08C00", "Apelsin"], ["#EA580C", "Mandarin"], ["#E0463E", "Qizil"],
  ["#DB2777", "Pushti"], ["#C2185B", "Malina"], ["#A21CAF", "Fuksiya"], ["#7B3FE4", "Binafsha"],
  ["#4F46E5", "Indigo"], ["#1F3864", "Dengiz floti"], ["#475569", "Grafit"], ["#111827", "Qora"],
];
