/** Kurs yo'nalishlari va til paketi ma'lumotlari (server va brauzerda ishlatiladi) */

export const CATEGORIES = [
  { key: "til", name: "Til", emoji: "🗣️", about: "Lug'at, talaffuz, AI bilan suhbat" },
  { key: "marketing", name: "Marketing", emoji: "📈", about: "Strategiya, kontent, reklama" },
  { key: "sotuv", name: "Sotuv va biznes", emoji: "💼", about: "Sotuv bo'limi, boshqaruv" },
  { key: "it", name: "IT va dasturlash", emoji: "💻", about: "Kod, dizayn, AI vositalari" },
  { key: "boshqa", name: "Boshqa", emoji: "✨", about: "Istalgan yo'nalish" },
] as const;

export type LangInfo = { key: string; name: string; flag: string; speech: string; rtl?: boolean };
export const LANGS: LangInfo[] = [
  { key: "en", name: "Ingliz tili", flag: "🇬🇧", speech: "en-US" },
  { key: "ru", name: "Rus tili", flag: "🇷🇺", speech: "ru-RU" },
  { key: "ar", name: "Arab tili", flag: "🇸🇦", speech: "ar-SA", rtl: true },
  { key: "tr", name: "Turk tili", flag: "🇹🇷", speech: "tr-TR" },
  { key: "de", name: "Nemis tili", flag: "🇩🇪", speech: "de-DE" },
  { key: "ko", name: "Koreys tili", flag: "🇰🇷", speech: "ko-KR" },
  { key: "zh", name: "Xitoy tili", flag: "🇨🇳", speech: "zh-CN" },
];
export const langOf = (k?: string | null) => LANGS.find((l) => l.key === k) ?? null;
export const catOf = (k?: string | null) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[CATEGORIES.length - 1];

/** Talaffuzni solishtirish uchun matnni tozalash: kichik harf, tinish belgilari va arabcha harakatlarsiz */
export function norm(s: string) {
  return s.toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")       // arabcha harakatlar va tatvil
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** 0–100: aytilgan matn kerakli so'zga qanchalik yaqin (Levenshtein bo'yicha) */
export function similarity(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const m = x.length, n = y.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return Math.max(0, Math.round((1 - prev[n] / Math.max(m, n)) * 100));
}

/** Boshlang'ich so'zlar: [so'z, tarjima, o'qilishi] — kurs yaratilganda namuna sifatida qo'shiladi */
export const STARTER: Record<string, [string, string, string][]> = {
  en: [
    ["hello", "salom", "/həˈloʊ/"], ["thank you", "rahmat", "/ˈθæŋk juː/"], ["please", "iltimos", "/pliːz/"], ["yes", "ha", "/jes/"],
    ["no", "yo'q", "/noʊ/"], ["water", "suv", "/ˈwɔːtər/"], ["book", "kitob", "/bʊk/"], ["family", "oila", "/ˈfæməli/"],
    ["friend", "do'st", "/frend/"], ["work", "ish", "/wɜːrk/"], ["house", "uy", "/haʊs/"], ["city", "shahar", "/ˈsɪti/"],
    ["money", "pul", "/ˈmʌni/"], ["time", "vaqt", "/taɪm/"], ["today", "bugun", "/təˈdeɪ/"], ["tomorrow", "ertaga", "/təˈmɑːroʊ/"],
    ["learn", "o'rganmoq", "/lɜːrn/"], ["speak", "gapirmoq", "/spiːk/"], ["beautiful", "chiroyli", "/ˈbjuːtɪfl/"], ["important", "muhim", "/ɪmˈpɔːrtnt/"],
  ],
  ru: [
    ["привет", "salom", "privet"], ["спасибо", "rahmat", "spasibo"], ["пожалуйста", "iltimos", "pojaluysta"], ["да", "ha", "da"],
    ["нет", "yo'q", "net"], ["вода", "suv", "voda"], ["книга", "kitob", "kniga"], ["семья", "oila", "semya"],
    ["друг", "do'st", "drug"], ["работа", "ish", "rabota"], ["дом", "uy", "dom"], ["город", "shahar", "gorod"],
    ["деньги", "pul", "dengi"], ["время", "vaqt", "vremya"], ["сегодня", "bugun", "sevodnya"], ["завтра", "ertaga", "zavtra"],
    ["учиться", "o'qimoq", "uchitsya"], ["говорить", "gapirmoq", "govorit"], ["красивый", "chiroyli", "krasiviy"], ["важный", "muhim", "vajniy"],
  ],
  ar: [
    ["مَرْحَبًا", "salom", "marhaban"], ["شُكْرًا", "rahmat", "shukran"], ["مِنْ فَضْلِكَ", "iltimos", "min fadlika"], ["نَعَمْ", "ha", "na'am"],
    ["لَا", "yo'q", "laa"], ["مَاء", "suv", "maa'"], ["كِتَاب", "kitob", "kitaab"], ["عَائِلَة", "oila", "'aa'ila"],
    ["صَدِيق", "do'st", "sadiiq"], ["عَمَل", "ish", "'amal"], ["بَيْت", "uy", "bayt"], ["مَدِينَة", "shahar", "madiina"],
    ["مَال", "pul", "maal"], ["وَقْت", "vaqt", "waqt"], ["اَلْيَوْم", "bugun", "al-yawm"], ["غَدًا", "ertaga", "ghadan"],
    ["كِتَابَة", "yozish", "kitaaba"], ["قِرَاءَة", "o'qish", "qiraa'a"], ["جَمِيل", "chiroyli", "jamiil"], ["مُهِمّ", "muhim", "muhimm"],
  ],
  tr: [
    ["merhaba", "salom", "merhaba"], ["teşekkürler", "rahmat", "teshekkyurler"], ["lütfen", "iltimos", "lyutfen"], ["evet", "ha", "evet"],
    ["hayır", "yo'q", "hayir"], ["su", "suv", "su"], ["kitap", "kitob", "kitap"], ["aile", "oila", "aile"],
    ["arkadaş", "do'st", "arkadash"], ["iş", "ish", "ish"], ["ev", "uy", "ev"], ["şehir", "shahar", "shehir"],
    ["para", "pul", "para"], ["zaman", "vaqt", "zaman"], ["bugün", "bugun", "bugyun"], ["yarın", "ertaga", "yarin"],
    ["öğrenmek", "o'rganmoq", "o'renmek"], ["konuşmak", "gapirmoq", "konushmak"], ["güzel", "chiroyli", "gyuzel"], ["önemli", "muhim", "o'nemli"],
  ],
};

