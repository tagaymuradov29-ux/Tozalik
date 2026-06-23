"""PostgreSQL ma'lumotlar bazasi qatlami (asyncpg).

assignments jadvali sikl asosida: task_date = sikl boshlanish sanasi, areas = vazifa.
"""
from __future__ import annotations

import datetime as dt

import asyncpg

from config import DATABASE_URL

_pool: asyncpg.Pool | None = None


def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(_normalize_url(DATABASE_URL), min_size=1, max_size=5)
    await _create_tables()


async def close_pool() -> None:
    if _pool:
        await _pool.close()


async def _create_tables() -> None:
    async with _pool.acquire() as con:
        await con.execute(
            """
            CREATE TABLE IF NOT EXISTS residents (
                telegram_id   BIGINT PRIMARY KEY,
                name          TEXT NOT NULL,
                phone         TEXT,
                status        TEXT NOT NULL DEFAULT 'pending',
                joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
                approved_at   TIMESTAMPTZ,
                away_until    DATE
            );

            -- Sikl vazifalari: task_date = sikl boshlanishi, areas = vazifa nomi
            CREATE TABLE IF NOT EXISTS assignments (
                id            SERIAL PRIMARY KEY,
                telegram_id   BIGINT NOT NULL REFERENCES residents(telegram_id),
                task_date     DATE NOT NULL,
                areas         TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'assigned',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (telegram_id, task_date)
            );

            CREATE TABLE IF NOT EXISTS extra_reports (
                id            SERIAL PRIMARY KEY,
                telegram_id   BIGINT NOT NULL,
                report_date   DATE NOT NULL,
                category      TEXT NOT NULL,
                file_id       TEXT,
                file_type     TEXT,
                status        TEXT NOT NULL DEFAULT 'pending',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (telegram_id, report_date, category)
            );

            CREATE TABLE IF NOT EXISTS fines (
                id            SERIAL PRIMARY KEY,
                telegram_id   BIGINT NOT NULL,
                assignment_id INT,
                amount        INT NOT NULL,
                reason        TEXT NOT NULL,
                fine_date     DATE NOT NULL,
                category      TEXT NOT NULL DEFAULT 'cleaning',
                status        TEXT NOT NULL DEFAULT 'active',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                cleared_at    TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS settings (
                key           TEXT PRIMARY KEY,
                value         TEXT
            );

            -- Jarima to'lovi (elektr cheki) tasdiqlash uchun
            CREATE TABLE IF NOT EXISTS payments (
                id            SERIAL PRIMARY KEY,
                telegram_id   BIGINT NOT NULL,
                file_id       TEXT,
                file_type     TEXT,
                amount        INT NOT NULL DEFAULT 0,
                status        TEXT NOT NULL DEFAULT 'pending',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            -- Migratsiyalar (eski bazalar uchun)
            ALTER TABLE residents ADD COLUMN IF NOT EXISTS away_until DATE;
            ALTER TABLE residents ADD COLUMN IF NOT EXISTS forced_task TEXT;
            ALTER TABLE residents ADD COLUMN IF NOT EXISTS duty_debt INT NOT NULL DEFAULT 0;
            ALTER TABLE residents ADD COLUMN IF NOT EXISTS proxy_uid BIGINT;
            ALTER TABLE fines ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'cleaning';
            ALTER TABLE extra_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
            """
        )


# ---------------- Settings ----------------
async def set_setting(key: str, value: str) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "INSERT INTO settings (key, value) VALUES ($1, $2) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            key, value,
        )


async def get_setting(key: str) -> str | None:
    async with _pool.acquire() as con:
        return await con.fetchval("SELECT value FROM settings WHERE key = $1", key)


# ---------------- Residents ----------------
async def upsert_pending_resident(telegram_id: int, name: str, phone: str) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            """
            INSERT INTO residents (telegram_id, name, phone, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT (telegram_id) DO UPDATE
              SET name = EXCLUDED.name, phone = EXCLUDED.phone, status = 'pending'
            WHERE residents.status <> 'active';
            """,
            telegram_id, name, phone,
        )


async def get_resident(telegram_id: int) -> asyncpg.Record | None:
    async with _pool.acquire() as con:
        return await con.fetchrow("SELECT * FROM residents WHERE telegram_id = $1", telegram_id)


async def set_resident_status(telegram_id: int, status: str) -> None:
    async with _pool.acquire() as con:
        if status == "active":
            await con.execute(
                "UPDATE residents SET status='active', approved_at=now() WHERE telegram_id=$1",
                telegram_id,
            )
        else:
            await con.execute(
                "UPDATE residents SET status=$2 WHERE telegram_id=$1", telegram_id, status
            )


async def get_active_residents() -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM residents WHERE status='active' "
            "ORDER BY approved_at NULLS LAST, telegram_id"
        )


