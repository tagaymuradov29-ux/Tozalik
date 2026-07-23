"""Bot konfiguratsiyasi — barcha sozlamalar muhit o'zgaruvchilaridan (env) o'qiladi."""
import os
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str | None = None, required: bool = False) -> str:
    val = os.getenv(name, default)
    if required and not val:
        raise RuntimeError(
            f"Muhit o'zgaruvchisi '{name}' o'rnatilmagan. "
            f"Railway -> Variables bo'limiga qo'shing."
        )
    return val


# --- Asosiy ---
BOT_TOKEN: str = _get("BOT_TOKEN", required=True)

# Admin Telegram ID(lar)i, vergul bilan ajratilgan. Masalan: "123456789,987654321"
# O'zingizning ID'ingizni botdagi /id buyrug'i orqali bilib olasiz.
ADMIN_IDS: set[int] = {
    int(x.strip()) for x in _get("ADMIN_IDS", "").split(",") if x.strip().isdigit()
}

# PostgreSQL ulanish manzili. Railway Postgres qo'shsangiz avtomatik beriladi.
DATABASE_URL: str = _get("DATABASE_URL", required=True)

# --- Vaqt zonasi va jadval ---
TZ_NAME: str = _get("TIMEZONE", "Asia/Tashkent")
TZ = ZoneInfo(TZ_NAME)

import datetime as _dt

# Yangi sikl e'lon qilinadigan soat (vazifa beriladigan vaqt)
ANNOUNCE_HOUR: int = int(_get("ANNOUNCE_HOUR", "5"))
# Muddatdan oldingi eslatma soati (04:00 — muddat ertasi kun 05:00)
PRE_DEADLINE_HOUR: int = int(_get("PRE_DEADLINE_HOUR", "4"))
# Jarima tekshiriladigan soat (ertasi kun 05:00)
DEADLINE_HOUR: int = int(_get("DEADLINE_HOUR", "5"))
# Guruhga kunduzgi qayta eslatma soati (13:00)
GROUP_REMINDER_HOUR: int = int(_get("GROUP_REMINDER_HOUR", "13"))

# Tozalik navbati necha kunda almashadi (har hafta)
CYCLE_DAYS: int = int(_get("CYCLE_DAYS", "7"))

# Tozalik vazifalari shu sanadan boshlab beriladi (23-iyul 2026)
_ts = _get("TASKS_START_DATE", "2026-07-23")
TASKS_START_DATE: _dt.date = _dt.date.fromisoformat(_ts)

# Boshlang'ich navbat tartibi (ism bo'yicha):
# Oshxona=1-o'rin, Hojatxona+Koridor=2-o'rin, Dush+Musor=3-o'rin.
INITIAL_ORDER: list[str] = [
    x.strip() for x in _get(
        "INITIAL_ORDER", "Shahzod Tog'aymurodov, Bunyod, Jamshid"
    ).split(",") if x.strip()
]

# Aniq tartib — Telegram ID bo'yicha (ism mos kelmasa ham ishlaydi).
# Admin (Shahzod) -> 0-o'rin (Oshxona), Jamshid -> 2-o'rin (Dush+Musor).
INITIAL_ORDER_IDS: dict[int, int] = {653767745: 2}
for _a in ADMIN_IDS:
    INITIAL_ORDER_IDS.setdefault(_a, 0)

# --- Jarima (so'm) ---
FINE_AMOUNT: int = int(_get("FINE_AMOUNT", "100000"))  # tozalik vazifasi (to'liq)
# Eshik qulflash: ikkalasi (chiqish+kirish) bajarilmasa / bittasi bajarilmasa
DOOR_FINE_FULL: int = int(_get("DOOR_FINE_FULL", "100000"))
DOOR_FINE_PARTIAL: int = int(_get("DOOR_FINE_PARTIAL", "80000"))
# Ovqat: umuman hisobotsiz (admin qo'lda) / boshlab idish yuvilmasa (avtomatik)
COOK_FINE_FULL: int = int(_get("COOK_FINE_FULL", "100000"))
COOK_FINE_PARTIAL: int = int(_get("COOK_FINE_PARTIAL", "80000"))

# Kvartirada nechta kishi yashashi (ma'lumot uchun)
HOUSE_SIZE: int = int(_get("HOUSE_SIZE", "6"))


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS
