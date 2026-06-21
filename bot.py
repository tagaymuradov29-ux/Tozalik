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
    COOK_FINE_PARTIAL,
    CYCLE_DAYS,
    DEADLINE_HOUR,
    DOOR_FINE_FULL,
    DOOR_FINE_PARTIAL,
    FINE_AMOUNT,
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
        [texts.BTN_RESIDENTS, texts.BTN_MY_FINES],
        [texts.BTN_BACK if away else texts.BTN_AWAY, texts.BTN_HELP],
    ]
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


async def available_ids(on_date: dt.date) -> list[int]:
    """Faol, viloyatda emas va admin bo'lmagan a'zolar."""
    residents = await db.get_available_residents(on_date)
    return [r["telegram_id"] for r in residents if not is_admin(r["telegram_id"])]


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

    # Viloyat sana kiritish kutilyaptimi?
    awaiting = context.user_data.get("awaiting")
    if awaiting in ("away_date", "extend_date"):
        await handle_date_input(update, context, awaiting, text)
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
    elif text == texts.BTN_MY_FINES:
        await show_my_fines(update, context)
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
    cyc = rotation.cycle_start(today)
    task = await ensure_cycle_assignment(resident["telegram_id"], cyc)
    a = await db.get_assignment(resident["telegram_id"], cyc)
    done = bool(a and a["status"] == "reported")
    cats = await db.get_extra_categories(resident["telegram_id"], today)
    cyc_str = f"{fmt_short(cyc)} – {fmt_short(rotation.cycle_end(today))}"
    await update.message.reply_text(
        texts.my_task_msg(cyc_str, task, done, "door_out" in cats, "door_in" in cats),
        parse_mode=ParseMode.HTML, reply_markup=main_menu(resident),
    )


def report_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(texts.RB_TASK, callback_data="rep:task")],
        [InlineKeyboardButton(texts.RB_COOK_START, callback_data="rep:cook_start")],
        [InlineKeyboardButton(texts.RB_COOK_DISHES, callback_data="rep:cook_dishes")],
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
    label = {
        "task": texts.RB_TASK, "cook_start": texts.RB_COOK_START,
        "cook_dishes": texts.RB_COOK_DISHES, "door_out": texts.RB_DOOR_OUT,
        "door_in": texts.RB_DOOR_IN,
    }[cat]
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
    label = {
        "task": texts.RB_TASK, "cook_start": texts.RB_COOK_START,
        "cook_dishes": texts.RB_COOK_DISHES, "door_out": texts.RB_DOOR_OUT,
        "door_in": texts.RB_DOOR_IN,
    }[cat]

    if cat == "task":
        cyc = rotation.cycle_start(today)
        a = await db.get_assignment(user.id, cyc)
        if a:
            await db.set_assignment_status(a["id"], "reported")
        await db.add_extra_report(user.id, today, "task", file_id, file_type)
        if not a:
            await update.message.reply_text(texts.NO_TASK_TO_REPORT)
    else:
        await db.add_extra_report(user.id, today, cat, file_id, file_type)

    await update.message.reply_text(texts.report_saved(label), parse_mode=ParseMode.HTML)

    caption = f"📹 <b>{resident['name']}</b>\n{label}\n🗓 {fmt_date(today)}"
    await broadcast_report(context, file_id, file_type, caption)

    # Ichma-ich keyingi qadam
    if cat == "cook_start":
        await update.message.reply_text(
            texts.COOK_NEXT_HINT,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(texts.RB_COOK_DISHES, callback_data="rep:cook_dishes")]]),
        )
    elif cat == "door_out":
        await update.message.reply_text(
            texts.DOOR_NEXT_HINT,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")]]),
        )


