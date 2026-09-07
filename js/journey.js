/* journey.js — Màn "Journey": tổng quan TOÀN APP + lịch học theo ngày +
   cây tiến độ drill-down (Hub > Notebook > Section > Page > Batch > Block).

   Quy ước:
     · XANH  = số từ "đã học" hôm đó — cộng dồn mỗi khi 1 trong 3 thẻ bài
       tập (Phiếu đầy đủ / Từng câu / Nghĩa) đạt ≥ 80%.
     · ĐỎ    = số từ đang "quá hạn" ôn tập theo lịch Tony Buzan, tính vào
       đúng ngày đến hạn (bp.next_review_at) — đây là số liệu SỐNG, tính
       lại mỗi lần mở màn này, không phải nhật ký cố định như số học.
     · "Done" trên 1 Block (✓ ở cây) = đã LÀM XONG bài tập (bp.passed hoặc
       bp.meaning_passed đạt ≥80%) — chỉ là "đã học". Vào được chu kỳ ôn
       Tony Buzan thật (tức "đưa vào trí nhớ dài hạn") CHỈ khi bp.passed
       (Phiếu đầy đủ/Từng câu) — xem js/srs.js. Cây này không tách riêng
       2 trạng thái đó (chỉ cần đủ để biết Block nào cần học tiếp), số
       liệu chính xác cho SRS vẫn nằm ở "Tổng quan" + màn Chi tiết Block.

   Cây tiến độ tải TOÀN BỘ cấu trúc app (DB.getFullTree, không kèm Word —
   xem lý do trong db.js) MỘT LẦN khi mở Journey, rồi tự tính % từng cấp ở
   phía client (không hỏi lại server mỗi lần bấm sâu vào 1 cấp). */