async def get_available_residents(on_date: dt.date) -> list[asyncpg.Record]:
    """Faol va shu sanada viloyatda emas."""
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM residents WHERE status='active' "
            "AND (away_until IS NULL OR $1 >= away_until) "
            "ORDER BY approved_at NULLS LAST, telegram_id",
            on_date,
        )


async def get_pending_residents() -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM residents WHERE status='pending' ORDER BY joined_at"
        )


async def get_residents_returning_on(d: dt.date) -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM residents WHERE status='active' AND away_until = $1", d
        )


async def set_away(telegram_id: int, return_date: dt.date) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "UPDATE residents SET away_until=$2 WHERE telegram_id=$1", telegram_id, return_date
        )


async def clear_away(telegram_id: int) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "UPDATE residents SET away_until=NULL WHERE telegram_id=$1", telegram_id
        )


async def set_forced_task(telegram_id: int, task: str | None) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "UPDATE residents SET forced_task=$2 WHERE telegram_id=$1", telegram_id, task
        )


async def incr_duty_debt(telegram_id: int, delta: int) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "UPDATE residents SET duty_debt = GREATEST(0, duty_debt + $2) WHERE telegram_id=$1",
            telegram_id, delta,
        )


async def create_proxy_member(name: str, proxy_uid: int) -> int:
    """Telefonsiz a'zo — manageri (proxy_uid) belgilanadi. Sun'iy manfiy id beriladi."""
    async with _pool.acquire() as con:
        new_id = await con.fetchval("SELECT COALESCE(MIN(telegram_id),0) - 1 FROM residents")
        if new_id is None or new_id >= 0:
            new_id = -1
        await con.execute(
            "INSERT INTO residents (telegram_id, name, phone, status, approved_at, proxy_uid) "
            "VALUES ($1,$2,'telefonsiz','active', now(), $3)",
            new_id, name, proxy_uid,
        )
        return new_id


async def get_proxy_members_for(proxy_uid: int) -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM residents WHERE proxy_uid=$1 AND status='active'", proxy_uid
        )


# ---------------- Payments (jarima to'lovi) ----------------
async def add_payment(telegram_id: int, file_id: str | None, file_type: str | None,
                      amount: int) -> int:
    async with _pool.acquire() as con:
        row = await con.fetchrow(
            "INSERT INTO payments (telegram_id, file_id, file_type, amount) "
            "VALUES ($1,$2,$3,$4) RETURNING id",
            telegram_id, file_id, file_type, amount,
        )
        return row["id"]


async def get_payment(payment_id: int) -> asyncpg.Record | None:
    async with _pool.acquire() as con:
        return await con.fetchrow("SELECT * FROM payments WHERE id=$1", payment_id)


async def set_payment_status(payment_id: int, status: str) -> None:
    async with _pool.acquire() as con:
        await con.execute("UPDATE payments SET status=$2 WHERE id=$1", payment_id, status)


async def get_all_forced() -> dict[int, str]:
    """Keyingi siklda majburiy o'sha vazifa beriladiganlar."""
    async with _pool.acquire() as con:
        rows = await con.fetch(
            "SELECT telegram_id, forced_task FROM residents WHERE forced_task IS NOT NULL"
        )
        return {r["telegram_id"]: r["forced_task"] for r in rows}


# ---------------- Assignments (sikl) ----------------
async def create_assignment(telegram_id: int, cycle_start: dt.date, task: str) -> int:
    async with _pool.acquire() as con:
        row = await con.fetchrow(
            """
            INSERT INTO assignments (telegram_id, task_date, areas)
            VALUES ($1, $2, $3)
            ON CONFLICT (telegram_id, task_date) DO UPDATE SET areas = EXCLUDED.areas
            RETURNING id;
            """,
            telegram_id, cycle_start, task,
        )
        return row["id"]


async def get_assignment(telegram_id: int, cycle_start: dt.date) -> asyncpg.Record | None:
    async with _pool.acquire() as con:
        return await con.fetchrow(
            "SELECT * FROM assignments WHERE telegram_id=$1 AND task_date=$2",
            telegram_id, cycle_start,
        )


async def get_cycle_assignments(cycle_start: dt.date) -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT * FROM assignments WHERE task_date=$1", cycle_start
        )


async def set_assignment_status(assignment_id: int, status: str) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "UPDATE assignments SET status=$2 WHERE id=$1", assignment_id, status
        )


async def delete_future_assignments(telegram_id: int, from_date: dt.date) -> None:
    async with _pool.acquire() as con:
        await con.execute(
            "DELETE FROM assignments WHERE telegram_id=$1 AND task_date>=$2 AND status='assigned'",
            telegram_id, from_date,
        )


