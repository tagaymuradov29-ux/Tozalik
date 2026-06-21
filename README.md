# 🏠 Uy Tartibi Bot

Umumiy kvartira navbatchilik, hisobot va jarima boti (Telegram).

Har bir yashovchi ro'yxatdan o'tadi (ism + telefon), qoidalarga rozi bo'ladi,
admin tasdiqlaydi. Keyin har kuni avtomatik aylanma navbat bo'yicha vazifa
(dush / hojatxona+koridor / oshxona + shaxsiy xona) beriladi. Yashovchi
**ertalab 05:00 gacha** video hisobot yuboradi. Admin tasdiqlaydi yoki rad
etadi. Vaqtida hisobot bo'lmasa yoki rad etilsa — **100 000 so'm jarima**.

## Imkoniyatlar

- Ro'yxatdan o'tish: ism, telefon, qoidalarga rozilik; admin tasdiqlaydi
- **Tugmali menyu** (pastki reply keyboard): 📋 Mening vazifam, 📤 Hisobot yuborish, 🏠 Kvartiradagilar, 💸 Jarimalarim, ✈️ Viloyatga ketdim
- **Hisobot oqimi**: 📤 → turini tanlang (🧹 tozalik / 🍳 ovqat pishirdim → 🍽 idish yuvdim / 🚪 uydan chiqdim → 🔑 uyga keldim) → video yuboring
- **Bitta kishi — bitta vazifa**, 3 kunda navbat aylanadi (oshxona, hojatxona+koridor, dush, musor). Odam ko'p bo'lsa ortiqchasi shu siklda dam oladi. Admin'ga vazifa berilmaydi
- **Kvartiradagilar**: hamma a'zo bir-birining bugungi va so'nggi 7 kunlik atchotini ko'radi. Video hisobotlar guruhga ham tushadi (`/guruh` bilan ulanadi)
- **Jarimalar**: tozalik vazifasi bajarilmasa 100 000; eshik 100 000/80 000; ovqat 100 000 (admin qo'lda)/80 000
- **Viloyat**: ✈️ tugmasi → sana → o'sha kungacha vazifa yo'q; qaytish kuni "uyga keldingizmi?" so'raladi (uzaytirish mumkin), avtomatik qaytadi
- Admin buyruqlari: `/azolar`, `/arizalar`, `/jarimalar`, `/jarima_ber`, `/jarima_ochir`, `/guruh`, `/eslat`

> Guruhga atchotlar tushishi uchun: botni guruhga admin qiling va guruh ichida `/guruh` yuboring.

## Texnologiya

Python 3.10+, `python-telegram-bot` (v21), PostgreSQL (asyncpg). Railway uchun tayyor.

---

## 🚀 Railway'ga deploy qilish (qadamma-qadam)

### 1. Botni yarating (BotFather)
1. Telegramda [@BotFather](https://t.me/BotFather)'ga `/newbot` yozing.
2. Bot nomi va username bering. Sizga **token** beradi (masalan `123456789:AAE...`). Saqlang.

### 2. GitHub'ga joylash
Bu papkani GitHub repozitoriyga yuklang (yo'riqnoma pastda "Git buyruqlari" bo'limida).

### 3. Railway loyihasi
1. [railway.app](https://railway.app) → **Login** (GitHub bilan).
2. **New Project** → **Deploy from GitHub repo** → shu repozitoriyni tanlang.
3. Loyihaga **PostgreSQL** qo'shing: **New** → **Database** → **Add PostgreSQL**.
   Railway avtomatik `DATABASE_URL` o'zgaruvchisini beradi.

### 4. Muhit o'zgaruvchilari (Variables)
Bot servisining **Variables** bo'limiga quyidagilarni qo'shing:

| Nomi | Qiymati |
|------|---------|
| `BOT_TOKEN` | BotFather bergan token |
| `ADMIN_IDS` | Sizning Telegram ID'ingiz (botga `/id` yozsangiz ko'rsatadi) |
| `DATABASE_URL` | Postgres'dan avtomatik (`${{Postgres.DATABASE_URL}}`) |

Ixtiyoriy: `TIMEZONE` (standart `Asia/Tashkent`), `FINE_AMOUNT` (100000),
`ANNOUNCE_HOUR` (20), `REMIND_HOUR` (4), `DEADLINE_HOUR` (5).

### 5. Ishga tushadi
Railway avtomatik build qilib, botni ishga tushiradi. Telegramda botingizga
`/start` yozib sinab ko'ring. Admin ID'ingizni bilish uchun avval `/id` yozing,
keyin uni `ADMIN_IDS`'ga qo'yib, qayta deploy qiling.

---

## 💻 Lokal ishga tushirish

```bash
pip install -r requirements.txt
cp .env.example .env      # .env ichini to'ldiring
python bot.py
```

## Git buyruqlari (birinchi marta)

```bash
git init
git add .
git commit -m "Uy Tartibi bot"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/REPO.git
git push -u origin main
```