(function (w) {
  "use strict";

  var J = {};
  w.Journey = J;

  var DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  var LEVEL_LABEL = { hub: "Hub", notebook: "Notebook", section: "Section", page: "Page", batch: "Batch", block: "Block" };
  var LEVEL_ICON  = { hub: "🗂", notebook: "📓", section: "📑", page: "📄", batch: "📦" };
  var TABLE_OF    = { hub: "hubs", notebook: "notebooks", section: "sections", page: "pages", batch: "batches", block: "blocks" };
  var PARENT_LEVEL = { notebook: "hub", section: "notebook", page: "section", batch: "page", block: "batch" };
  var PARENT_FIELD = { notebook: "hub_id", section: "notebook_id", page: "section_id", batch: "page_id", block: "batch_id" };

  function pad2(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  /* ══════════════ MỞ / ĐÓNG ══════════════ */
  J.open = async function () {
    w.Speech.stop();
    /* Nhớ đang ở màn nào để bấm "Về học tiếp"/"Learning" thì quay lại
       đúng chỗ, thay vì luôn nhảy về danh sách Block. */
    J._prevWasDetail = !w.$("#screen-detail").hidden;
    w.$("#screen-blocks").hidden = true;
    w.$("#screen-detail").hidden = true;
    w.$("#btn-back").hidden = true;
    w.$("#screen-journey").hidden = false;
    w.$("#btn-learning").hidden = false;
    w.$("#workspace").scrollTop = 0;

    J._crumb = [];   // trống = đang ở "🌐 Toàn bộ"
    w.$("#journey-cal").innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:1rem">Đang tải…</div>';
    w.$("#journey-tree").innerHTML = '<div class="nav-empty">Đang tải…</div>';

    var uid = w.Auth.user && w.Auth.user.id;
    J._summary = uid
      ? await w.DB.getJourneySummary(uid)
      : { totalWords: 0, mastered: 0, totalBlocks: 0, blocksDone: 0, overdueWords: 0, overdueByDate: {} };
    var log = uid ? await w.DB.getDailyLog(uid) : {};
    if (w.App && w.App.setWordCounter) w.App.setWordCounter(J._summary.mastered, J._summary.totalWords);

    J.renderCalendar(log, J._summary.overdueByDate || {});
    await J.loadTree();
  };

  J.close = function () {
    w.$("#screen-journey").hidden = true;
    w.$("#btn-learning").hidden = true;
    if (J._prevWasDetail && w.Detail && w.Detail.blockId) {
      w.$("#screen-detail").hidden = false;
      w.$("#btn-back").hidden = false;
    } else {
      w.$("#screen-blocks").hidden = false;
    }
  };

  /* Lịch 28 ngày gần nhất, xếp cột T2 → CN giống lịch học/Duolingo. */
  J.renderCalendar = function (log, overdueByDate) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayKey = keyOf(today);

    var days = [];
    for (var i = 27; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    /* độn ô trống đầu tuần cho thẳng cột — JS: getDay() 0=Chủ nhật,
       đổi về 0=Thứ 2 cho khớp thứ tự cột DOW ở trên. */
    var firstDow = (days[0].getDay() + 6) % 7;

    var html = DOW.map(function (x) { return '<div class="jcal-dow">' + x + "</div>"; }).join("");
    for (var p = 0; p < firstDow; p++) html += '<div class="jcell pad"></div>';

    days.forEach(function (d) {
      var k = keyOf(d);
      var learned = (log[k] && log[k].learned) || 0;
      var due = overdueByDate[k] || 0;
      var cls = "jcell";
      if (learned > 0 && due > 0) cls += " both";
      else if (learned > 0) cls += " learn";
      else if (due > 0) cls += " due";
      if (k === todayKey) cls += " today";

      var nums = "";
      if (learned > 0) nums += '<span class="jn">+' + learned + "</span>";
      if (due > 0) nums += '<span class="jn">⚠' + due + "</span>";

      var titleBits = [];
      if (learned > 0) titleBits.push("học " + learned + " từ");
      if (due > 0) titleBits.push("quá hạn " + due + " từ");

      html += '<div class="' + cls + '" title="' + k + (titleBits.length ? " · " + titleBits.join(" · ") : "") + '">' +
                '<span class="jd">' + d.getDate() + "</span>" + nums +
              "</div>";
    });

    w.$("#journey-cal").innerHTML = html;
  };

  /* ══════════════ CÂY TIẾN ĐỘ — tải + tính rollup ══════════════ */
  function indexTree(t) {
    function idx(arr) { var m = {}; arr.forEach(function (r) { m[r.id] = r; }); return m; }
    return {
      hub: idx(t.hubs), notebook: idx(t.notebooks), section: idx(t.sections),
      page: idx(t.pages), batch: idx(t.batches), block: idx(t.blocks)
    };
  }

  /* Gom sẵn "Block nào thuộc về cấp nào" 1 lần, đi từ đáy (Batch) lên
     đỉnh (Hub) — tránh phải duyệt lại toàn bộ mảng blocks mỗi lần vẽ 1
     dòng trong cây (1041 block, vẽ hàng chục dòng mỗi lượt drill). */
  function buildAgg(t) {
    var blocksByBatch = {};
    t.blocks.forEach(function (b) { (blocksByBatch[b.batch_id] = blocksByBatch[b.batch_id] || []).push(b.id); });
    var batchesByPage = {};
    t.batches.forEach(function (b) { (batchesByPage[b.page_id] = batchesByPage[b.page_id] || []).push(b.id); });
    var pagesBySection = {};
    t.pages.forEach(function (p) { (pagesBySection[p.section_id] = pagesBySection[p.section_id] || []).push(p.id); });
    var sectionsByNotebook = {};
    t.sections.forEach(function (s) { (sectionsByNotebook[s.notebook_id] = sectionsByNotebook[s.notebook_id] || []).push(s.id); });
    var notebooksByHub = {};
    t.notebooks.forEach(function (n) { (notebooksByHub[n.hub_id] = notebooksByHub[n.hub_id] || []).push(n.id); });

    function flat(ids, map) {
      var out = [];
      (ids || []).forEach(function (id) { out = out.concat(map[id] || []); });
      return out;
    }
    var blocksOfPage = {}, blocksOfSection = {}, blocksOfNotebook = {}, blocksOfHub = {};
    Object.keys(batchesByPage).forEach(function (pid) { blocksOfPage[pid] = flat(batchesByPage[pid], blocksByBatch); });
    Object.keys(pagesBySection).forEach(function (sid) { blocksOfSection[sid] = flat(pagesBySection[sid], blocksOfPage); });
    Object.keys(sectionsByNotebook).forEach(function (nid) { blocksOfNotebook[nid] = flat(sectionsByNotebook[nid], blocksOfSection); });
    Object.keys(notebooksByHub).forEach(function (hid) { blocksOfHub[hid] = flat(notebooksByHub[hid], blocksOfNotebook); });

    return {
      blocksByBatch: blocksByBatch, blocksOfPage: blocksOfPage, blocksOfSection: blocksOfSection,
      blocksOfNotebook: blocksOfNotebook, blocksOfHub: blocksOfHub
    };
  }

  function blockIdsOf(level, id) {
    var a = J._agg;
    if (level === "block") return [id];
    if (level === "batch") return a.blocksByBatch[id] || [];
    if (level === "page") return a.blocksOfPage[id] || [];
    if (level === "section") return a.blocksOfSection[id] || [];
    if (level === "notebook") return a.blocksOfNotebook[id] || [];
    if (level === "hub") return a.blocksOfHub[id] || [];
    return [];
  }

  function statsFor(level, id) {
    var ids = blockIdsOf(level, id);
    var done = 0;
    ids.forEach(function (bid) {
      var r = J._tree.bp[bid];
      if (r && (r.passed || r.meaning_passed)) done++;
    });
    return { total: ids.length, done: done };
  }

  /* Ai là con trực tiếp của 1 nút — level truyền vào là level của NÚT
     CHA, trả về {level con, rows con}. "root" = danh sách Hub. */
  function childrenOf(level, id) {
    var t = J._tree;
    if (level === "root") return { level: "hub", rows: t.hubs.slice().sort(bySort) };
    if (level === "hub") return { level: "notebook", rows: t.notebooks.filter(function (n) { return n.hub_id === id; }).sort(bySort) };
    if (level === "notebook") return { level: "section", rows: t.sections.filter(function (s) { return s.notebook_id === id; }).sort(bySort) };
    if (level === "section") return { level: "page", rows: t.pages.filter(function (p) { return p.section_id === id; }).sort(bySort) };
    if (level === "page") return { level: "batch", rows: t.batches.filter(function (b) { return b.page_id === id; }).sort(bySort) };
    if (level === "batch") return { level: "block", rows: t.blocks.filter(function (b) { return b.batch_id === id; }).sort(bySort) };
    return null;   // "block" — không có con, là lá
  }

  /* Đi ngược từ 1 dòng bất kỳ lên tận Hub — trả về đúng shape App.jumpTo
     cần ({hubId, notebookId, ...}), dùng chung cho cả "Mở tại đây" lẫn
     mở context-menu (cần đổi S sang đúng Notebook trước). */
  function ancestorsOf(level, id) {
    var out = {};
    var cur = { level: level, id: id };
    while (cur) {
      var row = J._byId[cur.level] && J._byId[cur.level][cur.id];
      if (!row) break;
      out[cur.level + "Id"] = cur.id;
      var pl = PARENT_LEVEL[cur.level];
      if (!pl) break;
      cur = { level: pl, id: row[PARENT_FIELD[cur.level]] };
    }
    return out;
  }

  J.loadTree = async function () {
    var uid = w.Auth.user && w.Auth.user.id;
    try {
      J._tree = await w.DB.getFullTree(uid);
    } catch (e) {
      w.$("#journey-tree").innerHTML = '<div class="nav-empty">Không tải được cây tiến độ: ' + w.esc(e.message || String(e)) + "</div>";
      return;
    }
    J._agg = buildAgg(J._tree);
    J._byId = indexTree(J._tree);

    /* Nếu đang drill sâu mà 1 mắt xích vừa bị xoá ở nơi khác (tab khác,
       hoặc action vừa xoá chính nó) -> lùi breadcrumb về đúng chỗ cuối
       cùng còn tồn tại, không để màn hình trắng/lỗi. */
    for (var i = 0; i < J._crumb.length; i++) {
      var c = J._crumb[i];
      if (!(J._byId[c.level] && J._byId[c.level][c.id])) { J._crumb = J._crumb.slice(0, i); break; }
    }
    J.renderScope();
  };

  function currentScope() {
    return J._crumb.length ? J._crumb[J._crumb.length - 1] : { level: "root", id: null, name: "Toàn bộ" };
  }

  J.renderScope = function () {
    var scope = currentScope();
    var perBlock = (w.APP_CONFIG && w.APP_CONFIG.WORDS_PER_BLOCK) || 10;

    /* --- breadcrumb --- */
    var crumbHtml = '<span class="jcrumb-item' + (!J._crumb.length ? " active" : "") + '" data-idx="-1">🌐 Toàn bộ</span>';
    J._crumb.forEach(function (c, i) {
      crumbHtml += '<span class="jcrumb-sep">›</span><span class="jcrumb-item' +
        (i === J._crumb.length - 1 ? " active" : "") + '" data-idx="' + i + '">' + w.esc(c.name) + "</span>";
    });
    w.$("#journey-crumb").innerHTML = crumbHtml;

    /* --- 3 thẻ tổng quan: số THẬT ở gốc, ƯỚC TÍNH khi đã drill vào (vì
       cây này không tải tới cấp Word — xem lý do trong db.js) --- */
    w.$("#journey-scope-title").textContent = "📊 Tổng quan — " + (scope.level === "root" ? "Toàn bộ" : scope.name);
    if (scope.level === "root") {
      w.$("#j-words").textContent = J._summary.mastered.toLocaleString("vi-VN") + " / " + J._summary.totalWords.toLocaleString("vi-VN");
      w.$("#j-words-label").textContent = "Đã thuộc / Tổng từ";
      w.$("#j-blocks").textContent = J._summary.blocksDone + " / " + J._summary.totalBlocks;
      w.$("#j-overdue").textContent = J._summary.overdueWords;
      w.$("#j-overdue-label").textContent = "Từ đang quá hạn ôn";
    } else {
      var st = statsFor(scope.level, scope.id);
      w.$("#j-words").textContent = "≈" + (st.done * perBlock).toLocaleString("vi-VN") + " / " + (st.total * perBlock).toLocaleString("vi-VN");
      w.$("#j-words-label").textContent = "Từ trong Block đã Done (ước tính) / Tổng từ";
      w.$("#j-blocks").textContent = st.done + " / " + st.total;
      w.$("#j-overdue").textContent = "—";
      w.$("#j-overdue-label").textContent = "Xem số chính xác ở Toàn bộ";
    }
    /* Lịch 28 ngày là số liệu TOÀN APP (daily_log không tách theo Hub/
       Block) — ẩn khi đã drill để khỏi hiểu lầm là số của riêng chỗ đó. */
    w.$("#journey-cal-card").hidden = scope.level !== "root";

    /* --- danh sách con --- */
    var kids = childrenOf(scope.level === "root" ? "root" : scope.level, scope.id);
    w.$("#journey-list-title").textContent =
      (LEVEL_ICON[kids.level] || "🧩") + " " + LEVEL_LABEL[kids.level] + (kids.rows.length ? " (" + kids.rows.length + ")" : "");
    w.$("#journey-tree").innerHTML = kids.rows.length
      ? kids.rows.map(function (row) { return renderRow(kids.level, row); }).join("")
      : '<div class="nav-empty">Trống</div>';
  };

  function renderRow(level, row) {
    if (level === "block") {
      var bp = J._tree.bp[row.id] || {};
      var done = bp.passed || bp.meaning_passed;
      return '<div class="jrow jrow-block' + (done ? " done" : "") + '" data-level="block" data-id="' + row.id + '">' +
        '<span class="jrow-ic">' + (done ? "✓" : "⭕") + "</span>" +
        '<span class="jrow-name">' + w.esc(row.name) + "</span>" +
        '<span class="jrow-status">' + (done ? "✓ Done" : "Chưa xong") + "</span>" +
        '<button class="jrow-open" data-act="open" title="Mở bài học">↗</button>' +
        '<button class="jrow-dots" data-act="menu" title="Thao tác">⋯</button>' +
      "</div>";
    }
    var st = statsFor(level, row.id);
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    return '<div class="jrow" data-level="' + level + '" data-id="' + row.id + '">' +
      '<span class="jrow-ic">' + LEVEL_ICON[level] + "</span>" +
      '<span class="jrow-name">' + w.esc(row.name) + "</span>" +
      '<span class="jrow-bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="jrow-pct">' + pct + '%</span>' +
      '<span class="jrow-count">' + st.done + "/" + st.total + " block</span>" +
      '<button class="jrow-open" data-act="open" title="Mở tại đây">↗</button>' +
      '<button class="jrow-dots" data-act="menu" title="Thao tác">⋯</button>' +
    "</div>";
  }

  /* ══════════════ HÀNH ĐỘNG TỪNG DÒNG ══════════════ */
  function rowName(level, id) {
    var r = J._byId[level] && J._byId[level][id];
    return r ? r.name : "";
  }

  function drillInto(level, id) {
    J._crumb.push({ level: level, id: id, name: rowName(level, id) });
    J.renderScope();
  }

  /* "↗ Mở tại đây" / bấm thẳng vào dòng Block — nhảy ra màn học chính,
     đúng đúng vị trí đó, y như tự bấm qua từng cấp Hub>Notebook>...
     (App.jumpTo trong app.js). */
  async function jumpToRow(level, id) {
    var anc = ancestorsOf(level, id);
    await w.App.jumpTo(anc);
  }

  /* Bấm phải / nút ⋯ -> tái dùng ĐÚNG bảng thao tác (#ctx-menu) app đang
     dùng cho cây điều hướng chính (Đổi tên/Xoá/Xoá tiến trình...) — chỉ
     cần đưa S (Notebook đang mở trong app.js) về đúng chỗ TRƯỚC, vì
     App.doAction tra cứu dòng trong S.sections/pages/batches/blocks của
     Notebook ĐANG MỞ, không phải trong cây toàn app này. */
  async function openRowMenu(level, id, anchor) {
    var anc = ancestorsOf(level, id);
    await w.App.ensureNotebookContext(anc.hubId, anc.notebookId);
    w.App.openMenu(TABLE_OF[level], id, anchor);
    /* Không có cách bắt "khi nào action xong" từ ngoài App.doAction (nó
       tự đóng menu trước khi await xong việc) -> hẹn giờ tải lại cây sau
       1 khoảng đủ để hộp xác nhận + lưu DB kịp chạy. Có nút "⟳ Tải lại"
       thủ công phòng khi người dùng chậm hơn khoảng này. */
    clearTimeout(J._refreshTimer);
    J._refreshTimer = setTimeout(function () { J.loadTree(); }, 1500);
  }

  /* "Từ đang quá hạn ôn" -> bấm để nhảy THẲNG vào Block quá hạn gần nhất
     (đến hạn sớm nhất trước) mà giải quyết luôn, khỏi tự đi tìm trong cây.
     Chỉ cần bp.cycle/next_review_at (đã có trong J._tree.bp — xem
     DB.getFullTree) + w.SRS.state() để biết Block nào đang "due". */
  function overdueBlocksSorted() {
    if (!J._tree) return [];
    var out = [];
    J._tree.blocks.forEach(function (b) {
      var st = w.SRS.state(J._tree.bp[b.id]);
      if (st.started && st.due) out.push({ block: b, nextAt: st.nextAt || 0 });
    });
    out.sort(function (a, b) { return a.nextAt - b.nextAt; });
    return out;
  }

  async function goToNearestOverdue() {
    if (!J._tree) await J.loadTree();
    var list = overdueBlocksSorted();
    if (!list.length) { w.toast("Không có Block nào quá hạn ôn 🎉", "ok"); return; }
    var anc = ancestorsOf("block", list[0].block.id);
    await w.App.jumpTo(anc);
  }

  /* ══════════════ GẮN SỰ KIỆN ══════════════ */
  w.$("#j-overdue-card").onclick = goToNearestOverdue;
  w.$("#btn-journey").onclick = function () { J.open(); };
  w.$("#btn-journey-back").onclick = function () { J.close(); };
  w.$("#btn-learning").onclick = function () { J.close(); };
  w.$("#journey-refresh").onclick = function () { J.loadTree(); };

  w.$("#journey-crumb").addEventListener("click", function (e) {
    var item = e.target.closest(".jcrumb-item");
    if (!item) return;
    var idx = parseInt(item.dataset.idx, 10);
    J._crumb = idx < 0 ? [] : J._crumb.slice(0, idx + 1);
    J.renderScope();
  });

  w.$("#journey-tree").addEventListener("click", async function (e) {
    var row = e.target.closest(".jrow");
    if (!row) return;
    var level = row.dataset.level, id = row.dataset.id;
    var act = e.target.closest("[data-act]");

    if (act && act.dataset.act === "menu") { e.stopPropagation(); await openRowMenu(level, id, act); return; }
    if (act && act.dataset.act === "open") { e.stopPropagation(); await jumpToRow(level, id); return; }

    if (level === "block") { await jumpToRow(level, id); return; }   // Block là lá -> bấm dòng = mở luôn
    drillInto(level, id);                                            // các cấp khác -> đi sâu vào trong cây
  });

  w.$("#journey-tree").addEventListener("contextmenu", async function (e) {
    var row = e.target.closest(".jrow");
    if (!row) return;
    e.preventDefault();
    await openRowMenu(row.dataset.level, row.dataset.id, row);
  });
})(window);
