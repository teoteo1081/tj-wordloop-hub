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
    var b = block();
    if (!b) return;

    w.$("#screen-blocks").hidden = true;
    w.$("#screen-detail").hidden = false;
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
    D.blockId = null;
  };

  D.showTab = function (name) {
    w.$$(".dtab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    w.$$(".tab-pane").forEach(function (p) { p.classList.remove("active"); });
    w.$("#pane-" + name).classList.add("active");
    if (name === "quiz") D.startQuiz();
    if (name === "final") { if (D._exam) D.renderFinal(); else D.renderFinalIntro(); }
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

  D.renderPassage = async function (forceNew) {
    var b = block(), ws = words();
    if (!b) return;

    if (forceNew || !b.context_passage) {
      var cfg2 = w.APP_CONFIG || {};
      var madeWithAI = false;
      var willTryAI = !!(cfg2.GEMINI_API_KEY || cfg2.OPENAI_API_KEY);

      /* AI mất vài giây (bài ~500 từ) — báo ngay để khỏi tưởng app đứng. */
      if (willTryAI) {
        w.$("#passage-title").textContent = "Đang nhờ AI viết bài đọc mới…";
        w.$("#passage").innerHTML = '<p style="color:var(--text-3);font-style:italic">⏳ Đang sinh bài đọc bằng AI, chờ vài giây…</p>';
        w.$("#passage-glossary").innerHTML = "";
      }

      /* Có key Gemini hoặc OpenAI (js/keys.local.js) -> nhờ AI viết văn
         thật, mỗi lần một bối cảnh khác nhau, không còn trùng khuôn mẫu.
         Lỗi mạng / hết credit / chưa cấu hình key -> tự rơi về bộ mẫu câu
         có sẵn, không chặn người học. */
      if (willTryAI) {
        try {
          b.context_passage = await w.Context.generateAI(ws, cfg2);
          madeWithAI = true;
        } catch (e) {
          /* Lỗi chi tiết ghi ra console cho lúc cần soi; toast chỉ báo nhẹ
             là đã tự dùng bài mẫu — tránh giật mình mỗi lần mở Block mới
             trong lúc key OpenAI chưa có credit / mất mạng. */
          console.warn("Sinh bài đọc bằng AI thất bại, dùng mẫu có sẵn:", e);
          w.toast("AI chưa sẵn sàng (" + (e.message || "lỗi mạng") + ") — đang dùng bài đọc mẫu", "err");
        }
      }
      if (!madeWithAI) {
        b.context_passage = w.Context.generate(ws, forceNew ? Math.floor(Math.random() * 997) : (b.global_index || 1) * 7);
      }
      try { await w.DB.saveContext(b.id, b.context_passage); } catch (e) { /* offline vẫn hiển thị được */ }
      /* đoạn văn đổi thì đề thi cũ không còn khớp nữa — chỉ huỷ ở đây,
         không huỷ ở mỗi lần vẽ lại (nếu không sẽ mất bài đang chấm) */
      D._exam = null;
    }

    var meta = w.Context.parseMeta(b.context_passage);
    var seed = (b.global_index || 1) * 3;
    w.$("#passage-title").textContent = meta.title || w.Context.titleFor(seed);
    w.$("#passage-src").textContent = meta.source || w.Context.sourceFor(seed);
    /* Nhãn nhỏ để BIẾT NGAY bài đang xem là AI sinh hay bài mẫu có sẵn —
       trước đây chỉ khác nhau ở câu chữ nhỏ trong .src-tag, rất dễ bỏ qua. */
    var badge = w.$("#passage-ai-badge");
    if (badge) {
      badge.textContent = meta.ai ? "✨ AI" : "📄 Mẫu có sẵn";
      badge.className = "ai-badge" + (meta.ai ? " ai" : " tpl");
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

  /* ══════════════ TAB — BÀI THI CUỐI BÀI ══════════════
     Dạng phiếu bài tập, giống bộ tài liệu giấy:
       Phần A — điền từ vào chỗ trống, câu lấy NGUYÊN VĂN từ đoạn văn đã
                học. Cơ chế điền khác nhau theo chế độ xem:
                  · "Phiếu đầy đủ": word bank cố định dính trên đầu, bấm
                    chip để điền (hoặc bấm lại để bỏ chọn).
                  · "Từng câu": trắc nghiệm 4 lựa chọn mỗi câu (đúng 1 từ +
                    3 từ nhiễu lấy trong chính Block).
       Phần B — chọn nghĩa tiếng Việt đúng (trắc nghiệm 4 lựa chọn cả 2 chế độ).
     Đúng >= 80% mới tính là hoàn thành Block và mới đẩy chu kỳ SRS. */
  var PASS_MARK = 80;
  D.PASS_MARK = PASS_MARK;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  D.buildExam = function () {
    var b = block(), ws = words();
    if (!b || !ws.length) return null;

    var byTerm = {};
    ws.forEach(function (x) { byTerm[x.term.toLowerCase()] = x; });
    var allTerms = ws.map(function (x) { return x.term; });

    /* Phần A: mỗi gap có sẵn `options` (đúng 1 từ + 3 từ nhiễu trong chính
       Block) để chế độ "Từng câu" dùng làm trắc nghiệm 4 lựa chọn. Chế độ
       "Phiếu đầy đủ" thì vẫn dùng `bank` (word bank cố định, bấm điền vào
       chỗ trống) — 2 chế độ khác nhau, cùng chung 1 danh sách `gaps`. */
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

    var withVi = ws.filter(function (x) { return x.meaning_vi; });
    var mcWords = shuffle(withVi).slice(0, Math.min(5, withVi.length));

    var mc = mcWords.map(function (x) {
      var others = shuffle(withVi.filter(function (y) {
        return y.id !== x.id && y.meaning_vi !== x.meaning_vi;
      })).slice(0, 3).map(function (y) { return y.meaning_vi; });
      return { term: x.term, answer: x.meaning_vi, options: shuffle([x.meaning_vi].concat(others)), given: null };
    });

    return {
      gaps: shuffle(gaps),
      mc: mc,
      bank: shuffle(ws.map(function (x) { return x.term; })),
      total: gaps.length + mc.length,
      graded: false
    };
  };

  /* ---------- Màn hình chuẩn bị ---------- */
  D.renderFinalIntro = function () {
    var ws = words();
    var bp = S().bp[D.blockId] || {};
    var b = block() || {};
    var gapN = w.Context.gapSentences(w.Context.parseMeta(b.context_passage || "").marked).length;
    var mcN = Math.min(5, ws.filter(function (x) { return x.meaning_vi; }).length);

    var rows = ws.map(function (x) {
      return '<div class="prep-row">' +
               '<span class="prep-term w-tap" data-term="' + w.esc(x.term) + '">' + w.esc(x.term) + "</span>" +
               '<button class="spk" data-say="' + w.esc(x.term) + '" title="Nghe">🔊</button>' +
               '<span class="prep-vi">' + w.esc(x.meaning_vi || x.def_en || "") + "</span>" +
             "</div>";
    }).join("");

    w.$("#final-card").innerHTML =
      '<div class="prep">' +
        '<div class="prep-head">' +
          '<button class="btn-soft" id="f-read">🔊 Đọc lại đoạn văn</button>' +
          '<span class="prep-note">Xem lại một lượt, bấm vào từ để nghe — rồi hãy vào kiểm tra</span>' +
        "</div>" +
        '<div class="prep-list">' + rows + "</div>" +
        '<div class="pass-rule">Phần A: ' + gapN + " câu chọn từ đúng · Phần B: " + mcN +
          " câu chọn nghĩa · cần đúng ≥ " + PASS_MARK + "% mới hoàn thành Block</div>" +
        '<button class="btn-primary btn-big" id="f-start">Hiểu rồi, vào kiểm tra →</button>' +
        (bp.last_exam_at
          ? '<div class="best-line">Điểm cao nhất: <b>' + (bp.best_score || 0) + "%</b> · " +
            (bp.passed ? "đã đạt ✓" : "chưa đạt") + " · lần gần nhất " + w.humanTime(bp.last_exam_at) + "</div>"
          : '<div class="best-line">Bạn chưa làm bài kiểm tra này lần nào.</div>') +
      "</div>";

    w.$("#f-read").onclick = function () {
      D.showTab("study");
      setTimeout(function () { w.$("#btn-read").click(); }, 200);
    };
    w.$("#f-start").onclick = function () { D.startFinal(); };
  };

  D.startFinal = function () {
    D._exam = D.buildExam();
    if (!D._exam) { w.toast("Chưa dựng được đề — hãy mở tab Bài học một lượt", "err"); return; }
    D.renderFinal();
  };

  /* ---------- Phiếu bài tập ---------- */
  D.renderFinal = function () {
    var ex = D._exam;
    if (!ex) return D.renderFinalIntro();

    var b = block() || {};
    var html = "";

    if (ex.graded) {
      var passed = ex.score >= PASS_MARK;
      html +=
        '<div class="exam-result ' + (passed ? "pass" : "failed") + '">' +
          '<div class="score">' + ex.score + "%</div>" +
          '<div class="verdict">' + (passed ? "✅ ĐẠT — Block đã hoàn thành" : "❌ CHƯA ĐẠT — cần ≥ " + PASS_MARK + "%") + "</div>" +
          '<div class="detail">Đúng ' + ex.correct + "/" + ex.total + " câu" +
            (passed ? " · Block đã lên chu kỳ tiếp theo, lịch ôn: " + ex.nextLabel
                    : " · Đọc lại bài rồi kiểm tra lại nhé") +
          "</div>" +
        "</div>";
    } else {
      html +=
        '<div class="exam-head">' +
          '<button class="btn-soft" id="f-quit">← Quay lại</button>' +
          '<span class="exam-tag">KIỂM TRA</span>' +
          '<span class="exam-meta">' + w.esc(b.name || "") + " · " + ex.total + " câu</span>" +
        "</div>" +
        '<div class="read-modes" id="exam-modes">' +
          '<button class="rm-btn' + (D.examView === "sheet" ? " active" : "") + '" data-ev="sheet">📋 Phiếu đầy đủ</button>' +
          '<button class="rm-btn' + (D.examView === "single" ? " active" : "") + '" data-ev="single">🔤 Từng câu</button>' +
        "</div>";
    }

    /* chế độ TỪNG CÂU: vẽ riêng, thoát sớm */
    if (!ex.graded && D.examView === "single") {
      w.$("#final-card").innerHTML = html + D.singleHtml();
      D.bindExamModes();
      D.bindSingle();
      return;
    }

    /* ---- WORD BANK: dính trên đầu khi cuộn ---- */
    if (!ex.graded) {
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

    /* ---- Phần A: bấm chip ở word bank để điền vào chỗ trống ---- */
    html += '<div class="exam-part">';
    html += '<div class="exam-part-title">Phần A — Điền từ vào chỗ trống (theo bài đọc)</div>';
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
      /* chấm xong thì kèm nghĩa của từ và bản dịch cả câu, đúng hay sai đều có */
      var note = ex.graded ? D.answerNote(g.term, g.text) : "";
      return '<div class="ex-q"><b class="qn">' + (i + 1) + '.</b><span class="qtext">' +
             w.esc(parts[0] || "") + slot + w.esc(parts[1] || "") + note + "</span></div>";
    }).join("");
    html += "</div>";

    /* ---- Phần B ---- */
    if (ex.mc.length) {
      html += '<div class="exam-part">';
      html += '<div class="exam-part-title">Phần B — Chọn nghĩa tiếng Việt đúng</div>';
      html += ex.mc.map(function (q, i) {
        var opts = q.options.map(function (o, j) {
          var cls = "opt";
          if (!ex.graded) { if (q.given === o) cls += " sel"; }
          else if (o === q.answer) cls += " right";
          else if (q.given === o) cls += " wrong";
          else cls += " dim";
          return '<button class="' + cls + '" data-mc="' + i + '" data-opt="' + w.esc(o) + '"' +
                 (ex.graded ? " disabled" : "") + '>' +
                 '<span class="mk">' + "ABCD".charAt(j) + ".</span>" + w.esc(o) + "</button>";
        }).join("");
        return '<div class="mc-q"><div class="mc-ask"><b class="qn">' + (ex.gaps.length + i + 1) +
               '.</b> Nghĩa của <b class="mc-term">' + w.esc(q.term) + "</b> là gì?</div>" +
               '<div class="opt-list">' + opts + "</div></div>";
      }).join("");
      html += "</div>";
    }

    /* ---- Nút ---- */
    html += '<div class="exam-actions">';
    if (!ex.graded) {
      html += '<button class="btn-primary" id="f-submit">Nộp bài</button>';
    } else {
      html += '<button class="btn-soft" id="f-again">🔁 Kiểm tra lại</button>' +
              '<button class="btn-primary" id="f-back">← Về danh sách Block</button>';
    }
    html += "</div>";

    w.$("#final-card").innerHTML = html;
    D.bindFinal();
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

  /* ══════════ CHẾ ĐỘ LÀM BÀI: PHIẾU ĐẦY ĐỦ ↔ TỪNG CÂU ══════════
     Điện thoại mặc định "từng câu" cho dễ bấm; máy tính mặc định "phiếu". */
  var LS_EV = "tjwl_examview_v1";
  try {
    D.examView = localStorage.getItem(LS_EV) ||
                 (window.matchMedia("(max-width:860px)").matches ? "single" : "sheet");
  } catch (e) { D.examView = "sheet"; }

  D.setExamView = function (v) {
    clearTimeout(D._autoNext);
    D.examView = v;
    try { localStorage.setItem(LS_EV, v); } catch (e) {}
    D.si = 0;
    D.renderFinal();
  };

  D.bindExamModes = function () {
    w.$$("#exam-modes .rm-btn").forEach(function (b) {
      b.onclick = function () { D.setExamView(b.dataset.ev); };
    });
    var q = w.$("#f-quit");
    if (q) q.onclick = function () { D._exam = null; D.renderFinalIntro(); };
  };

  /* Gộp Phần A + Phần B thành một dãy câu để đi từng câu một */
  D.singleList = function () {
    var ex = D._exam, list = [];
    ex.gaps.forEach(function (g, i) { list.push({ kind: "gap", i: i, ref: g }); });
    ex.mc.forEach(function (q, i) { list.push({ kind: "mc", i: i, ref: q }); });
    return list;
  };

  D.singleHtml = function () {
    var ex = D._exam;
    var list = D.singleList();
    if (D.si == null || D.si < 0) D.si = 0;
    if (D.si >= list.length) D.si = list.length - 1;

    var cur = list[D.si];
    var answered = ex.gaps.filter(function (g) { return g.given; }).length +
                   ex.mc.filter(function (q) { return q.given; }).length;
    var pct = Math.round((answered / ex.total) * 100);

    /* Chấm ngay từng câu: ĐÚNG thì tự sang câu sau, SAI thì dừng lại.
       Dù đúng hay sai cũng hiện nghĩa của từ và bản dịch cả câu. */
    var shown = !!cur.ref.shown;
    var right = cur.kind === "gap" ? cur.ref.term : cur.ref.answer;

    function optClass(val) {
      var c = "opt";
      if (!shown) { if (cur.ref.given === val) c += " sel"; return c; }
      if (val === right) return c + " right";
      if (cur.ref.given === val) return c + " wrong";
      return c + " dim";
    }

    /* Bố cục 2 cột: đáp án BÊN TRÁI, giải thích BÊN PHẢI — chấm xong thì
       giải thích chỉ lấp vào cột phải, không đẩy nút "Câu tiếp" xuống dưới
       như kiểu xếp chồng cũ. Điện thoại tự gập về 1 cột (CSS). */
    var promptHtml, optsHtml;
    if (cur.kind === "gap") {
      var parts = cur.ref.text.split("{{GAP}}");
      promptHtml =
        '<div class="gap-card">' +
          '<div class="gap-label">Chọn từ đúng điền vào chỗ trống</div>' +
          '<div class="gap-sentence">' + w.esc(parts[0] || "") +
            '<span class="blank' + (cur.ref.given ? " has" : "") +
              (shown ? (cur.ref.ok ? " ok" : " no") : "") + '">' +
              (cur.ref.given ? w.esc(cur.ref.given) : "_ _ _") + "</span>" +
            w.esc(parts[1] || "") +
          "</div>" +
        "</div>";
      optsHtml = cur.ref.options.map(function (t, j) {
        return '<button class="' + optClass(t) + '" data-pick="' + w.esc(t) + '"' +
               (shown ? " disabled" : "") + '><span class="mk">' + "ABCD".charAt(j) +
               ".</span>" + w.esc(t) + "</button>";
      }).join("");
    } else {
      promptHtml =
        '<div class="gap-card">' +
          '<div class="gap-label">Chọn nghĩa tiếng Việt đúng</div>' +
          '<div class="gap-sentence">' + w.esc(cur.ref.term) + "</div>" +
        "</div>";
      optsHtml = cur.ref.options.map(function (o, j) {
        return '<button class="' + optClass(o) + '" data-pick="' + w.esc(o) + '"' +
               (shown ? " disabled" : "") + '><span class="mk">' + "ABCD".charAt(j) +
               ".</span>" + w.esc(o) + "</button>";
      }).join("");
    }

    var explainHtml = shown
      ? '<div class="quiz-feedback ' + (cur.ref.ok ? "ok" : "no") + '">' +
          (cur.ref.ok ? "✅ Chính xác!" : "❌ Đáp án đúng: <b>" + w.esc(right) + "</b>") +
        "</div>" +
        D.answerNote(cur.ref.term, cur.kind === "gap" ? cur.ref.text : "")
      : "";

    var body = promptHtml +
      '<div class="single-grid">' +
        '<div class="opt-list">' + optsHtml + "</div>" +
        '<div class="single-explain">' + explainHtml + "</div>" +
      "</div>";

    var last = D.si >= list.length - 1;
    return '<div class="exam-bar-row">' +
             '<span class="exam-idx">CÂU ' + (D.si + 1) + " / " + list.length + "</span>" +
             '<span class="exam-score">đã làm ' + answered + "/" + ex.total + "</span>" +
           "</div>" +
           '<div class="quiz-bar"><i style="width:' + pct + '%"></i></div>' +
           body +
           '<div class="exam-actions">' +
             '<button class="btn-soft" id="sg-prev"' + (D.si === 0 ? " disabled" : "") + ">← Trước</button>" +
             (last
               ? '<button class="btn-primary" id="f-submit">Nộp bài</button>'
               : '<button class="btn-primary" id="sg-next">Câu tiếp →</button>') +
           "</div>";
  };

  D.bindSingle = function () {
    var ex = D._exam;
    var list = D.singleList();
    var cur = list[D.si];

    w.$$("#final-card [data-pick]").forEach(function (b) {
      b.onclick = function () {
        if (cur.ref.shown) return;                 /* đã chấm rồi thì thôi */
        var v = b.dataset.pick;
        var right = cur.kind === "gap" ? cur.ref.term : cur.ref.answer;
        cur.ref.given = v;
        cur.ref.ok = w.normalizeAnswer(v) === w.normalizeAnswer(right);
        cur.ref.shown = true;
        D.renderFinal();
        if (cur.ref.ok) w.Speech.speakWord(right);

        /* ĐÚNG -> tự sang câu kế. SAI -> dừng lại cho mình đọc đáp án. */
        if (cur.ref.ok) {
          clearTimeout(D._autoNext);
          D._autoNext = setTimeout(function () {
            if (D.si < D.singleList().length - 1) { D.si++; D.renderFinal(); }
          }, 1100);
        }
      };
    });
    var p = w.$("#sg-prev"), n = w.$("#sg-next"), s = w.$("#f-submit");
    if (p) p.onclick = function () { clearTimeout(D._autoNext); D.si--; D.renderFinal(); };
    if (n) n.onclick = function () { clearTimeout(D._autoNext); D.si++; D.renderFinal(); };
    if (s) s.onclick = function () { D.submitFinal(); };
  };

  /* ---------- Sự kiện của phiếu bài tập ---------- */
  D.bindFinal = function () {
    var ex = D._exam;
    var card = w.$("#final-card");
    D.bindExamModes();

    if (ex.graded) {
      w.$("#f-again").onclick = function () { D._exam = null; D.renderFinalIntro(); };
      w.$("#f-back").onclick = function () { D.close(); w.App.renderBlocks(); };
      return;
    }

    w.$("#f-quit").onclick = function () { D._exam = null; D.renderFinalIntro(); };
    w.$("#f-submit").onclick = function () { D.submitFinal(); };

    /* ô trống đang được chọn để điền */
    function activeSlot() {
      return card.querySelector(".slot.active");
    }
    function setActive(el) {
      w.$$(".slot", card).forEach(function (s) { s.classList.toggle("active", s === el); });
    }
    function firstEmpty() {
      return w.$$(".slot", card).filter(function (s) { return !ex.gaps[+s.dataset.gap].given; })[0];
    }
    function refresh() {
      /* chip nào đã dùng thì mờ đi; đếm số ô còn trống */
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
      ex.gaps[+slot.dataset.gap].given = term;
      redrawSlots();
      /* điền xong thì tự nhảy sang ô trống kế tiếp, khỏi phải bấm lại */
      var next = firstEmpty();
      if (next) setActive(next); else setActive(null);
    }
    function clearGap(i) {
      ex.gaps[i].given = null;
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

    /* onclick (không phải addEventListener): bindFinal chạy lại sau MỖI lần
       vẽ, dùng addEventListener thì handler chồng lên nhau — một cú bấm chip
       chạy 2-3 lần, điền rồi tự xoá, ô nhảy loạn. onclick thì luôn chỉ có một. */
    card.onclick = function (e) {
      /* bỏ chọn bằng nút ✕ */
      var x = e.target.closest("[data-clear]");
      if (x) { e.stopPropagation(); clearGap(+x.dataset.clear); return; }

      /* bấm vào ô trống -> chọn ô đó để điền */
      var slot = e.target.closest(".slot[data-gap]");
      if (slot) {
        if (ex.gaps[+slot.dataset.gap].given) clearGap(+slot.dataset.gap);
        setActive(slot);
        return;
      }

      /* bấm chip: đã dùng -> gỡ ra; chưa dùng -> điền vào ô đang chọn */
      var chip = e.target.closest("[data-bank]");
      if (chip) {
        var term = chip.dataset.bank;
        var hit = -1;
        ex.gaps.forEach(function (g, i) {
          if (hit < 0 && g.given && w.normalizeAnswer(g.given) === w.normalizeAnswer(term)) hit = i;
        });
        if (hit >= 0) clearGap(hit); else fill(term);
        return;
      }

      /* phần B */
      var opt = e.target.closest("[data-mc]");
      if (opt) {
        var qi = +opt.dataset.mc;
        ex.mc[qi].given = opt.dataset.opt;
        w.$$('[data-mc="' + qi + '"]', card).forEach(function (b2) {
          b2.classList.toggle("sel", b2 === opt);
        });
      }
    };

    w.$("#wb-clear").onclick = function () {
      ex.gaps.forEach(function (g) { g.given = null; });
      redrawSlots();
    };

    /* mặc định chọn sẵn ô đầu tiên còn trống */
    var f = firstEmpty();
    if (f) setActive(f);
    refresh();
  };

  /* ---------- Chấm điểm ---------- */
  D.submitFinal = async function () {
    var ex = D._exam;
    var correct = 0;

    ex.gaps.forEach(function (g) {
      g.ok = !!g.given && w.normalizeAnswer(g.given) === w.normalizeAnswer(g.term);
      if (g.ok) correct++;
    });
    ex.mc.forEach(function (q) {
      q.ok = q.given === q.answer;
      if (q.ok) correct++;
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
    var touched = [];
    ex.gaps.forEach(function (g) { touched.push({ x: byTerm[g.term.toLowerCase()], ok: g.ok }); });
    ex.mc.forEach(function (q) { touched.push({ x: byTerm[q.term.toLowerCase()], ok: q.ok }); });

    for (var i = 0; i < touched.length; i++) {
      var it = touched[i];
      if (!it.x) continue;
      var prev = S().wp[it.x.id] || { attempts: 0, correct: 0 };
      var attempts = (prev.attempts || 0) + 1;
      var okCount = (prev.correct || 0) + (it.ok ? 1 : 0);
      var wpatch = {
        attempts: attempts, correct: okCount,
        mastered: attempts >= (cfg.MASTER_MIN_ATTEMPTS || 3) &&
                  (okCount / attempts) >= (cfg.MASTER_THRESHOLD || 0.8),
        last_reviewed_at: Date.now()
      };
      S().wp[it.x.id] = Object.assign({}, prev, wpatch, { user_id: w.Auth.user.id, word_id: it.x.id });
      try { await w.DB.saveWordProgress(w.Auth.user.id, it.x.id, wpatch); } catch (e) {}
    }

    D.renderFinal();
    D.renderStats();
    D.renderStudy();
    D.renderProgress();
    w.$("#workspace").scrollTop = w.$("#pane-final").offsetTop - 60;
    w.toast(passed ? "🎉 Đạt " + ex.score + "% — Block hoàn thành!" : "Được " + ex.score + "% — cần ≥ " + PASS_MARK + "%",
            passed ? "ok" : "err");
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

    /* nút cuối Glossary -> vào THẲNG bài kiểm tra, không dừng lại ở màn
       hình chuẩn bị (màn đó lặp lại đúng bảng từ vừa đọc xong ở tab Bài
       học nên thừa) — chỉ tạo đề rồi hiện luôn. */
    w.$("#btn-go-exam").onclick = function () {
      D._autoRead = false;
      w.Speech.stop();
      D.showTab("final");
      D.startFinal();
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
        await D.renderPassage(true);
        w.toast("Đã tạo đoạn văn mới");
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
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

    /* nút loa ở màn hình chuẩn bị bài thi */
    w.$("#final-card").addEventListener("click", function (e) {
      var btn = e.target.closest(".spk");
      if (btn) { e.stopPropagation(); w.Speech.speakWord(btn.dataset.say); }
    });
  };

  w.Detail = D;
})(window);
