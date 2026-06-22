"""Uy Tartibi — umumiy kvartira navbatchilik, hisobot va jarima boti (v2).

Tugmali menyu, tugma→video hisobot oqimi, 3 kunlik navbat, viloyat tizimi,
"Kvartiradagilar" ko'rinishi.
"""
from __future__ import annotations

import datetime as dt
import logging

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

import database as db
import texts
from config import (
    ADMIN_IDS,
    ANNOUNCE_HOUR,
    BOT_TOKEN,
    CYCLE_DAYS,
    DEADLINE_HOUR,
    FINE_AMOUNT,
    INITIAL_ORDER,
    REMIND_HOUR,
    TZ,
    is_admin,
)
import rotation

logging.basicConfig(
    format="%(asctime)s %(name)s %(levelname)s %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

NAME, PHONE, RULES = range(3)

WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun",
          "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]


def fmt_date(d: dt.date) -> str:
    return f"{d.day}-{MONTHS[d.month - 1]}, {WEEKDAYS[d.weekday()]}"


def fmt_short(d: dt.date) -> str:
    return f"{d.day}-{MONTHS[d.month - 1]}"


def fmt_sum(amount: int) -> str:
    return f"{amount:,}".replace(",", " ")


def today_local() -> dt.date:
    return dt.datetime.now(TZ).date()


def is_away_on(resident, on_date: dt.date) -> bool:
    au = resident["away_until"] if resident else None
    return au is not None and on_date < au


def main_menu(resident) -> ReplyKeyboardMarkup:
    away = resident and resident["away_until"] and today_local() < resident["away_until"]
    rows = [
        [texts.BTN_MY_TASK, texts.BTN_REPORT],
        [texts.BTN_RESIDENTS, texts.BTN_RULES_FINES],
        [texts.BTN_BACK if away else texts.BTN_AWAY, texts.BTN_HELP],
    ]
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def _order_index(name: str) -> tuple:
    """INITIAL_ORDER bo'yicha tartib kaliti (moslar oldinda, shu ketma-ketlikda)."""
    nm = (name or "").lower()
    for i, key in enumerate(INITIAL_ORDER):
        k = key.lower()
        if k in nm or all(w in nm for w in k.split()):
            return (0, i, 0)
    return (1, 0, 0)


async def available_ids(on_date: dt.date) -> list[int]:
    """Faol, viloyatda emas va admin bo'lmagan a'zolar — boshlang'ich tartibda."""
    residents = [r for r in await db.get_available_residents(on_date)
                 if not is_admin(r["telegram_id"])]
    residents.sort(key=lambda r: _order_index(r["name"]) + (r["telegram_id"],))
    return [r["telegram_id"] for r in residents]


# =================== Ro'yxatdan o'tish ===================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    resident = await db.get_resident(user.id)
    if resident and resident["status"] == "active":
        await update.message.reply_text(
            "🏠 Asosiy menyu 👇", reply_markup=main_menu(resident)
        )
        return ConversationHandler.END
    if resident and resident["status"] == "pending":
        await update.message.reply_text(texts.ALREADY_PENDING)
        return ConversationHandler.END
    await update.message.reply_text(
        texts.WELCOME, parse_mode=ParseMode.HTML, reply_markup=ReplyKeyboardRemove()
    )
    return NAME


async def got_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    name = update.message.text.strip()
    if len(name) < 2:
        await update.message.reply_text("Iltimos, to'liq ism-familiyangizni yozing.")
        return NAME
    context.user_data["reg_name"] = name
    kb = ReplyKeyboardMarkup(
        [[KeyboardButton(texts.SHARE_PHONE_BTN, request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )
    await update.message.reply_text(
        texts.ASK_PHONE.format(name=name), parse_mode=ParseMode.HTML, reply_markup=kb
    )
    return PHONE


async def got_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    msg = update.message
    phone = msg.contact.phone_number if msg.contact else msg.text.strip()
    context.user_data["reg_phone"] = phone
    await msg.reply_text(
        texts.rules_text(), parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(texts.AGREE_BTN, callback_data="agree"),
            InlineKeyboardButton(texts.DISAGREE_BTN, callback_data="disagree"),
        ]]),
    )
    await msg.reply_text("👆", reply_markup=ReplyKeyboardRemove())
    return RULES


async def on_agree(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    name = context.user_data.get("reg_name", user.full_name)
    phone = context.user_data.get("reg_phone", "—")
    await db.upsert_pending_resident(user.id, name, phone)
    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text(
        texts.registered_text(name, phone), parse_mode=ParseMode.HTML
    )
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"uok:{user.id}"),
        InlineKeyboardButton("❌ Rad etish", callback_data=f"uno:{user.id}"),
    ]])
    admin_text = (
        "🆕 <b>Yangi ariza</b>\n\n"
        f"👤 {name}\n📱 {phone}\n🆔 <code>{user.id}</code>\n"
        f"🔗 @{user.username or '—'}\n\nNavbatga qo'shasizmi?"
    )
    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, admin_text,
                                           parse_mode=ParseMode.HTML, reply_markup=kb)
        except Exception as e:
            logger.warning("Adminga xabar yuborilmadi %s: %s", admin_id, e)
    return ConversationHandler.END


