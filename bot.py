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
    PRE_DEADLINE_HOUR,
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


async def tasks_paused() -> bool:
    return await db.get_setting("tasks_paused") is not None


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


def assign_with_forced(ids: list[int], cidx: int, forced: dict[int, str],
                       debt: dict[int, int] | None = None) -> dict[int, str | None]:
    """Navbat taqsimoti:
    - forced (rad etilgan) o'sha vazifani oladi;
    - navbatchilik qarzi (debt>0) bo'lganlar har siklda majburan navbatda;
    - qolganlar adolatli aylanadi (cidx bo'yicha siljiydi).
    """
    debt = debt or {}
    result: dict[int, str | None] = {tid: None for tid in ids}
    taken_people, taken_tasks = set(), set()
    for tid in ids:
        ft = forced.get(tid)
        if ft and ft in texts.TASKS:
            result[tid] = ft
            taken_people.add(tid)
            taken_tasks.add(ft)
    free_tasks = [t for t in texts.TASKS if t not in taken_tasks]
    debt_people = [tid for tid in ids if tid not in taken_people and debt.get(tid, 0) > 0]
    normal_people = [tid for tid in ids if tid not in taken_people and tid not in debt_people]
    if normal_people:
        shift = cidx % len(normal_people)
        normal_people = normal_people[shift:] + normal_people[:shift]
    free_people = debt_people + normal_people
    k = min(len(free_people), len(free_tasks))
    # Odamlar cidx bo'yicha siljigan, vazifalar tartibi sobit — shunda navbat aylanadi
    for j in range(k):
        result[free_people[j]] = free_tasks[j]
    return result


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
    residents_all = await db.get_active_residents()
    forced = {r["telegram_id"]: r["forced_task"] for r in residents_all
              if r["forced_task"] and r["duty_debt"] > 0}
    debt = {r["telegram_id"]: r["duty_debt"] for r in residents_all}
    mapping = assign_with_forced(ids, rotation.cycle_index(cyc), forced, debt)
    task = mapping.get(telegram_id)
    if task:
        await db.create_assignment(telegram_id, cyc, task)
    return task


# =================== Reply menyu dispatcher ===================
async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat.type != "private":
        return  # guruhdagi yozishmalarga bot aralashmaydi
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
    if awaiting == "proxy_name" and is_admin(user.id):
        context.user_data["proxy_name"] = text
        context.user_data.pop("awaiting", None)
        members = [r for r in await db.get_active_residents()
                   if not is_admin(r["telegram_id"]) and r["telegram_id"] > 0
                   and r["proxy_uid"] is None]
        rows = [[InlineKeyboardButton(r["name"], callback_data=f"mp:{r['telegram_id']}")]
                for r in members]
        await update.message.reply_text(texts.ADD_PROXY_PICK_MANAGER,
                                        reply_markup=InlineKeyboardMarkup(rows))
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
    if await tasks_paused():
        await update.message.reply_text(
            "⏸ Tozalik vazifa taqsimoti hozircha to'xtatilgan.", reply_markup=main_menu(resident))
        return
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
    msg = texts.my_task_msg(cyc_str, task, done, "door_out" in cats, "door_in" in cats)
    if task:
        msg += "\n\n" + texts.task_details(task)
    msg += texts.duty_note(resident["duty_debt"])
    await update.message.reply_text(
        msg, parse_mode=ParseMode.HTML, reply_markup=main_menu(resident),
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
    user = update.effective_user
    rows = [
        [InlineKeyboardButton(texts.RB_TASK, callback_data="rep:task")],
        [InlineKeyboardButton(texts.RB_KITCHEN, callback_data="rep:kitchen_used")],
        [InlineKeyboardButton(texts.RB_SHOWER, callback_data="rep:shower_after")],
        [InlineKeyboardButton(texts.RB_DOOR_OUT, callback_data="rep:door_out")],
        [InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")],
    ]
    # Boshqaradigan telefonsiz a'zo(lar) vazifasi uchun tugma
    if not rotation.before_start(today_local()):
        cyc = rotation.cycle_start(today_local())
        for b in await db.get_proxy_members_for(user.id):
            a = await db.get_assignment(b["telegram_id"], cyc)
            if a and a["status"] in ("assigned", "missed"):
                rows.append([InlineKeyboardButton(
                    f"🧹 {b['name']} vazifasini bajardi", callback_data=f"repx:{b['telegram_id']}")])
    await update.message.reply_text(texts.REPORT_MENU_TITLE,
                                    reply_markup=InlineKeyboardMarkup(rows))


def report_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(texts.RB_TASK, callback_data="rep:task")],
        [InlineKeyboardButton(texts.RB_KITCHEN, callback_data="rep:kitchen_used")],
        [InlineKeyboardButton(texts.RB_SHOWER, callback_data="rep:shower_after")],
        [InlineKeyboardButton(texts.RB_DOOR_OUT, callback_data="rep:door_out")],
        [InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")],
    ])


