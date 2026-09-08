"""
================================================================================
 sync_vocab.py — KÉO/ĐẨY TỪ VỰNG QUA LẠI GIỮA SUPABASE VÀ EXCEL
================================================================================
 BẢN 2026-09-07 (v1)

 2 CHIỀU, chọn bằng MODE bên dưới:

   MODE = "export"  ->  Kéo TOÀN BỘ từ vựng (kèm ngữ cảnh Hub/Notebook/
                         Section/Page/Batch/Block cho dễ nhìn) từ Supabase
                         xuống 1 file Excel để xem/sửa tay thoải mái.

   MODE = "import"  ->  Đọc LẠI file Excel đó (đã sửa xong), đẩy NGƯỢC lên
                         Supabase. Ghép theo cột "id" (word id):
                           - Có "id" khớp từ cũ  -> CẬP NHẬT từ đó (ghi đè
                             term/level/pos/ipa/def_en/meaning_vi/sort).
                           - "id" ĐỂ TRỐNG        -> TẠO TỪ MỚI (bắt buộc
                             phải điền "block_id" - biết thêm vào Block
                             nào - lấy từ đúng cột "block_id" của 1 dòng
                             khác trong CÙNG Block đó, copy xuống).
                         XOÁ HẲN 1 dòng khỏi Excel KHÔNG xoá từ đó trên
                         Supabase (an toàn - tool không tự xoá dữ liệu,
                         muốn xoá từ thật thì tự vào Supabase Table Editor).

 QUY TRÌNH DÙNG:
   1. Sửa MODE = "export" bên dưới, chạy: python tools/sync_vocab.py
      -> ra file Excel NGAY TRONG tools/tu_vung.xlsx (chung thư mục với
      file .py này, đường dẫn cũng in ra ở dòng cuối cùng).
   2. Mở Excel, sửa tay (đổi nghĩa, thêm dòng mới cho từ mới...).
   3. Sửa MODE = "import", chạy lại: python tools/sync_vocab.py
      -> đẩy thẳng lên Supabase.
   4. Đổi lại MODE = "export" và chạy lại bất cứ lúc nào để lấy bản MỚI
      NHẤT (VD sau khi có người học thêm/sửa qua chính app).

 ⚠️ File Excel này CHỈ chứa nội dung học (không phải link đăng nhập như
 manage_users.py) nên không nhạy cảm - nhưng vẫn lưu cục bộ (tools/tu_vung.xlsx,
 đã có trong .gitignore), không cần đẩy lên GitHub.

 MÀU TIÊU ĐỀ CỘT (xem ngay trong file Excel):
   🟧 CAM  = sửa/xoá nội dung cột này -> CÓ ẩnh hưởng thật khi import lên
             Supabase (kể cả xoá trống 1 trong 3 ô "Đoạn văn đề xuất" -
             xem chi tiết ở phần "Ghi chú" trong chính file Excel).
   🟦 XANH = chỉ để XEM cho dễ đối chiếu (Hub/Notebook/.../Block/Từ trong
             Block) - sửa gì ở các cột này cũng KHÔNG ảnh hưởng lúc import.
================================================================================
"""

import datetime
import re
import sys
import uuid
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import requests
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

# ==============================================================================
# CONFIG — SỬA CHỖ NÀY
# ==============================================================================

MODE = "export"   # "export" (Supabase -> Excel) hoặc "import" (Excel -> Supabase)

# CHUNG thư mục với sync_vocab.py (tools/) - không để trong thư mục con
# nào cả, theo yêu cầu Thao, cho dễ tìm.
EXCEL_FILE = Path(__file__).resolve().parent / "tu_vung.xlsx"

# import mode: số dòng gửi lên Supabase mỗi lượt (PostgREST upsert theo lô,
# tránh gửi 1 lần cả ~7000 dòng dễ bị timeout/lỗi payload quá lớn).
IMPORT_BATCH_SIZE = 300

AUTO_OPEN_EXCEL = True

# ==============================================================================
# LẤY URL + ANON KEY TỪ js/config.js (y hệt manage_users.py)
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

WORD_COLS = ["id", "block_id", "sort", "term", "level", "pos", "ipa", "def_en", "meaning_vi"]


def fetch_all(table, select, page_size=1000):
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


# ==============================================================================
# EXPORT: Supabase -> Excel
# ==============================================================================