async def on_disagree(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text(texts.DISAGREE_TEXT)
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("awaiting", None)
    await update.message.reply_text(texts.CANCELLED)
    return ConversationHandler.END


# =================== Admin: foydalanuvchini tasdiqlash ===================
async def on_user_review(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    action, uid_str = query.data.split(":")
    uid = int(uid_str)
    resident = await db.get_resident(uid)
    if not resident:
        await query.answer("Topilmadi.", show_alert=True)
        return
    if action == "uok":
        await db.set_resident_status(uid, "active")
        await query.answer("Tasdiqlandi ✅")
        await query.edit_message_text(query.message.text_html + "\n\n✅ <b>Tasdiqlandi</b>",
                                      parse_mode=ParseMode.HTML)
        try:
            r2 = await db.get_resident(uid)
            await context.bot.send_message(uid, texts.APPROVED_USER_MSG,
                                           parse_mode=ParseMode.HTML, reply_markup=main_menu(r2))
        except Exception as e:
            logger.warning("Tasdiq xabari yuborilmadi: %s", e)
    else:
        await db.set_resident_status(uid, "rejected")
        await query.answer("Rad etildi")
        await query.edit_message_text(query.message.text_html + "\n\n❌ <b>Rad etildi</b>",
                                      parse_mode=ParseMode.HTML)
        try:
            await context.bot.send_message(uid, texts.REJECTED_USER_MSG)
        except Exception:
            pass


# =================== Sikl vazifa yordamchilari ===================
async def ensure_cycle_assignment(telegram_id: int, cyc: dt.date) -> str | None:
    if rotation.before_start(cyc):
        return None
    existing = await db.get_assignment(telegram_id, cyc)
    if existing:
        return existing["areas"]
    ids = await available_ids(cyc)
    if telegram_id not in ids:
        return None
    mapping = rotation.assign_cycle(ids, rotation.cycle_index(cyc))
    task = mapping.get(telegram_id)
    if task:
        await db.create_assignment(telegram_id, cyc, task)
    return task


# =================== Reply menyu dispatcher ===================
async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    text = (update.message.text or "").strip()

    # Kutilayotgan kiritishlar
    awaiting = context.user_data.get("awaiting")
    if awaiting in ("away_date", "extend_date"):
        await handle_date_input(update, context, awaiting, text)
        return
    if awaiting == "custom_fine":
        await handle_custom_fine(update, context, text)
        return

    resident = await db.get_resident(user.id)
    if not resident or resident["status"] != "active":
        return  # tasdiqlanmaganlarga menyu yo'q

    if text == texts.BTN_MY_TASK:
        await show_my_task(update, context, resident)
    elif text == texts.BTN_REPORT:
        await show_report_menu(update, context)
    elif text == texts.BTN_RESIDENTS:
        await show_residents_today(update, context)
    elif text == texts.BTN_RULES_FINES:
        await show_rules_fines(update, context)
    elif text == texts.BTN_AWAY:
        await start_away(update, context, resident)
    elif text == texts.BTN_BACK:
        await came_back(update, context, resident)
    elif text == texts.BTN_HELP:
        await cmd_help(update, context)


async def show_my_task(update, context, resident) -> None:
    today = today_local()
    if is_away_on(resident, today):
        await update.message.reply_text(texts.away_status(fmt_short(resident["away_until"])))
        return
    if rotation.before_start(today):
        await update.message.reply_text(
            "🧹 Tozalik vazifalari <b>23-iyun</b>dan boshlanadi.\n"
            "Hozircha 🚪 eshik, 🍳 oshxona, 🚿 dush hisobotlarini yuborishingiz mumkin.",
            parse_mode=ParseMode.HTML, reply_markup=main_menu(resident))
        return
    cyc = rotation.cycle_start(today)
    task = await ensure_cycle_assignment(resident["telegram_id"], cyc)
    a = await db.get_assignment(resident["telegram_id"], cyc)
    done = bool(a and a["status"] in ("reported", "approved"))
    cats = await db.get_extra_categories(resident["telegram_id"], today)
    cyc_str = f"{fmt_short(cyc)} – {fmt_short(rotation.cycle_end(today))}"
    await update.message.reply_text(
        texts.my_task_msg(cyc_str, task, done, "door_out" in cats, "door_in" in cats),
        parse_mode=ParseMode.HTML, reply_markup=main_menu(resident),
    )


def report_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(texts.RB_TASK, callback_data="rep:task")],
        [InlineKeyboardButton(texts.RB_KITCHEN, callback_data="rep:kitchen_used")],
        [InlineKeyboardButton(texts.RB_SHOWER, callback_data="rep:shower_after")],
        [InlineKeyboardButton(texts.RB_DOOR_OUT, callback_data="rep:door_out")],
        [InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")],
    ])


async def show_report_menu(update, context) -> None:
    await update.message.reply_text(texts.REPORT_MENU_TITLE, reply_markup=report_menu_kb())


async def on_report_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    cat = query.data.split(":")[1]
    context.user_data["pending_category"] = cat
    label = texts.RB_LABELS[cat]
    await query.edit_message_text(f"{label}\n\n{texts.SEND_VIDEO_NOW}", parse_mode=ParseMode.HTML)


# =================== Video hisobot ===================
async def on_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    resident = await db.get_resident(user.id)
    if not resident or resident["status"] != "active":
        await update.message.reply_text(texts.NOT_REGISTERED)
        return
    if update.message.video_note:
        file_id, file_type = update.message.video_note.file_id, "video_note"
    elif update.message.video:
        file_id, file_type = update.message.video.file_id, "video"
    else:
        return

    cat = context.user_data.pop("pending_category", None)
    if not cat:
        await update.message.reply_text(
            "Avval qaysi hisobot ekanini tanlang 👇", reply_markup=report_menu_kb()
        )
        return

    today = today_local()
    label = texts.RB_LABELS[cat]

    no_task = False
    if cat == "task":
        cyc = rotation.cycle_start(today)
        a = await db.get_assignment(user.id, cyc)
        if a:
            await db.set_assignment_status(a["id"], "reported")
        else:
            no_task = True
    rid = await db.add_extra_report(user.id, today, cat, file_id, file_type)
    if no_task:
        await update.message.reply_text(texts.NO_TASK_TO_REPORT)

    await update.message.reply_text(texts.report_saved(label), parse_mode=ParseMode.HTML)

    caption = f"📹 <b>{resident['name']}</b>\n{label}\n🗓 {fmt_date(today)}\n\nTasdiqlaysizmi?"
    await broadcast_report(context, file_id, file_type, caption, rid)

    # Eshik: chiqishdan keyin kirish tugmasi
    if cat == "door_out":
        await update.message.reply_text(
            texts.DOOR_NEXT_HINT,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")]]),
        )


