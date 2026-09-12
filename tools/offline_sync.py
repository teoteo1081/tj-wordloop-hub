"""
================================================================================
 offline_sync.py — HỌC OFFLINE rồi ĐỒNG BỘ NGƯỢC lại Supabase
================================================================================
 Dùng khi mạng tới Supabase (đặt ở Singapore) đang chậm/rớt gói (hay gặp khi
 tuyến cáp quang biển quốc tế của nhà mạng có sự cố) — thay vì mỗi thao tác
 học đều phải chờ mạng, tải hẳn 1 bản snapshot về học OFFLINE (siêu nhanh,
 không cần mạng), xong xuôi mới đẩy tiến trình mới ngược lên 1 lần.

 QUY TRÌNH ĐẦY ĐỦ (xem thêm README ở TJHUB_OFFLINE/OFFLINE_README.md):
   1. (Ở thư mục TJHUB này)      python3 tools/offline_sync.py pull --user TJ
      -> ghi ra TJHUB_OFFLINE/offline_snapshot.json
   2. (Ở thư mục TJHUB_OFFLINE)  python3 -m http.server 8935
      -> mở http://localhost:8935/offline_seed.html (nạp dữ liệu 1 lần)
      -> rồi tự chuyển vào app, học bình thường, KHÔNG cần mạng
   3. Học xong, mở http://localhost:8935/offline_export.html
      -> bấm nút tải, ra file offline_progress_export.json (vào Downloads)
   4. (Ở thư mục TJHUB này)      python3 tools/offline_sync.py push --user TJ
      -> đọc file vừa tải, đẩy NGƯỢC tiến trình mới lên Supabase (chỉ đúng
         user này, KHÔNG đụng tiến trình người khác)

 AN TOÀN: bước "push" chỉ ghi (upsert) 2 bảng word_progress/block_progress,
 CHỈ với đúng user_id đã chọn — không đụng bảng words/blocks (kho từ vựng
 dùng chung) hay tiến trình của người học khác.
================================================================================
"""

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import requests

# ==============================================================================
# CONFIG — đọc SUPABASE_URL/ANON_KEY từ js/config.js, y hệt manage_users.py
# ==============================================================================

HERE = Path(__file__).resolve().parent           # TJHUB/tools
TJHUB_DIR = HERE.parent                          # TJHUB
OFFLINE_DIR = TJHUB_DIR.parent / "TJHUB_OFFLINE"  # thư mục anh em, KHÔNG nằm trong git
CONFIG_JS_PATH = TJHUB_DIR / "js" / "config.js"


def _read_config_js():
    text = CONFIG_JS_PATH.read_text(encoding="utf-8")
    url_m = re.search(r'SUPABASE_URL:\s*"([^"]+)"', text)
    key_m = re.search(r'SUPABASE_ANON_KEY:\s*"([^"]+)"', text)
    if not url_m or not key_m or not url_m.group(1) or not key_m.group(1):
        sys.exit(f"❌ {CONFIG_JS_PATH} đang trống SUPABASE_URL/KEY (chế độ Local) — "
                  f"script này cần chạy TỪ THƯ MỤC TJHUB GỐC (có key thật), không phải TJHUB_OFFLINE.")
    return url_m.group(1).rstrip("/"), key_m.group(1)


SUPABASE_URL, SUPABASE_ANON_KEY = _read_config_js()
REST_URL = SUPABASE_URL + "/rest/v1"
HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}

LIBRARY_TABLES = ["hubs", "notebooks", "sections", "pages", "batches", "blocks", "words"]
PROGRESS_TABLES = ["word_progress", "block_progress"]
STARTER_VERSION_PATH = OFFLINE_DIR / "data" / "starter.version.json"


def fetch_all(table, select="*", extra_params=None, page_size=1000):
    rows = []
    offset = 0
    while True:
        headers = dict(HEADERS)
        headers["Range-Unit"] = "items"
        headers["Range"] = f"{offset}-{offset + page_size - 1}"
        params = {"select": select}
        if extra_params:
            params.update(extra_params)
        r = requests.get(f"{REST_URL}/{table}", headers=headers, params=params, timeout=30)
        r.raise_for_status()
        chunk = r.json()
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def resolve_user(user_arg):
    """user_arg = uuid HOẶC display_name (không phân biệt hoa/thường) -> profile dict."""
    is_uuid = bool(re.match(r"^[0-9a-fA-F-]{36}$", user_arg))
    if is_uuid:
        rows = fetch_all("profiles", "id,display_name,avatar_emoji,is_admin",
                          {"id": f"eq.{user_arg}"})
    else:
        rows = fetch_all("profiles", "id,display_name,avatar_emoji,is_admin")
        rows = [p for p in rows if (p.get("display_name") or "").strip().lower() == user_arg.strip().lower()]
    if not rows:
        sys.exit(f"❌ Không tìm thấy người học '{user_arg}' trong bảng profiles.")
    if len(rows) > 1:
        sys.exit(f"❌ Có nhiều người học trùng tên '{user_arg}' — chạy lại với uuid cụ thể:\n" +
                  "\n".join(f"   - {p['display_name']}: {p['id']}" for p in rows))
    return rows[0]


# ==============================================================================
# PULL — tải kho từ vựng + tiến trình của 1 user về offline_snapshot.json
# ==============================================================================