async def broadcast_report(context, file_id, file_type, caption) -> None:
    """Videoni adminlarga va (sozlangan bo'lsa) guruhga yuboradi."""
    targets = set(ADMIN_IDS)
    gid = await db.get_setting("group_chat_id")
    if gid:
        try:
            targets.add(int(gid))
        except ValueError:
            pass
    for chat_id in targets:
        try:
            if file_type == "video_note":
                await context.bot.send_video_note(chat_id, file_id)
                await context.bot.send_message(chat_id, caption, parse_mode=ParseMode.HTML)
            else:
                await context.bot.send_video(chat_id, file_id, caption=caption,
                                             parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.warning("Hisobot yuborilmadi %s: %s", chat_id, e)


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
        if "cook_start" in cats:
            parts.append("🍳" + ("+🍽" if "cook_dishes" in cats else " (idish❌)"))
        lines.append(f"<b>{r['name']}</b>: " + " · ".join(parts))
    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📅 So'nggi 7 kun", callback_data="res7")]]),
    )


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
        n_cook = sum(1 for x in rows if x["category"] == "cook_start")
        lines.append(
            f"<b>{r['name']}</b>: 🧹{n_task} · 🚪{n_out} · 🔑{n_in} · 🍳{n_cook}"
        )
    lines.append("\n<i>🧹 tozalik · 🚪 chiqish · 🔑 kirish · 🍳 ovqat (atchotlar soni)</i>")
    await query.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