async def on_report_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    parts = query.data.split(":")
    proxy = None
    if parts[0] == "repx":
        cat = "task"
        proxy = int(parts[1])
    else:
        cat = parts[1]
    context.user_data["pending_category"] = cat
    if proxy:
        context.user_data["pending_proxy"] = proxy
    else:
        context.user_data.pop("pending_proxy", None)

    if cat == "task":
        # Berilgan joy bo'yicha checklist ko'rsatamiz
        subject_uid = proxy or query.from_user.id
        cyc = rotation.cycle_start(today_local())
        a = await db.get_assignment(subject_uid, cyc)
        if a:
            items = task_items(a["areas"])
            head = texts.task_checklist_prompt(a["areas"], items)
            suffix = " (uka uchun)" if proxy else ""
            await query.edit_message_text(
                head + suffix + f"\n\n{texts.SEND_VIDEO_NOW}", parse_mode=ParseMode.HTML)
        else:
            await query.edit_message_text(texts.NO_TASK_TO_REPORT)
        return

    label = texts.RB_LABELS[cat]
    extra = texts.SEND_VIDEO_EXTRA.get(cat)
    text = f"{label}\n\n{texts.SEND_VIDEO_NOW}"
    if extra:
        text += f"\n\n<i>{extra}</i>"
    await query.edit_message_text(text, parse_mode=ParseMode.HTML)


# =================== Video hisobot ===================
async def on_video(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if update.effective_chat.type != "private":
        return  # guruhdagi videolarga bot javob bermaydi
    if context.user_data.get("awaiting") == "payment":
        await on_payment_media(update, context)
        return
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
    proxy_uid = context.user_data.pop("pending_proxy", None)
    if not cat:
        await update.message.reply_text(
            "Avval qaysi hisobot ekanini tanlang 👇", reply_markup=report_menu_kb()
        )
        return

    today = today_local()
    label = texts.RB_LABELS[cat]
    subject_uid = proxy_uid if proxy_uid else user.id
    subject = await db.get_resident(subject_uid) if proxy_uid else resident

    # Tozalik vazifasi: avval o'ziga "to'liq bajardingmi?" deb tasdiq so'raymiz
    if cat == "task":
        cyc = rotation.cycle_start(today)
        a = await db.get_assignment(subject_uid, cyc)
        if not a:
            await update.message.reply_text(texts.NO_TASK_TO_REPORT)
            return
        context.user_data["self_video"] = (file_id, file_type, proxy_uid)
        items = task_items(a["areas"])
        await update.message.reply_text(
            texts.self_confirm_ask(a["areas"], items), parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(texts.SELF_OK, callback_data="selfok"),
                InlineKeyboardButton(texts.SELF_NO, callback_data="selfno"),
            ]]))
        return

    rid = await db.add_extra_report(subject_uid, today, cat, file_id, file_type)
    await update.message.reply_text(texts.report_saved(label), parse_mode=ParseMode.HTML)

    who = f"{subject['name'] if subject else subject_uid}"
    if proxy_uid:
        who += f" (uka — {resident['name']} yubordi)"
    caption = f"📹 <b>{who}</b>\n{label}\n🗓 {fmt_date(today)}\n\nTasdiqlaysizmi?"
    await broadcast_report(context, file_id, file_type, caption, rid)

    # Eshik: chiqishdan keyin kirish tugmasi
    if cat == "door_out":
        await update.message.reply_text(
            texts.DOOR_NEXT_HINT,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(texts.RB_DOOR_IN, callback_data="rep:door_in")]]),
        )


