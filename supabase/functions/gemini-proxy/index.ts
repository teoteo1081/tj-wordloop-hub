// gemini-proxy — gọi Gemini hộ client, giữ GEMINI_API_KEY server-side
// (Supabase secret) — KHÔNG BAO GIỜ lộ ra client/git nữa.
//
// Lý do tồn tại: key Gemini dán trần vào js/config.js (repo Public) đã bị
// Google TỰ ĐỘNG THU HỒI 3 LẦN LIÊN TIẾP trong vòng ~24 tiếng (2026-09-09,
// 2026-09-10 x2) — kể cả sau khi đã giới hạn Application restrictions =
// Websites trong Google Cloud Console. Restriction chỉ giới hạn AI DÙNG
// ĐƯỢC key nếu lấy trộm, KHÔNG ngăn được việc GitHub secret-scanning coi
// key lộ trong repo Public là sự cố bảo mật cần thu hồi ngay lập tức, bất
// kể key đó có bị giới hạn gì hay không. Cách duy nhất chặn hẳn: đừng bao
// giờ để key xuất hiện trong bất kỳ file nào commit lên git — thay vào đó
// giấu sau proxy này, key chỉ tồn tại dưới dạng biến môi trường phía
// server (đặt bằng `supabase secrets set GEMINI_API_KEY=...`).
//
// Client (context.js _callGemini) gọi hàm này bằng:
//   POST {SUPABASE_URL}/functions/v1/gemini-proxy
//   headers: { Authorization: "Bearer <SUPABASE_ANON_KEY>", apikey: "<SUPABASE_ANON_KEY>" }
//   body: { model, sys, user }
// và nhận lại NGUYÊN VẸN response JSON + status code của Google — client
// tự parse y hệt như khi gọi thẳng Google trước đây, không đổi format gì.
//
// Deploy (cần Supabase CLI đã `supabase login`):
//   supabase secrets set GEMINI_API_KEY=<key thật> --project-ref pqarpszsipbdugrumhfy
//   supabase functions deploy gemini-proxy --project-ref pqarpszsipbdugrumhfy --no-verify-jwt
// (--no-verify-jwt vì app dùng chung 1 anon key public cho mọi user, không
// có JWT cá nhân riêng — xác thực thật sự nằm ở việc phải biết đúng anon
// key, không phải mục đích chặn truy cập ở lớp function này.)

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed, dùng POST" }, 405);
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY chưa được đặt (supabase secrets set)" }, 500);

  let body: { model?: string; sys?: string; user?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Body phải là JSON hợp lệ {model, sys, user}" }, 400);
  }

  const model = body.model || "gemini-3.6-flash";
  const sys = body.sys || "";
  const user = body.user || "";
  if (!user) return json({ error: "Thiếu field 'user' (nội dung yêu cầu gửi cho AI)" }, 400);

  const upstreamUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

  const upstreamBody = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
  });

  try {
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: upstreamBody,
    });
    const text = await res.text();
    // Trả NGUYÊN status + body của Google — client (_callGemini) đã có sẵn
    // logic phân loại lỗi/retry dựa trên status code thật (503/429...), giữ
    // proxy càng "trong suốt" càng ít chỗ để lệch hành vi so với trước.
    return new Response(text, {
      status: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "gemini-proxy: lỗi gọi upstream Google — " + String(e) }, 502);
  }
});
