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
      "đăng nhập qua link"), rồi xuất 1 file Excel liệt kê TẤT CẢ người học
      hiện có: tên (bấm vào mở thẳng link học), link đầy đủ, số từ đã
      thuộc, số Block đã đạt bài thi, đang ở giai đoạn nào trong 4 giai
      đoạn ôn tập Tony Buzan, và có bao nhiêu Block đang TRỄ HẠN ôn.

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


def build_stats():
    profiles, _ = sb_get("profiles", {"select": "id,display_name,avatar_emoji", "order": "display_name.asc"})
    word_progress = fetch_all("word_progress", "user_id,mastered")
    block_progress = fetch_all("block_progress", "user_id,passed,cycle,next_review_at")
    _, total_words = sb_get("words", {"select": "id"}, exact_count=True)
    _, total_blocks = sb_get("blocks", {"select": "id"}, exact_count=True)

    now_ms = time.time() * 1000
    stats_by_user = {}
    for p in profiles:
        stats_by_user[p["id"]] = {
            "profile": p,
            "words_touched": 0, "words_mastered": 0,
            "blocks_passed": 0,
            "group": {1: 0, 2: 0, 3: 0, 4: 0}, "long_term": 0,
            "overdue": 0,
        }

    for r in word_progress:
        s = stats_by_user.get(r["user_id"])
        if not s:
            continue
        s["words_touched"] += 1
        if r.get("mastered"):
            s["words_mastered"] += 1

    for r in block_progress:
        s = stats_by_user.get(r["user_id"])
        if not s or not r.get("passed"):
            continue
        s["blocks_passed"] += 1
        cycle = r.get("cycle") or 0
        if cycle >= MAX_CYCLE:
            s["long_term"] += 1
            continue
        s["group"][_group_of(cycle)] += 1
        next_at = r.get("next_review_at")
        if not next_at or next_at <= now_ms:
            s["overdue"] += 1

    return list(stats_by_user.values()), total_words, total_blocks


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


def write_excel(stats_list, total_words, total_blocks):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Người học"

    headers = [
        "", "Tên", "Link truy cập (gửi cho người học)",
        "Từ đã chạm", "Từ đã thuộc", f"/ {total_words} từ trong kho",
        "Block đã đạt bài thi", f"/ {total_blocks} block trong kho",
        "Lần 1–2\n(10p/24h)", "Lần 3\n(1 tuần)", "Lần 4\n(1 tháng)", "Lần 5–6\n(3–6 tháng)",
        "Đã vào\ntrí nhớ dài hạn 💎", "⚠️ Block\nTRỄ HẠN ôn",
    ]
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    stats_list = sorted(stats_list, key=lambda s: (s["profile"].get("display_name") or "").lower())
    for r_idx, s in enumerate(stats_list, start=2):
        p = s["profile"]
        link = APP_BASE_URL + "?u=" + p["id"]

        ws.cell(row=r_idx, column=1, value=p.get("avatar_emoji") or "🐣")

        c_name = ws.cell(row=r_idx, column=2, value=_hyperlink(link, p.get("display_name") or "(chưa đặt tên)"))
        c_name.font = Font(name="Arial", bold=True, color="0563C1", underline="single")

        c_link = ws.cell(row=r_idx, column=3, value=link)
        c_link.font = Font(name="Arial", size=9, color="666666")

        ws.cell(row=r_idx, column=4, value=s["words_touched"])
        ws.cell(row=r_idx, column=5, value=s["words_mastered"])
        ws.cell(row=r_idx, column=6, value=total_words)
        ws.cell(row=r_idx, column=7, value=s["blocks_passed"])
        ws.cell(row=r_idx, column=8, value=total_blocks)
        ws.cell(row=r_idx, column=9, value=s["group"][1])
        ws.cell(row=r_idx, column=10, value=s["group"][2])
        ws.cell(row=r_idx, column=11, value=s["group"][3])
        ws.cell(row=r_idx, column=12, value=s["group"][4])
        ws.cell(row=r_idx, column=13, value=s["long_term"])

        c_overdue = ws.cell(row=r_idx, column=14, value=s["overdue"])
        if s["overdue"] > 0:
            c_overdue.fill = OVERDUE_FILL
            c_overdue.font = Font(name="Arial", bold=True)

        for c in range(1, len(headers) + 1):
            ws.cell(row=r_idx, column=c).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=r_idx, column=2).alignment = Alignment(horizontal="left", vertical="center")
        ws.cell(row=r_idx, column=3).alignment = Alignment(horizontal="left", vertical="center")

    widths = [4, 20, 60, 11, 11, 13, 15, 15, 12, 11, 11, 13, 15, 12]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(stats_list) + 1}"

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
    stats_list, total_words, total_blocks = build_stats()

    print("Đang xuất Excel...")
    path = write_excel(stats_list, total_words, total_blocks)
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