async def on_self_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Foydalanuvchi o'zi 'to'liq bajardim/yo'q' deb tasdiqlaydi."""
    query = update.callback_query
    sv = context.user_data.pop("self_video", None)
    await query.answer()
    if not sv:
        await query.edit_message_text("⏳ Bu so'rov eskirgan. Qaytadan video yuboring.")
        return
    file_id, file_type, proxy_uid = sv
    if query.data == "selfno":
        # Adminga bormaydi, vazifa ochiq qoladi
        await query.edit_message_text(texts.SELF_REDO, parse_mode=ParseMode.HTML)
        return
    # selfok — adminga checklist bilan yuboriladi
    user = query.from_user
    today = today_local()
    subject_uid = proxy_uid if proxy_uid else user.id
    subject = await db.get_resident(subject_uid)
    sender = await db.get_resident(user.id)
    cyc = rotation.cycle_start(today)
    a = await db.get_assignment(subject_uid, cyc)
    if not a:
        await query.edit_message_text(texts.NO_TASK_TO_REPORT)
        return
    await db.set_assignment_status(a["id"], "reported")
    rid = await db.add_extra_report(subject_uid, today, "task", file_id, file_type)
    who = subject["name"] if subject else str(subject_uid)
    if proxy_uid:
        who += f" (uka — {sender['name'] if sender else ''} yubordi)"
    cap = f"📹 <b>{who}</b>\n🧹 {a['areas']}\n🗓 {fmt_date(today)}"
    await send_task_to_admins(context, file_id, file_type, cap, rid, a["areas"])
    await query.edit_message_text(texts.SELF_SENT, parse_mode=ParseMode.HTML)


def html_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def mention(uid: int, name: str) -> str:
    return f'<a href="tg://user?id={uid}">{html_escape(name)}</a>'


async def announce_to_group(context, cycle_start, deadline, task_to_uid, name_by, rec_by=None) -> None:
    """Guruhga yangi taqsimotni har bir kishini belgilab e'lon qiladi."""
    rec_by = rec_by or {}
    gid = await db.get_setting("group_chat_id")
    if not gid:
        return
    lines = [
        f"📋 <b>Yangi tozalik navbati</b> ({fmt_short(cycle_start)})\n",
    ]
    for task in texts.TASKS:
        uid = task_to_uid.get(task)
        if not uid:
            who = "—"
        else:
            rec = rec_by.get(uid)
            if rec and rec["proxy_uid"]:
                # Telefonsiz a'zo — boshqaruvchini belgilaymiz
                who = (mention(rec["proxy_uid"], name_by.get(rec["proxy_uid"], "")) +
                       f" (ukasi {html_escape(rec['name'])} qilishi kerak)")
            else:
                who = mention(uid, name_by.get(uid, "—"))
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
    # Videolar faqat adminga boradi (guruhga emas)
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


def task_items(task: str) -> list[str]:
    out = []
    for line in texts.TASK_DETAILS.get(task, "").split("\n"):
        line = line.strip()
        if line and line[0].isdigit():
            out.append(line.split(".", 1)[1].strip() if "." in line else line)
    return out


def checklist_kb(rid: int, task: str, checked: set) -> InlineKeyboardMarkup:
    rows = []
    for i, it in enumerate(task_items(task)):
        mark = "✅" if i in checked else "⬜️"
        rows.append([InlineKeyboardButton(f"{mark} {it[:45]}", callback_data=f"ck:{rid}:{i}")])
    rows.append([
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"rok:{rid}"),
        InlineKeyboardButton("❌ Rad etish", callback_data=f"rno:{rid}"),
    ])
    return InlineKeyboardMarkup(rows)


async def send_task_to_admins(context, file_id, file_type, caption, rid, task) -> None:
    """Tozalik vazifasi videosini adminlarga checklist bilan yuboradi."""
    context.bot_data[f"task:{rid}"] = task
    context.bot_data[f"ck:{rid}"] = set()
    kb = checklist_kb(rid, task, set())
    full = caption + "\n\n📋 <b>Tekshiring (belgilang):</b>"
    for admin_id in ADMIN_IDS:
        try:
            if file_type == "video_note":
                await context.bot.send_video_note(admin_id, file_id)
                await context.bot.send_message(admin_id, full, parse_mode=ParseMode.HTML,
                                               reply_markup=kb)
            else:
                await context.bot.send_video(admin_id, file_id, caption=full,
                                             parse_mode=ParseMode.HTML, reply_markup=kb)
        except Exception as e:
            logger.warning("Adminga vazifa yuborilmadi %s: %s", admin_id, e)


