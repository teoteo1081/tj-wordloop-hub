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
//
// 2026-09-11 — THÊM GIỚI HẠN "3 Block AI/ngày cho user THƯỜNG" (Admin không
// giới hạn): cần chạy thêm phần SQL "GIỚI HẠN AI" trong
// tools/supabase_schema.sql (tạo bảng ai_usage_daily) trước khi deploy bản
// này, KHÔNG cần đặt thêm secret nào — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// đã được Supabase tự bơm sẵn vào mọi Edge Function. Xem checkQuota()/
// recordUsage() bên dưới.

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY được Supabase TỰ ĐỘNG bơm sẵn vào
// mọi Edge Function (không cần `supabase secrets set` tay) — service role
// bỏ qua RLS, dùng để tự đọc profiles.is_admin + đọc/ghi bảng ai_usage_daily
// (bảng đó KHÔNG cấp policy nào cho anon/authenticated — chỉ function này
// đụng được, xem tools/supabase_schema.sql phần "GIỚI HẠN AI").
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const NON_ADMIN_DAILY_BLOCK_CAP = 3;

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

// Gọi thẳng REST API của chính project này bằng service role key (không cần
// import thư viện supabase-js cho gọn — chỉ cần đúng 2-3 lời gọi đơn giản).
async function sb(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY!,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      ...(init?.headers || {}),
    },
  });
  return res;
}

// Trả về { blocked: true, message } nếu user THƯỜNG (không phải admin) đã
// dùng AI cho đủ NON_ADMIN_DAILY_BLOCK_CAP Block KHÁC NHAU hôm nay (giờ UTC
// của server) — sinh lại NHIỀU LẦN cho ĐÚNG 1 Block đã dùng hôm nay không
// bị tính thêm. Thiếu userId/blockId (chưa đăng nhập Cloud) hoặc thiếu
// SERVICE_ROLE_KEY (project cũ chưa có) -> bỏ qua hẳn, coi như không giới
// hạn (không định danh được để chấm).
async function checkQuota(userId: string | null, blockId: string | null): Promise<{ blocked: boolean; message?: string }> {
  if (!userId || !blockId || !SERVICE_ROLE_KEY || !SUPABASE_URL) return { blocked: false };

  try {
    const profRes = await sb(`profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`);
    const profRows = profRes.ok ? await profRes.json() : [];
    const isAdmin = !!(profRows[0] && profRows[0].is_admin);
    if (isAdmin) return { blocked: false };

    const today = new Date().toISOString().slice(0, 10);
    const usedRes = await sb(`ai_usage_daily?user_id=eq.${encodeURIComponent(userId)}&date_key=eq.${today}&select=block_id`);
    const usedRows = usedRes.ok ? await usedRes.json() : [];
    const usedBlockIds: string[] = usedRows.map((r: { block_id: string }) => r.block_id);

    if (usedBlockIds.indexOf(blockId) < 0 && usedBlockIds.length >= NON_ADMIN_DAILY_BLOCK_CAP) {
      return {
        blocked: true,
        message: `Tài khoản thường chỉ được nhờ AI viết bài cho tối đa ${NON_ADMIN_DAILY_BLOCK_CAP} Block khác nhau mỗi ngày — đã dùng đủ hôm nay, thử lại vào ngày mai hoặc nhờ Admin.`,
      };
    }
    return { blocked: false };
  } catch (_e) {
    return { blocked: false };   // lỗi tra cứu (mạng/bảng chưa tạo...) -> không chặn oan, coi như không giới hạn
  }
}

// Ghi nhận 1 lượt dùng (user_id, block_id, hôm nay) — upsert, không lỗi gì
// nếu đã có sẵn (đúng 1 dòng/user/block/ngày dù sinh lại bao nhiêu lần).
// Âm thầm bỏ qua nếu lỗi (KHÔNG được làm hỏng response Gemini đã trả về).
async function recordUsage(userId: string | null, blockId: string | null) {
  if (!userId || !blockId || !SERVICE_ROLE_KEY || !SUPABASE_URL) return;
  try {
    await sb("ai_usage_daily", {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: userId, block_id: blockId, date_key: new Date().toISOString().slice(0, 10), provider: "gemini" }),
    });
  } catch (_e) { /* không chặn response vì lỗi ghi log */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed, dùng POST" }, 405);
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY chưa được đặt (supabase secrets set)" }, 500);

  let body: { model?: string; sys?: string; user?: string; user_id?: string | null; block_id?: string | null };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Body phải là JSON hợp lệ {model, sys, user}" }, 400);
  }

  const model = body.model || "gemini-3.6-flash";
  const sys = body.sys || "";
  const user = body.user || "";
  const userId = body.user_id || null;
  const blockId = body.block_id || null;
  if (!user) return json({ error: "Thiếu field 'user' (nội dung yêu cầu gửi cho AI)" }, 400);

  const quota = await checkQuota(userId, blockId);
  if (quota.blocked) return json({ error: quota.message, kind: "quota_user" }, 403);

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
    if (res.ok) await recordUsage(userId, blockId);   // chỉ ghi nhận khi Google trả OK thật sự, không tính lượt lỗi
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