HEADER_FILL = PatternFill("solid", fgColor="4472C4")      # xanh dương - chỉ để xem, sửa không ảnh hưởng
IMPACT_FILL = PatternFill("solid", fgColor="ED7D31")       # cam - sửa/xoá CÓ ảnh hưởng thật lên Supabase
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF")
ID_FONT = Font(name="Arial", size=9, color="999999")


def _write_headers(ws, headers, impact_cols):
    """impact_cols: set các SỐ CỘT (1-based) mà sửa/xoá trong Excel sẽ THẬT
    SỰ ảnh hưởng lên Supabase lúc import - tô CAM để nổi bật, phân biệt với
    các cột chỉ để xem (Hub/Notebook/.../Block...) tô XANH như cũ."""
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = IMPACT_FILL if i in impact_cols else HEADER_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def do_export():
    print("Đang tải dữ liệu từ Supabase (hubs -> ... -> words)...")
    hubs = {h["id"]: h for h in fetch_all("hubs", "id,name")}
    notebooks = {n["id"]: n for n in fetch_all("notebooks", "id,hub_id,name")}
    sections = {s["id"]: s for s in fetch_all("sections", "id,notebook_id,name")}
    pages = {p["id"]: p for p in fetch_all("pages", "id,section_id,name")}
    batches = {b["id"]: b for b in fetch_all("batches", "id,page_id,name")}
    blocks = {b["id"]: b for b in fetch_all(
        "blocks", "id,batch_id,name,sort,context_passage,context_passage_candidates")}
    words = fetch_all("words", ",".join(WORD_COLS))
    print(f"  -> {len(words)} từ, {len(blocks)} block, {len(batches)} batch, "
          f"{len(pages)} page, {len(sections)} section, {len(notebooks)} notebook, {len(hubs)} hub.")

    def _chain_of(block_id):
        """Trả về (hub_name, notebook_name, section_name, page_name, batch_name, block_name)
        cho 1 block - đi ngược lên hết chuỗi cha, để trống nếu đứt đoạn ở
        đâu đó (dữ liệu lỗi/mồ côi) thay vì crash cả script."""
        blk = blocks.get(block_id, {})
        bat = batches.get(blk.get("batch_id"), {})
        pg = pages.get(bat.get("page_id"), {})
        sec = sections.get(pg.get("section_id"), {})
        nb = notebooks.get(sec.get("notebook_id"), {})
        hub = hubs.get(nb.get("hub_id"), {})
        return (hub.get("name", ""), nb.get("name", ""), sec.get("name", ""),
                pg.get("name", ""), bat.get("name", ""), blk.get("name", ""))

    EXCEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Từ vựng"

    headers = ["id (ĐỂ TRỐNG = tạo từ mới)", "block_id (bắt buộc nếu tạo mới)",
               "Hub", "Notebook", "Section", "Page", "Batch", "Block",
               "sort", "term", "level", "pos", "ipa", "def_en", "meaning_vi"]
    # Cột 3-8 (Hub..Block) CHỈ để xem - import không đọc lại. Còn lại (id,
    # block_id, sort, term, level, pos, ipa, def_en, meaning_vi) đều được
    # gửi thẳng lên Supabase mỗi lần import.
    _write_headers(ws, headers, impact_cols={1, 2, 9, 10, 11, 12, 13, 14, 15})

    # Sort theo đúng thứ tự cây (hub > notebook > ... > block > sort trong
    # block) cho dễ đọc/đối chiếu, thay vì thứ tự ngẫu nhiên Supabase trả về.
    def _sort_key(w):
        chain = _chain_of(w.get("block_id"))
        return chain + (w.get("sort") or 0,)

    words.sort(key=_sort_key)

    for r_idx, w in enumerate(words, start=2):
        chain = _chain_of(w.get("block_id"))
        c_id = ws.cell(row=r_idx, column=1, value=w.get("id"))
        c_id.font = ID_FONT
        c_bid = ws.cell(row=r_idx, column=2, value=w.get("block_id"))
        c_bid.font = ID_FONT
        for i, v in enumerate(chain, start=3):
            ws.cell(row=r_idx, column=i, value=v)
        ws.cell(row=r_idx, column=9, value=w.get("sort"))
        ws.cell(row=r_idx, column=10, value=w.get("term"))
        ws.cell(row=r_idx, column=11, value=w.get("level"))
        ws.cell(row=r_idx, column=12, value=w.get("pos"))
        ws.cell(row=r_idx, column=13, value=w.get("ipa"))
        ws.cell(row=r_idx, column=14, value=w.get("def_en"))
        ws.cell(row=r_idx, column=15, value=w.get("meaning_vi"))

    widths = [26, 26, 16, 16, 16, 20, 12, 12, 6, 22, 8, 8, 16, 40, 30]
    for i, wd in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = wd
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(words) + 1}"

    # Từ vựng của TỪNG Block (theo đúng thứ tự "sort") - để hiện cột tóm
    # tắt bên sheet "Bài đọc", giúp viết/đối chiếu bài đọc có đủ từ cần
    # thiết mà không phải mở lại sheet "Từ vựng" tra riêng.
    words_by_block = {}
    for w_ in words:
        words_by_block.setdefault(w_.get("block_id"), []).append(w_)
    for lst in words_by_block.values():
        lst.sort(key=lambda w_: w_.get("sort") or 0)

    # Sheet "Bài đọc" - 1 dòng/1 BLOCK (khác sheet "Từ vựng" là 1 dòng/1
    # TỪ). context_passage = bài đang THẬT SỰ dùng để học (chỉ có ĐÚNG 1);
    # context_passage_candidates (JSONB, mảng tối đa 3 chuỗi) = các bài đọc
    # ỨNG CỬ chưa chọn - tách riêng thành 3 cột "Đoạn văn đề xuất 1/2/3" để
    # Thao/Claude điền tay từng ô, KHÔNG cần biết cú pháp JSON. Xem CLAUDE.md
    # mục quy trình viết bài đọc để biết yêu cầu nội dung mỗi bài.
    ws3 = wb.create_sheet("Bài đọc")
    ba_headers = ["id (block id - GIỮ NGUYÊN)", "Hub", "Notebook", "Section", "Page",
                  "Batch", "Block", "Từ trong Block (tham khảo khi viết bài đọc)",
                  "Bài đọc ĐANG DÙNG (context_passage)",
                  "Đoạn văn đề xuất 1", "Đoạn văn đề xuất 2", "Đoạn văn đề xuất 3"]
    # Cột 2-8 (Hub..Từ trong Block) CHỈ để xem. Cột 1 (id) + 9-12 (bài đọc
    # đang dùng + 3 ô đề xuất) đều được đọc lại lúc import - riêng 3 ô đề
    # xuất LUÔN đi CHUNG BỘ (xoá 1 trong 3 ô, còn ô khác có chữ, vẫn ghi đè
    # lại nguyên mảng - xem do_import_passages) nên cũng tô CAM cả 3.
    _write_headers(ws3, ba_headers, impact_cols={1, 9, 10, 11, 12})

    block_list = sorted(blocks.values(), key=lambda b: _chain_of(b["id"]) + (b.get("sort") or 0,))
    for r_idx, blk in enumerate(block_list, start=2):
        chain = _chain_of(blk["id"])
        c_id = ws3.cell(row=r_idx, column=1, value=blk["id"])
        c_id.font = ID_FONT
        for i, v in enumerate(chain, start=2):
            ws3.cell(row=r_idx, column=i, value=v)

        terms = ", ".join(w_.get("term") or "" for w_ in words_by_block.get(blk["id"], []))
        ws3.cell(row=r_idx, column=8, value=terms)

        ws3.cell(row=r_idx, column=9, value=blk.get("context_passage") or "")

        candidates = blk.get("context_passage_candidates") or []
        for slot in range(3):
            val = candidates[slot] if slot < len(candidates) else ""
            ws3.cell(row=r_idx, column=10 + slot, value=val)

        for c in range(1, len(ba_headers) + 1):
            ws3.cell(row=r_idx, column=c).alignment = Alignment(vertical="top", wrap_text=True)

    ba_widths = [26, 14, 14, 14, 18, 10, 10, 40, 55, 55, 55, 55]
    for i, wd in enumerate(ba_widths, start=1):
        ws3.column_dimensions[get_column_letter(i)].width = wd
    ws3.row_dimensions[1].height = 30
    ws3.freeze_panes = "B2"
    ws3.auto_filter.ref = f"A1:{get_column_letter(len(ba_headers))}{len(block_list) + 1}"

    ws2 = wb.create_sheet("Ghi chú")
    ws2.column_dimensions["A"].width = 100
    notes = [
        f"Xuất lúc: {datetime.datetime.now():%Y-%m-%d %H:%M}",
        "",
        "• Sửa tay các cột term/level/pos/ipa/def_en/meaning_vi/sort thoải mái - lưu file lại rồi",
        "  đổi MODE = \"import\" trong sync_vocab.py, chạy lại là đẩy hết lên Supabase.",
        "• Cột 'id': GIỮ NGUYÊN với từ đã có (đừng sửa/xoá) - đây là chìa khoá để tool biết CẬP",
        "  NHẬT đúng từ nào. Để TRỐNG ở 1 dòng MỚI TỰ THÊM -> tool hiểu là TẠO TỪ MỚI.",
        "• Cột 'block_id': BẮT BUỘC điền nếu 'id' để trống (tạo mới) - copy y hệt block_id của",
        "  1 dòng khác đã có sẵn trong CÙNG Block muốn thêm từ vào, đừng tự gõ tay.",
        "• Cột Hub/Notebook/Section/Page/Batch/Block: CHỈ để xem cho dễ đối chiếu, tool KHÔNG",
        "  đọc lại mấy cột này lúc import (sửa cũng không ảnh hưởng gì) - muốn đổi Block của 1",
        "  từ thì sửa đúng cột 'block_id'.",
        "• XOÁ HẲN 1 dòng khỏi Excel KHÔNG xoá từ đó trên Supabase - tool chỉ THÊM/CẬP NHẬT,",
        "  không tự xoá gì cả (an toàn). Muốn xoá từ thật thì vào Supabase Table Editor xoá tay.",
        "",
        "• Sheet 'Bài đọc': 1 dòng/1 BLOCK (khác sheet 'Từ vựng' là 1 dòng/1 TỪ).",
        "• Cột 'Từ trong Block': CHỈ để xem, tự lấy từ sheet 'Từ vựng' - viết bài đọc phải LỒNG",
        "  ĐỦ các từ này vào (đánh dấu bằng [ngoặc vuông] quanh cụm từ đó) - xem quy trình viết",
        "  bài đọc chi tiết trong CLAUDE.md.",
        "• 3 cột 'Đoạn văn đề xuất 1/2/3': ô nào ĐANG TRỐNG (chưa có bài) thì tự viết/dán vào -",
        "  KHÔNG cần sửa ô đã có sẵn nội dung. Import lại sẽ tự gộp 3 ô này thành đúng danh sách",
        "  bài đọc ứng cử trên Supabase (bỏ qua ô nào vẫn để trống, không chèn dòng rỗng).",
        "• Cột 'Bài đọc ĐANG DÙNG': đây là bài THẬT SỰ hiện lên khi học (chỉ 1 bài/Block) - để",
        "  trống thì KHÔNG đụng gì tới bài đang dùng hiện tại trên Supabase.",
    ]
    for i, line in enumerate(notes, start=1):
        ws2.cell(row=i, column=1, value=line).font = Font(name="Arial", size=11)

    wb.save(EXCEL_FILE)
    print(f"✅ Đã xuất: {EXCEL_FILE}")