# =================== Jarimalar ===================
async def show_my_fines(update, context) -> None:
    cnt, total = await db.get_user_fines(update.effective_user.id)
    if cnt == 0:
        await update.message.reply_text("✅ Sizda faol jarima yo'q. Ofarin! 👏")
    else:
        await update.message.reply_text(
            f"💸 <b>Faol jarimalaringiz</b>\nSoni: {cnt} ta\n"
            f"Jami: <b>{fmt_sum(total)} so'm</b>",
            parse_mode=ParseMode.HTML,
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
        "🏠 Kvartiradagilar · 💸 Jarimalarim\n"
        "✈️ Viloyatga ketdim · ❓ Yordam\n\n"
        "Hisobot: 📤 tugmasini bosib, turini tanlang, keyin video yuboring.\n"
    )
    if is_admin(update.effective_user.id):
        base += (
            "\n👑 <b>Admin:</b>\n"
            "/azolar · /arizalar · /jarimalar\n"
            "/jarima_ber &lt;id&gt; &lt;summa&gt; &lt;sabab&gt;\n"
            "/jarima_ochir &lt;id&gt;\n"
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


async def cmd_eslat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    await job_morning(context)
    await update.message.reply_text("📨 Vazifalar yuborildi.")


# =================== Jadval (JobQueue) ===================
async def job_morning(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ertalab: yangi sikl boshlansa vazifa tarqatish + qaytish so'rovlari."""
    today = today_local()
    if rotation.is_cycle_start(today):
        ids = await available_ids(today)
        mapping = rotation.assign_cycle(ids, rotation.cycle_index(today))
        cyc_str = f"{fmt_short(today)} – {fmt_short(rotation.cycle_end(today))}"
        for uid, task in mapping.items():
            if not task:
                continue
            await db.create_assignment(uid, today, task)
            try:
                await context.bot.send_message(
                    uid,
                    f"🆕 <b>Yangi navbat ({cyc_str})</b>\n\n"
                    f"🧹 Vazifangiz: <b>{task}</b>\n"
                    f"Shu {CYCLE_DAYS} kun ichida tozalab, 📤 orqali video yuboring.",
                    parse_mode=ParseMode.HTML)
            except Exception as e:
                logger.warning("Sikl xabari yuborilmadi %s: %s", uid, e)
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
    """Kechqurun: bugungi eshik / sikl vazifasi bo'yicha eslatma."""
    today = today_local()
    cyc = rotation.cycle_start(today)
    last_day = today == rotation.cycle_end(today)
    for r in await db.get_available_residents(today):
        uid = r["telegram_id"]
        if is_admin(uid):
            continue
        cats = await db.get_extra_categories(uid, today)
        notes = []
        if not ("door_out" in cats and "door_in" in cats):
            notes.append("🚪 eshik (chiqish/kirish) videolari")
        if last_day:
            a = await db.get_assignment(uid, cyc)
            if a and a["status"] != "reported":
                notes.append(f"🧹 tozalik vazifasi ({a['areas']}) — bugun oxirgi kun!")
        if notes:
            try:
                await context.bot.send_message(
                    uid, "⏰ <b>Eslatma:</b> bajarilmagan:\n• " + "\n• ".join(notes),
                    parse_mode=ParseMode.HTML)
            except Exception:
                pass


async def job_deadline(context: ContextTypes.DEFAULT_TYPE) -> None:
    """05:00: kechagi eshik/ovqat + (sikl tugagan bo'lsa) tozalik jarimalari."""
    today = today_local()
    yesterday = today - dt.timedelta(days=1)

    # Eshik + ovqat (kecha)
    for r in await db.get_available_residents(yesterday):
        uid = r["telegram_id"]
        if is_admin(uid):
            continue
        items: list[tuple[str, int]] = []
        cats = await db.get_extra_categories(uid, yesterday)
        has_out, has_in = "door_out" in cats, "door_in" in cats
        if not has_out and not has_in:
            if not await db.has_fine(uid, yesterday, "door"):
                await db.add_fine(uid, None, DOOR_FINE_FULL,
                                  "Eshik: chiqish va kirish yo'q", yesterday, "door")
                items.append(("Eshik (chiqish + kirish) yo'q", DOOR_FINE_FULL))
        elif has_out != has_in:
            if not await db.has_fine(uid, yesterday, "door"):
                miss = "kirish" if has_out else "chiqish"
                await db.add_fine(uid, None, DOOR_FINE_PARTIAL,
                                  f"Eshik: {miss} yo'q", yesterday, "door")
                items.append((f"Eshik ({miss}) yo'q", DOOR_FINE_PARTIAL))
        if "cook_start" in cats and "cook_dishes" not in cats:
            if not await db.has_fine(uid, yesterday, "cooking"):
                await db.add_fine(uid, None, COOK_FINE_PARTIAL,
                                  "Ovqat: idish yuvilmadi", yesterday, "cooking")
                items.append(("Ovqat: idishlar yuvilmadi", COOK_FINE_PARTIAL))
        if items:
            total = sum(a for _, a in items)
            try:
                await context.bot.send_message(uid, texts.fine_summary_msg(items, total),
                                               parse_mode=ParseMode.HTML)
            except Exception:
                pass

    # Tozalik vazifasi — sikl tugaganda
    if rotation.is_cycle_start(today):
        prev = today - dt.timedelta(days=CYCLE_DAYS)
        for a in await db.get_cycle_assignments(prev):
            if a["status"] != "assigned":
                continue
            await db.set_assignment_status(a["id"], "missed")
            uid = a["telegram_id"]
            if await db.has_fine(uid, prev, "cleaning"):
                continue
            await db.add_fine(uid, a["id"], FINE_AMOUNT,
                              f"Tozalik vazifasi bajarilmadi ({a['areas']})", prev, "cleaning")
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
    app.add_handler(CallbackQueryHandler(on_report_button, pattern=r"^rep:"))
    app.add_handler(CallbackQueryHandler(on_return_buttons, pattern=r"^back:"))
    app.add_handler(CallbackQueryHandler(show_residents_week, pattern=r"^res7$"))

    app.add_handler(CommandHandler("id", cmd_id))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("bekor", cancel))
    app.add_handler(CommandHandler("azolar", cmd_azolar))
    app.add_handler(CommandHandler("arizalar", cmd_arizalar))
    app.add_handler(CommandHandler("jarimalar", cmd_jarimalar))
    app.add_handler(CommandHandler("jarima_ber", cmd_jarima_ber))
    app.add_handler(CommandHandler("jarima_ochir", cmd_jarima_ochir))
    app.add_handler(CommandHandler("guruh", cmd_guruh))
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
