"""
================================================================================
 export_vocab.py — KÉO từ vựng từ Supabase XUỐNG file Excel để xem/sửa tay
================================================================================
 CHẠY:  python tools/export_vocab.py

 -> Ra file tools/tu_vung.xlsx (tự mở luôn), gồm 2 sheet:
      "Từ vựng" - 1 dòng/1 từ (term/level/pos/ipa/def_en/meaning_vi/sort...)
      "Bài đọc" - 1 dòng/1 block (bài đọc đang dùng + 3 bài đề xuất)
    kèm sheet "Ghi chú" giải thích cột nào sửa có ảnh hưởng thật.

 Sửa xong trong Excel, LƯU LẠI rồi chạy tools/import_vocab.py để đẩy lên.
================================================================================
"""

from _vocab_common import do_export

if __name__ == "__main__":
    do_export()
