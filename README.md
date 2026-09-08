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

Chọn tab nào thì xem trước tab đó, bấm **"✅ Dùng bài này"** mới đẩy lên chính thức. Muốn nhờ AI viết bài mới thì dùng nút **"🔄 Tạo lại"** ở đầu card bài đọc (chỉ chạy khi có `GEMINI_API_KEY`/`OPENAI_API_KEY` trong `keys.local.js`, ưu tiên Gemini free nhưng ~20 request/ngày với tài khoản mới).

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
- `js/keys.local.js` — **gitignored**, không commit. Có `GEMINI_API_KEY`/`OPENAI_API_KEY`. Đổi máy phải tự chép lại file này.
- `js/config.js` — **có commit** (repo private). `SUPABASE_ANON_KEY` an toàn để lộ (chặn bởi RLS). **Tuyệt đối không** đặt `service_role`/`sb_secret_...` vào đây.

## Việc còn dang dở
- **Đăng nhập thật (magic link) để đồng bộ tiến trình học** (đã thuộc từ nào, streak Journey) giữa các thiết bị — hiện chỉ kho từ vựng/bài đọc đồng bộ qua Supabase, tiến trình vẫn theo từng máy (`progressLocal()` = true cho tới khi có đăng nhập thật).
- **Viết bài đọc tay cho các Block còn lại** của notebook **"TOEIC_COLOCATION"** (section id `nb_toeic_s2`, 60 Block, `Block 1 → Block 60`). Trạng thái thật (kiểm bằng REST API, không tin theo trí nhớ của phiên làm việc trước — đã từng bị lệch giữa các file .md): **35/60 Block đã có đủ 3 bài** (nhiều phiên làm song song đã góp phần), **Block 7 và Block 8 mới có 1/3 bài** (làm trong phiên này, đã verify cấu trúc + bản dịch rồi mới đẩy lên — nên viết thêm 2 bài nữa cho đủ bộ 3 khi rảnh), **23 Block còn TRỐNG hoàn toàn**: Block 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 34, 35, 43, 44, 45, 53, 54, 55, 56, 57, 58, 59, 60. Cách kiểm tra nhanh trạng thái + lấy từ vựng của các Block trống, không cần dò tay:
  ```bash
  SB_URL="https://pqarpszsipbdugrumhfy.supabase.co"; SB_KEY="<xem js/config.js>"
  curl -s "$SB_URL/rest/v1/blocks?batch_id=in.(nb_toeic_s2_p1_b1,nb_toeic_s2_p2_b1,nb_toeic_s2_p3_b1,nb_toeic_s2_p4_b1,nb_toeic_s2_p5_b1,nb_toeic_s2_p6_b1,nb_toeic_s2_p7_b1,nb_toeic_s2_p8_b1,nb_toeic_s2_p9_b1,nb_toeic_s2_p10_b1)&select=id,name,global_index,context_passage_candidates&order=global_index" -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY"
  ```
  Quy trình viết + verify: xem mục "Khi viết bài đọc tay hàng loạt" trong `CLAUDE.md`. Ghi thẳng lên Supabase bằng `PATCH .../rest/v1/blocks?id=eq.<id>` với body `{"context_passage_candidates": [...]}`, KHÔNG cần export/import file JSON.
- **Data quality**: `data/starter.json` (kho mẫu ban đầu) đã được 1 subagent rà soát và sửa 4 notebook bị lỗi xáo trộn cột — còn vài quyết định treo (gán CEFR cho 600 collocation TOEIC, xử lý các dòng "bảng tham chiếu" lẫn trong bảng words) cần người dùng tự quyết, xem log commit tương ứng.
- **Audit UI/UX** (1 subagent, xem log commit "Vá 5 lỗi từ audit UI/UX"): đã vá các lỗi ưu tiên cao (tab treo sau Active Recall Quiz, nút "⋯" vô hình trên Block card, 4 chỗ hardcode màu hex phá theme sáng, thiếu `[data-block]` ở contextmenu, thiếu aria-label). Còn treo (chưa làm, cần đầu tư nhiều hơn 1-2 tiếng): (1) các phần tử bấm-được dạng `<div>` (`.block-card`, `.jrow`, `.g-row`) chưa có `tabindex`/`role="button"` nên không dùng bàn phím/trình đọc màn hình mở Block được; (2) `.batches-bar` chưa có `flex-wrap`/rút gọn chữ cho màn hẹp, dễ chật khi nhiều nút cùng hàng; (3) chưa có trạng thái "Đang tải…" rõ ràng lúc `boot()` chạy ở chế độ Cloud/mạng chậm; (4) chưa có phím tắt cho bài trắc nghiệm (1-4/A-D chọn đáp án, Enter next).
