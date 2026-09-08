"""
================================================================================
 manage_users.py — QUẢN LÝ NGƯỜI HỌC (TJ WordLoop Hub, chế độ Cloud)
================================================================================
 BẢN 2026-09-07 (v3) — Thao tự quản lý người học KHÔNG cần Supabase Dashboard
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
          đã thuộc, số Block đã đạt bài thi (Pass ≥80% = Done), đang ở
          giai đoạn nào trong 4 giai đoạn ôn Tony Buzan, số Block TRỄ HẠN.
        - "Chi tiết Từ": 1 dòng/1 user x 1 từ đã từng làm bài - đúng mấy
          lần/sai mấy lần, đã thuộc chưa, mức quen, lần ôn gần nhất.
        - "Chi tiết Block": 1 dòng/1 user x 1 Block đã học - điểm bài thi
          cao nhất, Done (Pass ≥80%) chưa, chu kỳ ôn hiện tại, có trễ hạn.
      (v2 2026-09-07: bỏ phần tính Điểm/xếp hạng theo yêu cầu Thao - "Pass
      80% thì Done cho block, khoan tính điểm gì". v3 cùng ngày: thêm lại
      "Chi tiết Từ" (không có Điểm, chỉ đúng/sai) + làm lại màu sắc.)

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
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
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


def _hierarchy():
    """Tải cây Hub->...->Block + Từ theo Block - dùng để hiện ngữ cảnh dễ
    đọc ở sheet 'Chi tiết Từ'/'Chi tiết Block' (Hub/Notebook/Section/Page/
    Batch/Block của mỗi dòng)."""
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


ESTIMATE_PASS_RATIO = 0.8  # % đúng tối thiểu để tính "ước tính đạt 80%" (khớp MASTER_THRESHOLD)


def build_stats():
    profiles, _ = sb_get("profiles", {"select": "id,display_name,avatar_emoji", "order": "display_name.asc"})
    word_progress = fetch_all("word_progress", "user_id,word_id,attempts,correct,mastered,familiarity,last_reviewed_at")
    block_progress = fetch_all(
        "block_progress",
        "user_id,block_id,best_score,passed,meaning_passed,cycle,next_review_at,last_reviewed_at")
    _, total_words = sb_get("words", {"select": "id"}, exact_count=True)
    _, total_blocks = sb_get("blocks", {"select": "id"}, exact_count=True)
    blocks, words, chain_of_block = _hierarchy()

    # Danh sách word_id thuộc mỗi block - cần để biết 1 Block có TỔNG CỘNG
    # bao nhiêu từ (mẫu số) và để gom "user này đã đụng/đúng bao nhiêu từ
    # trong Block đó" (tử số) - phục vụ tính ƯỚC TÍNH bên dưới.
    words_by_block = {}
    for wid, w in words.items():
        words_by_block.setdefault(w.get("block_id"), []).append(wid)

    now_ms = time.time() * 1000
    stats_by_user = {}
    for p in profiles:
        stats_by_user[p["id"]] = {
            "profile": p,
            "words_mastered": 0,
            "blocks_passed": 0,
            "blocks_estimated_only": 0,   # ước tính đạt 80% nhưng CHƯA thi chính thức
            "group": {1: 0, 2: 0, 3: 0, 4: 0}, "long_term": 0,
            "overdue": 0,
        }

    word_detail_rows = []
    # user_id -> block_id -> {"attempts":.., "correct":.., "touched":..}
    wp_by_user_block = {}
    for r in word_progress:
        s = stats_by_user.get(r["user_id"])
        if not s:
            continue
        if r.get("mastered"):
            s["words_mastered"] += 1

        w = words.get(r["word_id"], {})
        block_id = w.get("block_id")
        chain = chain_of_block(block_id)
        attempts = r.get("attempts") or 0
        correct = r.get("correct") or 0
        word_detail_rows.append({
            "user": s["profile"].get("display_name") or "",
            "chain": chain,
            "term": w.get("term") or "",
            "meaning_vi": w.get("meaning_vi") or "",
            "attempts": attempts,
            "correct": correct,
            "wrong": max(attempts - correct, 0),
            "mastered": bool(r.get("mastered")),
            "familiarity": r.get("familiarity"),
            "last_reviewed_at": _fmt_ms(r.get("last_reviewed_at")),
        })

        agg = wp_by_user_block.setdefault(r["user_id"], {}).setdefault(
            block_id, {"attempts": 0, "correct": 0, "touched": 0})
        agg["attempts"] += attempts
        agg["correct"] += correct
        agg["touched"] += 1

    bp_by_user_block = {}
    for r in block_progress:
        bp_by_user_block.setdefault(r["user_id"], {})[r["block_id"]] = r

    # ĐỦ DỮ LIỆU MỌI BLOCK (kể cả chưa đụng tới) x MỌI user - không chỉ
    # những Block đã có sẵn dòng trong block_progress, theo đúng yêu cầu
    # Thao "phải có dữ liệu từng Block".
    block_detail_rows = []
    for p in profiles:
        uid = p["id"]
        s = stats_by_user[uid]
        for block_id, blk in blocks.items():
            bp = bp_by_user_block.get(uid, {}).get(block_id)
            wp_agg = wp_by_user_block.get(uid, {}).get(block_id)
            total_in_block = len(words_by_block.get(block_id, []))

            passed = bool(bp and bp.get("passed"))
            cycle = (bp.get("cycle") or 0) if bp else 0
            is_overdue = False
            if passed:
                s["blocks_passed"] += 1
                if cycle >= MAX_CYCLE:
                    s["long_term"] += 1
                else:
                    s["group"][_group_of(cycle)] += 1
                    next_at = bp.get("next_review_at")
                    is_overdue = not next_at or next_at <= now_ms
                    if is_overdue:
                        s["overdue"] += 1

            # ƯỚC TÍNH (suy ra từ dữ liệu TỪNG TỪ, KHÔNG phải bài thi chính
            # thức của app) - chỉ tính khi đã đụng tới TẤT CẢ từ trong Block
            # đó ít nhất 1 lần, để không kết luận vội khi mới thử vài từ.
            est_ratio = None
            est_pass = False
            if wp_agg and total_in_block > 0 and wp_agg["touched"] >= total_in_block and wp_agg["attempts"] > 0:
                est_ratio = wp_agg["correct"] / wp_agg["attempts"]
                est_pass = est_ratio >= ESTIMATE_PASS_RATIO
                if est_pass and not passed:
                    s["blocks_estimated_only"] += 1

            # LIỆT KÊ HẾT MỌI Block x mọi user (kể cả chưa đụng tới chút
            # nào) - theo đúng yêu cầu Thao "tất cả phải theo dõi và thống
            # kê" - không lọc bớt, để nhìn được BỨC TRANH ĐẦY ĐỦ ai đã/chưa
            # học Block nào, không chỉ những Block có sẵn hoạt động.
            touched = wp_agg["touched"] if wp_agg else 0
            if passed:
                status = "✓ Done (đã thi, Pass ≥80%)"
            elif est_pass:
                status = "🟡 Ước tính đạt 80% (chưa thi chính thức)"
            elif touched > 0:
                status = f"🔸 Đang học ({touched}/{total_in_block} từ)"
            else:
                status = "⚪ Chưa học"

            chain = chain_of_block(block_id)
            block_detail_rows.append({
                "user": p.get("display_name") or "",
                "chain": chain,
                "status": status,
                "best_score": bp.get("best_score") if bp else None,
                "passed": passed,
                "cycle": cycle,
                "next_review_at": _fmt_ms(bp.get("next_review_at")) if bp else "",
                "overdue": is_overdue,
                "words_touched": touched,
                "words_total": total_in_block,
                "est_ratio": est_ratio,
                "est_pass": est_pass,
            })

    return list(stats_by_user.values()), total_words, total_blocks, word_detail_rows, block_detail_rows


# ==============================================================================
# BƯỚC 3 - XUẤT EXCEL — PHỐI MÀU (tông ấm kiểu Claude: cam đất + kem)
# ==============================================================================

BRAND = "CC785C"          # cam đất - màu thương hiệu Claude, dùng cho header
BRAND_DARK = "B34E30"      # đậm hơn - viền/nhấn
INK = "3D3929"             # chữ chính - nâu đen ấm (không dùng đen thuần)
CREAM = "F7F4EE"           # nền vằn chẵn - kem nhạt
WHITE = "FFFFFF"
GREEN_TXT = "1F7A4D"
GREEN_BG = "E3F1E9"
RED_TXT = "B3261E"
RED_BG = "FBE7E4"
GRAY_TXT = "6B6459"

HEADER_FILL = PatternFill("solid", fgColor=BRAND)
HEADER_FONT = Font(name="Calibri", bold=True, color=WHITE, size=10)
BAND_FILL = PatternFill("solid", fgColor=CREAM)
OVERDUE_FILL = PatternFill("solid", fgColor=RED_BG)
OVERDUE_FONT = Font(name="Calibri", bold=True, color=RED_TXT)
BODY_FONT = Font(name="Calibri", color=INK, size=10)
DIM_FONT = Font(name="Calibri", color=GRAY_TXT, size=9)
LINK_FONT = Font(name="Calibri", bold=True, color="1155CC", underline="single")
THIN = Side(style="thin", color="E4DFD4")
CELL_BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


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


def _style_row(ws, r_idx, n_cols, banded):
    """Vằn xen kẽ (băng kem/trắng) + border mỏng đồng bộ cho cả hàng."""
    fill = BAND_FILL if banded else None
    for c in range(1, n_cols + 1):
        cell = ws.cell(row=r_idx, column=c)
        if fill:
            cell.fill = fill
        cell.border = CELL_BORDER
        if not cell.font or cell.font.name != "Calibri":
            cell.font = BODY_FONT


def write_excel(stats_list, total_words, total_blocks, word_rows, block_rows):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Người học"

    headers = [
        "", "Tên", "Link truy cập (gửi cho người học)",
        "Từ đã thuộc", f"/ {total_words} từ trong kho",
        "Block đã đạt bài thi", f"/ {total_blocks} block trong kho",
        "Lần 1–2\n(10p/24h)", "Lần 3\n(1 tuần)", "Lần 4\n(1 tháng)", "Lần 5–6\n(3–6 tháng)",
        "Đã vào\ntrí nhớ dài hạn 💎", "⚠️ Block\nTRỄ HẠN ôn",
    ]
    notes = {
        1: "Emoji đại diện người học (tự chọn lúc tạo hoặc trong app).",
        2: "Bấm vào MỞ THẲNG link học của đúng người đó - không cần mật khẩu/email, "
           "vào là nhận diện luôn.",
        3: "Y hệt link ở cột Tên, dạng chữ thường (không phải nút bấm) - copy dòng này "
           "gửi qua Zalo/tin nhắn cho người học.\n\n"
           "⚠️ File Excel này chứa link đăng nhập THẬT - không đẩy lên GitHub/chia sẻ công "
           "khai, chỉ gửi RIÊNG cho đúng người trong link đó.",
        4: "Số từ được app TỰ ĐỘNG đánh dấu ĐÃ THUỘC (mặc định: đúng >=80% VÀ đã thử >=3 lần "
           "- xem MASTER_THRESHOLD/MASTER_MIN_ATTEMPTS trong js/config.js).",
        5: "Tổng số từ đang có trong TOÀN BỘ kho từ vựng (dùng chung mọi người học) - để so sánh "
           "tỉ lệ 'đã thuộc bao nhiêu trên tổng số'.",
        6: "Số Block người này đã học XONG và ĐẠT (Pass ≥80%) bài kiểm tra cuối bài - chỉ Block "
           "đã Pass mới được tính vào 4 cột chu kỳ ôn Tony Buzan bên phải.",
        7: "Tổng số Block đang có trong toàn bộ kho (dùng chung mọi người học).",
        8: "Giai đoạn ôn tập Tony Buzan LẦN 1 (sau 10 phút) và LẦN 2 (sau 24 giờ) - số Block "
           "đang ở 1 trong 2 mốc này, CHƯA đến hạn ôn lại.",
        9: "Giai đoạn ôn LẦN 3 (ôn lại sau 1 tuần kể từ lần ôn trước) - số Block đang ở mốc "
           "này, CHƯA đến hạn.",
        10: "Giai đoạn ôn LẦN 4 (ôn lại sau 1 tháng) - số Block đang ở mốc này, CHƯA đến hạn.",
        11: "Giai đoạn ôn LẦN 5 (sau 3 tháng) và LẦN 6 (sau 6 tháng, mốc DUY TRÌ cuối cùng) - "
            "số Block đang ở 1 trong 2 mốc này, CHƯA đến hạn.",
        12: "Block đã ôn ĐỦ hết 6 lần theo Tony Buzan - coi như đã vào trí nhớ dài hạn, không "
            "cần ôn lại theo lịch nữa.",
        13: "Trong số Block đang ở 4 giai đoạn ôn (cột 'Lần 1-2/3/4/5-6' - KHÔNG tính Block đã "
            "vào trí nhớ dài hạn), bao nhiêu cái đã QUÁ NGÀY hẹn ôn lại mà CHƯA ôn. Càng nhiều "
            "càng cần nhắc người học ôn sớm.",
    }
    _write_headers_with_notes(ws, headers, notes)

    stats_list = sorted(stats_list, key=lambda s: (s["profile"].get("display_name") or "").lower())
    for i, s in enumerate(stats_list):
        r_idx = i + 2
        p = s["profile"]
        link = APP_BASE_URL + "?u=" + p["id"]

        ws.cell(row=r_idx, column=1, value=p.get("avatar_emoji") or "🐣")

        c_name = ws.cell(row=r_idx, column=2, value=_hyperlink(link, p.get("display_name") or "(chưa đặt tên)"))
        c_name.font = LINK_FONT

        c_link = ws.cell(row=r_idx, column=3, value=link)
        c_link.font = DIM_FONT

        ws.cell(row=r_idx, column=4, value=s["words_mastered"])
        ws.cell(row=r_idx, column=5, value=total_words)
        ws.cell(row=r_idx, column=6, value=s["blocks_passed"])
        ws.cell(row=r_idx, column=7, value=total_blocks)
        ws.cell(row=r_idx, column=8, value=s["group"][1])
        ws.cell(row=r_idx, column=9, value=s["group"][2])
        ws.cell(row=r_idx, column=10, value=s["group"][3])
        ws.cell(row=r_idx, column=11, value=s["group"][4])
        ws.cell(row=r_idx, column=12, value=s["long_term"])

        _style_row(ws, r_idx, len(headers), banded=(i % 2 == 1))
        ws.cell(row=r_idx, column=2).font = LINK_FONT
        ws.cell(row=r_idx, column=3).font = DIM_FONT
        ws.cell(row=r_idx, column=2).alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=r_idx, column=3).alignment = Alignment(horizontal="left", vertical="center")
        for c in range(1, len(headers) + 1):
            if c not in (2, 3):
                ws.cell(row=r_idx, column=c).alignment = Alignment(horizontal="center", vertical="center")

        c_overdue = ws.cell(row=r_idx, column=13)
        if s["overdue"] > 0:
            c_overdue.fill = OVERDUE_FILL
            c_overdue.font = OVERDUE_FONT

    widths = [4, 20, 60, 11, 13, 15, 15, 12, 11, 11, 13, 15, 12]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(stats_list) + 1}"
    ws.sheet_view.showGridLines = False

    # Sheet "Chi tiết Từ" - 1 dòng/1 user x 1 từ đã từng làm bài. Đúng bao
    # nhiêu/sai bao nhiêu lần - KHÔNG tính điểm gì cả (theo yêu cầu Thao).
    ws3 = wb.create_sheet("Chi tiết Từ")
    wd_headers = ["Người học", "Hub", "Notebook", "Section", "Page", "Batch", "Block",
                  "Từ", "Nghĩa", "Số lần thử", "Số lần đúng", "Số lần sai", "Đã thuộc?",
                  "Mức quen", "Ôn gần nhất"]
    wd_notes = {
        8: "Từ tiếng Anh thật (cột 'term' trong bảng words trên Supabase).",
        10: "Tổng số lần người này đã LÀM BÀI với từ này (mọi kiểu bài - trắc nghiệm, điền từ...).",
        11: "Trong số lần thử đó, bao nhiêu lần TRẢ LỜI ĐÚNG.",
        12: "= Số lần thử − Số lần đúng. Sai càng nhiều, từ này càng cần ôn lại kỹ.",
        13: "✅ = app đã tự đánh dấu ĐÃ THUỘC (mặc định: đúng >=80% VÀ đã thử >=3 lần).",
        14: "Số 0-100 app tự tính, thể hiện mức độ 'quen' với từ này (không phải % đúng thuần "
            "tuý - có tính cả yếu tố thời gian/độ khó). Số càng cao càng nhớ chắc.",
        15: "Thời điểm gần nhất người này ôn/làm bài với từ này.",
    }
    _write_headers_with_notes(ws3, wd_headers, wd_notes)
    word_rows_sorted = sorted(word_rows, key=lambda r: (r["user"].lower(), r["chain"]))
    for i, r in enumerate(word_rows_sorted):
        r_idx = i + 2
        vals = [r["user"]] + list(r["chain"]) + [
            r["term"], r["meaning_vi"], r["attempts"], r["correct"], r["wrong"],
            "✅" if r["mastered"] else "", r["familiarity"], r["last_reviewed_at"],
        ]
        for c, v in enumerate(vals, start=1):
            ws3.cell(row=r_idx, column=c, value=v)
        _style_row(ws3, r_idx, len(wd_headers), banded=(i % 2 == 1))
        if r["wrong"] > 0:
            c_wrong = ws3.cell(row=r_idx, column=12)
            c_wrong.font = OVERDUE_FONT
    wd_widths = [16, 14, 14, 14, 18, 10, 10, 20, 26, 10, 10, 10, 9, 9, 15]
    for i, w in enumerate(wd_widths, start=1):
        ws3.column_dimensions[get_column_letter(i)].width = w
    ws3.freeze_panes = "A2"
    ws3.auto_filter.ref = f"A1:{get_column_letter(len(wd_headers))}{len(word_rows_sorted) + 1}"
    ws3.sheet_view.showGridLines = False

    # Sheet "Chi tiết Block" - 1 dòng/1 user x 1 Block, ĐẦY ĐỦ MỌI Block
    # (kể cả chưa đụng tới - "⚪ Chưa học") theo yêu cầu Thao "tất cả phải
    # theo dõi và thống kê". Cột "Trạng thái" gộp cả tín hiệu CHÍNH THỨC
    # (Done từ block_progress) lẫn ƯỚC TÍNH (suy ra từ % đúng trong
    # word_progress - CHỈ tính khi đã đụng đủ hết từ trong Block đó, xem
    # build_stats) - 2 nguồn tách riêng ở các cột phía sau để đối chiếu.
    ws4 = wb.create_sheet("Chi tiết Block")
    bd_headers = ["Người học", "Hub", "Notebook", "Section", "Page", "Batch", "Block",
                  "Trạng thái", "Điểm bài thi\ncao nhất", "Pass ≥80%\n(Done chính thức)?",
                  "Chu kỳ ôn\n(0-6)", "Ôn lại lúc", "⚠️ Trễ hạn?",
                  "Từ đã ôn\n/ tổng từ", "% đúng\n(ước tính)"]
    bd_notes = {
        8: "Tổng hợp nhanh: '✓ Done' = đã thi chính thức đạt ≥80%. '🟡 Ước tính đạt 80%' = "
           "CHƯA thi chính thức nhưng đã ôn hết từ trong Block với tỉ lệ đúng ≥80% (suy ra từ "
           "dữ liệu từng từ - KHÔNG phải app tự công nhận, xem cột '% đúng (ước tính)'). "
           "'🔸 Đang học' = đã đụng 1 vài từ, chưa đủ để kết luận. '⚪ Chưa học' = chưa đụng gì.",
        9: "% điểm CAO NHẤT người này từng đạt ở bài kiểm tra cuối Block (có thể đã thi lại "
           "nhiều lần, đây là lần điểm cao nhất). Trống = chưa thi chính thức lần nào.",
        10: "✅ = đã Pass ≥80% Ở BÀI THI CHÍNH THỨC trong app -> Block tính là DONE THẬT, mới "
            "vào chu kỳ ôn Tony Buzan (3 cột bên phải). Ước tính (cột Trạng thái) KHÔNG tự "
            "động làm cột này thành ✅ - phải tự vào app thi mới tính.",
        11: "Đã ôn ĐÚNG HẠN xong bao nhiêu lần theo Tony Buzan (0 = vừa Done, chưa ôn lần nào; "
            "6 = đã ôn đủ hết, vào trí nhớ dài hạn). Chỉ có giá trị khi đã Done chính thức.",
        12: "Ngày/giờ HẸN ôn lại kế tiếp (theo đúng chu kỳ Tony Buzan: 10 phút -> 24 giờ -> 1 "
            "tuần -> 1 tháng -> 3 tháng -> 6 tháng).",
        13: "⚠️ TRỄ = đã QUÁ ngày hẹn ở cột trước mà chưa ôn lại.",
        14: "Số từ trong Block người này ĐÃ TỪNG làm bài / tổng số từ Block đó có - VD '7/10' "
            "= còn 3 từ chưa đụng tới lần nào.",
        15: "Tỉ lệ đúng THEO TỪNG TỪ (số lần đúng / tổng số lần thử, cộng dồn mọi từ trong "
            "Block) - CHỈ tính khi đã ôn ĐỦ HẾT mọi từ (cột trước = x/x). Đây là số liệu ƯỚC "
            "TÍNH riêng của report, KHÔNG phải điểm bài thi chính thức của app.",
    }
    _write_headers_with_notes(ws4, bd_headers, bd_notes)
    block_rows_sorted = sorted(block_rows, key=lambda r: (r["user"].lower(), r["chain"]))
    for i, r in enumerate(block_rows_sorted):
        r_idx = i + 2
        vals = [r["user"]] + list(r["chain"]) + [
            r["status"], r["best_score"], "✅" if r["passed"] else "", r["cycle"],
            r["next_review_at"], "", f"{r['words_touched']}/{r['words_total']}",
            (f"{r['est_ratio']*100:.0f}%" if r["est_ratio"] is not None else ""),
        ]
        for c, v in enumerate(vals, start=1):
            ws4.cell(row=r_idx, column=c, value=v)
        _style_row(ws4, r_idx, len(bd_headers), banded=(i % 2 == 1))
        c_od = ws4.cell(row=r_idx, column=13, value="⚠️ TRỄ" if r["overdue"] else "")
        if r["overdue"]:
            c_od.fill = OVERDUE_FILL
            c_od.font = OVERDUE_FONT
        elif r["passed"]:
            ws4.cell(row=r_idx, column=8).font = Font(name="Calibri", bold=True, color=GREEN_TXT)
        elif r["est_pass"]:
            ws4.cell(row=r_idx, column=8).font = Font(name="Calibri", bold=True, color="B37A1E")
    bd_widths = [16, 14, 14, 14, 18, 10, 10, 28, 12, 13, 10, 15, 11, 11, 12]
    for i, w in enumerate(bd_widths, start=1):
        ws4.column_dimensions[get_column_letter(i)].width = w
    ws4.freeze_panes = "A2"
    ws4.auto_filter.ref = f"A1:{get_column_letter(len(bd_headers))}{len(block_rows_sorted) + 1}"
    ws4.sheet_view.showGridLines = False

    # Sheet ghi chú - đọc liền mạch cả bảng 1 lần, khỏi phải rê chuột từng ô.
    # Giải thích chi tiết hơn cũng có ở CHÚ THÍCH gắn trên từng ô tiêu đề.
    ws2 = wb.create_sheet("Ghi chú")
    ws2.sheet_view.showGridLines = False
    ws2.column_dimensions["A"].width = 100
    notes_txt = [
        f"Xuất lúc: {datetime.datetime.now():%Y-%m-%d %H:%M}",
        "(Giải thích chi tiết hơn: di chuột vào TỪNG Ô TIÊU ĐỀ ở sheet 'Người học'/'Chi tiết Từ'/'Chi tiết Block' - có sẵn ghi chú riêng cho mỗi cột.)",
        "",
        "• Cột 'Tên': bấm vào MỞ THẲNG link học của đúng người đó (không cần mật khẩu/email).",
        "• Cột 'Link truy cập': y hệt link ở cột Tên, dạng chữ thường để copy gửi qua Zalo/tin nhắn.",
        "• 'Từ đã thuộc': số từ được tool tự đánh dấu ĐÃ THUỘC (>=80% đúng, >=3 lần thử - xem MASTER_THRESHOLD/MASTER_MIN_ATTEMPTS trong js/config.js).",
        "• 'Block đã đạt bài thi': PASS ≥80% ở bài kiểm tra cuối Block = Block tính là DONE - chỉ Block Done mới được tính vào chu kỳ ôn Tony Buzan bên dưới.",
        "• 4 cột 'Lần 1–2/3/4/5–6': số Block hiện đang ở ĐÚNG giai đoạn ôn đó (chưa đến hạn ôn lại) - xem js/srs.js.",
        "• 'Đã vào trí nhớ dài hạn': Block đã ôn đủ hết 6 lần theo Tony Buzan, coi như xong hẳn.",
        "• '⚠️ Block TRỄ HẠN ôn': trong số Block đang ở 4 giai đoạn trên, bao nhiêu cái đã QUÁ NGÀY hẹn ôn lại mà chưa ôn - CÀNG NHIỀU càng cần nhắc người học ôn lại sớm.",
        "",
        "• Sheet 'Chi tiết Từ': 1 dòng/1 người học x 1 từ đã từng làm bài - đúng mấy lần/sai mấy lần, đã thuộc chưa, mức quen, lần ôn gần nhất. KHÔNG tính điểm.",
        "• Sheet 'Chi tiết Block': 1 dòng/1 người học x 1 Block đã học - điểm bài thi cao nhất, đã Done (Pass ≥80%) chưa, đang ở chu kỳ ôn nào, có trễ hạn không.",
        "",
        "⚠️ FILE NÀY CHỨA LINK ĐĂNG NHẬP THẬT - không đẩy lên GitHub/chia sẻ công khai, chỉ gửi RIÊNG cho đúng người trong link đó.",
    ]
    for i, line in enumerate(notes_txt, start=1):
        ws2.cell(row=i, column=1, value=line).font = Font(name="Calibri", color=INK, size=11)

    # Đặt "Người học" (tổng quan) làm sheet mở đầu tiên khi mở file - sắp
    # lại thứ tự tab cho khoa học: Người học -> Chi tiết Từ -> Chi tiết
    # Block -> Ghi chú (đọc từ tổng quan xuống chi tiết, ghi chú để cuối).
    wb._sheets = [ws, ws3, ws4, ws2]
    wb.active = 0

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
