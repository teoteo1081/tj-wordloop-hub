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
    rate: (w.APP_CONFIG && w.APP_CONFIG.DEFAULT_SPEECH_RATE) || 1,
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

  function makeUtterance(text) {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = S.rate;
    u.pitch = 1;
    if (S.voice) u.voice = S.voice;
    return u;
  }

  /* ---------- đọc 1 từ đơn lẻ (nút loa trong bảng) ---------- */
  S.speakWord = function (text) {
    if (!synth || !text) return;
    synth.cancel();
    S.stopHighlight();
    synth.speak(makeUtterance(text));
  };

  /* ---------- đọc lần lượt cả danh sách từ ----------
     items: [{text, id}]  ·  onEach(i) được gọi trước mỗi từ để tô sáng dòng */
  S.speakList = function (items, onEach, onDone) {
    if (!synth) { w.toast("Trình duyệt này không hỗ trợ đọc tự động", "err"); return; }
    S.stop();
    S._listStop = false;
    var i = 0;

    function step() {
      if (S._listStop || i >= items.length) {
        if (onEach) onEach(-1);
        if (onDone) onDone();
        return;
      }
      if (onEach) onEach(i);
      var u = makeUtterance(items[i].text);
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
     giật liên tục và cướp thao tác kéo chuột. Giờ:
       · so với đúng khung cuộn (#workspace)
       · chỉ cuộn khi từ đó THỰC SỰ ra khỏi tầm mắt
       · người dùng vừa tự cuộn trong 1,5 giây thì nhường, không cuộn      */
  var lastUserScroll = 0;
  S.noteUserScroll = function () { lastUserScroll = Date.now(); };

  S.followWord = function (el) {
    if (!el) return;
    if (Date.now() - lastUserScroll < 1500) return;      /* đang tự kéo -> nhường */

    var box = document.getElementById("workspace");
    if (!box) return;
    var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    /* phần tử đang bị ẩn (chế độ từng câu/từng đoạn) có kích thước 0 —
       cuộn theo nó là trang nhảy loạn */
    if (r.height === 0 && r.width === 0) return;
    var pad = 48;
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
    /* ~ 12 ký tự / giây ở tốc độ 1.0 */
    var totalMs = (totalChars / 12) * 1000 / (S.rate || 1);
    var i = 0, acc = 0;

    if (S._timer) clearInterval(S._timer);
    var t0 = Date.now();
    S._timer = setInterval(function () {
      if (S._boundaryFired) { clearInterval(S._timer); S._timer = null; return; }
      var elapsed = Date.now() - t0;
      var target = Math.min(Math.floor((elapsed / totalMs) * inRange.length), inRange.length - 1);
      if (target !== i) {
        i = target;
        clearOn();
        inRange[i].classList.add("on");
      }
      if (elapsed > totalMs) { clearInterval(S._timer); S._timer = null; }
      acc = acc; // giữ biến cho dễ debug
    }, 90);
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