/** Arab alifbosi: harf, nomi (arabcha — talaffuz uchun), lotincha, bog'lanmaydigan harfmi, izoh */
export const ARABIC: { ch: string; name: string; lat: string; solo?: boolean; tip?: string }[] = [
  { ch: "ا", name: "أَلِف", lat: "alif · a", solo: true }, { ch: "ب", name: "بَاء", lat: "ba · b" }, { ch: "ت", name: "تَاء", lat: "ta · t" },
  { ch: "ث", name: "ثَاء", lat: "tha · s", tip: "Til uchi tishlar orasida, inglizcha «think»dagi kabi" },
  { ch: "ج", name: "جِيم", lat: "jim · j" }, { ch: "ح", name: "حَاء", lat: "ḥa · h", tip: "Bo'g'izdan, xirillamasdan kuchli «h»" },
  { ch: "خ", name: "خَاء", lat: "kha · x", tip: "O'zbekcha «x» kabi" }, { ch: "د", name: "دَال", lat: "dal · d", solo: true },
  { ch: "ذ", name: "ذَال", lat: "dhal · z", solo: true, tip: "Til uchi tishlar orasida, inglizcha «this»dagi kabi" },
  { ch: "ر", name: "رَاء", lat: "ra · r", solo: true }, { ch: "ز", name: "زَاي", lat: "zay · z", solo: true }, { ch: "س", name: "سِين", lat: "sin · s" },
  { ch: "ش", name: "شِين", lat: "shin · sh" }, { ch: "ص", name: "صَاد", lat: "ṣad · s", tip: "Qalin, yo'g'on «s»" },
  { ch: "ض", name: "ضَاد", lat: "ḍad · d", tip: "Qalin, yo'g'on «d»" }, { ch: "ط", name: "طَاء", lat: "ṭa · t", tip: "Qalin «t»" },
  { ch: "ظ", name: "ظَاء", lat: "ẓa · z", tip: "Qalin «z», til tishlar orasida" }, { ch: "ع", name: "عَيْن", lat: "ʿayn · ʼ", tip: "Bo'g'izni siqib aytiladigan tovush" },
  { ch: "غ", name: "غَيْن", lat: "ghayn · g'", tip: "O'zbekcha «g'» kabi" }, { ch: "ف", name: "فَاء", lat: "fa · f" },
  { ch: "ق", name: "قَاف", lat: "qaf · q", tip: "Chuqur, bo'g'izga yaqin «q»" }, { ch: "ك", name: "كَاف", lat: "kaf · k" }, { ch: "ل", name: "لَام", lat: "lam · l" },
  { ch: "م", name: "مِيم", lat: "mim · m" }, { ch: "ن", name: "نُون", lat: "nun · n" }, { ch: "ه", name: "هَاء", lat: "ha · h", tip: "Yengil «h»" },
  { ch: "و", name: "وَاو", lat: "waw · v/u", solo: true }, { ch: "ي", name: "يَاء", lat: "ya · y/i" },
];
/** Harfning 4 shakli: alohida, boshida, o'rtasida, oxirida (tatvil «ـ» bilan) */
export const arForms = (ch: string, solo?: boolean) => solo ? [ch, ch, "ـ" + ch, "ـ" + ch] : [ch, ch + "ـ", "ـ" + ch + "ـ", "ـ" + ch];
export const HARAKAT: [string, string, string][] = [
  ["بَ", "Fatha", "ba"], ["بِ", "Kasra", "bi"], ["بُ", "Damma", "bu"], ["بْ", "Sukun", "b"], ["بّ", "Shadda", "bb"], ["بً", "Tanvin", "ban"],
];
