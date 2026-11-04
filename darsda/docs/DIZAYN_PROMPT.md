# Darsda — dizayn uchun to'liq prompt

> Quyidagi matnni Claude'ning boshqa chatiga to'liq nusxalab bering.

---

Sen tajribali mahsulot dizayneri (UX/UI)san. Menga **«Darsda»** degan o'quv platformasining mobil interfeysini loyihalab ber. Avval savol berma — quyidagi tavsif asosida ishla, oxirida noaniq joylarni ro'yxat qilib so'ra.

## 1. Mahsulot nima
- «Darsda» — onlayn kurs egalari (ekspertlar, o'quv markazlar) sotib oladigan **o'quv platformasi**. Shiori: **«O'quv platformasi. Metodologiya bilan endi jonli bo'ladi.»**
- Oddiy platformalardan farqi: darslar shunchaki video ro'yxati emas. O'quvchining **yo'li jonli xaritada** ko'rinadi, ball va motivatsiya bor, kurator har o'quvchi **qayerda to'xtaganini** ko'radi, avtomatik eslatmalar ketadi, til kurslarida AI bilan suhbat bor.
- Bitta tizim, uch xil kirish joyi: **mobil veb-ilova (PWA)**, **Telegram Mini App** (xuddi shu ilova Telegram ichida) va bitta umumiy **«Darsda» Telegram boti** (eslatmalar, vazifa topshirish, guruhlarga hisobot).
- Bozor: O'zbekiston. Til: **o'zbek (lotin)**. Ekran: avvalo telefon (390×844), keyin planshet/kompyuter.
- Har bir mijoz (kurs egasi) o'z **brendini** qo'yadi: nom, logo, asosiy rang (20 tayyor rang + o'z rangi), shrift (12 ta), kunduzgi/tungi rejim. Dizayn tizimi shunga moslashuvchan bo'lishi kerak (rang — token).

## 2. Asosiy tamoyillar (eng muhimi)
1. **Soddalik.** Hozirgi bosh sahifa «bardak» — o'quvchi nima qayerdaligini tushunmayapti. Har ekranda bitta asosiy harakat bo'lsin.
2. **Tushunarlilik.** Har tugma «bossam nima bo'ladi» degan savolga javob bersin. Sozlamalarda har bir yoqish/o'chirish yonida qisqa tavsif: «Bu nima? Yoqsangiz nima beradi?»
3. **Jonlilik, lekin bolalarcha emas.** Animatsiya va o'yin elementlari bor, lekin uslub premium va tinch. Emojini kam ishlat.
4. **O'quvchi ustuvorliklari:** darsni ko'rish → vazifani topshirish → natijasini ko'rish → qayerda to'xtaganini bilish.
5. **Kurs yaratuvchi ustuvorliklari:** dars qo'shish (video + matn + materiallar), o'quvchilarni kuzatish, sozlash — hammasi Menta (menta.uz) darajasida oson.

## 3. Rollar va ularning ekranlari

### 3.1 Kirish (hamma rollar)
- Telefon raqam (+998 tanlangan) → ikki tugma: **«Kodni Telegram'ga yuborish»** va **«Kodni SMS orqali yuborish»** → 6 xonali kod kiritish ekrani (taymer, qayta yuborish).
- Bir raqamda bir nechta kurs/rol bo'lsa → **«Qaysi kursga kirmoqchisiz?»** ekrani (kurs kartochkalari: logo, nom, rol — o'quvchi/kurator/admin).
- Har platformaning o'z brendli kirish sahifasi (logo, nom, salomlashuv matni).

### 3.2 O'quvchi
- **Bosh sahifa** — 3 xil variant taklif qil. Taklif qilinayotgan tartib:
  1. Katta **«Davom etish»** kartasi: hozirgi dars, keyingi qadam («Konspektni yuborish», «Videoni tugatish 6:40 qoldi»), bitta katta tugma.
  2. **Yo'l xaritasi** — tabiat manzarasida ilon yo'li, raqamli bekatlar (1, 2, 3…), START va MARRA bayrog'i. Holatlar: yopilgan (yashil ✓ va bayroqcha), tekshiruvda (sariq), joriy (ko'k, «Siz shu yerdasiz» belgisi sakrab turadi), qarz (qizil «!»), yopiq (kulrang qulf). Manzaralar: «Bahor o'tloqi», «Yulduzli tun», «Koinot sayohati».
  3. **Natijam**: ball, guruhdagi o'rin, keyingi maqsadgacha qancha qoldi.
  - Qolgan narsalar (networking, workshop, ballar animatsiyasi) pastda kichik kartalar.
