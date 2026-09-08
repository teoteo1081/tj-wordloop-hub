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

  function renderHome(t) {
    var hubs = (t.hubs || []).slice().sort(bySort);
    if (!hubs.length) return '<div class="nav-empty">Chưa có Hub nào — bấm "+" ở thanh trên để thêm.</div>';

    var byNotebook = blocksByNotebook(t);
    var notebooksByHub = {};
    (t.notebooks || []).forEach(function (n) { (notebooksByHub[n.hub_id] = notebooksByHub[n.hub_id] || []).push(n); });

    return hubs.map(function (h) {
      var nbs = (notebooksByHub[h.id] || []).slice().sort(bySort);
      var cardsHtml = nbs.length
        ? nbs.map(function (n) { return notebookCardHtml(h, n, byNotebook[n.id] || [], t.bp); }).join("")
        : '<div class="nav-empty">Chưa có Notebook nào trong Hub này</div>';
      return '<div class="home-hub-block">' +
        '<div class="home-hub-title">🗂 ' + w.esc(h.name) + "</div>" +
        '<div class="home-cards">' + cardsHtml + "</div>" +
      "</div>";
    }).join("");
  }

  function notebookCardHtml(hub, nb, blockIds, bp) {
    var done = 0;
    blockIds.forEach(function (bid) { var r = bp[bid]; if (r && (r.passed || r.meaning_passed)) done++; });
    var total = blockIds.length;
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="home-card" data-hub="' + hub.id + '" data-notebook="' + nb.id + '" tabindex="0" role="button">' +
      '<div class="home-card-ic">📓</div>' +
      '<div class="home-card-body">' +
        '<div class="home-card-name">' + w.esc(nb.name) + "</div>" +
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
    await w.App.jumpTo({ hubId: card.dataset.hub, notebookId: card.dataset.notebook });
  });
  w.$("#home-hubs").addEventListener("keydown", async function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest(".home-card");
    if (!card) return;
    e.preventDefault();
    await w.App.jumpTo({ hubId: card.dataset.hub, notebookId: card.dataset.notebook });
  });
})(window);
