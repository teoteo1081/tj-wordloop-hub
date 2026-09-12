# TJ WordLoop Hub

App học từ vựng tiếng Anh cá nhân, dùng phương pháp lặp lại ngắt quãng (spaced repetition) theo mô hình Tony Buzan. Plain HTML/CSS/JS, không build step, không framework.

## Mục lục
- [Chạy thử ở máy](#chạy-thử-ở-máy)
- [Triển khai hiện tại](#triển-khai-hiện-tại)
- [Cây dữ liệu](#cây-dữ-liệu)
- [Chế độ Local vs Cloud](#chế-độ-local-vs-cloud)
- [Các file JS chính](#các-file-js-chính-jsxxxjs)
- [Bài đọc ngữ cảnh — cách hoạt động](#bài-đọc-ngữ-cảnh--cách-hoạt-động)
- [3 kiểu bài kiểm tra](#3-kiểu-bài-kiểm-tra)
- [Chu kỳ ôn tập (Tony Buzan)](#chu-kỳ-ôn-tập-tony-buzan)
- [Journey — thống kê học theo ngày](#journey--thống-kê-học-theo-ngày)
- [Cách thêm từ vựng mới](#cách-thêm-từ-vựng-mới)
- [Khoá API / bí mật](#khoá-api--bí-mật)
- [Việc còn dang dở](#việc-còn-dang-dở)

## Chạy thử ở máy
```bash
cd TJHUB
python3 -m http.server 8934
```
Mở **`http://localhost:8934`** — **không** mở bằng `file://` (fetch() bị chặn, dữ liệu sẽ "biến mất").

Điện thoại cùng Wi-Fi với laptop: `http://<IP-LAN-của-laptop>:8934` (lấy IP bằng `ipconfig getifaddr en0` trên Mac).

## Triển khai hiện tại
| Thứ | Ở đâu |
|---|---|
| Code (GitHub, **public**) | https://github.com/teoteo1081/tj-wordloop-hub |
| Web live (GitHub Pages) | **https://teoteo1081.github.io/tj-wordloop-hub/** |
| Web live (Netlify — tạm ngưng deploy) | https://tj-wordloop-hub.netlify.app (đứng ở bản cũ, team hết hạn mức tháng, xem CLAUDE.md) |
| Database dùng chung (Supabase) | project `pqarpszsipbdugrumhfy`, region Singapore |

Deploy lại sau khi sửa code — chỉ cần push, GitHub Pages tự build lại (không cần lệnh deploy riêng như Netlify):
```bash
git add -A && git commit -m "..." && git push
```
Kiểm tra Pages build xong chưa: `gh api repos/teoteo1081/tj-wordloop-hub/pages/builds/latest`

**Lưu ý repo đã chuyển PUBLIC** (bắt buộc để dùng GitHub Pages miễn phí) — đã rà soát kỹ, không có key/credential nhạy cảm nào trong repo hay lịch sử git (xem CLAUDE.md).

## Cây dữ liệu
```
Hub > Notebook > Section > Page > Batch > Block (10 từ) > Word
```
Mỗi **Block** chuẩn 10 từ (`APP_CONFIG.WORDS_PER_BLOCK`). Tên Block đánh số lại từ **1** trong từng **Batch** (không chạy dồn toàn Notebook) — batch cũ lỡ có Block đánh số kiểu khác thì Block mới thêm vào vẫn nối tiếp số đã có, không nhảy lùi về 1.

## Chế độ Local vs Cloud
Cấu hình duy nhất ở **`js/config.js`**:
- Để trống `SUPABASE_URL`/`SUPABASE_ANON_KEY` → chế độ **local** (dữ liệu trong `localStorage` của từng trình duyệt, không chia sẻ được).
- Điền 2 giá trị đó → chế độ **cloud**: **kho từ vựng** (hubs→words, kể cả bài đọc) dùng chung giữa mọi thiết bị vào cùng link. Hiện đã bật.

**Tiến trình học** (đã thuộc từ nào, streak, điểm thi) là **RIÊNG TỪNG THIẾT BỊ** cho tới khi có đăng nhập thật (magic link, `js/auth.js`) — xem thêm ở [Việc còn dang dở](#việc-còn-dang-dở).

`anon` key an toàn để đưa vào code công khai (được chặn bởi RLS trong `tools/supabase_schema.sql`) — **không bao giờ** dùng `service_role`/`sb_secret_...` ở phía client.

Chạy `tools/supabase_schema.sql` (SQL Editor trên Supabase Dashboard) mỗi khi schema đổi (thêm cột/bảng mới).

## Các file JS chính (`js/*.js`)
Mỗi file tự gắn 1 global lên `window` (`w.App`, `w.DB`, `w.Detail`, `w.Context`, `w.Reader`, `w.Speech`, `w.Auth`, `w.Export`, `w.Journey`, `w.SRS`). Nạp theo đúng thứ tự trong `index.html` (đừng đảo).

| File | Vai trò |
|---|---|
| `config.js` + `keys.local.js` | Cấu hình Supabase + API key AI (file sau **gitignore**, tự tạo lại khi đổi máy) |
| `util.js` | Tiện ích dùng chung (`$`, `esc`, `uid`, `pct`, `humanTime`...) |
| `srs.js` | Thuật toán chu kỳ ôn Tony Buzan (5 mốc: 10p/24h/1 tuần/1 tháng/3-6 tháng) |
| `context.js` | Sinh & phân tích bài đọc ngữ cảnh — xem mục riêng bên dưới |
| `speech.js` | Đọc bằng giọng máy (Web Speech API) + karaoke |
| `db.js` | Lớp trừu tượng Local/Cloud — mọi nơi khác chỉ gọi `DB.xxx()`, không biết dữ liệu nằm đâu |
| `auth.js` | Hồ sơ người dùng cục bộ + đăng nhập Supabase (magic link) |
| `reader.js` | Chế độ đọc kiểu LingQ (bôi màu từ đã học, lưu từ mới từ bài đọc) |
| `detail.js` | Màn học chi tiết 1 Block: bài học, bài đọc, 3 kiểu thi, tiến trình |
| `export.js` | Xuất PDF (Block/Batch/Page/Section/Notebook) |
| `journey.js` | Màn Journey — tổng quan + lịch học theo ngày |
| `app.js` | Bộ điều phối chính: nạp dữ liệu, render Hub/Notebook/Section/Page/Batch/Block, menu, paste-từ-mới, di chuyển Hub/Notebook/Section |

## Bài đọc ngữ cảnh — cách hoạt động
Mỗi Block có **đúng 1 bài đọc đang dùng**: `block.context_passage` (chuỗi text `[term]` đánh dấu + 1 khối JSON ẩn phía sau, ngăn bởi `Context.META_SEP`, chứa `{ai, pasted, claude, vi, title, source}`).

**Không tự sinh bài khi mở Block.** Khu "chọn nguồn bài đọc" (`#passage-empty`, hàm `D.renderSourcePicker`) LUÔN hiện — kể cả khi đã có bài đọc chính, để đổi bất cứ lúc nào — dưới dạng 1 hàng tab:
- **"📝 Dán"** — dán bài của riêng bạn vào ô, app tự bôi `[ngoặc]` đúng các từ của Block bằng `Context._markTerms()`.
- **"Claude 1/2/3"** — nếu Block có `context_passage_candidates` (mảng tối đa 3 bài Claude viết tay sẵn), hiện thêm các tab này. Đây là cách **KHÔNG tốn quota AI**.

Chọn tab nào thì xem trước tab đó, bấm **"✅ Dùng bài này"** mới đẩy lên chính thức. Muốn nhờ AI viết bài mới thì dùng nút **"🔄 Tạo lại"** ở đầu card bài đọc — chạy được ở **mọi nơi** (web live lẫn máy local) qua **Gemini** (Supabase Edge Function `gemini-proxy`, xem [Khoá API / bí mật](#khoá-api--bí-mật)), giới hạn 3 Block AI/ngày cho user thường. **OpenAI** là tuỳ chọn phụ, chỉ hoạt động trên máy local có tự cấu hình `OPENAI_API_KEY` trong `js/keys.local.js` (không commit — key trả tiền thật) — máy đó sẽ ưu tiên gọi OpenAI trước, lỗi mới rơi về Gemini; máy không có key này (kể cả web live) luôn dùng Gemini trước (xem `Context._callProvider` trong `context.js`).

Bộ mẫu câu cứng cũ (`OPENERS`/`MIDDLES`/`CLOSERS`, kiểu "quarterly planning meeting" lặp lại) **đã bị loại bỏ hoàn toàn** — không còn là fallback im lặng nữa vì nội dung vô nghĩa/lặp lại. `db.js` có 1 lượt dọn tự động (`cleanupLegacyPassages`, chạy mỗi lần mở app ở chế độ local) xoá sạch bài đọc nào không có `ai`/`pasted`/`claude` trong meta.

**Viết bài đọc tay cho Claude tương lai**: mỗi bài ~500 từ, mỗi từ trong 10 từ của Block xuất hiện ĐÚNG 1 lần, nguyên văn (không chia động từ), bọc `[term]`. Kèm bản dịch tiếng Việt từng câu chứa từ đó (khoá theo `term.toLowerCase()`) trong `meta.vi`. Đặt `meta.claude = true`. Xem `Context.parseMeta`/`Context.gapSentences`/`Context.build` để hiểu định dạng chính xác trước khi viết hàng loạt — **luôn verify bằng Node** (`require` trực tiếp `context.js`, không cần trình duyệt) trước khi giao cho người dùng import.

## 3 kiểu bài kiểm tra
Sau khi học xong bài + đọc bài, có 3 tab kiểm tra độc lập, mỗi tab tối đa 10 câu:
- **Phiếu đầy đủ** (Sheet) — điền từ kiểu word-bank cả tờ, có nút "Nộp bài" tường minh.
- **Từng câu** (Single) — mỗi lần 1 câu trắc nghiệm 4 đáp án; trả lời xong (đúng/sai) **tự chấm luôn, không cần bấm Nộp bài** — đúng thì tự qua câu tiếp, sai thì hiện đáp án đúng rồi mới tự qua (câu cuối cũng tự chấm ra kết quả).
- **Nghĩa** (Meaning) — 10 từ đảo nghĩa, trắc nghiệm, **độc lập** không đụng chu kỳ SRS; trình bày giống hệt "Từng câu" (tự chấm, không cần nút Nộp bài).

**Phiếu đầy đủ và Từng câu dùng chung 1 đề** (`D._exam`, `gaps` capped 10) và cùng ghi vào `bp.passed`/SRS. **Nghĩa** có đề riêng (`D._meaningQuiz`) và field riêng `bp.meaning_passed`/`bp.meaning_best` — **không đẩy chu kỳ ôn**.

**"✓ Done"** trên thẻ Block (góc phải) hiện ra khi **BẤT KỲ 1 trong 3 thẻ** đạt ≥ 80% (`bp.passed || bp.meaning_passed`) — không cần cả 3 đều đạt.

## Chu kỳ ôn tập (Tony Buzan)
`js/srs.js` — 1 Block chỉ vào chu kỳ SAU KHI đạt bài thi (Phiếu đầy đủ/Từng câu ≥ 80%, ghi `bp.passed`). 5 mốc: 10 phút → 24 giờ → 1 tuần → 1 tháng → 3 tháng (→ 6 tháng duy trì). Trả lời sai nhiều thì `SRS.demote()` lùi 1 bậc.

## Journey — thống kê học theo ngày
Icon 📊 "Journey" trên thanh trên cùng. Số liệu ở đây **LUÔN là của TOÀN BỘ app** (không đổi theo cây thư mục bên phải — xem dưới), khác tab "Tiến trình" trong Block (chỉ xem 1 Block).
- **3 thẻ tổng quan**: (1) Đã thuộc / Đã học / Tổng từ — "Đã thuộc" (`word_progress.mastered`, bậc cao, cần nhớ đúng nhiều lần ở bảng tra từ) khác "Đã học" (từ thuộc Block đã Done ít nhất 1 lần); (2) Block đã Done / Tổng Block; (3) Block đang quá hạn ôn (đếm chính xác theo Block từ cây `DB.getFullTree`, bấm vào nhảy thẳng tới Block quá hạn gần nhất).
- **4 chip giai đoạn Tony Buzan** ngay dưới 3 thẻ — mỗi chip là số Block quá hạn của đúng giai đoạn đó, bấm vào để nhảy tới tab tương ứng bên dưới.
- **Lịch 28 ngày**: xanh (+N) = số từ "học" hôm đó, cộng dồn mỗi lần 1 trong 3 thẻ bài tập đạt ≥ 80% (`DB.bumpLearnedToday`, lưu `daily_log`); đỏ (⚠N) = số từ đang **quá hạn ôn** hôm đó — tính SỐNG mỗi lần mở màn Journey, dựa vào `bp.next_review_at` đã trôi qua mà chưa ôn lại. Có chú thích ký hiệu ngay trên lịch.
- **2 khung song song bên dưới**: TRÁI = "🚦 Theo tiến độ Tony Buzan" — 4 tab (khớp `w.SRS.STEPS[].group`), mỗi tab liệt kê 2 danh sách **theo Block** (không theo từng từ, vì tiến trình chỉ lưu ở cấp Block): "🔴 Đến hạn ôn ngay" và "🟢 Đã ôn, chưa tới hạn kế tiếp". PHẢI = cây drill-down cũ (Hub›Notebook›Section›Page›Batch›Block) để duyệt/nhảy vào học theo cấu trúc thư mục — cây này CHỈ để duyệt, không ảnh hưởng tới số liệu bên trái.
- `DB.getJourneySummary` (số tổng quan, nhanh) và `DB.getFullTree` (toàn bộ cấu trúc + `bp` map, dùng cho cây + 4 tab) là 2 đường load riêng — cả 2 đều PHẢI check `progressLocal()` (không phải `DB.mode`) khi quyết định đọc `block_progress` ở đâu, vì kho từ vựng có thể là Cloud trong khi tiến trình vẫn Local (chưa đăng nhập thật) — nhầm 2 cái này từng gây lỗi `invalid input syntax for type uuid` sập cả cây Journey (đã sửa).

## Cách thêm từ vựng mới
- **"+ Paste từ mới"**: dán danh sách từ (mỗi dòng 1 từ, các cột cách nhau `|` hoặc tab) → tự cắt Block 10 từ/batch mới, đánh số lại từ 1. Có key AI thì tự tra điền nốt cột thiếu (level/pos/ipa/def_en/meaning_vi).
- **"✨ Dán bài, tự trích từ"**: dán bài báo/transcript YouTube → AI trích từ vựng B1+ → tự tạo Block.
- **Lưu từ khi đọc** (kiểu LingQ): bôi/bấm từ trong bài đọc → lưu vào Batch "⭐ Từ đã lưu" của Page hiện tại, đủ 10 từ tự sang Block mới (đánh số tiếp theo Block cũ nhất trong batch đó, không nhảy về 1 nếu batch đã có số).

## Khoá API / bí mật
- `js/config.js` — **có commit** (repo **Public** trên GitHub — mọi key trong file này coi như công khai). Chỉ chứa `SUPABASE_URL`/`SUPABASE_ANON_KEY` — an toàn để lộ (chặn bởi RLS trong `tools/supabase_schema.sql`). **Tuyệt đối không** đặt `service_role`/`sb_secret_...` vào đây.
- **`GEMINI_API_KEY` KHÔNG nằm trong bất kỳ file client-side nào nữa** (đã bị Google tự thu hồi 3 lần liên tiếp khi từng để trần trong `config.js` — repo Public bị secret-scanning quét ra). Key thật giờ chỉ là **Supabase secret** dùng bởi Edge Function `gemini-proxy` (`supabase/functions/gemini-proxy/index.ts`); client (web live lẫn máy local) gọi qua proxy này bằng `SUPABASE_URL`/`SUPABASE_ANON_KEY` sẵn có, không bao giờ cần biết giá trị key thật. Đổi key Gemini: `supabase secrets set GEMINI_API_KEY=<key> --project-ref pqarpszsipbdugrumhfy` rồi `supabase functions deploy gemini-proxy --project-ref pqarpszsipbdugrumhfy --no-verify-jwt` — không sửa file JS nào. Xem thêm ở `CLAUDE.md`.
- `js/keys.local.js` (copy từ `js/keys.local.example.js`) — **gitignored**, không commit, chỉ tồn tại trên 1 máy cụ thể. Dùng **duy nhất** để bật **OpenAI tuỳ chọn** (`OPENAI_API_KEY` + `OPENAI_MODEL`) cho máy đó — trả tiền thật nên không đưa lên web live. Không có file này (mặc định) thì app chỉ dùng Gemini qua proxy, hoạt động bình thường ở mọi nơi.

## Việc còn dang dở
> **Đây là nơi ghi backlog nhiều-phiên, LÂU DÀI** (khác `HANDOFF.md` — file đó chỉ ghi checkpoint TẠM của 1 phiên sắp hết token, xem luật dùng ngay đầu file đó, và `CLAUDE.md` mục "Nguyên tắc chung"). Việc nào kéo dài nhiều phiên/nhiều người thì cập nhật thẳng vào đây; đừng lập thêm file `.md` mới ngoài 3 file đã có (README/CLAUDE/HANDOFF).

- **Đăng nhập thật (magic link) để đồng bộ tiến trình học** (đã thuộc từ nào, streak Journey) giữa các thiết bị — hiện chỉ kho từ vựng/bài đọc đồng bộ qua Supabase, tiến trình vẫn theo từng máy (`progressLocal()` = true cho tới khi có đăng nhập thật).
- **Viết bài đọc tay — 2 notebook riêng biệt đang thiếu, ĐỪNG NHẦM LẪN VỚI NHAU:**
  - **(A) "TOEIC_COLOCATION"** (section id `nb_toeic_s2`, 60 Block, `Block 1 → Block 60`). Trạng thái thật (kiểm bằng REST API ngày 2026-09-10, không tin theo trí nhớ của phiên làm việc trước — đã từng bị lệch giữa các file .md): **35/60 Block đã có đủ 3 bài**, **Block 7 và Block 8 mới có 1/3 bài**, **23 Block còn TRỐNG hoàn toàn**: Block 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 34, 35, 43, 44, 45, 53, 54, 55, 56, 57, 58, 59, 60. Kiểm tra nhanh:
    ```bash
    SB_URL="https://pqarpszsipbdugrumhfy.supabase.co"; SB_KEY="<xem js/config.js>"
    curl -s "$SB_URL/rest/v1/blocks?batch_id=in.(nb_toeic_s2_p1_b1,nb_toeic_s2_p2_b1,nb_toeic_s2_p3_b1,nb_toeic_s2_p4_b1,nb_toeic_s2_p5_b1,nb_toeic_s2_p6_b1,nb_toeic_s2_p7_b1,nb_toeic_s2_p8_b1,nb_toeic_s2_p9_b1,nb_toeic_s2_p10_b1)&select=id,name,global_index,context_passage_candidates&order=global_index" -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
    ```
    Ghi thẳng lên Supabase bằng `PATCH .../rest/v1/blocks?id=eq.<id>` với body `{"context_passage_candidates": [...]}` (mảng candidates, KHÔNG phải `context_passage`), KHÔNG cần export/import file JSON.
  - **(B) Section "Loop by Topics"** (id `2a064e84-b574-4c07-8a2d-929f90f70486`, hub TOEIC HUB, notebook "SCENARIO", 8 Page × Block, `Block 104 → Block 149`, 46 Block tổng). Khác notebook (A) ở trên — cấu trúc riêng, đè thẳng lên **`context_passage`** (không phải candidates, đã được người dùng xác nhận trước đó). Trạng thái thật (verify REST API 2026-09-10): **11/46 Block đã có bài Claude thật** (`meta.claude:true`) — trọn 2 topic đầu "01_Doanh nghiệp & Quản trị" (Block 104-109) + "02_Tài chính & Kinh tế" (Block 110-114). **35 Block còn lại chỉ có bài placeholder/cũ**, danh sách đầy đủ (block_id + 10 từ + nghĩa tiếng Việt, không cần query lại Supabase) nằm sẵn trong `tools/_passage_todo.json`, chia theo topic: `03_Công nghệ và dữ liệu` (6 Block, 115-120), `04_Giao tiếp & Đàm phán` (5 Block, 121-125), `05_Tâm lý & Tư duy` (6 Block, 126-131), `06_Sức khỏe & Sinh học` (4 Block, 132-135), `07_Pháp lý, Chính trị & Xã hội` (5 Block, 136-140), `08_Đời sống, Thành ngữ & Môi trường` (9 Block, 141-149, **Block 149 chỉ có 1 từ — "green auditing"**, hỏi lại người dùng có cần viết đủ 500 từ chỉ để nhét 1 từ không). Tooling đã dựng sẵn, dùng lại y nguyên: `tools/_verify_passage.js` (verify Node đúng chuẩn CLAUDE.md) + `tools/_passage_pipeline.py` (hàm `run(out_path, block_id, terms_vi_dict, marked_text, title, source_vi)` gộp ghi JSON case → verify → PATCH thẳng lên Supabase nếu PASS hết). Bài học rút ra: ước lượng số từ trước khi verify hay THIẾU — nhắm ~550-600 từ lúc soạn (không phải đúng 500) để đỡ phải quay lại thêm câu.
  - Cả 2 việc trên dùng chung quy trình viết + verify: xem mục "Khi viết bài đọc tay hàng loạt" trong `CLAUDE.md`.
- **Data quality**: `data/starter.json` (kho mẫu ban đầu) đã được 1 subagent rà soát và sửa 4 notebook bị lỗi xáo trộn cột — còn vài quyết định treo (gán CEFR cho 600 collocation TOEIC, xử lý các dòng "bảng tham chiếu" lẫn trong bảng words) cần người dùng tự quyết, xem log commit tương ứng.
- **Audit UI/UX** (1 subagent, xem log commit "Vá 5 lỗi từ audit UI/UX"): đã vá các lỗi ưu tiên cao (tab treo sau Active Recall Quiz, nút "⋯" vô hình trên Block card, 4 chỗ hardcode màu hex phá theme sáng, thiếu `[data-block]` ở contextmenu, thiếu aria-label). Các mục còn treo trước đây **đã vá xong đêm 08/09** (xem log commit "A11y: vòng focus bàn phím...", "Mobile: nới vùng bấm...", "Thêm thanh loading mảnh..."): (1) `.block-card`/`.jrow`/`.g-row` đã có `tabindex`/`role="button"` + vòng focus bàn phím; (2) `.batches-bar` đã hết chật ở màn hẹp (nới vùng bấm icon-button ~40px + wrap); (3) đã có thanh loading mảnh lúc `boot()` đang tải ở chế độ Cloud/mạng chậm. Chỉ còn treo đúng 1 mục: **(4) chưa có phím tắt cho bài trắc nghiệm** (1-4/A-D chọn đáp án, Enter next).
- **Tab "🎧 Dictation"**: đã code xong + lên live (nghe câu, gõ lại, tự chấm) — xem quyết định phạm vi (không ghi điểm/SRS, chỉ luyện) trong `CLAUDE.md` mục "Quyết định đã chốt".
- **Phiên 2026-09-13 — ĐÃ XONG, đã test bằng Playwright:**
  - **Thêm tiếng Trung (zh) làm ngôn ngữ giao diện thứ 3** (cạnh vi/en) —
    `js/i18n.js` thêm `DICT_ZH`/`REV_ZH`/`PARTIAL_ZH` (dịch ~150 chuỗi UI
    chính: menu, nút, tiêu đề). `translateText`/`applyPartial`/`walk`/
    `I18N.apply`/observer đều đã tổng quát hoá cho 3 ngôn ngữ.
  - **FIX BUG THẬT** phát hiện lúc thêm zh: `Auth.effectiveLang()` fallback
    "en" khi `Auth.user` CHƯA có (đang chờ `Auth.init()` xong) khiến lượt
    dịch ĐẦU TIÊN lúc boot LUÔN chạy nhầm sang "en" trước khi biết ngôn
    ngữ thật — vô hại với vi/en (vì "en" tình cờ đúng cho user "en") nhưng
    HỎNG HẲN với "zh" (dịch nhầm vi->en trước, rồi khi biết đúng là "zh"
    thì DOM đã là "en" chứ không còn "vi", tra `DICT_ZH` (khoá tiếng Việt)
    không khớp gì cả, đứng yên sai). Sửa: fallback về "vi" (khớp đúng
    trạng thái DOM thật lúc đó) — sửa dứt điểm cho mọi ngôn ngữ.
  - **Tự đổi ngôn ngữ trong menu, giống hệt nút sáng/tối** — hàng "Ngôn
    ngữ" mới (`#lang-row`, 3 lá cờ) trong menu user, TỰ ĐỔI NGAY không cần
    qua Admin nữa (Admin panel vẫn còn, giờ dùng để đổi HỘ người khác).
    Cloud mode lưu `profiles.lang` (chạy NỀN, không chờ mạng mới đổi giao
    diện — bài học từ vụ freq/mạng chậm trước đó); Local mode lưu
    localStorage riêng máy đó (`tjwl_local_lang_v1`).
  - **Hồ sơ Local mới** tự đoán ngôn ngữ theo `navigator.language` của
    trình duyệt (vi/zh nhận diện được, còn lại mặc định "en") thay vì
    luôn cứng "en" — CHỈ áp dụng Local mode (Cloud do Admin tạo hộ, máy
    Admin không phản ánh đúng ngôn ngữ người dùng thật, để họ tự đổi lần
    đầu mở link qua nút mới ở trên).
  - **Tab "Nghĩa" thêm lựa chọn "🇨🇳 意思 ZH"** (cạnh VN/EN có sẵn) — cột
    mới `words.meaning_zh` (đã chạy `alter table` trên Supabase thật),
    `Context.enrichWords` giờ cũng tự điền nghĩa tiếng Trung khi thiếu
    (dùng cho "+ Paste từ mới"). PHẠM VI CHỦ Ý HẸP (TJ chốt): CHỈ tab
    Nghĩa đổi, bảng từ vựng chính/PDF export vẫn CHỈ VI/EN như cũ, không
    đổi gì thêm.
  - Đã tự cài lại Playwright (CLI, browser binary vẫn cache từ phiên
    trước) để test: chuyển ngôn ngữ đổi đúng chữ ngay lập tức, tab Nghĩa
    ZH hiện đúng 3 tab + đúng thông báo trống cho Block cũ chưa có dữ
    liệu meaning_zh, insert thật lên Supabase có meaning_zh không lỗi.
  - **Nút xổ xuống chọn ngôn ngữ sát 🌙/☀️** (`#lang-picker`/`#lang-btn`/
    `#lang-dropdown`, TJ yêu cầu "sát nút đổi giao diện" rồi chốt lại
    "chọn 3 ngôn ngữ" — không phải xoay vòng từng bước) — bấm nút (hiện
    lá cờ + ▾) xổ ra đúng 3 lựa chọn 🇻🇳/🇺🇸/🇨🇳 để CHỌN THẲNG, tự đóng sau
    khi chọn, đóng khi bấm ra ngoài (cùng cơ chế mở/đóng với #user-menu).
    Cờ EN đổi thành 🇺🇸 (Mỹ) thay vì 🇬🇧 (Anh) theo yêu cầu, khớp với quy
    ước "US" đã dùng sẵn trong app (giọng đọc "Nghe US", "en-US"...).
    Hàng "Ngôn ngữ" (3 lá cờ) trong menu vẫn còn song song, luôn đồng bộ
    (dùng chung class `.lang-dot`).
  - **FIX BUG THẬT #2** phát hiện lúc test: `I18N.apply()` chỉ dịch TỪ
    tiếng Việt gốc (`DICT`/`DICT_ZH` đều chỉ có chiều "từ vi") — đổi
    THẲNG en→zh (bỏ qua vi ở giữa, xảy ra thật khi chọn 2 ngôn ngữ khác
    "vi" liên tiếp trong dropdown) đứng yên sai ở "en" vì không có bản
    dịch trực tiếp en<->zh. Sửa: `apply()` giờ LUÔN đưa DOM về "vi"
    trước (vô hại/no-op nếu đã sẵn vi) rồi mới dịch sang đích thật —
    đúng với MỌI hướng chuyển đổi. Đã test Playwright qua nhiều lượt
    chọn liên tiếp, ổn định hoàn toàn.
  - **Hướng dẫn sử dụng — ĐÃ TẠO** (không phải Notebook riêng — COMMUNICATION
    hoá ra là 1 NOTEBOOK có sẵn, không phải Hub): thêm 1 Section mới
    "📘 Hướng dẫn sử dụng" ngay bên trong Notebook COMMUNICATION (id
    `c545186c-d218-42a1-9196-03f87df60e4d`) > Page "Bắt đầu" > Batch 1 >
    Block "Giới thiệu ứng dụng". Block này CHÍNH LÀ ví dụ sống — 10 "từ
    vựng" thật ra là 10 THUẬT NGỮ CỦA APP (Hub/Notebook/Batch/Block/full
    batch/karaoke/sticky player/Tony Buzan cycle + 2 thuật ngữ tiếng Anh
    thật collocation/phrasal verb), bài đọc ~520 từ giải thích cách dùng
    app bằng tiếng Việt kèm đoạn hướng dẫn đổi ngôn ngữ vi/en/zh (tính
    năng vừa thêm ở trên). Đã verify bằng Playwright: đúng 10 dòng bảng
    từ, đúng 10 từ được bôi [ngoặc] karaoke, đúng tiêu đề/nội dung khi mở
    Block thật trên app.

- **Phiên 2026-09-13 (tiếp) — ĐANG LÀM DỞ:**
  - **Tên Hub/Notebook/Section/Page/Batch tự đổi theo ngôn ngữ giao diện**
    (TJ yêu cầu: "đổi cờ là phải đồng bộ ... các Page nếu đang có tên
    tiếng Việt thì đổi qua luôn", đã hỏi rõ phạm vi = CẢ 5 cấp Hub/
    Notebook/Section/Page/Batch, không phải chỉ Page). Đã làm: thêm cột
    `name_en`/`name_zh` (`tools/supabase_schema.sql`), helper `displayName(row)`
    trong `js/app.js` (đọc theo `Auth.effectiveLang()`, rơi về `.name` gốc
    nếu ô dịch trống — KHÔNG bao giờ hiện trống trơn) đã nối vào
    `renderHubs`/`renderNotebooks`/`renderSections`/`renderPages`/
    `renderBatches`/`renderCrumb` — chỉ Hub/Notebook/Section/Page/Batch,
    CHỪA RIÊNG Block/Word (tên Block ít ý nghĩa để dịch). Script
    `tools/backfill_names.py` (mẫu y hệt `backfill_meaning_zh.py` đã chạy
    ổn định trước đó) đã viết xong, gọi Gemini dịch hàng loạt, GIỮ NGUYÊN
    tên đã là tiếng Anh/mã/tên riêng, chỉ dịch tên tiếng Việt có nghĩa thật.
    **CÒN THIẾU: (1) chưa chạy migration SQL thật trên Supabase** (đã verify
    bằng `curl` — cột `name_en` CHƯA tồn tại, script sẽ lỗi 42703 nếu chạy
    ngay bây giờ) — cần TJ tự chạy 10 dòng `alter table` trong
    `tools/supabase_schema.sql`, hoặc nhờ chạy hộ; (2) `tools/backfill_names.py`
    chưa test bằng `--limit` nhỏ, chưa chạy full, chưa commit; (3) label
    "Ôn sau N giờ/ngày/tháng/phút" (đếm ngược ôn tập) vẫn CHƯA dịch theo
    ngôn ngữ (còn nguyên tiếng Việt bất kể chọn en/zh) — thiết kế đã có
    (PARTIAL dict prefix/suffix cho en, đảo từ cho zh) nhưng chưa code;
    (4) toast/thông báo nhỏ khác ("đã lưu", "lỗi"...) vẫn hoàn toàn tiếng
    Việt, chưa đụng tới phần này.
  - **FIX BUG THẬT**: "Đang ở Journey, bấm qua Block khác thì không nhảy,
    màn hình vẫn đứng ở Journey, phải bấm lại 📖 Learning mới thoát ra
    (trả về màn danh sách Block, KHÔNG phải đúng Block vừa bấm)" — TJ báo.
    Root cause: `App.jumpTo(opts)` (dùng chung cho Journey/Trang chủ nhảy
    thẳng vào 1 Block) gọi `await App.ensureNotebookContext(...)` (tải
    Notebook đích nếu khác Notebook đang mở) KHÔNG bọc try/catch — mạng
    chậm/lỗi lúc tải (đúng kiểu độ trễ Supabase đã ghi nhận ở phiên
    2026-09-12) khiến `await` NÉM LỖI, cả hàm `async` dừng NGANG giữa
    chừng TRƯỚC đoạn code ẩn `#screen-journey` phía dưới -> kẹt nguyên tại
    Journey, không có thông báo lỗi nào cho biết vì sao. Bấm "Learning"
    sau đó chỉ đơn thuần đóng Journey theo nhánh dự phòng (trả về
    `#screen-blocks`, không phải đúng Block) — đúng y hệt hiện tượng TJ
    mô tả. Đã verify bằng Playwright: cố tình giả lập `DB.loadNotebook`
    ném lỗi cho 1 notebookId giả -> xác nhận đúng lỗi trên (màn kẹt tại
    Journey, promise `App.jumpTo` bị reject không được bắt). Sửa: (1) bọc
    try/catch quanh `ensureNotebookContext` trong `App.jumpTo`, báo lỗi
    bằng `toast` thay vì im lặng treo; (2) luôn chạy tiếp phần dọn màn
    hình bên dưới dù tải lỗi (không kẹt ở Journey nữa); (3) nếu Block đích
    rốt cuộc vẫn chưa có trong `S.blocks` (do bước trên lỗi), chốt cứng
    về `#screen-blocks` thay vì gọi `Detail.open` (vốn sẽ tự lặng lẽ
    không làm gì nếu không tìm thấy Block, để lại màn trắng). Đã verify
    lại bằng Playwright sau khi sửa: giả lập lỗi y hệt -> giờ ra đúng
    toast lỗi + về `#screen-blocks` gọn gàng, không còn kẹt tại Journey.
    File đổi: `js/app.js` (bump `?v=27` trong `index.html`).

- **Phiên 2026-09-12 — ĐÃ XONG (lên live, commit `733ea53`):**
  - Fix DB thiếu cột `words.freq` (chưa từng chạy migration thật) — đã khiến CẢ "+ Paste từ mới" LẪN "✨ Dán bài, tự trích từ" lỗi PGRST204 mỗi lần tạo từ mới.
  - "✨ Dán bài, tự trích từ" giờ tạo thêm 1 Block `full_<tên batch>` đứng đầu batch, chứa TOÀN BỘ từ đã trích + nguyên văn bài đọc (không giới hạn 10 từ như các Block thường).
  - `DB.loadNotebook` (Cloud mode): 5 lần gọi Supabase tuần tự -> 1 request duy nhất (lồng bảng qua FK) — đo thật giảm ~4s còn ~0.8s cho notebook 602 từ. Đây là điểm chậm rõ nhất khi mạng có độ trễ cao.
  - `Context.extractVocab`: prompt cải thiện — đọc từng câu, chủ động tìm phrasal verb/collocation/idiom (không chỉ từ đơn), đảm bảo không bỏ sót B1. Bỏ hẳn khoảng số lượng ước tính theo yêu cầu TJ ("có bao nhiêu thì lấy bấy nhiêu", đừng neo theo mốc nào).
  - Mới: `Context.splitChapters` + UI "📚 Dán cả sách (PDF)" trong modal extract — upload PDF (đọc bằng pdf.js CDN, PHẢI dùng cờ `hasEOL` để dựng lại đúng xuống dòng, nếu không không nhận diện được chapter nào), tự chia theo "Chapter X"/"Chương X", xem trước danh sách, xử lý hàng loạt (mỗi chapter → 1 batch riêng).
  - Bảng từ vựng + bài đọc tạo từ "Dán bài, tự trích từ"/"Dán cả sách" giờ CÓ hiện chi phí/nhà cung cấp (`vocab_fill_meta` + `meta.provider/cost_usd` trong `context_passage`) — trước đó `processArticleToBatch` không đọc `Context._lastProvider/_lastCostUsd` nên badge luôn trống dù AI có tốn tiền hay không.
  - `js/export.js` (Xuất PDF): sửa hộp thoại cảnh báo ">30 Block" đếm THẬT số từ thay vì giả định cứng 10 từ/block (sai lệch với Block `full_...` có thể 30-60+ từ) — đã verify bằng dữ liệu thật, xuất PDF hoạt động bình thường với Block `full_batch`.
  - `tools/manage_users.py`: tự mở Excel bằng đúng lệnh theo OS (Mac/Linux/Windows) thay vì chỉ `os.startfile` (Windows-only).
  - `tools/offline_sync.py` (mới, chưa dùng chính thức): pull/push snapshot 1 user giữa Supabase và bản offline (`TJHUB_OFFLINE`, không nằm trong git) — dựng lúc mạng quá chậm rồi TJ quyết định học online lại, tool vẫn giữ để dùng sau nếu cần.
  - "Thanh điều khiển nghe nổi (sticky player)" — giống mini-player "Listen to Page" của Safari, dùng chung cho CẢ bài đọc LẪN bảng từ vựng (2 chỗ có nút Nghe/Dừng riêng). Bố cục: nút Play tròn trái, tiêu đề + thanh tiến độ giữa, nút "🎤 nhảy tới karaoke" (cuộn thẳng tới đúng chữ/dòng đang sáng — `.kw.on` ở bài đọc, `tr.reading` ở bảng từ vựng) + nút Đóng bên phải.
    - **Điều kiện hiện đúng như TJ yêu cầu**: tự hiện ngay khi cuộn khỏi TẦM NHÌN CỦA HÀNG NÚT Nghe/Dừng (`.audio-toolbar`) — KHÔNG phải khi cả khối nội dung biến mất (bug bản đầu: bài dài cuộn tới giữa chừng, khối nội dung vẫn còn hiện 1 phần nên thanh không hiện dù nút Dừng đã khuất từ lâu — đã sửa bằng cách theo dõi đúng `.audio-toolbar` thay vì cả `#passage-content-block`).
    - `js/speech.js` thêm `S.pause()`/`S.resume()`/`S.getProgress()` (Web Speech API hỗ trợ sẵn pause/resume, không cắt utterance như stop() cũ), áp dụng cho CẢ `readPassage` (bài đọc) lẫn `speakList` (bảng từ vựng) — tiến độ/tổng thời gian là ƯỚC TÍNH (không có API trình duyệt nào trả về giây thật đã đọc), theo công thức ~14.5 ký tự/giây đã dùng ở `startFallbackTimer`.
    - **Đã tự test bằng Playwright (headless Chromium qua CLI, không cần chrome-devtools MCP)** — PASS cả 5 kịch bản: hiện đúng lúc cuộn khỏi hàng nút (kể cả bài dài cuộn giữa chừng), pause, resume, nhảy karaoke (🎤), đóng hẳn (✕). Chưa test tay trên Safari/điện thoại thật — pause/resume của Web Speech API từng có tiếng chập chờn tuỳ trình duyệt, nên vẫn nên thử qua 1 lần trên máy/điện thoại thật trước khi yên tâm hoàn toàn.
  - **Nút "▾ Thu gọn / ▸ Mở rộng" cho bài đọc** (`#btn-toggle-passage`) — y hệt nút đã có sẵn cho bảng từ vựng, đặt trước `#voice-select` trong `.audio-toolbar`. Bài đọc (đặc biệt Block "full_..." dán cả bài báo) có thể rất dài, thu gọn còn 22rem (~352px, có gradient mờ dần ở đáy) đỡ chiếm hết màn hình. Mặc định KHÔNG thu gọn (khác bảng từ vựng mặc định CÓ thu gọn) — bài đọc là nội dung chính cần đọc ngay. Dùng lại đúng 2 chuỗi dịch có sẵn trong `js/i18n.js` ("▾ Thu gọn"/"▸ Mở rộng") nên tự dịch English luôn, không cần thêm dòng DICT mới. Đã test Playwright: bấm thu gọn đúng còn 352px, mở lại đúng về full.
