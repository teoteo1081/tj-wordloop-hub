/* ============================================================
   config.js — FILE DUY NHẤT BẠN CẦN SỬA TAY
   ------------------------------------------------------------
   Để trống 2 dòng SUPABASE_*  ->  app chạy CHẾ ĐỘ LOCAL
       (dữ liệu nằm trong trình duyệt, không chia sẻ được)

   Dán URL + anon key vào  ->  app chạy CHẾ ĐỘ CLOUD
       (mọi người vào cùng link đều thấy chung kho từ vựng)

   Lấy 2 giá trị này ở: Supabase Dashboard > Project Settings > API
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://pqarpszsipbdugrumhfy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYXJwc3pzaXBiZHVncnVtaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDc0NTcsImV4cCI6MjEwNDI4MzQ1N30.zB6uvPPt-vQ78TVwPUTMmfulbFVz-lNz9F5RJF9owwc",

  /* GEMINI_API_KEY KHÔNG đặt ở đây nữa — file này có Git track + repo
     Public, key Google từng bị GitHub Push Protection chặn/dễ bị Google
     tự thu hồi nếu lỡ lọt lên (xem lịch sử commit). Đặt key thật trong
     js/keys.local.js (đã gitignore, không bao giờ lên GitHub) — copy
     js/keys.local.example.js thành js/keys.local.js rồi điền key vào. */

  APP_NAME: "TJ WordLoop Hub",
  WORDS_PER_BLOCK: 10,        // chuẩn 10 từ / block
  DEFAULT_SPEECH_RATE: 0.85,   // đang học, đọc chậm hơn tốc độ tự nhiên cho dễ nghe
  MASTER_THRESHOLD: 0.8,      // >= 80% đúng và >= 3 lần thử  => "Đã thuộc"
  MASTER_MIN_ATTEMPTS: 3
};