def html_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def mention(uid: int, name: str) -> str:
    return f'<a href="tg://user?id={uid}">{html_escape(name)}</a>'


async def announce_to_group(context, cycle_start, deadline, task_to_uid, name_by) -> None:
    """Guruhga yangi taqsimotni har bir kishini belgilab e'lon qiladi."""
    gid = await db.get_setting("group_chat_id")
    if not gid:
        return
    lines = [
        f"📋 <b>Yangi tozalik navbati</b> ({fmt_short(cycle_start)})\n",
    ]
    for task in texts.TASKS:
        uid = task_to_uid.get(task)
        who = mention(uid, name_by.get(uid, "—")) if uid else "—"
        lines.append(f"{task} → {who}")
    lines.append(f"\n⏰ Hisobot muddati: <b>{fmt_short(deadline)} 05:00</b> gacha.")
    lines.append("Tozalab, botga 📤 orqali video yuboring.")
    try:
        await context.bot.send_message(int(gid), "\n".join(lines), parse_mode=ParseMode.HTML)
    except Exception as e:
        logger.warning("Guruhga e'lon yuborilmadi: %s", e)


async def broadcast_report(context, file_id, file_type, caption, report_id) -> None:
    """Adminlarga (tasdiqlash tugmalari bilan) va guruhga (tugmasiz) yuboradi."""
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"rok:{report_id}"),
        InlineKeyboardButton("❌ Rad etish", callback_data=f"rno:{report_id}"),
    ]])
    for admin_id in ADMIN_IDS:
        try:
            if file_type == "video_note":
                await context.bot.send_video_note(admin_id, file_id)
                await context.bot.send_message(admin_id, caption, parse_mode=ParseMode.HTML,
                                               reply_markup=kb)
            else:
                await context.bot.send_video(admin_id, file_id, caption=caption,
                                             parse_mode=ParseMode.HTML, reply_markup=kb)
        except Exception as e:
            logger.warning("Adminga hisobot yuborilmadi %s: %s", admin_id, e)
    # Guruhga (tugmasiz)
    gid = await db.get_setting("group_chat_id")
    if gid:
        try:
            gid_int = int(gid)
            gcap = caption.replace("\n\nTasdiqlaysizmi?", "")
            if file_type == "video_note":
                await context.bot.send_video_note(gid_int, file_id)
                await context.bot.send_message(gid_int, gcap, parse_mode=ParseMode.HTML)
            else:
                await context.bot.send_video(gid_int, file_id, caption=gcap, parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.warning("Guruhga hisobot yuborilmadi: %s", e)


async def on_report_review(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    action, rid_str = query.data.split(":")
    report = await db.get_extra_report(int(rid_str))
    if not report:
        await query.answer("Hisobot topilmadi.", show_alert=True)
        return
    uid = report["telegram_id"]
    cat = report["category"]
    rdate = report["report_date"]
    label = texts.RB_LABELS.get(cat, cat)

    if action == "rok":
        await db.set_extra_report_status(report["id"], "approved")
        if cat == "task":
            cyc = rotation.cycle_start(rdate)
            a = await db.get_assignment(uid, cyc)
            if a:
                await db.set_assignment_status(a["id"], "approved")
            await db.clear_fine_by(uid, cyc, "cleaning")
        await query.answer("Tasdiqlandi ✅")
        await _mark(query, "✅ <b>Tasdiqlandi</b>")
        try:
            await context.bot.send_message(uid, texts.REPORT_APPROVED, parse_mode=ParseMode.HTML)
        except Exception:
            pass
    else:  # rno
        await db.set_extra_report_status(report["id"], "rejected")
        if cat == "task":
            cyc = rotation.cycle_start(rdate)
            a = await db.get_assignment(uid, cyc)
            if a:
                await db.set_assignment_status(a["id"], "assigned")
            # Muddat (sikl boshi + 1 kun) o'tgan bo'lsa darhol jarima
            if today_local() > cyc and not await db.has_fine(uid, cyc, "cleaning"):
                await db.add_fine(uid, a["id"] if a else None, FINE_AMOUNT,
                                  "Tozalik vazifasi tasdiqlanmadi", cyc, "cleaning")
        await query.answer("Rad etildi")
        await _mark(query, "❌ <b>Rad etildi</b>")
        try:
            await context.bot.send_message(uid, texts.report_rejected(label), parse_mode=ParseMode.HTML)
        except Exception:
            pass


async def _mark(query, suffix: str) -> None:
    try:
        if query.message.caption is not None:
            await query.edit_message_caption(
                caption=query.message.caption_html + "\n\n" + suffix, parse_mode=ParseMode.HTML)
        else:
            await query.edit_message_text(
                query.message.text_html + "\n\n" + suffix, parse_mode=ParseMode.HTML)
    except Exception:
        try:
            await query.edit_message_reply_markup(reply_markup=None)
        except Exception:
            pass


# =================== Kvartiradagilar ===================
async def show_residents_today(update, context) -> None:
    today = today_local()
    cyc = rotation.cycle_start(today)
    residents = await db.get_active_residents()
    members = [r for r in residents if not is_admin(r["telegram_id"])]
    if not members:
        await update.message.reply_text("Hozircha a'zolar yo'q.")
        return
    lines = [f"🏠 <b>Kvartiradagilar — bugun ({fmt_short(today)})</b>\n"]
    for r in members:
        if is_away_on(r, today):
            lines.append(f"✈️ <b>{r['name']}</b> — viloyatda ({fmt_short(r['away_until'])} gacha)")
            continue
        cats = await db.get_extra_categories(r["telegram_id"], today)
        a = await db.get_assignment(r["telegram_id"], cyc)
        parts = []
        if a:
            parts.append(("✅" if a["status"] == "reported" else "❌") + " " + a["areas"])
        parts.append("🚪chiq " + ("✅" if "door_out" in cats else "❌"))
        parts.append("🔑kir " + ("✅" if "door_in" in cats else "❌"))
        if "kitchen_used" in cats:
            parts.append("🍳✅")
        if "shower_after" in cats:
            parts.append("🚿✅")
        lines.append(f"<b>{r['name']}</b>: " + " · ".join(parts))
    lines.append("\n👤 Batafsil kartochka uchun a'zoni tanlang:")
    # A'zo kartochka tugmalari (2 tadan qatorga)
    member_rows = []
    row = []
    for r in members:
        row.append(InlineKeyboardButton(f"👤 {r['name']}", callback_data=f"memb:{r['telegram_id']}"))
        if len(row) == 2:
            member_rows.append(row); row = []
    if row:
        member_rows.append(row)
    member_rows += [
        [InlineKeyboardButton("📋 Vazifalar taqsimoti", callback_data="restasks")],
        [InlineKeyboardButton("💸 Jarimalar (sabablari)", callback_data="resfines")],
        [InlineKeyboardButton("📅 So'nggi 7 kun", callback_data="res7")],
    ]
    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(member_rows),
    )


async def show_member_card(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    uid = int(query.data.split(":")[1])
    r = await db.get_resident(uid)
    if not r:
        await query.message.reply_text("A'zo topilmadi.")
        return
    today = today_local()
    lines = [f"👤 <b>{r['name']}</b>", f"📱 {r['phone']}"]
    if is_away_on(r, today):
        lines.append(f"✈️ Viloyatda ({fmt_short(r['away_until'])} gacha)")
    # Joriy vazifa
    if not rotation.before_start(today):
        cyc = rotation.cycle_start(today)
        a = await db.get_assignment(uid, cyc)
        if a:
            st = {"assigned": "❌ yo'q", "reported": "⏳ tasdiq kutilmoqda",
                  "approved": "✅ tasdiqlangan", "missed": "❌ bajarilmadi"}.get(a["status"], a["status"])
            lines.append(f"🧹 Vazifa: <b>{a['areas']}</b> — {st}")
    # Jarimalar
    fines = await db.get_user_fine_details(uid)
    if fines:
        tot = sum(f["amount"] for f in fines)
        lines.append(f"💸 Jarima: {len(fines)} ta — {fmt_sum(tot)} so'm")
    # So'nggi 7 kun, sana bo'yicha
    start = today - dt.timedelta(days=6)
    rows = await db.get_extra_reports_between(uid, start, today)
    by_date: dict = {}
    for x in rows:
        by_date.setdefault(x["report_date"], []).append(x["category"])
    lines.append("\n📅 <b>So'nggi 7 kun:</b>")
    if not by_date and not (not rotation.before_start(today)):
        lines.append("— hali atchot yo'q")
    if by_date:
        for d in sorted(by_date, reverse=True):
            labels = [texts.CATEGORIES.get(c, c) for c in by_date[d]]
            lines.append(f"• {fmt_short(d)}: " + ", ".join(labels))
    else:
        lines.append("— atchot yo'q")
    kb = None
    if is_admin(query.from_user.id):
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("💸 Jarima yozish", callback_data=f"af:{uid}"),
            InlineKeyboardButton("🗑 Chiqarib tashlash", callback_data=f"rem:{uid}"),
        ]])
    await query.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=kb)


