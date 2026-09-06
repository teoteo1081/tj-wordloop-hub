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
| Code (GitHub, private) | https://github.com/teoteo1081/tj-wordloop-hub |
| Web live (Netlify) | https://tj-wordloop-hub.netlify.app |
| Database dùng chung (Supabase) | project `pqarpszsipbdugrumhfy`, region Singapore |

Deploy lại sau khi sửa code:
```bash
git add -A && git commit -m "..." && git push
netlify deploy --prod --dir=.
```

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

**Không tự sinh bài khi mở Block** — trống thì hiện 3 lựa chọn (đều KHÔNG bắt buộc):
1. **"Claude 1/2/3"** — nếu Block có `context_passage_candidates` (mảng tối đa 3 bài Claude viết tay sẵn), hiện nút chọn xem trước rồi "Dùng bài này" mới đẩy lên chính thức. Đây là cách **KHÔNG tốn quota AI**.
2. **"✨ Nhờ AI viết"** — chỉ chạy khi có `GEMINI_API_KEY`/`OPENAI_API_KEY` trong `keys.local.js`. Ưu tiên Gemini (free, nhưng ~20 request/ngày với tài khoản mới).
3. **Dán bài của riêng bạn** vào ô — app tự bôi `[ngoặc]` đúng các từ của Block bằng `Context._markTerms()`.

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
Icon 📊 trên thanh trên cùng, trước nút đổi giao diện. Nhìn xuyên suốt MỌI Hub/Notebook (khác tab "Tiến trình" trong Block, chỉ xem 1 Block).
- **Xanh** = số từ "học" hôm đó, cộng dồn mỗi lần 1 trong 3 thẻ bài tập đạt ≥ 80% (`DB.bumpLearnedToday`, lưu `daily_log`).
- **Đỏ** = số từ đang **quá hạn ôn** — tính SỐNG mỗi lần mở màn Journey (không phải nhật ký cố định), dựa vào `bp.next_review_at` đã trôi qua mà chưa ôn lại.

## Cách thêm từ vựng mới
- **"+ Paste từ mới"**: dán danh sách từ (mỗi dòng 1 từ, các cột cách nhau `|` hoặc tab) → tự cắt Block 10 từ/batch mới, đánh số lại từ 1. Có key AI thì tự tra điền nốt cột thiếu (level/pos/ipa/def_en/meaning_vi).
- **"✨ Dán bài, tự trích từ"**: dán bài báo/transcript YouTube → AI trích từ vựng B1+ → tự tạo Block.
- **Lưu từ khi đọc** (kiểu LingQ): bôi/bấm từ trong bài đọc → lưu vào Batch "⭐ Từ đã lưu" của Page hiện tại, đủ 10 từ tự sang Block mới (đánh số tiếp theo Block cũ nhất trong batch đó, không nhảy về 1 nếu batch đã có số).

## Khoá API / bí mật
- `js/keys.local.js` — **gitignored**, không commit. Có `GEMINI_API_KEY`/`OPENAI_API_KEY`. Đổi máy phải tự chép lại file này.
- `js/config.js` — **có commit** (repo private). `SUPABASE_ANON_KEY` an toàn để lộ (chặn bởi RLS). **Tuyệt đối không** đặt `service_role`/`sb_secret_...` vào đây.

## Việc còn dang dở
- **Đăng nhập thật (magic link) để đồng bộ tiến trình học** (đã thuộc từ nào, streak Journey) giữa các thiết bị — hiện chỉ kho từ vựng/bài đọc đồng bộ qua Supabase, tiến trình vẫn theo từng máy.
- **Viết bài đọc tay cho các Block còn lại** của notebook "TJ HUB TEST" (mới xong Block 102, 106 — làm mẫu) — theo yêu cầu: mỗi Block 3 bài ~500 từ khác nhau (không phải phân theo độ khó), lưu vào `context_passage_candidates`, KHÔNG tự động áp dụng, để người dùng chọn qua nút "Claude 1/2/3".
- **Data quality**: `data/starter.json` (kho mẫu ban đầu) đã được 1 subagent rà soát và sửa 4 notebook bị lỗi xáo trộn cột — còn vài quyết định treo (gán CEFR cho 600 collocation TOEIC, xử lý các dòng "bảng tham chiếu" lẫn trong bảng words) cần người dùng tự quyết, xem log commit tương ứng.
