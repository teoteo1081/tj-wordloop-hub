/* keys.local.example.js — MẪU, có commit lên Git (không chứa key thật).
   Cách dùng: copy file này thành "js/keys.local.js" (đã gitignore).

   OPENAI (tuỳ chọn — chỉ cần nếu muốn máy này ưu tiên OpenAI trước Gemini):
   lấy key tại https://platform.openai.com/api-keys */
window.APP_CONFIG.OPENAI_API_KEY = "sk-dán-key-thật-của-bạn-vào-đây";
window.APP_CONFIG.OPENAI_MODEL = "gpt-4o-mini";

/* GEMINI: KHÔNG cần đặt GEMINI_API_KEY ở đây nữa — app gọi Gemini qua
   Supabase Edge Function gemini-proxy (key thật nằm server-side dưới dạng
   Supabase secret), chỉ cần config.js đã có SUPABASE_URL/SUPABASE_ANON_KEY
   là đủ. Xem supabase/functions/gemini-proxy/index.ts. */
