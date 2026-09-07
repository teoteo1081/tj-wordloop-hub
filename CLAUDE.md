# CLAUDE.md — ngữ cảnh cho Claude Code khi làm việc trong repo này

Đọc `README.md` trước để hiểu tổng thể app. File này chỉ ghi thêm những điều **không hiển nhiên từ code**, các quyết định thiết kế đã tranh luận qua lại nhiều lần, và các lỗi đã sửa để tránh lặp lại.

## Nguyên tắc chung khi sửa app này
- **Không có build step.** Sửa file trong `js/`/`css/`/`index.html` là có hiệu lực ngay, chỉ cần refresh trình duyệt (`localhost:8934`, server: `python3 -m http.server 8934` chạy từ thư mục `TJHUB`). Không bao giờ mở bằng `file://`.
- **Verify bằng Node trước khi giao việc**, đặc biệt với `context.js` (bài đọc/đề thi): `require()` thẳng file JS trong Node, shim `global.window`/`localStorage`/`fetch` tối thiểu cần thiết. Cách này đã bắt được nhiều bug thật (xem "Lỗi đã sửa" bên dưới) mà đọc code suông không thấy.
- Người dùng **rất dị ứng với nội dung tự sinh lặp lại/vô nghĩa** — đã từng phàn nàn nhiều lần về bộ mẫu câu cứng (OPENERS/MIDDLES/TITLES cố định trong `context.js`). Bộ này đã bị xoá hẳn (không còn là fallback). **Đừng thêm lại kiểu "mảng cố định chọn theo seed" cho bất cứ nội dung hiển thị nào** (tiêu đề, câu văn...) — nếu không có nội dung thật thì để trống, đừng bịa.
- Trước khi sửa dữ liệu người dùng (starter.json, hoặc bất kỳ export/import nào), **backup trước** (`cp file file.bak-$(date +%Y%m%d-%H%M%S)`).
- `data/starter.json` và `data/starter.version.json` có field `version` **PHẢI luôn khớp nhau tuyệt đối** — lệch 1 ký tự cũng gây bug vòng lặp "Thư viện có bản mới" vô hạn (đã xảy ra thật, xem lịch sử commit).

## Kiến trúc tóm tắt (chi tiết xem README.md)
- `js/db.js` là lớp duy nhất biết dữ liệu nằm ở local hay Supabase (`DB.mode`). Code khác **không bao giờ** đọc `localStorage` trực tiếp hay gọi Supabase trực tiếp — luôn qua `DB.xxx()`.
- `S` (định nghĩa trong `app.js`, dùng chung sang `detail.js`) chỉ chứa dữ liệu của **Notebook đang mở** (`S.blocks`/`S.words`/`S.wp`/`S.bp`), KHÔNG phải toàn bộ app. Cần thống kê toàn app (vd Journey) phải gọi hàm riêng đọc thẳng `local()`/Supabase toàn cục (`DB.getJourneySummary`), không dùng `S`.
- Mỗi Block: `context_passage` (bài đang dùng, DUY NHẤT) + `context_passage_candidates` (mảng ≤3 bài Claude viết sẵn, chỉ để chọn thử — không tự áp dụng).
- `Context.parseMeta(raw)` trả về `{marked, vi, title, source, ai, pasted, claude}` — 3 cờ `ai`/`pasted`/`claude` loại trừ lẫn nhau, dùng để: (a) hiện badge đúng nguồn gốc bài đọc, (b) cleanup sweep trong `db.js` biết bài nào là "rác" (không cờ nào = mẫu cứng cũ, xoá).

## Lỗi đã sửa — đừng lặp lại
- `_markTerms` xử lý sai nếu từ ngắn là substring của từ dài hơn trong cùng danh sách (vd "cost" bên trong "irreversible cost") → **luôn sort terms dài nhất trước** khi bọc `[ngoặc]`.
- `gapSentences` dùng regex tách câu theo `.!?` bỏ sót đoạn cuối không có dấu câu kết thúc (transcript/bài báo dán vào hay bị cắt giữa chừng) → phải xử lý phần dư sau vòng lặp regex chính.
- `applyStarter()` (merge thư viện mẫu mới) từng **ghi đè luôn field `hub_id`/`notebook_id`/... của user** nếu user đã tự di chuyển Hub/Notebook/Section — phải so sánh field cha giữa bản local và bản fresh, giữ bản local nếu khác.
- `applyStarter()` cũng từng **hồi sinh item đã xoá** nếu chúng nằm trong thư viện mẫu mới — phải có "tombstone" (`tjwl_deleted_ids_v1`) lọc ra trước khi merge.
- `Context.parseMeta` từng khai báo field `pasted` khi TẠO bài dán nhưng **quên trả field đó ra** khi ĐỌC lại → badge "📝 Tự dán" không bao giờ hiện, âm thầm hỏng từ lúc thêm tính năng.
- PostgREST bulk insert (`POST .../rest/v1/<table>` với body là mảng) **yêu cầu MỌI object trong mảng có cùng bộ khoá tuyệt đối** (suy cột từ object đầu tiên) — object thiếu/thừa 1 key so với các object khác trong cùng mảng là lỗi `PGRST102 "All object keys must match"`. Luôn chuẩn hoá (fill đủ key, kể cả `null`/`[]`) trước khi insert hàng loạt.
- Đừng nhầm `sb_secret_...` (service_role, toàn quyền, chỉ dùng server) với `sb_publishable_...`/`anon` JWT (an toàn client-side) — Supabase dashboard mới hiển thị cả 2 loại key rất giống nhau về vị trí, dễ user gửi nhầm. Luôn **decode JWT payload kiểm tra `role: anon`** trước khi tin key người dùng gửi (base64 phần giữa 2 dấu `.`).

