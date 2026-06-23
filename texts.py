"""Botning barcha o'zbekcha matnlari, menyu va vazifa nomlari."""
from config import FINE_AMOUNT, HOUSE_SIZE, CYCLE_DAYS

# 3 kunlik siklda aylanadigan vazifalar (har biri bitta odamga)
TASKS = [
    "🍳 Oshxona",
    "🚽 Hojatxona + 🚪 Koridor",
    "🚿 Dush",
    "🗑 Musor (hammasini tashlab kelish)",
]

# Hisobot kategoriyalari (activity ko'rinishida ishlatiladi)
CATEGORIES = {
    "task": "🧹 Tozalik vazifasi",
    "kitchen_used": "🍳 Oshxonadan foydalandi va tozaladi",
    "shower_after": "🚿 Cho'milib tozaladi",
    "door_out": "🚪 Uydan chiqdi",
    "door_in": "🔑 Uyga keldi",
}

# ---------- Reply (pastki) menyu tugmalari ----------
BTN_MY_TASK = "📋 Mening vazifam"
BTN_REPORT = "📤 Hisobot yuborish"
BTN_RESIDENTS = "🏠 Kvartiradagilar"
BTN_RULES_FINES = "📜 Qoidalar va jarimalar"
BTN_AWAY = "✈️ Viloyatga ketdim"
BTN_BACK = "🏠 Uyga keldim"
BTN_HELP = "❓ Yordam"

# ---------- Ro'yxatdan o'tish ----------
WELCOME = (
    "👋 Assalomu alaykum!\n\n"
    "Siz <b>Uy Tartibi</b> boti orqali umumiy kvartira navbatchiligiga "
    "ro'yxatdan o'tyapsiz.\n\n"
    "Iltimos, <b>ism va familiyangizni</b> yuboring:\n"
    "<i>Masalan: Akbar Yusupov</i>"
)

ASK_PHONE = (
    "Rahmat, <b>{name}</b>! ✅\n\n"
    "Endi <b>telefon raqamingizni</b> yuboring.\n"
    "Quyidagi tugmani bosib ulashishingiz mumkin 👇"
)

SHARE_PHONE_BTN = "📱 Telefon raqamni ulashish"


def rules_text() -> str:
    return (
        "📋 <b>UY TARTIB-QOIDALARI</b>\n"
        "➖➖➖➖➖➖➖➖➖➖\n"
        f"Kvartirada bir necha kishi yashaydi. Quyidagi vazifalar <b>{CYCLE_DAYS} "
        "kunda bir marta</b> navbat bilan almashadi (har kishiga bittadan):\n"
        "🍳 Oshxona · 🚽 Hojatxona+Koridor · 🚿 Dush · 🗑 Musor\n\n"
        "🧹 <b>1. Tozalik vazifasi</b>\n"
        f"Vazifalar {CYCLE_DAYS} kunda bir marta navbat bilan beriladi. Berilgan "
        "vazifani bajarish uchun <b>24 soat</b> vaqt bor: masalan 23-iyun 05:00 da "
        "berilsa, <b>24-iyun 05:00</b> gacha tozalab video hisobot yuborasiz. "
        "Vaqtida bajarmaganlarga jarima. Dush: hamma joy toza, sochlar qolmagan "
        "bo'lishi shart.\n\n"
        "🚪 <b>2. Eshik</b>\n"
        "Uydan chiqishda eshikni qulflagan video, uyga kelganda ham qulflagan video.\n\n"
        "🍳 <b>3. Oshxona / 🚿 Dush (foydalansangiz)</b>\n"
        "Oshxonadan foydalanib tozalagan video; dushdan keyin \"o'zimdan keyin "
        "tozaladim\" video.\n\n"
        "⚠️ Oshxona, dush yoki eshikdan foydalanib hisobot yubormaganni admin ko'rib "
        "<b>100 000 so'm</b> jarima yozadi.\n\n"
        "✈️ <b>4. Viloyat</b>\n"
        "Viloyatga ketsangiz tugmani bosib, qaytish sanasini belgilang — o'sha "
        "kungacha vazifa berilmaydi, jarima yozilmaydi.\n"
        "➖➖➖➖➖➖➖➖➖➖\n"
        f"💸 Tozalik vazifasi bajarilmasa — <b>{FINE_AMOUNT:,} so'm</b>.\n".replace(",", " ") +
        "\n✍️ Qoidalar bilan tanishib chiqdingizmi?"
    )


