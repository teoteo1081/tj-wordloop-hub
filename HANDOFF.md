# TJ WordLoop Hub — Bàn giao nhanh

## Đường dẫn
- **Code (GitHub, private)**: https://github.com/teoteo1081/tj-wordloop-hub
- **Web live (Netlify)**: https://tj-wordloop-hub.netlify.app
- **Supabase project**: `pqarpszsipbdugrumhfy` (Singapore) — https://supabase.com/dashboard/project/pqarpszsipbdugrumhfy

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
Deploy lại sau khi sửa:
```bash
git add -A && git commit -m "..." && git push
netlify deploy --prod --dir=.
```
(Cần `netlify login` một lần nếu máy mới — CLI đã cài qua `brew install netlify-cli`, `gh`, `supabase` (không dùng supabase CLI, chỉ dùng REST API trực tiếp qua `curl`/`requests`).)

## Đọc thêm
- `README.md` — tài liệu đầy đủ (kiến trúc, cách bài đọc hoạt động, 3 kiểu thi, SRS, Journey...)
- `CLAUDE.md` — quyết định đã chốt (đừng đề xuất lại), lỗi đã sửa (đừng lặp lại), checklist viết bài đọc

## ⚠️ Vấn đề đang dở — CẦN LÀM TIẾP
1. **Bug đồng bộ Local↔Cloud chưa xác định nguyên nhân**: trình duyệt laptop của user bị kẹt ở mode "Local" dù `config.js` đã có key Supabase hợp lệ (đã test bằng `curl` xác nhận API/RLS hoạt động tốt). Nghi ngờ: cache trình duyệt/service worker (`sw.js`, chiến lược network-first nhưng chưa chắc hoạt động đúng), hoặc script CDN Supabase-js bị chặn tải, hoặc lỗi JS im lặng trong `DB.init()` (`js/db.js`, có `try/catch` nuốt lỗi — nên tạm bỏ catch hoặc thêm `console.error` để soi). Cách tái hiện: mở `localhost:8934`, xem chữ mode-pill góc phải trên (cạnh nút 🌙) — nếu ghi "Local" là còn bug. Điện thoại (Netlify, máy mới hoàn toàn) thì vào Cloud bình thường — nên nghi vấn nằm ở cache/service-worker của riêng trình duyệt laptop đó.
2. **Viết bài đọc Claude cho notebook "TOEIC_COLOCATION"** (`hub_toeic_hub` → section `nb_toeic_s2`): đã xong **Block 1 và Block 2** (mỗi Block 3 bài, lưu trong cột `blocks.context_passage_candidates` — mảng jsonb, mỗi phần tử là 1 bài full định dạng `[term] + META_SEP + JSON meta {claude:true, vi, title, source}`), còn thiếu Block 3, 4, 6→60 (56 Block). Quy trình + khuôn mẫu đầy đủ nằm trong `CLAUDE.md` mục "Khi viết bài đọc tay hàng loạt". Ghi trực tiếp lên Supabase bằng `PATCH .../rest/v1/blocks?id=eq.<id>` với `context_passage_candidates`, KHÔNG cần export/import file JSON nữa (đã bỏ cách đó).
3. **Đăng nhập thật (magic link)** để đồng bộ tiến trình học (đã thuộc từ nào, streak Journey) — hiện chưa làm, chỉ kho từ vựng/bài đọc đồng bộ qua Supabase.