# ==============================================================================
# IMPORT: Excel -> Supabase
# ==============================================================================

def do_import():
    if not EXCEL_FILE.exists():
        sys.exit(f"❌ Không thấy file {EXCEL_FILE} - chạy MODE=\"export\" trước đã.")

    wb = load_workbook(EXCEL_FILE, data_only=True)
    ws = wb["Từ vựng"]

    header_row = [c.value for c in ws[1]]

    def _col(name_prefix):
        for i, h in enumerate(header_row):
            if h and str(h).startswith(name_prefix):
                return i
        return None

    idx = {
        "id": _col("id"), "block_id": _col("block_id"),
        "sort": header_row.index("sort"), "term": header_row.index("term"),
        "level": header_row.index("level"), "pos": header_row.index("pos"),
        "ipa": header_row.index("ipa"), "def_en": header_row.index("def_en"),
        "meaning_vi": header_row.index("meaning_vi"),
    }

    rows_out = []
    n_new = n_update = n_skipped = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        term = r[idx["term"]]
        if not term:
            continue  # dòng trống hoàn toàn - bỏ qua

        word_id = r[idx["id"]]
        block_id = r[idx["block_id"]]
        if not word_id:
            if not block_id:
                n_skipped += 1
                print(f"  ⚠️ BỎ QUA '{term}': không có id (từ mới) NHƯNG cũng thiếu block_id "
                      "- không biết thêm vào Block nào.")
                continue
            word_id = str(uuid.uuid4())
            n_new += 1
        else:
            n_update += 1

        rows_out.append({
            "id": word_id,
            "block_id": block_id,
            "sort": r[idx["sort"]],
            "term": term,
            "level": r[idx["level"]],
            "pos": r[idx["pos"]],
            "ipa": r[idx["ipa"]],
            "def_en": r[idx["def_en"]],
            "meaning_vi": r[idx["meaning_vi"]],
        })

    print(f"Đọc được {len(rows_out)} dòng hợp lệ ({n_update} cập nhật, {n_new} tạo mới, "
          f"{n_skipped} bị bỏ qua vì thiếu dữ liệu).")
    if not rows_out:
        print("Không có gì để đẩy lên - dừng.")
        return

    headers = dict(HEADERS)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    for i in range(0, len(rows_out), IMPORT_BATCH_SIZE):
        batch = rows_out[i:i + IMPORT_BATCH_SIZE]
        r = requests.post(f"{REST_URL}/words", headers=headers, json=batch, timeout=60)
        if not r.ok:
            sys.exit(f"❌ Lỗi đẩy lô {i}-{i + len(batch)}: {r.status_code} {r.text}")
        print(f"  -> Đã đẩy {i + len(batch)}/{len(rows_out)} dòng...")

    print("✅ Xong (từ vựng)! Đã đồng bộ lên Supabase.")

    do_import_passages(wb)