async def show_task_distribution(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    today = today_local()
    cyc = rotation.cycle_start(today)
    ids = await available_ids(cyc)
    mapping = rotation.assign_cycle(ids, rotation.cycle_index(cyc))
    name_by = {}
    for r in await db.get_active_residents():
        name_by[r["telegram_id"]] = r["name"]
    task_to_person = {t: "—" for t in texts.TASKS}
    for uid, task in mapping.items():
        if task:
            task_to_person[task] = name_by.get(uid, str(uid))
    cyc_str = f"{fmt_short(cyc)} – {fmt_short(rotation.cycle_end(today))}"
    rows = [(t, task_to_person[t]) for t in texts.TASKS]
    await query.message.reply_text(
        texts.task_distribution(cyc_str, rows), parse_mode=ParseMode.HTML)


async def show_all_fines(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    rows = await db.get_all_fine_details()
    data = [(r["name"], r["reason"], r["amount"], fmt_short(r["fine_date"])) for r in rows]
    await query.message.reply_text(texts.all_fines_text(data), parse_mode=ParseMode.HTML)


async def show_residents_week(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    today = today_local()
    start = today - dt.timedelta(days=6)
    residents = await db.get_active_residents()
    members = [r for r in residents if not is_admin(r["telegram_id"])]
    lines = [f"📅 <b>So'nggi 7 kun ({fmt_short(start)} – {fmt_short(today)})</b>\n"]
    for r in members:
        rows = await db.get_extra_reports_between(r["telegram_id"], start, today)
        n_task = sum(1 for x in rows if x["category"] == "task")
        n_out = sum(1 for x in rows if x["category"] == "door_out")
        n_in = sum(1 for x in rows if x["category"] == "door_in")
        n_kit = sum(1 for x in rows if x["category"] == "kitchen_used")
        n_sh = sum(1 for x in rows if x["category"] == "shower_after")
        lines.append(
            f"<b>{r['name']}</b>: 🧹{n_task} · 🚪{n_out} · 🔑{n_in} · 🍳{n_kit} · 🚿{n_sh}"
        )
    lines.append("\n<i>🧹 vazifa · 🚪 chiqish · 🔑 kirish · 🍳 oshxona · 🚿 dush (atchotlar soni)</i>")
    await query.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


# =================== Jarimalar ===================
async def show_rules_fines(update, context) -> None:
    rows = await db.get_user_fine_details(update.effective_user.id)
    details = [(r["reason"], r["amount"], fmt_short(r["fine_date"])) for r in rows]
    total = sum(r["amount"] for r in rows)
    await update.message.reply_text(
        texts.rules_and_fines(texts.rules_text(), details, total), parse_mode=ParseMode.HTML
    )


# =================== Viloyat ===================
async def start_away(update, context, resident) -> None:
    if is_away_on(resident, today_local()):
        await update.message.reply_text(texts.away_status(fmt_short(resident["away_until"])))
        return
    context.user_data["awaiting"] = "away_date"
    await update.message.reply_text(texts.AWAY_ASK_DATE, parse_mode=ParseMode.HTML)


async def handle_date_input(update, context, awaiting, text) -> None:
    if text.startswith("/"):
        return
    ret = parse_uz_date(text)
    if not ret:
        await update.message.reply_text(texts.AWAY_BAD_DATE, parse_mode=ParseMode.HTML)
        return
    if ret <= today_local():
        await update.message.reply_text(texts.AWAY_PAST_DATE)
        return
    uid = update.effective_user.id
    await db.set_away(uid, ret)
    await db.delete_future_assignments(uid, rotation.cycle_start(today_local()))
    context.user_data.pop("awaiting", None)
    resident = await db.get_resident(uid)
    await update.message.reply_text(
        texts.away_set_msg(fmt_date(ret)), parse_mode=ParseMode.HTML,
        reply_markup=main_menu(resident),
    )
    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(
                admin_id, f"✈️ {resident['name']} viloyatga ketdi ({fmt_short(ret)} gacha).")
        except Exception:
            pass


async def handle_custom_fine(update, context, text) -> None:
    if text.startswith("/"):
        context.user_data.pop("awaiting", None)
        return
    uid = context.user_data.get("fine_uid")
    context.user_data.pop("awaiting", None)
    context.user_data.pop("fine_uid", None)
    if not uid:
        return
    parts = text.rsplit(" ", 1)
    if len(parts) == 2 and parts[1].isdigit():
        reason, amount = parts[0], int(parts[1])
    else:
        reason, amount = text, FINE_AMOUNT
    target = await db.get_resident(uid)
    if not target:
        await update.message.reply_text("A'zo topilmadi.")
        return
    await db.add_fine(uid, None, amount, reason, today_local(), "manual")
    await update.message.reply_text(
        f"✅ {target['name']} ga {fmt_sum(amount)} so'm jarima yozildi.\nSabab: {reason}")
    try:
        await context.bot.send_message(uid, texts.admin_fine_notice(amount, reason),
                                       parse_mode=ParseMode.HTML)
    except Exception:
        pass


async def came_back(update, context, resident) -> None:
    if not is_away_on(resident, today_local()):
        await update.message.reply_text(texts.NOT_AWAY)
        return
    await db.clear_away(resident["telegram_id"])
    r2 = await db.get_resident(resident["telegram_id"])
    await update.message.reply_text(texts.BACK_MSG, parse_mode=ParseMode.HTML,
                                    reply_markup=main_menu(r2))


async def on_return_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    action = query.data.split(":")[1]
    uid = query.from_user.id
    if action == "yes":
        await db.clear_away(uid)
        await query.edit_message_text(texts.BACK_MSG, parse_mode=ParseMode.HTML)
    else:  # extend
        context.user_data["awaiting"] = "extend_date"
        await query.edit_message_text(texts.AWAY_EXTEND_ASK)


# =================== Foydalanuvchi buyruqlari ===================
async def cmd_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        f"🆔 Sizning Telegram ID: <code>{update.effective_user.id}</code>",
        parse_mode=ParseMode.HTML,
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    base = (
        "🏠 <b>Uy Tartibi boti</b>\n\n"
        "Pastdagi tugmalardan foydalaning:\n"
        "📋 Mening vazifam · 📤 Hisobot yuborish\n"
        "🏠 Kvartiradagilar · 📜 Qoidalar va jarimalar\n"
        "✈️ Viloyatga ketdim · ❓ Yordam\n\n"
        "Hisobot: 📤 bosib, turini tanlang, keyin video yuboring.\n"
        "Har bir video admin tasdig'iga boradi — tasdiqlansa jarima yo'q.\n"
    )
    if is_admin(update.effective_user.id):
        base += (
            "\n👑 <b>Admin:</b>\n"
            "/admin — admin panel (jarima, vazifa taqsimoti, a'zo chiqarish)\n"
            "/azolar · /arizalar · /jarimalar\n"
            "/jarima_ber &lt;id&gt; &lt;summa&gt; &lt;sabab&gt; · /jarima_ochir &lt;id&gt;\n"
            "/guruh — shu guruhni atchotlar uchun ulash\n"
        )
    await update.message.reply_text(base, parse_mode=ParseMode.HTML)


# =================== Admin buyruqlari ===================
async def cmd_azolar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    residents = await db.get_active_residents()
    members = [r for r in residents if not is_admin(r["telegram_id"])]
    if not members:
        await update.message.reply_text("Faol a'zolar yo'q.")
        return
    lines = ["👥 <b>Faol a'zolar:</b>\n"]
    for i, r in enumerate(members, 1):
        extra = " ✈️" if is_away_on(r, today_local()) else ""
        lines.append(f"{i}. {r['name']} — {r['phone']} (<code>{r['telegram_id']}</code>){extra}")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


async def cmd_arizalar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    pend = await db.get_pending_residents()
    if not pend:
        await update.message.reply_text("Kutilayotgan ariza yo'q.")
        return
    for r in pend:
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"uok:{r['telegram_id']}"),
            InlineKeyboardButton("❌ Rad etish", callback_data=f"uno:{r['telegram_id']}"),
        ]])
        await update.message.reply_text(
            f"👤 {r['name']}\n📱 {r['phone']}\n🆔 <code>{r['telegram_id']}</code>",
            parse_mode=ParseMode.HTML, reply_markup=kb)