- **Darslar ro'yxati** va **dars sahifasi** (Menta uslubida): yuqorida video pleyer, ostida dars matni, ostida materiallar (fayllar, havolalar), ostida «Darsni yopish shartlari» chek-listi (darsga kelish, video ko'rish, konspekt, workbook, test — har biri holati bilan).
- **Vazifa topshirish**: matn, fayl/rasm, havola; holatlar: yuborilmagan, tekshiruvda, qabul qilindi (+ball), qaytarildi (kurator izohi bilan).
- **Workbook** (faqat ba'zi kurslarda): bo'limlarga bo'lingan savollar, jadval, test.
- **Natijalar**: ball tarkibi (davomat, vazifa, bonus, networking, workshop, jarimalar), reyting (guruh/hamma).
- **Ballar animatsiyasi** — 10 xil sahnadan biri (raketa → orbita → Oy; tog' cho'qqisi; bilim daraxti va h.k.): ball oshgan sari qahramon ko'tariladi.
- **Networking — «Tanishuvlar osmoni»**: har kursdosh yulduz, tanishilgan — yonadi, nur bilan bog'lanadi; shu haftaning sheriklari, isbot yuborish (2 ta rasm).
- **Workshop**: jamoaga yozilish, baholash, natija.
- **Bildirishnomalar** va **Profil** (chiqish, boshqa kursga/panelga o'tish, kunduzgi/tungi rejim).
- **AI kurator** chati: o'quvchi savol beradi, AI ekspert darslari asosida javob beradi (manbasi: qaysi dars).

### 3.3 Til kurslari uchun qo'shimcha (o'quvchi)
- **Lug'at kartochkalari**: so'z, transkripsiya, rasm, misol; bir bosishda tarjima ochiladi; **svayp**: o'ngga — bildim, chapga — bilmadim, tepaga — juda oson. Yo'nalish almashtirgich: «Inglizcha → O'zbekcha» / «O'zbekcha → Inglizcha».
- **«Bilmagan so'zlarim»** qutisi (alohida takrorlash).
- **Talaffuz**: so'zni eshitish, mikrofonga aytish, 0–100 baho.
- **Arab alifbosi**: 28 harf, 4 shakli, maxraj izohi, harakatlar.
- **AI bilan razgovor**: yoqimli robotcha (3 ta: Robi, Mushuk, Sova), **mikrofonni bosib turib gapirish** (push-to-talk), AI javobi ovozli va yozma; har javobdan keyin **xatolar tahlili** (grammatika, «bu so'z o'rniga mana bunisi» + variantlar) — tushuntirish asosan o'zbekcha, misollar o'rganilayotgan tilda; tavsiya qilingan so'zlar bir bosishda «Bilmagan so'zlarim»ga.
- **«Qanday aytaman?»** rejimi: o'quvchi o'zbekcha ovozli so'raydi → AI yozma variant beradi → «Mashq qilasizmi?» → o'quvchi o'qiydi → «Zo'r, yaxshi aksent».
- Tillar: ingliz, rus, arab (RTL!), turk.

### 3.4 Kurator
- Bosh sahifa: tekshirish kutayotganlar soni, guruh holati, **«Kim qayerda to'xtagan»** (jurnal).
- **Tekshirish**: ish kartasi (o'quvchi, vazifa, matn/fayl), ball, izoh, «Qabul qilish» / «Qaytarish».
- **Jurnal**: o'quvchilar × darslar issiqlik xaritasi.
- **Video analitika**: o'rtacha foiz, kim qancha ko'rdi, «qayerda to'xtashdi» grafigi (ko'pchilik to'xtagan joy qizil), har o'quvchining to'xtagan vaqti.
- Davomat (kod / QR), o'quvchi kartasi (yo'l xaritasi, ballar, eslatish tugmasi).

### 3.5 Admin (kurs egasi)
- **«Platformani sozlash» (Konstruktor)** — tayyorlik ro'yxati (progress): Brend → Dizayn → Kurs tuzilmasi → Darslar → Ball tizimi → Modullar → Guruhlar va kuratorlar → O'quvchilarni taklif qilish.
- **Kurs yaratish**: avval yo'nalish (Til / Marketing / Sotuv / IT / Boshqa), til bo'lsa — qaysi til; usul: jadval bo'yicha, mavjud kursdan nusxa, namuna.
- **Dars yaratish** (Menta darajasida oson): video yuklash (progress bilan), matn muharriri, video tagiga materiallar, vazifalar (konspekt, workbook, amaliy, test), muddatlar va ballar.
- **Gamifikatsiya sozlamalari**: har bir qoida yoqiladi/o'chiriladi va soni o'zgartiriladi (davomat ballari, kechikish jarimasi, vazifa ballari, bonus, workshop, networking, reyting, maqsadlar, stories/reels); **«O'z qoidangizni qo'shing»** (+/− ball beriladigan istalgan harakat). Har birida tavsif.
- **Bildirishnoma sozlamalari**: qaysi hodisa, kimga (o'quvchi/kurator/ega), qayerga (platforma/Telegram bot/Telegram guruh), qachon (masalan har kuni 20:00, dushanba). Masalan: «3 kun kirmadi», «darsni 2 kun ko'rmadi», «ko'pchilik videoning shu joyida to'xtadi», haftalik hisobot, guruhga qarzdorlar ro'yxati va guruhlar reytingi.
- **Til paketi**: lug'atni boshqarish (so'z — tarjima — transkripsiya — misol — rasm), darsga biriktirish, tayyor lug'atlar (masalan «4000 Essential Words»).
- **AI**: bilim bazasi (darslar avtomatik matnga o'giriladi + PDF yuklash), **haftalik metodologik tahlil** hisoboti («shu darsda ko'pchilik to'xtadi, sabab — …, tavsiya — …»).
- Dizayn: rang, shrift, ballar animatsiyasi (10 xil), yo'l xaritasi manzarasi (3 xil) — jonli namunasi bilan.

### 3.6 Super admin (platforma egasi)
- Mijozlar (platformalar) ro'yxati, yangi mijoz qo'shish, tarif, o'quvchilar soni, istalgan panelga «kirish» va o'quvchi ko'zi bilan ko'rish.

## 4. Telegram bot va Mini App
- Bitta «Darsda» boti hamma mijozlar uchun. O'quvchi botga kirib telefonini tasdiqlaydi → bot uning kurslarini taniydi va kurs sozlamalariga moslashadi.
- Botda: eslatmalar, vazifa topshirish (rasm/fayl/matn/ovoz), «Ilovani ochish» tugmasi (Mini App).
- Mini App — xuddi shu interfeys; Telegram ranglariga moslashadi, pastki menyu Telegram tugmalari bilan to'qnashmasin.

## 5. Mavjud vizual til (davom ettir yoki yaxshila)
- Promo uslubi: chuqur ko'k → binafsha gradient, yumshoq nur, uchqun-yulduzchalar, sariq urg'u (#FFE14D).
- Ilova ichi: oq/kulrang fon, kartalar 16–18px radius, Inter / Onest shrifti, pastki suzuvchi menyu (5 ta: Bugun, Darslar, + , Chat, Natijalar; kuratorda — Tekshirish, Guruh).

## 6. Mendan nima kutasan (natija)
1. **O'quvchi bosh sahifasining 3 varianti** (har birining afzalligi va kamchiligi bilan) — men tanlayman.
2. Har rol uchun **ekranlar xaritasi** (sitemap) va asosiy oqimlar (kirish → kurs tanlash → dars → vazifa → natija; kurator: tekshirish; admin: kurs va dars yaratish).
3. Har asosiy ekranning **wireframe**i, keyin yuqori sifatli maketi (telefon 390×844).
4. **Dizayn tizimi**: rang tokenlari (brend rangi o'zgaruvchan), tipografiya, tugmalar, kartalar, holat belgilari (yopilgan/tekshiruvda/joriy/qarz/yopiq), bo'sh holatlar, yuklanish, xatolar.
5. Tungi rejim variantlari.
6. Oxirida — noaniq joylar bo'yicha savollar ro'yxati.

Agar Figma'ga ulangan bo'lsang — maketlarni Figma'da yarat; bo'lmasa HTML/React prototip qilib ko'rsat.
