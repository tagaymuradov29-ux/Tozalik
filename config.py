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

# Yangi sikl e'lon qilinadigan soat
ANNOUNCE_HOUR: int = int(_get("ANNOUNCE_HOUR", "5"))
# Eslatma soati (kechqurun)
REMIND_HOUR: int = int(_get("REMIND_HOUR", "21"))
# Muddatdan oldingi eslatma soati (04:00)
PRE_DEADLINE_HOUR: int = int(_get("PRE_DEADLINE_HOUR", "4"))
# Muddat (jarima yoziladigan) soati
DEADLINE_HOUR: int = int(_get("DEADLINE_HOUR", "5"))

# Tozalik navbati necha kunda almashadi
CYCLE_DAYS: int = int(_get("CYCLE_DAYS", "3"))

# Tozalik vazifalari shu sanadan boshlab beriladi (23-iyun 2026)
_ts = _get("TASKS_START_DATE", "2026-06-23")
TASKS_START_DATE: _dt.date = _dt.date.fromisoformat(_ts)

# Boshlang'ich navbat tartibi (1-sikl, 23-iyun shu ketma-ketlikda):
# Oshxona, Hojatxona+Koridor, Dush, Musor — shu tartibda.
# Ismlar ro'yxatdagi ism bilan moslashtiriladi (qism bo'yicha).
INITIAL_ORDER: list[str] = [
    x.strip() for x in _get(
        "INITIAL_ORDER", "Rustam, Shaxzod Asadjonov, Bunyod, Mirjon"
    ).split(",") if x.strip()
]

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
