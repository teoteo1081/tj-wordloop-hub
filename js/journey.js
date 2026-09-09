/* journey.js — Màn "Journey": tổng quan TOÀN APP + lịch học theo ngày +
   4 tab theo tiến độ Tony Buzan + cây tiến độ drill-down.

   Quy ước:
     · XANH  = số từ "đã học" hôm đó — cộng dồn mỗi khi 1 trong 3 thẻ bài
       tập (Phiếu đầy đủ / Từng câu / Nghĩa) đạt ≥ 80%.
     · ĐỎ    = số từ đang "quá hạn" ôn tập theo lịch Tony Buzan, tính vào
       đúng ngày đến hạn (bp.next_review_at) — đây là số liệu SỐNG, tính
       lại mỗi lần mở màn này, không phải nhật ký cố định như số học.
     · "Done" trên 1 Block (✓ ở cây) = đã LÀM XONG bài tập (bp.passed hoặc
       bp.meaning_passed đạt ≥80%) — chỉ là "đã học". Vào được chu kỳ ôn
       Tony Buzan thật (tức "đưa vào trí nhớ dài hạn") CHỈ khi bp.passed
       (Phiếu đầy đủ/Từng câu) — xem js/srs.js.

   Bố cục màn hình:
     1. "🗓️ Lịch học theo tháng" — số liệu toàn app (không đổi theo cây
        thư mục bên phải). Đã bỏ hẳn khối "Tổng quan" (3 thẻ số liệu +
        4 chip giai đoạn) từng đứng trên lịch — trùng lặp với mục 2 bên
        dưới, theo yêu cầu người dùng.
     2. 2 khung song song: TRÁI = "🚦 Theo tiến độ Tony Buzan" (4 tab,
        mỗi tab liệt kê Block đến hạn ôn ngay / Block đã ôn chờ hạn kế
        tiếp — liệt kê THEO BLOCK, không theo từng từ, vì tiến trình chỉ
        lưu ở cấp Block); PHẢI = cây drill-down cũ (Hub>...>Block) để
        duyệt/nhảy vào học theo cấu trúc thư mục.

   Cây tiến độ tải TOÀN BỘ cấu trúc app (DB.getFullTree, không kèm Word —
   xem lý do trong db.js) MỘT LẦN khi mở Journey, rồi tự tính % + phân
   nhóm Tony Buzan ở phía client (không hỏi lại server mỗi lần bấm sâu). */
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

  /* 4 giai đoạn Tony Buzan, khớp w.SRS.STEPS[].group (1..4) */
  var GROUP_SHORT = { 1: "Lần 1–2", 2: "Lần 3", 3: "Lần 4", 4: "Lần 5–6" };
  var GROUP_LABEL = {
    1: "Lần 1–2 · sau 10 phút / 24 giờ", 2: "Lần 3 · sau 1 tuần",
    3: "Lần 4 · sau 1 tháng", 4: "Lần 5–6 · sau 3–6 tháng"
  };
  var LS_JTAB = "tjwl_journey_tab_v1";

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
    w.$("#screen-home").hidden = true;
    w.$("#btn-back").hidden = true;
    w.$("#screen-journey").hidden = false;
    w.$("#btn-learning").hidden = false;
    w.$("#workspace").scrollTop = 0;

    J._crumb = [];   // trống = cây bên phải đang ở gốc "🌐 Toàn bộ"
    renderTabs();
    w.$("#journey-cal").innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:1rem">Đang tải…</div>';
    w.$("#journey-tree").innerHTML = '<div class="nav-empty">Đang tải…</div>';
    w.$("#jtab-panel").innerHTML = '<div class="nav-empty">Đang tải…</div>';

    var uid = w.Auth.user && w.Auth.user.id;
    J._summary = uid
      ? await w.DB.getJourneySummary(uid)
      : { totalWords: 0, mastered: 0, learnedWords: 0, totalBlocks: 0, blocksDone: 0, overdueWords: 0, overdueByDate: {} };
    /* Nhật ký học ("đã học" + "quá hạn") tải TOÀN BỘ lịch sử 1 lần (không
       giới hạn theo khoảng ngày) — chuyển lịch sang xem theo tháng chỉ cần
       lọc lại phía client khi bấm ←/→, không phải gọi lại server. */
    J._log = uid ? await w.DB.getDailyLog(uid) : {};
    if (w.App && w.App.setWordCounter) w.App.setWordCounter(J._summary.mastered, J._summary.totalWords);

    var today = new Date();
    J._calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    J.renderCalendar();
    await J.loadTree();
    J.renderDataUpdated();   /* không chặn màn hình chính — tự chạy song song, xong thì hiện */
  };

  /* Dòng gọn "Data cập nhật lần cuối" trên card Tony Buzan — xem
     DB.getVocabLastUpdated. Tách hàm riêng (không await trong J.open) để
     không làm chậm màn Journey chính chờ thêm 2 query phụ. */
  J.renderDataUpdated = async function () {
    var el = w.$("#journey-data-updated");
    if (!el) return;
    try {
      var d = await w.DB.getVocabLastUpdated();
      if (!d) { el.hidden = true; return; }
      var mins = Math.round((Date.now() - d.getTime()) / 60000);
      var rel;
      if (mins < 1) rel = "vừa xong";
      else if (mins < 60) rel = mins + " phút trước";
      else if (mins < 24 * 60) rel = Math.round(mins / 60) + " giờ trước";
      else rel = Math.round(mins / (24 * 60)) + " ngày trước";
      var clock = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      var dateStr = pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1);
      el.textContent = "🕒 Data cập nhật lần cuối: " + rel + " (" + clock + " " + dateStr + ")";
      el.className = "journey-data-updated" + (mins < 24 * 60 ? " fresh" : "");
      el.hidden = false;
    } catch (e) {
      el.hidden = true;   /* im lặng ẩn nếu lỗi (vd chưa chạy SQL thêm cột) — không toast phiền */
    }
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

  var MONTH_LABEL = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  /* Lịch theo THÁNG DƯƠNG LỊCH (không còn "28 ngày gần nhất") — đủ ô đầu/
     cuối tháng cho thẳng cột T2→CN như 1 cuốn lịch bình thường, có nút ←/→
     đổi tháng. J._log/J._summary.overdueByDate đã tải TOÀN BỘ lịch sử 1
     lần lúc mở Journey (xem J.open) nên đổi tháng chỉ lọc lại phía client,
     không gọi lại server. */
  J.renderCalendar = function () {
    var month = J._calMonth;
    var log = J._log || {};
    var overdueByDate = (J._summary && J._summary.overdueByDate) || {};

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayKey = keyOf(today);

    var y = month.getFullYear(), m = month.getMonth();
    var firstOfMonth = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    /* độn ô trống đầu tháng cho thẳng cột — JS: getDay() 0=Chủ nhật,
       đổi về 0=Thứ 2 cho khớp thứ tự cột DOW ở trên. */
    var firstDow = (firstOfMonth.getDay() + 6) % 7;

    var html = DOW.map(function (x) { return '<div class="jcal-dow">' + x + "</div>"; }).join("");
    for (var p = 0; p < firstDow; p++) html += '<div class="jcell pad"></div>';

    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(y, m, day);
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
                '<span class="jd">' + day + "</span>" + nums +
              "</div>";
    }

    w.$("#journey-cal").innerHTML = html;
    w.$("#jcal-month-label").textContent = "Tháng " + MONTH_LABEL[m] + " / " + y;
    /* Không cho xem sang tháng TƯƠNG LAI (chưa có gì để xem) — quá khứ thì
       không giới hạn, xem lại được bao xa cũng được vì dữ liệu đã tải hết. */
    var isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
    w.$("#jcal-next").disabled = isCurrentMonth;
  };

  J.shiftCalMonth = function (delta) {
    var m = J._calMonth;
    J._calMonth = new Date(m.getFullYear(), m.getMonth() + delta, 1);
    J.renderCalendar();
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

  /* Phân Block vào đúng 1 trong 4 giai đoạn Tony Buzan + due/notDue, cộng
     2 nhóm phụ ngoài 4 giai đoạn (chưa học / đã vào trí nhớ dài hạn) —
     dùng cho 4 chip tổng quan + 4 tab bên dưới. Đếm THEO BLOCK (không
     ước tính theo từ) vì tiến trình chỉ lưu ở cấp Block, và cây này vốn
     đã tải đủ, chính xác 100% — không cần suy ra qua getJourneySummary. */
  function buildGroupStats() {
    var groups = { 1: { due: [], notDue: [] }, 2: { due: [], notDue: [] }, 3: { due: [], notDue: [] }, 4: { due: [], notDue: [] } };
    var notStarted = [], longTerm = [];
    (J._tree.blocks || []).forEach(function (b) {
      var st = w.SRS.state(J._tree.bp[b.id]);
      if (!st.started) { notStarted.push(b); return; }
      if (st.cycle >= w.SRS.MAX_CYCLE) { longTerm.push(b); return; }
      var g = w.SRS.groupOf(st.cycle);
      (st.due ? groups[g].due : groups[g].notDue).push(b);
    });
    return { groups: groups, notStarted: notStarted, longTerm: longTerm };
  }

  function getActiveTab() {
    if (J._activeTab) return J._activeTab;
    var v; try { v = parseInt(localStorage.getItem(LS_JTAB), 10); } catch (e) {}
    return (v >= 1 && v <= 4) ? v : 1;
  }
  function setActiveTab(g) {
    J._activeTab = g;
    try { localStorage.setItem(LS_JTAB, String(g)); } catch (e) {}
  }

  function renderTabs() {
    var active = getActiveTab();
    w.$("#jtabs").innerHTML = [1, 2, 3, 4].map(function (g) {
      return '<button class="jtab-btn' + (g === active ? " active" : "") + '" data-group="' + g + '">' + GROUP_SHORT[g] + "</button>";
    }).join("");
  }

  function blockRowsHtml(list) {
    if (!list.length) return '<div class="jtab-empty">Không có Block nào</div>';
    return list.map(function (b) { return renderRow("block", b); }).join("");
  }

  function renderTabPanel() {
    var g = getActiveTab();
    var gs = J._groupStats;
    var due = gs.groups[g].due, notDue = gs.groups[g].notDue;
    w.$("#jtab-panel").innerHTML =
      '<div class="jtab-sub">' + GROUP_LABEL[g] + "</div>" +
      '<div class="jtab-group-title">🔴 Đến hạn ôn ngay (' + due.length + ")</div>" +
      blockRowsHtml(due) +
      '<div class="jtab-group-title">🟢 Đã ôn, chưa tới hạn kế tiếp (' + notDue.length + ")</div>" +
      blockRowsHtml(notDue);
  }

  function switchTab(g) {
    setActiveTab(g);
    renderTabs();
    renderTabPanel();
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
      w.$("#jtab-panel").innerHTML = '<div class="nav-empty">Không tải được: ' + w.esc(e.message || String(e)) + "</div>";
      return;
    }
    J._agg = buildAgg(J._tree);
    J._byId = indexTree(J._tree);
    J._groupStats = buildGroupStats();

    /* Nếu đang drill sâu mà 1 mắt xích vừa bị xoá ở nơi khác (tab khác,
       hoặc action vừa xoá chính nó) -> lùi breadcrumb về đúng chỗ cuối
       cùng còn tồn tại, không để màn hình trắng/lỗi. */
    for (var i = 0; i < J._crumb.length; i++) {
      var c = J._crumb[i];
      if (!(J._byId[c.level] && J._byId[c.level][c.id])) { J._crumb = J._crumb.slice(0, i); break; }
    }
    renderTabPanel();
    J.renderScope();
  };

  function currentScope() {
    return J._crumb.length ? J._crumb[J._crumb.length - 1] : { level: "root", id: null, name: "Toàn bộ" };
  }

  /* Cây thư mục bên phải — CHỈ để duyệt/nhảy vào học, KHÔNG ảnh hưởng tới
     4 tab Tony Buzan bên trái (khối đó luôn là số toàn app). */
  J.renderScope = function () {
    var scope = currentScope();

    var crumbHtml = '<span class="jcrumb-item' + (!J._crumb.length ? " active" : "") + '" data-idx="-1">🌐 Toàn bộ</span>';
    J._crumb.forEach(function (c, i) {
      crumbHtml += '<span class="jcrumb-sep">›</span><span class="jcrumb-item' +
        (i === J._crumb.length - 1 ? " active" : "") + '" data-idx="' + i + '">' + w.esc(c.name) + "</span>";
    });
    w.$("#journey-crumb").innerHTML = crumbHtml;

    var kids = childrenOf(scope.level === "root" ? "root" : scope.level, scope.id);
    var st = scope.level === "root" ? null : statsFor(scope.level, scope.id);
    w.$("#journey-list-title").textContent =
      (LEVEL_ICON[kids.level] || "🧩") + " " + LEVEL_LABEL[kids.level] +
      (kids.rows.length ? " (" + kids.rows.length + ")" : "") +
      (st ? " · " + st.done + "/" + st.total + " block done" : "");
    w.$("#journey-tree").innerHTML = kids.rows.length
      ? kids.rows.map(function (row) { return renderRow(kids.level, row); }).join("")
      : '<div class="nav-empty">Trống</div>';
  };

  function renderRow(level, row) {
    if (level === "block") {
      var bp = J._tree.bp[row.id] || {};
      var done = bp.passed || bp.meaning_passed;
      return '<div class="jrow jrow-block' + (done ? " done" : "") + '" data-level="block" data-id="' + row.id + '" tabindex="0" role="button">' +
        '<span class="jrow-ic">' + (done ? "✓" : "⭕") + "</span>" +
        '<span class="jrow-name">' + w.esc(row.name) + "</span>" +
        '<span class="jrow-status">' + (done ? "✓ Done" : "Chưa xong") + "</span>" +
        '<button class="jrow-open" data-act="open" title="Mở bài học" aria-label="Mở bài học ' + w.esc(row.name) + '">↗</button>' +
        '<button class="jrow-dots" data-act="menu" title="Thao tác" aria-label="Thao tác với ' + w.esc(row.name) + '">⋯</button>' +
      "</div>";
    }
    var st = statsFor(level, row.id);
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    return '<div class="jrow" data-level="' + level + '" data-id="' + row.id + '" tabindex="0" role="button">' +
      '<span class="jrow-ic">' + LEVEL_ICON[level] + "</span>" +
      '<span class="jrow-name">' + w.esc(row.name) + "</span>" +
      '<span class="jrow-bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="jrow-pct">' + pct + '%</span>' +
      '<span class="jrow-count">' + st.done + "/" + st.total + " block</span>" +
      '<button class="jrow-open" data-act="open" title="Mở tại đây" aria-label="Mở tại đây ' + w.esc(row.name) + '">↗</button>' +
      '<button class="jrow-dots" data-act="menu" title="Thao tác" aria-label="Thao tác với ' + w.esc(row.name) + '">⋯</button>' +
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

  /* Click/bấm phải trong 1 danh sách Block phẳng (tab Tony Buzan) — chỉ
     có 1 cấp (block, lá), không cần logic "drill sâu hơn" như cây bên
     phải, nên tách hàm riêng cho gọn thay vì dùng chung handler cây. */
  async function handleFlatBlockClick(e) {
    var row = e.target.closest(".jrow");
    if (!row) return;
    var id = row.dataset.id;
    var act = e.target.closest("[data-act]");
    if (act && act.dataset.act === "menu") { e.stopPropagation(); await openRowMenu("block", id, act); return; }
    await jumpToRow("block", id);
  }

  /* ══════════════ GẮN SỰ KIỆN ══════════════ */
  w.$("#btn-journey").onclick = function () { J.open(); };
  w.$("#btn-journey-back").onclick = function () { J.close(); };
  w.$("#btn-learning").onclick = function () { J.close(); };
  w.$("#journey-refresh").onclick = function () { J.loadTree(); };
  w.$("#jcal-prev").onclick = function () { J.shiftCalMonth(-1); };
  w.$("#jcal-next").onclick = function () { J.shiftCalMonth(1); };

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

  /* .jrow là <div role="button" tabindex="0"> (xem renderRow ở trên) —
     không phải <button> thật nên bàn phím không tự kích hoạt bằng Enter/
     Space, phải tự bắt phím. Bỏ qua khi phím đang gõ trên chính nút
     "↗"/"⋯" lồng bên trong (đã là <button> thật, tự nhận Enter/Space rồi
     nảy ra sự kiện click ở trên). */
  w.$("#journey-tree").addEventListener("keydown", async function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var row = e.target.closest(".jrow");
    if (!row || e.target.closest("[data-act]")) return;
    e.preventDefault();
    var level = row.dataset.level, id = row.dataset.id;
    if (level === "block") { await jumpToRow(level, id); return; }
    drillInto(level, id);
  });

  w.$("#journey-tree").addEventListener("contextmenu", async function (e) {
    var row = e.target.closest(".jrow");
    if (!row) return;
    e.preventDefault();
    await openRowMenu(row.dataset.level, row.dataset.id, row);
  });

  w.$("#jtabs").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-group]");
    if (!btn) return;
    switchTab(parseInt(btn.dataset.group, 10));
  });
  w.$("#jtab-panel").addEventListener("click", handleFlatBlockClick);
  w.$("#jtab-panel").addEventListener("keydown", async function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var row = e.target.closest(".jrow");
    if (!row || e.target.closest("[data-act]")) return;
    e.preventDefault();
    await jumpToRow("block", row.dataset.id);
  });
  w.$("#jtab-panel").addEventListener("contextmenu", async function (e) {
    var row = e.target.closest(".jrow");
    if (!row) return;
    e.preventDefault();
    await openRowMenu("block", row.dataset.id, row);
  });
})(window);
