"""
================================================================================
 backfill_names.py — ĐIỀN TÊN DỊCH SẴN (name_en/name_zh) cho Hub/Notebook/
 Section/Page/Batch
================================================================================
 TJ yêu cầu 2026-09-13: "đổi cờ là phải đồng bộ ... các Page nếu đang có
 tên tiếng Việt thì đổi qua luôn" — khi đổi giao diện sang en/zh, TÊN CÂY
 THƯ MỤC (Hub/Notebook/Section/Page/Batch — KHÁC hẳn từ vựng/bài đọc, đây
 là tên NGƯỜI DÙNG TỰ ĐẶT) cũng phải đổi theo, không chỉ khung menu/nút.

 Script này quét 5 bảng (hubs, notebooks, sections, pages, batches), với
 mỗi dòng còn thiếu name_en HOẶC name_zh thì gọi Gemini dịch CẢ 2 ngôn ngữ
 cùng lúc (1 lượt gọi ra cả EN+ZH, đỡ tốn gấp đôi số lượt so với dịch
 riêng từng ngôn ngữ). Tên vốn ĐÃ LÀ tiếng Anh/mã viết tắt/tên riêng (rất
 nhiều Notebook đặt tên kiểu "TOEIC 700+", "AEF3", "COLLOCATION"...) thì
 AI được dặn GIỮ NGUYÊN cho name_en, chỉ thật sự dịch nếu tên là tiếng
 Việt có nghĩa.

 AN TOÀN — chạy lại bao nhiêu lần cũng được (idempotent): chỉ lấy đúng
 dòng còn thiếu 1 trong 2 cột, không đụng dòng đã có sẵn cả 2.

 CÁCH DÙNG:
   python3 tools/backfill_names.py              (điền hết 5 bảng)
   python3 tools/backfill_names.py --table pages (chỉ 1 bảng, test thử)
   python3 tools/backfill_names.py --limit 50    (test thử 50 dòng/bảng)
================================================================================
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import requests

HERE = Path(__file__).resolve().parent
CONFIG_JS_PATH = HERE.parent / "js" / "config.js"


def _read_config_js():
    text = CONFIG_JS_PATH.read_text(encoding="utf-8")
    url_m = re.search(r'SUPABASE_URL:\s*"([^"]+)"', text)
    key_m = re.search(r'SUPABASE_ANON_KEY:\s*"([^"]+)"', text)
    if not url_m or not key_m or not url_m.group(1) or not key_m.group(1):
        sys.exit(f"❌ {CONFIG_JS_PATH} đang trống SUPABASE_URL/KEY — chạy từ thư mục TJHUB gốc.")
    return url_m.group(1).rstrip("/"), key_m.group(1)


SUPABASE_URL, SUPABASE_ANON_KEY = _read_config_js()
REST_URL = SUPABASE_URL + "/rest/v1"
PROXY_URL = SUPABASE_URL + "/functions/v1/gemini-proxy"
HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}

TABLES = ["hubs", "notebooks", "sections", "pages", "batches"]
BATCH = 60  # tên ngắn hơn nhiều so với nghĩa từ vựng -> gộp được nhiều hơn/lượt


def fetch_missing(table, limit=None):
    rows = []
    offset = 0
    while True:
        headers = dict(HEADERS)
        headers["Range-Unit"] = "items"
        headers["Range"] = f"{offset}-{offset + 999}"
        r = requests.get(f"{REST_URL}/{table}", headers=headers, params={
            "select": "id,name,name_en,name_zh",
            "or": "(name_en.eq.,name_zh.eq.)"
        }, timeout=30)
        r.raise_for_status()
        chunk = r.json()
        rows.extend(chunk)
        if limit and len(rows) >= limit:
            return rows[:limit]
        if len(chunk) < 1000:
            break
        offset += 1000
    return rows


def call_gemini(sys_prompt, user_prompt):
    body = {"model": "gemini-3.5-flash-lite", "sys": sys_prompt, "user": user_prompt}
    last_err = None
    for attempt in range(3):
        if attempt > 0:
            time.sleep(1.5 * (2 ** (attempt - 1)))
        try:
            r = requests.post(PROXY_URL, headers=HEADERS, json=body, timeout=60)
        except requests.RequestException as e:
            last_err = e
            continue
        if r.status_code == 200:
            data = r.json()
            cand = (data.get("candidates") or [{}])[0]
            text = (cand.get("content") or {}).get("parts", [{}])[0].get("text")
            if text:
                return text
            last_err = RuntimeError("Gemini trả về rỗng")
        else:
            last_err = RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
            if r.status_code not in (429, 503):
                break
    raise last_err


def process_batch(rows):
    listing = "\n".join(f'{i + 1}. "{r["name"]}"' for i, r in enumerate(rows))
    sys_p = ("Bạn là dịch giả tên gọi ngắn (tiêu đề thư mục/khoá học) cho app học tiếng Anh. "
             "Trả lời DUY NHẤT 1 object JSON đúng schema, không thêm chữ nào khác, không dùng "
             "markdown code fence.")
    user_p = (
        f"Dưới đây là {len(rows)} TÊN THƯ MỤC/KHOÁ HỌC (Hub/Notebook/Section/Page/Batch trong 1 app "
        f"học từ vựng tiếng Anh) đã đánh số. Với MỖI tên, cho 2 bản: name_en (tiếng Anh) và name_zh "
        f"(tiếng Trung giản thể).\n"
        f"QUY TẮC quan trọng:\n"
        f"- Nếu tên ĐÃ LÀ tiếng Anh, hoặc là MÃ/VIẾT TẮT/TÊN RIÊNG không mang nghĩa cần dịch (vd "
        f"\"TOEIC 700+\", \"AEF3\", \"COLLOCATION\", \"UPPER\", \"BR\", số thứ tự...) thì name_en GIỮ "
        f"NGUYÊN VĂN y hệt bản gốc, KHÔNG bịa ra bản dịch khác.\n"
        f"- Nếu tên là tiếng Việt CÓ NGHĨA THẬT (vd \"Bắt đầu\", \"Chưa đặt tên\"), dịch tự nhiên, "
        f"ngắn gọn, đúng văn phong tiêu đề/tên thư mục sang tiếng Anh.\n"
        f"- name_zh: LUÔN dịch hoặc phiên âm ngắn gọn sang tiếng Trung giản thể (kể cả tên riêng/mã "
        f"— phiên âm Hán Việt hoặc giữ nguyên chữ cái Latin nếu là mã kỹ thuật như \"AEF3\").\n\n"
        f"DANH SÁCH:\n{listing}\n\n"
        f"Trả về ĐÚNG THEO THỨ TỰ đã đánh số, đủ {len(rows)} mục, không bỏ mục nào:\n"
        '{"names":[{"en":"...","zh":"..."},{"en":"...","zh":"..."},...]}'
    )
    raw = call_gemini(sys_p, user_p)
    parsed = json.loads(raw)
    return parsed.get("names", [])


def patch_row(table, row_id, name_en, name_zh):
    body = {}
    if name_en:
        body["name_en"] = name_en
    if name_zh:
        body["name_zh"] = name_zh
    if not body:
        return
    r = requests.patch(
        f"{REST_URL}/{table}", headers=HEADERS, params={"id": f"eq.{row_id}"},
        json=body, timeout=30
    )
    r.raise_for_status()


def process_table(table, limit=None):
    print(f"\n=== Bảng: {table} ===")
    rows = fetch_missing(table, limit)
    print(f"Số dòng cần điền: {len(rows)}")
    if not rows:
        print("✅ Không còn dòng nào thiếu.")
        return 0, 0

    done, failed_batches = 0, 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        try:
            results = process_batch(chunk)
        except Exception as e:
            print(f"  ⚠️ Lỗi batch {i // BATCH + 1}: {e} — bỏ qua batch này")
            failed_batches += 1
            continue
        for r, res in zip(chunk, results):
            en = (res or {}).get("en") or ""
            zh = (res or {}).get("zh") or ""
            # chỉ điền cột đang trống, không ghi đè cột đã có sẵn (idempotent)
            new_en = en if not r.get("name_en") else None
            new_zh = zh if not r.get("name_zh") else None
            if new_en is None and new_zh is None:
                continue
            try:
                patch_row(table, r["id"], new_en, new_zh)
                done += 1
            except Exception as e:
                print(f"  ⚠️ Lỗi lưu '{r['name']}': {e}")
        print(f"  Tiến độ: {min(i + BATCH, len(rows))}/{len(rows)} · đã điền: {done}")

    print(f"✅ Xong bảng {table}: {done}/{len(rows)} dòng"
          + (f" ({failed_batches} batch lỗi, chạy lại sẽ tự thử phần còn thiếu)." if failed_batches else "."))
    return done, len(rows)


def main():
    ap = argparse.ArgumentParser(description="Điền tên dịch sẵn (name_en/name_zh) cho Hub/Notebook/Section/Page/Batch.")
    ap.add_argument("--table", choices=TABLES, default=None, help="Chỉ xử lý 1 bảng (mặc định: cả 5 bảng)")
    ap.add_argument("--limit", type=int, default=None, help="Giới hạn số dòng/bảng (test thử)")
    args = ap.parse_args()

    print(f"📡 Kết nối Supabase: {SUPABASE_URL}")
    tables = [args.table] if args.table else TABLES
    total_done, total_rows = 0, 0
    for t in tables:
        d, n = process_table(t, args.limit)
        total_done += d
        total_rows += n

    print(f"\n✅ HOÀN TẤT TẤT CẢ: {total_done}/{total_rows} dòng đã có tên dịch.")


if __name__ == "__main__":
    main()