def cmd_pull(args):
    profile = resolve_user(args.user)
    uid = profile["id"]
    print(f"📡 Kết nối Supabase: {SUPABASE_URL}")
    print(f"👤 Người học: {profile['display_name']} ({uid})")

    snapshot = {}
    for t in LIBRARY_TABLES:
        print(f"  · Tải bảng '{t}'…")
        snapshot[t] = fetch_all(t)
    print(f"  · Tải tiến trình word_progress/block_progress của '{profile['display_name']}'…")
    snapshot["word_progress"] = fetch_all("word_progress", "*", {"user_id": f"eq.{uid}"})
    snapshot["block_progress"] = fetch_all("block_progress", "*", {"user_id": f"eq.{uid}"})

    starter_version = ""
    try:
        info = json.loads(STARTER_VERSION_PATH.read_text(encoding="utf-8"))
        starter_version = info.get("version", "")
    except Exception:
        print(f"  ⚠️ Không đọc được {STARTER_VERSION_PATH} — LS_VER sẽ để trống "
              f"(app offline có thể hỏi 'thư viện có bản mới', bấm BỎ QUA là được, "
              f"đừng bấm Cập nhật kẻo mất bản đang tải).")

    snapshot["_meta"] = {
        "user_id": uid,
        "user_name": profile["display_name"],
        "user_emoji": profile.get("avatar_emoji") or "🐣",
        "starter_version": starter_version,
        "pulled_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }

    OFFLINE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else (OFFLINE_DIR / "offline_snapshot.json")
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=None), encoding="utf-8")

    n_words = len(snapshot["words"])
    n_blocks = len(snapshot["blocks"])
    n_wp = len(snapshot["word_progress"])
    n_bp = len(snapshot["block_progress"])
    print(f"✅ Xong! Đã ghi: {out_path}")
    print(f"   {n_words} từ, {n_blocks} block, {n_wp} dòng word_progress, {n_bp} dòng block_progress.")
    print("")
    print("Bước tiếp theo:")
    print(f"  cd \"{OFFLINE_DIR}\"")
    print("  python3 -m http.server 8935")
    print("  mở http://localhost:8935/offline_seed.html")


# ==============================================================================
# PUSH — đọc file export từ trình duyệt, upsert NGƯỢC lên Supabase
# (CHỈ 2 bảng progress, CHỈ đúng user_id — không đụng gì khác)
# ==============================================================================

def upsert(table, rows, on_conflict):
    if not rows:
        return 0
    headers = dict(HEADERS)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    CHUNK = 200
    total = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        r = requests.post(f"{REST_URL}/{table}", headers=headers,
                           params={"on_conflict": on_conflict}, json=chunk, timeout=30)
        if not r.ok:
            raise RuntimeError(f"Upsert {table} lỗi {r.status_code}: {r.text}")
        total += len(chunk)
    return total


def cmd_push(args):
    profile = resolve_user(args.user)
    uid = profile["id"]

    default_file = Path.home() / "Downloads" / "offline_progress_export.json"
    in_path = Path(args.file) if args.file else default_file
    if not in_path.exists():
        sys.exit(f"❌ Không thấy file: {in_path}\n"
                  f"   (mở offline_export.html trong trình duyệt offline, bấm tải file trước đã, "
                  f"hoặc chỉ đường dẫn bằng --file)")

    data = json.loads(in_path.read_text(encoding="utf-8"))
    wp_rows = data.get("word_progress") or []
    bp_rows = data.get("block_progress") or []

    # An toàn: LOẠI BỎ mọi dòng không đúng user_id đang chọn — tránh trường
    # hợp file export bị lẫn dữ liệu người khác (nhiều hồ sơ trên cùng máy).
    wp_before, bp_before = len(wp_rows), len(bp_rows)
    wp_rows = [r for r in wp_rows if r.get("user_id") == uid]
    bp_rows = [r for r in bp_rows if r.get("user_id") == uid]
    if len(wp_rows) != wp_before or len(bp_rows) != bp_before:
        print(f"  ⚠️ Đã bỏ qua {wp_before - len(wp_rows)} dòng word_progress + "
              f"{bp_before - len(bp_rows)} dòng block_progress KHÔNG thuộc user '{profile['display_name']}'.")

    print(f"📡 Kết nối Supabase: {SUPABASE_URL}")
    print(f"👤 Đồng bộ ngược cho: {profile['display_name']} ({uid})")
    print(f"  · {len(wp_rows)} dòng word_progress, {len(bp_rows)} dòng block_progress từ {in_path}")

    n1 = upsert("word_progress", wp_rows, "user_id,word_id")
    n2 = upsert("block_progress", bp_rows, "user_id,block_id")
    print(f"✅ Xong! Đã đẩy lên {n1} word_progress + {n2} block_progress.")


def main():
    ap = argparse.ArgumentParser(description="Học offline rồi đồng bộ ngược lại Supabase.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_pull = sub.add_parser("pull", help="Tải kho từ vựng + tiến trình về offline_snapshot.json")
    p_pull.add_argument("--user", required=True, help="display_name hoặc uuid trong bảng profiles (VD: TJ)")
    p_pull.add_argument("--out", default=None, help="Đường dẫn ghi ra (mặc định: TJHUB_OFFLINE/offline_snapshot.json)")
    p_pull.set_defaults(func=cmd_pull)

    p_push = sub.add_parser("push", help="Đẩy ngược tiến trình offline lên Supabase")
    p_push.add_argument("--user", required=True, help="display_name hoặc uuid — PHẢI khớp user lúc pull")
    p_push.add_argument("--file", default=None, help="File offline_progress_export.json (mặc định: ~/Downloads/...)")
    p_push.set_defaults(func=cmd_push)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