AGREE_BTN = "✅ Roziman"
DISAGREE_BTN = "❌ Rozi emasman"


def registered_text(name: str, phone: str) -> str:
    return (
        f"🎉 <b>Tabriklaymiz, {name}!</b>\n\n"
        "Siz qoidalarni qabul qildingiz va ro'yxatdan o'tdingiz.\n\n"
        "📂 <b>Profilingiz:</b>\n"
        f"• Ism: {name}\n"
        f"• Tel: {phone}\n"
        "• Holat: <i>Tasdiq kutilmoqda</i>\n\n"
        "⏳ Admin sizni qabul qilib, navbatga biriktiradi."
    )


DISAGREE_TEXT = (
    "😔 Afsuski, qoidalarga rozi bo'lmasangiz, navbatchilikda qatnasha olmaysiz.\n"
    "Fikringizni o'zgartirsangiz, /start bosing."
)

ALREADY_PENDING = (
    "⏳ Siz ro'yxatdan o'tgansiz va admin tasdig'ini kutyapsiz."
)

APPROVED_USER_MSG = (
    "✅ <b>Tabriklaymiz!</b> Admin sizni tasdiqladi.\n\n"
    "Pastdagi menyu tugmalaridan foydalaning 👇"
)

REJECTED_USER_MSG = "❌ Afsuski, arizangiz rad etildi. Admin bilan bog'laning."

NOT_REGISTERED = "ℹ️ Siz hali ro'yxatdan o'tmagansiz. /start bosing."
NOT_ACTIVE = "⏳ Siz hali tasdiqlanmagansiz. Admin tasdig'ini kuting."

MENU_HINT = "Pastdagi tugmalardan tanlang 👇"


# ---------- Vazifa / hisobot ----------
def my_task_msg(cycle_str: str, task: str | None, done_task: bool,
                door_out: bool, door_in: bool) -> str:
    lines = [f"📋 <b>Mening vazifam</b>\n", f"🗓 Sikl: {cycle_str}\n"]
    if task:
        mark = "✅ bajarilgan" if done_task else "❌ hali yo'q"
        lines.append(f"🧹 Tozalik vazifangiz: <b>{task}</b> — {mark}")
    else:
        lines.append("🧹 Bu siklda tozalik vazifangiz yo'q (dam). 😊")
    lines.append("\n🚪 <b>Bugungi eshik:</b>")
    lines.append(f"• Uydan chiqdim: {'✅' if door_out else '❌'}")
    lines.append(f"• Uyga keldim: {'✅' if door_in else '❌'}")
    lines.append("\n🍳 Oshxona/🚿 dushdan foydalansangiz — \"foydalandim va tozaladim\" video yuboring.")
    lines.append("\nHisobot yuborish uchun 📤 tugmasini bosing.")
    return "\n".join(lines)


# Har bir vazifaga nimalar kirishi (checklist)
TASK_DETAILS = {
    "🍳 Oshxona": (
        "🍳 <b>Oshxonani tozalashga nimalar kiradi:</b>\n"
        "1. Musorlarni yig'ish va musorga olib borib tashlash\n"
        "2. Stollar ustini artib tozalash\n"
        "3. Yerga gilamlar va stol taglarini supurib tozalash\n"
        "4. Gaz plitani azelit bilan yuvish"
    ),
    "🚽 Hojatxona + 🚪 Koridor": (
        "🚽 <b>Hojatxona + Koridorni tozalashga nimalar kiradi:</b>\n"
        "1. Hojatxonadagi musor idishini tozalab, yangi paket qo'yish\n"
        "2. Unitaz cho'tkasini tozalab, idishiga xlor solib qo'yish\n"
        "3. Hojatxona polini artish\n"
        "4. Perchatka kiyib unitazni xlor bilan yuvish\n"
        "5. Koridordagi ortiqcha oyoq-kiyimlarni musorga tashlash\n"
        "6. Eshik changini artish"
    ),
    "🚿 Dush": (
        "🚿 <b>Dushni tozalashga nimalar kiradi:</b>\n"
        "1. Dushdagi musorlarni olish, paketini almashtirish\n"
        "2. Dush polini artib tozalash (kir mashina orqasi bilan)\n"
        "3. Rakovinalarni tozalash\n"
        "4. Vannani tozalash"
    ),
    "🗑 Musor (hammasini tashlab kelish)": (
        "🗑 <b>Musor vazifasiga nimalar kiradi:</b>\n"
        "1. Oshxona, hojatxona, dush — hamma joydagi musorlarni yig'ish\n"
        "2. Hammasini musorga olib borib tashlash (eshik oldiga qo'ymang!)"
    ),
}

