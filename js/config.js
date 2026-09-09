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

  // ⚠️ Key dưới đây BỘC LỘ RÕ (nằm trong code chạy trên trình duyệt + repo GitHub Public)
  // BẮT BUỘC nằm ở đây (không phải keys.local.js) để GitHub Pages phục vụ
  // được cho web thật — keys.local.js bị gitignore nên KHÔNG lên được
  // GitHub Pages, web thật sẽ 404/thiếu key nếu để ở đó (đã thử, hỏng).
  // Key này đã bị Google thu hồi 2 LẦN (repo Public bị quét tự động) —
  // key hiện tại (2026-09-10, lần 3) đã giới hạn Application restrictions
  // = Websites (chỉ chạy được từ teoteo1081.github.io/* + localhost:8934/*)
  // trong Google Cloud Console, để KHÔNG bị thu hồi lại như 2 lần trước.
  GEMINI_API_KEY: "AQ.Ab8RN6KP7vAZsAXxzrNVU--e3LWFVsBOTi3q10FKRxerfJnSqw",

  APP_NAME: "TJ WordLoop Hub",
  WORDS_PER_BLOCK: 10,        // chuẩn 10 từ / block
  DEFAULT_SPEECH_RATE: 0.85,   // đang học, đọc chậm hơn tốc độ tự nhiên cho dễ nghe
  MASTER_THRESHOLD: 0.8,      // >= 80% đúng và >= 3 lần thử  => "Đã thuộc"
  MASTER_MIN_ATTEMPTS: 3
};