## Quyết định đã chốt (đừng đề xuất lại)
- **KHÔNG** có UI chọn độ khó Dễ/Vừa/Khó cho bài đọc (đã làm rồi bị yêu cầu bỏ — "hong có tác dụng"). Thay vào đó là 1 hàng tab **"📝 Dán" + "Claude 1/2/3"** (`#src-tabs`/`#src-body` trong `detail.js`, hàm `D.renderSourcePicker`) — LUÔN hiện (không ẩn khi đã có bài đọc), chọn tab nào xem trước tab đó rồi bấm chung 1 nút "Dùng bài này" mới đẩy lên. Không có nút "Nhờ AI viết" riêng ở khu này — dùng "🔄 Tạo lại" ở đầu card bài đọc.
- **KHÔNG** tự động luân phiên bài đọc theo chu kỳ ôn (đã thử, bị thay bằng picker thủ công ở trên).
- **KHÔNG** tự fallback về mẫu câu cứng khi chưa có AI/chưa dán bài — thà để trống.
- Số Block là `global_index`, **KHÔNG trùng nhau xuyên suốt cả Notebook** (đã thử đánh lại từ 1 mỗi Batch rồi bị yêu cầu revert — "để dễ nhớ/dễ nhắc tên 1 Block cụ thể"). Vị trí (Batch/Page nào) đã có breadcrumb lo, không cần nhét vào tên Block.
- "Done" trên Block = **1 trong 3** thẻ bài tập đạt ≥80% — và từ giờ **CẢ 3 THẺ ĐỀU đẩy chu kỳ SRS thật** (`bp.passed`), kể cả Nghĩa (đã đổi: trước đây chỉ Phiếu đầy đủ/Từng câu mới đẩy SRS, Nghĩa chỉ set `meaning_passed` — user yêu cầu đổi vì thấy mâu thuẫn "Done nhưng chưa vào chu kỳ ôn").
- **Học sớm (trước `next_review_at`) vẫn được và vẫn ghi điểm, nhưng KHÔNG đẩy chu kỳ ôn lên sớm** (`srsAdvanceIfDue()` trong `detail.js`) — tránh cày nhiều lần trong ngày để nhảy cóc lịch Tony Buzan. Có nới 1 tiếng (`SRS_GRACE_MS`): ôn sớm hơn hạn ≤1 tiếng vẫn tính đúng hạn.
- Mỗi lần THẬT SỰ đẩy chu kỳ được ghi vào `bp.review_history` ([{step, at}]) — tab Tiến trình dùng cái này để hiện đúng ngày giờ đã ôn từng lần, không chỉ dấu ✓ chung chung.
- Từng câu/Nghĩa: câu cuối trả lời xong (đúng hay sai) là **tự chấm luôn**, không cần nút "Nộp bài" — chỉ Phiếu đầy đủ giữ nút Nộp bài tường minh.
- Đọc bài/bảng từ vựng: **user tự cuộn đi đâu thì để yên hẳn** cho tới lần bấm nghe tiếp theo (`speech.js` — cờ `userTookControl`, không phải hẹn giờ 1.5s như trước) — chữ vẫn sáng theo giọng đọc, chỉ riêng việc tự cuộn màn hình là dừng.
- **Repo đã chuyển PUBLIC** (từ private) để dùng GitHub Pages miễn phí — đã rà soát kỹ toàn bộ lịch sử git, không có key/credential nhạy cảm nào (xem README.md mục Triển khai). Host chính giờ là GitHub Pages (`https://teoteo1081.github.io/tj-wordloop-hub/`, tự build khi push, không cần lệnh deploy riêng); Netlify giữ làm dự phòng.

## Khi viết bài đọc tay hàng loạt (nếu được yêu cầu tiếp)
1. Lấy đúng danh sách 10 từ của Block (từ export JSON của user hoặc Supabase).
2. Viết theo đúng schema `Context.parseMeta` mong đợi (xem README, mục "Bài đọc ngữ cảnh"). Set `meta.claude = true`.
3. **Bắt buộc verify bằng Node** trước khi giao: `Context.gapSentences()` phải ra đúng 10 câu, đủ 10 term, không trùng; `Context.translate()` phải tìm được bản dịch cho mọi câu qua `meta.vi`; đếm từ bằng `Context.build().plain.split(/\s+/).length` để chắc ~500 từ.
4. Ghi vào `context_passage_candidates` (mảng), **KHÔNG** ghi thẳng vào `context_passage` trừ khi user xác nhận Block đó đang trống và muốn dùng luôn.
5. Nếu build file JSON để user import: **luôn dùng bản export MỚI NHẤT làm gốc** (`📂/💾` trong app là THAY THẾ TOÀN BỘ, không merge) — hỏi lại nếu nghi ngờ user đã tự sửa gì từ lúc export cũ, đừng đè mất.
