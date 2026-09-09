# TJ WordLoop Hub — Bàn giao nhanh

> **Claude đọc file này**: bàn giao từ phiên làm việc trước, cùng dự án/cùng người dùng (Thao). Đọc hết file này rồi đọc `README.md` + `CLAUDE.md` trong repo trước khi làm gì tiếp — đừng đề xuất lại quyết định đã chốt. Bản này THAY THẾ bản `HANDOFF.md` cũ hơn (nội dung cũ về ticker/Journey redesign coi như đã xong từ lâu, không còn liên quan phiên này).

## 🚨 VIỆC KHẨN CẤP NHẤT — key Gemini đã CHẾT, cần key mới
Key `AQ.Ab8RN6J5el71_ViSQGAYZxB-YMDymgsWf9aTnL3sSUl87Oh6vg` trong `config.js` **đã bị Google tự thu hồi** — verify bằng curl trực tiếp, HTTP 401 "invalid authentication credentials". Test lúc push (~1h trước) còn OK (200), giờ chết hẳn. Đúng nguyên nhân: key lộ công khai trên GitHub Public → Google tự phát hiện + revoke (đã cảnh báo trước khi push, giờ xảy ra thật). Đây LÀ LÝ DO người dùng báo "dán từ vựng không ra bảng" (Block vẫn tạo được, chỉ AI không điền cột được nữa) — không phải bug code.

