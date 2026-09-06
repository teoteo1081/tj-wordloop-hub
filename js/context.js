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
    translate: function (textWithGap, term, meaningVi) {
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

    /* Lấy các câu trong đoạn văn, mỗi câu chứa 1 từ vựng, để dựng đề điền từ.
       Trả về [{term, text}] với text có dấu {{GAP}} ở đúng chỗ cần điền.
       Đây chính là chỗ nối "bài thi cuối bài" với "đoạn văn đã gen". */
    gapSentences: function (marked) {
      var out = [], seen = {}, re = /[^.!?\n]+[.!?]+/g, m;
      while ((m = re.exec(String(marked || ""))) !== null) {
        var s = m[0].trim();
        var hit = s.match(/\[([^\]]+)\]/);
        if (!hit) continue;
        var term = hit[1];
        if (seen[term.toLowerCase()]) continue;
        seen[term.toLowerCase()] = 1;
        var text = s.replace("[" + term + "]", "{{GAP}}")
                    .replace(/\[([^\]]+)\]/g, "$1");
        out.push({ term: term, text: text });
      }
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
