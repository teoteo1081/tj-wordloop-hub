/* speech.js — Web Speech API (miễn phí, có sẵn trong trình duyệt)
   ------------------------------------------------------------------
   Vì sao phải chia câu?  Chrome có lỗi cũ: utterance dài > ~15 giây thì
   tự đứt. Nên ta cắt đoạn văn thành từng câu, đọc nối tiếp nhau.

   Karaoke hoạt động thế nào?
   - Mỗi từ trong đoạn văn đã được bọc <span data-s data-e> = vị trí ký tự.
   - Sự kiện `onboundary` của trình duyệt báo "đang đọc tới ký tự thứ N".
   - Ta tìm span chứa ký tự N rồi bật class .on
   - iOS Safari không bắn onboundary -> tự động chuyển sang chế độ hẹn giờ
     (ước lượng thời lượng theo độ dài từ). */
(function (w) {
  "use strict";

  var synth = w.speechSynthesis || null;

  var S = {
    voice: null,
    rate: (w.APP_CONFIG && w.APP_CONFIG.DEFAULT_SPEECH_RATE) || 1,       /* tốc độ đọc bài đọc */
    vocabRate: (w.APP_CONFIG && w.APP_CONFIG.DEFAULT_SPEECH_RATE) || 1,  /* tốc độ đọc bảng từ vựng — RIÊNG, không đồng bộ với bài đọc */
    supported: !!synth,
    _container: null,
    _spans: [],
    _timer: null,
    _queue: [],
    _qi: 0,
    _offset: 0,          /* lát văn bản đang đọc bắt đầu ở ký tự thứ mấy của cả bài */
    _boundaryFired: false,
    _onEnd: null,
    _current: null
  };

  /* ---------- chọn giọng Mỹ tốt nhất có trên máy ---------- */
  var PREFERRED = [
    "Google US English", "Samantha", "Microsoft Aria", "Microsoft Jenny",
    "Microsoft Zira", "Microsoft Guy", "Alex", "Nicky", "Aaron"
  ];

  function pickVoice() {
    if (!synth) return null;
    var voices = synth.getVoices() || [];
    if (!voices.length) return null;

    for (var i = 0; i < PREFERRED.length; i++) {
      var hit = voices.find(function (v) { return v.name.indexOf(PREFERRED[i]) >= 0; });
      if (hit) return hit;
    }
    return voices.find(function (v) { return v.lang === "en-US"; })
        || voices.find(function (v) { return /^en[-_]US/i.test(v.lang); })
        || voices.find(function (v) { return /^en/i.test(v.lang); })
        || voices[0];
  }

  var LS_VOICE = "tjwl_voice_v1";

  function savedVoiceName() {
    try { return localStorage.getItem(LS_VOICE) || ""; } catch (e) { return ""; }
  }

  function resolveVoice() {
    if (!synth) return null;
    var want = savedVoiceName();
    if (want) {
      var hit = (synth.getVoices() || []).find(function (v) { return v.name === want; });
      if (hit) return hit;
    }
    return pickVoice();
  }

  S.init = function () {
    if (!synth) return;
    S.voice = resolveVoice();
    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = function () {
        S.voice = resolveVoice() || S.voice;
        if (S.onVoicesReady) S.onVoicesReady();
      };
    }
  };

  /* Danh sách giọng tiếng Anh có sẵn trên máy/điện thoại này */
  S.listVoices = function () {
    if (!synth) return [];
    var all = synth.getVoices() || [];
    var en = all.filter(function (v) { return /^en/i.test(v.lang); });
    /* giọng Mỹ lên trước */
    en.sort(function (a, b) {
      var au = /US/i.test(a.lang) ? 0 : 1, bu = /US/i.test(b.lang) ? 0 : 1;
      return au - bu || a.name.localeCompare(b.name);
    });
    return en;
  };

  S.setVoice = function (name) {
    try { localStorage.setItem(LS_VOICE, name || ""); } catch (e) {}
    S.voice = resolveVoice();
    return S.voice;
  };

  S.currentVoiceName = function () { return S.voice ? S.voice.name : ""; };

  S.voiceName = function () { return S.voice ? (S.voice.name + " · " + S.voice.lang) : "mặc định"; };

  /* Giọng tiếng Việt (cho "Đọc từ + Anh + Việt" — đọc luôn nghĩa tiếng
     Việt) — tìm đúng lang "vi"/"vi-VN" trong danh sách giọng máy đang có,
     KHÔNG lưu lựa chọn riêng như S.voice (tiếng Anh) vì hiếm khi cần đổi
     tay. Máy không có giọng Việt nào (hay gặp trên Windows/Chrome) thì trả
     về null -> trình duyệt tự đọc bằng giọng mặc định, phát âm sai dấu
     nhưng không vỡ tính năng (im lặng chấp nhận, không báo lỗi gì). */
  function pickVoiceFor(lang) {
    if (!synth || !lang) return null;
    var voices = synth.getVoices() || [];
    return voices.find(function (v) { return v.lang === lang; })
        || voices.find(function (v) { return v.lang && v.lang.slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase(); })
        || null;
  }

  /* rate không truyền -> lấy S.rate (tốc độ bài đọc) — bảng từ vựng
     dùng S.vocabRate riêng, ĐỘC LẬP với bài đọc, không đồng bộ nữa.
     lang không truyền -> mặc định "en-US" như trước giờ (S.voice đã chọn
     sẵn theo PREFERRED phía trên) — truyền "vi-VN" khi cần đọc nghĩa tiếng
     Việt (xem D.readAllWithMeaning trong detail.js). */
  function makeUtterance(text, rate, lang) {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "en-US";
    u.rate = rate != null ? rate : S.rate;
    u.pitch = 1;
    if (!lang || lang === "en-US") { if (S.voice) u.voice = S.voice; }
    else { var vv = pickVoiceFor(lang); if (vv) u.voice = vv; }
    return u;
  }

  /* ---------- đọc 1 từ đơn lẻ (nút loa trong bảng) ---------- */
  S.speakWord = function (text) {
    if (!synth || !text) return;
    synth.cancel();
    S.stopHighlight();
    synth.speak(makeUtterance(text, S.vocabRate));
  };

  /* ---------- đọc lần lượt cả danh sách từ ----------
     items: [{text, id, lang, groupIndex}] — "lang" không truyền thì mặc
     định tiếng Anh (giữ nguyên hành vi cũ). "groupIndex" dùng khi 1 dòng
     (vd 1 từ vựng) tách thành NHIỀU utterance liên tiếp (term/định nghĩa/
     nghĩa Việt, xem D.readAllWithMeaning trong detail.js) — để callback
     onEach tô sáng ĐÚNG 1 dòng suốt cả nhóm thay vì nhảy lung tung theo
     từng utterance con; không truyền thì coi groupIndex = i như cũ.
     onEach(i) được gọi trước mỗi từ/nhóm để tô sáng dòng. */
  S.speakList = function (items, onEach, onDone) {
    if (!synth) { w.toast("Trình duyệt này không hỗ trợ đọc tự động", "err"); return; }
    S.stop();
    S.resetFollow();
    S._listStop = false;
    var i = 0;

    function step() {
      if (S._listStop || i >= items.length) {
        if (onEach) onEach(-1);
        if (onDone) onDone();
        return;
      }
      var it = items[i];
      if (onEach) onEach(it.groupIndex != null ? it.groupIndex : i);
      var u = makeUtterance(it.text, S.vocabRate, it.lang);
      u.onend = function () { i++; setTimeout(step, 220); };
      u.onerror = function () { i++; setTimeout(step, 220); };
      synth.speak(u);
    }
    step();
  };

  /* ---------- highlight ---------- */
  function clearOn() {
    S._spans.forEach(function (sp) { sp.classList.remove("on"); });
  }

  function lightAt(charIndex) {
    var found = null;
    for (var i = 0; i < S._spans.length; i++) {
      var sp = S._spans[i];
      if (charIndex >= +sp.dataset.s && charIndex < +sp.dataset.e) { found = sp; break; }
    }
    if (!found) return;
    clearOn();
    found.classList.add("on");
    S.followWord(found);
  }

  /* ---------- cuộn theo từ đang đọc, KHÔNG giành với người dùng ----------
     Lỗi cũ: so vị trí của từ với khung đoạn văn (chứ không phải vùng nhìn
     thấy), nên gần như từ nào cũng gọi scrollIntoView("smooth") -> trang
     giật liên tục và cướp thao tác kéo chuột.
       · tự dò khung CUỘN GẦN NHẤT chứa từ đó (bảng từ / đoạn văn giờ có
         khung cuộn riêng, không còn chắc chắn là #workspace nữa)
       · chỉ cuộn khi từ đó THỰC SỰ ra khỏi tầm mắt
       · NGƯỜI DÙNG TỰ CUỘN THÌ THÔI LUÔN, không tự kéo lại nữa — trước
         đây chỉ nhường 1,5 giây rồi tự cuộn lại, nên user đang xem từ
         vựng ở chỗ khác thì cứ vài giây lại bị giật về đúng từ đang đọc,
         rất khó chịu. Chữ vẫn sáng theo giọng đọc bình thường, chỉ riêng
         việc TỰ CUỘN màn hình là dừng hẳn cho tới khi bắt đầu 1 lượt đọc
         mới (bấm Nghe US / Đọc tất cả từ lần nữa). */
  var userTookControl = false;
  S.noteUserScroll = function () { userTookControl = true; };
  S.resetFollow = function () { userTookControl = false; };

  function scrollBoxOf(el) {
    var node = el.parentElement;
    while (node && node !== document.body) {
      var cs = getComputedStyle(node);
      if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return document.getElementById("workspace");
  }

  /* opts.anchor:
       "center" (mặc định) — giữ trong vùng nhìn thấy, chỉ cuộn khi ra
         khỏi tầm mắt, dùng cho bài đọc (đoạn văn dài, không nên ghim
         cứng 1 chỗ vì mất mạch đọc).
       "top"    — LUÔN ghim dòng đang đọc ngay sát đỉnh khung, dùng cho
         bảng từ vựng thu gọn: khung chỉ ~3 dòng nên nếu chỉ "giữ trong
         tầm mắt" thì dòng đang đọc lúc rơi vào dòng 1, lúc dòng 3, nhìn
         như nhảy lung tung — ghim cố định 1 vị trí thì dễ dò theo hơn. */
  S.followWord = function (el, opts) {
    if (!el) return;
    if (userTookControl) return;      /* user đã tự cuộn -> thôi hẳn, để họ yên */

    /* opts.scrollBox: chỉ thẳng khung cuộn, KHỎI dò qua getComputedStyle
       (dò tự động từng sai/không chắc ăn với bảng từ vựng — lúc thu gọn
       thì đúng là #vocab-wrap, lúc mở rộng lại là #workspace, mà tự dò
       nhiều lần vẫn không ổn định). Bên gọi (detail.js) biết chắc đang ở
       chế độ nào nên tự truyền đúng khung vào. */
    var box = (opts && opts.scrollBox) || scrollBoxOf(el);
    if (!box) return;
    var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    /* phần tử đang bị ẩn (chế độ từng câu/từng đoạn) có kích thước 0 —
       cuộn theo nó là trang nhảy loạn */
    if (r.height === 0 && r.width === 0) return;

    if (opts && opts.anchor === "top") {
      /* Dùng scrollIntoView() có sẵn của trình duyệt thay vì tính tay
         scrollTop (hay lệch/giật khi có dòng tiêu đề dính che ở trên) —
         CSS đã khai "scroll-padding-top" đúng bằng chiều cao tiêu đề
         (xem .table-wrap.collapsed trong app.css), nên trình duyệt tự
         chừa đúng chỗ, khỏi phải đo tay ở đây nữa. Gọi mỗi từ luôn, không
         "tối ưu" bỏ qua khi tưởng đã đúng chỗ — scrollIntoView vô hại
         khi gọi lặp, còn bỏ qua sai lại thành KHÔNG BAO GIỜ cuộn. */
      el.scrollIntoView({ block: "start" });
      return;
    }

    var pad = Math.min(48, b.height / 3);
    if (r.top >= b.top + pad && r.bottom <= b.bottom - pad) return;   /* còn trong tầm mắt */

    /* cuộn thẳng, không "smooth" — smooth gọi liên tiếp là sinh ra giật */
    box.scrollTop += (r.top - b.top) - (b.height / 2 - r.height / 2);
  };

  S.stopHighlight = function () {
    if (S._timer) { clearInterval(S._timer); S._timer = null; }
    clearOn();
  };

  /* ---------- chế độ dự phòng: hẹn giờ theo độ dài từ ---------- */
  function startFallbackTimer(sentence) {
    var base = S._offset + sentence.start;
    var inRange = S._spans.filter(function (sp) {
      return +sp.dataset.s >= base && +sp.dataset.e <= base + sentence.text.length;
    });
    if (!inRange.length) return;

    var totalChars = inRange.reduce(function (a, sp) { return a + sp.dataset.w.length; }, 0) || 1;
    /* ~ 14.5 ký tự / giây ở tốc độ 1.0 (ước theo tốc độ nói tiếng Anh
       trung bình ~150 từ/phút, mỗi từ ~5.7 ký tự kể cả khoảng trắng) */
    var totalMs = (totalChars / 14.5) * 1000 / (S.rate || 1);

    /* Mốc [0..1] TÍCH LUỸ theo ĐỘ DÀI TỪNG TỪ — từ dài giữ đèn sáng lâu
       hơn từ ngắn. Trước đây chia đều theo SỐ TỪ dù totalMs tính theo
       tổng ký tự, nên từ vựng dài (thường chính là từ đang học) tắt đèn
       sớm trước khi đọc xong, càng lệch rõ khi đổi tốc độ đọc. */
    var marks = [], acc = 0;
    inRange.forEach(function (sp) {
      acc += sp.dataset.w.length;
      marks.push(acc / totalChars);
    });

    var i = -1;
    if (S._timer) clearInterval(S._timer);
    var t0 = Date.now();
    S._timer = setInterval(function () {
      if (S._boundaryFired) { clearInterval(S._timer); S._timer = null; return; }
      var elapsed = Date.now() - t0;
      var frac = elapsed / totalMs;
      var target = marks.findIndex(function (m) { return frac <= m; });
      if (target < 0) target = inRange.length - 1;
      if (target !== i) {
        i = target;
        clearOn();
        inRange[i].classList.add("on");
      }
      if (elapsed > totalMs) { clearInterval(S._timer); S._timer = null; }
    }, 60);
  }

  /* ---------- cắt đoạn văn thành câu, giữ vị trí ký tự gốc ---------- */
  function splitSentences(plain) {
    var out = [], re = /[^.!?\n]+[.!?"']*/g, m;
    while ((m = re.exec(plain)) !== null) {
      if (!m[0].trim()) continue;
      out.push({ text: m[0], start: m.index });
    }
    if (!out.length && plain.trim()) out.push({ text: plain, start: 0 });
    return out;
  }

  /* ---------- đọc cả đoạn văn ---------- */
  S.readPassage = function (opts) {
    if (!synth) { w.toast("Trình duyệt này không hỗ trợ đọc tự động", "err"); return; }
    S.stop();
    /* KHÔNG resetFollow() ở đây — chế độ từng câu/từng đoạn tự gọi lại
       readPassage() cho mỗi câu/đoạn kế tiếp (xem readCurrent() trong
       detail.js), gọi resetFollow() ở đây sẽ xoá mất lựa chọn "để yên
       tôi" của user sau MỖI câu, vài trăm mili-giây lại kéo về như cũ.
       Chỗ thật sự bắt đầu 1 lượt nghe mới (nút "🎧 Nghe US") tự gọi
       resetFollow() riêng. */

    S._container = opts.container;
    S._spans = w.$$(".kw", opts.container);
    /* đọc từng câu / từng đoạn thì `plain` chỉ là một lát của cả bài,
       `offset` cho biết lát đó bắt đầu ở ký tự thứ mấy trong bài gốc */
    S._offset = opts.offset || 0;
    S._onEnd = opts.onEnd || null;
    S._queue = splitSentences(opts.plain);
    S._qi = 0;
    S._boundaryFired = false;

    speakNext();
  };

  function speakNext() {
    if (S._qi >= S._queue.length) {
      S.stopHighlight();
      if (S._onEnd) S._onEnd();
      return;
    }
    var sentence = S._queue[S._qi];
    var u = makeUtterance(sentence.text);
    S._current = u;

    /* Reset MỖI CÂU, không phải 1 lần cho cả bài. Lỗi cũ: cờ này chỉ tắt
       lúc bắt đầu cả đoạn văn -> câu 1 bắt được onboundary thì cờ bật true
       mãi mãi, nên từ câu sau hễ trình duyệt lỡ không bắn onboundary (rất
       hay gặp, tuỳ giọng) là chế độ hẹn giờ dự phòng KHÔNG BAO GIỜ được
       bật lên nữa -> chữ đứng khựng, không sáng tiếp dù giọng vẫn đọc. */
    S._boundaryFired = false;
    var gotBoundary = false;
    u.onboundary = function (e) {
      if (typeof e.charIndex !== "number") return;
      gotBoundary = true; S._boundaryFired = true;
      if (S._timer) { clearInterval(S._timer); S._timer = null; }
      lightAt(S._offset + sentence.start + e.charIndex);
    };
    u.onend = function () { S._qi++; speakNext(); };
    u.onerror = function () { S._qi++; speakNext(); };

    synth.speak(u);

    /* nếu 700ms mà chưa có boundary nào -> dùng chế độ hẹn giờ */
    setTimeout(function () {
      if (!gotBoundary && !S._boundaryFired && synth.speaking) startFallbackTimer(sentence);
    }, 700);
  }

  S.stop = function () {
    S._listStop = true;
    if (synth) synth.cancel();
    S.stopHighlight();
    S._queue = []; S._qi = 0; S._current = null;
  };

  S.setRate = function (r) { S.rate = parseFloat(r) || 1; };
  S.setVocabRate = function (r) { S.vocabRate = parseFloat(r) || 1; };
  S.isSpeaking = function () { return !!(synth && synth.speaking); };

  /* Bật sáng thủ công tại vị trí ký tự thứ N — dùng để kiểm thử phần
     karaoke mà không cần máy có sẵn giọng đọc, và để gỡ lỗi khi cần. */
  S.highlightAt = function (container, charIndex) {
    if (container) { S._container = container; S._spans = w.$$(".kw", container); }
    lightAt(charIndex);
  };

  /* lối vào cho bộ kiểm thử tự động (không dùng trong app) */
  S._test = { lightAt: lightAt, startFallbackTimer: startFallbackTimer, splitSentences: splitSentences };

  w.Speech = S;
})(window);