**Việc cần làm ngay đầu phiên sau**: xin người dùng tạo key Gemini MỚI (https://aistudio.google.com/apikey, nhớ bấm nút "Copy key"), cập nhật `js/config.js`, verify bằng script Python gọi thẳng API TRƯỚC khi báo người dùng test, commit+push (sẽ bị GitHub Push Protection chặn lại — cần hỏi người dùng xác nhận qua `AskUserQuestion` rồi mới push, đã có tiền lệ ở phiên này). **Nhắc người dùng: chu kỳ "key mới → vài giờ đến vài ngày → Google revoke lại" SẼ LẶP LẠI MÃI** nếu vẫn giữ kiến trúc "key thẳng trong file JS chạy trình duyệt + repo Public" — nói rõ 2 lựa chọn thật sự bền: (1) nâng cấp GitHub Pro để chuyển repo Private (Pages vẫn chạy được), hoặc (2) dựng 1 backend proxy nhỏ (Cloudflare Worker/Vercel function miễn phí) giữ key phía server, web chỉ gọi qua proxy đó — KHÔNG có cách nào "mẹo" hơn để giấu key trong 1 app 100% client-side cả.

## 📝 ĐANG VIẾT LẠI TOÀN BỘ BÀI ĐỌC "SCENARIO" (46 Block, 8 topic) — 6/46 XONG
Người dùng yêu cầu: viết 1 bài đọc Claude (~500 từ, đúng quy trình CLAUDE.md) cho **MỌI Block** trong 8 Page dưới section `2a064e84-b574-4c07-8a2d-929f90f70486` (hub TOEIC HUB, notebook có sidebar hiện "01_Doanh nghiệp..." → "08_Đời sống..."), **ĐÈ THẲNG lên `context_passage`** (không phải candidates — user đã xác nhận, khác quy tắc mặc định trong CLAUDE.md). Đã quét Supabase: **46 Block, KHÔNG Block nào từng có bài Claude** (`meta.claude` toàn `false`).

**TIẾN ĐỘ: 6/46 xong** — trọn vẹn topic "01_Doanh nghiệp & Quản trị" (Block 104-109), đã verify + PATCH lên Supabase thật, xác nhận HTTP 204 từng Block. **40 Block còn lại** nằm trong `tools/_passage_todo.json` (đã lưu sẵn, có đủ `block_id` + danh sách 10 từ + nghĩa tiếng Việt mỗi Block, KHÔNG cần query lại Supabase) — chia theo topic:
- `02_Tài chính & Kinh tế`: 5 Block (110-114)
- `03_Công nghệ và dữ liệu`: 6 Block (115-120, **Block 120 chỉ có 4 từ**)
- `04_Giao tiếp & Đàm phán`: 5 Block (121-125, **Block 125 chỉ có 3 từ**)
- `05_Tâm lý & Tư duy`: 6 Block (126-131, **Block 131 chỉ có 9 từ**)
- `06_Sức khỏe & Sinh học`: 4 Block (132-135)
- `07_Pháp lý, Chính trị & Xã hội`: 5 Block (136-140, **Block 140 chỉ có 7 từ**)
- `08_Đời sống, Thành ngữ & Môi trường`: 9 Block (141-149, **Block 149 chỉ có 1 từ — "green auditing"**, gần như không cần viết cả bài, hỏi lại user có muốn viết đủ 500 từ chỉ để nhét 1 từ không, hay gộp/để đó)

**QUY TRÌNH ĐÃ DỰNG SẴN, DÙNG LẠI Y NGUYÊN** (đã test 6 lần, chạy tốt):
1. `tools/_verify_passage.js` — verify Node y hệt quy trình CLAUDE.md bắt buộc (10/10 gap khớp term, ≥450 từ, `translate()` khớp đủ `meta.vi`, round-trip `parseMeta`).
2. `tools/_passage_pipeline.py` — hàm `run(out_path, block_id, terms_vi_dict, marked_text, title, source_vi)` gộp cả 3 bước: ghi JSON case → verify → PATCH thẳng `context_passage` lên Supabase nếu PASS hết (không push nếu có FAIL). Import bằng `sys.path.insert(0,"tools"); from _passage_pipeline import run`.
3. **Bài học rút ra qua 6 lần làm**: ước lượng số từ TRƯỚC khi verify hầu như LUÔN THIẾU (dự đoán ~480 nhưng verify ra 380-430) — **cứ viết dư hẳn ra ngay từ đầu** (nhắm ~550-600 từ lúc soạn thay vì đúng 500) để đỡ phải quay lại thêm câu 2-3 lần/Block, tốn round-trip. Thêm câu chêm vào KHÔNG được đụng câu chứa `[term]` (dùng `.replace()` chèn câu mới ngay trước/sau 1 mốc văn bản có sẵn, xem ví dụ thật trong lịch sử phiên này nếu cần).
4. `meta.vi[term.toLowerCase()]` chỉ cần LÀ BẢN DỊCH ĐÚNG của câu chứa term đó — không cần khớp chính xác cấu trúc câu gốc, `Context.translate()` chỉ tra thẳng theo key khi có `viMap`.
5. Mỗi Block xong, **PATCH thành công (204) là đã lưu thật trên Supabase ngay lập tức** — không cần đợi gộp/đợi hết mới lưu. Sau mỗi ~5-6 Block xong, cập nhật lại % tiến độ trong file này rồi `git add -A && git commit && git push` (dù nội dung bài đọc nằm ở Supabase chứ không phải Git, vẫn nên checkpoint code+tiến độ thường xuyên phòng mất phiên giữa chừng).
6. Chủ đề gợi ý (đã dùng 6/46): bối cảnh đời thường/công sở đa dạng (startup, nhà máy dệt, hãng nội thất, studio podcast, công ty hàng tiêu dùng...) — **đừng lặp lại đúng bối cảnh cũ**, đổi ngành nghề/nhân vật mỗi Block cho đỡ nhàm, đúng tinh thần "phong phú, hấp dẫn" user yêu cầu.

## Trạng thái ngay lúc dừng (hết token giữa phiên — chưa làm xong Dictation)
- Commit mới nhất đã **push xong**: `ced1bbb` — key Gemini lúc push còn sống, giờ đã chết (xem mục khẩn cấp ở trên).
- **✅ Tab "🎧 Dictation" ĐÃ CODE XONG + PUSH** (đúng spec chốt bên dưới) — nghe từng câu (TTS có sẵn, `Speech.speakWord`), gõ lại, tự so `normalizeAnswer(given) === normalizeAnswer(sentence)`, 100% free không AI. Tab đứng sau "Active Recall Quiz", "Nghĩa" đã dời lên ngay sau Dictation, trước "Phiếu đầy đủ" — đúng thứ tự yêu cầu. **CHƯA verify bằng trình duyệt thật** (chỉ `node --check`) — việc ĐẦU TIÊN phiên sau: mở web, vào 1 Block đã có bài đọc, bấm tab Dictation, thử nghe + gõ đúng/sai, xác nhận UI hiển thị đúng, rồi báo lại người dùng.
- **⚠️ QUYẾT ĐỊNH PHẠM VI (tự quyết vì hết token, CHƯA hỏi người dùng xác nhận)**: Dictation KHÔNG ghi gì vào `block_progress`/`word_progress`/SRS — chỉ luyện trong phiên, thoát tab là mất kết quả, không tính vào "✓ Done". Lý do: giữ đơn giản/nhanh xong trong thời gian ít token còn lại. Nếu người dùng muốn Dictation cũng tính điểm như "Nghĩa" (đã có `meaning_passed`/`meaning_best` + tự đẩy chu kỳ ôn SRS nếu ≥80%, xem `D.submitMeaning` dòng ~1276-1319 làm mẫu) thì cần: thêm cột `dictation_passed`/`dictation_best` vào `block_progress` (SQL `alter table`, cập nhật `tools/supabase_schema.sql`), viết `D.submitDictation` phỏng theo `D.submitMeaning`, cập nhật điều kiện "✓ Done" (`detail.js` tìm `bp.passed || bp.meaning_passed`) + `db.js` (`getJourneySummary`, `bumpLearnedToday` liên quan) — HỎI người dùng trước khi làm, đừng tự quyết thêm.
- Người dùng cũng hỏi "đổi qua OpenAI để xem" — **mình không còn giữ key OpenAI nào** (đã xoá theo yêu cầu trước đó, không lưu ở đâu cả). Nếu người dùng vẫn muốn OpenAI dự phòng, phải xin key MỚI.

## Tính năng "🎧 Dictation" — SPEC ĐÃ CHỐT (hỏi trực tiếp người dùng, đừng đổi ý tự ý)
- **Cách chấm**: 100% FREE, KHÔNG gọi AI — nghe câu đọc bằng giọng TTS có sẵn (`speech.js`, y hệt cơ chế đang dùng), người học gõ lại, app **tự so sánh text** (không phân biệt hoa/thường, không phân biệt dấu câu) → đúng/sai rõ ràng.
- **Đơn vị**: Nghe **TỪNG CÂU** (câu trong đoạn văn ngữ cảnh có chứa từ vựng của Block) — **không phải từng từ**. Tái dùng đúng nguồn câu đã có sẵn: `Context.gapSentences(marked)` (xem `js/context.js:498`) — đang dùng cho đề điền-từ ở tab "Từng câu"/"Phiếu đầy đủ", trả về `[{term, text}]` với `{{GAP}}` — với Dictation thì KHÔNG che từ, đọc nguyên câu, người học gõ lại nguyên câu.
- **Vị trí tab**: chèn ngay **SAU** "📝 Active Recall Quiz", **TRƯỚC** "🔀 Nghĩa". Đồng thời **dời tab "🔀 Nghĩa"** lên đứng ngay sau Dictation, trước "📋 Phiếu đầy đủ" (đổi thứ tự tab).
  - Thứ tự tab HIỆN TẠI (trước khi sửa): `study → quiz → sheet → single → meaning → progress` (xem `index.html` dòng ~240-246, `data-tab="..."`).
  - Thứ tự tab MỚI cần ra: `study → quiz → dictation(MỚI) → meaning → sheet → single → progress`.
- **Việc cần làm cụ thể**:
  1. `index.html`: thêm `<button class="dtab" data-tab="dictation">🎧 Dictation</button>` đúng vị trí; sắp lại thứ tự các nút tab theo trên; thêm `<div class="tab-pane" id="pane-dictation">` (theo mẫu `pane-meaning`/`pane-single`).
  2. `detail.js`: viết `D.buildDictationQuiz()` (dùng `Context.gapSentences`, có thể tái dùng luôn danh sách câu nếu đã có `D._exam`/nguồn chung — xem cách `D.buildMeaningQuiz`/`_meaningQuiz` đang làm ở dòng ~188, 1121, 1197, 1242, 1283 để bắt chước đúng pattern: 1 bộ đề riêng mỗi lần vào Block, nút "Làm lại"...). So sánh text: chuẩn hoá cả 2 chuỗi (`.toLowerCase().trim()`, bỏ dấu câu bằng regex) trước khi so `===`.
  3. **Quyết định CÒN THIẾU cần hỏi/tự quyết**: Dictation có ghi điểm vào `block_progress` không? Gợi ý bám theo đúng pattern "Nghĩa" đã có sẵn (`meaning_passed`/`meaning_best`, KHÔNG đẩy chu kỳ ôn Tony Buzan, chỉ tính vào "✓ Done" nếu đạt ≥80%) — thêm cột mới `dictation_passed`/`dictation_best` vào bảng `block_progress` (cần thêm SQL `alter table` + cập nhật `tools/supabase_schema.sql`, giống hệt cách đã thêm cột `updated_at` phiên trước) rồi cập nhật điều kiện "✓ Done" ở `detail.js:224` (`bp.passed || bp.meaning_passed` → thêm `|| bp.dictation_passed`) và `db.js` (`getJourneySummary`, `bumpLearnedToday`...).
  4. Bump cache-buster `index.html`/`detail.js` sau khi sửa (quy ước bắt buộc của project — xem comment ngay trong `index.html` chỗ nạp script, KHÔNG ĐƯỢC QUÊN, đã gây bug thật nhiều lần).
  5. Test bằng `node --check js/detail.js` trước khi commit, rồi `git add -A && git commit ... && git push`.

## Việc ĐÃ XONG trong phiên này (đừng làm lại)
- **Bỏ hẳn OpenAI khỏi code** (theo yêu cầu — chỉ dùng Gemini free): xoá `_callOpenAI`, mọi nhánh fallback, mọi check `OPENAI_API_KEY` trong `context.js`/`app.js`/`detail.js`/`index.html`/`README.md`.
- **Mở AI cho MỌI User** (bỏ chính sách cũ "AI chỉ Admin"): "+ Paste từ mới" (tự điền cột thiếu), "✨ Dán bài, tự trích từ" → mở toang, không phân role. Riêng "🔄 Tạo lại" bài đọc (ảnh hưởng bài đọc CHUNG mọi người) → gộp chung quyền với `canEditPassage` (Admin hoặc tài khoản được cấp cờ riêng), KHÔNG mở hoàn toàn công khai — đây là chủ ý, đừng đổi nếu không ai yêu cầu.
- **Đa dạng chủ đề đoạn văn AI**: thêm `Context.SETTINGS`/`Context.STYLES` (20 bối cảnh + 6 văn phong ngẫu nhiên) ép cứng vào prompt `generateAI` — trước đó AI hay lặp lại vài chủ đề "họp hành văn phòng" dù đã gợi ý đa dạng bằng lời, vì prompt y hệt nhau mỗi lần.
- **Retry tự động cho Gemini** (`_callGemini`, `context.js`): thử lại tối đa 3 lần (1.5s/3s/6s) khi gặp HTTP 503/429 — đã tự kiểm chứng bằng script Python gọi thẳng API: lần đầu fail 503 liên tiếp 3 lần, lần 4 mới qua. Đây là nguyên nhân THẬT của các lần AI báo lỗi "chưa sẵn sàng" trước đó, KHÔNG phải lỗi key/code.
- **⚠️ ĐÃ THỬ VÀ THẤT BẠI — ĐỪNG LÀM LẠI**: từng thử giấu `GEMINI_API_KEY` sang `js/keys.local.js` (gitignored) để tránh GitHub Push Protection — **làm HỎNG web live** vì GitHub Pages (free) chỉ phục vụ đúng file có trong Git, file gitignore không bao giờ lên được, web thật 404/thiếu key. Đã revert, giờ key **BẮT BUỘC** nằm trong `config.js` (có Git track, đã push, người dùng đã xác nhận chấp nhận rủi ro key lộ công khai — coi như Supabase anon key, rủi ro thấp vì Gemini free tier có giới hạn quota sẵn).
- **"🕒 Data cập nhật lần cuối"**: thêm ở chân sidebar trái, dưới khu "Chu kỳ Tony Buzan" (`#sidebar-data-updated`, gọi từ `App.renderDataUpdated` trong `app.js`, chạy 1 lần lúc `boot()`) — **LUÔN hiện mọi màn hình**, không phải chỉ ở Journey (ban đầu đặt nhầm chỗ ở màn Journey, đã dời theo đúng yêu cầu người dùng chỉ tay vào ảnh chụp). Đọc cột `updated_at` (bảng `words`/`blocks`) do TRIGGER Supabase tự set — xem `tools/supabase_schema.sql` mục "CẬP NHẬT LẦN CUỐI" (đã chạy trên Supabase SQL Editor, đã verify bằng REST API có timestamp thật).
- **Dọn UI theo yêu cầu trực tiếp**: bỏ nhãn "Block X/Y · Batch Z" (`#bn-pos`, `detail.js`); bỏ badge %/✓ thuộc cạnh mỗi từ ở bảng "1. Danh sách từ vựng cần học" (số liệu vẫn còn đủ ở tab "Tiến trình trí nhớ").
- **2 file Python thay `sync_vocab.py`**: `tools/export_vocab.py` (Supabase → Excel) + `tools/import_vocab.py` (Excel → Supabase), logic dùng chung ở `tools/_vocab_common.py` — không còn phải đổi `MODE` trong 1 file nữa.

## Đường dẫn
- **Code (GitHub, PUBLIC)**: https://github.com/teoteo1081/tj-wordloop-hub
- **Web live (GitHub Pages)**: https://teoteo1081.github.io/tj-wordloop-hub/ — `git push` là tự build lại, đợi vài phút + Ctrl+Shift+R để hết cache.
- **Supabase project**: `pqarpszsipbdugrumhfy` (Singapore) — SQL Editor: https://supabase.com/dashboard/project/pqarpszsipbdugrumhfy/sql/new
- **Link Admin "TJ"**: `https://teoteo1081.github.io/tj-wordloop-hub/?u=f3fd95c9-06e8-4d39-b6f2-efc113d436cf` (mở 1 lần trên máy/trình duyệt nào là tự nhớ). Có 2 profile `is_admin=true`: "TJ" và "Anti_TJ" — coi chừng nhầm.

## Khoá cấu hình
- `js/config.js` (có Git track, đã push) — `SUPABASE_ANON_KEY` (an toàn, chặn bởi RLS) + `GEMINI_API_KEY` (đã chấp nhận rủi ro lộ công khai, xem lý do ở trên — ĐỪNG chuyển ra `keys.local.js` nữa).
- `tools/export_vocab.py`/`import_vocab.py`/`manage_users.py` tự đọc key từ `js/config.js`.

## Chạy local
```bash
cd TJHUB
python3 -m http.server 8934
# mở http://localhost:8934 — KHÔNG mở bằng file://
```
Deploy: `git add -A && git commit -m "..." && git push` (GitHub Pages tự build).
**Luôn bump `?v=N` của file JS/CSS vừa sửa trong `index.html`** trước khi push — quên bước này là nguyên nhân phổ biến nhất khiến "sửa rồi mà web vẫn y như cũ" (browser/CDN cache bản cũ).

## Đọc thêm
- `README.md` — kiến trúc đầy đủ, 3 kiểu bài kiểm tra, SRS, Journey.
- `CLAUDE.md` — quyết định đã chốt, quy trình viết bài đọc.