TASK_NOTE = (
    "\n\n❗️ <b>Eslatma:</b> Musorlarni eshik oldiga qo'ymang — yig'ib olib, "
    "to'g'ridan-to'g'ri musorga tashlab keling!\n"
    "Hamma joy toza bo'lishi shart. Chala tozalansa — qayta tozalaysiz va "
    "<b>keyingi safar ham o'sha joy sizga beriladi</b>!\n"
    "Shuning uchun bir martada toza qiling.\n"
    "⏰ Vaqtida bajarmasangiz — <b>100 000 so'm</b> jarima."
)


def task_details(task: str) -> str:
    return TASK_DETAILS.get(task, "")


REPORT_MENU_TITLE = "📤 Qaysi hisobotni yuborasiz? Tanlang 👇"

# Report inline tugmalari
RB_TASK = "🧹 Tozalik vazifamni bajardim"
RB_KITCHEN = "🍳 Oshxonadan foydalandim va tozaladim"
RB_SHOWER = "🚿 Cho'milib, o'zimdan keyin tozaladim"
RB_DOOR_OUT = "🚪 Uydan chiqdim"
RB_DOOR_IN = "🔑 Uyga keldim"

# Tugma -> kategoriya -> ko'rinadigan nom
RB_LABELS = {
    "task": RB_TASK, "kitchen_used": RB_KITCHEN, "shower_after": RB_SHOWER,
    "door_out": RB_DOOR_OUT, "door_in": RB_DOOR_IN,
}

SEND_VIDEO_NOW = "📹 Endi shu hisobot uchun <b>video</b> yuboring 👇"

# Tugmaga qarab qo'shimcha izoh
SEND_VIDEO_EXTRA = {
    "task": "Bu yerga 3 kunda bir marta sizga berilgan vazifani yuborasiz.",
}

NO_TASK_TO_REPORT = "ℹ️ Bu siklda sizga tozalik vazifasi berilmagan, lekin hisobot saqlandi."


def report_saved(label: str) -> str:
    return (
        f"✅ Qabul qilindi: <b>{label}</b>.\n"
        "📤 Admin tasdig'iga yuborildi. Tasdiqlangach jarima yozilmaydi."
    )


REPORT_APPROVED = "✅ <b>Hisobotingiz tasdiqlandi!</b> Rahmat. 👏"


def report_rejected(label: str) -> str:
    return (
        f"❌ <b>Hisobotingiz rad etildi:</b> {label}\n"
        "Iltimos, qayta bajarib, yangi video yuboring. Aks holda jarima yoziladi."
    )


