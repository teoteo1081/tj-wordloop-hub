"""
================================================================================
 import_vocab.py — ĐẨY file Excel (đã sửa tay) NGƯỢC LÊN Supabase
================================================================================
 CHẠY:  python tools/import_vocab.py

 Đọc lại tools/tu_vung.xlsx (ra từ export_vocab.py), ghép theo cột "id":
   - "id" khớp từ cũ  -> CẬP NHẬT từ đó (ghi đè term/level/pos/ipa/def_en/
     meaning_vi/sort).
   - "id" ĐỂ TRỐNG      -> TẠO TỪ MỚI (bắt buộc phải điền "block_id" - copy
     từ 1 dòng khác trong CÙNG Block muốn thêm vào).
 XOÁ HẲN 1 dòng khỏi Excel KHÔNG xoá từ đó trên Supabase (an toàn - tool
 không tự xoá dữ liệu, muốn xoá thật thì vào Supabase Table Editor).

 Sheet "Bài đọc" cũng được đẩy lên luôn (chỉ PATCH đúng ô có nội dung,
 ô trống giữ nguyên dữ liệu cũ trên Supabase).

 Xong việc, chạy lại tools/export_vocab.py bất cứ lúc nào để lấy bản MỚI
 NHẤT (VD sau khi có người học thêm/sửa qua chính app).
================================================================================
"""

from _vocab_common import do_import

if __name__ == "__main__":
    do_import()
