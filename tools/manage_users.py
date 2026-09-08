"""
================================================================================
 manage_users.py — QUẢN LÝ NGƯỜI HỌC (TJ WordLoop Hub, chế độ Cloud)
================================================================================
 BẢN 2026-09-07 (v1) — Thao tự quản lý người học KHÔNG cần Supabase Dashboard
 và KHÔNG cần gửi email (Supabase free chỉ cho 2 email/giờ, không đủ dùng
 hàng ngày). Cách hoạt động:

   1. Điền tên người học MỚI vào NEW_USERS bên dưới (để trống = không tạo
      ai mới, chỉ xuất báo cáo người đã có).
   2. Chạy: python tools/manage_users.py
   3. Script tự tạo user mới trong bảng "profiles" trên Supabase (qua REST
      API, dùng anon key public trong js/config.js — KHÔNG cần secret key,
      vì RLS bảng profiles đã mở cho anon, xem CLAUDE.md/HANDOFF.md mục
      "đăng nhập qua link"), rồi xuất 1 file Excel gồm 3 sheet:
        - "Người học": tên (bấm vào mở thẳng link học), link đầy đủ, số từ
          đã thuộc, số Block đã đạt bài thi, đang ở giai đoạn nào trong 4
          giai đoạn ôn Tony Buzan, số Block TRỄ HẠN ôn, và ĐIỂM tổng.
        - "Chi tiết Từ": 1 dòng/1 user x 1 từ đã từng làm bài - đúng từ
          nào, đúng mấy lần, mức thuộc, kèm Điểm của riêng từ đó.
        - "Chi tiết Block": 1 dòng/1 user x 1 Block đã học - điểm bài thi,
          chu kỳ ôn hiện tại, có trễ hạn không, kèm Điểm của riêng Block đó.
      Công thức tính Điểm đặt ở CONFIG bên dưới (SCORE_*) - tự chỉnh trọng
      số tuỳ ý, không cần hiểu code.

 ⚠️ QUAN TRỌNG — FILE EXCEL XUẤT RA CÓ CHỨA LINK ĐĂNG NHẬP THẬT (mỗi link
 tự mở thẳng vào đúng tiến trình của 1 người, KHÔNG cần mật khẩu/email) -
 TUYỆT ĐỐI KHÔNG đẩy file Excel này lên repo GitHub (đang PUBLIC) hay chia
 sẻ ra ngoài. File này CHỈ lưu tại chỗ (OUTPUT_XLSX bên dưới, đã có sẵn
 trong .gitignore của repo) - chỉ file .py này (không chứa thông tin cá
 nhân, chỉ chứa logic + anon key vốn đã public sẵn trong js/config.js) là
 an toàn để đẩy lên GitHub.

 CÁCH DÙNG:
   1. pip install requests openpyxl   (thường đã có sẵn)
   2. Sửa NEW_USERS bên dưới nếu muốn thêm người học mới.
   3. Chạy: python tools/manage_users.py
   4. Mở file Excel vừa xuất (đường dẫn in ra cuối cùng) để lấy link gửi
      cho từng người.
================================================================================
"""

import datetime
import re
import sys
import time
import uuid
import webbrowser
from pathlib import Path

# Console Windows mặc định dùng cp1252 - không encode được emoji (📡✅⚠️...)
# in ra ở dưới, khiến script CRASH ngay dòng print đầu tiên khi chạy trực
# tiếp bằng "python tools/manage_users.py" (không qua PYTHONIOENCODING).
# Ép lại stdout/stderr sang UTF-8 ngay từ đầu để chạy được trên mọi máy.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import requests
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

# ==============================================================================
# CONFIG — SỬA CHỖ NÀY
# ==============================================================================

# Người học MUỐN TẠO MỚI trong lần chạy này - mỗi dòng (Tên hiển thị, Emoji).
# Để {} (rỗng) nếu KHÔNG tạo ai mới, chỉ xuất báo cáo người đã có.
# Tên TRÙNG với người đã có sẵn (so không phân biệt hoa/thường) sẽ được BỎ
# QUA (không tạo trùng), báo rõ trong log - muốn tạo THÊM 1 người CÙNG TÊN
# (hiếm khi cần) thì phải sửa tay database, tool này không hỗ trợ.
NEW_USERS = [
    # ("Tên hiển thị", "Emoji"),
    # ("TJ", "🦊"),
    # ("Thiên Bảo", "🐼"),
]

# URL app đã deploy - dùng để ghép thành link "?u=<id>" cho từng người học.
# Đổi sang URL Netlify (r"https://tj-wordloop-hub.netlify.app/") nếu đó mới
# là bản đang dùng chính - xem HANDOFF.md mục "Đường dẫn" để biết bản nào
# đang chạy đúng commit mới nhất.
APP_BASE_URL = "https://teoteo1081.github.io/tj-wordloop-hub/"

