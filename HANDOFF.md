# TJ WordLoop Hub — Bàn giao nhanh

> **Claude đọc file này**: đây là bàn giao từ 1 phiên làm việc khác trên cùng dự án, cùng người dùng (không phải người lạ). Đọc hết file này, rồi đọc `README.md` + `CLAUDE.md` trong repo trước khi làm gì — 2 file đó có toàn bộ chi tiết kỹ thuật, quy ước, và các quyết định đã chốt (đừng đề xuất lại). Sau đó xử lý tiếp mục "Vấn đề đang dở" bên dưới theo đúng thứ tự ưu tiên, hoặc theo yêu cầu mới của người dùng nếu có. File này thay thế bản `HANDOFF.md` cũ hơn (một số con số trong bản cũ — vd tiến độ viết bài đọc — đã bị lệch so với Supabase thật, phiên này đã kiểm lại bằng REST API trước khi ghi số liệu bên dưới).

## Tóm tắt phiên làm việc gần nhất (rất dài, nhiều yêu cầu dồn dập)
- **Fix bug nghiêm trọng**: `DB.getFullTree` (dùng cho cây Journey) từng check sai `DB.mode` thay vì `progressLocal()`, gửi id hồ sơ local (không phải uuid) lên Supabase → lỗi `invalid input syntax for type uuid`, sập cả cây Journey khi kho từ vựng là Cloud nhưng chưa đăng nhập thật. Đã sửa + verify bằng Node.
- **Redesign Journey**: Tổng quan giờ luôn là số TOÀN APP; KPI đầu = Đã thuộc/Đã học/Tổng từ; 4 chip + 4 tab theo giai đoạn Tony Buzan (mỗi tab liệt kê Block đến hạn ôn ngay / đã ôn chờ hạn kế, theo Block không theo từng từ); màn hình chia 2 khung song song (trạng thái | cây thư mục); chú thích cho lịch 28 ngày.
- **`js/ticker.js` (mới)**: thanh "đánh máy" nổi, chạy các từ đã học trong cả Notebook đang mở, dạng băng chuyền nhiều chip màu (không phải gõ-xoá 1 từ) — đã qua vài vòng chỉnh theo phản hồi trực tiếp, xem chi tiết + lý do trong CLAUDE.md.
- **Thêm rồi bị revert** (đã làm xong, đã đảo lại về nguyên bản theo yêu cầu — ĐỪNG LÀM LẠI, xem CLAUDE.md mục "Quyết định đã chốt"): dashboard lọc Block theo trạng thái (bấm số trong ô cảnh báo để lọc `#blocks-list`), dropdown sắp xếp Block theo trạng thái ôn, mũi tên Batch trước/sau đặt cạnh tiêu đề "Batch 1".
- **Vẫn giữ**: `App.flattenBatches`/`App.stepBatch` (duyệt Batch xuyên Page/Notebook cùng Hub) — dùng cho nút Block trước/sau trong Chi tiết Block; Batch đang chọn hiện trong breadcrumb trên cùng; vocab-chip mỗi Block card giới hạn 4 từ + "+N từ" (đỡ mỗi card cao lênh khênh khi list dài); đổi icon Notebook được luôn lúc đổi tên (trước đây chỉ chọn được lúc tạo mới).
- **Gọn hoá mobile**: bài Nghĩa/Từng câu (chữ + đáp án) thu nhỏ vừa 1 màn hình; breadcrumb/vocab-chips không xuống hàng nữa, tự rút gọn/cuộn ngang; 2 nút Paste chỉ còn icon trên mobile.
- **1 subagent audit UI/UX toàn app** (đọc code, không có trình duyệt thật) — đã vá ngay 5 lỗi ưu tiên cao tìm được: nút "🎯 Vào bài thi cuối bài" gọi sai id tab làm treo màn hình, nút "⋯" trên Block card vô hình do CSS, 4 chỗ hardcode màu hex phá theme sáng, contextmenu thiếu `[data-block]`, thiếu aria-label cho vài icon-button chủ lực. Còn vài việc audit đề xuất nhưng CHƯA làm (cần đầu tư nhiều hơn) — xem README.md mục "Việc còn dang dở", phần cuối.
- **Viết thêm bài đọc Claude**: Block 7 và Block 8 của "TOEIC_COLOCATION" mỗi Block mới có 1/3 bài (đã verify kỹ + đẩy lên Supabase). Trạng thái thật của cả 60 Block: 35 đã đủ 3 bài, 2 mới 1/3 (Block 7, 8), 23 còn trống hoàn toàn — danh sách chính xác + lệnh query trong README.md.