def do_import_passages(wb):
    """Đẩy sheet 'Bài đọc' (bài đọc ĐANG DÙNG + 3 ô "Đoạn văn đề xuất") lên
    Supabase - sheet này không bắt buộc phải có (file Excel xuất từ bản cũ
    trước khi thêm sheet này vẫn chạy được, chỉ bỏ qua bước này). CHỈ PATCH
    đúng cột có dữ liệu trong Excel:
      - "Bài đọc ĐANG DÙNG" trống -> KHÔNG đụng context_passage cũ.
      - CẢ 3 ô "Đoạn văn đề xuất 1/2/3" đều trống -> KHÔNG đụng
        context_passage_candidates cũ (giữ nguyên các bài đã có sẵn) - chỉ
        cần ĐIỀN ĐÚNG các ô đang TRỐNG (chưa viết), KHÔNG cần điền lại ô đã
        có sẵn nội dung.
    3 ô -> gộp lại thành mảng JSON (context_passage_candidates) theo ĐÚNG
    thứ tự 1/2/3, bỏ qua ô nào trống ở giữa (VD ô 1+3 có, ô 2 trống thì mảng
    chỉ còn 2 phần tử - không chèn chuỗi rỗng vào giữa)."""
    if "Bài đọc" not in wb.sheetnames:
        print("(Không thấy sheet 'Bài đọc' trong file - bỏ qua, có thể file xuất từ bản cũ hơn.)")
        return

    ws = wb["Bài đọc"]
    header_row = [c.value for c in ws[1]]

    def _col(name_prefix):
        for i, h in enumerate(header_row):
            if h and str(h).startswith(name_prefix):
                return i
        return None

    idx_id = _col("id")
    idx_passage = _col("Bài đọc ĐANG DÙNG")
    idx_slots = [_col("Đoạn văn đề xuất 1"), _col("Đoạn văn đề xuất 2"), _col("Đoạn văn đề xuất 3")]

    n_updated = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        block_id = row[idx_id]
        if not block_id:
            continue

        body = {}
        passage = row[idx_passage] if idx_passage is not None else None
        if passage:
            body["context_passage"] = passage

        candidates = [row[i].strip() for i in idx_slots if i is not None and row[i] and str(row[i]).strip()]
        if candidates:
            body["context_passage_candidates"] = candidates

        if not body:
            continue  # không có gì để cập nhật - giữ nguyên dữ liệu cũ

        r = requests.patch(f"{REST_URL}/blocks", headers=HEADERS,
                            params={"id": f"eq.{block_id}"}, json=body, timeout=30)
        if not r.ok:
            print(f"  ⚠️ Lỗi cập nhật bài đọc block {block_id}: {r.status_code} {r.text}")
            continue
        n_updated += 1

    print(f"✅ Xong (bài đọc)! Đã cập nhật {n_updated} block.")


# ==============================================================================
# CHẠY
# ==============================================================================

def run():
    print(f"📡 Supabase: {SUPABASE_URL}  —  MODE = {MODE}")
    if MODE == "export":
        do_export()
        if AUTO_OPEN_EXCEL:
            try:
                import os
                os.startfile(str(EXCEL_FILE))
            except Exception as e:
                print(f"  (Không tự mở được Excel: {e})")
    elif MODE == "import":
        do_import()
    else:
        sys.exit('❌ MODE phải là "export" hoặc "import".')


if __name__ == "__main__":
    run()