# File Excel xuất ra - LƯU CỤC BỘ, KHÔNG đẩy lên GitHub (xem cảnh báo ở đầu
# file). Tự thêm ngày giờ vào tên file để không ghi đè báo cáo cũ.
OUTPUT_DIR = Path(__file__).resolve().parent / "reports"
OUTPUT_XLSX = OUTPUT_DIR / f"nguoi_hoc_{datetime.datetime.now():%Y%m%d_%H%M%S}.xlsx"

# Tự mở file Excel lên sau khi xuất xong (Windows).
AUTO_OPEN_EXCEL = True

# ==============================================================================
# CÔNG THỨC TÍNH ĐIỂM — SỬA TRỌNG SỐ THOẢI MÁI, KHÔNG CẦN HIỂU CODE BÊN DƯỚI
# ==============================================================================
# Điểm 1 TỪ:
#   - Đã "Đã thuộc" (mastered)        -> SCORE_WORD_MASTERED điểm.
#   - Chưa thuộc nhưng đã thử qua     -> tối đa SCORE_WORD_PARTIAL_MAX điểm,
#     nhân theo TỈ LỆ ĐÚNG (đúng/tổng số lần thử) - thử nhiều mà đúng ít thì
#     điểm thấp, gần đúng hết thì gần full điểm dù chưa chính thức "thuộc".
#   - Chưa từng thử                   -> 0 điểm.
SCORE_WORD_MASTERED = 10
SCORE_WORD_PARTIAL_MAX = 5

# Điểm 1 BLOCK (chỉ tính khi ĐÃ ĐẠT bài kiểm tra - "passed"):
#   - Điểm nền khi vừa đạt            -> SCORE_BLOCK_PASSED_BASE.
#   - Mỗi lần đã ôn ĐÚNG HẠN xong (cycle) cộng thêm SCORE_BLOCK_PER_CYCLE -
#     Block càng ôn bền theo Tony Buzan càng nhiều điểm (tối đa 6 lần, xem
#     MAX_CYCLE/js/srs.js).
#   - Đang TRỄ HẠN ôn (quá ngày hẹn mà chưa ôn) -> bị trừ SCORE_BLOCK_OVERDUE_PENALTY
#     (số âm) - nhắc khéo là đang nợ bài, trễ thì mất điểm.
SCORE_BLOCK_PASSED_BASE = 20
SCORE_BLOCK_PER_CYCLE = 5
SCORE_BLOCK_OVERDUE_PENALTY = -5

# ==============================================================================
# LẤY URL + ANON KEY TỪ js/config.js — KHÔNG hardcode lặp lại ở đây, để
# đổi project Supabase chỉ cần sửa đúng 1 chỗ (config.js), script tự đọc
# theo. anon key là key PUBLIC (an toàn lộ ra, bị chặn bởi RLS) - không
# phải secret/service_role.
# ==============================================================================

CONFIG_JS_PATH = Path(__file__).resolve().parent.parent / "js" / "config.js"


def _read_config_js():
    text = CONFIG_JS_PATH.read_text(encoding="utf-8")
    url_m = re.search(r'SUPABASE_URL:\s*"([^"]+)"', text)
    key_m = re.search(r'SUPABASE_ANON_KEY:\s*"([^"]+)"', text)
    if not url_m or not key_m:
        sys.exit(f"❌ Không đọc được SUPABASE_URL/SUPABASE_ANON_KEY từ {CONFIG_JS_PATH}")
    return url_m.group(1).rstrip("/"), key_m.group(1)


SUPABASE_URL, SUPABASE_ANON_KEY = _read_config_js()
REST_URL = SUPABASE_URL + "/rest/v1"
HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}

# 4 giai đoạn Tony Buzan - PHẢI khớp đúng js/srs.js (STEPS[].group) để đếm
# đúng, xem ghi chú trong srs.js. cycle 0-1 -> group 1, cycle 2 -> group 2,
# cycle 3 -> group 3, cycle 4-5 -> group 4. cycle >= 6 (MAX_CYCLE) = đã
# xong hết vòng ôn, coi như "đã vào trí nhớ dài hạn".
MAX_CYCLE = 6


def _group_of(cycle):
    if cycle <= 1:
        return 1
    if cycle == 2:
        return 2
    if cycle == 3:
        return 3
    return 4  # cycle 4 hoặc 5


# ==============================================================================
# GỌI SUPABASE (REST API / PostgREST) - CHỈ dùng anon key, không cần secret
# ==============================================================================

