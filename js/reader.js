/* reader.js — ĐỌC BÀI KIỂU LingQ
   ------------------------------------------------------------------
   1) Bấm (hoặc bôi) một từ / cụm từ trong bài đọc  ->  mở bảng tra từ:
      phát âm · loại từ · nghĩa Anh · nghĩa Việt · câu ví dụ lấy ngay
      trong bài · ô tự ghi nghĩa · 5 nút mức độ thuộc (1-4 và ✓).
   2) Lưu lại  ->  từ được đưa vào batch "⭐ Từ đã lưu" của Page hiện tại,
      cứ đủ 10 từ là tự ngắt sang Block kế tiếp.
   3) Từ đã lưu được tô nền vàng ngay trong bài (đậm/nhạt theo mức độ),
      giống LingQ — nhìn là biết chỗ nào mình còn yếu.
   4) Ba kiểu đọc: Full (mặc định) · Sentence View · Page View.
   ------------------------------------------------------------------ */
(function (w) {
  "use strict";

  var R = {
    mode: "full",        // full | sentence | page
    idx: 0,              // câu / trang đang xem
    term: "",            // từ đang mở trong bảng tra
    ctx: "",             // câu chứa từ đó
    _wordId: null        // id trong kho nếu từ đã có sẵn
  };

  var LS_MODE = "tjwl_readmode_v1";
  function S() { return w.S; }

  /* ══════════ TRA CỨU TRONG KHO TỪ ĐÃ CÓ ══════════ */
  function norm(s) { return w.normalizeAnswer(s); }

  /* Gom mọi từ trong notebook thành từ điển tra nhanh theo chữ */
  function index() {
    var map = {};
    (S().words || []).forEach(function (x) {
      var k = norm(x.term);
      if (k && !map[k]) map[k] = x;
    });
    return map;
  }

  R.lookup = function (term) { return index()[norm(term)] || null; };

  /* Biến thể hình thái đơn giản: plays/played/playing -> play, quickly -> quick */
  function variants(t) {
    var v = [t], s = t.toLowerCase();
    if (/ies$/.test(s)) v.push(s.replace(/ies$/, "y"));
    if (/(es|s)$/.test(s)) v.push(s.replace(/es$/, ""), s.replace(/s$/, ""));
    if (/ed$/.test(s)) v.push(s.replace(/ed$/, ""), s.replace(/ed$/, "e"));
    if (/ing$/.test(s)) v.push(s.replace(/ing$/, ""), s.replace(/ing$/, "e"));
    if (/ly$/.test(s)) v.push(s.replace(/ly$/, ""));
    if (/([a-z])\1(ed|ing)$/.test(s)) v.push(s.replace(/([a-z])\1(ed|ing)$/, "$1"));
    return v;
  }

  /* ĐỀ XUẤT NGHĨA — lấy từ chính kho từ vựng của bạn, không cần mạng.
     · chọn 1 từ  -> nghĩa của đúng từ đó, các biến thể, và các cụm chứa nó
     · chọn 1 cụm -> nghĩa cả cụm (nếu có) + nghĩa từng từ trong cụm      */
  R.suggest = function (term) {
    var map = index(), out = [], seen = {};

    function push(hit, why) {
      if (!hit || !hit.meaning_vi) return;
      var k = norm(hit.meaning_vi);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ vi: hit.meaning_vi, def: hit.def_en || "", src: hit.term, why: why });
    }

    /* 1. đúng từ / đúng cụm */
    push(map[norm(term)], "đúng từ này");

    /* 2. biến thể hình thái */
    variants(term).forEach(function (v) {
      if (norm(v) !== norm(term)) push(map[norm(v)], "dạng gốc: " + v);
    });

    var parts = term.trim().split(/\s+/);

    /* 3. nếu là cụm -> nghĩa từng từ để bạn tự ghép */
    if (parts.length > 1) {
      parts.forEach(function (p) {
        var hit = map[norm(p)];
        if (!hit) { variants(p).some(function (v) { hit = map[norm(v)]; return !!hit; }); }
        push(hit, "từ trong cụm: " + p);
      });
    }

    /* 4. các cụm trong kho có chứa từ này */
    var re = new RegExp("(^|\\s)" + norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|\\s)");
    Object.keys(map).forEach(function (k) {
      if (out.length >= 8) return;
      if (k !== norm(term) && re.test(k)) push(map[k], "trong cụm: " + map[k].term);
    });

    return out.slice(0, 8);
  };

  /* ══════════ TÔ MÀU TỪ ĐÃ LƯU TRONG BÀI ĐỌC ══════════ */
  R.decorate = function () {
    var box = w.$("#passage");
    if (!box) return;
    var map = index(), wp = S().wp || {};
    var spans = w.$$(".kw", box);

    /* 1) từ đơn */
    spans.forEach(function (sp) {
      sp.classList.remove("lq", "lq1", "lq2", "lq3", "lq4", "lq5");
      var hit = map[norm(sp.dataset.w)];
      if (!hit) return;
      var lv = (wp[hit.id] && wp[hit.id].familiarity) || 1;
      sp.classList.add("lq", "lq" + lv);
      sp.dataset.term = hit.term;
    });

    /* 2) cụm nhiều chữ: ghép các span liền nhau lại rồi so khớp */
    var phrases = Object.keys(map).filter(function (k) { return k.indexOf(" ") > 0; });
    if (!phrases.length) return;
    var maxLen = phrases.reduce(function (m, p) { return Math.max(m, p.split(" ").length); }, 2);

    for (var i = 0; i < spans.length; i++) {
      for (var n = Math.min(maxLen, spans.length - i); n >= 2; n--) {
        var slice = spans.slice(i, i + n);
        var joined = norm(slice.map(function (s) { return s.dataset.w; }).join(" "));
        var hit2 = map[joined];
        if (!hit2) continue;
        var lv2 = (wp[hit2.id] && wp[hit2.id].familiarity) || 1;
        slice.forEach(function (s, k) {
          s.classList.remove("lq1", "lq2", "lq3", "lq4", "lq5");
          s.classList.add("lq", "lq" + lv2, "lq-part");
          if (k === 0) s.classList.add("lq-first");
          if (k === n - 1) s.classList.add("lq-last");
          s.dataset.term = hit2.term;
        });
        i += n - 1;
        break;
      }
    }
  };

  /* ══════════ CÂU CHỨA TỪ (làm ví dụ) ══════════ */
  function sentenceOf(el) {
    var s = el && el.closest ? el.closest(".sent") : null;
    return s ? s.textContent.replace(/\s+/g, " ").trim() : "";
  }

  /* ══════════ MỞ / ĐÓNG BẢNG TRA TỪ ══════════ */
  /* Không truyền câu ví dụ thì tự đi tìm trong bài đọc câu nào có chứa từ này */
  function findUsage(term) {
    var box = w.$("#passage");
    if (!box) return "";
    var t = norm(term);
    var hit = w.$$(".sent", box).filter(function (s) {
      return norm(s.textContent).indexOf(t) >= 0;
    })[0];
    return hit ? hit.textContent.replace(/\s+/g, " ").trim() : "";
  }

  R.open = function (term, ctx) {
    if (!term) return;
    R.term = term.trim();
    R.ctx = ctx || findUsage(R.term);
    var hit = R.lookup(R.term);
    R._wordId = hit ? hit.id : null;

    var wp = S().wp || {};
    var lv = (hit && wp[hit.id] && wp[hit.id].familiarity) || 0;

    var tags = [];
    if (hit && hit.pos) tags.push(w.esc(hit.pos));
    if (hit && hit.level) tags.push(w.esc(hit.level));
    /* "freq" (common/uncommon) — AI tự chấm lúc trích/điền từ vựng (xem
       extractVocab/enrichWords trong context.js), KHÔNG suy từ cấp độ
       CEFR. Chưa có (Block cũ sinh trước khi có field này) -> ẩn hẳn,
       không đoán bừa. */
    if (hit && hit.freq === "common") tags.push("🔵 Thông dụng");
    else if (hit && hit.freq === "uncommon") tags.push("⚪ Ít thông dụng");

    w.$("#wp-term").textContent = R.term;
    w.$("#wp-ipa").textContent = hit && hit.ipa ? hit.ipa : "";
    w.$("#wp-tags").innerHTML = tags.map(function (t) {
      return '<span class="pos-badge">' + t + "</span>";
    }).join("");

    w.$("#wp-status").innerHTML = hit
      ? '<span class="wp-known">Đã có trong kho từ</span>'
      : '<span class="wp-new">Từ mới — chưa có trong kho</span>';

    w.$("#wp-def").innerHTML = hit && hit.def_en
      ? '<div class="wp-lbl">English definition</div><div class="wp-val">' + w.esc(hit.def_en) + "</div>"
      : "";
    w.$("#wp-vi").innerHTML = hit && hit.meaning_vi
      ? '<div class="wp-lbl">Nghĩa tiếng Việt</div><div class="wp-val vi">' + w.esc(hit.meaning_vi) + "</div>"
      : "";
    w.$("#wp-usage").innerHTML = R.ctx
      ? '<div class="wp-lbl">Cách dùng — câu trong bài</div><div class="wp-val usage">' + w.esc(R.ctx) + "</div>"
      : "";

    /* ĐỀ XUẤT NGHĨA — bấm một dòng là điền luôn vào ô "Nghĩa của bạn" */
    var sg = R.suggest(R.term);
    var nWords = R.term.trim().split(/\s+/).length;
    w.$("#wp-suggest").innerHTML = sg.length
      ? '<div class="wp-lbl mt">Đề xuất nghĩa — bấm để chọn</div>' +
        '<div class="sg-list">' + sg.map(function (s) {
          return '<button class="sg-row" data-vi="' + w.esc(s.vi) + '">' +
                   '<span class="sg-vi">' + w.esc(s.vi) + "</span>" +
                   '<span class="sg-why">' + w.esc(s.why) + "</span>" +
                   (s.def ? '<span class="sg-def">' + w.esc(s.def) + "</span>" : "") +
                 "</button>";
        }).join("") + "</div>"
      : (hit ? "" :
         '<div class="wp-lbl mt">Đề xuất nghĩa</div>' +
         '<div class="sg-empty">Kho từ chưa có gì gần với ' +
         (nWords > 1 ? "cụm" : "từ") + " này — bạn tự gõ nghĩa bên dưới nhé.</div>");

    /* nhắc rõ đang lưu 1 từ hay cả cụm */
    w.$("#wp-scope").textContent = nWords > 1
      ? "Sẽ lưu cả cụm " + nWords + " từ"
      : "Sẽ lưu 1 từ";

    var inp = w.$("#wp-meaning");
    inp.value = hit && hit.meaning_vi ? hit.meaning_vi : (sg.length ? sg[0].vi : "");
    inp.placeholder = hit ? "Sửa lại nghĩa nếu muốn…" : "Gõ nghĩa tiếng Việt rồi bấm mức độ để lưu";

    w.$$("#wp-levels .lvl-btn").forEach(function (b) {
      b.classList.toggle("on", +b.dataset.lv === lv);
    });
    w.$("#wp-del").style.display = hit ? "" : "none";

    w.$("#word-panel").classList.add("open");
    /* Ghim rồi thì không cần nền mờ — vẫn đọc và cuộn bài bình thường,
       bấm từ khác là bảng tự đổi nội dung tại chỗ. */
    w.$("#panel-backdrop").hidden = R.pinned;
  };

  R.close = function () {
    if (R.pinned) return;            /* đang ghim thì giữ nguyên */
    R.forceClose();
  };

  R.forceClose = function () {
    w.$("#word-panel").classList.remove("open");
    w.$("#panel-backdrop").hidden = true;
  };

  /* ══════════ GHIM BẢNG NGHĨA ══════════ */
  var LS_PIN_WP = "tjwl_wp_pin_v1";
  try { R.pinned = localStorage.getItem(LS_PIN_WP) === "1"; } catch (e) { R.pinned = false; }

  R.applyPin = function () {
    var btn = w.$("#wp-pin");
    var panel = w.$("#word-panel");
    panel.classList.toggle("pinned", R.pinned);
    btn.classList.toggle("off", !R.pinned);
    btn.textContent = R.pinned ? "📌" : "📍";
    btn.title = R.pinned ? "Bỏ ghim — bấm ra ngoài là cất đi" : "Ghim bảng nghĩa lại";
    if (R.pinned) w.$("#panel-backdrop").hidden = true;
  };

  R.togglePin = function () {
    R.pinned = !R.pinned;
    try { localStorage.setItem(LS_PIN_WP, R.pinned ? "1" : "0"); } catch (e) {}
    R.applyPin();
  };

  /* ══════════ LƯU TỪ ══════════ */
  R.saveLevel = async function (level) {
    var meaning = w.$("#wp-meaning").value.trim();
    var hit = R.lookup(R.term);

    try {
      if (!hit) {
        if (!S().pageId) { w.toast("Hãy chọn một Page trước", "err"); return; }
        var gi = 0;
        S().blocks.forEach(function (b) { gi = Math.max(gi, b.global_index || 0); });
        var res = await w.DB.saveWordToExtra(S().pageId,
          { term: R.term, meaning_vi: meaning, def_en: "", ipa: "", pos: "", level: "" },
          { nextGlobalIndex: gi + 1 });

        /* nạp vào bộ nhớ để hiện ngay, khỏi phải tải lại trang */
        if (!S().batches.some(function (b) { return b.id === res.batch.id; })) S().batches.push(res.batch);
        if (!S().blocks.some(function (b) { return b.id === res.block.id; })) S().blocks.push(res.block);
        S().words.push(res.word);
        hit = res.word;

        w.toast(res.isNewBlock
          ? "Đã lưu · mở Block mới trong ⭐ Từ đã lưu"
          : "Đã lưu vào ⭐ Từ đã lưu", "ok");
      } else if (meaning && meaning !== hit.meaning_vi) {
        hit.meaning_vi = meaning;
        if (w.DB.updateWord) { try { await w.DB.updateWord(hit.id, { meaning_vi: meaning }); } catch (e) {} }
      }

      var prev = S().wp[hit.id] || { attempts: 0, correct: 0 };
      S().wp[hit.id] = Object.assign({}, prev, {
        familiarity: level, last_reviewed_at: Date.now(),
        user_id: w.Auth.user.id, word_id: hit.id
      });
      try { await w.DB.saveFamiliarity(w.Auth.user.id, hit.id, level); } catch (e) {}

      R.decorate();
      if (!R.pinned) R.forceClose();
      else R.open(R.term, R.ctx);          /* đang ghim -> cập nhật tại chỗ */
      if (w.App && w.App.renderAll) w.App.renderAll();
    } catch (e) {
      w.toast("Lỗi khi lưu: " + (e.message || e), "err");
    }
  };

  R.removeWord = async function () {
    var hit = R.lookup(R.term);
    if (!hit) return;
    try {
      await w.DB.remove("words", hit.id);
      S().words = S().words.filter(function (x) { return x.id !== hit.id; });
      delete S().wp[hit.id];
      R.decorate();
      R.close();
      if (w.App && w.App.renderAll) w.App.renderAll();
      w.toast("Đã bỏ từ khỏi kho");
    } catch (e) { w.toast("Không xoá được: " + (e.message || e), "err"); }
  };

  /* ══════════ CHẾ ĐỘ ĐỌC ══════════ */
  R.setMode = function (mode) {
    R.mode = mode; R.idx = 0;
    try { localStorage.setItem(LS_MODE, mode); } catch (e) {}
    w.$$("#read-modes .rm-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    R.applyMode();
  };

  R.units = function () {
    var box = w.$("#passage");
    if (!box) return [];
    return R.mode === "sentence" ? w.$$(".sent", box)
         : R.mode === "page" ? w.$$("p", box)
         : [];
  };

  R.applyMode = function () {
    var box = w.$("#passage");
    if (!box) return;
    box.classList.toggle("mode-sentence", R.mode === "sentence");
    box.classList.toggle("mode-page", R.mode === "page");

    var units = R.units();
    var nav = w.$("#read-nav");

    if (!units.length) {
      box.querySelectorAll(".sent,p").forEach(function (el) { el.classList.remove("hidden-unit"); });
      nav.hidden = true;
      return;
    }

    if (R.idx >= units.length) R.idx = units.length - 1;
    if (R.idx < 0) R.idx = 0;

    /* ẩn mọi đơn vị, chỉ chừa cái đang xem */
    box.querySelectorAll(".sent,p").forEach(function (el) { el.classList.remove("hidden-unit"); });
    if (R.mode === "sentence") {
      w.$$(".sent", box).forEach(function (el, i) { el.classList.toggle("hidden-unit", i !== R.idx); });
      /* đoạn nào không còn câu nào hiện thì ẩn luôn để khỏi chừa khoảng trống */
      w.$$("p", box).forEach(function (p) {
        p.classList.toggle("hidden-unit", !p.querySelector(".sent:not(.hidden-unit)"));
      });
    } else {
      w.$$("p", box).forEach(function (el, i) { el.classList.toggle("hidden-unit", i !== R.idx); });
    }

    nav.hidden = false;
    w.$("#rn-pos").textContent = (R.idx + 1) + " / " + units.length +
      (R.mode === "sentence" ? " câu" : " đoạn");
    w.$("#rn-prev").disabled = R.idx === 0;
    w.$("#rn-next").disabled = R.idx === units.length - 1;
  };

  R.step = function (d) { R.idx += d; R.applyMode(); };

  /* Phần văn bản CẦN ĐỌC ứng với chế độ đang chọn.
     Chế độ từng câu / từng đoạn mà vẫn đưa cả bài cho máy đọc thì nó đọc
     lố sang phần đang bị ẩn, karaoke đi tô những từ không hiển thị (kích
     thước 0) -> phép tính cuộn loạn -> trang giật. Nên chỉ cắt đúng phần
     đang hiện, kèm `offset` để vẫn dò đúng ô chữ trong cả bài. */
  R.readScope = function () {
    var all = (w.Detail && w.Detail._passagePlain) || "";
    if (R.mode === "full") return { plain: all, offset: 0 };

    var el = R.units()[R.idx];
    if (!el) return { plain: all, offset: 0 };
    var kws = w.$$(".kw", el);
    if (!kws.length) return { plain: all, offset: 0 };

    var s = +kws[0].dataset.s;
    var e = +kws[kws.length - 1].dataset.e;
    return { plain: all.slice(s, e), offset: s };
  };

  R.hasNext = function () {
    var u = R.units();
    return u.length > 0 && R.idx < u.length - 1;
  };

  /* ══════════ GẮN SỰ KIỆN (gọi 1 lần) ══════════ */
  R.bind = function () {
    try { R.mode = localStorage.getItem(LS_MODE) || "full"; } catch (e) { R.mode = "full"; }

    /* Người dùng tự đổi chế độ / lật trang thì dừng giọng đọc đang chạy,
       kẻo nó đọc một đằng mà màn hình hiện một nẻo. */
    function stopReading() {
      w.Speech.stop();
      if (w.Detail) w.Detail._autoRead = false;
      var btn = w.$("#btn-read");
      if (btn) btn.textContent = "🎧 Nghe US";
    }

    w.$$("#read-modes .rm-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === R.mode);
      b.onclick = function () { stopReading(); R.setMode(b.dataset.mode); };
    });
    w.$("#rn-prev").onclick = function () { stopReading(); R.step(-1); };
    w.$("#rn-next").onclick = function () { stopReading(); R.step(1); };

    /* bôi 1–4 từ để tra cả cụm */
    var box = w.$("#passage");
    box.addEventListener("mouseup", handleSelect);
    box.addEventListener("touchend", function () { setTimeout(handleSelect, 10); });

    /* BÔI LỠ CỠ VẪN ĂN TRỌN TỪ.
       Kéo chuột hiếm khi dừng đúng ranh giới chữ, nên thay vì lấy đúng đoạn
       văn bản người dùng quét, ta tìm những ô .kw mà vùng quét chạm vào rồi
       lấy trọn từ đầu tới từ cuối — cắt theo mốc ký tự đã lưu sẵn nên giữ
       nguyên dấu câu và khoảng trắng gốc. */
    function handleSelect() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;

      var range = sel.getRangeAt(0);
      var box = w.$("#passage");
      if (!box.contains(range.commonAncestorContainer) &&
          range.commonAncestorContainer !== box) return;

      var touched = w.$$(".kw", box).filter(function (sp) {
        try { return range.intersectsNode(sp); } catch (e) { return false; }
      });
      if (!touched.length) return;

      var plain = (w.Detail && w.Detail._passagePlain) || "";
      var s = +touched[0].dataset.s;
      var e2 = +touched[touched.length - 1].dataset.e;
      var text = plain.slice(s, e2).replace(/\s+/g, " ").trim();

      /* bỏ dấu câu thừa ở hai đầu, giữ dấu nối trong từ (kiểu well-known) */
      text = text.replace(/^[^\w'-]+/, "").replace(/[^\w'-]+$/, "");
      if (!text) return;

      var n = text.split(" ").length;
      if (n > 5) { sel.removeAllRanges(); return; }   /* quét quá dài thì bỏ qua */

      /* mouseup chạy trước click; đánh dấu để cú click ngay sau đó không
         ghi đè bảng tra bằng từ đơn dưới con trỏ */
      R._justSelected = Date.now();
      R.open(text, sentenceOf(touched[0]));
      sel.removeAllRanges();
    }

    w.$("#wp-close").onclick = R.forceClose;
    w.$("#panel-backdrop").onclick = R.close;
    w.$("#wp-pin").onclick = R.togglePin;
    R.applyPin();

    /* bấm một dòng đề xuất -> điền vào ô nghĩa */
    w.$("#wp-suggest").addEventListener("click", function (e) {
      var row = e.target.closest("[data-vi]");
      if (!row) return;
      w.$("#wp-meaning").value = row.dataset.vi;
      w.$$("#wp-suggest .sg-row").forEach(function (b) { b.classList.toggle("sel", b === row); });
    });
    w.$("#wp-say").onclick = function () { w.Speech.speakWord(R.term); };
    w.$("#wp-del").onclick = function () { R.removeWord(); };
    w.$$("#wp-levels .lvl-btn").forEach(function (b) {
      b.onclick = function () { R.saveLevel(+b.dataset.lv); };
    });
    w.$("#wp-meaning").addEventListener("keydown", function (e) {
      if (e.key === "Enter") R.saveLevel(1);
    });
  };

  w.Reader = R;
})(window);
