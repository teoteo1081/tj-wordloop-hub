// fetch-article — tải HỘ 1 trang báo/bài viết public (server-to-server,
// KHÔNG bị CORS chặn như fetch() thẳng từ trình duyệt) rồi trả về HTML thô
// — client (tryFetchArticle/htmlToMainText trong js/app.js) tự lọc bỏ
// script/nav/quảng cáo, tách khối nội dung chính, y hệt cách đã làm cho
// lớp "thử fetch thẳng" trước đây — function này CHỈ làm đúng 1 việc: tải
// giùm, không parse HTML ở đây (giữ 1 chỗ lọc nội dung duy nhất, khỏi lệch
// hành vi giữa 2 lớp).
//
// Client gọi bằng:
//   POST {SUPABASE_URL}/functions/v1/fetch-article
//   headers: { Authorization: "Bearer <SUPABASE_ANON_KEY>", apikey: "<SUPABASE_ANON_KEY>" }
//   body: { url }
// trả về { html } (200) hoặc { error } (4xx/5xx).
//
// GIỚI HẠN CỐ Ý (chặn lạm dụng — function PUBLIC, ai có anon key cũng gọi
// được, xem "shared_all"-style RLS chung của app):
//   - Chỉ nhận http/https, KHÔNG cho localhost/IP nội bộ (chặn SSRF dò
//     mạng nội bộ của Supabase) — chặn theo hostname, không hoàn hảo 100%
//     (DNS rebinding vẫn có thể lách) nhưng đủ cho app gia đình dùng nội bộ.
//   - Giới hạn 15s timeout, tải tối đa ~3MB HTML — trang quá nặng/quá
//     chậm thì báo lỗi rõ ràng thay vì treo function.
//   - Giả User-Agent trình duyệt thật — nhiều trang chặn thẳng UA "bot"
//     mặc định của fetch, giả UA giúp qua được vài lớp chặn cơ bản (KHÔNG
//     qua được chặn bot nghiêm túc kiểu Cloudflare).
//
// Deploy (cần Supabase CLI đã `supabase login`, không cần đặt secret nào
// mới — không gọi tới GEMINI_KEY/service role):
//   supabase functions deploy fetch-article --project-ref pqarpszsipbdugrumhfy --no-verify-jwt

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 3 * 1024 * 1024;   // ~3MB HTML — đủ cho hầu hết trang báo, chặn trang bất thường quá nặng
const FETCH_TIMEOUT_MS = 15000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Chặn SSRF cơ bản: chỉ cho http/https, chặn localhost/loopback/private IP
// (10.x, 172.16-31.x, 192.168.x, 169.254.x) và hostname rỗng.
function isSafeUrl(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (!h || h === "localhost" || h === "0.0.0.0") return false;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed, dùng POST" }, 405);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Body phải là JSON hợp lệ {url}" }, 400);
  }
  if (!body.url) return json({ error: "Thiếu field 'url'" }, 400);

  let target: URL;
  try {
    target = new URL(body.url);
  } catch (_e) {
    return json({ error: "Link không hợp lệ" }, 400);
  }
  if (!isSafeUrl(target)) return json({ error: "Link này không được phép tải (chỉ nhận http/https công khai)" }, 400);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(target.toString(), {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return json({ error: "Trang trả về lỗi HTTP " + res.status }, 502);

    const ct = res.headers.get("content-type") || "";
    if (ct && !/text\/html|application\/xhtml/i.test(ct)) {
      return json({ error: "Link này không phải trang HTML (content-type: " + ct + ")" }, 400);
    }

    // Đọc tối đa MAX_BYTES — trang quá nặng thì cắt ngang, tách nội dung
    // chính vẫn thường đủ vì phần đầu trang (chứa bài viết) luôn tải trước.
    const reader = res.body?.getReader();
    if (!reader) return json({ error: "Không đọc được nội dung trang" }, 502);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total >= MAX_BYTES) { reader.cancel(); break; }
      }
    }
    const html = new TextDecoder("utf-8").decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc, 0); merged.set(c, acc.length);
        return merged;
      }, new Uint8Array(0))
    );

    return json({ html });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "AbortError";
    return json({ error: timedOut ? "Tải trang quá lâu (quá 15s), bỏ qua" : "Lỗi tải trang: " + String(e) }, 502);
  } finally {
    clearTimeout(timer);
  }
});