def sb_get(table, params, exact_count=False):
    """GET .../rest/v1/<table>?... - trả về (list_rows, total_count_hoac_None).
    total_count CHỈ có khi exact_count=True (dùng header Prefer: count=exact,
    đọc lại từ header Content-Range - PostgREST trả dạng "0-24/137")."""
    headers = dict(HEADERS)
    if exact_count:
        headers["Prefer"] = "count=exact"
    r = requests.get(f"{REST_URL}/{table}", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    rows = r.json()
    total = None
    if exact_count:
        cr = r.headers.get("Content-Range", "")
        if "/" in cr:
            total = int(cr.rsplit("/", 1)[1])
    return rows, total


def sb_insert(table, row):
    r = requests.post(f"{REST_URL}/{table}", headers=HEADERS, json=row, timeout=30)
    if not r.ok:
        raise RuntimeError(f"Insert {table} lỗi {r.status_code}: {r.text}")
    return r.json()


# ==============================================================================
# BƯỚC 1 - TẠO NGƯỜI HỌC MỚI (nếu NEW_USERS có gì)
# ==============================================================================

def create_new_users(existing_profiles):
    existing_names = {p["display_name"].strip().lower() for p in existing_profiles if p.get("display_name")}
    created = []
    for name, emoji in NEW_USERS:
        key = name.strip().lower()
        if key in existing_names:
            print(f"  ⏭️  '{name}' đã có sẵn - bỏ qua (không tạo trùng).")
            continue
        new_id = str(uuid.uuid4())
        sb_insert("profiles", {"id": new_id, "display_name": name, "avatar_emoji": emoji or "🐣"})
        print(f"  ✅ Đã tạo '{name}' {emoji or '🐣'} - id: {new_id}")
        created.append({"id": new_id, "display_name": name, "avatar_emoji": emoji or "🐣"})
        existing_names.add(key)
    return created


# ==============================================================================
# BƯỚC 2 - GOM SỐ LIỆU TIẾN TRÌNH TỪNG NGƯỜI
# ==============================================================================

def fetch_all(table, select, page_size=1000):
    """Lấy TOÀN BỘ rows của 1 bảng (phân trang bằng Range header của
    PostgREST) - dùng cho word_progress/block_progress, số dòng nhỏ (vài
    trăm/người) nên không cần lọc theo user_id riêng, lấy 1 lần rồi tự gom
    nhóm trong Python nhanh hơn gọi API lặp lại cho mỗi người."""
    rows = []
    offset = 0
    while True:
        headers = dict(HEADERS)
        headers["Range-Unit"] = "items"
        headers["Range"] = f"{offset}-{offset + page_size - 1}"
        r = requests.get(f"{REST_URL}/{table}", headers=headers,
                          params={"select": select}, timeout=30)
        r.raise_for_status()
        chunk = r.json()
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def word_score(r):
    """Điểm của ĐÚNG 1 dòng word_progress - xem công thức ở CONFIG đầu file."""
    if r.get("mastered"):
        return SCORE_WORD_MASTERED
    attempts = r.get("attempts") or 0
    correct = r.get("correct") or 0
    if attempts > 0:
        return round(SCORE_WORD_PARTIAL_MAX * min(correct / attempts, 1))
    return 0


def block_score(r, now_ms):
    """Điểm của ĐÚNG 1 dòng block_progress - 0 nếu chưa đạt bài kiểm tra."""
    if not r.get("passed"):
        return 0
    cycle = min(r.get("cycle") or 0, MAX_CYCLE)
    score = SCORE_BLOCK_PASSED_BASE + cycle * SCORE_BLOCK_PER_CYCLE
    if cycle < MAX_CYCLE:
        next_at = r.get("next_review_at")
        if not next_at or next_at <= now_ms:
            score += SCORE_BLOCK_OVERDUE_PENALTY
    return score


def _hierarchy():
    """Tải cây Hub->...->Block + gom Term theo Block - dùng chung cho cả
    sheet 'Chi tiết Từ' lẫn 'Chi tiết Block' để hiện ngữ cảnh dễ đọc."""
    hubs = {h["id"]: h for h in fetch_all("hubs", "id,name")}
    notebooks = {n["id"]: n for n in fetch_all("notebooks", "id,hub_id,name")}
    sections = {s["id"]: s for s in fetch_all("sections", "id,notebook_id,name")}
    pages = {p["id"]: p for p in fetch_all("pages", "id,section_id,name")}
    batches = {b["id"]: b for b in fetch_all("batches", "id,page_id,name")}
    blocks = {b["id"]: b for b in fetch_all("blocks", "id,batch_id,name")}
    words = {w["id"]: w for w in fetch_all("words", "id,block_id,term,meaning_vi")}

    def chain_of_block(block_id):
        blk = blocks.get(block_id, {})
        bat = batches.get(blk.get("batch_id"), {})
        pg = pages.get(bat.get("page_id"), {})
        sec = sections.get(pg.get("section_id"), {})
        nb = notebooks.get(sec.get("notebook_id"), {})
        hub = hubs.get(nb.get("hub_id"), {})
        return (hub.get("name", ""), nb.get("name", ""), sec.get("name", ""),
                pg.get("name", ""), bat.get("name", ""), blk.get("name", ""))

    return blocks, words, chain_of_block


def _fmt_ms(ms):
    if not ms:
        return ""
    try:
        return datetime.datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return ""


def build_stats():
    profiles, _ = sb_get("profiles", {"select": "id,display_name,avatar_emoji", "order": "display_name.asc"})
    word_progress = fetch_all("word_progress", "user_id,word_id,attempts,correct,mastered,familiarity,last_reviewed_at")
    block_progress = fetch_all(
        "block_progress",
        "user_id,block_id,best_score,passed,meaning_passed,cycle,next_review_at,last_reviewed_at")
    _, total_words = sb_get("words", {"select": "id"}, exact_count=True)
    _, total_blocks = sb_get("blocks", {"select": "id"}, exact_count=True)
    blocks, words, chain_of_block = _hierarchy()

    now_ms = time.time() * 1000
    stats_by_user = {}
    for p in profiles:
        stats_by_user[p["id"]] = {
            "profile": p,
            "words_touched": 0, "words_mastered": 0,
            "blocks_passed": 0,
            "group": {1: 0, 2: 0, 3: 0, 4: 0}, "long_term": 0,
            "overdue": 0, "score": 0,
        }

    word_detail_rows = []
    for r in word_progress:
        s = stats_by_user.get(r["user_id"])
        if not s:
            continue
        s["words_touched"] += 1
        if r.get("mastered"):
            s["words_mastered"] += 1
        pts = word_score(r)
        s["score"] += pts

        w = words.get(r["word_id"], {})
        chain = chain_of_block(w.get("block_id"))
        word_detail_rows.append({
            "user": s["profile"].get("display_name") or "",
            "chain": chain,
            "term": w.get("term") or "",
            "meaning_vi": w.get("meaning_vi") or "",
            "attempts": r.get("attempts") or 0,
            "correct": r.get("correct") or 0,
            "mastered": bool(r.get("mastered")),
            "familiarity": r.get("familiarity"),
            "last_reviewed_at": _fmt_ms(r.get("last_reviewed_at")),
            "score": pts,
        })

    block_detail_rows = []
    for r in block_progress:
        s = stats_by_user.get(r["user_id"])
        if not s:
            continue
        pts = block_score(r, now_ms)
        s["score"] += pts

        cycle = r.get("cycle") or 0
        is_overdue = False
        if r.get("passed"):
            s["blocks_passed"] += 1
            if cycle >= MAX_CYCLE:
                s["long_term"] += 1
            else:
                s["group"][_group_of(cycle)] += 1
                next_at = r.get("next_review_at")
                is_overdue = not next_at or next_at <= now_ms
                if is_overdue:
                    s["overdue"] += 1

        blk = blocks.get(r["block_id"], {})
        chain = chain_of_block(r["block_id"])
        block_detail_rows.append({
            "user": s["profile"].get("display_name") or "",
            "chain": chain,
            "best_score": r.get("best_score"),
            "passed": bool(r.get("passed")),
            "cycle": cycle,
            "next_review_at": _fmt_ms(r.get("next_review_at")),
            "overdue": is_overdue,
            "score": pts,
        })

    return list(stats_by_user.values()), total_words, total_blocks, word_detail_rows, block_detail_rows


# ==============================================================================
# BƯỚC 3 - XUẤT EXCEL
# ==============================================================================

HEADER_FILL = PatternFill("solid", fgColor="4472C4")
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF")
OVERDUE_FILL = PatternFill("solid", fgColor="FFC7CE")


def _hyperlink(url, display):
    safe_url = url.replace('"', '""')
    safe_display = str(display).replace('"', '""')
    return f'=HYPERLINK("{safe_url}","{safe_display}")'


COMMENT_AUTHOR = "manage_users.py"


def _write_headers_with_notes(ws, headers, notes_by_index):
    """Ghi tiêu đề + gắn CHÚ THÍCH (di chuột vào tiêu đề là hiện, không cần
    mở sheet 'Ghi chú' riêng) - notes_by_index: {số cột (1-based): chuỗi
    giải thích}. Cột không có trong dict thì không gắn chú thích gì cả
    (VD cột chỉ để trang trí/rỗng)."""
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        note = notes_by_index.get(i)
        if note:
            cm = Comment(note, COMMENT_AUTHOR)
            cm.width = 320
            cm.height = 140
            c.comment = cm


def write_excel(stats_list, total_words, total_blocks, word_rows, block_rows):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Người học"

    headers = [
        "", "Tên", "Link truy cập (gửi cho người học)", "🏆 Điểm",
        "Từ đã chạm", "Từ đã thuộc", f"/ {total_words} từ trong kho",
        "Block đã đạt bài thi", f"/ {total_blocks} block trong kho",
        "Lần 1–2\n(10p/24h)", "Lần 3\n(1 tuần)", "Lần 4\n(1 tháng)", "Lần 5–6\n(3–6 tháng)",
        "Đã vào\ntrí nhớ dài hạn 💎", "⚠️ Block\nTRỄ HẠN ôn",
    ]
    notes = {
        1: "Emoji đại diện người học (tự chọn lúc tạo hoặc trong app).",
        2: "Bấm vào MỞ THẲNG link học của đúng người đó - không cần mật khẩu/email, "
           "vào là nhận diện luôn.",
        3: "Y hệt link ở cột Tên, dạng chữ thường (không phải nút bấm) - copy dòng này "
           "gửi qua Zalo/tin nhắn cho người học.",
        4: "TỔNG ĐIỂM = cộng điểm mọi TỪ (sheet 'Chi tiết Từ') + điểm mọi BLOCK "
           "(sheet 'Chi tiết Block') của người này.\n\n"
           f"Điểm 1 từ: Đã thuộc = {SCORE_WORD_MASTERED}đ. Chưa thuộc nhưng đã thử qua = "
           f"tối đa {SCORE_WORD_PARTIAL_MAX}đ, nhân theo tỉ lệ (số lần đúng / tổng số lần thử).\n\n"
           f"Điểm 1 block (chỉ tính khi ĐÃ ĐẠT bài thi): {SCORE_BLOCK_PASSED_BASE}đ nền + "
           f"{SCORE_BLOCK_PER_CYCLE}đ cho mỗi lần đã ôn ĐÚNG HẠN xong (tối đa 6 lần Tony Buzan). "
           f"Đang TRỄ HẠN ôn thì bị trừ {abs(SCORE_BLOCK_OVERDUE_PENALTY)}đ.\n\n"
           "Sheet 'Người học' đã tự sắp XẾP HẠNG theo điểm này, cao nhất lên đầu. Đổi trọng số ở "
           "đầu file manage_users.py (mục SCORE_*) rồi chạy lại là điểm tự tính lại ngay.",
        5: "Số từ người này đã TỪNG làm bài ít nhất 1 lần (có dòng trong bảng word_progress) - "
           "kể cả chưa 'thuộc' hẳn, chỉ cần đã thử qua là tính.",
        6: "Trong số 'Từ đã chạm', bao nhiêu từ được app TỰ ĐỘNG đánh dấu ĐÃ THUỘC "
           "(mặc định: đúng >=80% VÀ đã thử >=3 lần - xem MASTER_THRESHOLD/MASTER_MIN_ATTEMPTS "
           "trong js/config.js).",
        7: "Tổng số từ đang có trong TOÀN BỘ kho từ vựng (dùng chung mọi người học) - để so sánh "
           "tỉ lệ 'đã thuộc bao nhiêu trên tổng số'.",
        8: "Số Block người này đã học XONG và ĐẠT bài kiểm tra cuối bài (điểm >=80%) - chỉ Block "
           "đã đạt mới được tính vào 4 cột chu kỳ ôn Tony Buzan bên phải.",
        9: "Tổng số Block đang có trong toàn bộ kho (dùng chung mọi người học).",
        10: "Giai đoạn ôn tập Tony Buzan LẦN 1 (sau 10 phút) và LẦN 2 (sau 24 giờ) - số Block "
            "đang ở 1 trong 2 mốc này, CHƯA đến hạn ôn lại.",
        11: "Giai đoạn ôn LẦN 3 (ôn lại sau 1 tuần kể từ lần ôn trước) - số Block đang ở mốc "
            "này, CHƯA đến hạn.",
        12: "Giai đoạn ôn LẦN 4 (ôn lại sau 1 tháng) - số Block đang ở mốc này, CHƯA đến hạn.",
        13: "Giai đoạn ôn LẦN 5 (sau 3 tháng) và LẦN 6 (sau 6 tháng, mốc DUY TRÌ cuối cùng) - "
            "số Block đang ở 1 trong 2 mốc này, CHƯA đến hạn.",
        14: "Block đã ôn ĐỦ hết 6 lần theo Tony Buzan - coi như đã vào trí nhớ dài hạn, không "
            "cần ôn lại theo lịch nữa (vẫn tính điểm như Block đã đạt).",
        15: "Trong số Block đang ở 4 giai đoạn ôn (cột 'Lần 1-2/3/4/5-6' - KHÔNG tính Block đã "
            "vào trí nhớ dài hạn), bao nhiêu cái đã QUÁ NGÀY hẹn ôn lại mà CHƯA ôn. Càng nhiều "
            "càng cần nhắc người học ôn sớm - mỗi Block trễ hạn cũng đang bị TRỪ ĐIỂM (xem cột Điểm).",
    }
    _write_headers_with_notes(ws, headers, notes)

    # Sắp theo ĐIỂM giảm dần - thành bảng xếp hạng luôn, cao nhất lên đầu.
    stats_list = sorted(stats_list, key=lambda s: (-s["score"], (s["profile"].get("display_name") or "").lower()))
    for r_idx, s in enumerate(stats_list, start=2):
        p = s["profile"]
        link = APP_BASE_URL + "?u=" + p["id"]

        ws.cell(row=r_idx, column=1, value=p.get("avatar_emoji") or "🐣")

        c_name = ws.cell(row=r_idx, column=2, value=_hyperlink(link, p.get("display_name") or "(chưa đặt tên)"))
        c_name.font = Font(name="Arial", bold=True, color="0563C1", underline="single")

        c_link = ws.cell(row=r_idx, column=3, value=link)
        c_link.font = Font(name="Arial", size=9, color="666666")

        c_score = ws.cell(row=r_idx, column=4, value=s["score"])
        c_score.font = Font(name="Arial", bold=True, color="C55A11")

        ws.cell(row=r_idx, column=5, value=s["words_touched"])
        ws.cell(row=r_idx, column=6, value=s["words_mastered"])
        ws.cell(row=r_idx, column=7, value=total_words)
        ws.cell(row=r_idx, column=8, value=s["blocks_passed"])
        ws.cell(row=r_idx, column=9, value=total_blocks)
        ws.cell(row=r_idx, column=10, value=s["group"][1])
        ws.cell(row=r_idx, column=11, value=s["group"][2])
        ws.cell(row=r_idx, column=12, value=s["group"][3])
        ws.cell(row=r_idx, column=13, value=s["group"][4])
        ws.cell(row=r_idx, column=14, value=s["long_term"])

        c_overdue = ws.cell(row=r_idx, column=15, value=s["overdue"])
        if s["overdue"] > 0:
            c_overdue.fill = OVERDUE_FILL
            c_overdue.font = Font(name="Arial", bold=True)

        for c in range(1, len(headers) + 1):
            ws.cell(row=r_idx, column=c).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=r_idx, column=2).alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=r_idx, column=3).alignment = Alignment(horizontal="left", vertical="center")

    widths = [4, 20, 60, 9, 11, 11, 13, 15, 15, 12, 11, 11, 13, 15, 12]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(stats_list) + 1}"

    # Sheet "Chi tiết Từ" - 1 dòng/1 user x 1 từ đã từng làm bài.
    ws3 = wb.create_sheet("Chi tiết Từ")
    wd_headers = ["Người học", "Hub", "Notebook", "Section", "Page", "Batch", "Block",
                  "Từ", "Nghĩa", "Số lần thử", "Số lần đúng", "Đã thuộc?",
                  "Mức quen (familiarity)", "Ôn gần nhất", "🏆 Điểm"]
    wd_notes = {
        8: "Từ tiếng Anh thật (cột 'term' trong bảng words trên Supabase).",
        10: "Tổng số lần người này đã LÀM BÀI với từ này (mọi kiểu bài - trắc nghiệm, điền từ...).",
        11: "Trong số lần thử đó, bao nhiêu lần TRẢ LỜI ĐÚNG.",
        12: "✅ = app đã tự đánh dấu ĐÃ THUỘC (mặc định: đúng >=80% VÀ đã thử >=3 lần).",
        13: "Số 0-100 app tự tính, thể hiện mức độ 'quen' với từ này (không phải % đúng thuần "
            "tuý - có tính cả yếu tố thời gian/độ khó). Số càng cao càng nhớ chắc.",
        14: "Thời điểm gần nhất người này ôn/làm bài với từ này.",
        15: f"Điểm CỦA RIÊNG từ này: {SCORE_WORD_MASTERED}đ nếu đã thuộc, hoặc tối đa "
            f"{SCORE_WORD_PARTIAL_MAX}đ theo tỉ lệ đúng nếu chưa thuộc - cộng dồn hết các dòng "
            "của 1 người ra đúng số ở cột 'Điểm' bên sheet 'Người học'.",
    }
    _write_headers_with_notes(ws3, wd_headers, wd_notes)
    word_rows_sorted = sorted(word_rows, key=lambda r: (r["user"].lower(), r["chain"]))
    for r_idx, r in enumerate(word_rows_sorted, start=2):
        vals = [r["user"]] + list(r["chain"]) + [
            r["term"], r["meaning_vi"], r["attempts"], r["correct"],
            "✅" if r["mastered"] else "", r["familiarity"], r["last_reviewed_at"], r["score"],
        ]
        for i, v in enumerate(vals, start=1):
            ws3.cell(row=r_idx, column=i, value=v)
    wd_widths = [16, 14, 14, 14, 18, 10, 10, 20, 26, 10, 10, 9, 12, 15, 8]
    for i, w in enumerate(wd_widths, start=1):
        ws3.column_dimensions[get_column_letter(i)].width = w
    ws3.freeze_panes = "A2"
    ws3.auto_filter.ref = f"A1:{get_column_letter(len(wd_headers))}{len(word_rows_sorted) + 1}"

    # Sheet "Chi tiết Block" - 1 dòng/1 user x 1 Block đã học.
    ws4 = wb.create_sheet("Chi tiết Block")
    bd_headers = ["Người học", "Hub", "Notebook", "Section", "Page", "Batch", "Block",
                  "Điểm bài thi cao nhất", "Đã đạt?", "Chu kỳ ôn (0-6)",
                  "Ôn lại lúc", "⚠️ Trễ hạn?", "🏆 Điểm"]
    bd_notes = {
        8: "% điểm CAO NHẤT người này từng đạt ở bài kiểm tra cuối Block (có thể đã thi lại "
           "nhiều lần, đây là lần điểm cao nhất).",
        9: "✅ = đã ĐẠT bài kiểm tra (điểm >=80%) - chỉ Block đã đạt mới vào chu kỳ ôn Tony "
           "Buzan (các cột bên phải) và mới được tính điểm.",
        10: "Đã ôn ĐÚNG HẠN xong bao nhiêu lần theo Tony Buzan (0 = vừa đạt bài thi, chưa ôn "
            "lần nào; 6 = đã ôn đủ hết, vào trí nhớ dài hạn).",
        11: "Ngày/giờ HẸN ôn lại kế tiếp (theo đúng chu kỳ Tony Buzan: 10 phút -> 24 giờ -> 1 "
            "tuần -> 1 tháng -> 3 tháng -> 6 tháng).",
        12: "⚠️ TRỄ = đã QUÁ ngày hẹn ở cột trước mà chưa ôn lại - Block này đang bị TRỪ ĐIỂM "
            f"({abs(SCORE_BLOCK_OVERDUE_PENALTY)}đ) ở cột Điểm bên cạnh.",
        13: f"Điểm CỦA RIÊNG Block này: 0 nếu chưa đạt bài thi; đã đạt thì {SCORE_BLOCK_PASSED_BASE}đ "
            f"nền + {SCORE_BLOCK_PER_CYCLE}đ/lần đã ôn đúng hạn, trừ {abs(SCORE_BLOCK_OVERDUE_PENALTY)}đ "
            "nếu đang trễ hạn - cộng dồn hết các dòng của 1 người ra đúng số ở cột 'Điểm' bên sheet "
            "'Người học'.",
    }
    _write_headers_with_notes(ws4, bd_headers, bd_notes)
    block_rows_sorted = sorted(block_rows, key=lambda r: (r["user"].lower(), r["chain"]))
    for r_idx, r in enumerate(block_rows_sorted, start=2):
        vals = [r["user"]] + list(r["chain"]) + [
            r["best_score"], "✅" if r["passed"] else "", r["cycle"], r["next_review_at"],
        ]
        for i, v in enumerate(vals, start=1):
            ws4.cell(row=r_idx, column=i, value=v)
        c_od = ws4.cell(row=r_idx, column=12, value="⚠️ TRỄ" if r["overdue"] else "")
        if r["overdue"]:
            c_od.fill = OVERDUE_FILL
            c_od.font = Font(name="Arial", bold=True)
        ws4.cell(row=r_idx, column=13, value=r["score"])
    bd_widths = [16, 14, 14, 14, 18, 10, 10, 12, 9, 12, 15, 11, 8]
    for i, w in enumerate(bd_widths, start=1):
        ws4.column_dimensions[get_column_letter(i)].width = w
    ws4.freeze_panes = "A2"
    ws4.auto_filter.ref = f"A1:{get_column_letter(len(bd_headers))}{len(block_rows_sorted) + 1}"

    # Sheet ghi chú ngắn - giải thích cột cho đỡ phải hỏi lại lần sau.
    ws2 = wb.create_sheet("Ghi chú")
    ws2.column_dimensions["A"].width = 100
    notes = [
        f"Xuất lúc: {datetime.datetime.now():%Y-%m-%d %H:%M}",
        "",
        "• Cột 'Tên': bấm vào MỞ THẲNG link học của đúng người đó (không cần mật khẩu/email).",
        "• Cột 'Link truy cập': y hệt link ở cột Tên, dạng chữ thường để copy gửi qua Zalo/tin nhắn.",
        "• 'Từ đã chạm': số từ đã từng làm bài (có dòng trong word_progress), 'Từ đã thuộc': trong số đó, bao nhiêu từ được tool tự đánh dấu ĐÃ THUỘC (>=80% đúng, >=3 lần thử - xem MASTER_THRESHOLD/MASTER_MIN_ATTEMPTS trong js/config.js).",
        "• 'Block đã đạt bài thi': số Block đã học xong VÀ đạt bài kiểm tra cuối bài (>=80%) - chỉ Block đã đạt mới được tính vào chu kỳ ôn Tony Buzan bên dưới.",
        "• 4 cột 'Lần 1–2/3/4/5–6': số Block hiện đang ở ĐÚNG giai đoạn ôn đó (chưa đến hạn ôn lại) - xem js/srs.js.",
        "• 'Đã vào trí nhớ dài hạn': Block đã ôn đủ hết 6 lần theo Tony Buzan, coi như xong hẳn.",
        "• '⚠️ Block TRỄ HẠN ôn': trong số Block đang ở 4 giai đoạn trên, bao nhiêu cái đã QUÁ NGÀY hẹn ôn lại mà chưa ôn - CÀNG NHIỀU càng cần nhắc người học ôn lại sớm.",
        "",
        f"• 🏆 ĐIỂM (sheet 'Người học' đã SẮP THEO ĐIỂM GIẢM DẦN - cao nhất lên đầu, thành bảng xếp hạng):",
        f"    - Mỗi TỪ 'Đã thuộc' = {SCORE_WORD_MASTERED} điểm. Chưa thuộc nhưng đã thử qua = tối đa {SCORE_WORD_PARTIAL_MAX} điểm,",
        f"      nhân theo TỈ LỆ ĐÚNG (đúng/tổng số lần thử) - thử đúng gần hết dù chưa 'thuộc' vẫn được gần đủ điểm.",
        f"    - Mỗi BLOCK đã ĐẠT bài thi = {SCORE_BLOCK_PASSED_BASE} điểm nền + {SCORE_BLOCK_PER_CYCLE} điểm/lần đã ôn ĐÚNG HẠN xong",
        f"      (tối đa 6 lần theo Tony Buzan) - ôn càng bền càng nhiều điểm.",
        f"    - Block đang TRỄ HẠN ôn (chưa ôn dù quá ngày hẹn) bị trừ {abs(SCORE_BLOCK_OVERDUE_PENALTY)} điểm - nhắc khéo đang nợ bài.",
        "    - Đổi trọng số các số trên ở đầu file manage_users.py (mục SCORE_*), chạy lại là điểm tự tính lại ngay,",
        "      không cần sửa code chỗ nào khác.",
        "• Sheet 'Chi tiết Từ'/'Chi tiết Block': xem TỪNG dòng đã ghi điểm bao nhiêu, đối chiếu/kiểm tra công thức",
        "  hoặc tự cộng lại theo cách khác nếu muốn 1 công thức riêng không có sẵn ở đây.",
        "",
        "⚠️ FILE NÀY CHỨA LINK ĐĂNG NHẬP THẬT - không đẩy lên GitHub/chia sẻ công khai, chỉ gửi RIÊNG cho đúng người trong link đó.",
    ]
    for i, line in enumerate(notes, start=1):
        ws2.cell(row=i, column=1, value=line).font = Font(name="Arial", size=11)

    wb.save(OUTPUT_XLSX)
    return OUTPUT_XLSX


# ==============================================================================
# CHẠY
# ==============================================================================

def run():
    print(f"📡 Kết nối Supabase: {SUPABASE_URL}")
    profiles, _ = sb_get("profiles", {"select": "id,display_name,avatar_emoji"})
    print(f"  -> Hiện có {len(profiles)} người học.")

    if NEW_USERS:
        print("Đang tạo người học mới (nếu có)...")
        create_new_users(profiles)

    print("Đang gom số liệu tiến trình từng người...")
    stats_list, total_words, total_blocks, word_rows, block_rows = build_stats()

    print("Đang xuất Excel...")
    path = write_excel(stats_list, total_words, total_blocks, word_rows, block_rows)
    print(f"✅ Xong! Đã lưu: {path}")
    print("⚠️  Nhắc lại: file này có link đăng nhập thật - KHÔNG đẩy lên GitHub/chia sẻ công khai.")

    if AUTO_OPEN_EXCEL:
        try:
            import os
            os.startfile(str(path))
        except Exception as e:
            print(f"  (Không tự mở được Excel: {e})")


if __name__ == "__main__":
    run()
