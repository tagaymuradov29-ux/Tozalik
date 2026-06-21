"""Navbat (rotatsiya) mantig'i — har bir kishiga BITTA vazifa, 3 kunda almashadi.

Vazifalar (TASKS): oshxona, hojatxona+koridor, dush, musor.
Har bir 3 kunlik siklda har bir vazifa bitta odamga beriladi. Odam vazifadan
ko'p bo'lsa, ortiqchasi shu siklda bo'sh turadi (keyingi siklda navbat ularga
o'tadi). Vazifalar ham, odamlar ham sikl raqami bo'yicha aylanadi.
"""
from __future__ import annotations

import datetime as dt

from config import CYCLE_DAYS
from texts import TASKS

_EPOCH = dt.date(2024, 1, 1)


def day_number(d: dt.date) -> int:
    return (d - _EPOCH).days


def cycle_index(d: dt.date) -> int:
    return day_number(d) // CYCLE_DAYS


def cycle_start(d: dt.date) -> dt.date:
    return _EPOCH + dt.timedelta(days=cycle_index(d) * CYCLE_DAYS)


def cycle_end(d: dt.date) -> dt.date:
    """Sikl oxirgi kuni (3 kunlik siklda boshlanish + 2)."""
    return cycle_start(d) + dt.timedelta(days=CYCLE_DAYS - 1)


def is_cycle_start(d: dt.date) -> bool:
    return day_number(d) % CYCLE_DAYS == 0


def assign_cycle(resident_ids: list[int], cidx: int) -> dict[int, str | None]:
    """Sikl raqami uchun har bir odamga vazifa (yoki None) qaytaradi."""
    result: dict[int, str | None] = {tid: None for tid in resident_ids}
    n = len(resident_ids)
    if n == 0:
        return result
    k = min(n, len(TASKS))
    for j in range(k):
        task = TASKS[(cidx + j) % len(TASKS)]
        person = resident_ids[(cidx + j) % n]
        result[person] = task
    return result
