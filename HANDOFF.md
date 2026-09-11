# HANDOFF.md — checkpoint TẠM giữa phiên (đọc kỹ luật trước khi tin nội dung bên dưới)

> **Đây KHÔNG phải nguồn sự thật lâu dài.** Muốn hiểu tổng thể app / xem việc dở dang đã được xác nhận → đọc `README.md` mục "Việc còn dang dở" và `CLAUDE.md` trước. File này chỉ tồn tại để 1 phiên **sắp hết token giữa chừng 1 tác vụ** ghi lại nhanh "đang làm gì, tới đâu" cho phiên/AI kế tiếp nối việc — không phải chỗ ghi quyết định kiến trúc hay backlog dài hạn.

## Luật dùng file này (bắt buộc, để khỏi lặp lại lỗi lệch thông tin 2026-09-10)
1. **Người viết** (phiên sắp hết token): điền đúng mẫu bên dưới, càng cụ thể càng tốt — nhất là "cách verify lại" (lệnh curl/REST API/Node cụ thể), đừng chỉ viết cảm nhận ("hình như đã xong").
2. **Người đọc** (phiên/AI kế tiếp): **verify lại bằng lệnh thật trước khi tin bất kỳ con số/trạng thái nào ở đây** — đừng thao tác tiếp dựa trên trí nhớ của phiên trước. Nếu lệch, tin vào thực tế (DB/code/git log), không tin file này.
3. **Khi xong việc HOẶC đã xác nhận xong 1 phần**: dời thông tin bền vững (quyết định, backlog còn lại) sang `README.md`/`CLAUDE.md`, rồi **XOÁ sạch nội dung đã xử lý** ở file này — không để chồng chất nhiều task cũ. Nếu không còn task nào đang treo giữa chừng, để nguyên trạng thái "trống" bên dưới, đừng xoá cả file (giữ làm chỗ có sẵn cho phiên sau).
4. **Không dùng file này để ghi kiến trúc/quyết định lâu dài** (đó là việc của `CLAUDE.md`) hay backlog nhiều-phiên (đó là việc của `README.md`) — chỉ ghi đúng 1 việc đang dở dang NGAY LÚC NGẮT PHIÊN.

## Trạng thái hiện tại
_Không có việc gì đang dở dang giữa chừng cần nối tiếp._ (Cập nhật lần cuối: 2026-09-10 — dọn lại toàn bộ file này, xem commit "Dọn tài liệu: xoá HANDOFF.md lỗi thời, đồng bộ README/CLAUDE" và commit thêm luật dùng file này.)

<!-- MẪU khi cần điền (xoá dòng comment này, điền các mục dưới, xoá mục nào không có):

## Đang làm: <tên việc, 1 dòng>
- **Mục tiêu**: ...
- **Đã làm xong tới đâu** (kèm cách verify lại được ngay, đừng bắt phiên sau tự dò):
  - ...
- **Bước tiếp theo cụ thể**: ...
- **Quyết định còn treo cần hỏi người dùng** (nếu có): ...
- **Commit/push gần nhất liên quan**: `<sha>` — "<message>"

-->
