/* context.js — Tự sinh đoạn văn ngữ cảnh chứa toàn bộ từ trong Block.
   Từ vựng được bọc trong [dấu ngoặc vuông] để lát nữa tô màu + karaoke. */
(function (w) {
  "use strict";

  var OPENERS = [
    "At the quarterly planning meeting, the department head reminded everyone that the team must {0} before the end of the month.",
    "The project report opened with a clear warning: without a solid plan, no one can {0} on time.",
    "During the onboarding session, the new staff were told that their first task was to {0}."
  ];

  var MIDDLES = [
    "The manager explained that {0} is the part most teams underestimate.",
    "Several colleagues asked how to {0} without slowing the whole process down.",
    "According to the supervisor, any delay in {0} would affect the following quarter.",
    "In practice, the fastest teams treat {0} as a daily habit rather than an emergency.",
    "The training material gives a simple example of {0} in a real office situation.",
    "One senior member noted that {0} appears in almost every client conversation.",
    "The checklist reminds staff to double-check {0} before sending anything out.",
    "A short case study shows what happens when a company ignores {0} for too long.",
    "Most of the questions in the feedback survey were about {0}.",
    "The final section of the handbook covers {0} in more detail.",
    "New staff are told on day one that {0} is never optional.",
    "The report from head office singled out {0} as the biggest win of the year.",
    "Nobody on the floor argues about {0} any more; it is simply how the work is done.",
    "During the audit, the inspector asked twice about {0}."
  ];

  var CLOSERS = [
    "By reviewing these terms at the right moments — ten minutes, twenty-four hours, one week, one month — the whole set moves from short-term memory into long-term memory.",
    "Read the passage aloud once more, then cover the Vietnamese column and try to recall each term from memory.",
    "Say each term out loud in a full sentence of your own; that single step doubles what you remember tomorrow."
  ];

  var TITLES = [
    "A Week at Halloran & Pike",
    "Notes from the Monday Planning Meeting",
    "What the New Handbook Actually Says",
    "Inside the Operations Department",
    "The Quarterly Review, Explained",
    "How the Best Teams Stay on Schedule"
  ];

  var SOURCES = [
    "Bài đọc tự sinh từ đúng 10 từ trong Block này — mỗi từ nằm trong một câu riêng để tiện luyện đọc và làm bài thi cuối bài.",
    "Đoạn văn ngữ cảnh do hệ thống dựng từ danh sách từ của Block — dùng để đọc, nghe và kiểm tra lại.",
    "Ngữ cảnh mẫu sinh tự động: toàn bộ từ vựng của Block đều xuất hiện ít nhất một lần."
  ];

  /* BẢN TIẾNG VIỆT của từng mẫu câu, xếp đúng thứ tự với mẫu tiếng Anh.
     Nhờ vậy app dịch được câu trong bài kiểm tra mà KHÔNG cần mạng, không
     cần API dịch — vì câu nào cũng do chính app sinh ra từ mẫu này. */
  var OPENERS_VI = [
    "Trong buổi họp kế hoạch quý, trưởng bộ phận nhắc mọi người rằng cả nhóm phải {0} trước cuối tháng.",
    "Bản báo cáo dự án mở đầu bằng một lời cảnh báo rõ ràng: không có kế hoạch chắc chắn thì không ai {0} đúng hạn.",
    "Trong buổi định hướng nhân viên mới, các bạn được cho biết việc đầu tiên phải làm là {0}."
  ];

  var MIDDLES_VI = [
    "Quản lý giải thích rằng {0} mới là phần mà hầu hết các nhóm đánh giá thấp.",
    "Vài đồng nghiệp hỏi làm sao để {0} mà không làm chậm cả quy trình.",
    "Theo lời người giám sát, bất kỳ chậm trễ nào ở khâu {0} cũng sẽ ảnh hưởng tới quý sau.",
    "Trên thực tế, những nhóm nhanh nhất coi {0} là thói quen hằng ngày chứ không phải chuyện khẩn cấp.",
    "Tài liệu đào tạo đưa ra một ví dụ đơn giản về {0} trong tình huống văn phòng có thật.",
    "Một thành viên kỳ cựu nhận xét rằng {0} xuất hiện trong gần như mọi cuộc trao đổi với khách hàng.",
    "Bản kiểm tra nhắc nhân viên rà lại {0} một lần nữa trước khi gửi bất cứ thứ gì ra ngoài.",
    "Một tình huống thực tế ngắn cho thấy điều gì xảy ra khi công ty bỏ mặc {0} quá lâu.",
    "Phần lớn câu hỏi trong bản khảo sát phản hồi đều xoay quanh {0}.",
    "Phần cuối của cuốn cẩm nang trình bày kỹ hơn về {0}.",
    "Nhân viên mới được dặn ngay ngày đầu rằng {0} là việc không bao giờ được bỏ qua.",
    "Báo cáo từ trụ sở chính nêu bật {0} là thành quả lớn nhất trong năm.",
    "Ở dưới xưởng không ai tranh cãi về {0} nữa; đơn giản đó là cách công việc vẫn chạy.",
    "Trong đợt kiểm toán, thanh tra viên hỏi tới hai lần về {0}."
  ];

  function pick(arr, i) { return arr[i % arr.length]; }
  function fill(tpl, term) { return tpl.replace("{0}", term); }

  /* Đưa mẫu câu về dạng có {{GAP}} để so khớp với câu trong đề thi */
  function gapForm(tpl) { return tpl.replace("{0}", "{{GAP}}").trim(); }

  w.Context = {
    /* Tiêu đề + dòng nguồn của bài đọc (không lưu, tính lại theo seed) */
    titleFor: function (seed) { return pick(TITLES, (seed | 0)); },
    sourceFor: function (seed) { return pick(SOURCES, (seed | 0)); },

    /* words: [{term, meaning_vi, ...}] -> chuỗi có [đánh dấu] */
    generate: function (words, seed) {
      var terms = (words || []).map(function (x) { return x.term; }).filter(Boolean);
      if (!terms.length) return "Block này chưa có từ vựng nào.";

      var s = (seed == null ? Math.floor(Math.random() * 997) : seed);

      /* MỖI TỪ MỘT MẪU CÂU KHÁC NHAU.
         Trước đây dùng offset (s + idx) rồi (s + idx + 5) nên hai từ khác nhau
         có thể rơi vào cùng một mẫu -> đề thi hiện ra hai câu y hệt nhau.
         Giờ chạy tuần tự (s + i) nên với <= MIDDLES.length từ là không trùng. */
      var sentences = [fill(pick(OPENERS, s), "[" + terms[0] + "]")];
      for (var i = 1; i < terms.length; i++) {
        sentences.push(fill(pick(MIDDLES, s + i), "[" + terms[i] + "]"));
      }

      /* Chia đoạn: đoạn đầu 4 câu, các đoạn sau 3 câu */
      var paras = [], idx = 0, take = 4;
      while (idx < sentences.length) {
        paras.push(sentences.slice(idx, idx + take).join(" "));
        idx += take;
        take = 3;
      }

      /* Kết bài */
      paras.push(pick(CLOSERS, s));
      return paras.join("\n\n");
    },

    /* DỊCH CÂU TRONG ĐỀ THI SANG TIẾNG VIỆT.
       Câu nào cũng sinh ra từ một mẫu cố định, nên chỉ cần dò xem nó khớp
       mẫu số mấy rồi lấy bản tiếng Việt tương ứng, thay chỗ trống bằng
       nghĩa của từ. Không cần mạng, không cần API dịch.
         textWithGap : câu có {{GAP}}
         term        : từ đúng
         meaningVi   : nghĩa tiếng Việt của từ (không có thì dùng chính từ) */
    translate: function (textWithGap, term, meaningVi, viMap) {
      /* Bài đọc do AI sinh: đã có sẵn bản dịch từng câu theo từ (viMap),
         dùng thẳng, không cần dò khớp mẫu câu. */
      if (viMap) {
        var hit = viMap[String(term || "").toLowerCase()];
        if (hit) return hit;
      }

      var t = String(textWithGap || "").trim();
      var slot = meaningVi ? ("« " + meaningVi + " »") : ("« " + term + " »");

      var i;
      for (i = 0; i < OPENERS.length; i++) {
        if (gapForm(OPENERS[i]) === t) return fill(OPENERS_VI[i], slot);
      }
      for (i = 0; i < MIDDLES.length; i++) {
        if (gapForm(MIDDLES[i]) === t) return fill(MIDDLES_VI[i] || "", slot);
      }
      return "";     /* câu lạ (đoạn văn cũ / tự sửa) -> không dịch bừa */
    },

    /* ═══════════ SINH BÀI ĐỌC BẰNG AI (OpenAI ưu tiên, Gemini dự phòng) ═══
       OpenAI: cần window.APP_CONFIG.OPENAI_API_KEY (đặt trong
       js/keys.local.js, KHÔNG commit lên git — chỉ tồn tại trên máy local
       của TJ, "tiền thật" nên không đưa lên web live). Gọi thẳng từ
       trình duyệt tới api.openai.com — không có backend riêng.
       Gemini: KHÔNG còn gọi thẳng Google với key trong config.js nữa (key
       kiểu đó bị Google tự thu hồi liên tục vì repo Public) — giờ gọi qua
       Supabase Edge Function gemini-proxy (supabase/functions/gemini-proxy),
       key thật nằm server-side dưới dạng Supabase secret. Client chỉ cần
       cfg.SUPABASE_URL/SUPABASE_ANON_KEY (luôn có ở Cloud mode) để gọi
       proxy — dùng được ở CẢ web live lẫn máy local, không cần key riêng
       cho từng máy nữa. Xem Context._callProvider/_callGemini/_callOpenAI.
       Trả về CHUỖI để lưu y hệt chỗ dùng Context.generate(): văn bản có
       [đánh dấu] + một khối JSON ẩn phía sau (ngăn bởi META_SEP) chứa
       bản dịch từng câu + tiêu đề + nguồn, để đọc lại đúng như lúc sinh. */
    META_SEP: "\n<<<TJWL_META>>>\n",

    parseMeta: function (raw) {
      var s = String(raw || "");
      var i = s.indexOf(w.Context.META_SEP);
      if (i < 0) return { marked: s, vi: null, title: null, source: null, ai: false, pasted: false, claude: false, provider: null, origin: null, cost_usd: null };
      var meta = {};
      try { meta = JSON.parse(s.slice(i + w.Context.META_SEP.length)) || {}; } catch (e) { meta = {}; }
      return {
        marked: s.slice(0, i),
        vi: meta.vi || null,
        title: meta.title || null,
        source: meta.source || null,
        ai: !!meta.ai,
        pasted: !!meta.pasted,
        claude: !!meta.claude,
        provider: meta.provider || null,  /* "openai" | "gemini" | null — chỉ có ý nghĩa khi ai===true */
        origin: meta.origin || null,      /* "local" | "web" | null — máy nào gọi AI lúc sinh bài này */
        cost_usd: (typeof meta.cost_usd === "number") ? meta.cost_usd : null   /* ước tính USD OpenAI đã tốn — null nếu Gemini/không phải AI */
      };
    },

    /* ═══════════ HẠ TẦNG GỌI AI: PHÂN LOẠI LỖI RÕ RÀNG ═══════════
       Mọi lỗi ném ra từ đây đều có thêm 3 field để nơi gọi (detail.js/
       app.js) hiển thị đúng nguyên nhân cho người dùng THẤY NGAY trên
       giao diện (không chỉ console.warn):
         err.kind     : "network" (mất mạng/không kết nối được) |
                        "timeout" (máy chủ nhận request nhưng không trả
                        lời kịp trong 25s) | "api" (máy chủ AI trả lỗi rõ
                        ràng — sai key, hết hạn mức, hết tiền...) |
                        "empty" (200 OK nhưng nội dung rỗng/bị lọc) |
                        "no_key" (chưa cấu hình key nào cả)
         err.provider : "openai" | "gemini" | null
         err.status   : mã HTTP nếu có (vd 401, 429, 500) */
    _fetchAI: async function (url, opts, provider) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 25000);
      try {
        return await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
      } catch (e) {
        var err = new Error(
          e.name === "AbortError"
            ? (provider + ": máy chủ nhận yêu cầu nhưng không phản hồi kịp trong 25 giây (timeout)")
            : (provider + ": không kết nối được internet/máy chủ AI")
        );
        err.kind = e.name === "AbortError" ? "timeout" : "network";
        err.provider = provider;
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
    _apiError: function (provider, status, bodyText) {
      var err = new Error(provider + ": lỗi API (mã " + status + ") — " + String(bodyText || "").slice(0, 180));
      err.kind = "api"; err.provider = provider; err.status = status;
      return err;
    },

    /* Đơn giá OpenAI ước tính (USD / 1 triệu token) — gõ tay, KHÔNG có API
       nào tự tra giá real-time, nên nếu OpenAI đổi bảng giá thì số này cũ
       đi cho tới khi ai đó sửa lại tay. Chỉ áp dụng khi provider là OpenAI
       (Gemini free tier = luôn 0đ). Model không có trong bảng -> coi như
       giá gpt-4o-mini (rẻ nhất, ước tính an toàn ở mức thấp). */
    OPENAI_PRICING: {
      "gpt-4o-mini": { in: 0.15, out: 0.60 },
      "gpt-4o": { in: 2.50, out: 10.00 },
      "gpt-4.1-mini": { in: 0.40, out: 1.60 },
      "gpt-4.1": { in: 2.00, out: 8.00 }
    },
    /* Chi phí ước tính (USD) của LẦN GỌI OPENAI THÀNH CÔNG GẦN NHẤT — null
       nếu lần thành công gần nhất là Gemini (free) hoặc chưa gọi lần nào.
       generateAI() đọc biến này ngay sau _callProvider() để ghi vào
       meta.cost_usd, hiện lên UI cho TJ biết bài nào tốn bao nhiêu tiền
       thật (theo yêu cầu "note ra được tốn bao nhiêu đô cho mỗi bài"). */
    _lastCostUsd: null,

    /* Gọi Gemini QUA PROXY (supabase/functions/gemini-proxy) — KHÔNG còn
       gọi thẳng Google với key nằm trong config.js nữa. Lý do: key trần
       trong config.js (repo Public) đã bị Google TỰ ĐỘNG THU HỒI 3 LẦN
       LIÊN TIẾP trong ~24 tiếng (kể cả sau khi giới hạn domain trong Cloud
       Console) — restriction chỉ giới hạn ai DÙNG ĐƯỢC key, không ngăn
       được GitHub/Google secret-scanning coi lộ key là sự cố cần thu hồi
       ngay. Giờ GEMINI_API_KEY chỉ tồn tại dưới dạng Supabase secret
       (server-side), không client nào (web live lẫn máy local) cần biết
       giá trị thật nữa — xem chi tiết trong file proxy.
       TỰ THỬ LẠI tối đa 3 lần khi Google báo 503/429 (quá tải tạm thời —
       hay gặp với model "flash" free tier giờ cao điểm, KHÔNG phải lỗi
       key/code) — đợi 1.5s/3s/6s giữa các lần, chỉ thật sự báo lỗi cho
       người dùng nếu thử hết cả 3 lần vẫn không được. */
    /* quotaCtx: { userId, blockId } — CHỈ để proxy chấm "giới hạn 3 Block
       AI/ngày cho user thường" (xem gemini-proxy/index.ts) — Admin (kiểm
       tra lại THẬT trên server qua bảng profiles, không tin cờ admin gửi
       từ client) không bị giới hạn. Thiếu userId (chưa đăng nhập Cloud,
       chỉ hồ sơ máy) -> proxy bỏ qua hẳn việc chấm quota, coi như free
       (không định danh được để giới hạn). */
    _callGemini: async function (cfg, sys, user, quotaCtx) {
      if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
        var noProxy = new Error("gemini: cần chạy Cloud mode (có SUPABASE_URL/SUPABASE_ANON_KEY) để gọi qua proxy");
        noProxy.kind = "api"; noProxy.provider = "gemini";
        throw noProxy;
      }
      /* "gemini-3.6-flash" (model mới nhất) có free-tier CỰC THẤP — chỉ
         20 request/ngày/dự án (đã hit 429 thật, quotaId
         "GenerateRequestsPerDayPerProjectPerModel-FreeTier", limit 20) —
         không đủ dùng thật. "gemini-3.5-flash-lite" có quota RIÊNG (tính
         theo từng model) và cao hơn nhiều, vẫn hoàn toàn free — đổi mặc
         định sang model này (đã verify qua proxy thật, không bị 429). */
      var model = cfg.GEMINI_MODEL || "gemini-3.5-flash-lite";
      var url = cfg.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/gemini-proxy";
      var body = JSON.stringify({
        model: model, sys: sys, user: user,
        user_id: (quotaCtx && quotaCtx.userId) || null,
        block_id: (quotaCtx && quotaCtx.blockId) || null
      });
      var headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
        "apikey": cfg.SUPABASE_ANON_KEY
      };

      var lastErr = null;
      for (var attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(function (r) { setTimeout(r, 1500 * Math.pow(2, attempt - 1)); });
        var res;
        try {
          res = await w.Context._fetchAI(url, { method: "POST", headers: headers, body: body }, "gemini");
        } catch (e) { lastErr = e; if (e.kind !== "network") break; continue; }   /* mất mạng thoáng qua -> thử lại; timeout thì dừng luôn */
        if (res.ok) {
          var data = await res.json();
          var cand = data.candidates && data.candidates[0];
          var raw = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
          if (raw) { w.Context._lastCostUsd = 0; return raw; }   /* Gemini free tier -> luôn 0đ */
          lastErr = new Error("gemini: trả về rỗng (có thể bị chặn bởi bộ lọc an toàn nội dung)");
          lastErr.kind = "empty"; lastErr.provider = "gemini";
          break;   /* rỗng không phải lỗi quá tải -> thử lại vô ích, dừng ngay */
        }
        var errText = await res.text().catch(function () { return ""; });
        /* Proxy tự chặn ở 403 kèm {kind:"quota_user"} khi user thường đã
           dùng đủ 3 Block AI hôm nay (xem gemini-proxy/index.ts) — dừng
           ngay, KHÔNG thử lại, và KHÔNG rơi về OpenAI (xem _callProvider)
           để giới hạn có ý nghĩa thật, không bị lách qua nhà cung cấp khác. */
        try {
          var errJson = JSON.parse(errText);
          if (errJson && errJson.kind === "quota_user") {
            lastErr = new Error(errJson.error || "Đã dùng hết lượt AI hôm nay");
            lastErr.kind = "quota_user"; lastErr.provider = "gemini";
            break;
          }
        } catch (e) { /* không phải JSON -> lỗi thường, xử lý như cũ bên dưới */ }
        lastErr = w.Context._apiError("gemini", res.status, errText);
        if (res.status !== 503 && res.status !== 429) break;   /* lỗi khác (key sai, quota hết...) -> dừng ngay, thử lại vô ích */
      }
      throw lastErr;
    },

    /* Gọi OpenAI — cần có credit trong tài khoản (không miễn phí như
       Gemini). Không tự thử lại nhiều lần như Gemini (OpenAI hiếm khi
       503 tạm thời kiểu free-tier), chỉ thử lại đúng 1 lần nếu lỗi 500+
       (server OpenAI trục trặc thoáng qua), lỗi 4xx (401/429 hết tiền,
       sai key...) thì báo ngay, thử lại vô ích. */
    _callOpenAI: async function (cfg, sys, user) {
      var model = cfg.OPENAI_MODEL || "gpt-4o-mini";
      var url = "https://api.openai.com/v1/chat/completions";
      var body = JSON.stringify({
        model: model, temperature: 0.9, response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }]
      });
      var headers = { "Authorization": "Bearer " + cfg.OPENAI_API_KEY, "Content-Type": "application/json" };

      var lastErr = null;
      for (var attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise(function (r) { setTimeout(r, 2000); });
        var res;
        try {
          res = await w.Context._fetchAI(url, { method: "POST", headers: headers, body: body }, "openai");
        } catch (e) { lastErr = e; break; }   /* network/timeout -> không cần thử lại, báo luôn cho rõ */
        if (res.ok) {
          var data = await res.json();
          var raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (raw) {
            /* Tính chi phí ước tính từ usage token thật OpenAI trả về —
               chỉ ước tính (bảng giá gõ tay ở OPENAI_PRICING), không phải
               số tiền chính xác OpenAI trừ (còn tuỳ giảm giá/khuyến mãi
               tài khoản), nhưng đủ để TJ ước lượng đại khái. */
            var usage = data.usage || {};
            var price = w.Context.OPENAI_PRICING[model] || w.Context.OPENAI_PRICING["gpt-4o-mini"];
            w.Context._lastCostUsd = (usage.prompt_tokens || 0) / 1e6 * price.in + (usage.completion_tokens || 0) / 1e6 * price.out;
            return raw;
          }
          lastErr = new Error("openai: trả về rỗng"); lastErr.kind = "empty"; lastErr.provider = "openai";
          break;
        }
        var errText = await res.text().catch(function () { return ""; });
        /* 401 = sai/hết hạn key, 429 = hết hạn mức hoặc hết tiền — cả 2 đều
           KHÔNG thử lại vô ích. Chỉ thử lại khi 500+ (lỗi tạm thời phía OpenAI). */
        lastErr = w.Context._apiError("openai", res.status, errText);
        if (res.status < 500) break;
      }
      throw lastErr;
    },

    /* "web" (hostname thật, vd GitHub Pages) hay "local" (file:// hoặc
       localhost/127.0.0.1 — kể cả không có "location" như chạy qua Node
       script) — dùng để CHỌN THỨ TỰ nhà cung cấp bên dưới VÀ để ghi
       meta.origin trong generateAI(). */
    _isWebOrigin: function () {
      try {
        return !!(typeof location !== "undefined" && location.hostname &&
          location.hostname !== "localhost" && location.hostname !== "127.0.0.1");
      } catch (e) { return false; }
    },

    /* Chọn nhà cung cấp (2026-09-11, theo yêu cầu TJ) — KHÁC NHAU theo máy:
       · Máy LOCAL (TJ đang cấu hình OPENAI_API_KEY trong js/keys.local.js):
         DÙNG OPENAI TRƯỚC như trước giờ — Gemini (qua proxy) chỉ còn là
         DỰ PHÒNG khi OpenAI lỗi.
       · Trên WEB LIVE (người học khác vào, không có OPENAI_API_KEY vì file
         key đó gitignore, không lên git): GEMINI (free, qua proxy) LUÔN
         được thử TRƯỚC — chỉ cần cfg.SUPABASE_URL/SUPABASE_ANON_KEY (luôn
         có ở Cloud mode), không cần GEMINI_API_KEY client-side. OpenAI chỉ
         còn là dự phòng NẾU lỡ máy đó cũng có key riêng.
       Trừ đúng 1 trường hợp bất kể máy nào: Gemini từ chối vì "quota_user"
       (user thường đã dùng đủ 3 Block AI hôm nay, xem _callGemini/
       gemini-proxy) thì KHÔNG rơi về OpenAI — nếu không, giới hạn đó vô
       nghĩa với máy có sẵn OPENAI_API_KEY.
       Không có cả 2 thì báo rõ "chưa cấu hình" (kind: "no_key").
       Ghi lại _lastProvider ("gemini"/"openai") NGAY KHI THÀNH CÔNG — để
       generateAI() lưu vào meta.provider, giúp TJ biết bài nào tốn tiền
       OpenAI thật, bài nào chỉ chạy Gemini free (kiểm soát chi phí). */
    _lastProvider: null,
    _callProvider: async function (cfg, sys, user, quotaCtx) {
      var hasOpenAI = !!(cfg && cfg.OPENAI_API_KEY);
      var hasGeminiProxy = !!(cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
      if (!hasOpenAI && !hasGeminiProxy) {
        var noKey = new Error("Chưa cấu hình OpenAI key (js/keys.local.js) và cũng chưa chạy Cloud mode để gọi Gemini qua proxy");
        noKey.kind = "no_key";
        throw noKey;
      }
      /* Máy local có OPENAI_API_KEY -> ưu tiên OpenAI như cũ (kể cả nếu
         Cloud mode cũng bật). Chỉ khi KHÔNG có OpenAI (web live, hoặc máy
         local chưa cấu hình key) mới ưu tiên Gemini trước. */
      var preferOpenAI = hasOpenAI && !w.Context._isWebOrigin();

      if (preferOpenAI) {
        try {
          var rO1 = await w.Context._callOpenAI(cfg, sys, user);
          w.Context._lastProvider = "openai";
          return rO1;
        } catch (eOpenAI1) {
          if (!hasGeminiProxy) throw eOpenAI1;
          try {
            var rG1 = await w.Context._callGemini(cfg, sys, user, quotaCtx);
            w.Context._lastProvider = "gemini";
            return rG1;
          } catch (eGemini1) {
            eOpenAI1.message += " (Gemini dự phòng cũng lỗi: " + eGemini1.message + ")";
            throw eOpenAI1;
          }
        }
      }
      if (hasGeminiProxy) {
        try {
          var r1 = await w.Context._callGemini(cfg, sys, user, quotaCtx);
          w.Context._lastProvider = "gemini";
          return r1;
        } catch (eGemini) {
          if (eGemini.kind === "quota_user") throw eGemini;   /* hết lượt hôm nay -> báo thẳng, không lách qua OpenAI */
          if (!hasOpenAI) throw eGemini;
          try {
            var r2 = await w.Context._callOpenAI(cfg, sys, user);
            w.Context._lastProvider = "openai";
            return r2;
          } catch (eOpenAI) {
            /* Cả 2 đều lỗi -> báo lỗi của Gemini (nhà cung cấp CHÍNH), kèm
               ghi chú để không mất thông tin OpenAI. */
            eGemini.message += " (OpenAI dự phòng cũng lỗi: " + eOpenAI.message + ")";
            throw eGemini;
          }
        }
      }
      var r3 = await w.Context._callOpenAI(cfg, sys, user);
      w.Context._lastProvider = "openai";
      return r3;
    },

    /* Vietnamese-hoá 1 lỗi AI để in thẳng lên giao diện cho người dùng
       thấy (không chỉ console) — dùng ở mọi nơi gọi generateAI/extractVocab/
       enrichWords. Trả về {title, detail} — title ngắn để làm tiêu đề
       banner, detail là câu giải thích đầy đủ hơn. */
    describeError: function (e) {
      var provider = (e && e.provider) ? e.provider.toUpperCase() : "AI";
      switch (e && e.kind) {
        case "no_key": return { title: "Chưa cấu hình API key", detail: e.message };
        case "quota_user": return { title: "Đã hết lượt AI hôm nay", detail: e.message || "Tài khoản thường chỉ được nhờ AI viết bài cho tối đa 3 Block khác nhau mỗi ngày — thử lại vào ngày mai, hoặc nhờ Admin." };
        case "network": return { title: provider + ": không kết nối được", detail: "Kiểm tra lại mạng internet của máy này rồi thử lại." };
        case "timeout": return { title: provider + ": quá thời gian chờ", detail: "Máy chủ đã nhận yêu cầu nhưng không trả lời kịp trong 25 giây — thường do mạng chậm hoặc máy chủ AI đang quá tải, thử lại sau." };
        case "empty": return { title: provider + ": trả về rỗng", detail: "Có thể bị bộ lọc nội dung chặn — thử lại hoặc đổi bối cảnh." };
        case "api":
          var hint = "";
          if (e.status === 401) hint = " — key sai hoặc đã hết hạn/bị thu hồi.";
          else if (e.status === 429) hint = " — hết hạn mức (quota) hoặc hết tiền trong tài khoản.";
          else if (e.status >= 500) hint = " — máy chủ AI đang gặp sự cố, thử lại sau.";
          return { title: provider + ": lỗi API (mã " + e.status + ")", detail: (e.message || "") + hint };
        default: return { title: "Lỗi không xác định", detail: (e && e.message) || String(e) };
      }
    },

    /* Escape ký tự đặc biệt của regex trong 1 chuỗi thường */
    _reEsc: function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); },

    /* Tìm & bọc [..] quanh từng term trong 1 đoạn văn xuôi liền mạch (không
       phải kiểu "mỗi từ 1 câu" nữa). Khớp theo ranh giới từ (\b), không
       chồng lên vùng đã đánh dấu trước đó (đề phòng 1 từ là từ con của
       từ khác, ví dụ "cost" nằm trong "irreversible cost"). Từ nào AI lỡ
       quên / đổi dạng không tìm thấy -> chèn thêm câu ngắn ở cuối bài,
       để không vỡ cơ chế điền từ & bài thi cuối bài. */
    _markTerms: function (passageText, terms) {
      var text = String(passageText || "");
      var claimed = [], matches = [];

      /* Duyệt từ DÀI XUỐNG NGẮN — không phải theo thứ tự trong mảng gốc.
         Nếu 1 từ đơn (vd "cost") match trước 1 cụm dài chứa nó (vd
         "irreversible cost") theo đúng thứ tự trong danh sách vocab, nó
         sẽ chiếm mất đúng đoạn ký tự đó, khiến cụm dài bị coi là overlap
         rồi bị đẩy ra câu phụ ở cuối bài thay vì nằm tự nhiên trong câu. */
      var byLenDesc = terms.slice().sort(function (a, b) { return String(b).length - String(a).length; });

      byLenDesc.forEach(function (term) {
        var re;
        try { re = new RegExp("\\b" + w.Context._reEsc(term) + "\\b", "i"); }
        catch (e) { return; }
        var m = re.exec(text);
        if (!m) return;
        var start = m.index, end = start + m[0].length;
        var overlap = claimed.some(function (r) { return start < r[1] && end > r[0]; });
        if (overlap) return;
        matches.push({ start: start, end: end, term: term, matched: m[0] });
        claimed.push([start, end]);
      });
      matches.sort(function (a, b) { return a.start - b.start; });

      var out = "", last = 0;
      matches.forEach(function (m) {
        out += text.slice(last, m.start) + "[" + m.matched + "]";
        last = m.end;
      });
      out += text.slice(last);

      var found = {};
      matches.forEach(function (m) { found[m.term.toLowerCase()] = 1; });
      var missing = terms.filter(function (t) { return !found[t.toLowerCase()]; });
      if (missing.length) {
        out += "\n\n" + missing.map(function (t) {
          return "One more word to remember here: [" + t + "].";
        }).join(" ");
      }
      return out;
    },

    /* Mô tả độ khó cho 3 khe bài đọc — chữ trong đoạn văn XUNG QUANH từ
       vựng khó/dễ khác nhau, còn số lượng/chọn từ vựng thì luôn giữ
       nguyên (đề bài yêu cầu — không đổi cấp độ chính các từ đang học). */
    DIFFICULTY: {
      easy:   "DỄ (A2-B1): câu ngắn 10-15 từ, cấu trúc đơn giản, từ xung quanh (ngoài từ vựng đang học) đều là từ cơ bản thường gặp",
      medium: "TRUNG BÌNH (B1-B2): câu 15-20 từ, có thể dùng mệnh đề phụ, từ xung quanh ở mức thông dụng-khá",
      hard:   "KHÓ (B2-C1): câu dài 20-28 từ, dùng cấu trúc phức tạp (mệnh đề quan hệ, đảo ngữ, câu ghép nhiều vế), từ xung quanh nâng cao hơn"
    },

    /* Kho bối cảnh + văn phong + góc nhìn — TỰ CHỌN NGẪU NHIÊN ở phía code
       (không nhờ AI "tự nghĩ ra cho đa dạng") rồi ép thẳng vào prompt mỗi
       lần sinh bài. Lý do: nếu chỉ đưa AI 1 câu gợi ý chung chung, model
       (nhất là bản "flash" nhẹ/rẻ) có xu hướng LUÔN quay lại đúng vài chủ
       đề "an toàn" quen thuộc (họp hành văn phòng...) dù nhiệt độ đã cao —
       ép random cứng ở code mới chắc chắn đổi bài mỗi lần. */
    SETTINGS: [
      "một chuyến du lịch/phượt xa nhà", "bữa tiệc gia đình nhiều thế hệ",
      "một trận đấu thể thao nghiệp dư", "phòng thí nghiệm/nghiên cứu khoa học",
      "một quán cà phê nhỏ trong hẻm", "chuyến bay bị hoãn ở sân bay",
      "dự án khởi nghiệp công nghệ", "một khu chợ đêm địa phương",
      "buổi phỏng vấn xin việc", "chuyến thám hiểm/leo núi",
      "lớp học nấu ăn cuối tuần", "một bệnh viện/phòng khám thú y",
      "buổi biểu diễn âm nhạc đường phố", "vụ mất tích của một con thú cưng",
      "cuộc thi nấu ăn truyền hình", "một hiệu sách cũ sắp đóng cửa",
      "chuyến đi biển với bạn bè", "công trường xây dựng đang gấp rút",
      "một lớp học online xuyên múi giờ", "câu chuyện khởi nghiệp thất bại rồi gượng dậy"
    ],
    STYLES: [
      "kể chuyện ngôi thứ nhất (tôi)", "tường thuật báo chí khách quan",
      "nhật ký cá nhân", "lời kể lại của một nhân vật phụ",
      "bài blog chia sẻ trải nghiệm", "đối thoại xen lẫn tường thuật"
    ],

    /* Mẫu prompt MẶC ĐỊNH (phần "viết gì" — không gồm hướng dẫn schema
       JSON, cái đó luôn cố định để không vỡ parsing dù user chỉnh prompt
       tuỳ ý). 3 placeholder {{SETTING}}/{{STYLE}}/{{DIFF}} được code tự
       random/tính rồi thay vào lúc gọi; {{WORDLIST}} là danh sách 10 từ
       của Block — nếu user lỡ xoá mất placeholder này khi tự sửa prompt,
       generateAI() vẫn tự nối danh sách từ vào cuối để không bao giờ gọi
       AI mà thiếu từ vựng thật của Block (xem đoạn nối bên dưới). Hiện ở
       UI thành 1 ô textarea cạnh nút "🔄 Tạo lại" — không sửa thì dùng y
       hệt mẫu này, sửa gì cũng được trước khi bấm Tạo lại (theo yêu cầu). */
    DEFAULT_PROMPT_TEMPLATE:
      "Viết một BÀI ĐỌC HIỂU tiếng Anh hoàn chỉnh, TỰ NHIÊN, dài khoảng 450–550 từ, chia 3–5 " +
      "đoạn văn (ngăn cách bằng 1 dòng trống).\n\n" +
      "BỐI CẢNH BẮT BUỘC (không được đổi sang chủ đề khác): {{SETTING}}.\n" +
      "VĂN PHONG BẮT BUỘC: {{STYLE}}.\n" +
      "Lồng ghép TỰ NHIÊN nhóm từ vựng bên dưới vào đúng bối cảnh này — nếu từ vựng nghe " +
      "\"lệch tông\" với bối cảnh (vd từ công nghệ nhưng bối cảnh là bữa tiệc gia đình) thì " +
      "vẫn cứ dùng, chỉ cần lồng khéo (vd một nhân vật trong bữa tiệc đang nói về công việc " +
      "công nghệ của mình) — KHÔNG được bỏ bối cảnh để quay về chủ đề an toàn quen thuộc.\n\n" +
      "ĐỘ KHÓ của câu văn xung quanh (không phải độ khó của từ vựng cần học bên dưới, cái đó " +
      "giữ nguyên): {{DIFF}}.\n\n" +
      "Bài đọc PHẢI chứa TẤT CẢ các từ sau, mỗi từ xuất hiện ĐÚNG MỘT LẦN, NGUYÊN VĂN (không " +
      "chia động từ, không đổi số ít/nhiều), xen kẽ tự nhiên trong bài — KHÔNG dồn hết vào 1 " +
      "câu, KHÔNG viết kiểu mỗi từ 1 câu tách rời nhau, mà để bài đọc trôi chảy như văn viết " +
      "thật:\n\n{{WORDLIST}}",

    /* words: [{term, meaning_vi, def_en}] -> Promise<string> (đã kèm meta).
       Sinh MỘT BÀI ĐỌC LIỀN MẠCH (~450-550 từ) chứ không phải kiểu "mỗi từ 1
       câu rời" — từ vựng chỉ là điểm neo xen giữa văn xuôi tự nhiên.
       difficulty: "easy" | "medium" | "hard" — ĐỂ TRỐNG/undefined thì TỰ
       RANDOM 1 trong 3 mức (đa dạng hoá độ khó câu văn xung quanh giữa các
       lần sinh, không cần UI chọn — UI chọn độ khó đã bị bỏ trước đây vì
       "hong có tác dụng", đây là random NGẦM, không hiện lựa chọn nào cho
       user). Chỉ ảnh hưởng ĐỘ KHÓ CÂU/TỪ XUNG QUANH, số từ vẫn ~500, vẫn
       đủ hết từ vựng của Block như nhau ở cả 3 mức.
       promptOverride: chuỗi thay cho DEFAULT_PROMPT_TEMPLATE nếu user tự
       sửa trong ô prompt cạnh nút "🔄 Tạo lại" — để trống/undefined thì
       dùng mẫu mặc định.
       topicHint: gợi ý CHỦ ĐỀ/LĨNH VỰC GỐC của bộ từ này (vd tên Notebook/
       Section — "Digital Marketing", "TOEIC Reading"...) — có thì bài đọc
       sẽ nghiêng nội dung về đúng lĩnh vực đó thay vì hoàn toàn random
       theo SETTINGS; để trống/undefined thì bỏ qua, chỉ dùng SETTINGS. */
    generateAI: async function (words, cfg, difficulty, promptOverride, topicHint, quotaCtx) {
      var terms = (words || []).map(function (x) { return x.term; }).filter(Boolean);
      if (!terms.length) throw new Error("Block chưa có từ vựng");
      /* KHÔNG tự check "chưa có key" ở đây — để _callProvider() làm việc đó,
         vì nó ném lỗi có đủ `.kind = "no_key"` cho describeError() hiển thị
         đúng thông báo trên UI (check trùng ở đây từng ném Error thường,
         thiếu field .kind, khiến UI hiện "Lỗi không xác định" sai). */
      var DIFF_KEYS = ["easy", "medium", "hard"];
      var diffKey = w.Context.DIFFICULTY[difficulty] ? difficulty : DIFF_KEYS[Math.floor(Math.random() * DIFF_KEYS.length)];
      var diffDesc = w.Context.DIFFICULTY[diffKey];

      var setting = w.Context.SETTINGS[Math.floor(Math.random() * w.Context.SETTINGS.length)];
      var style = w.Context.STYLES[Math.floor(Math.random() * w.Context.STYLES.length)];

      var wordList = words.map(function (x) {
        return "- " + x.term +
          (x.meaning_vi ? " (nghĩa: " + x.meaning_vi + ")" : "") +
          (x.def_en ? " — " + x.def_en : "");
      }).join("\n");

      var template = (promptOverride && String(promptOverride).trim()) ? String(promptOverride) : w.Context.DEFAULT_PROMPT_TEMPLATE;
      var body = template
        .replace(/\{\{SETTING\}\}/g, setting)
        .replace(/\{\{STYLE\}\}/g, style)
        .replace(/\{\{DIFF\}\}/g, diffDesc);
      /* Nếu prompt tự sửa lỡ xoá mất {{WORDLIST}} -> vẫn nối danh sách từ
         vào cuối, tránh gọi AI mà thiếu hẳn từ vựng thật của Block. */
      body = body.indexOf("{{WORDLIST}}") >= 0 ? body.replace(/\{\{WORDLIST\}\}/g, wordList) : (body + "\n\n" + wordList);
      if (topicHint && String(topicHint).trim()) {
        /* QUAN TRỌNG: phải nói rõ đây là NỘI DUNG CHÍNH, còn "BỐI CẢNH BẮT
           BUỘC" bên dưới chỉ là ĐỊA ĐIỂM/TÌNH HUỐNG bao quanh — nếu chỉ
           viết "nên liên quan" (câu gợi ý), model sẽ ưu tiên đúng chữ
           "BẮT BUỘC" của setting và bỏ qua hẳn topicHint (đã test thật:
           bối cảnh "sân bay bị hoãn chuyến" ra đời dù topicHint là
           "Digital Marketing", không dính dáng gì cả). Giờ ép topicHint
           làm CHỦ ĐỀ NỘI DUNG, setting chỉ còn là khung cảnh/nhân vật. */
        body = "CHỦ ĐỀ NỘI DUNG CHÍNH bài đọc PHẢI xoay quanh lĩnh vực: " + String(topicHint).trim() + ". " +
          "\"BỐI CẢNH BẮT BUỘC\" ở dưới CHỈ LÀ khung địa điểm/tình huống/nhân vật bao quanh câu chuyện, " +
          "KHÔNG PHẢI chủ đề nội dung — nhân vật trong bối cảnh đó phải đang nói/nghĩ/làm việc gì đó " +
          "LIÊN QUAN THẬT SỰ tới lĩnh vực \"" + String(topicHint).trim() + "\" (vd nếu bối cảnh là sân bay " +
          "nhưng lĩnh vực là Digital Marketing thì nhân vật có thể đang đọc báo cáo quảng cáo trên " +
          "điện thoại trong lúc chờ chuyến bay, KHÔNG phải viết về việc bay/hoãn chuyến chung chung).\n\n" + body;
      }

      var sys = "Bạn là trợ lý viết bài đọc hiểu tiếng Anh để luyện từ vựng cho người Việt học " +
        "tiếng Anh. Luôn trả lời DUY NHẤT một object JSON đúng schema được yêu cầu, không thêm " +
        "chữ nào khác, không dùng markdown code fence.";
      var user = body +
        "\n\nSau khi viết xong, với MỖI từ ở trên, ghi lại bản dịch tiếng Việt của ĐÚNG câu trong " +
        "bài chứa từ đó (chỉ câu đó thôi, không phải cả đoạn).\n\n" +
        "Đặt thêm 1 tiêu đề tiếng Anh ngắn (5–8 từ) và 1 dòng mô tả nguồn bằng tiếng Việt.\n\n" +
        "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
        '{"title":"...", "source_vi":"...", "passage_en":"...", ' +
        '"translations":[{"term":"...","vi":"..."}]}';

      w.Context._lastCostUsd = null;   /* reset để không lỡ giữ số cũ nếu lần này ném lỗi trước khi gọi xong */
      var raw = await w.Context._callProvider(cfg, sys, user, quotaCtx);
      var parsed = JSON.parse(raw);
      if (!parsed.passage_en) throw new Error("Thiếu 'passage_en' trong JSON trả về");

      var marked = w.Context._markTerms(parsed.passage_en, terms);

      var viMap = {};
      (parsed.translations || []).forEach(function (t) {
        if (t && t.term && t.vi) viMap[String(t.term).toLowerCase()] = t.vi;
      });

      /* provider: "openai" | "gemini" — ghi lại đúng nhà cung cấp THẬT SỰ
         vừa sinh bài này (đọc từ _callProvider ở trên) để TJ kiểm soát
         chi phí (OpenAI trả phí, Gemini free) — hiện ở badge nguồn bài đọc.
         origin: "local" | "web" — máy nào gọi (dựa vào location.hostname,
         không có "location" thì coi là "local" — đúng cho trường hợp chạy
         qua Node script, xem tools/ hoặc lịch sử phiên làm việc). Không
         thay thế provider — 1 bài Gemini có thể sinh từ local HOẶC web,
         còn OpenAI thì luôn "local" (key chỉ nằm trong keys.local.js).
         cost_usd: ước tính USD lần gọi OpenAI vừa rồi tốn (null nếu chạy
         qua Gemini free) — đọc từ _lastCostUsd ngay sau _callProvider ở
         trên, xem OPENAI_PRICING/_callOpenAI. */
      var origin = w.Context._isWebOrigin() ? "web" : "local";
      var meta = {
        ai: true,
        vi: viMap,
        title: parsed.title || "",
        source: parsed.source_vi || "Bài đọc do AI sinh riêng cho Block này.",
        provider: w.Context._lastProvider || "",
        origin: origin,
        cost_usd: w.Context._lastCostUsd
      };
      return marked + w.Context.META_SEP + JSON.stringify(meta);
    },

    /* Dọn nhiễu trước khi phân tích/hiển thị — để dán được nhiều nguồn:
         · Bài báo: thường dính link, quảng cáo, "Read more", "Share"...
           -> phần này để AI tự bỏ qua (nêu rõ trong prompt), khó lọc bằng
           regex vì không có mẫu cố định.
         · Transcript YouTube/Yglish: MỖI DÒNG hay có mốc thời gian kiểu
           "0:12", "[00:12]", "(1:23:45)" đứng đầu -> lọc được bằng regex,
           làm sạch để bài đọc không lộ số thời gian lung tung khi hiển thị. */
    stripPasteNoise: function (text) {
      return String(text || "")
        .replace(/^[ \t]*[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?[ \t]*[-–—]?[ \t]*/gm, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    /* ═══════════ DÁN 1 ĐOẠN VĂN CÓ SẴN -> TRÍCH TỪ B1+ ═══════════
       Không có sẵn từ điển CEFR offline trong app này, nên nhờ AI đọc
       đoạn văn và tự chấm cấp độ từng từ. Trả về mảng
       [{term, level, pos, def_en, meaning_vi, sentence_vi}] — term LUÔN
       là chuỗi con thật sự có trong đoạn văn gốc (lọc bỏ từ AI bịa thêm
       không có trong bài, để bước đánh dấu [..] sau này luôn tìm thấy).
       Nhận nhiều nguồn: bài báo dán nguyên trang, transcript YouTube/
       Yglish (còn dính mốc thời gian), ghi chú tự gõ… */
    extractVocab: async function (text, cfg) {
      var raw = w.Context.stripPasteNoise(text);
      if (!raw) throw new Error("Chưa dán đoạn văn nào");
      /* Không tự check "chưa có key" ở đây — xem lý do ở generateAI() phía trên. */
      if (raw.length > 12000) {
        throw new Error("Đoạn văn dài " + raw.length + " ký tự, quá giới hạn 12000 (~1 bài báo dài / ~15 phút transcript) — cắt bớt rồi dán lại");
      }

      var sys = "Bạn là trợ lý phân tích văn bản tiếng Anh để giúp người Việt học từ vựng. " +
        "Luôn trả lời DUY NHẤT một object JSON đúng schema được yêu cầu, không thêm chữ nào khác, " +
        "không dùng markdown code fence.";
      var user =
        "Đoạn văn bên dưới có thể là bài báo dán nguyên trang, transcript video (YouTube/Yglish), " +
        "hoặc văn bản thường — có thể còn sót link, quảng cáo, tên người dẫn lặp lại, câu chào mở " +
        "đầu không liên quan nội dung chính. HÃY BỎ QUA những phần nhiễu đó, chỉ phân tích PHẦN NỘI " +
        "DUNG CHÍNH.\n\n" +
        "Liệt kê các TỪ/CỤM TỪ có cấp độ CEFR TỪ B1 TRỞ LÊN " +
        "(B1, B2, C1, C2 — bỏ qua từ A1/A2 quá cơ bản như 'the', 'go', 'happy'...) THỰC SỰ " +
        "XUẤT HIỆN NGUYÊN VĂN trong đoạn văn bên dưới, mỗi từ chỉ liệt kê 1 lần (không lặp các " +
        "dạng gần giống nhau của cùng 1 từ).\n\n" +
        'ĐOẠN VĂN:\n"""\n' + raw + '\n"""\n\n' +
        "Với mỗi từ, ghi lại ĐẦY ĐỦ, KHÔNG ĐƯỢC bỏ trống trường nào:\n" +
        "- term: đúng NGUYÊN VĂN dạng xuất hiện trong đoạn văn (giữ nguyên chia động từ/số nhiều)\n" +
        "- level: cấp độ CEFR (B1/B2/C1/C2)\n" +
        "- pos: loại từ (Verb/Noun/Adjective/Adverb/Phrase…)\n" +
        "- ipa: phiên âm quốc tế (IPA) của TỪ GỐC (dạng từ điển, ví dụ /ˈlevərɪdʒ/), kể cả khi " +
        "term trong bài đang chia động từ/số nhiều\n" +
        "- def_en: định nghĩa tiếng Anh ngắn gọn\n" +
        "- meaning_vi: nghĩa tiếng Việt\n" +
        "- sentence_vi: bản dịch tiếng Việt của ĐÚNG câu chứa từ đó trong đoạn văn\n" +
        "- freq: từ này THÔNG DỤNG hay ÍT THÔNG DỤNG — đánh giá theo TẦN SUẤT SỬ DỤNG NGOÀI ĐỜI " +
        "THẬT trong tiếng Anh (giao tiếp/báo chí/công việc hàng ngày nói chung), KHÔNG PHẢI tần " +
        "suất xuất hiện trong riêng đoạn văn này. Chỉ trả về ĐÚNG 1 trong 2 giá trị \"common\" " +
        "(thông dụng, người bản ngữ dùng/gặp thường xuyên trong đời sống) hoặc \"uncommon\" (ít " +
        "thông dụng, hiếm gặp hơn trong đời sống thật dù có thể đoạn văn này lặp lại nhiều lần), " +
        "không suy từ cấp độ CEFR (từ B2/C1 vẫn có thể rất thông dụng ngoài đời)\n\n" +
        "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
        '{"words":[{"term":"...","level":"...","pos":"...","ipa":"...","def_en":"...","meaning_vi":"...","sentence_vi":"...","freq":"common|uncommon"}]}';

      var raw2 = await w.Context._callProvider(cfg, sys, user);
      var parsed = JSON.parse(raw2);
      var lower = raw.toLowerCase();
      var seen = {};
      var words = (parsed.words || []).filter(function (x) {
        if (!x || !x.term) return false;
        var t = String(x.term).toLowerCase();
        if (seen[t]) return false;                       /* AI lỡ liệt kê trùng */
        if (lower.indexOf(t) < 0) return false;           /* AI bịa từ không có trong bài -> bỏ */
        seen[t] = 1;
        return true;
      });
      if (!words.length) throw new Error("Không tìm thấy từ B1+ nào trong đoạn văn này");
      return words;
    },

    /* ═══════════ TỰ ĐIỀN CÁC CỘT CÒN THIẾU CHO 1 DANH SÁCH TỪ ═══════════
       Dùng khi người dùng dán vào chỉ có term (+ có thể vài cột khác),
       thiếu level/pos/ipa/def_en/meaning_vi. CHỈ điền vào chỗ ĐANG RỖNG —
       không bao giờ ghi đè lên dữ liệu đã có sẵn (dù AI gợi ý khác), để
       không phá dữ liệu đã được biên soạn/sửa tay từ trước.
       words: [{term, level?, pos?, ipa?, def_en?, meaning_vi?}] — SỬA
       TRỰC TIẾP (mutate) từng phần tử đang thiếu, trả về {words, filled}. */
    enrichWords: async function (words, cfg) {
      /* Không tự check "chưa có key" ở đây — xem lý do ở generateAI() phía trên. */
      var needy = (words || []).filter(function (x) {
        return x && x.term && (!x.level || !x.pos || !x.ipa || !x.def_en || !x.meaning_vi || !x.freq);
      });
      if (!needy.length) return { words: words, filled: 0, cost_usd: 0, providers: {} };

      var BATCH = 25;
      var filled = 0;
      /* Điền cho >25 từ chia nhiều lượt gọi AI (1 lượt/25 từ) — CỘNG DỒN
         chi phí + đếm số lượt qua từng nhà cung cấp ở ĐÂY thay vì chỉ đọc
         _lastProvider/_lastCostUsd 1 lần ở cuối (side-channel đó chỉ giữ
         kết quả lượt gọi CUỐI CÙNG, sẽ mất thông tin các lượt trước nếu
         >25 từ) — để badge "nguồn nào tốn kém" cạnh bảng từ vựng phản ánh
         ĐÚNG tổng chi phí thật của CẢ đợt điền, không chỉ đợt cuối. */
      var totalCost = 0, providers = {};

      for (var i = 0; i < needy.length; i += BATCH) {
        var chunk = needy.slice(i, i + BATCH);
        var listText = chunk.map(function (x, j) {
          var known = [];
          if (x.meaning_vi) known.push("nghĩa VI đã biết: " + x.meaning_vi);
          if (x.def_en) known.push("định nghĩa EN đã biết: " + x.def_en);
          if (x.level) known.push("cấp độ đã biết: " + x.level);
          if (x.pos) known.push("loại từ đã biết: " + x.pos);
          if (x.freq) known.push("độ thông dụng đã biết: " + x.freq);
          return (j + 1) + '. "' + x.term + '"' + (known.length ? " (" + known.join("; ") + ")" : "");
        }).join("\n");

        var sys = "Bạn là từ điển Anh-Việt cho người học tiếng Anh. Trả lời DUY NHẤT 1 object JSON " +
          "đúng schema được yêu cầu, không thêm chữ nào khác, không dùng markdown code fence.";
        var user =
          "Với ĐÚNG " + chunk.length + " từ/cụm từ tiếng Anh sau (đã đánh số thứ tự), cho biết đầy " +
          "đủ: cấp độ CEFR (A1/A2/B1/B2/C1/C2), loại từ (Verb/Noun/Adjective/Adverb/Phrase…), phiên " +
          "âm IPA kiểu từ điển (có dấu / /), định nghĩa tiếng Anh ngắn gọn, nghĩa tiếng Việt, và độ " +
          "THÔNG DỤNG NGOÀI ĐỜI THẬT của từ đó (freq: chỉ \"common\" [thông dụng — người bản ngữ " +
          "dùng/gặp thường xuyên trong đời sống thật] hoặc \"uncommon\" [ít thông dụng — hiếm gặp " +
          "hơn trong đời sống thật], KHÔNG suy từ cấp độ CEFR — từ khó vẫn có thể thông dụng ngoài đời). " +
          "Trả về ĐÚNG THEO THỨ TỰ đã đánh số, đủ " + chunk.length + " mục, không bỏ mục nào, không " +
          "gộp/tách mục:\n\n" + listText + "\n\n" +
          "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
          '{"words":[{"term":"...","level":"...","pos":"...","ipa":"...","def_en":"...","meaning_vi":"...","freq":"common|uncommon"}]}';

        w.Context._lastCostUsd = null;
        var raw = await w.Context._callProvider(cfg, sys, user);
        var parsed = JSON.parse(raw);
        var got = parsed.words || [];

        var pUsed = w.Context._lastProvider || "?";
        providers[pUsed] = (providers[pUsed] || 0) + 1;
        if (typeof w.Context._lastCostUsd === "number") totalCost += w.Context._lastCostUsd;

        for (var k = 0; k < chunk.length; k++) {
          var orig = chunk[k], suggestion = got[k];
          if (!suggestion) continue;
          if (!orig.level && suggestion.level) { orig.level = suggestion.level; filled++; }
          if (!orig.pos && suggestion.pos) { orig.pos = suggestion.pos; filled++; }
          if (!orig.ipa && suggestion.ipa) { orig.ipa = suggestion.ipa; filled++; }
          if (!orig.def_en && suggestion.def_en) { orig.def_en = suggestion.def_en; filled++; }
          if (!orig.meaning_vi && suggestion.meaning_vi) { orig.meaning_vi = suggestion.meaning_vi; filled++; }
          if (!orig.freq && suggestion.freq) { orig.freq = suggestion.freq; filled++; }
        }
      }
      /* providers: đếm số LƯỢT GỌI qua từng nhà cung cấp (vd {openai:2} nếu
         >25 từ cần 2 lượt, cả 2 đều qua OpenAI) — "nguồn nào" dùng cái có
         số lượt nhiều nhất để hiện badge, xem app.js/detail.js. */
      return { words: words, filled: filled, cost_usd: totalCost, providers: providers };
    },

    /* Lấy các câu trong đoạn văn, mỗi câu chứa 1 từ vựng, để dựng đề điền từ.
       Trả về [{term, text}] với text có dấu {{GAP}} ở đúng chỗ cần điền.
       Đây chính là chỗ nối "bài thi cuối bài" với "đoạn văn đã gen". */
    gapSentences: function (marked) {
      var text = String(marked || "");
      var out = [], seen = {}, re = /[^.!?\n]+[.!?]+/g, m, lastEnd = 0;

      function processSentence(raw) {
        var s = String(raw || "").trim();
        if (!s) return;
        /* 1 câu có thể chứa NHIỀU hơn 1 từ đánh dấu — văn AI tự sinh thì
           luôn tách mỗi từ 1 câu riêng nên trước đây lấy match đầu tiên là
           đủ, nhưng bài do người dùng TỰ DÁN thì 2 từ khó rơi chung 1 câu
           là chuyện thường -> phải lặp qua HẾT, không chỉ lấy match đầu,
           nếu không từ thứ 2 trở đi bị rớt khỏi bài thi mà không báo lỗi. */
        var termRe = /\[([^\]]+)\]/g, hit, termsInSentence = [];
        while ((hit = termRe.exec(s)) !== null) termsInSentence.push(hit[1]);
        if (!termsInSentence.length) return;

        termsInSentence.forEach(function (term) {
          if (seen[term.toLowerCase()]) return;
          seen[term.toLowerCase()] = 1;
          var t = s.replace("[" + term + "]", "{{GAP}}")
                   .replace(/\[([^\]]+)\]/g, "$1");
          out.push({ term: term, text: t });
        });
      }

      while ((m = re.exec(text)) !== null) {
        processSentence(m[0]);
        lastEnd = re.lastIndex;
      }
      /* Câu/đoạn CUỐI không có dấu chấm câu kết thúc (transcript bị cắt
         ngang, bài báo dán qua "Thử tải" bị cắt đoạn giữa chừng…) trước
         đây bị regex trên bỏ qua hoàn toàn -> từ vựng rơi vào đó biến
         mất khỏi đề thi mà không có cảnh báo gì. Xử lý nốt phần dư này,
         tách theo dòng phòng khi dư nhiều đoạn chưa có dấu câu. */
      text.slice(lastEnd).split(/\n+/).forEach(processSentence);

      return out;
    },

    /* Tách chuỗi có [đánh dấu] thành:
         plain : văn bản thuần để đọc bằng giọng máy
         html  : từng từ bọc <span class="kw" data-s data-e> để chạy karaoke  */
    build: function (marked) {
      var parts = [], re = /\[([^\]]+)\]/g, last = 0, m;
      while ((m = re.exec(marked)) !== null) {
        if (m.index > last) parts.push({ t: marked.slice(last, m.index), v: false });
        parts.push({ t: m[1], v: true });
        last = re.lastIndex;
      }
      if (last < marked.length) parts.push({ t: marked.slice(last), v: false });

      var plain = "", html = "", si = 0, sentOpen = false;

      function span(tok, cls) {
        var s = plain.length;
        plain += tok;
        return '<span class="' + cls + '" data-s="' + s + '" data-e="' + plain.length +
               '" data-w="' + w.esc(tok) + '">' + w.esc(tok) + "</span>";
      }
      /* Bọc từng câu lại để chế độ đọc "từng câu" (Sentence View) dùng được */
      function openSent() {
        if (!sentOpen) { html += '<span class="sent" data-si="' + si + '">'; sentOpen = true; }
      }
      function closeSent() {
        if (sentOpen) { html += "</span>"; sentOpen = false; si++; }
      }

      parts.forEach(function (p) {
        if (p.v) { openSent(); html += span(p.t, "kw vhl"); return; }
        p.t.split(/(\s+)/).forEach(function (tok) {
          if (tok === "") return;
          if (/^\s+$/.test(tok)) {
            plain += tok;
            if (tok.indexOf("\n\n") >= 0) { closeSent(); html += "</p><p>"; }
            else html += w.esc(tok);
          } else {
            openSent();
            html += span(tok, "kw");
            if (/[.!?]["')\]]?$/.test(tok)) closeSent();
          }
        });
      });
      closeSent();

      return { plain: plain, html: "<p>" + html + "</p>", sentences: si };
    }
  };
})(window);