# ---------------- Extra reports (har kunlik + activity) ----------------
async def add_extra_report(telegram_id: int, report_date: dt.date, category: str,
                           file_id: str | None, file_type: str | None) -> int:
    async with _pool.acquire() as con:
        row = await con.fetchrow(
            """
            INSERT INTO extra_reports (telegram_id, report_date, category, file_id, file_type, status)
            VALUES ($1,$2,$3,$4,$5,'pending')
            ON CONFLICT (telegram_id, report_date, category) DO UPDATE
              SET file_id=EXCLUDED.file_id, file_type=EXCLUDED.file_type,
                  status='pending', created_at=now()
            RETURNING id;
            """,
            telegram_id, report_date, category, file_id, file_type,
        )
        return row["id"]


async def get_extra_report(report_id: int) -> asyncpg.Record | None:
    async with _pool.acquire() as con:
        return await con.fetchrow("SELECT * FROM extra_reports WHERE id=$1", report_id)


async def set_extra_report_status(report_id: int, status: str) -> None:
    async with _pool.acquire() as con:
        await con.execute("UPDATE extra_reports SET status=$2 WHERE id=$1", report_id, status)


async def get_extra_categories(telegram_id: int, report_date: dt.date) -> set[str]:
    """Rad etilmagan (pending/approved) hisobot kategoriyalari."""
    async with _pool.acquire() as con:
        rows = await con.fetch(
            "SELECT category FROM extra_reports WHERE telegram_id=$1 AND report_date=$2 "
            "AND status <> 'rejected'",
            telegram_id, report_date,
        )
        return {r["category"] for r in rows}


async def get_extra_reports_between(telegram_id: int, start: dt.date,
                                    end: dt.date) -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT report_date, category FROM extra_reports "
            "WHERE telegram_id=$1 AND report_date BETWEEN $2 AND $3 AND status <> 'rejected' "
            "ORDER BY report_date DESC, category",
            telegram_id, start, end,
        )


# ---------------- Fines ----------------
async def add_fine(telegram_id: int, assignment_id: int | None, amount: int,
                   reason: str, fine_date: dt.date, category: str = "cleaning") -> int:
    async with _pool.acquire() as con:
        row = await con.fetchrow(
            """
            INSERT INTO fines (telegram_id, assignment_id, amount, reason, fine_date, category)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING id;
            """,
            telegram_id, assignment_id, amount, reason, fine_date, category,
        )
        return row["id"]


async def has_fine(telegram_id: int, fine_date: dt.date, category: str) -> bool:
    async with _pool.acquire() as con:
        val = await con.fetchval(
            "SELECT 1 FROM fines WHERE telegram_id=$1 AND fine_date=$2 AND category=$3 "
            "AND status='active' LIMIT 1",
            telegram_id, fine_date, category,
        )
        return val is not None


async def get_user_fines(telegram_id: int) -> tuple[int, int]:
    async with _pool.acquire() as con:
        row = await con.fetchrow(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total "
            "FROM fines WHERE telegram_id=$1 AND status='active'",
            telegram_id,
        )
        return row["cnt"], row["total"]


async def get_all_active_fines() -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            """
            SELECT f.telegram_id, r.name, COUNT(*) AS cnt, SUM(f.amount) AS total
            FROM fines f JOIN residents r ON r.telegram_id=f.telegram_id
            WHERE f.status='active'
            GROUP BY f.telegram_id, r.name ORDER BY total DESC;
            """
        )


async def get_user_fine_details(telegram_id: int) -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            "SELECT reason, amount, fine_date FROM fines "
            "WHERE telegram_id=$1 AND status='active' ORDER BY fine_date DESC",
            telegram_id,
        )


async def get_all_fine_details() -> list[asyncpg.Record]:
    async with _pool.acquire() as con:
        return await con.fetch(
            """
            SELECT r.name, f.reason, f.amount, f.fine_date
            FROM fines f JOIN residents r ON r.telegram_id=f.telegram_id
            WHERE f.status='active'
            ORDER BY r.name, f.fine_date DESC;
            """
        )


async def clear_all_fines() -> int:
    async with _pool.acquire() as con:
        res = await con.execute(
            "UPDATE fines SET status='cleared', cleared_at=now() WHERE status='active'"
        )
        try:
            return int(res.split()[-1])
        except Exception:
            return 0


async def clear_fine_by(telegram_id: int, fine_date: dt.date, category: str) -> int:
    async with _pool.acquire() as con:
        res = await con.execute(
            "UPDATE fines SET status='cleared', cleared_at=now() "
            "WHERE telegram_id=$1 AND fine_date=$2 AND category=$3 AND status='active'",
            telegram_id, fine_date, category,
        )
        try:
            return int(res.split()[-1])
        except Exception:
            return 0


async def clear_user_active_fines(telegram_id: int) -> int:
    async with _pool.acquire() as con:
        res = await con.execute(
            "UPDATE fines SET status='cleared', cleared_at=now() "
            "WHERE telegram_id=$1 AND status='active'",
            telegram_id,
        )
        try:
            return int(res.split()[-1])
        except Exception:
            return 0
