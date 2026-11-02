# Darsda — onlayn kurslar platformasi

Menta kabi ko'p mijozli platforma: har bir mijoz (o'quv markazi, ekspert) o'z kurslari, guruhlari, o'quvchilari va kuratorlari bilan ishlaydi. Mantiq Real Marketing 6.0 botidan (rm-bot/rm6) umumlashtirilgan.

Telefonda **ilova (PWA)** sifatida ishlaydi: Safari → «Поделиться» → «На экран Домой».

## Rollar

| Rol | Nima qiladi |
|---|---|
| Super admin | Platformalar (mijozlar) yaratadi, har biriga admin beradi |
| Admin | Kurs, darslar, vazifalar, guruhlar, xodimlar, ball tizimi, davomat |
| Kurator | O'z guruhi: ishlarni tekshirish, davomat, bonus, eslatma, chat |
| O'quvchi | Darslar (video + konspekt), vazifa yuborish, workbook, davomat, chat, natijalar |

## Imkoniyatlar

- **Darslar**: video (Kinescope / YouTube / Vimeo / .mp4 — ko'rish progressi saqlanadi), konspekt, materiallar
- **Vazifalar**: fayl/rasm, matn, havola, **workbook** (RM6 formati: matn, jadval, test, recall, chips; avtomatik saqlash), **takroriy** (stories/reels — kunlik/haftalik limit)
- Muddat, kechikkanda ball chegarasi, avtomatik qabul yoki kurator tekshiruvi, bir xil faylni qayta yuborishdan himoya
- **Davomat**: har daqiqada almashadigan 6 xonali kod + QR (proyektor sahifasi), vaqtida/kechikdi/kelmadi/sababli, ballari sozlanadi
- **Ball tizimi**: vazifalar + davomat + bonus/jarima, reyting (guruh/kurs), haftalik/oylik grafik, maqsadlar (masalan 1800 — dostup)
- **Kurator paneli**: tekshirish navbati, qarzdorlar, o'quvchi kartasi, eslatma
- **Guruh chati**, bildirishnomalar, taklif havolalari (o'quvchi o'zi ro'yxatdan o'tadi)

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # qiymatlarni to'ldiring
npm run migrate              # bazani yaratadi va super adminni qo'shadi
npm run dev
```

## Muhit o'zgaruvchilari

| Nomi | Izoh |
|---|---|
| `DATABASE_URL` | Postgres (Neon, Supabase, Railway…) |
| `AUTH_SECRET` | Uzun tasodifiy satr (sessiya va davomat kodi uchun) |
| `SUPER_PHONE` | Super admin telefoni, masalan `998901234567` |
| `SUPER_PASSWORD` | Super admin paroli |

Vercel'da `npm run build` avval bazani migratsiya qiladi.

## Texnologiya

Next.js 15 (App Router, server actions), Postgres (`postgres` kutubxonasi), JWT-cookie sessiya. Fayllar hozircha Postgres'da saqlanadi (har biri ≤4 MB, rasmlar telefonda siqiladi).

## Keyingi bosqichlar

- Push-bildirishnomalar (iOS 16.4+ PWA) va avtomatik eslatmalar (cron)
- Networking (haftalik juftliklar, isbot, +ball), qarzdorlar bilan ishlash (lag), mukofotlar do'koni
- Fayllarni S3/Vercel Blob'ga ko'chirish, Kinescope API orqali aniq ko'rish analitikasi
- App Store / Play Market uchun Capacitor bilan o'rash
