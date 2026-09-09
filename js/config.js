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

  // ĐÃ BỎ HẲN GEMINI_API_KEY khỏi file này (2026-09-10) — key trần ở đây
  // (repo Public) đã bị Google TỰ ĐỘNG THU HỒI 3 LẦN LIÊN TIẾP trong vòng
  // ~24 tiếng, kể cả sau khi giới hạn domain trong Cloud Console (restriction
  // không ngăn được secret-scanning thu hồi). Gemini giờ gọi qua Supabase
  // Edge Function gemini-proxy (supabase/functions/gemini-proxy/index.ts) —
  // key thật nằm server-side dưới dạng Supabase secret, KHÔNG BAO GIỜ xuất
  // hiện trong file nào commit lên git nữa. Xem Context._callGemini trong
  // js/context.js — chỉ cần SUPABASE_URL/SUPABASE_ANON_KEY bên dưới là đủ.

  APP_NAME: "TJ WordLoop Hub",
  WORDS_PER_BLOCK: 10,        // chuẩn 10 từ / block
  DEFAULT_SPEECH_RATE: 0.85,   // đang học, đọc chậm hơn tốc độ tự nhiên cho dễ nghe
  MASTER_THRESHOLD: 0.8,      // >= 80% đúng và >= 3 lần thử  => "Đã thuộc"
  MASTER_MIN_ATTEMPTS: 3
};