async def cmd_jarimalar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    rows = await db.get_all_active_fines()
    if not rows:
        await update.message.reply_text("✅ Hech kimda faol jarima yo'q.")
        return
    lines = ["💸 <b>Faol jarimalar:</b>\n"]
    grand = 0
    for r in rows:
        grand += r["total"]
        lines.append(f"• {r['name']}: {r['cnt']} ta — <b>{fmt_sum(r['total'])} so'm</b>")
    lines.append(f"\n➖➖➖\nJami: <b>{fmt_sum(grand)} so'm</b>")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


async def cmd_jarima_ber(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    if len(context.args) < 2 or not context.args[0].isdigit() or not context.args[1].isdigit():
        await update.message.reply_text(
            "Foydalanish: <code>/jarima_ber &lt;id&gt; &lt;summa&gt; &lt;sabab&gt;</code>",
            parse_mode=ParseMode.HTML)
        return
    uid, amount = int(context.args[0]), int(context.args[1])
    reason = " ".join(context.args[2:]) or "Admin tomonidan jarima"
    target = await db.get_resident(uid)
    if not target:
        await update.message.reply_text("Bunday a'zo topilmadi.")
        return
    await db.add_fine(uid, None, amount, reason, today_local(), "manual")
    await update.message.reply_text(f"✅ {target['name']} ga {fmt_sum(amount)} so'm jarima yozildi.")
    try:
        await context.bot.send_message(uid, texts.admin_fine_notice(amount, reason),
                                       parse_mode=ParseMode.HTML)
    except Exception:
        pass


async def cmd_jarima_ochir(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    if not context.args or not context.args[0].isdigit():
        await update.message.reply_text(
            "Foydalanish: <code>/jarima_ochir &lt;id&gt;</code>", parse_mode=ParseMode.HTML)
        return
    uid = int(context.args[0])
    n = await db.clear_user_active_fines(uid)
    await update.message.reply_text(f"✅ {n} ta faol jarima o'chirildi.")
    if n:
        try:
            await context.bot.send_message(uid, "✅ Jarimalaringiz admin tomonidan o'chirildi.")
        except Exception:
            pass


async def cmd_guruh(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Guruhda ishlatiladi — shu guruhni atchotlar uchun ulaydi."""
    if not is_admin(update.effective_user.id):
        return
    chat = update.effective_chat
    if chat.type not in ("group", "supergroup"):
        await update.message.reply_text("Bu buyruqni guruh ichida yuboring.")
        return
    await db.set_setting("group_chat_id", str(chat.id))
    await update.message.reply_text("✅ Shu guruh atchotlar uchun ulandi. Endi barcha video hisobotlar shu yerga ham tushadi.")


async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton(texts.AP_FINE, callback_data="ap:fine")],
        [InlineKeyboardButton(texts.AP_TASKS, callback_data="ap:tasks")],
        [InlineKeyboardButton(texts.AP_FINES, callback_data="ap:fines")],
        [InlineKeyboardButton(texts.AP_PENDING, callback_data="ap:pending")],
        [InlineKeyboardButton(texts.AP_REMOVE, callback_data="ap:remove")],
    ])
    await update.message.reply_text(texts.ADMIN_PANEL_TITLE, parse_mode=ParseMode.HTML,
                                    reply_markup=kb)


async def on_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    what = query.data.split(":")[1]
    await query.answer()
    if what == "fine":
        residents = await db.get_active_residents()
        members = [r for r in residents if not is_admin(r["telegram_id"])]
        if not members:
            await query.message.reply_text("A'zolar yo'q.")
            return
        rows = [[InlineKeyboardButton(r["name"], callback_data=f"af:{r['telegram_id']}")]
                for r in members]
        await query.message.reply_text(texts.AP_PICK_MEMBER,
                                       reply_markup=InlineKeyboardMarkup(rows))
    elif what == "tasks":
        await show_task_distribution(update, context)
    elif what == "fines":
        await show_all_fines(update, context)
    elif what == "pending":
        await cmd_arizalar_from(query, context)
    elif what == "remove":
        residents = await db.get_active_residents()
        members = [r for r in residents if not is_admin(r["telegram_id"])]
        if not members:
            await query.message.reply_text("A'zolar yo'q.")
            return
        rows = [[InlineKeyboardButton(f"🗑 {r['name']}", callback_data=f"rem:{r['telegram_id']}")]
                for r in members]
        await query.message.reply_text("Kimni chiqaramiz? 👇",
                                       reply_markup=InlineKeyboardMarkup(rows))


async def cmd_arizalar_from(query, context) -> None:
    pend = await db.get_pending_residents()
    if not pend:
        await query.message.reply_text("Kutilayotgan ariza yo'q.")
        return
    for r in pend:
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"uok:{r['telegram_id']}"),
            InlineKeyboardButton("❌ Rad etish", callback_data=f"uno:{r['telegram_id']}"),
        ]])
        await query.message.reply_text(
            f"👤 {r['name']}\n📱 {r['phone']}\n🆔 <code>{r['telegram_id']}</code>",
            parse_mode=ParseMode.HTML, reply_markup=kb)


async def on_admin_fine_member(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    await query.answer()
    uid = query.data.split(":")[1]
    rows = [[InlineKeyboardButton(v, callback_data=f"afr:{uid}:{k}")]
            for k, v in texts.FINE_REASONS.items()]
    await query.edit_message_text(texts.AP_PICK_REASON,
                                  reply_markup=InlineKeyboardMarkup(rows))


async def on_admin_fine_reason(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    _, uid_str, key = query.data.split(":")
    uid = int(uid_str)
    target = await db.get_resident(uid)
    if not target:
        await query.answer("A'zo topilmadi.", show_alert=True)
        return
    if key == "boshqa":
        await query.answer()
        context.user_data["awaiting"] = "custom_fine"
        context.user_data["fine_uid"] = uid
        await query.edit_message_text(
            f"<b>{target['name']}</b> uchun.\n{texts.AP_CUSTOM_ASK}", parse_mode=ParseMode.HTML)
        return
    reason = texts.FINE_REASONS[key]
    await db.add_fine(uid, None, FINE_AMOUNT, reason, today_local(), "manual")
    await query.answer("Jarima yozildi ✅")
    await query.edit_message_text(
        f"✅ <b>{target['name']}</b> ga {fmt_sum(FINE_AMOUNT)} so'm jarima yozildi.\n"
        f"Sabab: {reason}", parse_mode=ParseMode.HTML)
    try:
        await context.bot.send_message(uid, texts.admin_fine_notice(FINE_AMOUNT, reason),
                                       parse_mode=ParseMode.HTML)
    except Exception:
        pass


async def on_remove_member(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    await query.answer()
    uid = query.data.split(":")[1]
    target = await db.get_resident(int(uid))
    if not target:
        await query.message.reply_text("A'zo topilmadi.")
        return
    await query.message.reply_text(
        f"🗑 <b>{target['name']}</b> ni kvartiradan chiqaramizmi? "
        "Unga endi vazifa berilmaydi.",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Ha, chiqarish", callback_data=f"remy:{uid}"),
            InlineKeyboardButton("❌ Yo'q", callback_data="remn"),
        ]]))


async def on_remove_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    if query.data == "remn":
        await query.answer()
        await query.edit_message_text("Bekor qilindi.")
        return
    uid = int(query.data.split(":")[1])
    target = await db.get_resident(uid)
    await db.set_resident_status(uid, "removed")
    await db.delete_future_assignments(uid, rotation.cycle_start(today_local()))
    await query.answer("Chiqarildi")
    name = target["name"] if target else str(uid)
    await query.edit_message_text(f"🗑 <b>{name}</b> kvartiradan chiqarildi.", parse_mode=ParseMode.HTML)
    try:
        await context.bot.send_message(uid, "ℹ️ Siz kvartira navbatchiligidan chiqarildingiz.")
    except Exception:
        pass


async def cmd_eslat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    await job_morning(context)
    await update.message.reply_text("📨 Vazifalar yuborildi.")


# =================== Jadval (JobQueue) ===================
async def job_morning(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ertalab: yangi sikl boshlansa vazifa tarqatish + qaytish so'rovlari."""
    today = today_local()
    if not rotation.before_start(today) and rotation.is_cycle_start(today):
        ids = await available_ids(today)
        mapping = rotation.assign_cycle(ids, rotation.cycle_index(today))
        deadline = today + dt.timedelta(days=1)
        name_by = {r["telegram_id"]: r["name"] for r in await db.get_active_residents()}
        task_to_uid: dict[str, int] = {}
        for uid, task in mapping.items():
            if not task:
                continue
            task_to_uid[task] = uid
            await db.create_assignment(uid, today, task)
            try:
                await context.bot.send_message(
                    uid,
                    f"🆕 <b>Yangi tozalik vazifasi</b>\n\n"
                    f"🧹 Vazifangiz: <b>{task}</b>\n"
                    f"⏰ Hisobot muddati: <b>{fmt_short(deadline)} 05:00</b> gacha.\n"
                    "Tozalab, 📤 orqali video yuboring. Yubormasangiz jarima yoziladi.",
                    parse_mode=ParseMode.HTML)
            except Exception as e:
                logger.warning("Sikl xabari yuborilmadi %s: %s", uid, e)
        # Guruhga e'lon (har bir kishini belgilab)
        await announce_to_group(context, today, deadline, task_to_uid, name_by)
    # Qaytish so'rovlari
    for r in await db.get_residents_returning_on(today):
        try:
            await context.bot.send_message(
                r["telegram_id"], texts.return_prompt_msg(fmt_short(today)),
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🏠 Uyga keldim", callback_data="back:yes"),
                    InlineKeyboardButton("⏳ Uzaytirish", callback_data="back:extend"),
                ]]))
        except Exception:
            pass


