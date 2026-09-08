/* app.js — BỘ ĐIỀU PHỐI
   Luồng khởi động:
     DB.init()  ->  Auth.init()  ->  nạp Hub/Notebook  ->  render  ->  gắn sự kiện
   Cây dữ liệu:  Hub > Notebook > Section > Page > Batch > Block > Word          */
(function (w) {
  "use strict";

  var LS_SEL = "tjwl_selection_v1";
  var cfg = w.APP_CONFIG || {};

  /* Trạng thái toàn app — detail.js cũng đọc biến này */
  var S = {
    hubs: [], hubId: null,
    notebooks: [], notebookId: null,
    sections: [], sectionId: null,
    pages: [], pageId: null,
    batches: [], batchId: null,
    blocks: [], words: [],
    wp: {}, bp: {}
  };
  w.S = S;

  var App = {};
  w.App = App;

  /* ══════════════ GHI NHỚ LỰA CHỌN ══════════════ */
  function saveSel() {
    try {
      localStorage.setItem(LS_SEL, JSON.stringify({
        hubId: S.hubId, notebookId: S.notebookId, sectionId: S.sectionId,
        pageId: S.pageId, batchId: S.batchId
      }));
    } catch (e) {}
  }
  function readSel() {
    try { return JSON.parse(localStorage.getItem(LS_SEL)) || {}; } catch (e) { return {}; }
  }

  /* ══════════════ TIỆN ÍCH TRUY VẤN ══════════════ */
  App.blocksOf = function (batchId) {
    return S.blocks.filter(function (b) { return b.batch_id === batchId; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  };
  App.wordsOf = function (blockId) {
    return S.words.filter(function (x) { return x.block_id === blockId; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  };
  function batchesOfPage(pageId) {
    return S.batches.filter(function (b) { return b.page_id === pageId; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }
  App.batchesOf = batchesOfPage;

  /* Đổi Batch đang chọn (dùng bởi nút Batch trước/sau trong tab Bài học của
     màn Chi tiết Block) — không tự renderBlocks() ở đây vì lúc gọi hàm này
     thường sẽ mở luôn 1 Block cụ thể ngay sau, gọi renderBlocks() thừa. */
  App.selectBatch = function (batchId) {
    var b = S.batches.find(function (x) { return x.id === batchId; });
    if (!b) return;
    S.batchId = batchId;
    S.pageId = b.page_id;
    saveSel();
    renderCrumb();
    renderBatches();
  };
  function pagesOfSection(sectionId) {
    return S.pages.filter(function (p) { return p.section_id === sectionId; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  /* Toàn bộ Batch của Notebook đang mở, xếp phẳng đúng thứ tự hiển thị:
     Section > Page > Batch — dùng để duyệt Batch/Block liên tục xuyên
     Page (App.stepBatch bên dưới). */
  App.flattenBatches = function () {
    var out = [];
    S.sections.slice().sort(bySort).forEach(function (sec) {
      pagesOfSection(sec.id).forEach(function (pg) {
        batchesOfPage(pg.id).forEach(function (bt) {
          out.push({ batchId: bt.id, pageId: pg.id, sectionId: sec.id });
        });
      });
    });
    return out;
  };

  /* ══════════════ DUYỆT BATCH XUYÊN PAGE/NOTEBOOK ══════════════
     Dùng chung cho: (1) nút ←/→ đổi Batch ở đầu màn danh sách Block,
     (2) nút ←/→ đổi Block trong Chi tiết khi đã hết Block/Batch của Page
     hiện tại (D.gotoAdjacentBlock trong detail.js). Thứ tự duyệt: hết
     Batch của Page này thì qua Page kế/trước (cùng Notebook); hết luôn
     Notebook thì lăn qua Notebook kế/trước TRONG CÙNG HUB, theo đúng thứ
     tự đang hiển thị ở sidebar (S.notebooks) — bỏ qua Notebook rỗng
     (không có Batch nào), KHÔNG lăn qua Hub khác.
     Trả về true nếu di chuyển được (đã cập nhật S + renderAll()), false
     nếu đã ở Batch đầu/cuối cùng của cả Hub. */
  App.stepBatch = async function (dir) {
    var seq = App.flattenBatches();
    var idx = seq.findIndex(function (x) { return x.batchId === S.batchId; });
    if (idx >= 0) {
      var j = idx + dir;
      if (j >= 0 && j < seq.length) {
        var hit = seq[j];
        S.sectionId = hit.sectionId; S.pageId = hit.pageId; S.batchId = hit.batchId;
        saveSel(); renderAll();
        return true;
      }
    }
    /* Hết Batch trong Notebook hiện tại -> thử từng Notebook kế/trước cho
       tới khi gặp 1 cái có Batch, hoặc hết danh sách Notebook của Hub. */
    var nbId = S.notebookId;
    for (var guard = 0; guard < S.notebooks.length; guard++) {
      var curIdx = S.notebooks.findIndex(function (n) { return n.id === nbId; });
      var nextIdx = curIdx + dir;
      if (nextIdx < 0 || nextIdx >= S.notebooks.length) return false;
      nbId = S.notebooks[nextIdx].id;
      S.notebookId = nbId;
      await loadNotebook(nbId);
      var seq2 = App.flattenBatches();
      if (seq2.length) {
        var edge = dir > 0 ? seq2[0] : seq2[seq2.length - 1];
        S.sectionId = edge.sectionId; S.pageId = edge.pageId; S.batchId = edge.batchId;
        saveSel(); renderAll();
        return true;
      }
      /* Notebook này rỗng (chưa có Batch nào) -> thử tiếp Notebook kế/trước */
    }
    return false;
  };

  /* ══════════════ NẠP DỮ LIỆU ══════════════ */
  /* Dọn sạch nội dung khi chuyển sang chỗ chưa có gì.
     Lưu ý: PHẢI tạo 5 mảng riêng. Viết a = b = c = [] thì cả ba cùng trỏ
     vào MỘT mảng, thêm batch sẽ lòi ra ở cả sections lẫn pages. */
  function clearContent() {
    S.sections = []; S.pages = []; S.batches = []; S.blocks = []; S.words = [];
    S.sectionId = null; S.pageId = null; S.batchId = null;
    S.wp = {}; S.bp = {};
  }

  async function loadNotebook(notebookId) {
    var d = await w.DB.loadNotebook(notebookId);
    S.sections = d.sections; S.pages = d.pages;
    S.batches = d.batches; S.blocks = d.blocks; S.words = d.words;

    var sel = readSel();
    S.sectionId = pick(S.sections, sel.sectionId);
    var pgs = S.sectionId ? pagesOfSection(S.sectionId) : [];
    S.pageId = pick(pgs, sel.pageId);
    var bts = S.pageId ? batchesOfPage(S.pageId) : [];
    S.batchId = pick(bts, sel.batchId);

    await loadProgress();
  }

  function pick(list, preferId) {
    if (!list || !list.length) return null;
    var hit = list.find(function (x) { return x.id === preferId; });
    return hit ? hit.id : list[0].id;
  }

  async function loadProgress() {
    if (!w.Auth.user) { S.wp = {}; S.bp = {}; return; }
    try {
      var r = await w.DB.loadProgress(
        w.Auth.user.id,
        S.blocks.map(function (b) { return b.id; }),
        S.words.map(function (x) { return x.id; })
      );
      S.wp = r.wp; S.bp = r.bp;
    } catch (e) { S.wp = {}; S.bp = {}; }
  }

  /* ══════════════ RENDER: THANH HUB ══════════════ */
  function renderHubs() {
    w.$("#hub-tabs").innerHTML = S.hubs.map(function (h) {
      return '<span class="hub-tab' + (h.id === S.hubId ? " active" : "") +
             '" data-hub="' + h.id + '" draggable="true">' + w.esc(h.name) +
             '<button class="dots" data-menu="hubs" data-id="' + h.id + '" title="Thao tác">⋯</button>' +
             "</span>";
    }).join("");
  }

  /* ══════════════ RENDER: SIDEBAR TRÁI ══════════════ */
  function renderNotebooks() {
    var box = w.$("#notebook-list");
    if (!S.notebooks.length) {
      box.innerHTML = '<div class="nav-empty">Chưa có notebook nào</div>';
      return;
    }
    box.innerHTML = S.notebooks.map(function (n) {
      return '<div class="nav-item' + (n.id === S.notebookId ? " active" : "") + '" data-nb="' + n.id + '" draggable="true">' +
               "<span>" + w.esc(n.icon || "📓") + '</span><span class="nm">' + w.esc(n.name) + "</span>" +
               '<button class="dots" data-menu="notebooks" data-id="' + n.id + '" title="Thao tác">⋯</button>' +
             "</div>";
    }).join("");
  }

  /* Sections = hàng tab ngang trên đầu workspace, đúng kiểu OneNote */
  function renderSections() {
    var box = w.$("#section-list");
    if (!S.sections.length) {
      box.innerHTML = '<span class="nav-empty">Chưa có section — bấm dấu + bên phải</span>';
      return;
    }
    box.innerHTML = S.sections.map(function (s) {
      var n = pagesOfSection(s.id).length;
      return '<span class="section-tab' + (s.id === S.sectionId ? " active" : "") + '" data-sec="' + s.id + '" draggable="true">' +
               w.esc(s.name) + '<span class="count">' + n + "</span>" +
               '<button class="dots" data-menu="sections" data-id="' + s.id + '" title="Thao tác">⋯</button>' +
             "</span>";
    }).join("");
  }

  /* ══════════════ RENDER: SIDEBAR PHẢI (PAGES) ══════════════ */
  function renderPages() {
    var box = w.$("#page-list");
    var list = S.sectionId ? pagesOfSection(S.sectionId) : [];
    if (!list.length) {
      box.innerHTML = '<div class="nav-empty">Chưa có page nào</div>';
      return;
    }
    box.innerHTML = list.map(function (p) {
      var batches = batchesOfPage(p.id);
      var nBlocks = 0, nWords = 0;
      batches.forEach(function (bt) {
        App.blocksOf(bt.id).forEach(function (blk) { nBlocks++; nWords += App.wordsOf(blk.id).length; });
      });
      return '<div class="nav-item' + (p.id === S.pageId ? " active" : "") + '" data-page="' + p.id + '" draggable="true">' +
               '<span>📄</span><span class="nm">' + w.esc(p.name) + '</span>' +
               '<span class="count" title="' + nBlocks + ' block · ' + nWords + ' từ">' + nBlocks + " block · " + nWords + " từ</span>" +
               '<button class="dots" data-menu="pages" data-id="' + p.id + '" title="Thao tác">⋯</button>' +
             "</div>";
    }).join("");
  }

  /* ══════════════ RENDER: BREADCRUMB ══════════════ */
  /* Đường dẫn dài (tên Hub/Notebook/Section/Page/Batch cộng lại) mà vẫn
     nhét đủ cả chuỗi trên 1 hàng thì hoặc tràn màn hình hoặc phải xuống
     hàng — cả 2 đều xấu. Quá 1 ngưỡng ký tự thì chỉ hiện khúc ĐẦU (Hub)
     và khúc CUỐI (chỗ đang đứng), giữa thay bằng "…", giữ nguyên 1 hàng
     (CSS .crumb: nowrap + cuộn ngang phòng khi vẫn còn dài). */
  var CRUMB_MAX_CHARS = 46;
  function renderCrumb() {
    function nameOf(list, id, fb) {
      var x = list.find(function (r) { return r.id === id; });
      return x ? x.name : fb;
    }
    var parts = [
      nameOf(S.hubs, S.hubId, "—"), nameOf(S.notebooks, S.notebookId, "—"),
      nameOf(S.sections, S.sectionId, "—"), nameOf(S.pages, S.pageId, "—")
    ];
    if (S.batchId) parts.push(nameOf(S.batches, S.batchId, "—"));

    var totalLen = parts.reduce(function (n, s) { return n + s.length; }, 0);
    var html;
    if (parts.length > 2 && totalLen > CRUMB_MAX_CHARS) {
      html = "<b>" + w.esc(parts[0]) + "</b>" +
        '<span class="sep">›</span><span class="crumb-ellipsis" title="' + w.esc(parts.slice(1, -1).join(" › ")) + '">…</span>' +
        '<span class="sep">›</span>' + w.esc(parts[parts.length - 1]);
    } else {
      html = "<b>" + w.esc(parts[0]) + "</b>" + parts.slice(1).map(function (p) {
        return '<span class="sep">›</span>' + w.esc(p);
      }).join("");
    }
    w.$("#crumb").innerHTML = html;
  }

  /* ══════════════ RENDER: THANH BATCH ══════════════ */
  function renderBatches() {
    var list = S.pageId ? batchesOfPage(S.pageId) : [];
    /* Đang mở 1 Block để học -> chip Batch của đúng Batch chứa Block đó
       đổi hẳn sang hiện TÊN BLOCK (thay vì "Batch N (x block)") — lúc
       đang học thì biết đang ở Block nào hữu ích hơn số lượng Batch. */
    var openBlock = (w.Detail && w.Detail.blockId)
      ? S.blocks.find(function (x) { return x.id === w.Detail.blockId; }) : null;
    w.$("#batch-tabs").innerHTML = list.map(function (b) {
      var ids = App.blocksOf(b.id);
      var n = ids.length;
      /* Gọn kiểu "Batch 1 20/108" (đã đạt bài thi/tổng Block) thay vì
         "Batch 1 (6 block)" cũ — thấy ngay tiến độ từng Batch mà không
         cần bấm vào, không phải chỉ đếm số Block có trong đó. */
      var done = ids.filter(function (x) {
        var bpx = S.bp[x.id];
        return bpx && (bpx.passed || bpx.meaning_passed);
      }).length;
      var showBlockName = openBlock && openBlock.batch_id === b.id;
      var label = showBlockName
        ? "📕 " + w.esc(openBlock.name)
        : w.esc(b.name) + '<span class="n">' + done + "/" + n + "</span>";
      return '<span class="batch-tab' + (b.id === S.batchId ? " active" : "") + '" data-batch="' + b.id + '" draggable="true">' +
               label +
               '<button class="dots" data-menu="batches" data-id="' + b.id + '" title="Thao tác">⋯</button>' +
             "</span>";
    }).join("") || '<span class="nav-empty">Chưa có batch — bấm "+ Paste từ mới"</span>';
  }

  /* ══════════════ RENDER: DANH SÁCH BLOCK ══════════════ */
  App.renderBlocks = function () {
    var batch = S.batches.find(function (b) { return b.id === S.batchId; });
    var list = S.batchId ? App.blocksOf(S.batchId) : [];

    w.$("#batch-title").textContent = batch ? batch.name : "Chưa chọn Batch";

    var totalWords = 0, doneBlocks = 0;
    list.forEach(function (b) {
      totalWords += App.wordsOf(b.id).length;
      var bpx = S.bp[b.id];
      if (bpx && (bpx.passed || bpx.meaning_passed)) doneBlocks++;
    });
    w.$("#batch-sub").innerHTML =
      "<b>" + list.length + " block</b> • " + doneBlocks + "/" + list.length +
      " đã đạt bài thi • " + totalWords + " từ";

    var box = w.$("#blocks-list");
    if (!list.length) {
      /* Chỉ rõ đang thiếu tầng nào, thay vì báo chung chung "chưa có block" */
      var msg, hint;
      if (!S.notebookId) {
        msg = "Hub này chưa có Notebook nào";
        hint = "Bấm dấu <strong>+</strong> ở mục NOTEBOOKS bên trái để tạo cái đầu tiên.";
      } else if (!S.sectionId) {
        msg = "Notebook này chưa có Section nào";
        hint = "Bấm dấu <strong>+</strong> ở cuối thanh <strong>SECTIONS</strong> phía trên.";
      } else if (!S.pageId) {
        msg = "Section này chưa có Page nào";
        hint = "Bấm <strong>+ Thêm Page</strong> ở cột bên phải.";
      } else {
        msg = "Page này chưa có từ vựng nào";
        hint = "Bấm <strong>+ Paste từ mới</strong> rồi dán danh sách từ — hệ thống tự cắt thành Block " +
               (cfg.WORDS_PER_BLOCK || 10) + " từ.";
      }
      box.innerHTML = '<div class="empty-state"><b>' + msg + "</b><span>" + hint + "</span></div>";
      renderAlert();          /* vẫn phải vẽ lại, kẻo 4 ô chu kỳ giữ dữ liệu cũ */
      return;
    }

    box.innerHTML = list.map(function (b, idx) {
      var ws = App.wordsOf(b.id);
      var bp = S.bp[b.id] || {};
      var st = w.SRS.state(S.bp[b.id]);
      var mastered = ws.filter(function (x) { return S.wp[x.id] && S.wp[x.id].mastered; }).length;

      /* "Done" = 1 trong 3 thẻ bài tập (Phiếu đầy đủ/Từng câu chung 1 kết
         quả, hoặc Nghĩa riêng) đạt >= 80%, không phải chỉ học lướt qua. */
      var bestOfAny = Math.max(bp.best_score || 0, bp.meaning_best || 0);
      var badge, badgeCls;
      if (bp.passed || bp.meaning_passed) {
        badge = "✓ Done · " + bestOfAny + "%"; badgeCls = "";
      } else if (bestOfAny) {
        badge = "Chưa đạt · " + bestOfAny + "%"; badgeCls = " warn";
      } else {
        badge = "Chưa thi"; badgeCls = " pending";
      }
      var levels = {};
      ws.forEach(function (x) { if (x.level) levels[x.level] = (levels[x.level] || 0) + 1; });
      var tags = Object.keys(levels).sort().map(function (k) {
        return '<span class="tag">' + levels[k] + " " + w.esc(k) + "</span>";
      }).join("");
      if (!tags) tags = '<span class="tag">' + ws.length + " từ</span>";

      /* data-bidx: chỉ để CSS tô dải màu bên trái phân biệt Block trong
         cùng Batch (xem .block-card[data-bidx] trong app.css) — không
         liên quan gì tới trạng thái Done/Due. */
      return '<div class="block-card' + (st.due ? " due" : "") + '" data-block="' + b.id +
        '" data-bidx="' + (idx % 8) + '">' +
        '<div class="block-top">' +
          '<div class="block-left">' +
            '<span class="block-title">' + w.esc(b.name) + "</span>" + tags +
            '<button class="dots" data-menu="blocks" data-id="' + b.id + '" title="Thao tác">⋯</button>' +
            '<span class="tag-time' + (st.due ? " due" : "") + '">' +
              (st.due ? "🔴 " : "🟢 ") + w.esc(st.label) + "</span>" +
          "</div>" +
          /* Bỏ hẳn nút "Học / Ôn lại" (theo yêu cầu Thao) - bấm BẤT KỲ ĐÂU
             trên card đã mở Block rồi (xem "card" fallback trong
             #blocks-list onclick bên dưới), nút riêng chỉ dư thừa. */
          '<div class="block-right">' +
            '<div class="done-badge' + badgeCls + '">' + badge + "</div>" +
          "</div>" +
        "</div>" +
        /* Bung hết TOÀN BỘ từ trong Block (không cắt "+N từ" như trước) -
           .vocab-chips giờ cho xuống hàng (flex-wrap: wrap) thay vì cuộn
           ngang, xem đủ từ ngay trên danh sách Block, không cần mở Block
           ra mới thấy hết. */
        /* Mỗi chip có sẵn nút "×" xoá thẳng từ đó, không cần mở hẳn Block
           vào rồi tìm đúng từ trong bảng mới xoá được như trước (xem
           "data-delword" trong #blocks-list onclick bên dưới). */
        '<div class="vocab-chips">' + ws.map(function (x) {
          var ok = S.wp[x.id] && S.wp[x.id].mastered;
          return '<span class="vchip' + (ok ? " ok" : "") + '">' + w.esc(x.term) +
            '<button class="vchip-del" data-delword="' + x.id + '" title="Xoá từ khỏi kho">×</button></span>';
        }).join("") + "</div>" +
        '<div class="block-bottom">' +
          '<span class="progress-bar"><i style="width:' + w.pct(mastered, ws.length) + '%"></i></span>' +
        "</div>" +
      "</div>";
    }).join("");

    renderAlert();
  };

  /* ══════════════ RENDER: Ô CẢNH BÁO + 4 THẺ CHU KỲ ══════════════ */
  var CHIPS_PER_CARD = 12;   // nhiều hơn thì gộp lại, kẻo 62 block phủ kín màn hình

  function renderAlert() {
    var groups = { 1: [], 2: [], 3: [], 4: [] };
    var dueCount = 0, dueWords = 0, firstDue = null;
    var newCount = 0, startedCount = 0, firstNew = null;

    /* xếp theo số thứ tự Block để đọc được: Block 1, 2, 3… */
    S.blocks.slice()
      .sort(function (a, b) { return (a.global_index || 0) - (b.global_index || 0); })
      .forEach(function (b) {
        var st = w.SRS.state(S.bp[b.id]);

        /* CHƯA HỌC thì chưa vào chu kỳ nào cả — không nhét vào ô "Lần 1–2" */
        if (!st.started) {
          newCount++;
          if (!firstNew) firstNew = b;
          return;
        }

        startedCount++;
        groups[w.SRS.groupOf(st.cycle)].push({ block: b, due: st.due });
        if (st.due) {
          dueCount++;
          dueWords += App.wordsOf(b.id).length;
          if (!firstDue) firstDue = b;
        }
      });

    [1, 2, 3, 4].forEach(function (g) {
      var el = w.$("#chips-g" + g);
      var list = groups[g];
      if (!list.length) { el.innerHTML = '<span class="chips-empty">trống</span>'; return; }

      /* ưu tiên hiện những block đang đến hạn trước */
      var ordered = list.filter(function (x) { return x.due; })
                        .concat(list.filter(function (x) { return !x.due; }));
      var shown = ordered.slice(0, CHIPS_PER_CARD);
      var rest = ordered.length - shown.length;

      el.innerHTML = shown.map(function (x) {
        return '<div class="overdue-chip' + (x.due ? " due" : "") + '" data-jump="' + x.block.id + '">' +
               w.esc(x.block.name) + "</div>";
      }).join("") + (rest > 0 ? '<span class="chips-more">+' + rest + " block nữa</span>" : "");
    });

    /* nhắc rõ vì sao 4 ô đang trống */
    if (!startedCount) {
      w.$("#chips-g1").innerHTML = '<span class="chips-empty">chưa block nào vào chu kỳ</span>';
    }

    var newNote = newCount ? " · <b>" + newCount + " block</b> chưa học" : "";
    var btn = w.$("#btn-review-now");

    if (dueCount) {
      w.$("#alert-title-text").textContent = "Đến hạn ôn tập — đừng để trí nhớ rơi";
      w.$("#alert-sub").innerHTML = "<b>" + dueCount + " block</b> • " + dueWords +
        " từ đang chờ ôn theo chu kỳ suy giảm trí nhớ (Ebbinghaus)" + newNote + ".";
      btn.disabled = false;
      btn.textContent = "Ôn ngay →";
      btn.dataset.target = firstDue ? firstDue.id : "";
    } else if (startedCount) {
      w.$("#alert-title-text").textContent = "Tất cả đều đúng lịch 🎉";
      w.$("#alert-sub").innerHTML = "<b>" + startedCount + " block</b> đang trong chu kỳ, " +
        "chưa cái nào quá hạn" + newNote + ".";
      btn.disabled = !newCount;
      btn.textContent = newCount ? "Học block mới →" : "Ôn ngay →";
      btn.dataset.target = firstNew ? firstNew.id : "";
    } else {
      /* chưa có block nào Done -> chu kỳ chưa bắt đầu chạy */
      w.$("#alert-title-text").textContent = "Chu kỳ ôn tập chưa bắt đầu";
      w.$("#alert-sub").innerHTML = "Có <b>" + newCount + " block</b> chưa học. " +
        "Học xong và đạt ≥ 80% ở bài kiểm tra thì Block mới vào lịch ôn Tony Buzan.";
      btn.disabled = !newCount;
      btn.textContent = "Bắt đầu học →";
      btn.dataset.target = firstNew ? firstNew.id : "";
    }
  }

  /* ══════════════ RENDER TỔNG ══════════════ */
  /* Rời màn hình học chi tiết — gọi mỗi khi đổi Hub / Notebook / Section /
     Page / Batch. Nếu không, chuyển sang chỗ trống mà vẫn thấy bài cũ. */
  function leaveDetail() {
    if (w.Detail && w.$("#screen-detail") && !w.$("#screen-detail").hidden) w.Detail.close();
  }
  App.leaveDetail = leaveDetail;

  /* Đưa S (Hub/Notebook đang mở) về đúng Notebook chứa 1 mục nào đó, KHÔNG
     đổi màn hình hay Section/Page/Batch đang chọn bên trong Notebook đó.
     Dùng trước khi mở context-menu (App.openMenu/doAction) cho 1 dòng lấy
     từ nơi khác S (vd cây "🌳 Chi tiết" trong Journey — S chỉ giữ dữ liệu
     của Notebook ĐANG MỞ, xem quy ước ở đầu app.js) — nếu không đổi S
     trước, doAction tìm dòng trong S.sections/pages/batches/blocks sẽ ra
     "không tìm thấy" vì dòng đó thuộc Notebook khác. */
  App.ensureNotebookContext = async function (hubId, notebookId) {
    if (hubId && S.hubId !== hubId) {
      S.hubId = hubId;
      S.notebooks = await w.DB.getNotebooks(hubId);
    }
    if (notebookId && S.notebookId !== notebookId) {
      S.notebookId = notebookId;
      await loadNotebook(notebookId);
    }
  };

  /* Nhảy thẳng từ bất kỳ đâu (vd cây "🌳 Chi tiết" trong Journey) vào đúng
     chỗ đó trên màn học chính — tương đương tự bấm qua từng cấp Hub >
     Notebook > Section > Page > Batch > (mở Block nếu có). Bất kỳ cấp nào
     bỏ trống thì giữ lựa chọn mặc định (Section/Page/Batch đầu tiên) như
     lúc mới mở Notebook đó. */
  App.jumpTo = async function (opts) {
    opts = opts || {};
    w.Speech.stop();
    await App.ensureNotebookContext(opts.hubId, opts.notebookId);
    /* Nhảy tới 1 Hub mà không chỉ rõ Notebook (vd bấm "↗" ngay ở dòng Hub
       trong cây Journey) -> mở Notebook ĐẦU TIÊN của Hub đó, giống hệt
       hành vi bấm thẳng vào tab Hub ở thanh trên. Thiếu bước này thì
       S.notebookId/sections/pages/batches/blocks vẫn còn của Notebook cũ
       (có thể thuộc Hub khác) trong khi S.hubId đã đổi -> lệch dữ liệu. */
    if (opts.hubId && !opts.notebookId) {
      S.notebookId = S.notebooks.length ? S.notebooks[0].id : null;
      if (S.notebookId) await loadNotebook(S.notebookId); else clearContent();
    }
    if (opts.sectionId) {
      S.sectionId = opts.sectionId;
      var pgs = pagesOfSection(S.sectionId);
      S.pageId = opts.pageId || (pgs.length ? pgs[0].id : null);
    }
    if (opts.pageId) {
      S.pageId = opts.pageId;
      var bts = batchesOfPage(S.pageId);
      S.batchId = opts.batchId || (bts.length ? bts[0].id : null);
    }
    if (opts.batchId) S.batchId = opts.batchId;

    saveSel();
    leaveDetail();
    renderAll();
    closeDrawers();
    w.$("#screen-journey").hidden = true;
    w.$("#screen-home").hidden = true;
    w.$("#btn-learning").hidden = true;

    if (opts.blockId) w.Detail.open(opts.blockId);
  };

  /* Nút "📖 Learning" dùng chung cho cả Journey lẫn Trang chủ — đóng
     đúng màn đang mở (chỉ 1 trong 2 hiện tại 1 lúc), gán ở app.js vì tải
     SAU journey.js/home.js nên đè được handler riêng của từng file đó. */
  w.$("#btn-learning").onclick = function () {
    if (w.Home && !w.$("#screen-home").hidden) { w.Home.close(); return; }
    if (w.Journey && !w.$("#screen-journey").hidden) { w.Journey.close(); return; }
  };

  /* ══════════════ BỘ ĐẾM TỔNG SỐ TỪ (góc phải thanh trên cùng) ══════════════
     Luôn hiện, mọi màn hình — không chỉ trong Journey. Chỉ SƠN lại DOM
     (setWordCounter), việc TRUY VẤN số liệu thật (refreshWordCounter) tách
     riêng để chỗ nào đã có sẵn summary (vd journey.js) khỏi phải gọi lại. */
  App.setWordCounter = function (mastered, total) {
    var el = w.$("#word-counter");
    if (!el) return;
    el.textContent = "📚 " + (mastered || 0).toLocaleString("vi-VN") + " / " + (total || 0).toLocaleString("vi-VN");
  };
  App.refreshWordCounter = async function () {
    if (!w.Auth.user) { App.setWordCounter(0, 0); return; }
    try {
      var s = await w.DB.getJourneySummary(w.Auth.user.id);
      App.setWordCounter(s.mastered, s.totalWords);
    } catch (e) { /* offline/lỗi mạng -> giữ số cũ, không chặn app */ }
  };

  function renderAll() {
    /* chốt chặn: block đang mở mà không còn trong dữ liệu hiện tại thì đóng lại */
    if (w.Detail && w.Detail.blockId &&
        !S.blocks.some(function (b) { return b.id === w.Detail.blockId; })) {
      leaveDetail();
    }
    renderHubs(); renderNotebooks(); renderSections();
    renderPages(); renderCrumb(); renderBatches();
    App.renderBlocks();
    renderUserChip();
    if (w.Ticker && w.Ticker.refresh) w.Ticker.refresh();
  }
  App.renderAll = renderAll;
  App.renderBatches = renderBatches;

  /* ══════════════ NGƯỜI DÙNG (CHIP GÓC TRÊN) ══════════════ */
  function renderUserChip() {
    var u = w.Auth.user;
    if (!u) return;
    w.$("#user-avatar").textContent = u.emoji;
    w.$("#user-name").textContent = u.name;
    w.$("#menu-avatar").textContent = u.emoji;
    w.$("#menu-name").textContent = u.name;
    w.$("#menu-sub").textContent = u.cloud ? (u.email || "Tài khoản Cloud") : "Hồ sơ trên máy này";

    var pill = w.$("#mode-pill");
    if (w.DB.mode === "cloud") {
      pill.textContent = u.cloud ? "CLOUD" : "CLOUD · KHÁCH";
      pill.className = "mode-pill cloud";
      pill.title = u.cloud ? "Từ vựng và tiến trình đều lưu trên server"
                           : "Từ vựng lấy từ server, tiến trình còn lưu tạm trong máy — đăng nhập để đồng bộ";
    } else {
      pill.textContent = "LOCAL";
      pill.className = "mode-pill local";
      pill.title = "Dữ liệu chỉ nằm trong trình duyệt này. Cấu hình js/config.js để lên cloud.";
    }
    w.$("#mi-cloud").style.display = w.Auth.canCloud() ? "" : "none";
  }

  /* ══════════════ HỘP THOẠI NHẬP TÊN DÙNG CHUNG ══════════════ */
  function askText(opts) {
    return new Promise(function (resolve) {
      var m = w.$("#modal-prompt");
      w.$("#prompt-title").textContent = opts.title || "Nhập tên";
      w.$("#prompt-desc").textContent = opts.desc || "";
      var input = w.$("#prompt-input");
      input.value = opts.value || "";
      input.placeholder = opts.placeholder || "";

      var emojiBox = w.$("#prompt-emojis");
      var chosen = opts.emoji || null;
      if (opts.withEmoji) {
        emojiBox.hidden = false;
        emojiBox.innerHTML = w.Auth.EMOJIS.map(function (e) {
          return '<button class="emoji-pick' + (e === chosen ? " sel" : "") + '" data-e="' + e + '">' + e + "</button>";
        }).join("");
        emojiBox.onclick = function (ev) {
          var b = ev.target.closest(".emoji-pick");
          if (!b) return;
          chosen = b.dataset.e;
          w.$$(".emoji-pick", emojiBox).forEach(function (x) { x.classList.toggle("sel", x === b); });
        };
      } else {
        emojiBox.hidden = true;
      }

      m.hidden = false;
      setTimeout(function () { input.focus(); input.select(); }, 40);

      function done(val) {
        m.hidden = true;
        w.$("#prompt-ok").onclick = null;
        input.onkeydown = null;
        resolve(val);
      }
      w.$("#prompt-ok").onclick = function () {
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        done({ text: v, emoji: chosen });
      };
      input.onkeydown = function (e) { if (e.key === "Enter") w.$("#prompt-ok").click(); };
      m.querySelector('[data-close]').onclick = function () { done(null); };
    });
  }

  /* ══════════════ MODAL NGƯỜI HỌC ══════════════ */
  function renderUserList() {
    var cur = w.Auth.user;
    w.$("#user-list").innerHTML = w.Auth.listLocal().map(function (u) {
      return '<div class="user-row' + (cur && u.id === cur.id ? " active" : "") + '" data-uid="' + u.id + '">' +
               '<span class="avatar">' + u.emoji + "</span><span>" + w.esc(u.name) + "</span>" +
               '<button class="del" data-del="' + u.id + '" title="Xoá">✕</button>' +
             "</div>";
    }).join("");
  }

  async function switchUser(id) {
    w.Auth.switchTo(id);
    await loadProgress();
    renderAll();
    w.$("#modal-user").hidden = true;
    w.toast("Đang học với hồ sơ: " + w.Auth.user.name, "ok");
  }

  /* ══════════════ PASTE TỪ MỚI ══════════════ */
  function nextGlobalIndex() {
    var mx = 0;
    S.blocks.forEach(function (b) { mx = Math.max(mx, b.global_index || 0); });
    return mx + 1;
  }

  async function doPaste() {
    if (!S.pageId) { w.toast("Hãy tạo/chọn một Page trước", "err"); return; }
    var parsed = w.parseVocabText(w.$("#paste-input").value);
    if (!parsed.length) { w.toast("Không đọc được từ nào", "err"); return; }

    var btn = w.$("#btn-do-paste");
    btn.disabled = true; btn.textContent = "Đang tạo…";

    try {
      /* Dán chỉ có term (hoặc thiếu vài cột) mà có sẵn key AI -> tự tra từ
         điển AI điền nốt level/pos/ipa/def_en/meaning_vi còn thiếu, không
         đụng tới cột nào đã có sẵn dữ liệu. Không có key thì bỏ qua bước
         này, tạo Block như cũ (để trống cột thiếu, không chặn ai cả). */
      var cfg2 = w.APP_CONFIG || {};
      if (cfg2.GEMINI_API_KEY || cfg2.OPENAI_API_KEY) {
        var needy = parsed.filter(function (x) {
          return !x.level || !x.pos || !x.ipa || !x.def_en || !x.meaning_vi;
        });
        if (needy.length) {
          btn.textContent = "⏳ Đang tra từ điển AI...";
          try {
            var r = await w.Context.enrichWords(parsed, cfg2);
            if (r.filled) w.toast("AI đã tự điền " + r.filled + " ô còn thiếu", "ok");
          } catch (e) {
            console.warn("enrichWords thất bại, vẫn tạo Block với dữ liệu đang có:", e);
          }
          btn.textContent = "Đang tạo…";
        }
      }

      var name = "Batch " + (batchesOfPage(S.pageId).length + 1);
      var res = await w.DB.addBatchFromWords(S.pageId, parsed, name, nextGlobalIndex());

      S.batches.push(res.batch);
      S.blocks = S.blocks.concat(res.blocks);
      S.words = S.words.concat(res.words);
      S.batchId = res.batch.id;
      saveSel();

      w.$("#modal-paste").hidden = true;
      w.$("#paste-input").value = "";
      w.$("#paste-preview").innerHTML = "";
      renderBatches(); renderPages(); App.renderBlocks();
      w.toast("Đã tạo " + res.blocks.length + " block từ " + parsed.length + " từ ✔", "ok");
    } catch (e) {
      w.toast("Lỗi: " + (e.message || e), "err");
    } finally {
      btn.disabled = false; btn.textContent = "Tạo Batch & Block";
    }
  }

  /* ══════════════ DÁN BÀI CÓ SẴN -> AI TỰ TRÍCH TỪ B1+ ══════════════
     Khác "+ Paste từ mới": ở đây người dùng dán CẢ MỘT BÀI (báo/transcript),
     không tự gõ sẵn danh sách từ | nghĩa. AI đọc bài, tự chấm cấp độ từng
     từ, chỉ giữ B1 trở lên, rồi mới cắt Block 10 từ như bình thường. Bài
     đọc của Block không sinh mới — dùng ĐÚNG bài người dùng vừa dán, chỉ
     đánh dấu đúng 10 từ thuộc Block đó (Block khác trong cùng lần dán vẫn
     thấy nguyên bài, chỉ khác từ nào được tô). */
  async function doPasteExtract() {
    if (!S.pageId) { w.toast("Hãy tạo/chọn một Page trước", "err"); return; }
    var cfg2 = w.APP_CONFIG || {};
    if (!cfg2.GEMINI_API_KEY && !cfg2.OPENAI_API_KEY) {
      w.toast("Cần key Gemini/OpenAI trong js/keys.local.js để dùng tính năng này", "err");
      return;
    }
    var rawInput = w.$("#extract-input").value;
    if (!rawInput.trim()) { w.toast("Chưa dán bài nào", "err"); return; }

    var btn = w.$("#btn-do-extract");
    btn.disabled = true; btn.textContent = "⏳ Đang phân tích...";

    try {
      var extracted = await w.Context.extractVocab(rawInput, cfg2);
      var cleanText = w.Context.stripPasteNoise(rawInput);

      var parsedWords = extracted.map(function (x) {
        return { term: x.term, level: x.level || "", pos: x.pos || "", ipa: x.ipa || "", def_en: x.def_en || "", meaning_vi: x.meaning_vi || "" };
      });
      var name = w.$("#extract-name").value.trim() || ("Batch " + (batchesOfPage(S.pageId).length + 1));
      var res = await w.DB.addBatchFromWords(S.pageId, parsedWords, name, nextGlobalIndex());

      /* mỗi Block dùng lại CHÍNH bài đã dán, chỉ đánh dấu đúng từ của nó */
      var viByTerm = {};
      extracted.forEach(function (x) { if (x.sentence_vi) viByTerm[x.term.toLowerCase()] = x.sentence_vi; });

      for (var i = 0; i < res.blocks.length; i++) {
        var blk = res.blocks[i];
        var terms = res.words.filter(function (x) { return x.block_id === blk.id; })
                              .map(function (x) { return x.term; });
        var marked = w.Context._markTerms(cleanText, terms);
        var viMap = {};
        terms.forEach(function (t) {
          var hit = viByTerm[t.toLowerCase()];
          if (hit) viMap[t.toLowerCase()] = hit;
        });
        var meta = {
          ai: true, vi: viMap, title: name,
          source: "Bài đọc do bạn dán vào — AI trích " + terms.length + " từ B1+ trong đó."
        };
        var storable = marked + w.Context.META_SEP + JSON.stringify(meta);
        blk.context_passage = storable;
        try { await w.DB.saveContext(blk.id, storable); } catch (e) { /* offline vẫn hiển thị được */ }
      }

      S.batches.push(res.batch);
      S.blocks = S.blocks.concat(res.blocks);
      S.words = S.words.concat(res.words);
      S.batchId = res.batch.id;
      saveSel();

      w.$("#modal-extract").hidden = true;
      w.$("#extract-input").value = "";
      w.$("#extract-name").value = "";
      renderBatches(); renderPages(); App.renderBlocks();
      w.toast("Đã trích " + parsedWords.length + " từ B1+ → " + res.blocks.length + " block ✔", "ok");
    } catch (e) {
      w.toast("Lỗi: " + (e.message || e), "err");
    } finally {
      btn.disabled = false; btn.textContent = "✨ Trích từ vựng & tạo Block";
    }
  }

  /* ══════════════ "THỬ TẢI TỪ LINK" — best effort, không đảm bảo ══════════════
     Đa số trang báo CHẶN fetch() từ web khác (CORS) — cái này chỉ thành
     công với số ít trang tình cờ mở cổng đọc công khai. Thất bại thì báo
     rõ ràng, không âm thầm im lặng, và luôn có đường lùi: dán tay. */
  async function tryFetchArticle(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error("Trang trả về lỗi HTTP " + res.status);
    var html = await res.text();
    var doc = new DOMParser().parseFromString(html, "text/html");

    ["script", "style", "nav", "header", "footer", "aside", "form", "noscript", "iframe", "svg"]
      .forEach(function (tag) {
        doc.querySelectorAll(tag).forEach(function (el) { el.remove(); });
      });

    var ps = Array.prototype.slice.call(doc.querySelectorAll("p"))
      .filter(function (p) { return p.textContent.trim().length >= 40; });
    if (!ps.length) throw new Error("Tải được trang nhưng không thấy đoạn văn nào đủ dài để coi là nội dung chính");

    /* Gom các <p> theo cha gần nhất; cha nào có TỔNG chữ nhiều nhất coi
       là khối nội dung chính — cách làm đơn giản kiểu Readability, không
       cần thư viện ngoài. */
    var groups = new Map();
    ps.forEach(function (p) {
      var parent = p.parentElement;
      if (!parent) return;
      var g = groups.get(parent) || { total: 0, ps: [] };
      g.total += p.textContent.trim().length;
      g.ps.push(p);
      groups.set(parent, g);
    });
    var best = null;
    groups.forEach(function (g) { if (!best || g.total > best.total) best = g; });
    if (!best) throw new Error("Không tách được nội dung chính trên trang này");

    return best.ps.map(function (p) { return p.textContent.trim(); }).filter(Boolean).join("\n\n");
  }

  /* ══════════════ DỌN TỪ VỰNG RÁC (DÒNG TIÊU ĐỀ LẪN VÀO) ══════════════
     Thư viện gốc có nhiều chỗ bị lẫn dòng tiêu đề bảng (vd "Vocabulary",
     "Thuật ngữ"...) vào làm 1 từ vựng thật — lỗi từ lúc biên soạn dữ liệu,
     không phải do app tạo ra. File data/starter.json đã được dọn, nhưng
     dữ liệu ĐÃ NHẬP vào máy (localStorage) không tự dọn theo khi "cập
     nhật thư viện" (cơ chế merge giữ nguyên id không có trong bản mới,
     coi là "của người dùng tự thêm"), nên cần dọn thẳng ở đây. */
  var JUNK_TERMS = {
    "vocabulary": 1, "term": 1, "thuật ngữ": 1, "phiên âm": 1, "ipa": 1,
    "định nghĩa": 1, "định nghĩa (anh)": 1, "nghĩa": 1, "loại từ": 1,
    "pos": 1, "level": 1, "cấp độ": 1, "word form": 1, "phonetic": 1,
    "english definition": 1, "vietnamese meaning": 1
  };

  async function cleanupJunkWords() {
    var junk = S.words.filter(function (x) {
      return JUNK_TERMS[String(x.term || "").trim().toLowerCase()];
    });
    if (!junk.length) { w.toast("Không có dòng rác nào cần dọn ✔", "ok"); return; }

    var ok = await App.askConfirm({
      title: "Dọn " + junk.length + " dòng rác",
      desc: "Tìm thấy " + junk.length + " từ vựng trông như dòng tiêu đề bị lẫn vào (ví dụ \"Vocabulary\", " +
            "\"Thuật ngữ\"...), không phải từ thật. Xoá hết những dòng này? Không ảnh hưởng các từ khác."
    });
    if (!ok) return;

    var failed = 0;
    for (var i = 0; i < junk.length; i++) {
      try { await w.DB.remove("words", junk[i].id); }
      catch (e) { failed++; }
    }
    var junkIds = {};
    junk.forEach(function (x) { junkIds[x.id] = 1; });
    S.words = S.words.filter(function (x) { return !junkIds[x.id]; });

    App.renderBlocks();
    w.toast(failed
      ? "Đã dọn " + (junk.length - failed) + "/" + junk.length + " dòng rác (" + failed + " lỗi)"
      : "Đã dọn " + junk.length + " dòng rác ✔", failed ? "err" : "ok");
  }

  function previewPaste() {
    var parsed = w.parseVocabText(w.$("#paste-input").value);
    var per = cfg.WORDS_PER_BLOCK || 10;
    var nb = Math.ceil(parsed.length / per);
    w.$("#paste-preview").innerHTML = parsed.length
      ? "Đọc được <b>" + parsed.length + "</b> từ → sẽ tạo <b>" + nb + "</b> block (" + per + " từ/block)."
      : "";
  }

  /* ══════════════ QUẢN LÝ: ĐỔI TÊN · XOÁ · LÊN/XUỐNG · CHUYỂN SECTION ══════════════
     Bấm chuột phải, hoặc bấm nút ⋯, vào bất kỳ Notebook / Section / Page / Batch
     là hiện bảng thao tác. Xoá thì hỏi lại một lần vì kéo theo cả nhánh con. */
  var MENU = {
    hubs:      { label: "Hub",      listOf: function () { return S.hubs; },      parent: null },
    notebooks: { label: "Notebook", listOf: function () { return S.notebooks; }, parent: "hub_id" },
    sections:  { label: "Section",  listOf: function () { return S.sections; },  parent: "notebook_id" },
    pages:     { label: "Page",     listOf: function () { return pagesOfSection(S.sectionId); }, parent: "section_id" },
    batches:   { label: "Batch",    listOf: function () { return batchesOfPage(S.pageId); },     parent: "page_id" },
    blocks:    { label: "Block",    listOf: function () { return App.blocksOf(S.batchId); },     parent: "batch_id" }
  };

  function rowOf(table, id) {
    return (S[table] || []).find(function (r) { return r.id === id; });
  }

  /* Đếm xem xoá cái này thì mất theo bao nhiêu thứ bên dưới */
  function childCount(table, id) {
    if (table === "notebooks") {
      var secs = S.sections.filter(function (s) { return s.notebook_id === id; });
      var pgs = S.pages.filter(function (p) { return secs.some(function (s) { return s.id === p.section_id; }); });
      return secs.length + " section · " + pgs.length + " page";
    }
    if (table === "sections") {
      var pg = pagesOfSection(id);
      var bt = S.batches.filter(function (b) { return pg.some(function (p) { return p.id === b.page_id; }); });
      return pg.length + " page · " + bt.length + " batch";
    }
    if (table === "pages") {
      var b2 = batchesOfPage(id);
      var bl = S.blocks.filter(function (x) { return b2.some(function (b) { return b.id === x.batch_id; }); });
      return b2.length + " batch · " + bl.length + " block";
    }
    if (table === "batches") {
      var bl2 = App.blocksOf(id);
      var wn = S.words.filter(function (x) { return bl2.some(function (b) { return b.id === x.block_id; }); });
      return bl2.length + " block · " + wn.length + " từ";
    }
    if (table === "blocks") return App.wordsOf(id).length + " từ";
    return "";
  }

  App.openMenu = function (table, id, anchor) {
    var meta = MENU[table];
    if (!meta) return;
    var row = rowOf(table, id);
    if (!row) return;

    var list = meta.listOf();
    var pos = list.findIndex(function (r) { return r.id === id; });

    var items = [
      { act: "rename", icon: "✏️", text: "Đổi tên" },
      { act: "up", icon: "⬆️", text: "Chuyển lên", off: pos <= 0 },
      { act: "down", icon: "⬇️", text: "Chuyển xuống", off: pos < 0 || pos >= list.length - 1 },
      { act: "top", icon: "⏫", text: "Lên đầu", off: pos <= 0 },
      { act: "bottom", icon: "⏬", text: "Xuống cuối", off: pos < 0 || pos >= list.length - 1 }
    ];
    /* Notebook chuyển Hub · Section chuyển Notebook · Page chuyển Section · Batch chuyển Page */
    if (table === "notebooks" && S.hubs.length > 1) items.push({ act: "move", icon: "📦", text: "Chuyển sang Hub khác" });
    if (table === "sections" && S.notebooks.length > 1) items.push({ act: "move", icon: "📦", text: "Chuyển sang Notebook khác" });
    if (table === "pages" && S.sections.length > 1) items.push({ act: "move", icon: "📦", text: "Chuyển sang Section khác" });
    if (table === "batches" && S.pages.length > 1) items.push({ act: "move", icon: "📦", text: "Chuyển sang Page khác" });
    if (table === "pages") items.push({ act: "duplicate", icon: "📋", text: "Nhân bản Page" });
    /* Gộp hàng loạt: đứng ở 1 Hub, gom hết Notebook từ MỌI Hub khác về đây */
    if (table === "hubs" && S.hubs.length > 1) items.push({ act: "consolidate", icon: "📦", text: "Gộp tất cả Notebook về đây" });
    items.push({ act: "sep" });
    items.push({ act: "reset", icon: "🔄", text: "Xoá tiến trình học" });
    items.push({ act: "sep" });
    items.push({ act: "del", icon: "🗑", text: "Xoá " + meta.label, danger: true });

    var box = w.$("#ctx-menu");
    box.innerHTML =
      '<div class="ctx-head">' + w.esc(row.name) + "</div>" +
      items.map(function (it) {
        if (it.act === "sep") return '<div class="ctx-sep"></div>';
        return '<button class="ctx-item' + (it.danger ? " danger" : "") + '"' +
               (it.off ? " disabled" : "") + ' data-act="' + it.act + '">' +
               "<span>" + it.icon + "</span><span>" + it.text + "</span></button>";
      }).join("");

    var r = anchor.getBoundingClientRect();
    box.hidden = false;
    var top = Math.min(r.bottom + 4, window.innerHeight - box.offsetHeight - 8);
    var left = Math.min(r.left, window.innerWidth - box.offsetWidth - 8);
    box.style.top = Math.max(8, top) + "px";
    box.style.left = Math.max(8, left) + "px";

    w.$$(".ctx-item", box).forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        closeMenu();
        App.doAction(table, id, b.dataset.act);
      };
    });
  };

  function closeMenu() {
    var m = w.$("#ctx-menu");
    if (m) m.hidden = true;
  }
  App.closeMenu = closeMenu;

  App.doAction = async function (table, id, act) {
    var meta = MENU[table];
    var row = rowOf(table, id);
    if (!row) return;

    try {
      if (act === "rename") {
        /* Notebook có icon riêng (con fox 🦊, quyển sách 📓...) — cho đổi
           luôn icon lúc đổi tên, y như lúc tạo mới, kẻo chỉ có tạo mới
           mới chọn được icon còn đổi tên thì thôi. */
        var withIcon = table === "notebooks";
        var r = await askText({
          title: "✏️ Đổi tên " + meta.label, value: row.name, placeholder: "Tên mới",
          withEmoji: withIcon, emoji: withIcon ? (row.icon || "📓") : undefined
        });
        if (!r) return;
        row.name = r.text;
        await w.DB.rename(table, id, r.text);
        if (withIcon && r.emoji && r.emoji !== row.icon) {
          row.icon = r.emoji;
          await w.DB.patch(table, id, { icon: r.emoji });
        }
        w.toast("Đã đổi tên", "ok");
      }

      else if (act === "up" || act === "down" || act === "top" || act === "bottom") {
        var list = meta.listOf();
        var i = list.findIndex(function (x) { return x.id === id; });
        if (i < 0) return;
        var j = act === "up" ? i - 1 : act === "down" ? i + 1
              : act === "top" ? 0 : list.length - 1;
        if (j < 0 || j >= list.length) return;
        var arr = reordered(list, id, act === "down" || act === "bottom" ? j + 1 : j);
        if (arr) await App.renumber(table, arr);
      }

      else if (act === "move") {
        var opts, field;
        if (table === "notebooks") {
          opts = S.hubs.filter(function (h) { return h.id !== row.hub_id; });
          field = "hub_id";
        } else if (table === "sections") {
          opts = S.notebooks.filter(function (n) { return n.id !== row.notebook_id; });
          field = "notebook_id";
        } else if (table === "pages") {
          opts = S.sections.filter(function (s) { return s.id !== row.section_id; });
          field = "section_id";
        } else {
          opts = S.pages.filter(function (p) { return p.id !== row.page_id; });
          field = "page_id";
        }
        if (!opts.length) { w.toast("Không có chỗ nào khác để chuyển", "err"); return; }
        var pickTo = await askPick({
          title: "📦 Chuyển " + meta.label + ' "' + row.name + '" đi đâu?',
          options: opts.map(function (o) { return { id: o.id, name: o.name }; })
        });
        if (!pickTo) return;
        row[field] = pickTo;
        await w.DB.patch(table, id, (function () { var o = {}; o[field] = pickTo; return o; })());
        /* Nói rõ TÊN nơi vừa chuyển tới — trước đây chỉ báo "sang Notebook
           mới" chung chung, khiến người dùng tưởng dữ liệu biến mất khi
           không thấy nó ở chỗ cũ nữa (nó chỉ chuyển hub/section/page khác,
           đang đứng nhầm tab nên không thấy). */
        var destRow = opts.find(function (o) { return o.id === pickTo; });
        w.toast('Đã chuyển "' + row.name + '" sang ' + (destRow ? '"' + destRow.name + '"' : "chỗ mới") +
                " — bấm qua đó để xem lại nhé", "ok");
      }

      else if (act === "consolidate") {
        var otherHubs = S.hubs.filter(function (h) { return h.id !== id; });
        var toMove = [];
        for (var oi = 0; oi < otherHubs.length; oi++) {
          var nbs = await w.DB.getNotebooks(otherHubs[oi].id);
          toMove = toMove.concat(nbs);
        }
        if (!toMove.length) { w.toast("Không có Notebook nào ở Hub khác để gộp", "err"); return; }

        var okC = await askConfirm({
          title: "📦 Gộp " + toMove.length + ' Notebook về "' + row.name + '"?',
          desc: "Sẽ chuyển toàn bộ " + toMove.length + ' Notebook đang nằm ở các Hub khác về "' +
                row.name + '". Không mất dữ liệu, chỉ đổi Hub — có thể chuyển lại từng cái sau nếu cần.'
        });
        if (!okC) return;

        for (var ti = 0; ti < toMove.length; ti++) {
          await w.DB.patch("notebooks", toMove[ti].id, { hub_id: id });
        }
        w.toast('Đã gộp ' + toMove.length + ' Notebook về "' + row.name + '"', "ok");
      }

      else if (act === "duplicate") {
        w.toast("Đang nhân bản Page…");
        var newPage = await w.DB.duplicatePage(id);
        S.pageId = newPage.id;   /* loadNotebook() bên trong reloadCurrent() sẽ nạp lại S.pages đầy đủ, chỉ cần chốt trước pageId muốn đứng lại */
        saveSel();
        await App.reloadCurrent();
        w.toast('Đã tạo "' + newPage.name + '" — bản sao đầy đủ Batch/Block/Từ vựng', "ok");
      }

      else if (act === "reset") {
        var ids = App.scopeIds(table, id);
        var okR = await askConfirm({
          title: "🔄 Xoá tiến trình học?",
          desc: 'Toàn bộ điểm bài kiểm tra, chu kỳ ôn và mức độ thuộc trong "' + row.name +
                '" (' + ids.blocks.length + " block · " + ids.words.length +
                " từ) sẽ về 0. Từ vựng vẫn giữ nguyên, chỉ xoá tiến trình."
        });
        if (!okR) return;
        await w.DB.resetProgress(w.Auth.user.id, ids.blocks, ids.words);
        ids.blocks.forEach(function (b) { delete S.bp[b]; });
        ids.words.forEach(function (x) { delete S.wp[x]; });
        w.toast("Đã xoá tiến trình — học lại từ đầu được rồi", "ok");
      }

      else if (act === "del") {
        var kids = childCount(table, id);
        var okDel = await askConfirm({
          title: "🗑 Xoá " + meta.label + '?',
          desc: '"' + row.name + '"' + (kids ? " sẽ mất theo " + kids + "." : "") +
                " Thao tác này không hoàn tác được."
        });
        if (!okDel) return;
        await w.DB.remove(table, id);
        removeLocal(table, id);
        w.toast("Đã xoá " + meta.label, "ok");
      }
    } catch (e) {
      w.toast("Lỗi: " + (e.message || e), "err");
      return;
    }

    await App.reloadCurrent();
  };

  /* Gom tất cả block & word nằm dưới một mục — dùng cho "xoá tiến trình học".
     table = "hub" | "notebooks" | "sections" | "pages" | "batches" | "blocks" */
  App.scopeIds = function (table, id) {
    var blocks;
    if (table === "blocks") blocks = S.blocks.filter(function (b) { return b.id === id; });
    else if (table === "batches") blocks = App.blocksOf(id);
    else if (table === "pages") {
      var bt = batchesOfPage(id);
      blocks = S.blocks.filter(function (b) { return bt.some(function (x) { return x.id === b.batch_id; }); });
    } else if (table === "sections") {
      var pg = pagesOfSection(id);
      var bt2 = S.batches.filter(function (b) { return pg.some(function (p) { return p.id === b.page_id; }); });
      blocks = S.blocks.filter(function (b) { return bt2.some(function (x) { return x.id === b.batch_id; }); });
    } else {
      /* notebooks hoặc hub -> mọi thứ đang nạp trong notebook hiện tại */
      blocks = S.blocks.slice();
    }
    var bIds = blocks.map(function (b) { return b.id; });
    var wIds = S.words.filter(function (x) { return bIds.indexOf(x.block_id) >= 0; })
                      .map(function (x) { return x.id; });
    return { blocks: bIds, words: wIds };
  };

  /* dọn khỏi bộ nhớ cả nhánh con, khỏi phải chờ tải lại */
  function removeLocal(table, id) {
    if (table === "notebooks") {
      S.notebooks = S.notebooks.filter(function (r) { return r.id !== id; });
      if (S.notebookId === id) S.notebookId = S.notebooks.length ? S.notebooks[0].id : null;
    } else if (table === "sections") {
      S.sections = S.sections.filter(function (r) { return r.id !== id; });
      if (S.sectionId === id) S.sectionId = S.sections.length ? S.sections[0].id : null;
    } else if (table === "pages") {
      S.pages = S.pages.filter(function (r) { return r.id !== id; });
      if (S.pageId === id) S.pageId = null;
    } else if (table === "batches") {
      S.batches = S.batches.filter(function (r) { return r.id !== id; });
      if (S.batchId === id) S.batchId = null;
    } else if (table === "blocks") {
      S.blocks = S.blocks.filter(function (r) { return r.id !== id; });
    }
  }

  /* ---------- hộp chọn 1 trong nhiều ---------- */
  function askPick(opts) {
    return new Promise(function (resolve) {
      var m = w.$("#modal-pick");
      w.$("#pick-title").textContent = opts.title || "Chọn";
      w.$("#pick-select").innerHTML = opts.options.map(function (o) {
        return '<option value="' + w.esc(o.id) + '">' + w.esc(o.name) + "</option>";
      }).join("");
      m.hidden = false;
      function done(v) { m.hidden = true; resolve(v); }
      w.$("#pick-ok").onclick = function () { done(w.$("#pick-select").value || null); };
      m.querySelector("[data-close]").onclick = function () { done(null); };
    });
  }

  /* ---------- hộp xác nhận ---------- */
  function askConfirm(opts) {
    return new Promise(function (resolve) {
      var m = w.$("#modal-confirm");
      w.$("#confirm-title").textContent = opts.title || "Xác nhận";
      w.$("#confirm-desc").textContent = opts.desc || "";
      m.hidden = false;
      function done(v) { m.hidden = true; resolve(v); }
      w.$("#confirm-ok").onclick = function () { done(true); };
      m.querySelector("[data-close]").onclick = function () { done(false); };
    });
  }
  App.askConfirm = askConfirm;   /* export.js cũng cần dùng hộp xác nhận này */

  /* ══════════════ ĐÁNH LẠI SỐ THỨ TỰ ══════════════
     Đổi chỗ hai giá trị `sort` chỉ đúng khi mọi mục đều có sort riêng biệt.
     Dữ liệu thật hay có sort trùng (cùng =0, hoặc sinh từ Date.now()), lúc đó
     "chuyển xuống" trông như không nhúc nhích. Nên sau mỗi lần đổi chỗ, ta
     đánh lại số 1..N cho cả danh sách — luôn đúng, không phụ thuộc dữ liệu cũ. */
  App.renumber = async function (table, ordered) {
    for (var i = 0; i < ordered.length; i++) {
      var want = i + 1;
      if (ordered[i].sort !== want) {
        ordered[i].sort = want;
        try { await w.DB.patch(table, ordered[i].id, { sort: want }); } catch (e) {}
      }
    }
  };

  /* Bỏ mục `id` ra rồi chèn lại vào vị trí `to` */
  function reordered(list, id, to) {
    var arr = list.slice();
    var from = arr.findIndex(function (x) { return x.id === id; });
    if (from < 0) return null;
    var item = arr.splice(from, 1)[0];
    if (to > from) to--;
    arr.splice(Math.max(0, Math.min(to, arr.length)), 0, item);
    return arr;
  }

  /* ══════════════ KÉO THẢ ══════════════
     · Kéo lên/xuống trong cùng danh sách  -> đổi thứ tự
     · Kéo Notebook thả lên tab Hub        -> chuyển sang Hub khác
     · Kéo Page thả lên tab Section        -> chuyển sang Section khác
     · Kéo Batch thả lên một Page          -> chuyển sang Page khác          */
  var DRAG = null;

  function metaOf(el) {
    if (!el || !el.dataset) return null;
    if (el.dataset.hub)   return { table: "hubs",      id: el.dataset.hub };
    if (el.dataset.nb)    return { table: "notebooks", id: el.dataset.nb };
    if (el.dataset.sec)   return { table: "sections",  id: el.dataset.sec };
    if (el.dataset.page)  return { table: "pages",     id: el.dataset.page };
    if (el.dataset.batch) return { table: "batches",   id: el.dataset.batch };
    return null;
  }

  function listFor(table) {
    if (table === "hubs") return S.hubs;
    if (table === "notebooks") return S.notebooks;
    if (table === "sections") return S.sections;
    if (table === "pages") return pagesOfSection(S.sectionId);
    if (table === "batches") return batchesOfPage(S.pageId);
    return [];
  }

  /* Cặp (kéo cái gì, thả lên cái gì) nào là "chuyển chỗ" */
  var MOVE_PAIRS = {
    "notebooks>hubs": "hub_id",
    "sections>notebooks": "notebook_id",
    "pages>sections": "section_id",
    "batches>pages": "page_id"
  };

  function dropInfo(node) {
    var el = node && node.closest
      ? node.closest("[data-hub],[data-nb],[data-sec],[data-page],[data-batch]") : null;
    if (!el || !DRAG) return null;
    var m = metaOf(el);
    if (!m) return null;
    if (m.table === DRAG.table) {
      if (m.id === DRAG.id) return null;
      return { el: el, kind: "reorder", table: m.table, id: m.id };
    }
    var field = MOVE_PAIRS[DRAG.table + ">" + m.table];
    if (field) return { el: el, kind: "move", table: m.table, id: m.id, field: field };
    return null;
  }

  function clearDragMarks() {
    w.$$(".dragging").forEach(function (x) { x.classList.remove("dragging"); });
    w.$$(".drag-over").forEach(function (x) { x.classList.remove("drag-over"); });
  }

  App.bindDrag = function () {
    document.addEventListener("dragstart", function (e) {
      var el = e.target.closest("[data-hub],[data-nb],[data-sec],[data-page],[data-batch]");
      if (!el) return;
      DRAG = metaOf(el);
      if (!DRAG) return;
      el.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", DRAG.id); } catch (err) {}
      }
    });

    document.addEventListener("dragend", function () { clearDragMarks(); DRAG = null; });

    document.addEventListener("dragover", function (e) {
      var t = dropInfo(e.target);
      if (!t) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      w.$$(".drag-over").forEach(function (x) { x.classList.remove("drag-over"); });
      t.el.classList.add("drag-over");
    });

    document.addEventListener("drop", function (e) {
      var t = dropInfo(e.target);
      if (!t) return;
      e.preventDefault();
      var d = DRAG;
      clearDragMarks();
      DRAG = null;
      App.applyDrop(d, t);
    });
  };

  App.applyDrop = async function (drag, target) {
    try {
      if (target.kind === "reorder") {
        var list = listFor(drag.table);
        var to = list.findIndex(function (x) { return x.id === target.id; });
        var arr = reordered(list, drag.id, to);
        if (!arr) return;
        await App.renumber(drag.table, arr);
      } else {
        var row = (S[drag.table] || []).find(function (x) { return x.id === drag.id; });
        if (!row) return;
        if (row[target.field] === target.id) return;
        row[target.field] = target.id;
        var patch = {}; patch[target.field] = target.id;
        await w.DB.patch(drag.table, drag.id, patch);
        w.toast("Đã chuyển sang chỗ mới", "ok");
      }
    } catch (e) {
      w.toast("Không chuyển được: " + (e.message || e), "err");
      return;
    }
    await App.reloadCurrent();
  };

  /* Nạp lại notebook đang mở rồi vẽ lại — dùng chung sau mọi thao tác quản lý */
  App.reloadCurrent = async function () {
    S.hubs = await w.DB.getHubs();
    if (!S.hubs.some(function (h) { return h.id === S.hubId; })) {
      S.hubId = S.hubs.length ? S.hubs[0].id : null;
    }
    S.notebooks = S.hubId ? await w.DB.getNotebooks(S.hubId) : [];
    if (!S.notebooks.some(function (n) { return n.id === S.notebookId; })) {
      S.notebookId = S.notebooks.length ? S.notebooks[0].id : null;
    }
    if (S.notebookId) await loadNotebook(S.notebookId);
    else clearContent();
    saveSel();
    renderAll();
  };

  /* ══════════════ ĐỔI GIAO DIỆN SÁNG / TỐI ══════════════
     Toàn bộ màu đi qua biến CSS, nên đổi giao diện chỉ là gắn/gỡ
     thuộc tính data-theme trên thẻ <html>. Nhớ lựa chọn trong máy. */
  var LS_THEME = "tjwl_theme_v1";

  function applyTheme(name) {
    var light = name === "light";
    if (light) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");

    var btn = w.$("#theme-btn");
    if (btn) {
      btn.textContent = light ? "☀️" : "🌙";
      btn.title = light ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng";
    }
    /* màu thanh trạng thái của trình duyệt điện thoại theo luôn */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#f4f1ec" : "#0f1115");
  }

  App.theme = function () {
    try { return localStorage.getItem(LS_THEME) || "dark"; } catch (e) { return "dark"; }
  };

  App.setTheme = function (name) {
    try { localStorage.setItem(LS_THEME, name); } catch (e) {}
    applyTheme(name);
  };

  App.toggleTheme = function () {
    App.setTheme(App.theme() === "light" ? "dark" : "light");
  };

  /* ══════════════ GHIM / BỎ GHIM CỘT (kiểu OneNote) ══════════════
     Ghim  = cột nằm cố định trong bố cục.
     Bỏ ghim = cột thu lại; bấm vào tên cột thì nó trượt ra đè lên nội dung,
               bấm ra ngoài là cất đi. Giống "Pin Notebook Pane to side".   */
  var LS_PIN = "tjwl_pins_v1";

  function readPins() {
    try { return JSON.parse(localStorage.getItem(LS_PIN)) || { left: true, right: true }; }
    catch (e) { return { left: true, right: true }; }
  }
  var pins = readPins();

  function applyPins() {
    [["left", "#sidebar-left", "#pin-left"], ["right", "#sidebar-right", "#pin-right"]]
      .forEach(function (t) {
        var on = pins[t[0]] !== false;
        var bar = w.$(t[1]), btn = w.$(t[2]);
        bar.classList.toggle("unpinned", !on);
        if (!on) bar.classList.remove("flyout");
        btn.classList.toggle("off", !on);
        btn.textContent = on ? "📌" : "📍";
        btn.title = on ? "Bỏ ghim cột này" : "Ghim cột này lại";
      });
    /* cột thu lại thì nhường chỗ cho hàng tab Sections rộng ra */
    var bar = document.querySelector(".section-bar");
    bar.classList.toggle("left-off", pins.left === false);
    bar.classList.toggle("right-off", pins.right === false);
  }

  function togglePin(side) {
    pins[side] = pins[side] === false;
    try { localStorage.setItem(LS_PIN, JSON.stringify(pins)); } catch (e) {}
    applyPins();
  }

  function toggleFlyout(side) {
    var bar = w.$(side === "left" ? "#sidebar-left" : "#sidebar-right");
    if (!bar.classList.contains("unpinned")) return;   /* đang ghim thì thôi */
    var open = bar.classList.contains("flyout");
    w.$("#sidebar-left").classList.remove("flyout");
    w.$("#sidebar-right").classList.remove("flyout");
    if (!open) bar.classList.add("flyout");
  }

  function closeFlyouts() {
    w.$("#sidebar-left").classList.remove("flyout");
    w.$("#sidebar-right").classList.remove("flyout");
  }

  /* ══════════════ CỠ CHỮ TOÀN APP ══════════════
     Đổi font-size của <html> — hầu hết CSS trong app dùng đơn vị rem nên
     ăn theo cái này, không cần sửa từng chỗ. */
  var LS_FONT = "tjwl_fontscale_v1";
  var FONT_MIN = 0.85, FONT_MAX = 1.4, FONT_STEP = 0.1;

  function readFontScale() {
    try { return parseFloat(localStorage.getItem(LS_FONT)) || 1; } catch (e) { return 1; }
  }
  var fontScale = readFontScale();

  function applyFontScale() {
    document.documentElement.style.setProperty("--font-scale", fontScale.toFixed(2));
    var pct = w.$("#font-pct");
    if (pct) pct.textContent = Math.round(fontScale * 100) + "%";
  }

  function stepFont(delta) {
    fontScale = Math.max(FONT_MIN, Math.min(FONT_MAX, +(fontScale + delta).toFixed(2)));
    try { localStorage.setItem(LS_FONT, fontScale); } catch (e) {}
    applyFontScale();
  }

  /* ══════════════ MÀU NHẤN (ACCENT) ══════════════
     Đổi 4 biến --blue* ở gốc :root bằng style inline — thắng mọi rule
     trong stylesheet (kể cả bản sáng/tối riêng), nên đổi 1 chỗ là toàn
     app đổi theo, không phải sửa lại theme. "Mặc định" = gỡ inline style,
     app tự dùng lại màu gốc của từng theme. */
  var LS_ACCENT = "tjwl_accent_v1";
  var ACCENTS = {
    blue:   { c: "#3b82f6", l: "#60a5fa", hi: "#2563eb", sub: "rgba(59,130,246,.15)" },
    green:  { c: "#10b981", l: "#34d399", hi: "#059669", sub: "rgba(16,185,129,.15)" },
    purple: { c: "#8b5cf6", l: "#a78bfa", hi: "#7c3aed", sub: "rgba(139,92,246,.15)" },
    orange: { c: "#f97316", l: "#fb923c", hi: "#ea580c", sub: "rgba(249,115,22,.15)" },
    pink:   { c: "#ec4899", l: "#f472b6", hi: "#db2777", sub: "rgba(236,72,153,.15)" }
  };

  function readAccent() {
    try { return localStorage.getItem(LS_ACCENT) || "blue"; } catch (e) { return "blue"; }
  }
  var accent = readAccent();

  function applyAccent() {
    var root = document.documentElement.style;
    var a = ACCENTS[accent];
    if (!a || accent === "blue") {
      /* "blue" trùng mặc định của cả 2 theme -> gỡ override cho sạch */
      root.removeProperty("--blue"); root.removeProperty("--blue-l");
      root.removeProperty("--blue-hi"); root.removeProperty("--blue-sub");
    } else {
      root.setProperty("--blue", a.c); root.setProperty("--blue-l", a.l);
      root.setProperty("--blue-hi", a.hi); root.setProperty("--blue-sub", a.sub);
    }
    w.$$(".accent-dot").forEach(function (d) {
      d.classList.toggle("on", d.dataset.accent === accent);
    });
  }

  function setAccent(name) {
    accent = ACCENTS[name] ? name : "blue";
    try { localStorage.setItem(LS_ACCENT, accent); } catch (e) {}
    applyAccent();
  }

  /* ══════════════ KÉO GIÃN ĐỘ RỘNG CỘT NOTEBOOKS / PAGES ══════════════
     Kéo thanh #resizer-left / #resizer-right bằng chuột. Nhớ độ rộng
     riêng cho từng cột trong máy. Bấm đúp vào thanh kéo -> về 210px. */
  var LS_WIDTH = "tjwl_sidebarw_v1";
  var SW_MIN = 160, SW_MAX = 480, SW_DEFAULT = 210;

  function readWidths() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_WIDTH)) || {};
      return { left: v.left || SW_DEFAULT, right: v.right || SW_DEFAULT };
    } catch (e) { return { left: SW_DEFAULT, right: SW_DEFAULT }; }
  }
  var widths = readWidths();

  function applyWidths() {
    document.documentElement.style.setProperty("--sidebar-w-left", widths.left + "px");
    document.documentElement.style.setProperty("--sidebar-w-right", widths.right + "px");
  }

  function saveWidths() {
    try { localStorage.setItem(LS_WIDTH, JSON.stringify(widths)); } catch (e) {}
  }

  function bindResizer(id, side) {
    var el = w.$(id);
    if (!el) return;

    el.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX, startW = widths[side];
      el.classList.add("dragging");
      document.body.classList.add("resizing-" + side);

      function onMove(ev) {
        var dx = ev.clientX - startX;
        var next = side === "left" ? startW + dx : startW - dx;
        widths[side] = Math.max(SW_MIN, Math.min(SW_MAX, next));
        applyWidths();
      }
      function onUp() {
        el.classList.remove("dragging");
        document.body.classList.remove("resizing-" + side);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        saveWidths();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    el.addEventListener("dblclick", function () {
      widths[side] = SW_DEFAULT;
      applyWidths();
      saveWidths();
    });
  }

  /* ══════════════ ĐIỀU HƯỚNG MOBILE ══════════════ */
  function openDrawer(side) {
    var left = w.$("#sidebar-left"), right = w.$("#sidebar-right");
    left.classList.toggle("open", side === "left");
    right.classList.toggle("open", side === "right");
    w.$("#drawer-backdrop").hidden = !(side === "left" || side === "right");
  }
  function closeDrawers() { openDrawer(null); }

  /* ══════════════ GẮN SỰ KIỆN ══════════════ */
  function bind() {
    /* --- hub --- */
    w.$("#hub-tabs").onclick = async function (e) {
      var b = e.target.closest("[data-hub]");
      if (!b) return;
      leaveDetail();
      S.hubId = b.dataset.hub;
      S.notebooks = await w.DB.getNotebooks(S.hubId);
      S.notebookId = S.notebooks.length ? S.notebooks[0].id : null;
      if (S.notebookId) await loadNotebook(S.notebookId);
      else clearContent();
      saveSel(); renderAll();
    };

    /* --- notebook / section --- */
    w.$("#notebook-list").onclick = async function (e) {
      if (e.target.closest("[data-menu]")) return;
      var el = e.target.closest("[data-nb]");
      if (!el) return;
      leaveDetail();
      S.notebookId = el.dataset.nb;
      await loadNotebook(S.notebookId);
      saveSel(); renderAll(); closeDrawers();
    };

    w.$("#section-list").onclick = function (e) {
      if (e.target.closest("[data-menu]")) return;
      var el = e.target.closest("[data-sec]");
      if (!el) return;
      leaveDetail();
      S.sectionId = el.dataset.sec;
      var pgs = pagesOfSection(S.sectionId);
      S.pageId = pgs.length ? pgs[0].id : null;
      var bts = S.pageId ? batchesOfPage(S.pageId) : [];
      S.batchId = bts.length ? bts[0].id : null;
      saveSel(); renderAll(); closeDrawers();
    };

    w.$("#page-list").onclick = function (e) {
      if (e.target.closest("[data-menu]")) return;
      var el = e.target.closest("[data-page]");
      if (!el) return;
      leaveDetail();
      S.pageId = el.dataset.page;
      var bts = batchesOfPage(S.pageId);
      S.batchId = bts.length ? bts[0].id : null;
      saveSel(); renderCrumb(); renderPages(); renderBatches(); App.renderBlocks(); closeDrawers();
    };

    w.$("#batch-tabs").onclick = function (e) {
      if (e.target.closest("[data-menu]")) return;
      var el = e.target.closest("[data-batch]");
      if (!el) return;
      S.batchId = el.dataset.batch;
      saveSel();
      leaveDetail();
      renderBatches(); App.renderBlocks();
    };

    /* --- mở block --- */
    w.$("#blocks-list").onclick = async function (e) {
      if (e.target.closest("[data-menu]")) return;

      /* Nút "×" xoá thẳng 1 từ ngay trên chip - PHẢI xét TRƯỚC (return sớm),
         không thì click lọt xuống card bên dưới sẽ mở luôn Block ra. */
      var delBtn = e.target.closest("[data-delword]");
      if (delBtn) {
        var wordId = delBtn.dataset.delword;
        var word = S.words.find(function (x) { return x.id === wordId; });
        var ok = await App.askConfirm({
          title: "🗑 Bỏ từ khỏi kho",
          desc: "Xoá hẳn '" + (word ? word.term : "từ này") + "' khỏi kho từ vựng? Không hoàn tác được."
        });
        if (!ok) return;
        try {
          await w.DB.remove("words", wordId);
          S.words = S.words.filter(function (x) { return x.id !== wordId; });
          delete S.wp[wordId];
          App.renderBlocks();
          w.toast("Đã bỏ từ khỏi kho");
        } catch (err) { w.toast("Không xoá được: " + (err.message || err), "err"); }
        return;
      }

      var openBtn = e.target.closest("[data-open]");
      var card = e.target.closest("[data-block]");
      var id = openBtn ? openBtn.dataset.open : (card ? card.dataset.block : null);
      if (id) w.Detail.open(id);
    };

    /* --- chip trong 4 ô chu kỳ --- */
    w.$$(".chips-row").forEach(function (row) {
      row.onclick = function (e) {
        var chip = e.target.closest("[data-jump]");
        if (!chip) return;
        jumpToBlock(chip.dataset.jump);
      };
    });

    w.$("#btn-review-now").onclick = function () {
      var id = this.dataset.target;
      if (id) jumpToBlock(id);
    };

    /* --- thêm hub --- */
    w.$("#btn-add-hub").onclick = async function () {
      var r = await askText({ title: "🗂️ Hub mới", desc: "Ví dụ: IELTS HUB, BUSINESS HUB…", placeholder: "Tên hub" });
      if (!r) return;
      var h = await w.DB.insertHub(r.text);
      S.hubs.push(h); S.hubId = h.id;
      S.notebooks = []; clearContent();
      saveSel(); renderAll();
      w.toast("Đã tạo hub", "ok");
    };

    /* --- thêm notebook / section / page --- */
    w.$("#btn-add-notebook").onclick = async function () {
      var r = await askText({ title: "📓 Notebook mới", desc: "Ví dụ: TJ BOOK 2, US TAX BOOK…", withEmoji: true, emoji: "📓", placeholder: "Tên notebook" });
      if (!r) return;
      var nb = await w.DB.addNotebook(S.hubId, r.text, r.emoji || "📓");
      S.notebooks.push(nb); S.notebookId = nb.id;
      await loadNotebook(nb.id);
      saveSel(); renderAll();
      w.toast("Đã tạo notebook", "ok");
    };

    w.$("#btn-add-section").onclick = async function () {
      if (!S.notebookId) { w.toast("Hãy tạo notebook trước", "err"); return; }
      var r = await askText({ title: "📁 Section mới", desc: "Ví dụ: ETS 2024 · LC, Unit 6–10…", placeholder: "Tên section" });
      if (!r) return;
      var sec = await w.DB.addSection(S.notebookId, r.text);
      S.sections.push(sec); S.sectionId = sec.id; S.pageId = null; S.batchId = null;
      saveSel(); renderAll();
      w.toast("Đã tạo section", "ok");
    };

    w.$("#btn-add-page").onclick = async function () {
      if (!S.sectionId) { w.toast("Hãy tạo section trước", "err"); return; }
      var r = await askText({ title: "📄 Page mới", desc: "Ví dụ: Test 3 — Part 3, AEF3 Unit 8…", placeholder: "Tên page" });
      if (!r) return;
      var pg = await w.DB.addPage(S.sectionId, r.text);
      S.pages.push(pg); S.pageId = pg.id; S.batchId = null;
      saveSel(); renderAll();
      w.toast("Đã tạo page", "ok");
    };

    /* --- paste --- */
    w.$("#btn-paste-new").onclick = function () {
      w.$("#modal-paste").hidden = false;
      setTimeout(function () { w.$("#paste-input").focus(); }, 50);
    };
    w.$("#paste-input").addEventListener("input", previewPaste);
    w.$("#btn-do-paste").onclick = doPaste;

    w.$("#btn-paste-extract").onclick = function () {
      w.$("#modal-extract").hidden = false;
      setTimeout(function () { w.$("#extract-input").focus(); }, 50);
    };
    w.$("#btn-do-extract").onclick = doPasteExtract;
    w.$("#btn-fetch-url").onclick = async function () {
      var url = w.$("#extract-url").value.trim();
      if (!url) { w.toast("Dán link vào trước đã", "err"); return; }
      var btn = this;
      btn.disabled = true;
      var oldText = btn.textContent;
      btn.textContent = "⏳ Đang tải...";
      try {
        var text = await tryFetchArticle(url);
        w.$("#extract-input").value = text;
        var nWords = text.trim() ? text.trim().split(/\s+/).length : 0;
        w.toast("Đã tải được bài (~" + nWords + " từ) — xem lại rồi bấm Trích từ vựng", "ok");
      } catch (e) {
        w.toast("Không tải được từ link này (" + (e.message || "trang chặn CORS") +
                ") — mở link đó, copy nguyên văn bài rồi dán tay vào ô bên dưới nhé", "err");
      } finally {
        btn.disabled = false; btn.textContent = oldText;
      }
    };

    /* --- đóng modal chung --- */
    w.$$("[data-close]").forEach(function (b) {
      b.onclick = function () { w.$("#" + b.dataset.close).hidden = true; };
    });
    w.$$(".modal-overlay").forEach(function (m) {
      /* bấm ra ngoài để đóng — trừ hộp nhập tên, vì nó đang chờ kết quả
         (đóng kiểu đó sẽ để lại một Promise treo lơ lửng) */
      if (m.id === "modal-prompt") return;
      m.addEventListener("click", function (e) { if (e.target === m) m.hidden = true; });
    });

    /* --- menu người dùng --- */
    var menu = w.$("#user-menu");
    w.$("#user-chip").onclick = function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    };
    document.addEventListener("click", function () { menu.hidden = true; });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });

    w.$("#mi-switch").onclick = function () {
      menu.hidden = true; renderUserList(); w.$("#modal-user").hidden = false;
    };
    w.$("#mi-edit").onclick = async function () {
      menu.hidden = true;
      var u = w.Auth.user;
      var r = await askText({ title: "✏️ Đổi tên & avatar", value: u.name, withEmoji: true, emoji: u.emoji });
      if (!r) return;
      w.Auth.updateCurrent(r.text, r.emoji);
      renderUserChip();
    };
    w.$("#mi-cloud").onclick = function () {
      menu.hidden = true;
      w.$("#cloud-status").textContent = ""; w.$("#cloud-status").className = "cloud-status";
      w.$("#modal-cloud").hidden = false;
    };
    w.$("#mi-logout").onclick = async function () {
      menu.hidden = true;
      await w.Auth.signOut();
      await loadProgress(); renderAll();
      w.toast("Đã đăng xuất");
    };

    w.$("#user-list").onclick = function (e) {
      var del = e.target.closest("[data-del]");
      if (del) {
        e.stopPropagation();
        w.Auth.deleteLocal(del.dataset.del);
        renderUserList(); renderUserChip();
        return;
      }
      var row = e.target.closest("[data-uid]");
      if (row) switchUser(row.dataset.uid);
    };

    w.$("#btn-new-user").onclick = async function () {
      var r = await askText({ title: "👤 Người học mới", desc: "Tiến trình ôn tập sẽ tách riêng.", withEmoji: true, emoji: "🦊", placeholder: "Tên hiển thị" });
      if (!r) return;
      var u = w.Auth.createLocal(r.text, r.emoji || "🐣");
      await switchUser(u.id);
    };

    /* --- đăng nhập cloud --- */
    w.$("#btn-send-link").onclick = async function () {
      var email = w.$("#cloud-email").value.trim();
      var st = w.$("#cloud-status");
      if (!email) { st.className = "cloud-status err"; st.textContent = "Hãy nhập email."; return; }
      st.className = "cloud-status"; st.textContent = "Đang gửi…";
      try {
        await w.Auth.sendMagicLink(email);
        st.className = "cloud-status ok";
        st.textContent = "✅ Đã gửi! Mở hộp thư " + email + " và bấm vào link để đăng nhập. (Nhớ kiểm tra cả mục Spam.)";
      } catch (e) {
        st.className = "cloud-status err";
        st.textContent = "❌ " + (e.message || e);
      }
    };

    /* --- xuất PDF --- */
    w.$("#mi-print").onclick = function () { menu.hidden = true; w.Export.openModal(); };
    w.$("#mi-cleanup").onclick = async function () {
      menu.hidden = true;
      await cleanupJunkWords();
    };

    /* --- sao lưu / phục hồi --- */
    w.$("#mi-export").onclick = function () {
      menu.hidden = true;
      var blob = new Blob([w.DB.exportJSON()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tj-wordloop-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    w.$("#mi-import").onclick = function () { menu.hidden = true; w.$("#file-import").click(); };
    w.$("#file-import").onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = async function () {
        try {
          w.DB.importJSON(fr.result);
          w.toast("Đã nhập dữ liệu — đang tải lại…", "ok");
          setTimeout(function () { location.reload(); }, 700);
        } catch (err) { w.toast("File không hợp lệ", "err"); }
      };
      fr.readAsText(f);
      e.target.value = "";
    };

    /* người dùng tự cuộn thì karaoke nhường, khỏi giật. Bắt ở PHA CAPTURE
       để nghe được cả sự kiện "scroll" xảy ra bên trong khung con (bảng
       từ / đoạn văn giờ tự cuộn riêng) — "scroll" không nổi bọt lên cha
       như wheel/touchstart, phải bắt lúc nó đi xuống mới thấy được. */
    /* e.isTrusted: chỉ tính "người dùng tự cuộn" khi đúng là user gây ra
       (kéo chuột/vuốt/lăn chuột) — followWord() cuộn màn hình bằng cách
       gán box.scrollTop trực tiếp, việc đó CŨNG bắn ra sự kiện "scroll"
       y hệt, isTrusted=false. Không lọc thì lần tự cuộn ĐẦU TIÊN của
       chính app đã bị hiểu nhầm là user cuộn, tự khoá luôn không bao
       giờ cuộn theo được nữa. */
    w.$("#workspace").addEventListener("scroll", function (e) {
      if (e.isTrusted) w.Speech.noteUserScroll();
    }, { passive: true, capture: true });
    w.$("#workspace").addEventListener("wheel", function () { w.Speech.noteUserScroll(); }, { passive: true });
    w.$("#workspace").addEventListener("touchstart", function () { w.Speech.noteUserScroll(); }, { passive: true });

    /* --- bảng thao tác: nút ⋯ hoặc bấm chuột phải --- */
    document.addEventListener("click", function (e) {
      var d = e.target.closest("[data-menu]");
      if (d) {
        e.stopPropagation();
        App.openMenu(d.dataset.menu, d.dataset.id, d);
        return;
      }
      if (!e.target.closest("#ctx-menu")) App.closeMenu();
    });
    document.addEventListener("contextmenu", function (e) {
      /* Thiếu [data-block] trước đây -> bấm phải vào 1 Block card chỉ ra
         menu chuột phải mặc định của trình duyệt, không mở được menu
         đổi tên/xoá riêng Block (dù nút "⋯" trên card đã làm việc đó
         được — đây chỉ là lối tắt chuột phải, không phải cách duy nhất). */
      var host = e.target.closest("[data-nb],[data-sec],[data-page],[data-batch],[data-block]");
      if (!host) return;
      var table = host.dataset.nb ? "notebooks" : host.dataset.sec ? "sections"
                : host.dataset.page ? "pages" : host.dataset.batch ? "batches" : "blocks";
      var id = host.dataset.nb || host.dataset.sec || host.dataset.page || host.dataset.batch || host.dataset.block;
      e.preventDefault();
      App.openMenu(table, id, host);
    });

    /* --- đổi giao diện --- */
    w.$("#theme-btn").onclick = function (e) { e.stopPropagation(); App.toggleTheme(); };

    /* --- ghim cột --- */
    w.$("#pin-left").onclick = function (e) { e.stopPropagation(); togglePin("left"); };
    w.$("#pin-right").onclick = function (e) { e.stopPropagation(); togglePin("right"); };
    w.$("#name-left").onclick = function (e) { e.stopPropagation(); toggleFlyout("left"); };
    w.$("#name-right").onclick = function (e) { e.stopPropagation(); toggleFlyout("right"); };

    /* --- kéo giãn độ rộng cột --- */
    applyWidths();
    bindResizer("#resizer-left", "left");
    bindResizer("#resizer-right", "right");

    /* --- cỡ chữ + màu nhấn (trong menu người dùng) --- */
    applyFontScale();
    applyAccent();
    w.$("#font-dec").onclick = function () { stepFont(-FONT_STEP); };
    w.$("#font-inc").onclick = function () { stepFont(FONT_STEP); };
    w.$$(".accent-dot").forEach(function (d) {
      d.onclick = function () { setAccent(d.dataset.accent); };
    });
    /* Không dùng stopPropagation trên cột — làm vậy sẽ chặn luôn sự kiện
       lên tới document, khiến nút ⋯ trong cột không mở được bảng thao tác.
       Thay vào đó chỉ cần bỏ qua khi cú bấm nằm trong cột. */
    document.addEventListener("click", function (e) {
      if (e.target.closest(".sidebar")) return;
      closeFlyouts();
    });
    applyPins();
    App.bindDrag();

    /* --- mobile --- */
    w.$("#btn-drawer-left").onclick = function () {
      openDrawer(w.$("#sidebar-left").classList.contains("open") ? null : "left");
    };
    w.$("#drawer-backdrop").onclick = closeDrawers;
    w.$$(".mobile-nav button").forEach(function (b) {
      b.onclick = function () {
        var m = b.dataset.m;
        w.$$(".mobile-nav button").forEach(function (x) { x.classList.toggle("active", x === b); });
        if (m === "user") { closeDrawers(); renderUserList(); w.$("#modal-user").hidden = false; return; }
        openDrawer(m === "main" ? null : m);
      };
    });

    w.Detail.bind();
  }

  function jumpToBlock(blockId) {
    var blk = S.blocks.find(function (b) { return b.id === blockId; });
    if (!blk) return;
    var batch = S.batches.find(function (b) { return b.id === blk.batch_id; });
    if (batch) {
      var page = S.pages.find(function (p) { return p.id === batch.page_id; });
      if (page) { S.pageId = page.id; S.sectionId = page.section_id; }
      S.batchId = batch.id;
      saveSel();
      renderCrumb(); renderSections(); renderPages(); renderBatches(); App.renderBlocks();
    }
    w.Detail.open(blockId);
  }

  /* ══════════════ THƯ VIỆN CÓ BẢN MỚI ══════════════
     Kho từ gói sẵn chỉ được nạp lúc bộ nhớ máy còn trống. Ai đã mở app một
     lần rồi thì dựng lại kho bao nhiêu lần cũng không thấy — trước đây phải
     mở Console gõ localStorage.clear(). Giờ app tự so và hỏi. */
  App.checkLibraryUpdate = async function () {
    var info = await w.DB.checkStarter();
    if (!info) return false;

    var ok = await askConfirm({
      title: "Thư viện có bản mới",
      desc: "Máy này đang giữ bản cũ. Bản mới có " + info.words + " từ · "
          + info.pages + " bài · " + info.notebooks + " notebook. "
          + "Cập nhật ngay? Tiến trình học và những gì bạn tự thêm vẫn giữ nguyên."
    });
    if (!ok) return false;

    try {
      var res = await w.DB.applyStarter();
      w.toast("Đã cập nhật thư viện: " + res.words + " từ", "ok");
      await App.reloadCurrent();
      return true;
    } catch (e) {
      w.toast("Không cập nhật được: " + (e.message || e), "err");
      return false;
    }
  };

  /* ══════════════ KHỞI ĐỘNG ══════════════ */
  async function boot() {
    applyTheme(App.theme());          /* đặt màu trước khi vẽ, tránh nháy sáng */
    w.Speech.init();
    var mode = await w.DB.init();
    await w.Auth.init();

    w.Auth.onChange(async function () {
      await loadProgress();
      renderAll();
      App.refreshWordCounter();
    });

    S.hubs = await w.DB.getHubs();
    var sel = readSel();
    S.hubId = pick(S.hubs, sel.hubId);

    if (S.hubId) {
      S.notebooks = await w.DB.getNotebooks(S.hubId);
      S.notebookId = pick(S.notebooks, sel.notebookId);
      if (S.notebookId) await loadNotebook(S.notebookId);
    }

    renderAll();
    bind();
    App.refreshWordCounter();
    w.$("#word-counter").onclick = function () { w.Journey.open(); };

    /* Mở lại đúng Block + đúng tab đang xem dở trước khi refresh (dựa
       vào Notebook/Section/Page/Batch vừa được readSel() ở trên khôi
       phục lại rồi) — khỏi phải bấm lại từ đầu mỗi lần F5. */
    if (w.Detail && w.Detail.restoreLast) w.Detail.restoreLast();

    if (mode === "local") {
      console.info("[TJ WordLoop] Đang chạy CHẾ ĐỘ LOCAL. Muốn dùng chung: điền js/config.js.");
      App.checkLibraryUpdate();       /* không await: để app hiện ra trước */
    }
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})(window);