def _sum(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def rules_and_fines(rules: str, details: list, total: int) -> str:
    """details: [(reason, amount, date_str), ...]"""
    if not details:
        f = "\n\n💸 <b>Jarimalaringiz:</b> faol jarima yo'q. ✅"
    else:
        lines = [f"\n\n💸 <b>Jarimalaringiz ({_sum(total)} so'm):</b>"]
        for reason, amount, dstr in details:
            lines.append(f"• {dstr} — {reason}: <b>{_sum(amount)} so'm</b>")
        f = "\n".join(lines)
    return rules + f


def all_fines_text(rows: list) -> str:
    """rows: [(name, reason, amount, date_str), ...] — barcha faol jarimalar."""
    if not rows:
        return "✅ Hech kimda faol jarima yo'q."
    lines = ["💸 <b>Faol jarimalar (sabablari bilan):</b>\n"]
    cur = None
    grand = 0
    for name, reason, amount, dstr in rows:
        grand += amount
        if name != cur:
            lines.append(f"\n<b>{name}:</b>")
            cur = name
        lines.append(f"• {dstr} — {reason}: {_sum(amount)} so'm")
    lines.append(f"\n➖➖➖\nJami: <b>{_sum(grand)} so'm</b>")
    return "\n".join(lines)


# ---------- Admin panel ----------
ADMIN_PANEL_TITLE = "👑 <b>Admin panel</b> — tanlang 👇"
AP_FINE = "💸 Jarima yozish"
AP_TASKS = "📋 Vazifalar taqsimoti"
AP_FINES = "💸 Barcha jarimalar"
AP_PENDING = "🆕 Arizalar"
AP_REMOVE = "🗑 A'zoni chiqarish"

# Qo'lda jarima sabablari (100 000 so'm)
FINE_REASONS = {
    "oshxona": "Oshxonadan foydalanib hisobot bermadi",
    "dush": "Dushdan foydalanib hisobot bermadi",
    "eshik": "Eshik (kirish/chiqish) hisobotini bermadi",
    "boshqa": "Boshqa (admin)",
}

AP_PICK_MEMBER = "Kimga jarima yozasiz? 👇"
AP_PICK_REASON = "Sabab tanlang (100 000 so'm) 👇"
AP_CUSTOM_ASK = "Sabab va summani yozing. Masalan: <code>Tartibsizlik 50000</code>\nFaqat sabab yozsangiz 100 000 so'm bo'ladi."


def task_distribution(cycle_str: str, mapping: list) -> str:
    """mapping: [(task, name_or_dash), ...]"""
    lines = [f"📋 <b>Vazifalar taqsimoti ({cycle_str})</b>\n"]
    for task, who in mapping:
        lines.append(f"{task} → <b>{who}</b>")
    return "\n".join(lines)


COOK_NEXT_HINT = "Endi idishlarni yuvgach, quyidagini bosing 👇"
DOOR_NEXT_HINT = "Uyga kelganingizda quyidagini bosing 👇"

ONLY_VIDEO = "❗ Iltimos, video (yoki yumaloq video) yuboring."


# ---------- Jarima ----------
def fine_summary_msg(items: list[tuple[str, int]], total: int) -> str:
    lines = ["💸 <b>Jarima yozildi!</b>\n"]
    for reason, amount in items:
        lines.append(f"• {reason}: <b>{amount:,} so'm</b>".replace(",", " "))
    lines.append(f"\n➖➖➖\nJami: <b>{total:,} so'm</b>".replace(",", " "))
    return "\n".join(lines)


def admin_fine_notice(amount: int, reason: str) -> str:
    return (
        "💸 <b>Sizga jarima yozildi (admin tomonidan)</b>\n\n"
        f"Sabab: {reason}\n"
        f"Miqdor: <b>{amount:,} so'm</b>".replace(",", " ")
    )


# ---------- Viloyat ----------
AWAY_ASK_DATE = (
    "✈️ <b>Viloyatga ketish</b>\n\n"
    "Qachon qaytasiz? Sanani yozing. Masalan:\n"
    "<code>25-iyun</code> yoki <code>25.06.2026</code>\n\n"
    "Bekor qilish uchun /bekor"
)
AWAY_BAD_DATE = "❌ Sanani tushunmadim. Masalan: <code>25-iyun</code> yoki <code>25.06.2026</code>"
AWAY_PAST_DATE = "❌ Qaytish sanasi kelajakda bo'lishi kerak."


def away_set_msg(return_date_str: str) -> str:
    return (
        "✈️ <b>Belgilandi.</b> Yaxshi yo'l!\n\n"
        f"Qaytish sanasi: <b>{return_date_str}</b>\n"
        "Shu sanagacha vazifa berilmaydi va jarima yozilmaydi.\n"
        "O'sha kuni sizdan \"uyga keldingizmi?\" deb so'raladi."
    )


def return_prompt_msg(return_date_str: str) -> str:
    return (
        f"🏠 Bugun ({return_date_str}) qaytish kuningiz edi.\n"
        "Uyga keldingizmi?"
    )


BACK_MSG = "🏠 <b>Xush kelibsiz!</b> Bugundan vazifalar qayta beriladi."
NOT_AWAY = "ℹ️ Siz viloyat holatida emassiz."
AWAY_EXTEND_ASK = "⏳ Yangi qaytish sanasini yozing (masalan 28-iyun):"
CANCELLED = "Bekor qilindi."


def away_status(return_date_str: str) -> str:
    return f"✈️ Siz viloyatdasiz ({return_date_str} gacha). Vazifa berilmaydi."