async def on_checklist_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    _, rid_str, idx_str = query.data.split(":")
    rid, idx = int(rid_str), int(idx_str)
    checked = context.bot_data.setdefault(f"ck:{rid}", set())
    if idx in checked:
        checked.discard(idx)
    else:
        checked.add(idx)
    task = context.bot_data.get(f"task:{rid}", "")
    await query.answer()
    try:
        await query.edit_message_reply_markup(reply_markup=checklist_kb(rid, task, checked))
    except Exception:
        pass


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
    subject = await db.get_resident(uid)

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
        await notify_subject(context, subject, texts.REPORT_APPROVED)
    else:  # rno
        await db.set_extra_report_status(report["id"], "rejected")
        if cat == "task":
            cyc = rotation.cycle_start(rdate)
            a = await db.get_assignment(uid, cyc)
            if a:
                await db.set_assignment_status(a["id"], "assigned")
                # Chala bajargani uchun: +1 navbatchilik + keyingi safar ham o'sha joy
                await db.incr_duty_debt(uid, 1)
                await db.set_forced_task(uid, a["areas"])
                # Admin checklisti bo'yicha bajarilgan/bajarilmagan bandlar
                checked = context.bot_data.get(f"ck:{report['id']}", set())
                items = task_items(a["areas"])
                done = [items[i] for i in sorted(checked) if i < len(items)]
                notdone = [items[i] for i in range(len(items)) if i not in checked]
                deadline = today_local() + dt.timedelta(days=1)
                await query.answer("Rad etildi")
                await _mark(query, "❌ <b>Rad etildi (+1 navbatchilik)</b>")
                await notify_subject(
                    context, subject,
                    texts.reject_checklist_msg(a["areas"], done, notdone, fmt_short(deadline)))
                return
        await query.answer("Rad etildi")
        await _mark(query, "❌ <b>Rad etildi</b>")
        await notify_subject(context, subject, texts.report_rejected(label))


async def notify_subject(context, resident_rec, text: str) -> None:
    """A'zoga xabar yuboradi; telefonsiz (proxy) bo'lsa — boshqaruvchisiga."""
    if not resident_rec:
        return
    target = resident_rec["proxy_uid"] or resident_rec["telegram_id"]
    if target <= 0:
        return
    prefix = ""
    if resident_rec["proxy_uid"]:
        prefix = f"(Ukangiz {resident_rec['name']} bo'yicha)\n"
    try:
        await context.bot.send_message(target, prefix + text, parse_mode=ParseMode.HTML)
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
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("💸 Jarima yozish", callback_data=f"af:{uid}"),
             InlineKeyboardButton("🔄 Vazifani qayta ochish", callback_data=f"reopen:{uid}")],
            [InlineKeyboardButton("🗑 Chiqarib tashlash", callback_data=f"rem:{uid}")],
        ])
    await query.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=kb)


