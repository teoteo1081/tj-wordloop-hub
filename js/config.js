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

  // ⚠️ 2 key dưới đây BỘC LỘ RÕ (nằm trong code chạy trên trình duyệt + repo GitHub Public)
  // - AI dùng tiền/quota của chính tài khoản này. Chỉ dùng cho AI viết/tạo lại bài đọc.
  // Có GEMINI_API_KEY -> app ưu tiên dùng Gemini (miễn phí) thay vì OpenAI.
  GEMINI_API_KEY: "AQ.Ab8RN6Ivas2U75D32v968gtqAEJCfRNQLo7VW2jts-I_ryBJew",
  OPENAI_API_KEY: "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",
  OPENAI_MODEL: "gpt-4o-mini",

  APP_NAME: "TJ WordLoop Hub",
  WORDS_PER_BLOCK: 10,        // chuẩn 10 từ / block
  DEFAULT_SPEECH_RATE: 0.85,   // đang học, đọc chậm hơn tốc độ tự nhiên cho dễ nghe
  MASTER_THRESHOLD: 0.8,      // >= 80% đúng và >= 3 lần thử  => "Đã thuộc"
  MASTER_MIN_ATTEMPTS: 3
};
