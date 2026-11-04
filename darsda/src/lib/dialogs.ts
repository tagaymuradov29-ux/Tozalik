/** Tayyor suhbat ssenariylari (demo): AI ulanmaguncha robot shular bo'yicha gaplashadi.
 *  Har qadam: [robot gapi, tarjimasi, o'quvchi javobi (namuna), javob tarjimasi]. Oxirgi — xayrlashuv. */
export type Turn = [string, string, string, string];
export type Dialog = { key: string; name: string; turns: Turn[]; bye: [string, string] };

const D: Record<string, Dialog[]> = {
  en: [
    { key: "tanishuv", name: "Tanishuv", turns: [
      ["Hi! I'm your AI teacher. What's your name?", "Salom! Men AI o'qituvchingizman. Ismingiz nima?", "My name is Aziz.", "Mening ismim Aziz."],
      ["Nice to meet you! Where are you from?", "Tanishganimdan xursandman! Qayerdansiz?", "I'm from Uzbekistan.", "Men O'zbekistondanman."],
      ["Cool! What do you do?", "Zo'r! Nima ish qilasiz?", "I'm a student.", "Men talabaman."],
      ["Why are you learning English?", "Nega ingliz tilini o'rganyapsiz?", "For my work and travel.", "Ishim va sayohat uchun."]],
      bye: ["Great job! See you next time!", "Barakalla! Keyingi safar ko'rishguncha!"] },
    { key: "kafe", name: "Kafeda", turns: [
      ["Hello! What would you like to order?", "Salom! Nima buyurtma qilasiz?", "A cappuccino, please.", "Kapuchino, iltimos."],
      ["Small or large?", "Kichikmi yoki kattami?", "Large, please.", "Katta, iltimos."],
      ["Anything else?", "Yana biror narsa?", "No, thank you.", "Yo'q, rahmat."],
      ["That's five dollars.", "Besh dollar bo'ladi.", "Here you are.", "Mana, oling."]],
      bye: ["Enjoy your coffee!", "Yoqimli ishtaha!"] },
    { key: "sayohat", name: "Aeroportda", turns: [
      ["Good morning! May I see your passport?", "Xayrli tong! Pasportingizni ko'rsam bo'ladimi?", "Sure, here it is.", "Albatta, mana."],
      ["Where are you flying today?", "Bugun qayerga uchyapsiz?", "I'm flying to London.", "Londonga uchyapman."],
      ["Do you have any bags to check in?", "Topshiradigan sumkangiz bormi?", "Yes, one bag.", "Ha, bitta sumka."],
      ["Window or aisle seat?", "Deraza yonimi yoki yo'lak yonimi?", "Window, please.", "Deraza yoni, iltimos."]],
      bye: ["Have a nice flight!", "Parvozingiz yaxshi o'tsin!"] },
  ],
  ru: [
    { key: "tanishuv", name: "Tanishuv", turns: [
      ["Привет! Я твой AI-учитель. Как тебя зовут?", "Salom! Men AI o'qituvchingizman. Ismingiz nima?", "Меня зовут Азиз.", "Mening ismim Aziz."],
      ["Очень приятно! Откуда ты?", "Juda yoqimli! Qayerdansiz?", "Я из Узбекистана.", "Men O'zbekistondanman."],
      ["Здорово! Чем ты занимаешься?", "Zo'r! Nima bilan shug'ullanasiz?", "Я студент.", "Men talabaman."],
      ["Зачем ты учишь русский язык?", "Nega rus tilini o'rganyapsiz?", "Для работы и учёбы.", "Ish va o'qish uchun."]],
      bye: ["Молодец! До встречи!", "Barakalla! Ko'rishguncha!"] },
    { key: "kafe", name: "Kafeda", turns: [
      ["Здравствуйте! Что будете заказывать?", "Assalomu alaykum! Nima buyurtma qilasiz?", "Капучино, пожалуйста.", "Kapuchino, iltimos."],
      ["Маленький или большой?", "Kichikmi yoki kattami?", "Большой, пожалуйста.", "Katta, iltimos."],
      ["Что-нибудь ещё?", "Yana biror narsa?", "Нет, спасибо.", "Yo'q, rahmat."],
      ["С вас триста рублей.", "Uch yuz rubl bo'ladi.", "Вот, пожалуйста.", "Mana, oling."]],
      bye: ["Приятного аппетита!", "Yoqimli ishtaha!"] },
    { key: "sayohat", name: "Aeroportda", turns: [
      ["Доброе утро! Ваш паспорт, пожалуйста.", "Xayrli tong! Pasportingiz, iltimos.", "Да, вот он.", "Ha, mana."],
      ["Куда вы летите?", "Qayerga uchyapsiz?", "Я лечу в Москву.", "Moskvaga uchyapman."],
      ["У вас есть багаж?", "Yukingiz bormi?", "Да, одна сумка.", "Ha, bitta sumka."],
      ["Место у окна или у прохода?", "Deraza yonimi yoki yo'lak yonimi?", "У окна, пожалуйста.", "Deraza yoni, iltimos."]],
      bye: ["Счастливого полёта!", "Parvozingiz yaxshi o'tsin!"] },
  ],
  ar: [
    { key: "tanishuv", name: "Tanishuv", turns: [
      ["مَرْحَبًا! أَنَا مُعَلِّمُكَ الذَّكِيّ. مَا اسْمُكَ؟", "Salom! Men aqlli o'qituvchingizman. Ismingiz nima?", "اِسْمِي عَزِيز.", "Mening ismim Aziz."],
      ["تَشَرَّفْنَا! مِنْ أَيْنَ أَنْتَ؟", "Tanishganimdan xursandman! Qayerdansiz?", "أَنَا مِنْ أُوزْبَكِسْتَان.", "Men O'zbekistondanman."],
      ["جَمِيل! مَاذَا تَعْمَلُ؟", "Ajoyib! Nima ish qilasiz?", "أَنَا طَالِب.", "Men talabaman."],
      ["لِمَاذَا تَتَعَلَّمُ الْعَرَبِيَّةَ؟", "Nega arab tilini o'rganyapsiz?", "لِأَقْرَأَ الْقُرْآنَ.", "Qur'on o'qish uchun."]],
      bye: ["أَحْسَنْتَ! إِلَى اللِّقَاء!", "Barakalla! Ko'rishguncha!"] },
    { key: "kafe", name: "Kafeda", turns: [
      ["أَهْلًا! مَاذَا تُرِيدُ أَنْ تَطْلُبَ؟", "Xush kelibsiz! Nima buyurtma qilasiz?", "قَهْوَة، مِنْ فَضْلِكَ.", "Qahva, iltimos."],
      ["صَغِيرَة أَمْ كَبِيرَة؟", "Kichikmi yoki kattami?", "كَبِيرَة، مِنْ فَضْلِكَ.", "Katta, iltimos."],
      ["هَلْ تُرِيدُ شَيْئًا آخَرَ؟", "Yana biror narsa xohlaysizmi?", "لَا، شُكْرًا.", "Yo'q, rahmat."],
      ["عَشَرَةُ رِيَالَات.", "O'n riyol bo'ladi.", "تَفَضَّلْ.", "Marhamat."]],
      bye: ["بِالْهَنَاءِ وَالشِّفَاءِ!", "Yoqimli ishtaha!"] },
    { key: "sayohat", name: "Aeroportda", turns: [
      ["صَبَاحُ الْخَيْرِ! جَوَازُ سَفَرِكَ مِنْ فَضْلِكَ.", "Xayrli tong! Pasportingiz, iltimos.", "نَعَمْ، تَفَضَّلْ.", "Ha, marhamat."],
      ["إِلَى أَيْنَ تُسَافِرُ؟", "Qayerga sayohat qilyapsiz?", "أُسَافِرُ إِلَى دُبَيّ.", "Dubayga ketyapman."],
      ["هَلْ عِنْدَكَ حَقَائِب؟", "Sumkalaringiz bormi?", "نَعَمْ، حَقِيبَة وَاحِدَة.", "Ha, bitta sumka."],
      ["بِجَانِبِ النَّافِذَةِ أَمِ الْمَمَرِّ؟", "Deraza yonimi yoki yo'lak yonimi?", "بِجَانِبِ النَّافِذَةِ.", "Deraza yonida."]],
      bye: ["رِحْلَة سَعِيدَة!", "Safaringiz baxtli o'tsin!"] },
  ],
  tr: [
    { key: "tanishuv", name: "Tanishuv", turns: [
      ["Merhaba! Ben senin yapay zekâ öğretmeninim. Adın ne?", "Salom! Men sun'iy intellekt o'qituvchingizman. Ismingiz nima?", "Benim adım Aziz.", "Mening ismim Aziz."],
      ["Tanıştığıma memnun oldum! Nerelisin?", "Tanishganimdan xursandman! Qayerliksiz?", "Özbekistanlıyım.", "Men o'zbekistonlikman."],
      ["Harika! Ne iş yapıyorsun?", "Ajoyib! Nima ish qilasiz?", "Öğrenciyim.", "Men talabaman."],
      ["Neden Türkçe öğreniyorsun?", "Nega turk tilini o'rganyapsiz?", "İş ve seyahat için.", "Ish va sayohat uchun."]],
      bye: ["Aferin! Görüşürüz!", "Barakalla! Ko'rishguncha!"] },
    { key: "kafe", name: "Kafeda", turns: [
      ["Merhaba! Ne almak istersiniz?", "Salom! Nima olasiz?", "Bir çay, lütfen.", "Bitta choy, iltimos."],
      ["Şekerli mi, şekersiz mi?", "Shakarlimi yoki shakarsizmi?", "Şekersiz, lütfen.", "Shakarsiz, iltimos."],
      ["Başka bir şey?", "Yana biror narsa?", "Hayır, teşekkürler.", "Yo'q, rahmat."],
      ["Yirmi lira.", "Yigirma lira.", "Buyurun.", "Marhamat."]],
      bye: ["Afiyet olsun!", "Yoqimli ishtaha!"] },
    { key: "sayohat", name: "Aeroportda", turns: [
      ["Günaydın! Pasaportunuz lütfen.", "Xayrli tong! Pasportingiz, iltimos.", "Tabii, buyurun.", "Albatta, marhamat."],
      ["Nereye uçuyorsunuz?", "Qayerga uchyapsiz?", "İstanbul'a uçuyorum.", "Istanbulga uchyapman."],
      ["Bagajınız var mı?", "Yukingiz bormi?", "Evet, bir valiz.", "Ha, bitta chamadon."],
      ["Cam kenarı mı, koridor mu?", "Deraza yonimi yoki yo'lakmi?", "Cam kenarı, lütfen.", "Deraza yoni, iltimos."]],
      bye: ["İyi uçuşlar!", "Parvozingiz yaxshi o'tsin!"] },
  ],
};
export const dialogsFor = (lang: string) => D[lang] ?? D.en;
