# TJ WordLoop Hub — Bàn giao nhanh

> **Claude đọc file này**: đây là bàn giao từ 1 phiên làm việc khác trên cùng dự án, cùng người dùng (không phải người lạ). Đọc hết file này, rồi đọc `README.md` + `CLAUDE.md` trong repo trước khi làm gì — 2 file đó có toàn bộ chi tiết kỹ thuật, quy ước, và các quyết định đã chốt (đừng đề xuất lại). Sau đó xử lý tiếp mục "Vấn đề đang dở" bên dưới theo đúng thứ tự ưu tiên, hoặc theo yêu cầu mới của người dùng nếu có.

## Tóm tắt đã làm xong (phiên làm việc trước)
- **Hạ tầng**: tạo repo GitHub private, deploy Netlify, tạo project Supabase + chạy schema (`tools/supabase_schema.sql`), migrate toàn bộ kho từ vựng cũ (3 Hub, 12 Notebook, 382 Page, 569 Batch, 1041 Block, 6988 từ) lên Supabase, cấu hình `js/config.js` để app chạy chế độ Cloud.
- **Data quality**: 1 subagent rà soát `data/starter.json`, sửa 4 notebook bị lỗi xáo trộn cột (term/level/pos/ipa/def_en/meaning_vi lộn chỗ nhau), xoá 20 dòng rác, sửa 3 IPA sai.
- **Tính năng bài đọc**: bỏ hẳn bộ mẫu câu cứng cũ (lặp lại, vô nghĩa) và tiêu đề giả; thay bằng khu chọn nguồn LUÔN hiện (1 hàng tab **"📝 Dán" + "Claude 1/2/3"**) — chọn xem trước rồi bấm "Dùng bài này" mới áp dụng; nút "🔄 Tạo lại" ở trên vẫn gọi AI (Gemini/OpenAI) nếu có key.
- **3 kiểu bài kiểm tra**: Phiếu đầy đủ (giữ nút Nộp bài), Từng câu + Nghĩa (tự chấm câu cuối, không cần nút Nộp bài). "✓ Done" trên Block hiện khi 1-trong-3 thẻ đạt ≥80%.
- **Journey** (icon 📊 cạnh nút đổi giao diện): tổng quan + lịch học 28 ngày (xanh = học hôm đó, đỏ = quá hạn ôn — tính sống).
- **Đánh số Block**: đã audit toàn bộ 12 notebook — tất cả đều liên tục từ 1, không trùng/thiếu số (không cần sửa gì thêm).
- **Notebook "TJ HUB TEST" đổi tên thành "TOEIC_COLOCATION"** (id section `nb_toeic_s2`, 60 Block) — đã renumber Block 102→161 thành Block 1→60. Đã viết xong bài đọc Claude cho **Block 1 và Block 2** (mỗi Block 3 bài khác nhau, lưu ở `context_passage_candidates`), verify bằng Node trước khi đẩy lên Supabase qua REST API trực tiếp (không cần export/import file .json nữa).
- Viết `README.md` (tài liệu tổng thể) + `CLAUDE.md` (quyết định đã chốt, lỗi đã sửa, checklist viết bài đọc) trong repo.

## Đường dẫn
- **Code (GitHub, PUBLIC** — chuyển từ private để dùng GitHub Pages miễn phí, đã rà soát không lộ key gì): https://github.com/teoteo1081/tj-wordloop-hub
- **Web live (GitHub Pages, chính)**: https://teoteo1081.github.io/tj-wordloop-hub/ — chỉ cần `git push` là tự build lại, không cần lệnh deploy riêng
- **Web live (Netlify, dự phòng — đang tạm ngưng deploy vì team hết hạn mức tháng)**: https://tj-wordloop-hub.netlify.app
- **Supabase project**: `pqarpszsipbdugrumhfy` (Singapore) — https://supabase.com/dashboard/project/pqarpszsipbdugrumhfy — nhớ Redirect URLs (Authentication → URL Configuration) đã có cả 3: localhost, Netlify, và GitHub Pages