async def on_reopen_task(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin a'zoning joriy sikl tozalik vazifasini qayta 'bajarilmagan' qiladi."""
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    uid = int(query.data.split(":")[1])
    today = today_local()
    cyc = rotation.cycle_start(today)
    a = await db.get_assignment(uid, cyc)
    if not a:
        await query.answer("Bu siklda vazifa yo'q.", show_alert=True)
        return
    await db.set_assignment_status(a["id"], "assigned")
    await db.clear_fine_by(uid, cyc, "cleaning")
    await query.answer("Qayta ochildi ✅")
    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text(
        f"🔄 Vazifa qayta ochildi: <b>{a['areas']}</b>. Endi qayta bajarilishi kerak.",
        parse_mode=ParseMode.HTML)
    try:
        await context.bot.send_message(
            uid,
            f"🔄 Tozalik vazifangiz qayta ochildi: <b>{a['areas']}</b>.\n"
            "Iltimos, bajarib, 📤 orqali to'g'ri video yuboring.",
            parse_mode=ParseMode.HTML)
    except Exception:
        pass


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
    kb = None
    if rows:
        kb = InlineKeyboardMarkup([[InlineKeyboardButton(texts.BTN_PAY, callback_data="pay")]])
    await update.message.reply_text(
        texts.rules_and_fines(texts.rules_text(), details, total),
        parse_mode=ParseMode.HTML, reply_markup=kb,
    )


async def on_pay_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    cnt, total = await db.get_user_fines(query.from_user.id)
    if cnt == 0:
        await query.edit_message_text(texts.PAY_NO_FINE)
        return
    context.user_data["awaiting"] = "payment"
    context.user_data["pay_amount"] = total
    await query.message.reply_text(texts.PAY_ASK, parse_mode=ParseMode.HTML)


async def on_payment_media(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """awaiting=='payment' bo'lsa chek (rasm/fayl/video) qabul qilinadi."""
    if update.effective_chat.type != "private":
        return
    if context.user_data.get("awaiting") != "payment":
        return
    msg = update.message
    if msg.photo:
        file_id, file_type = msg.photo[-1].file_id, "photo"
    elif msg.document:
        file_id, file_type = msg.document.file_id, "document"
    elif msg.video:
        file_id, file_type = msg.video.file_id, "video"
    else:
        return
    context.user_data.pop("awaiting", None)
    amount = context.user_data.pop("pay_amount", 0)
    uid = update.effective_user.id
    resident = await db.get_resident(uid)
    pid = await db.add_payment(uid, file_id, file_type, amount)
    await msg.reply_text(texts.PAY_RECEIVED, parse_mode=ParseMode.HTML)
    cap = (f"💳 <b>To'lov cheki</b>\n👤 {resident['name'] if resident else uid}\n"
           f"Jarima: {fmt_sum(amount)} so'm\n\nTasdiqlaysizmi?")
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"pok:{pid}"),
        InlineKeyboardButton("❌ Rad etish", callback_data=f"pno:{pid}"),
    ]])
    for admin_id in ADMIN_IDS:
        try:
            if file_type == "photo":
                await context.bot.send_photo(admin_id, file_id, caption=cap,
                                             parse_mode=ParseMode.HTML, reply_markup=kb)
            elif file_type == "document":
                await context.bot.send_document(admin_id, file_id, caption=cap,
                                                parse_mode=ParseMode.HTML, reply_markup=kb)
            else:
                await context.bot.send_video(admin_id, file_id, caption=cap,
                                             parse_mode=ParseMode.HTML, reply_markup=kb)
        except Exception as e:
            logger.warning("Adminga chek yuborilmadi %s: %s", admin_id, e)


