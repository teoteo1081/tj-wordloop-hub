/* home.js — Màn "🏠 Trang chủ": toàn bộ cây thư mục hiển thị dạng THẺ LỚN,
   mỗi Notebook 1 thẻ (kiểu trang chọn khoá học Memrise — community-courses
   dashboard), gom theo Hub thành từng hàng. Bấm 1 thẻ = nhảy thẳng vào
   Notebook đó trên màn học chính (App.jumpTo, y hệt cây "Theo cây thư mục"
   trong Journey). Đây CHỈ là màn điều hướng — không có số liệu riêng, dùng
   lại DB.getFullTree (đã tải kèm block_progress) để tính % mỗi Notebook. */
(function (w) {
  "use strict";

  var H = {};
  w.Home = H;

  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  /* ══════════════ MỞ / ĐÓNG ══════════════ */
  H.open = async function () {
    w.Speech.stop();
    H._prevWasDetail = !w.$("#screen-detail").hidden;
    w.$("#screen-blocks").hidden = true;
    w.$("#screen-detail").hidden = true;
    w.$("#screen-leaderboard").hidden = true;
    w.$("#screen-journey").hidden = true;
    w.$("#btn-back").hidden = true;
    w.$("#screen-home").hidden = false;
    w.$("#btn-learning").hidden = false;
    w.$("#workspace").scrollTop = 0;
    await H.load();
  };

  H.close = function () {
    w.$("#screen-home").hidden = true;
    w.$("#btn-learning").hidden = true;
    if (H._prevWasDetail && w.Detail && w.Detail.blockId) {
      w.$("#screen-detail").hidden = false;
      w.$("#btn-back").hidden = false;
    } else {
      w.$("#screen-blocks").hidden = false;
    }
  };

  /* ══════════════ TẢI + TÍNH % MỖI NOTEBOOK ══════════════ */
  /* Gom sẵn Block nào thuộc Notebook nào (đi từ đáy Batch lên) — cùng cách
     buildAgg() trong journey.js, viết lại riêng ở đây cho gọn (không lệ
     thuộc biến nội bộ của journey.js). */
  function blocksByNotebook(t) {
    var blocksByBatch = {}, batchesByPage = {}, pagesBySection = {}, sectionsByNotebook = {};
    t.blocks.forEach(function (b) { (blocksByBatch[b.batch_id] = blocksByBatch[b.batch_id] || []).push(b.id); });
    t.batches.forEach(function (b) { (batchesByPage[b.page_id] = batchesByPage[b.page_id] || []).push(b.id); });
    t.pages.forEach(function (p) { (pagesBySection[p.section_id] = pagesBySection[p.section_id] || []).push(p.id); });
    t.sections.forEach(function (s) { (sectionsByNotebook[s.notebook_id] = sectionsByNotebook[s.notebook_id] || []).push(s.id); });

    function flat(ids, map) {
      var out = [];
      (ids || []).forEach(function (id) { out = out.concat(map[id] || []); });
      return out;
    }
    var blocksOfPage = {}, blocksOfSection = {}, blocksOfNotebook = {};
    Object.keys(batchesByPage).forEach(function (pid) { blocksOfPage[pid] = flat(batchesByPage[pid], blocksByBatch); });
    Object.keys(pagesBySection).forEach(function (sid) { blocksOfSection[sid] = flat(pagesBySection[sid], blocksOfPage); });
    Object.keys(sectionsByNotebook).forEach(function (nid) { blocksOfNotebook[nid] = flat(sectionsByNotebook[nid], blocksOfSection); });
    return blocksOfNotebook;
  }

  H.load = async function () {
    var box = w.$("#home-hubs");
    box.innerHTML = '<div class="nav-empty">Đang tải…</div>';
    var uid = w.Auth.user && w.Auth.user.id;
    var t;
    try {
      t = await w.DB.getFullTree(uid);
    } catch (e) {
      box.innerHTML = '<div class="nav-empty">Không tải được: ' + w.esc(e.message || String(e)) + "</div>";
      return;
    }
    box.innerHTML = renderHome(t);
  };

  /* Notebook giờ lồng được vào nhau (thư mục mẹ/con, xem renderNotebooks
     trong app.js) — Trang chủ chỉ hiện Notebook CẤP GỐC (không cha) làm
     thẻ chính; Notebook con hiện thành thẻ NHỎ HƠN, nhóm ngay bên trong
     thẻ mẹ (không rải phẳng ngang hàng nữa, kẻo trùng lặp/rối vì con đã
     có mặt "bên trong" mẹ rồi). % hoàn thành của thẻ mẹ CHỈ tính Section/
     Page riêng của chính nó (không cộng dồn của Notebook con — 2 con số
     tách biệt, xem blocksByNotebook: mỗi Notebook chỉ gom Section có đúng
     notebook_id của nó). */
  function renderHome(t) {
    var hubs = (t.hubs || []).slice().sort(bySort);
    if (!hubs.length) return '<div class="nav-empty">Chưa có Hub nào — bấm "+" ở thanh trên để thêm.</div>';

    var byNotebook = blocksByNotebook(t);
    /* Lọc Notebook "restricted" mà user hiện tại không được share (Share,
       Mức A) — dùng CHUNG hàm lọc với sidebar (App.notebookAllowedForUser
       trong app.js), tránh viết lại logic đi ngược parent chain 2 lần. */
    var visibleNbs = (t.notebooks || []).filter(function (n) {
      return !w.App.notebookAllowedForUser || w.App.notebookAllowedForUser(n.id, t.notebooks);
    });
    var notebooksByHub = {};
    visibleNbs.forEach(function (n) { (notebooksByHub[n.hub_id] = notebooksByHub[n.hub_id] || []).push(n); });

    return hubs.map(function (h) {
      var allNbs = (notebooksByHub[h.id] || []).slice().sort(bySort);
      var byParent = {};
      allNbs.forEach(function (n) { var pid = n.parent_notebook_id || "_root"; (byParent[pid] = byParent[pid] || []).push(n); });
      var topNbs = byParent._root || [];
      var cardsHtml = topNbs.length
        ? topNbs.map(function (n) { return notebookGroupHtml(h, n, byNotebook, t.bp, byParent); }).join("")
        : '<div class="nav-empty">Chưa có Notebook nào trong Hub này</div>';
      return '<div class="home-hub-block" data-hubid="' + h.id + '">' +
        '<div class="home-hub-title">🗂 ' + w.esc(h.name) + "</div>" +
        '<div class="home-cards">' + cardsHtml + "</div>" +
      "</div>";
    }).join("");
  }

  function notebookGroupHtml(hub, nb, byNotebook, bp, byParent) {
    var children = (byParent[nb.id] || []).slice().sort(bySort);
    return '<div class="home-group">' +
      notebookCardHtml(hub, nb, byNotebook[nb.id] || [], bp, false, children.length) +
      (children.length
        ? '<div class="home-subcards">' + children.map(function (c) {
            return notebookCardHtml(hub, c, byNotebook[c.id] || [], bp, true, 0);
          }).join("") + "</div>"
        : "") +
    "</div>";
  }

  /* data-nb (KHÔNG dùng "data-hub" trên chính thẻ này — App.metaOf trong
     app.js kiểm tra "dataset.hub" TRƯỚC "dataset.nb", có cả 2 trên cùng
     1 phần tử sẽ bị hiểu nhầm thành Hub thay vì Notebook lúc kéo-thả; hub
     cha lưu riêng ở "data-jump-hub" chỉ để bấm-mở dùng, không đụng gì
     tới hệ kéo-thả chung của App.bindDrag/dropInfo) + draggable="true" ->
     dùng CHUNG được toàn bộ hệ kéo-thả/lồng Notebook đã có sẵn ở sidebar
     (App.bindDrag đã gắn sự kiện lên "document", không cần bind riêng gì
     thêm ở màn này). */
  function notebookCardHtml(hub, nb, blockIds, bp, isSub, childCount) {
    var done = 0;
    blockIds.forEach(function (bid) { var r = bp[bid]; if (r && (r.passed || r.meaning_passed)) done++; });
    var total = blockIds.length;
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="home-card' + (isSub ? " sub" : "") + '" data-jump-hub="' + hub.id + '" data-nb="' + nb.id +
      '" draggable="true" tabindex="0" role="button" aria-label="Mở Notebook ' + w.esc(nb.name) + '">' +
      '<div class="home-card-ic">' + (childCount ? "🗂️" : "📓") + '</div>' +
      '<div class="home-card-body">' +
        '<div class="home-card-name">' + w.esc(nb.name) +
          (childCount ? ' <span class="home-card-subcount">· ' + childCount + " con</span>" : "") + "</div>" +
        '<div class="home-card-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="home-card-meta">' + pct + "% · " + done + "/" + total + " block done</div>" +
      "</div>" +
      '<button class="home-card-go" title="Vào học" aria-label="Vào học ' + w.esc(nb.name) + '">→</button>' +
    "</div>";
  }

  /* ══════════════ GẮN SỰ KIỆN ══════════════ */
  w.$("#btn-home").onclick = function () { H.open(); };
  w.$("#btn-home-back").onclick = function () { H.close(); };
  w.$("#home-refresh").onclick = function () { H.load(); };

  w.$("#home-hubs").addEventListener("click", async function (e) {
    var card = e.target.closest(".home-card");
    if (!card) return;
    await w.App.jumpTo({ hubId: card.dataset.jumpHub, notebookId: card.dataset.nb });
  });
  w.$("#home-hubs").addEventListener("keydown", async function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest(".home-card");
    if (!card) return;
    e.preventDefault();
    await w.App.jumpTo({ hubId: card.dataset.jumpHub, notebookId: card.dataset.nb });
  });
})(window);