## Khoá cấu hình (đã có sẵn trong `js/config.js`, đã commit)
```
SUPABASE_URL: https://pqarpszsipbdugrumhfy.supabase.co
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYXJwc3pzaXBiZHVncnVtaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDc0NTcsImV4cCI6MjEwNDI4MzQ1N30.zB6uvPPt-vQ78TVwPUTMmfulbFVz-lNz9F5RJF9owwc
```
Đây là **anon public key** (an toàn để dùng client-side, bị chặn bởi RLS) — KHÔNG phải service_role/secret. Không cần đổi.

## Chạy local
```bash
cd TJHUB
python3 -m http.server 8934
# mở http://localhost:8934 — KHÔNG mở bằng file://
```
Deploy lại sau khi sửa (GitHub Pages tự build khi push, không cần lệnh riêng):
```bash
git add -A && git commit -m "..." && git push
```
Muốn deploy thêm sang Netlify (khi hết hạn mức) thì `netlify deploy --prod --dir=.` (cần `netlify login` một lần nếu máy mới — CLI đã cài qua `brew install netlify-cli`, `gh`, `supabase`; supabase CLI không dùng, chỉ gọi REST API trực tiếp qua `curl`/`requests`).

## Đọc thêm
- `README.md` — tài liệu đầy đủ (kiến trúc, cách bài đọc hoạt động, 3 kiểu thi, SRS, Journey...)
- `CLAUDE.md` — quyết định đã chốt (đừng đề xuất lại), lỗi đã sửa (đừng lặp lại), checklist viết bài đọc

## ⚠️ Vấn đề đang dở — CẦN LÀM TIẾP
1. **Bug đồng bộ Local↔Cloud chưa xác định nguyên nhân**: trình duyệt laptop của user bị kẹt ở mode "Local" dù `config.js` đã có key Supabase hợp lệ (đã test bằng `curl` xác nhận API/RLS hoạt động tốt). Nghi ngờ: cache trình duyệt/service worker (`sw.js`, chiến lược network-first nhưng chưa chắc hoạt động đúng), hoặc script CDN Supabase-js bị chặn tải, hoặc lỗi JS im lặng trong `DB.init()` (`js/db.js`, có `try/catch` nuốt lỗi — nên tạm bỏ catch hoặc thêm `console.error` để soi). Cách tái hiện: mở `localhost:8934`, xem chữ mode-pill góc phải trên (cạnh nút 🌙) — nếu ghi "Local" là còn bug. Điện thoại (Netlify, máy mới hoàn toàn) thì vào Cloud bình thường — nên nghi vấn nằm ở cache/service-worker của riêng trình duyệt laptop đó.
2. **Viết bài đọc Claude cho notebook "TOEIC_COLOCATION"** (`hub_toeic_hub` → section `nb_toeic_s2`): đã xong **Block 1 và Block 2** (mỗi Block 3 bài, lưu trong cột `blocks.context_passage_candidates` — mảng jsonb, mỗi phần tử là 1 bài full định dạng `[term] + META_SEP + JSON meta {claude:true, vi, title, source}`), còn thiếu Block 3, 4, 6→60 (56 Block). Quy trình + khuôn mẫu đầy đủ nằm trong `CLAUDE.md` mục "Khi viết bài đọc tay hàng loạt". Ghi trực tiếp lên Supabase bằng `PATCH .../rest/v1/blocks?id=eq.<id>` với `context_passage_candidates`, KHÔNG cần export/import file JSON nữa (đã bỏ cách đó).
3. **Đăng nhập thật (magic link)** để đồng bộ tiến trình học (đã thuộc từ nào, streak Journey) — hiện chưa làm, chỉ kho từ vựng/bài đọc đồng bộ qua Supabase.
