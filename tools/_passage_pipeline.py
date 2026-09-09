"""
_passage_pipeline.py — helper DÙNG NỘI BỘ (Claude) để viết hàng loạt bài
đọc "Claude soạn" cho Block, đúng quy trình bắt buộc trong CLAUDE.md mục
"Khi viết bài đọc tay hàng loạt". KHÔNG chạy trực tiếp file này — import
từ 1 script khác truyền vào block_id + marked text + vi dict + title.

Quy trình mỗi Block:
  1. build_case(...) -> ghi file JSON case tạm
  2. verify(case_path) -> chạy tools/_verify_passage.js, exit khác 0 là
     CÒN LỖI, PHẢI SỬA rồi verify lại, KHÔNG được push khi chưa PASS hết.
  3. push(case_path, block_id) -> PATCH thẳng context_passage lên Supabase
     (đè bài cũ theo đúng xác nhận của user — không phải candidates).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CONFIG_JS = ROOT / "js" / "config.js"
VERIFY_JS = ROOT / "tools" / "_verify_passage.js"
META_SEP = "\n<<<TJWL_META>>>\n"


def _sb_creds():
    text = CONFIG_JS.read_text(encoding="utf-8")
    url = re.search(r'SUPABASE_URL:\s*"([^"]+)"', text).group(1)
    key = re.search(r'SUPABASE_ANON_KEY:\s*"([^"]+)"', text).group(1)
    return url, key


def build_case(out_path, terms_vi, marked, title, source_vi):
    """terms_vi: dict {term: câu tiếng Việt DỊCH ĐÚNG câu chứa [term] đó}
    (không phải nghĩa từ đơn — phải là cả câu, khớp translate() trong
    context.js). marked: đoạn văn đầy đủ có [term]. Trả về (case, wordcount)."""
    meta = {"title": title, "source_vi": source_vi, "vi": terms_vi, "claude": True}
    case = {"terms": list(terms_vi.keys()), "marked": marked, "meta": meta}
    Path(out_path).write_text(json.dumps(case, ensure_ascii=False), encoding="utf-8")
    wc = len(marked.replace("[", "").replace("]", "").split())
    return case, wc


def verify(case_path):
    r = subprocess.run(["node", str(VERIFY_JS), str(case_path)], capture_output=True,
                        text=True, encoding="utf-8", errors="replace")
    print(r.stdout)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return False
    return True


def push(case_path, block_id):
    import requests
    url, key = _sb_creds()
    h = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    case = json.loads(Path(case_path).read_text(encoding="utf-8"))
    full = case["marked"] + META_SEP + json.dumps(case["meta"], ensure_ascii=False)
    r = requests.patch(url + "/rest/v1/blocks", headers=h,
                        params={"id": "eq." + block_id}, json={"context_passage": full})
    print(block_id, r.status_code)
    return r.status_code == 204


def run(out_path, block_id, terms_vi, marked, title, source_vi):
    """Tiện ích gộp cả 3 bước — verify FAIL thì KHÔNG push, trả về False."""
    case, wc = build_case(out_path, terms_vi, marked, title, source_vi)
    print("wordcount:", wc)
    if not verify(out_path):
        print("=== FAIL — KHONG PUSH, sua lai roi goi run() lai ===")
        return False
    ok = push(out_path, block_id)
    print("=== DA PUSH ===" if ok else "=== LOI PUSH ===")
    return ok