async def job_remind(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Kechqurun: vazifa berilgan kuni hisobot bermaganlarni eslatish.

    Muddat ertasi kun 05:00 bo'lgani uchun vazifa berilgan kuni kechqurun eslatamiz.
    """
    today = today_local()
    if rotation.before_start(today) or not rotation.is_cycle_start(today):
        return
    cyc = today
    for r in await db.get_available_residents(today):
        uid = r["telegram_id"]
        if is_admin(uid):
            continue
        a = await db.get_assignment(uid, cyc)
        if a and a["status"] not in ("reported", "approved"):
            try:
                await context.bot.send_message(
                    uid,
                    f"⏰ <b>Eslatma:</b> ertaga 05:00 gacha hisobot kerak!\n"
                    f"🧹 Tozalik vazifangiz: <b>{a['areas']}</b> — hali yuborilmagan. "
                    "📤 orqali video yuboring.",
                    parse_mode=ParseMode.HTML)
            except Exception:
                pass


async def job_deadline(context: ContextTypes.DEFAULT_TYPE) -> None:
    """05:00: vazifa berilgan kunning ertasi — hisobot bermaganlarga tozalik jarimasi.

    Vazifa sikl boshida beriladi, hisobot ertasi kun 05:00 gacha kerak.
    Eshik/oshxona/dush uchun avtomatik jarima yo'q — admin qo'lda yozadi.
    """
    today = today_local()
    yesterday = today - dt.timedelta(days=1)

    # Kecha vazifa berilgan bo'lsa (sikl boshi), bugun 05:00 da tekshiramiz
    if rotation.before_start(yesterday) or not rotation.is_cycle_start(yesterday):
        return
    for a in await db.get_cycle_assignments(yesterday):
        if a["status"] not in ("assigned",):
            continue
        await db.set_assignment_status(a["id"], "missed")
        uid = a["telegram_id"]
        if await db.has_fine(uid, yesterday, "cleaning"):
            continue
        await db.add_fine(uid, a["id"], FINE_AMOUNT,
                          f"Tozalik vazifasi bajarilmadi ({a['areas']})", yesterday, "cleaning")
        try:
            await context.bot.send_message(
                uid, texts.fine_summary_msg(
                    [(f"Tozalik: {a['areas']}", FINE_AMOUNT)], FINE_AMOUNT),
                parse_mode=ParseMode.HTML)
        except Exception:
            pass


# =================== Ishga tushirish ===================
def parse_uz_date(text: str) -> dt.date | None:
    text = text.strip().lower().replace("/", " ").replace("-", " ").replace(".", " ")
    parts = text.split()
    today = today_local()
    if len(parts) == 3 and len(parts[0]) == 4 and parts[0].isdigit():
        try:
            return dt.date(int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError:
            return None
    if parts and parts[0].isdigit():
        day = int(parts[0])
        month, year = None, today.year
        if len(parts) >= 2:
            p1 = parts[1]
            if p1.isdigit():
                month = int(p1)
            else:
                for i, m in enumerate(MONTHS, 1):
                    if p1.startswith(m[:4]):
                        month = i
                        break
        if len(parts) >= 3 and parts[2].isdigit():
            year = int(parts[2])
            if year < 100:
                year += 2000
        if month and 1 <= month <= 12 and 1 <= day <= 31:
            try:
                d = dt.date(year, month, day)
            except ValueError:
                return None
            if d < today and len(parts) < 3:
                try:
                    d = dt.date(year + 1, month, day)
                except ValueError:
                    return None
            return d
    return None


async def post_init(app: Application) -> None:
    await db.init_pool()
    # Bir martalik: rasman ishga tushishdan (21-iyun 05:00) oldingi jarimalarni o'chirish
    if await db.get_setting("launch_reset_2026_06_21") is None:
        n = await db.clear_all_fines()
        await db.set_setting("launch_reset_2026_06_21", "done")
        logger.info("Launch reset: %d ta eski jarima o'chirildi", n)
    await app.bot.set_my_commands([
        ("start", "Boshlash / menyu"),
        ("id", "Telegram ID'im"),
        ("help", "Yordam"),
    ])
    logger.info("Bot ishga tushdi. Adminlar: %s", ADMIN_IDS or "(o'rnatilmagan!)")


async def post_shutdown(app: Application) -> None:
    await db.close_pool()


def main() -> None:
    app = (
        Application.builder().token(BOT_TOKEN)
        .post_init(post_init).post_shutdown(post_shutdown).build()
    )

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, got_name)],
            PHONE: [MessageHandler(filters.CONTACT, got_phone),
                    MessageHandler(filters.TEXT & ~filters.COMMAND, got_phone)],
            RULES: [CallbackQueryHandler(on_agree, pattern="^agree$"),
                    CallbackQueryHandler(on_disagree, pattern="^disagree$")],
        },
        fallbacks=[CommandHandler("cancel", cancel), CommandHandler("bekor", cancel)],
        allow_reentry=True,
    )
    app.add_handler(conv)

    app.add_handler(CallbackQueryHandler(on_user_review, pattern=r"^u(ok|no):"))
    app.add_handler(CallbackQueryHandler(on_report_review, pattern=r"^r(ok|no):"))
    app.add_handler(CallbackQueryHandler(on_report_button, pattern=r"^rep:"))
    app.add_handler(CallbackQueryHandler(on_return_buttons, pattern=r"^back:"))
    app.add_handler(CallbackQueryHandler(show_residents_week, pattern=r"^res7$"))
    app.add_handler(CallbackQueryHandler(show_task_distribution, pattern=r"^restasks$"))
    app.add_handler(CallbackQueryHandler(show_all_fines, pattern=r"^resfines$"))
    app.add_handler(CallbackQueryHandler(show_member_card, pattern=r"^memb:"))
    app.add_handler(CallbackQueryHandler(on_admin_panel, pattern=r"^ap:"))
    app.add_handler(CallbackQueryHandler(on_admin_fine_reason, pattern=r"^afr:"))
    app.add_handler(CallbackQueryHandler(on_admin_fine_member, pattern=r"^af:"))
    app.add_handler(CallbackQueryHandler(on_remove_confirm, pattern=r"^rem(y:|n$)"))
    app.add_handler(CallbackQueryHandler(on_remove_member, pattern=r"^rem:"))

    app.add_handler(CommandHandler("id", cmd_id))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("bekor", cancel))
    app.add_handler(CommandHandler("azolar", cmd_azolar))
    app.add_handler(CommandHandler("arizalar", cmd_arizalar))
    app.add_handler(CommandHandler("jarimalar", cmd_jarimalar))
    app.add_handler(CommandHandler("jarima_ber", cmd_jarima_ber))
    app.add_handler(CommandHandler("jarima_ochir", cmd_jarima_ochir))
    app.add_handler(CommandHandler("guruh", cmd_guruh))
    app.add_handler(CommandHandler("admin", cmd_admin))
    app.add_handler(CommandHandler("eslat", cmd_eslat))

    app.add_handler(MessageHandler(filters.VIDEO | filters.VIDEO_NOTE, on_video))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    jq = app.job_queue
    jq.run_daily(job_morning, time=dt.time(hour=ANNOUNCE_HOUR, minute=0, tzinfo=TZ))
    jq.run_daily(job_remind, time=dt.time(hour=REMIND_HOUR, minute=0, tzinfo=TZ))
    jq.run_daily(job_deadline, time=dt.time(hour=DEADLINE_HOUR, minute=0, tzinfo=TZ))

    logger.info("Polling boshlandi...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
