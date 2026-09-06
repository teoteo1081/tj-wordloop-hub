/* detail.js — MÀN HÌNH HỌC CHI TIẾT CỦA 1 BLOCK
   Gồm 3 tab: Bài học & Đọc | Active Recall Quiz | Tiến trình trí nhớ  */
(function (w) {
  "use strict";

  var D = { blockId: null, _quiz: null, _passagePlain: "" };
  var cfg = w.APP_CONFIG || {};

  function S() { return w.S; }
  function block() { return S().blocks.find(function (b) { return b.id === D.blockId; }); }
  function words() {
    return S().words.filter(function (x) { return x.block_id === D.blockId; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  /* Copy văn bản ra clipboard, dùng chung cho nút Copy ở vocab table /
     đoạn văn / glossary. Đổi tạm chữ trên nút để xác nhận đã copy. */
  function copyText(btn, text) {
    var restore = btn.textContent;
    function ok() {
      btn.textContent = "✓ Đã copy"; btn.classList.add("done");
      setTimeout(function () { btn.textContent = restore; btn.classList.remove("done"); }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        w.toast("Trình duyệt chặn copy tự động", "err");
      });
    } else {
      w.toast("Trình duyệt này không hỗ trợ copy tự động", "err");
    }
  }

  /* ══════════════ MỞ / ĐÓNG ══════════════ */
  D.open = function (blockId) {
    D.blockId = blockId;
    D._exam = null;
    D._meaningQuiz = null;   /* mỗi Block một bộ từ khác nhau, không dùng lại đề Block cũ */
    D.si = null;
    D.mi = null;
    D._claudePick = null;
    var b = block();
    if (!b) return;

    w.$("#screen-blocks").hidden = true;
    w.$("#screen-detail").hidden = false;
    w.$("#btn-back").hidden = false;
    w.$("#workspace").scrollTop = 0;
    w.$("#detail-title").textContent = "📕 " + b.name + " — Collocation Builder";

    D.showTab("study");
    D.renderStats();
    D.renderStudy();
    D.renderProgress();
    D.renderBatchNav();
  };

  /* ══════════════ CHUYỂN BLOCK TRƯỚC / SAU (trong tab Bài học) ══════════════
     Cho học liên tục — trong cùng Batch thì chuyển Block; hết Block của
     Batch hiện tại rồi mới lăn qua Batch kế/trước (mở Block đầu của Batch
     sau, hoặc Block cuối của Batch trước), không phải quay ra cột Pages. */
  function blockNavInfo() {
    var b = block();
    if (!b) return null;
    var curBatch = S().batches.find(function (x) { return x.id === b.batch_id; });
    if (!curBatch) return null;
    var batchList = w.App.batchesOf(curBatch.page_id);
    var batchIdx = batchList.findIndex(function (x) { return x.id === curBatch.id; });
    var blockList = w.App.blocksOf(curBatch.id);
    var blockIdx = blockList.findIndex(function (x) { return x.id === b.id; });
    return { batchList: batchList, batchIdx: batchIdx, curBatch: curBatch, blockList: blockList, blockIdx: blockIdx };
  }

  D.renderBatchNav = function () {
    var nav = w.$("#batch-nav");
    if (!nav) return;
    var info = blockNavInfo();
    if (!info || info.blockIdx < 0 || (info.batchList.length <= 1 && info.blockList.length <= 1)) {
      nav.hidden = true;
      return;
    }

    nav.hidden = false;
    w.$("#bn-prev").disabled = info.blockIdx <= 0 && info.batchIdx <= 0;
    w.$("#bn-next").disabled = info.blockIdx >= info.blockList.length - 1 && info.batchIdx >= info.batchList.length - 1;
    w.$("#bn-pos").textContent = "Block " + (info.blockIdx + 1) + "/" + info.blockList.length + " · " + info.curBatch.name;
  };

  D.gotoAdjacentBlock = function (dir) {
    var info = blockNavInfo();
    if (!info || info.blockIdx < 0) return;

    /* còn Block trong cùng Batch -> chỉ đổi Block, không đụng Batch */
    var nextIdx = info.blockIdx + dir;
    if (nextIdx >= 0 && nextIdx < info.blockList.length) {
      D.open(info.blockList[nextIdx].id);
      return;
    }

    /* hết Block của Batch này -> lăn qua Batch kế/trước */
    var targetBatch = info.batchList[info.batchIdx + dir];
    if (!targetBatch) {
      w.toast(dir > 0 ? "Đây là Block cuối cùng trong Page này" : "Đây là Block đầu tiên trong Page này", "err");
      return;
    }
    var targetBlocks = w.App.blocksOf(targetBatch.id);
    if (!targetBlocks.length) { w.toast(targetBatch.name + " chưa có Block nào", "err"); return; }

    w.App.selectBatch(targetBatch.id);
    /* Batch sau -> mở Block ĐẦU; Batch trước -> mở Block CUỐI (đúng chỗ
       mình vừa học dở nếu đang lùi lại). */
    D.open(dir > 0 ? targetBlocks[0].id : targetBlocks[targetBlocks.length - 1].id);
  };

  D.close = function () {
    w.Speech.stop();
    w.$("#screen-detail").hidden = true;
    w.$("#screen-blocks").hidden = false;
    w.$("#btn-back").hidden = true;
    D.blockId = null;
  };

  D.showTab = function (name) {
    w.$$(".dtab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    w.$$(".tab-pane").forEach(function (p) { p.classList.remove("active"); });
    w.$("#pane-" + name).classList.add("active");
    if (name === "quiz") D.startQuiz();
    /* "Phiếu đầy đủ" và "Từng câu" giờ là 2 TAB riêng (trước đây là 2 nút
       chuyển chế độ trong cùng 1 tab), cùng dùng chung 1 đề (D._exam) —
       vào tab nào cũng tự dựng đề nếu chưa có, không cần màn "chuẩn bị"
       trung gian nữa. "Nghĩa" là đề hoàn toàn riêng, không ảnh hưởng SRS. */
    if (name === "sheet") {
      if (!D._exam) D._exam = D.buildExam();
      D.renderSheet();
    }
    if (name === "single") {
      if (!D._exam) D._exam = D.buildExam();
      if (D.si == null) D.si = 0;
      D.renderSingle();
    }
    if (name === "meaning") {
      if (!D._meaningQuiz) D._meaningQuiz = D.buildMeaningQuiz();
      if (D.mi == null) D.mi = 0;
      D.renderMeaning();
    }
    if (name !== "study") w.Speech.stop();
  };

  /* ══════════════ 4 Ô THỐNG KÊ ══════════════ */
  D.renderStats = function () {
    var ws = words(), wp = S().wp;
    var total = ws.length, mastered = 0, attempts = 0, correct = 0;

    ws.forEach(function (x) {
      var p = wp[x.id];
      if (!p) return;
      attempts += p.attempts || 0;
      correct += p.correct || 0;
      if (p.mastered) mastered++;
    });

    var bp = S().bp[D.blockId] || {};
    var st = w.SRS.state(S().bp[D.blockId]);

    w.$("#st-total").textContent = total;
    w.$("#st-mastered").textContent = mastered;
    w.$("#st-recall").textContent = w.pct(correct, attempts) + "%";

    /* Ô thứ 4 giờ là kết quả bài thi cuối bài — thứ quyết định Block xong hay chưa */
    var box = w.$("#st-cycle");
    if (bp.passed) {
      box.textContent = "✓ Đạt " + (bp.best_score || 0) + "%";
      box.className = "stat-num green";
      box.title = "Đã qua bài thi cuối bài · " + st.label;
    } else if (bp.best_score) {
      box.textContent = bp.best_score + "%";
      box.className = "stat-num amber";
      box.title = "Cần ≥ " + PASS_MARK + "% ở bài thi cuối bài";
    } else {
      box.textContent = "Chưa thi";
      box.className = "stat-num";
      box.title = "Làm bài thi cuối bài để hoàn thành Block";
    }
    w.$("#st-cycle").parentNode.querySelector(".stat-label").textContent = "Bài thi cuối bài";
  };

  /* ══════════════ TAB 1 — BẢNG 6 CỘT + ĐOẠN VĂN ══════════════
     Bố cục bảng theo đúng bộ tài liệu gốc của bạn:
       Vocabulary | Level | Word Form | Phonetic | English Definition | Vietnamese Meaning
     Độ nhớ được gắn thành nhãn nhỏ cạnh từ để không phải thêm cột thứ 7. */
  function levelClass(lv) {
    var k = String(lv || "").toUpperCase().replace(/[^A-C0-9]/g, "");
    return /^(A1|A2|B1|B2|C1|C2)$/.test(k) ? "lvl lvl-" + k : "lvl";
  }

  D.renderStudy = function () {
    var ws = words(), wp = S().wp;

    w.$("#vocab-tbody").innerHTML = ws.map(function (x) {
      var p = wp[x.id] || { attempts: 0, correct: 0 };
      var rate = w.pct(p.correct, p.attempts);
      /* chưa ôn lần nào thì không gắn nhãn, để cột Vocabulary sạch như bản in */
      var cls = rate >= 80 ? "hi" : (rate >= 50 ? "mid" : "");
      var memText = p.mastered ? "✓ thuộc" : (p.attempts ? rate + "%" : "");
      return "" +
        "<tr>" +
          '<td><div class="term-cell">' +
            '<button class="spk" data-say="' + w.esc(x.term) + '" title="Nghe">🔊</button>' +
            "<b>" + w.esc(x.term) + "</b>" +
            (memText ? '<span class="mem-dot ' + cls + '">' + memText + "</span>" : "") +
          "</div></td>" +
          /* data-label để trên điện thoại mỗi dòng biến thành 1 thẻ có nhãn */
          '<td class="' + levelClass(x.level) + '" data-label="Level">' + w.esc(x.level || "—") + "</td>" +
          '<td data-label="Word Form">' + (x.pos ? '<span class="pos-badge">' + w.esc(x.pos) + "</span>" : "—") + "</td>" +
          '<td class="ipa" data-label="Phonetic">' + w.esc(x.ipa || "—") + "</td>" +
          '<td class="def-en" data-label="Definition">' + w.esc(x.def_en || "—") + "</td>" +
          '<td class="vi-cell" data-label="Nghĩa Việt">' + w.esc(x.meaning_vi || "—") + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="6" style="text-align:center;color:#64748b">Block này chưa có từ nào.</td></tr>';

    D.renderPassage();
  };

  /* Mỗi Block có ĐÚNG 1 bài đọc đang dùng (context_passage). Ngoài ra
     Claude có thể chuẩn bị sẵn tối đa 3 bài khác nhau trong
     context_passage_candidates (mảng, mỗi phần tử là chuỗi full [đánh
     dấu]+meta như bài thật) — chỉ để CHỌN THỬ khi bài đọc còn trống,
     không tự động dùng, phải bấm "Dùng bài này" mới đẩy lên chính thức. */
  D.renderPassage = async function () {
    var b = block(), ws = words();
    if (!b) return;

    var raw = b.context_passage;
    var emptyBox = w.$("#passage-empty");
    var contentBox = w.$("#passage-content-block");
    var readModes = w.$("#read-modes");

    if (!raw) {
      /* Chưa có bài đọc — để trống thật sự, không tự sinh gì hết, chờ
         người dùng dán bài của mình, chọn 1 bài Claude viết sẵn, hoặc
         bấm nhờ AI viết. */
      if (emptyBox) emptyBox.hidden = false;
      if (contentBox) contentBox.hidden = true;
      if (readModes) readModes.hidden = true;
      w.$("#passage-glossary").innerHTML = "";
      var wc0 = w.$("#passage-wordcount");
      if (wc0) wc0.textContent = "";
      D._passagePlain = "";
      D.renderClaudePicks(b);
      return;
    }

    if (emptyBox) emptyBox.hidden = true;
    if (contentBox) contentBox.hidden = false;
    if (readModes) readModes.hidden = false;
    /* Có bài đọc chính rồi vẫn hiện khu chọn Claude nếu Block có sẵn —
       để đổi qua bài Claude viết ngay cả khi đang dùng bài tự dán/AI. */
    D.renderClaudePicks(b);

    var meta = w.Context.parseMeta(raw);
    /* Chỉ hiện tiêu đề/nguồn khi bài đọc THẬT SỰ có (AI sinh, Claude viết,
       hoặc bạn tự đặt lúc dán) — không tự bịa ra tiêu đề từ 1 danh sách cố
       định như trước nữa, tránh tình trạng nhiều Block trùng tiêu đề. */
    w.$("#passage-title").textContent = meta.title || "";
    w.$("#passage-src").textContent = meta.source || "";
    var badge = w.$("#passage-ai-badge");
    if (badge) {
      badge.textContent = meta.ai ? "✨ AI" : (meta.claude ? "✍️ Claude" : (meta.pasted ? "📝 Tự dán" : ""));
      badge.className = "ai-badge" + (meta.ai ? " ai" : ((meta.claude || meta.pasted) ? " tpl" : ""));
    }

    var built = w.Context.build(meta.marked);
    D._passagePlain = built.plain;
    w.$("#passage").innerHTML = built.html;

    /* Thống kê số từ bài đọc — để biết bài AI sinh có đủ dài không. */
    var wc = w.$("#passage-wordcount");
    if (wc) {
      var nWords = built.plain.trim() ? built.plain.trim().split(/\s+/).length : 0;
      wc.textContent = nWords ? nWords + " từ" : "";
    }

    /* Glossary cuối bài đọc — lấy thẳng định nghĩa tiếng Anh thật của từ.
       Có nút Copy kiểu code-block để copy nguyên khối ra dán chỗ khác. */
    var withDef = ws.filter(function (x) { return x.def_en; });
    w.$("#passage-glossary").innerHTML = withDef.length
      ? '<div class="g-title-row"><span class="g-title">Glossary — từ khoá trong bài</span>' +
          '<button class="g-copy" id="glossary-copy" title="Copy glossary">📋 Copy</button></div>' +
        withDef.map(function (x) {
          return '<div class="g-row"><b>' + w.esc(x.term) + "</b> — " + w.esc(x.def_en) +
                 (x.meaning_vi ? " <i>(" + w.esc(x.meaning_vi) + ")</i>" : "") + "</div>";
        }).join("")
      : "";

    /* tô màu từ đã lưu + áp dụng chế độ đọc đang chọn */
    w.Reader.decorate();
    w.Reader.applyMode();
  };

  /* Nhờ AI viết bài mới — CHỈ chạy khi đã cấu hình key (js/keys.local.js).
     Không còn rơi về bộ mẫu câu cố định như trước nữa (nội dung lặp đi
     lặp lại, vô nghĩa) — chưa có key hoặc AI lỗi thì báo rõ, để trống chờ
     bạn tự dán bài thật thay vì âm thầm nhét bài mẫu vào. */
  D.generatePassage = async function () {
    var b = block(), ws = words();
    if (!b) return;
    var myBlockId = b.id;

    var cfg2 = w.APP_CONFIG || {};
    if (!cfg2.GEMINI_API_KEY && !cfg2.OPENAI_API_KEY) {
      w.toast("Chưa cấu hình API key AI — hãy dán bài đọc của bạn vào ô bên dưới", "err");
      return;
    }

    if (D.blockId === myBlockId) {
      w.$("#passage-empty").hidden = true;
      w.$("#passage-content-block").hidden = false;
      w.$("#passage-title").textContent = "Đang nhờ AI viết bài đọc mới…";
      w.$("#passage").innerHTML = '<p style="color:var(--text-3);font-style:italic">⏳ Đang sinh bài đọc bằng AI, chờ vài giây…</p>';
      w.$("#passage-glossary").innerHTML = "";
    }

    var newPassage;
    try {
      newPassage = await w.Context.generateAI(ws, cfg2);
    } catch (e) {
      console.warn("Sinh bài đọc bằng AI thất bại:", e);
      w.toast("AI chưa sẵn sàng (" + (e.message || "lỗi mạng") + ") — hãy dán bài đọc của bạn vào thay", "err");
      if (D.blockId === myBlockId) await D.renderPassage();   /* vẽ lại đúng trạng thái trống, khỏi kẹt ở màn "đang sinh" */
      return;
    }

    b.context_passage = newPassage;
    try { await w.DB.saveContext(b.id, newPassage); } catch (e) { /* offline vẫn hiển thị được */ }

    if (D.blockId !== myBlockId) return;   /* đã chuyển Block trong lúc chờ */
    D._exam = null;
    await D.renderPassage();
  };

  /* Dùng bài người dùng tự dán — tự bôi [ngoặc] đúng các từ của Block,
     không cần AI, không cần mạng. Dán rồi thì lưu lại, lần sau mở Block
     vẫn thấy đúng bài đó (không tự sinh lại). */
  D.usePastedPassage = async function (text) {
    var b = block(), ws = words();
    if (!b) return;
    var terms = ws.map(function (x) { return x.term; }).filter(Boolean);
    var marked = w.Context._markTerms(text, terms);
    var meta = { ai: false, pasted: true, vi: {}, title: "", source: "Bài đọc do bạn tự dán vào." };
    var val = marked + w.Context.META_SEP + JSON.stringify(meta);

    b.context_passage = val;
    try { await w.DB.saveContext(b.id, val); } catch (e) { /* offline vẫn hiển thị được */ }
    D._exam = null;
    await D.renderPassage();
  };

  /* ---------- 3 bài Claude viết sẵn (nếu có) — chọn thử trước khi dùng ---------- */
  D._claudePick = null;   /* index đang xem trước, reset mỗi lần render */

  D.renderClaudePicks = function (b) {
    var wrap = w.$("#claude-picks");
    if (!wrap) return;
    var list = Array.isArray(b.context_passage_candidates) ? b.context_passage_candidates : [];
    if (!list.length) { wrap.hidden = true; return; }
    wrap.hidden = false;

    w.$("#claude-picks-tabs").innerHTML = list.map(function (_, i) {
      return '<button data-i="' + i + '" class="' + (D._claudePick === i ? "active" : "") + '">Claude ' + (i + 1) + "</button>";
    }).join("");

    var useBtn = w.$("#btn-use-claude");
    if (D._claudePick == null || !list[D._claudePick]) {
      w.$("#claude-preview").innerHTML = "";
      if (useBtn) useBtn.hidden = true;
      return;
    }
    var meta = w.Context.parseMeta(list[D._claudePick]);
    var built = w.Context.build(meta.marked);
    w.$("#claude-preview").innerHTML =
      (meta.title ? "<b>" + w.esc(meta.title) + "</b><br>" : "") +
      w.esc(built.plain).replace(/\n/g, "<br>");
    if (useBtn) useBtn.hidden = false;
  };

  D.useClaudeCandidate = async function (idx) {
    var b = block();
    if (!b) return;
    var list = Array.isArray(b.context_passage_candidates) ? b.context_passage_candidates : [];
    var val = list[idx];
    if (!val) return;

    b.context_passage = val;
    try { await w.DB.saveContext(b.id, val); } catch (e) { /* offline vẫn hiển thị được */ }
    D._exam = null;
    D._claudePick = null;
    await D.renderPassage();
  };

  /* ══════════════ TAB 2 — ACTIVE RECALL QUIZ (ĐIỀN TỪ) ══════════════ */
  D.startQuiz = function () {
    var ws = words().slice();
    if (!ws.length) {
      w.$("#quiz-card").innerHTML = '<div class="quiz-done">Block này chưa có từ để kiểm tra.</div>';
      return;
    }
    /* xáo trộn để chống học vẹt theo thứ tự */
    for (var i = ws.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ws[i]; ws[i] = ws[j]; ws[j] = t;
    }
    D._quiz = { list: ws, i: 0, correct: 0, answered: false, hintLevel: 0 };
    D.renderQuestion();
  };

  function slotsHtml(term, hintLevel) {
    return term.split("").map(function (ch, i) {
      if (ch === " ") return '<span style="width:.5rem"></span>';
      if (i < hintLevel) return "<span>" + w.esc(ch) + "</span>";
      return "<span>_</span>";
    }).join("");
  }

  D.renderQuestion = function () {
    var q = D._quiz;
    if (!q) return;

    if (q.i >= q.list.length) return D.finishQuiz();

    var item = q.list[q.i];
    q.answered = false;
    q.hintLevel = 0;

    var progress = Math.round((q.i / q.list.length) * 100);
    w.$("#quiz-card").innerHTML =
      '<div class="quiz-top">' +
        "<span>Câu " + (q.i + 1) + "/" + q.list.length + "</span>" +
        '<span class="quiz-bar"><i style="width:' + progress + '%"></i></span>' +
        "<span>Đúng " + q.correct + "</span>" +
      "</div>" +
      '<div class="quiz-prompt">Nhớ lại từ tiếng Anh của nghĩa sau:</div>' +
      '<div class="quiz-meaning">' + w.esc(item.meaning_vi || item.def_en || "(chưa có nghĩa)") + "</div>" +
      (item.def_en && item.meaning_vi ? '<div class="quiz-extra">' + w.esc(item.def_en) + "</div>" : "") +
      '<div class="quiz-slots" id="q-slots">' + slotsHtml(item.term, 0) + "</div>" +
      '<input class="answer-input" id="q-input" autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false" placeholder="Gõ từ tiếng Anh rồi bấm Enter">' +
      '<div class="quiz-actions">' +
        '<button class="btn-primary" id="q-check">Kiểm tra</button>' +
        '<button class="btn-soft" id="q-hint">💡 Gợi ý</button>' +
        '<button class="btn-ghost" id="q-skip">Bỏ qua →</button>' +
      "</div>" +
      '<div id="q-feedback"></div>';

    var input = w.$("#q-input");
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (D._quiz.answered) D.nextQuestion(); else D.checkAnswer();
    });
    w.$("#q-check").onclick = function () { D.checkAnswer(); };
    w.$("#q-skip").onclick = function () { D.checkAnswer(true); };
    w.$("#q-hint").onclick = function () {
      D._quiz.hintLevel = Math.min(D._quiz.hintLevel + 1, item.term.length - 1);
      w.$("#q-slots").innerHTML = slotsHtml(item.term, D._quiz.hintLevel);
    };
  };

  D.checkAnswer = async function (skipped) {
    var q = D._quiz;
    if (!q || q.answered) return;
    var item = q.list[q.i];
    var input = w.$("#q-input");
    var given = input.value;
    var ok = !skipped && w.normalizeAnswer(given) === w.normalizeAnswer(item.term);

    q.answered = true;
    if (ok) q.correct++;
    /* dùng gợi ý thì vẫn tính là đúng, nhưng nhẹ điểm hơn: không tính "mastered" thêm */
    var usedHint = q.hintLevel > 0;

    input.classList.add(ok ? "right" : "wrong");
    input.disabled = true;

    w.$("#q-feedback").innerHTML =
      '<div class="quiz-feedback ' + (ok ? "ok" : "no") + '">' +
        (ok ? "✅ Chính xác!" : "❌ Đáp án đúng: <b>" + w.esc(item.term) + "</b>") +
        (item.ipa ? " · " + w.esc(item.ipa) : "") +
        (item.def_en ? "<br><span style=\"opacity:.85\">" + w.esc(item.def_en) + "</span>" : "") +
      "</div>";

    w.$("#q-check").textContent = "Câu tiếp →";
    w.$("#q-check").onclick = function () { D.nextQuestion(); };
    w.$("#q-hint").disabled = true;
    w.Speech.speakWord(item.term);

    /* ghi nhận tiến trình của TỪ này */
    var prev = S().wp[item.id] || { attempts: 0, correct: 0 };
    var attempts = (prev.attempts || 0) + 1;
    var correct = (prev.correct || 0) + (ok && !usedHint ? 1 : 0);
    var mastered = attempts >= (cfg.MASTER_MIN_ATTEMPTS || 3) &&
                   (correct / attempts) >= (cfg.MASTER_THRESHOLD || 0.8);

    var patch = { attempts: attempts, correct: correct, mastered: mastered, last_reviewed_at: Date.now() };
    S().wp[item.id] = Object.assign({}, prev, patch, { user_id: w.Auth.user.id, word_id: item.id });
    try { await w.DB.saveWordProgress(w.Auth.user.id, item.id, patch); } catch (e) {}
  };

  D.nextQuestion = function () {
    D._quiz.i++;
    D.renderQuestion();
  };

  /* Quiz chỉ là LUYỆN TẬP: ghi nhận độ nhớ từng từ, không tự cho qua Block.
     Muốn Block được tính "Done" thì phải qua Bài thi cuối bài với >= 80%. */
  D.finishQuiz = function () {
    var q = D._quiz;
    var rate = w.pct(q.correct, q.list.length);
    var ready = rate >= 80;

    w.$("#quiz-card").innerHTML =
      '<div class="quiz-done">' +
        '<div class="big">' + rate + "%</div>" +
        "<p style=\"margin:.4rem 0 1rem;color:#94a3b8\">Đúng " + q.correct + "/" + q.list.length + " từ. " +
        (ready ? "Nhớ tốt rồi — sang <b>Bài thi cuối bài</b> để hoàn thành Block."
               : "Nên luyện thêm một lượt nữa trước khi vào bài thi.") + "</p>" +
        '<div class="quiz-actions" style="justify-content:center;margin-top:1rem">' +
          '<button class="btn-soft" id="q-again">🔁 Làm lại</button>' +
          '<button class="btn-primary" id="q-final">🎯 Vào bài thi cuối bài →</button>' +
        "</div>" +
      "</div>";

    w.$("#q-again").onclick = function () { D.startQuiz(); };
    w.$("#q-final").onclick = function () { D.showTab("final"); };

    D.renderStats();
    D.renderProgress();
  };

  /* ══════════════ 3 TAB BÀI THI: PHIẾU ĐẦY ĐỦ · TỪNG CÂU · NGHĨA ══════════════
     Trước đây "Phiếu đầy đủ"/"Từng câu" là 2 nút chuyển chế độ trong CÙNG
     1 tab "Bài thi cuối bài", còn "chọn nghĩa" là Phần B nằm chung. Giờ
     tách hẳn thành 3 tab riêng ở thanh trên:
       · Phiếu đầy đủ / Từng câu — CÙNG 1 đề điền từ (D._exam.gaps, tối đa
         10 câu), chỉ khác cách hiển thị/thao tác. Đúng ≥ 80% mới tính
         hoàn thành Block và đẩy chu kỳ SRS (giữ nguyên như trước).
       · Nghĩa — đề RIÊNG (D._meaningQuiz, 10 từ, trắc nghiệm 4 đáp án),
         chỉ để luyện thêm, KHÔNG ảnh hưởng SRS/trạng thái hoàn thành
         Block (giống tinh thần tab Active Recall Quiz — luyện tập thôi). */
  var PASS_MARK = 80;
  var EXAM_CAP = 10;      /* Phiếu đầy đủ / Từng câu: tối đa 10 câu */
  var MEANING_CAP = 10;   /* Nghĩa: đúng 10 từ (hoặc ít hơn nếu Block không đủ) */
  D.PASS_MARK = PASS_MARK;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Đề điền từ (Phiếu đầy đủ + Từng câu dùng chung) ---------- */
  D.buildExam = function () {
    var b = block(), ws = words();
    if (!b || !ws.length) return null;

    var byTerm = {};
    ws.forEach(function (x) { byTerm[x.term.toLowerCase()] = x; });
    var allTerms = ws.map(function (x) { return x.term; });

    /* mỗi gap có sẵn `options` (đúng 1 từ + 3 từ nhiễu trong chính Block)
       cho "Từng câu"; "Phiếu đầy đủ" thì dùng `bank` (word bank cố định,
       bấm điền vào chỗ trống) — 2 cách hiển thị, cùng chung 1 `gaps`. */
    var passageText = w.Context.parseMeta(b.context_passage).marked;
    var gaps = w.Context.gapSentences(passageText)
      .filter(function (g) { return byTerm[g.term.toLowerCase()]; })
      .map(function (g) {
        var wrong = shuffle(allTerms.filter(function (t) {
          return w.normalizeAnswer(t) !== w.normalizeAnswer(g.term);
        })).slice(0, 3);
        return { term: g.term, text: g.text, given: null, options: shuffle([g.term].concat(wrong)) };
      });
    if (!gaps.length) return null;

    gaps = shuffle(gaps).slice(0, EXAM_CAP);   /* tối đa 10 câu */

    return {
      gaps: gaps,
      bank: shuffle(ws.map(function (x) { return x.term; })),
      total: gaps.length,
      graded: false
    };
  };

  /* ---------- Đề chọn nghĩa (tab Nghĩa, riêng, không ảnh hưởng SRS) ---------- */
  D.buildMeaningQuiz = function () {
    var ws = words();
    var withVi = ws.filter(function (x) { return x.meaning_vi; });
    if (!withVi.length) return null;

    var mcWords = shuffle(withVi).slice(0, Math.min(MEANING_CAP, withVi.length));
    var mc = mcWords.map(function (x) {
      var others = shuffle(withVi.filter(function (y) {
        return y.id !== x.id && y.meaning_vi !== x.meaning_vi;
      })).slice(0, 3).map(function (y) { return y.meaning_vi; });
      return { term: x.term, answer: x.meaning_vi, options: shuffle([x.meaning_vi].concat(others)), given: null };
    });

    return { mc: mc, total: mc.length, graded: false };
  };

  /* Khối "đáp án" hiện sau khi chấm: nghĩa của từ + bản dịch cả câu.
     Bản dịch lấy từ mẫu câu tiếng Việt trong context.js — không cần mạng. */
  D.answerNote = function (term, textWithGap) {
    var x = words().filter(function (y) {
      return w.normalizeAnswer(y.term) === w.normalizeAnswer(term);
    })[0];
    var vi = x && x.meaning_vi ? x.meaning_vi : "";
    var b = block();
    var viMap = w.Context.parseMeta((b && b.context_passage) || "").vi;
    var trans = w.Context.translate(textWithGap, term, vi, viMap);

    return '<div class="ans-note">' +
      '<div class="an-word"><b>' + w.esc(term) + "</b>" +
        (x && x.ipa ? ' <span class="ipa">' + w.esc(x.ipa) + "</span>" : "") +
        (vi ? ' — <span class="an-vi">' + w.esc(vi) + "</span>" : "") + "</div>" +
      (x && x.def_en ? '<div class="an-def">' + w.esc(x.def_en) + "</div>" : "") +
      (trans ? '<div class="an-trans">🇻🇳 ' + w.esc(trans) + "</div>" : "") +
    "</div>";
  };

  /* ---------- TAB: PHIẾU ĐẦY ĐỦ (word bank) ---------- */
  D.renderSheet = function () {
    var ex = D._exam;
    if (!ex) { w.$("#sheet-card").innerHTML = '<div class="quiz-done">Chưa dựng được đề — hãy mở tab Bài học một lượt.</div>'; return; }

    var b = block() || {};
    var html = "";

    if (ex.graded) {
      html += D.examResultHtml(ex);
    } else {
      html += '<div class="exam-head">' +
                '<span class="exam-tag">PHIẾU ĐẦY ĐỦ</span>' +
                '<span class="exam-meta">' + w.esc(b.name || "") + " · " + ex.total + " câu</span>" +
              "</div>";
      html += '<div class="wordbank" id="wordbank">' +
        '<div class="wb-head">' +
          '<span class="wb-title">Word bank</span>' +
          '<span class="wb-left" id="wb-left"></span>' +
          '<button class="wb-clear" id="wb-clear">Xoá hết</button>' +
        "</div>" +
        '<div class="wb-items">' +
          ex.bank.map(function (t) {
            return '<button class="wb-chip" data-bank="' + w.esc(t) + '">' + w.esc(t) + "</button>";
          }).join("") +
        "</div></div>";
    }

    html += ex.gaps.map(function (g, i) {
      var parts = g.text.split("{{GAP}}");
      var slot;
      if (!ex.graded) {
        slot = '<span class="slot' + (g.given ? " filled" : "") + '" data-gap="' + i + '">' +
                 '<span class="slot-text">' + (g.given ? w.esc(g.given) : "&nbsp;") + "</span>" +
                 (g.given ? '<button class="slot-x" data-clear="' + i + '" title="Bỏ chọn">✕</button>' : "") +
               "</span>";
      } else {
        slot = '<span class="slot ' + (g.ok ? "right" : "wrong") + '">' +
                 '<span class="slot-text">' + w.esc(g.given || "(bỏ trống)") + "</span></span>" +
               (g.ok ? "" : '<span class="gap-fix">→ ' + w.esc(g.term) + "</span>");
      }
      var note = ex.graded ? D.answerNote(g.term, g.text) : "";
      return '<div class="ex-q"><b class="qn">' + (i + 1) + '.</b><span class="qtext">' +
             w.esc(parts[0] || "") + slot + w.esc(parts[1] || "") + note + "</span></div>";
    }).join("");

    html += '<div class="exam-actions">';
    if (!ex.graded) {
      html += '<button class="btn-primary" id="sheet-submit">Nộp bài</button>';
    } else {
      html += '<button class="btn-soft" id="sheet-again">🔁 Kiểm tra lại</button>' +
              '<button class="btn-primary" id="sheet-back">← Về danh sách Block</button>';
    }
    html += "</div>";

    w.$("#sheet-card").innerHTML = html;
    D.bindSheet();
  };

  D.bindSheet = function () {
    var ex = D._exam;
    var card = w.$("#sheet-card");

    if (ex.graded) {
      w.$("#sheet-again").onclick = function () { D._exam = D.buildExam(); D.si = 0; D.renderSheet(); D.renderSingle(); };
      w.$("#sheet-back").onclick = function () { D.close(); w.App.renderBlocks(); };
      return;
    }
    w.$("#sheet-submit").onclick = function () { D.submitFinal(); };

    function activeSlot() { return card.querySelector(".slot.active"); }
    function setActive(el) { w.$$(".slot", card).forEach(function (s) { s.classList.toggle("active", s === el); }); }
    function firstEmpty() { return w.$$(".slot", card).filter(function (s) { return !ex.gaps[+s.dataset.gap].given; })[0]; }
    function refresh() {
      var used = {};
      ex.gaps.forEach(function (g) { if (g.given) used[w.normalizeAnswer(g.given)] = 1; });
      w.$$("[data-bank]", card).forEach(function (c) {
        c.classList.toggle("used", !!used[w.normalizeAnswer(c.dataset.bank)]);
      });
      var left = ex.gaps.filter(function (g) { return !g.given; }).length;
      var el = w.$("#wb-left");
      if (el) el.textContent = left ? "còn " + left + " chỗ trống" : "đã điền đủ ✓";
    }
    function fill(term) {
      var slot = activeSlot() || firstEmpty();
      if (!slot) return;
      var g = ex.gaps[+slot.dataset.gap];
      g.given = term;
      /* Reset trạng thái "đã chấm" của tab Từng câu — dùng chung ex.gaps,
         sửa ở đây mà không reset thì Từng câu vẫn hiện đúng/sai CŨ. */
      g.shown = false; g.ok = undefined;
      redrawSlots();
      var next = firstEmpty();
      if (next) setActive(next); else setActive(null);
    }
    function clearGap(i) {
      ex.gaps[i].given = null;
      ex.gaps[i].shown = false; ex.gaps[i].ok = undefined;
      redrawSlots();
    }
    function redrawSlots() {
      w.$$(".slot", card).forEach(function (s) {
        var i = +s.dataset.gap, g = ex.gaps[i];
        s.classList.toggle("filled", !!g.given);
        s.querySelector(".slot-text").innerHTML = g.given ? w.esc(g.given) : "&nbsp;";
        var x = s.querySelector(".slot-x");
        if (g.given && !x) {
          var btn = document.createElement("button");
          btn.className = "slot-x"; btn.dataset.clear = i; btn.title = "Bỏ chọn"; btn.textContent = "✕";
          s.appendChild(btn);
        } else if (!g.given && x) { x.remove(); }
      });
      refresh();
    }

    /* onclick (không phải addEventListener): renderSheet chạy lại sau MỖI
       lần vẽ, dùng addEventListener thì handler chồng lên nhau. */
    card.onclick = function (e) {
      var x = e.target.closest("[data-clear]");
      if (x) { e.stopPropagation(); clearGap(+x.dataset.clear); return; }

      var slot = e.target.closest(".slot[data-gap]");
      if (slot) {
        if (ex.gaps[+slot.dataset.gap].given) clearGap(+slot.dataset.gap);
        setActive(slot);
        return;
      }

      var chip = e.target.closest("[data-bank]");
      if (chip) {
        var term = chip.dataset.bank;
        var hit = -1;
        ex.gaps.forEach(function (g, i) {
          if (hit < 0 && g.given && w.normalizeAnswer(g.given) === w.normalizeAnswer(term)) hit = i;
        });
        if (hit >= 0) clearGap(hit); else fill(term);
      }
    };

    w.$("#wb-clear").onclick = function () {
      ex.gaps.forEach(function (g) { g.given = null; g.shown = false; g.ok = undefined; });
      redrawSlots();
    };

    var f = firstEmpty();
    if (f) setActive(f);
    refresh();
  };

  /* ---------- TAB: TỪNG CÂU (trắc nghiệm 4 đáp án, đi từng câu) ---------- */
  D.renderSingle = function () {
    var ex = D._exam;
    if (!ex) { w.$("#single-card").innerHTML = '<div class="quiz-done">Chưa dựng được đề — hãy mở tab Bài học một lượt.</div>'; return; }

    if (ex.graded) { w.$("#single-card").innerHTML = D.examResultHtml(ex) + D.singleResultActionsHtml(); D.bindSingleResult(); return; }

    var list = ex.gaps;
    if (D.si == null || D.si < 0) D.si = 0;
    if (D.si >= list.length) D.si = list.length - 1;
    var g = list[D.si];

    var answered = ex.gaps.filter(function (x) { return x.given; }).length;
    var pct = Math.round((answered / ex.total) * 100);

    var shown = !!g.shown;
    function optClass(val) {
      var c = "opt";
      if (!shown) { if (g.given === val) c += " sel"; return c; }
      if (val === g.term) return c + " right";
      if (g.given === val) return c + " wrong";
      return c + " dim";
    }

    var parts = g.text.split("{{GAP}}");
    var promptHtml =
      '<div class="gap-card">' +
        '<div class="gap-label">Chọn từ đúng điền vào chỗ trống</div>' +
        '<div class="gap-sentence">' + w.esc(parts[0] || "") +
          '<span class="blank' + (g.given ? " has" : "") +
            (shown ? (g.ok ? " ok" : " no") : "") + '">' +
            (g.given ? w.esc(g.given) : "_ _ _") + "</span>" +
          w.esc(parts[1] || "") +
        "</div>" +
      "</div>";
    var optsHtml = g.options.map(function (t, j) {
      return '<button class="' + optClass(t) + '" data-pick="' + w.esc(t) + '"' +
             (shown ? " disabled" : "") + '><span class="mk">' + "ABCD".charAt(j) +
             ".</span>" + w.esc(t) + "</button>";
    }).join("");

    var explainHtml = shown
      ? '<div class="quiz-feedback ' + (g.ok ? "ok" : "no") + '">' +
          (g.ok ? "✅ Chính xác!" : "❌ Đáp án đúng: <b>" + w.esc(g.term) + "</b>") +
        "</div>" + D.answerNote(g.term, g.text)
      : "";

    var body = promptHtml +
      '<div class="single-grid">' +
        '<div class="opt-list">' + optsHtml + "</div>" +
        '<div class="single-explain">' + explainHtml + "</div>" +
      "</div>";

    /* Câu cuối: KHÔNG cần bấm "Nộp bài" — trả lời xong (đúng hay sai) là
       tự động chấm và hiện kết quả luôn, xem bindSingle(). */
    var last = D.si >= list.length - 1;
    var lastActionHtml = last
      ? (shown ? '<span class="exam-grading">⏳ Đang chấm điểm…</span>' : "")
      : '<button class="btn-primary" id="sg-next">Câu tiếp →</button>';
    w.$("#single-card").innerHTML =
      '<div class="exam-bar-row">' +
        '<span class="exam-idx">CÂU ' + (D.si + 1) + " / " + list.length + "</span>" +
        '<span class="exam-score">đã làm ' + answered + "/" + ex.total + "</span>" +
      "</div>" +
      '<div class="quiz-bar"><i style="width:' + pct + '%"></i></div>' +
      body +
      '<div class="exam-actions">' +
        '<button class="btn-soft" id="sg-prev"' + (D.si === 0 ? " disabled" : "") + ">← Trước</button>" +
        lastActionHtml +
      "</div>";

    /* Đã trả lời câu cuối (dù vừa chọn xong hay quay lại xem lại) ->
       luôn có đúng 1 hẹn giờ đang chờ tự chấm điểm — đặt ở đây (mỗi lần
       render) thay vì chỉ trong lúc bấm chọn, để bấm "← Trước" rồi quay
       lại câu cuối vẫn tự chấm được, không bị kẹt ở "Đang chấm điểm". */
    clearTimeout(D._autoNext);
    if (last && shown) {
      D._autoNext = setTimeout(function () { D.submitFinal(); }, g.ok ? 1100 : 1700);
    }

    D.bindSingle();
  };

  D.bindSingle = function () {
    var ex = D._exam;
    var g = ex.gaps[D.si];

    w.$$("#single-card [data-pick]").forEach(function (b) {
      b.onclick = function () {
        if (g.shown) return;
        var v = b.dataset.pick;
        g.given = v;
        g.ok = w.normalizeAnswer(v) === w.normalizeAnswer(g.term);
        g.shown = true;
        D.renderSingle();
        if (g.ok) w.Speech.speakWord(g.term);

        if (D.si < ex.gaps.length - 1 && g.ok) {
          clearTimeout(D._autoNext);
          D._autoNext = setTimeout(function () {
            if (D.si < ex.gaps.length - 1) { D.si++; D.renderSingle(); }
          }, 1100);
        }
      };
    });
    var p = w.$("#sg-prev"), n = w.$("#sg-next");
    if (p) p.onclick = function () { clearTimeout(D._autoNext); D.si--; D.renderSingle(); };
    if (n) n.onclick = function () { clearTimeout(D._autoNext); D.si++; D.renderSingle(); };
  };

  D.singleResultActionsHtml = function () {
    return '<div class="exam-actions">' +
      '<button class="btn-soft" id="single-again">🔁 Kiểm tra lại</button>' +
      '<button class="btn-primary" id="single-back">← Về danh sách Block</button>' +
    "</div>";
  };
  D.bindSingleResult = function () {
    w.$("#single-again").onclick = function () { D._exam = D.buildExam(); D.si = 0; D.renderSingle(); D.renderSheet(); };
    w.$("#single-back").onclick = function () { D.close(); w.App.renderBlocks(); };
  };

  /* ---------- Khối kết quả dùng chung cho Phiếu đầy đủ & Từng câu ---------- */
  D.examResultHtml = function (ex) {
    var passed = ex.score >= PASS_MARK;
    return '<div class="exam-result ' + (passed ? "pass" : "failed") + '">' +
        '<div class="score">' + ex.score + "%</div>" +
        '<div class="verdict">' + (passed ? "✅ ĐẠT — Block đã hoàn thành" : "❌ CHƯA ĐẠT — cần ≥ " + PASS_MARK + "%") + "</div>" +
        '<div class="detail">Đúng ' + ex.correct + "/" + ex.total + " câu" +
          (passed ? " · Block đã lên chu kỳ tiếp theo, lịch ôn: " + ex.nextLabel
                  : " · Đọc lại bài rồi kiểm tra lại nhé") +
        "</div>" +
      "</div>";
  };

  /* ---------- Chấm điểm đề điền từ (Phiếu đầy đủ / Từng câu) ---------- */
  D.submitFinal = async function () {
    var ex = D._exam;
    var correct = 0;

    ex.gaps.forEach(function (g) {
      g.ok = !!g.given && w.normalizeAnswer(g.given) === w.normalizeAnswer(g.term);
      if (g.ok) correct++;
    });

    ex.correct = correct;
    ex.score = w.pct(correct, ex.total);
    ex.graded = true;

    var passed = ex.score >= PASS_MARK;
    var bp = S().bp[D.blockId] || { cycle: 0 };
    var patch = {
      best_score: Math.max(bp.best_score || 0, ex.score),
      last_exam_at: Date.now()
    };

    if (passed) {
      var next = w.SRS.advance(bp.cycle || 0);
      patch.passed = true;
      patch.cycle = next.cycle;
      patch.next_review_at = next.next_review_at;
      patch.last_reviewed_at = Date.now();
      ex.nextLabel = w.SRS.stepFor(next.cycle).short + " nữa";
    } else {
      patch.passed = !!bp.passed;   /* đã từng đạt thì không bị mất */
    }

    S().bp[D.blockId] = Object.assign({}, bp, patch, { user_id: w.Auth.user.id, block_id: D.blockId });
    try { await w.DB.saveBlockProgress(w.Auth.user.id, D.blockId, patch); } catch (e) {}

    /* kết quả cũng tính vào độ nhớ từng từ */
    var byTerm = {};
    words().forEach(function (x) { byTerm[x.term.toLowerCase()] = x; });
    for (var i = 0; i < ex.gaps.length; i++) {
      var g = ex.gaps[i];
      var x = byTerm[g.term.toLowerCase()];
      if (!x) continue;
      var prev = S().wp[x.id] || { attempts: 0, correct: 0 };
      var attempts = (prev.attempts || 0) + 1;
      var okCount = (prev.correct || 0) + (g.ok ? 1 : 0);
      var wpatch = {
        attempts: attempts, correct: okCount,
        mastered: attempts >= (cfg.MASTER_MIN_ATTEMPTS || 3) &&
                  (okCount / attempts) >= (cfg.MASTER_THRESHOLD || 0.8),
        last_reviewed_at: Date.now()
      };
      S().wp[x.id] = Object.assign({}, prev, wpatch, { user_id: w.Auth.user.id, word_id: x.id });
      try { await w.DB.saveWordProgress(w.Auth.user.id, x.id, wpatch); } catch (e) {}
    }

    /* Đạt ≥ 80% -> tính vào "số từ học hôm nay" cho màn Journey. */
    if (passed) { try { await w.DB.bumpLearnedToday(w.Auth.user.id, ex.total); } catch (e) {} }

    D.renderSheet();
    D.renderSingle();
    D.renderStats();
    D.renderStudy();
    D.renderProgress();
    w.$("#workspace").scrollTop = 0;
    w.toast(passed ? "🎉 Đạt " + ex.score + "% — Block hoàn thành!" : "Được " + ex.score + "% — cần ≥ " + PASS_MARK + "%",
            passed ? "ok" : "err");
  };

  /* ---------- TAB: NGHĨA (10 từ đảo nghĩa, 4 đáp án — luyện riêng) ---------- */
  /* Trình bày y hệt tab "Từng câu": mỗi lần 1 câu, chọn đáp án là chấm
     luôn — đúng thì tự động qua câu sau, sai thì hiện đáp án đúng và chờ
     bấm "Câu tiếp →" mới đi tiếp. */
  D.renderMeaning = function () {
    var ex = D._meaningQuiz;
    if (!ex) { w.$("#meaning-card").innerHTML = '<div class="quiz-done">Block này chưa có từ nào có nghĩa tiếng Việt để tạo bài này.</div>'; return; }

    if (ex.graded) { w.$("#meaning-card").innerHTML = D.meaningResultHtml(ex) + D.meaningResultActionsHtml(); D.bindMeaningResult(); return; }

    if (D.mi == null || D.mi < 0) D.mi = 0;
    if (D.mi >= ex.mc.length) D.mi = ex.mc.length - 1;
    var q = ex.mc[D.mi];

    var answered = ex.mc.filter(function (x) { return x.given; }).length;
    var pct = Math.round((answered / ex.total) * 100);

    var shown = !!q.shown;
    function optClass(val) {
      var c = "opt";
      if (!shown) { if (q.given === val) c += " sel"; return c; }
      if (val === q.answer) return c + " right";
      if (q.given === val) return c + " wrong";
      return c + " dim";
    }

    var promptHtml =
      '<div class="gap-card">' +
        '<div class="gap-label">Chọn đúng nghĩa tiếng Việt của từ</div>' +
        '<div class="gap-sentence mc-term-big">' + w.esc(q.term) + "</div>" +
      "</div>";
    var optsHtml = q.options.map(function (o, j) {
      return '<button class="' + optClass(o) + '" data-pick="' + w.esc(o) + '"' +
             (shown ? " disabled" : "") + '><span class="mk">' + "ABCD".charAt(j) +
             ".</span>" + w.esc(o) + "</button>";
    }).join("");

    var explainHtml = shown
      ? '<div class="quiz-feedback ' + (q.ok ? "ok" : "no") + '">' +
          (q.ok ? "✅ Chính xác!" : "❌ Đáp án đúng: <b>" + w.esc(q.answer) + "</b>") +
        "</div>"
      : "";

    var body = promptHtml +
      '<div class="single-grid">' +
        '<div class="opt-list">' + optsHtml + "</div>" +
        '<div class="single-explain">' + explainHtml + "</div>" +
      "</div>";

    /* Câu cuối: KHÔNG cần bấm "Nộp bài" — trả lời xong (đúng hay sai) là
       tự động chấm và hiện kết quả luôn, xem bindMeaning(). */
    var last = D.mi >= ex.mc.length - 1;
    var lastActionHtml = last
      ? (shown ? '<span class="exam-grading">⏳ Đang chấm điểm…</span>' : "")
      : '<button class="btn-primary" id="mn-next">Câu tiếp →</button>';
    w.$("#meaning-card").innerHTML =
      '<div class="exam-bar-row">' +
        '<span class="exam-idx">CÂU ' + (D.mi + 1) + " / " + ex.mc.length + "</span>" +
        '<span class="exam-score">đã làm ' + answered + "/" + ex.total + "</span>" +
      "</div>" +
      '<div class="quiz-bar"><i style="width:' + pct + '%"></i></div>' +
      body +
      '<div class="exam-actions">' +
        '<button class="btn-soft" id="mn-prev"' + (D.mi === 0 ? " disabled" : "") + ">← Trước</button>" +
        lastActionHtml +
      "</div>";

    /* Giống Từng câu: đặt hẹn giờ tự chấm mỗi lần render nếu câu cuối đã
       trả lời — để bấm "← Trước" rồi quay lại câu cuối vẫn tự chấm được. */
    clearTimeout(D._autoNextMeaning);
    if (last && shown) {
      D._autoNextMeaning = setTimeout(function () { D.submitMeaning(); }, q.ok ? 1100 : 1700);
    }

    D.bindMeaning();
  };

  D.bindMeaning = function () {
    var ex = D._meaningQuiz;
    var q = ex.mc[D.mi];

    w.$$("#meaning-card [data-pick]").forEach(function (b) {
      b.onclick = function () {
        if (q.shown) return;
        var v = b.dataset.pick;
        q.given = v;
        q.ok = v === q.answer;
        q.shown = true;
        D.renderMeaning();
        if (q.ok) w.Speech.speakWord(q.term);

        if (D.mi < ex.mc.length - 1 && q.ok) {
          clearTimeout(D._autoNextMeaning);
          D._autoNextMeaning = setTimeout(function () {
            if (D.mi < ex.mc.length - 1) { D.mi++; D.renderMeaning(); }
          }, 1100);
        }
      };
    });
    var p = w.$("#mn-prev"), n = w.$("#mn-next");
    if (p) p.onclick = function () { clearTimeout(D._autoNextMeaning); D.mi--; D.renderMeaning(); };
    if (n) n.onclick = function () { clearTimeout(D._autoNextMeaning); D.mi++; D.renderMeaning(); };
  };

  D.meaningResultHtml = function (ex) {
    var passed = ex.score >= PASS_MARK;
    return '<div class="exam-result ' + (passed ? "pass" : "failed") + '">' +
        '<div class="score">' + ex.score + "%</div>" +
        '<div class="verdict">' + (passed ? "✅ Nhớ nghĩa tốt!" : "🙂 Luyện thêm cho quen") + "</div>" +
        '<div class="detail">Đúng ' + ex.correct + "/" + ex.total + " câu · phần này chỉ để luyện, không tính vào chu kỳ ôn</div>" +
      "</div>";
  };
  D.meaningResultActionsHtml = function () {
    return '<div class="exam-actions">' +
      '<button class="btn-soft" id="meaning-again">🔁 Làm lại</button>' +
      '<button class="btn-primary" id="meaning-back">← Về danh sách Block</button>' +
    "</div>";
  };
  D.bindMeaningResult = function () {
    w.$("#meaning-again").onclick = function () { D._meaningQuiz = D.buildMeaningQuiz(); D.mi = 0; D.renderMeaning(); };
    w.$("#meaning-back").onclick = function () { D.close(); w.App.renderBlocks(); };
  };

  D.submitMeaning = async function () {
    var ex = D._meaningQuiz;
    var correct = 0;
    ex.mc.forEach(function (q) { q.ok = q.given === q.answer; if (q.ok) correct++; });
    ex.correct = correct;
    ex.score = w.pct(correct, ex.total);
    ex.graded = true;

    /* Luyện riêng, không đụng SRS/passed — nhưng vẫn ghi vào độ nhớ từng
       từ cho nhất quán với Active Recall Quiz. */
    var byTerm = {};
    words().forEach(function (x) { byTerm[x.term.toLowerCase()] = x; });
    for (var i = 0; i < ex.mc.length; i++) {
      var q = ex.mc[i];
      var x = byTerm[q.term.toLowerCase()];
      if (!x) continue;
      var prev = S().wp[x.id] || { attempts: 0, correct: 0 };
      var attempts = (prev.attempts || 0) + 1;
      var okCount = (prev.correct || 0) + (q.ok ? 1 : 0);
      var wpatch = {
        attempts: attempts, correct: okCount,
        mastered: attempts >= (cfg.MASTER_MIN_ATTEMPTS || 3) &&
                  (okCount / attempts) >= (cfg.MASTER_THRESHOLD || 0.8),
        last_reviewed_at: Date.now()
      };
      S().wp[x.id] = Object.assign({}, prev, wpatch, { user_id: w.Auth.user.id, word_id: x.id });
      try { await w.DB.saveWordProgress(w.Auth.user.id, x.id, wpatch); } catch (e) {}
    }

    /* Đạt ≥ 80% -> tính vào "số từ học hôm nay" cho màn Journey, y hệt
       Phiếu đầy đủ / Từng câu — mỗi thẻ bài tập đều có giá trị như nhau.
       Không đụng SRS/bp.passed (không đẩy chu kỳ ôn), nhưng vẫn đánh dấu
       riêng "meaning_passed" — chỉ 1 trong 3 thẻ đạt 80% là Block đã Done. */
    if (ex.score >= PASS_MARK) {
      try { await w.DB.bumpLearnedToday(w.Auth.user.id, ex.total); } catch (e) {}
      var bp0 = S().bp[D.blockId] || {};
      var bpatch = { meaning_passed: true, meaning_best: Math.max(bp0.meaning_best || 0, ex.score) };
      S().bp[D.blockId] = Object.assign({}, bp0, bpatch, { user_id: w.Auth.user.id, block_id: D.blockId });
      try { await w.DB.saveBlockProgress(w.Auth.user.id, D.blockId, bpatch); } catch (e) {}
    }

    D.renderMeaning();
    D.renderStats();
    D.renderStudy();
    D.renderProgress();
    w.toast("Đúng " + correct + "/" + ex.total + " (" + ex.score + "%)", ex.score >= PASS_MARK ? "ok" : "err");
  };

  /* ══════════════ TAB 3 — TIẾN TRÌNH ══════════════ */
  D.renderProgress = function () {
    var bp = S().bp[D.blockId] || { cycle: 0 };
    var cur = bp.cycle || 0;

    w.$("#srs-timeline").innerHTML = w.SRS.STEPS.map(function (s, i) {
      var cls = i < cur ? "done" : (i === cur ? "now" : "");
      var when = i < cur ? "đã xong"
               : (i === cur ? (bp.next_review_at ? w.humanTime(bp.next_review_at, { future: true }) : "sẵn sàng ôn")
                            : "chờ");
      return '<div class="srs-step ' + cls + '">' +
               '<span class="idx">' + (i + 1) + "</span>" +
               "<span>" + w.esc(s.label) + "</span>" +
               '<span class="when">' + when + "</span>" +
             "</div>";
    }).join("");

    var wp = S().wp;
    w.$("#progress-tbody").innerHTML = words().map(function (x) {
      var p = wp[x.id] || { attempts: 0, correct: 0 };
      var rate = w.pct(p.correct, p.attempts);
      return "<tr>" +
        "<td><b style=\"color:#60a5fa\">" + w.esc(x.term) + "</b></td>" +
        '<td data-label="Nghĩa">' + w.esc(x.meaning_vi || "—") + "</td>" +
        '<td data-label="Lần ôn">' + (p.attempts || 0) + "</td>" +
        '<td data-label="Đúng">' + (p.correct || 0) + "</td>" +
        '<td data-label="Tỷ lệ">' + (p.attempts ? rate + "%" : "—") + "</td>" +
        '<td data-label="Trạng thái">' + (p.mastered ? '<span class="tag-time">Đã thuộc</span>'
                             : '<span class="tag">' + (p.attempts ? "Đang học" : "Chưa ôn") + "</span>") + "</td>" +
      "</tr>";
    }).join("") || '<tr><td colspan="6" style="text-align:center;color:#64748b">—</td></tr>';
  };

  /* ══════════════ SỰ KIỆN CỦA MÀN HÌNH CHI TIẾT ══════════════ */
  D.bind = function () {
    w.Reader.bind();
    w.$("#btn-back").onclick = function () { D.close(); w.App.renderBlocks(); };

    w.$("#bn-prev").onclick = function () { D.gotoAdjacentBlock(-1); };
    w.$("#bn-next").onclick = function () { D.gotoAdjacentBlock(1); };

    w.$$(".dtab").forEach(function (t) {
      t.onclick = function () { D.showTab(t.dataset.tab); };
    });

    /* Nghe: chỉ đọc ĐÚNG phần đang hiện. Ở chế độ từng câu / từng đoạn thì
       đọc xong sẽ TỰ LẬT sang phần kế tiếp rồi đọc tiếp, tới hết bài mới dừng. */
    function readCurrent() {
      var sc = w.Reader.readScope();
      w.$("#btn-read").textContent = "🔊 Đang đọc…";
      w.Speech.readPassage({
        container: w.$("#passage"),
        plain: sc.plain,
        offset: sc.offset,
        onEnd: function () {
          if (D._autoRead && w.Reader.mode !== "full" && w.Reader.hasNext()) {
            w.Reader.step(1);
            setTimeout(readCurrent, 400);
          } else {
            D._autoRead = false;
            w.$("#btn-read").textContent = "🎧 Nghe US";
          }
        }
      });
    }

    w.$("#btn-read").onclick = function () {
      D._autoRead = true;
      readCurrent();
    };
    w.$("#btn-stop").onclick = function () {
      D._autoRead = false;
      w.Speech.stop();
      w.$("#btn-read").textContent = "🎧 Nghe US";
    };

    /* nút cuối Glossary -> vào THẲNG bài kiểm tra (tab Phiếu đầy đủ),
       không dừng lại ở màn chuẩn bị nào cả — chỉ tạo đề rồi hiện luôn. */
    w.$("#btn-go-exam").onclick = function () {
      D._autoRead = false;
      w.Speech.stop();
      D.showTab("sheet");
      w.$("#workspace").scrollTop = 0;
    };
    w.$("#btn-regen").onclick = async function () {
      /* Trước đây gọi renderPassage(true) không "await" nên toast "Đã tạo
         đoạn văn mới" hiện ra NGAY LẬP TỨC dù AI (mất vài giây) còn đang
         chạy phía sau — nhìn như app không làm gì rồi mới đổi. Giờ chờ
         xong hẳn mới báo, và khoá nút lại tránh bấm chồng nhiều lần. */
      var btn = this;
      w.Speech.stop();
      btn.disabled = true;
      var oldText = btn.textContent;
      btn.textContent = "⏳ Đang tạo...";
      try {
        await D.generatePassage();
        w.toast("Đã tạo đoạn văn mới");
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    };
    w.$("#btn-use-pasted").onclick = async function () {
      var text = (w.$("#passage-paste").value || "").trim();
      if (!text) { w.toast("Dán bài vào ô trước đã nhé", "err"); return; }
      await D.usePastedPassage(text);
      w.$("#passage-paste").value = "";
      w.toast("Đã lưu bài đọc");
    };
    w.$("#btn-ai-write").onclick = async function () {
      var btn = this;
      btn.disabled = true;
      var oldText = btn.textContent;
      btn.textContent = "⏳ Đang tạo...";
      try {
        await D.generatePassage();
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    };
    w.$("#claude-picks-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-i]");
      if (!btn) return;
      D._claudePick = Number(btn.dataset.i);
      D.renderClaudePicks(block());
    });
    w.$("#btn-use-claude").onclick = async function () {
      if (D._claudePick == null) return;
      await D.useClaudeCandidate(D._claudePick);
      w.toast("Đã dùng bài của Claude");
    };
    w.$("#btn-copy-passage").onclick = function () { copyText(this, D._passagePlain || ""); };
    w.$("#btn-copy-vocab").onclick = function () {
      var text = words().map(function (x) {
        return [x.term, x.level, x.pos, x.ipa, x.def_en, x.meaning_vi].filter(Boolean).join(" | ");
      }).join("\n");
      copyText(this, text);
    };
    w.$("#speed-select").onchange = function (e) { w.Speech.setRate(e.target.value); };

    /* --- chọn giọng đọc có sẵn trên máy --- */
    function fillVoices() {
      var sel = w.$("#voice-select");
      if (!sel) return;
      var list = w.Speech.listVoices();
      if (!list.length) {
        sel.innerHTML = '<option value="">Giọng mặc định</option>';
        sel.title = "Máy này chưa cài thêm giọng tiếng Anh nào";
        return;
      }
      var cur = w.Speech.currentVoiceName();
      sel.innerHTML = list.map(function (v) {
        var label = v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*English.*$/i, "");
        return '<option value="' + w.esc(v.name) + '"' + (v.name === cur ? " selected" : "") + ">" +
               w.esc(label) + " · " + w.esc(v.lang) + "</option>";
      }).join("");
      sel.title = "Giọng đang dùng: " + cur;
    }
    fillVoices();
    w.Speech.onVoicesReady = fillVoices;   /* giọng nạp chậm thì điền lại */

    w.$("#voice-select").onchange = function (e) {
      w.Speech.setVoice(e.target.value);
      w.Speech.speakWord("This is the voice you selected.");
    };

    /* bấm vào 1 từ bất kỳ trong đoạn văn -> mở bảng tra từ (kiểu LingQ) */
    w.$("#passage").addEventListener("click", function (e) {
      var el = e.target.closest(".kw");
      if (!el) return;
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;   /* đang bôi cụm thì để mouseup lo */
      /* vừa bôi xong -> đừng ghi đè cụm bằng từ đơn dưới con trỏ */
      if (Date.now() - (w.Reader._justSelected || 0) < 400) return;
      var term = el.dataset.term || el.dataset.w;
      var sent = el.closest(".sent");
      w.Speech.speakWord(term);
      w.Reader.open(term, sent ? sent.textContent.replace(/\s+/g, " ").trim() : "");
    });

    /* Bảng từ vựng và Glossary: bấm BẤT KỲ CHỖ NÀO trong dòng là mở bảng tra
       (trước đây phải trúng đúng chữ đậm mới ăn, rất khó bấm). */
    w.$("#vocab-tbody").addEventListener("click", function (e) {
      if (e.target.closest(".spk")) return;
      var tr = e.target.closest("tr");
      if (!tr) return;
      var b = tr.querySelector("td:first-child b");
      if (b) w.Reader.open(b.textContent.trim(), "");
    });
    w.$("#passage-glossary").addEventListener("click", function (e) {
      var copyBtn = e.target.closest("#glossary-copy");
      if (copyBtn) {
        var text = w.$$("#passage-glossary .g-row").map(function (r) {
          return r.textContent.replace(/\s+/g, " ").trim();
        }).join("\n");
        copyText(copyBtn, text);
        return;
      }
      var row = e.target.closest(".g-row");
      if (!row) return;
      var b = row.querySelector("b");
      if (b) w.Reader.open(b.textContent.trim(), "");
    });

    /* nút loa trong bảng từ vựng */
    w.$("#vocab-tbody").addEventListener("click", function (e) {
      var btn = e.target.closest(".spk");
      if (btn) w.Speech.speakWord(btn.dataset.say);
    });

    /* đọc lần lượt TẤT CẢ từ trong bài, dòng nào đang đọc thì sáng lên */
    w.$("#btn-read-all").onclick = function () {
      var ws = words();
      if (!ws.length) return;
      var btn = this;
      btn.textContent = "🔊 Đang đọc…";
      w.Speech.speakList(
        ws.map(function (x) { return { text: x.term }; }),
        function (i) {
          w.$$("#vocab-tbody tr").forEach(function (tr, k) {
            tr.classList.toggle("reading", k === i);
          });
          w.Speech.followWord(w.$$("#vocab-tbody tr")[i]);
        },
        function () { btn.textContent = "🔊 Đọc tất cả từ"; }
      );
    };
    w.$("#btn-stop-all").onclick = function () {
      w.Speech.stop();
      w.$$("#vocab-tbody tr").forEach(function (tr) { tr.classList.remove("reading"); });
      w.$("#btn-read-all").textContent = "🔊 Đọc tất cả từ";
    };

  };

  w.Detail = D;
})(window);
