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

    /* ═══════════ SINH BÀI ĐỌC BẰNG AI (Gemini miễn phí, hoặc OpenAI) ═══════════
       Cần window.APP_CONFIG.GEMINI_API_KEY hoặc OPENAI_API_KEY (đặt trong
       js/keys.local.js, KHÔNG commit lên git). Gọi thẳng từ trình duyệt —
       không có backend.
       Trả về CHUỖI để lưu y hệt chỗ dùng Context.generate(): văn bản có
       [đánh dấu] + một khối JSON ẩn phía sau (ngăn bởi META_SEP) chứa
       bản dịch từng câu + tiêu đề + nguồn, để đọc lại đúng như lúc sinh. */
    META_SEP: "\n<<<TJWL_META>>>\n",

    parseMeta: function (raw) {
      var s = String(raw || "");
      var i = s.indexOf(w.Context.META_SEP);
      if (i < 0) return { marked: s, vi: null, title: null, source: null, ai: false, pasted: false, claude: false };
      var meta = {};
      try { meta = JSON.parse(s.slice(i + w.Context.META_SEP.length)) || {}; } catch (e) { meta = {}; }
      return {
        marked: s.slice(0, i),
        vi: meta.vi || null,
        title: meta.title || null,
        source: meta.source || null,
        ai: !!meta.ai,
        pasted: !!meta.pasted,
        claude: !!meta.claude
      };
    },

    /* Gọi OpenAI (trả phí, cần credit) */
    _callOpenAI: async function (cfg, sys, user) {
      var res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cfg.OPENAI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: cfg.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.9,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: sys }, { role: "user", content: user }]
        })
      });
      if (!res.ok) {
        var errText = await res.text().catch(function () { return ""; });
        throw new Error("OpenAI HTTP " + res.status + ": " + errText.slice(0, 180));
      }
      var data = await res.json();
      var raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!raw) throw new Error("OpenAI trả về rỗng");
      return raw;
    },

    /* Gọi Gemini (MIỄN PHÍ, key lấy tại aistudio.google.com/apikey) */
    _callGemini: async function (cfg, sys, user) {
      var model = cfg.GEMINI_MODEL || "gemini-3.6-flash";
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model +
                ":generateContent?key=" + encodeURIComponent(cfg.GEMINI_API_KEY);
      var res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { temperature: 0.9, responseMimeType: "application/json" }
        })
      });
      if (!res.ok) {
        var errText = await res.text().catch(function () { return ""; });
        throw new Error("Gemini HTTP " + res.status + ": " + errText.slice(0, 180));
      }
      var data = await res.json();
      var cand = data.candidates && data.candidates[0];
      var raw = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
      if (!raw) throw new Error("Gemini trả về rỗng (có thể bị chặn bởi bộ lọc an toàn nội dung)");
      return raw;
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

    /* words: [{term, meaning_vi, def_en}] -> Promise<string> (đã kèm meta).
       Ưu tiên Gemini (miễn phí) nếu có key, không thì dùng OpenAI. Sinh
       MỘT BÀI ĐỌC LIỀN MẠCH (~450-550 từ) chứ không phải kiểu "mỗi từ 1
       câu rời" — từ vựng chỉ là điểm neo xen giữa văn xuôi tự nhiên.
       difficulty: "easy" | "medium" | "hard" (mặc định "medium") — chỉ
       ảnh hưởng ĐỘ KHÓ CÂU/TỪ XUNG QUANH, số từ vẫn ~500, vẫn đủ hết từ
       vựng của Block như nhau ở cả 3 mức. */
    generateAI: async function (words, cfg, difficulty) {
      var terms = (words || []).map(function (x) { return x.term; }).filter(Boolean);
      if (!terms.length) throw new Error("Block chưa có từ vựng");
      if (!cfg || (!cfg.GEMINI_API_KEY && !cfg.OPENAI_API_KEY)) {
        throw new Error("chưa có GEMINI_API_KEY hay OPENAI_API_KEY");
      }
      var diffKey = w.Context.DIFFICULTY[difficulty] ? difficulty : "medium";
      var diffDesc = w.Context.DIFFICULTY[diffKey];

      var wordList = words.map(function (x) {
        return "- " + x.term +
          (x.meaning_vi ? " (nghĩa: " + x.meaning_vi + ")" : "") +
          (x.def_en ? " — " + x.def_en : "");
      }).join("\n");

      var sys = "Bạn là trợ lý viết bài đọc hiểu tiếng Anh để luyện từ vựng cho người Việt học " +
        "tiếng Anh. Luôn trả lời DUY NHẤT một object JSON đúng schema được yêu cầu, không thêm " +
        "chữ nào khác, không dùng markdown code fence.";
      var user =
        "Viết một BÀI ĐỌC HIỂU tiếng Anh hoàn chỉnh, TỰ NHIÊN, dài khoảng 450–550 từ, chia 3–5 " +
        "đoạn văn (ngăn cách bằng 1 dòng trống), có mạch truyện/chủ đề xuyên suốt do bạn TỰ CHỌN " +
        "theo đúng chủ đề của nhóm từ bên dưới (đừng lúc nào cũng là họp hành văn phòng — có thể " +
        "là một chuyến đi, chuyện gia đình, dự án học tập, thể thao, công nghệ, khoa học…).\n\n" +
        "ĐỘ KHÓ của câu văn xung quanh (không phải độ khó của từ vựng cần học bên dưới, cái đó " +
        "giữ nguyên): " + diffDesc + ".\n\n" +
        "Bài đọc PHẢI chứa TẤT CẢ các từ sau, mỗi từ xuất hiện ĐÚNG MỘT LẦN, NGUYÊN VĂN (không " +
        "chia động từ, không đổi số ít/nhiều), xen kẽ tự nhiên trong bài — KHÔNG dồn hết vào 1 " +
        "câu, KHÔNG viết kiểu mỗi từ 1 câu tách rời nhau, mà để bài đọc trôi chảy như văn viết " +
        "thật:\n\n" +
        wordList +
        "\n\nSau khi viết xong, với MỖI từ ở trên, ghi lại bản dịch tiếng Việt của ĐÚNG câu trong " +
        "bài chứa từ đó (chỉ câu đó thôi, không phải cả đoạn).\n\n" +
        "Đặt thêm 1 tiêu đề tiếng Anh ngắn (5–8 từ) và 1 dòng mô tả nguồn bằng tiếng Việt.\n\n" +
        "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
        '{"title":"...", "source_vi":"...", "passage_en":"...", ' +
        '"translations":[{"term":"...","vi":"..."}]}';

      /* Ưu tiên Gemini (miễn phí) nếu có key, không thì dùng OpenAI. */
      var raw = cfg.GEMINI_API_KEY
        ? await w.Context._callGemini(cfg, sys, user)
        : await w.Context._callOpenAI(cfg, sys, user);
      var parsed = JSON.parse(raw);
      if (!parsed.passage_en) throw new Error("Thiếu 'passage_en' trong JSON trả về");

      var marked = w.Context._markTerms(parsed.passage_en, terms);

      var viMap = {};
      (parsed.translations || []).forEach(function (t) {
        if (t && t.term && t.vi) viMap[String(t.term).toLowerCase()] = t.vi;
      });

      var meta = {
        ai: true,
        vi: viMap,
        title: parsed.title || "",
        source: parsed.source_vi || "Bài đọc do AI sinh riêng cho Block này."
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
      if (!cfg || (!cfg.GEMINI_API_KEY && !cfg.OPENAI_API_KEY)) {
        throw new Error("chưa có GEMINI_API_KEY hay OPENAI_API_KEY");
      }
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
        "- sentence_vi: bản dịch tiếng Việt của ĐÚNG câu chứa từ đó trong đoạn văn\n\n" +
        "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
        '{"words":[{"term":"...","level":"...","pos":"...","ipa":"...","def_en":"...","meaning_vi":"...","sentence_vi":"..."}]}';

      var raw2 = cfg.GEMINI_API_KEY
        ? await w.Context._callGemini(cfg, sys, user)
        : await w.Context._callOpenAI(cfg, sys, user);
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
      if (!cfg || (!cfg.GEMINI_API_KEY && !cfg.OPENAI_API_KEY)) {
        throw new Error("chưa có GEMINI_API_KEY hay OPENAI_API_KEY");
      }
      var needy = (words || []).filter(function (x) {
        return x && x.term && (!x.level || !x.pos || !x.ipa || !x.def_en || !x.meaning_vi);
      });
      if (!needy.length) return { words: words, filled: 0 };

      var BATCH = 25;
      var filled = 0;

      for (var i = 0; i < needy.length; i += BATCH) {
        var chunk = needy.slice(i, i + BATCH);
        var listText = chunk.map(function (x, j) {
          var known = [];
          if (x.meaning_vi) known.push("nghĩa VI đã biết: " + x.meaning_vi);
          if (x.def_en) known.push("định nghĩa EN đã biết: " + x.def_en);
          if (x.level) known.push("cấp độ đã biết: " + x.level);
          if (x.pos) known.push("loại từ đã biết: " + x.pos);
          return (j + 1) + '. "' + x.term + '"' + (known.length ? " (" + known.join("; ") + ")" : "");
        }).join("\n");

        var sys = "Bạn là từ điển Anh-Việt cho người học tiếng Anh. Trả lời DUY NHẤT 1 object JSON " +
          "đúng schema được yêu cầu, không thêm chữ nào khác, không dùng markdown code fence.";
        var user =
          "Với ĐÚNG " + chunk.length + " từ/cụm từ tiếng Anh sau (đã đánh số thứ tự), cho biết đầy " +
          "đủ: cấp độ CEFR (A1/A2/B1/B2/C1/C2), loại từ (Verb/Noun/Adjective/Adverb/Phrase…), phiên " +
          "âm IPA kiểu từ điển (có dấu / /), định nghĩa tiếng Anh ngắn gọn, và nghĩa tiếng Việt. " +
          "Trả về ĐÚNG THEO THỨ TỰ đã đánh số, đủ " + chunk.length + " mục, không bỏ mục nào, không " +
          "gộp/tách mục:\n\n" + listText + "\n\n" +
          "Trả về đúng schema JSON sau, không thêm trường khác:\n" +
          '{"words":[{"term":"...","level":"...","pos":"...","ipa":"...","def_en":"...","meaning_vi":"..."}]}';

        var raw = cfg.GEMINI_API_KEY
          ? await w.Context._callGemini(cfg, sys, user)
          : await w.Context._callOpenAI(cfg, sys, user);
        var parsed = JSON.parse(raw);
        var got = parsed.words || [];

        for (var k = 0; k < chunk.length; k++) {
          var orig = chunk[k], suggestion = got[k];
          if (!suggestion) continue;
          if (!orig.level && suggestion.level) { orig.level = suggestion.level; filled++; }
          if (!orig.pos && suggestion.pos) { orig.pos = suggestion.pos; filled++; }
          if (!orig.ipa && suggestion.ipa) { orig.ipa = suggestion.ipa; filled++; }
          if (!orig.def_en && suggestion.def_en) { orig.def_en = suggestion.def_en; filled++; }
          if (!orig.meaning_vi && suggestion.meaning_vi) { orig.meaning_vi = suggestion.meaning_vi; filled++; }
        }
      }
      return { words: words, filled: filled };
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