async def on_payment_review(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    action, pid_str = query.data.split(":")
    payment = await db.get_payment(int(pid_str))
    if not payment:
        await query.answer("To'lov topilmadi.", show_alert=True)
        return
    uid = payment["telegram_id"]
    resident = await db.get_resident(uid)
    if action == "pok":
        await db.set_payment_status(payment["id"], "approved")
        await db.clear_user_active_fines(uid)
        await query.answer("Tasdiqlandi ✅")
        await _mark(query, "✅ <b>To'lov tasdiqlandi</b>")
        try:
            await context.bot.send_message(uid, texts.PAY_APPROVED, parse_mode=ParseMode.HTML)
        except Exception:
            pass
        # Guruhga e'lon
        gid = await db.get_setting("group_chat_id")
        if gid and resident:
            try:
                await context.bot.send_message(
                    int(gid), texts.group_paid_announce(mention(uid, resident["name"])),
                    parse_mode=ParseMode.HTML)
            except Exception:
                pass
    else:
        await db.set_payment_status(payment["id"], "rejected")
        await query.answer("Rad etildi")
        await _mark(query, "❌ <b>To'lov rad etildi</b>")
        try:
            await context.bot.send_message(uid, texts.PAY_REJECTED, parse_mode=ParseMode.HTML)
        except Exception:
            pass


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
        [InlineKeyboardButton(texts.AP_ADD_PROXY, callback_data="ap:addproxy")],
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
    elif what == "addproxy":
        context.user_data["awaiting"] = "proxy_name"
        await query.message.reply_text(texts.ADD_PROXY_ASK_NAME)


async def on_pick_manager(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    await query.answer()
    manager_uid = int(query.data.split(":")[1])
    name = context.user_data.pop("proxy_name", None)
    if not name:
        await query.edit_message_text("Ism topilmadi, qaytadan urinib ko'ring.")
        return
    manager = await db.get_resident(manager_uid)
    await db.create_proxy_member(name, manager_uid)
    await query.edit_message_text(
        texts.proxy_added(name, manager["name"] if manager else str(manager_uid)),
        parse_mode=ParseMode.HTML)


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


async def cmd_vazifa_toxtat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    await db.set_setting("tasks_paused", "1")
    await update.message.reply_text(
        "⏸ <b>Vazifa taqsimoti to'xtatildi.</b>\n"
        "Yangi vazifa berilmaydi, eslatma va jarima ishlamaydi.\n"
        "Qayta yoqish: /vazifa_yoq", parse_mode=ParseMode.HTML)


async def cmd_vazifa_yoq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_admin(update.effective_user.id):
        return
    await db.set_setting("tasks_paused", None)
    await update.message.reply_text(
        "▶️ <b>Vazifa taqsimoti yoqildi.</b>\n"
        "Keyingi navbat kuni (05:00) vazifalar avtomatik beriladi.", parse_mode=ParseMode.HTML)


async def cmd_sinov(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin uchun sinov: 4 ta vazifani 'bajarildi' ko'rinishida checklist bilan yuboradi."""
    if not is_admin(update.effective_user.id):
        return
    await update.message.reply_text(
        "🧪 <b>Sinov rejimi.</b> Quyida 4 ta vazifa 'bajarildi' deb keldi. "
        "Bandlarni belgilab, Tasdiqlash/Rad etishni sinab ko'ring (haqiqiy jarima yozilmaydi).",
        parse_mode=ParseMode.HTML)
    for i, task in enumerate(texts.TASKS):
        rid = 900000 + i
        context.bot_data[f"task:{rid}"] = task
        context.bot_data[f"ck:{rid}"] = set()
        rows = [[InlineKeyboardButton(f"⬜️ {it[:45]}", callback_data=f"ck:{rid}:{j}")]
                for j, it in enumerate(task_items(task))]
        rows.append([
            InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"tok:{rid}"),
            InlineKeyboardButton("❌ Rad etish", callback_data=f"tno:{rid}"),
        ])
        cap = (f"📹 <b>SINOV — Falonchi</b>\n🧹 {task}\n🗓 (sinov)\n\n"
               "📋 <b>Tekshiring (belgilang):</b>")
        await update.message.reply_text(cap, parse_mode=ParseMode.HTML,
                                        reply_markup=InlineKeyboardMarkup(rows))


async def on_test_review(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not is_admin(query.from_user.id):
        await query.answer("Faqat admin uchun.", show_alert=True)
        return
    res = "✅ <b>Tasdiqlandi</b>" if query.data.startswith("tok") else "❌ <b>Rad etildi</b>"
    await query.answer("Sinov")
    try:
        await query.edit_message_text(
            query.message.text_html + f"\n\n{res} (sinov — haqiqiy jarima yo'q)",
            parse_mode=ParseMode.HTML)
    except Exception:
        await query.edit_message_reply_markup(reply_markup=None)


# =================== Jadval (JobQueue) ===================
async def job_morning(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ertalab: yangi sikl boshlansa vazifa tarqatish + qaytish so'rovlari."""
    today = today_local()
    if (not await tasks_paused() and not rotation.before_start(today)
            and rotation.is_cycle_start(today)):
        ids = await available_ids(today)
        residents_all = await db.get_active_residents()
        rec_by = {r["telegram_id"]: r for r in residents_all}
        # "O'sha joy" faqat navbatchilik qarzi bor (jazolangan) odamlarga
        forced = {r["telegram_id"]: r["forced_task"] for r in residents_all
                  if r["forced_task"] and r["duty_debt"] > 0}
        debt = {r["telegram_id"]: r["duty_debt"] for r in residents_all}
        mapping = assign_with_forced(ids, rotation.cycle_index(today), forced, debt)
        deadline = today + dt.timedelta(days=1)
        name_by = {r["telegram_id"]: r["name"] for r in residents_all}
        task_to_uid: dict[str, int] = {}
        for uid, task in mapping.items():
            if not task:
                continue
            task_to_uid[task] = uid
            await db.create_assignment(uid, today, task)
            rec = rec_by.get(uid)
            # Navbatchilik qarzi bo'lsa — kamaytirib, izoh qo'shamiz
            note = texts.TASK_NOTE
            if rec and rec["duty_debt"] > 0:
                await db.incr_duty_debt(uid, -1)
                remaining = rec["duty_debt"] - 1
                note += texts.penalty_note(remaining)
                if remaining <= 0:
                    await db.set_forced_task(uid, None)
            details = texts.task_details(task)
            if rec and rec["proxy_uid"]:
                # Telefonsiz a'zo — boshqaruvchisiga yuboramiz
                try:
                    await context.bot.send_message(
                        rec["proxy_uid"],
                        texts.proxy_assign_msg(name_by.get(rec["proxy_uid"], ""), rec["name"],
                                               task, fmt_short(deadline), details, note),
                        parse_mode=ParseMode.HTML)
                except Exception as e:
                    logger.warning("Proxy xabari yuborilmadi: %s", e)
            else:
                try:
                    await context.bot.send_message(
                        uid,
                        f"🆕 <b>Yangi tozalik vazifasi</b>\n\n"
                        f"🧹 Vazifangiz: <b>{task}</b>\n"
                        f"⏰ Hisobot muddati: <b>{fmt_short(deadline)} 05:00</b> gacha.\n\n"
                        + details + note,
                        parse_mode=ParseMode.HTML)
                except Exception as e:
                    logger.warning("Sikl xabari yuborilmadi %s: %s", uid, e)
        # Guruhga e'lon (proxy bo'lsa boshqaruvchisini belgilaymiz)
        await announce_to_group(context, today, deadline, task_to_uid, name_by, rec_by)
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


async def job_predeadline(context: ContextTypes.DEFAULT_TYPE) -> None:
    """04:00: muddatdan 1 soat oldin 'hisobot yuboringlar' eslatmasi."""
    if await tasks_paused():
        return
    today = today_local()
    yesterday = today - dt.timedelta(days=1)
    if rotation.before_start(yesterday) or not rotation.is_cycle_start(yesterday):
        return
    for a in await db.get_cycle_assignments(yesterday):
        if a["status"] not in ("assigned",):
            continue
        rec = await db.get_resident(a["telegram_id"])
        msg = texts.predeadline_msg(a["areas"], texts.task_details(a["areas"]))
        if rec:
            msg += texts.duty_note(rec["duty_debt"])
        await notify_subject(context, rec, msg)


async def job_deadline(context: ContextTypes.DEFAULT_TYPE) -> None:
    """05:00: tozalik jarimalari.

    - Vazifa sikl boshida (kun S) beriladi, hisobot S+1 05:00 gacha.
    - S+1 da bajarmasa: jarima + navbatchilik qarzi (+2) + yana 24 soat muhlat.
    - S+2 da yana bajarmasa: yana jarima.
    Eshik/oshxona/dush uchun avtomatik jarima yo'q — admin qo'lda yozadi.
    """
    if await tasks_paused():
        return
    today = today_local()
    gid = await db.get_setting("group_chat_id")

    # base = vazifa berilgan kun (sikl boshi). today = base+1 (1-muddat) yoki base+2 (qo'shimcha 24h)
    for delta, first in ((1, True), (2, False)):
        base = today - dt.timedelta(days=delta)
        if rotation.before_start(base) or not rotation.is_cycle_start(base):
            continue
        for a in await db.get_cycle_assignments(base):
            if a["status"] not in ("assigned", "missed"):
                continue  # reported/approved — jarima yo'q
            uid = a["telegram_id"]
            await db.set_assignment_status(a["id"], "missed")
            if await db.has_fine(uid, today, "cleaning"):
                continue
            await db.add_fine(uid, a["id"], FINE_AMOUNT,
                              f"Tozalik vazifasi bajarilmadi ({a['areas']})", today, "cleaning")
            note = ""
            if first:
                await db.incr_duty_debt(uid, 2)
                await db.set_forced_task(uid, a["areas"])
                note = texts.penalty_note(2) + "\n⏳ Yana 24 soat muhlat berildi."
            rec = await db.get_resident(uid)
            await notify_subject(
                context, rec,
                texts.fine_summary_msg([(f"Tozalik: {a['areas']}", FINE_AMOUNT)], FINE_AMOUNT) + note)

    # 05:00 da guruhga umumiy natija (kim bajardi / kim bajarmadi + jarima)
    base1 = today - dt.timedelta(days=1)
    if gid and not rotation.before_start(base1) and rotation.is_cycle_start(base1):
        asgs = await db.get_cycle_assignments(base1)
        if asgs:
            done, notdone = [], []
            for a in asgs:
                tag = await tag_for(a["telegram_id"])
                if a["status"] in ("reported", "approved"):
                    done.append((tag, a["areas"]))
                else:
                    notdone.append((tag, a["areas"], FINE_AMOUNT))
            try:
                await context.bot.send_message(
                    int(gid), texts.group_summary(fmt_short(base1), done, notdone),
                    parse_mode=ParseMode.HTML)
            except Exception as e:
                logger.warning("Guruh natijasi yuborilmadi: %s", e)


async def tag_for(uid: int) -> str:
    """Guruhda belgilash uchun mention; telefonsiz a'zo bo'lsa boshqaruvchisini belgilaydi."""
    rec = await db.get_resident(uid)
    if not rec:
        return str(uid)
    if rec["proxy_uid"]:
        mgr = await db.get_resident(rec["proxy_uid"])
        return mention(rec["proxy_uid"], mgr["name"] if mgr else "") + f" (ukasi {html_escape(rec['name'])})"
    return mention(uid, rec["name"])


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
    # Bir martalik: 6 kunlik tartibga o'tish — barcha jarima + navbatchilik 0 ga tushadi
    if await db.get_setting("reset_6day_cycle") is None:
        n = await db.clear_all_fines()
        await db.reset_all_penalties()
        await db.set_setting("reset_6day_cycle", "done")
        logger.info("6-kunlik reset: %d jarima o'chirildi, navbatchilik nollandi", n)
    # Bir martalik: vazifa taqsimotini to'xtatib qo'yish (admin /vazifa_yoq bilan yoqadi)
    if await db.get_setting("pause_init_done") is None:
        await db.set_setting("tasks_paused", "1")
        await db.set_setting("pause_init_done", "done")
        logger.info("Vazifa taqsimoti to'xtatildi (boshlang'ich).")
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
    app.add_handler(CallbackQueryHandler(on_checklist_toggle, pattern=r"^ck:"))
    app.add_handler(CallbackQueryHandler(on_report_button, pattern=r"^repx?:"))
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
    app.add_handler(CallbackQueryHandler(on_reopen_task, pattern=r"^reopen:"))
    app.add_handler(CallbackQueryHandler(on_pick_manager, pattern=r"^mp:"))
    app.add_handler(CallbackQueryHandler(on_pay_start, pattern=r"^pay$"))
    app.add_handler(CallbackQueryHandler(on_payment_review, pattern=r"^p(ok|no):"))
    app.add_handler(CallbackQueryHandler(on_test_review, pattern=r"^t(ok|no):"))
    app.add_handler(CallbackQueryHandler(on_self_confirm, pattern=r"^self(ok|no)$"))

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
    app.add_handler(CommandHandler("sinov", cmd_sinov))
    app.add_handler(CommandHandler("vazifa_toxtat", cmd_vazifa_toxtat))
    app.add_handler(CommandHandler("vazifa_yoq", cmd_vazifa_yoq))

    app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL, on_payment_media))
    app.add_handler(MessageHandler(filters.VIDEO | filters.VIDEO_NOTE, on_video))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    jq = app.job_queue
    jq.run_daily(job_morning, time=dt.time(hour=ANNOUNCE_HOUR, minute=0, tzinfo=TZ))
    jq.run_daily(job_remind, time=dt.time(hour=REMIND_HOUR, minute=0, tzinfo=TZ))
    jq.run_daily(job_predeadline, time=dt.time(hour=PRE_DEADLINE_HOUR, minute=0, tzinfo=TZ))
    jq.run_daily(job_deadline, time=dt.time(hour=DEADLINE_HOUR, minute=0, tzinfo=TZ))

    logger.info("Polling boshlandi...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