## Đường dẫn
- **Code (GitHub, PUBLIC**): https://github.com/teoteo1081/tj-wordloop-hub
- **Web live (GitHub Pages, chính)**: https://teoteo1081.github.io/tj-wordloop-hub/ — chỉ cần `git push` là tự build lại
- **Web live (Netlify, dự phòng)**: https://tj-wordloop-hub.netlify.app — kiểm tra kỹ site này có đang chạy ĐÚNG commit mới nhất không trước khi dùng nó để test/chụp ảnh báo bug (từng bị nghi ngờ đứng ở bản cũ do tài khoản Netlify hết hạn mức tháng), ưu tiên test trên GitHub Pages hoặc `localhost:8934`.
- **Supabase project**: `pqarpszsipbdugrumhfy` (Singapore) — https://supabase.com/dashboard/project/pqarpszsipbdugrumhfy

## Khoá cấu hình (đã có sẵn trong `js/config.js`, đã commit)
Xem trực tiếp `js/config.js` — là **anon public key** (an toàn client-side, bị chặn bởi RLS), không phải service_role/secret. Không cần đổi. Dùng key này để query REST API trực tiếp bằng `curl` khi cần (vd lấy từ vựng 1 Block, kiểm tra `context_passage_candidates`) — nhanh hơn nhiều so với export/import file JSON qua UI.

## Chạy local
```bash
cd TJHUB
python3 -m http.server 8934
# mở http://localhost:8934 — KHÔNG mở bằng file://
```
Deploy lại sau khi sửa (GitHub Pages tự build khi push):
```bash
git add -A && git commit -m "..." && git push
```

## Đọc thêm
- `README.md` — tài liệu đầy đủ (kiến trúc, Journey, ticker, 3 kiểu thi, SRS, việc còn dang dở kèm số liệu chính xác + lệnh query)
- `CLAUDE.md` — quyết định đã chốt (đừng đề xuất lại, kể cả những cái đã làm rồi bị revert), lỗi đã sửa (đừng lặp lại), checklist viết bài đọc (đã cập nhật kỹ hơn bản trước)

## ⚠️ Vấn đề đang dở — CẦN LÀM TIẾP (theo thứ tự ưu tiên)
1. **Viết bài đọc Claude cho 23 Block còn trống hoàn toàn** của "TOEIC_COLOCATION" (danh sách + lệnh lấy từ vựng: README.md mục "Việc còn dang dở") + viết thêm 2 bài nữa cho Block 7, 8 (mới có 1/3). Quy trình đầy đủ đã viết lại chi tiết trong CLAUDE.md — đọc kỹ mục "Tránh chữ viết tắt có dấu chấm" (bug thật đã gặp, làm gãy câu điền-từ).
2. **Audit UI/UX còn vài việc chưa làm** (subagent đã tìm ra, mới vá phần ưu tiên cao): các phần tử bấm-được dạng `<div>` (`.block-card`, `.jrow`) chưa hỗ trợ bàn phím/trình đọc màn hình; `.batches-bar` chưa wrap tốt trên màn hẹp khi nhiều nút cùng hàng; chưa có trạng thái "Đang tải…" lúc mở app ở chế độ Cloud/mạng chậm; chưa có phím tắt cho bài trắc nghiệm.
3. **Đăng nhập thật (magic link)** để đồng bộ tiến trình học giữa các thiết bị — hạ tầng đã có (`js/auth.js`, `#modal-cloud`) từ trước, chỉ chưa có ai dùng thật.
4. Nếu người dùng phàn nàn UI "rườm rà" ở đâu đó lần nữa — hỏi rõ ĐÚNG phần tử nào trước khi sửa hàng loạt (bài học từ phiên này: 1 câu mô tả mơ hồ có thể trỏ tới nhiều thứ khác nhau, sửa nhầm chỗ tốn công revert).
