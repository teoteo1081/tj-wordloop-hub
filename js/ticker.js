/* ticker.js — Thanh "đánh máy" chạy các từ ĐÃ HỌC (Block done) trong Page
   đang mở, để tiện lướt ôn thụ động trong lúc học. Bấm vào chữ đang chạy sẽ
   nhảy thẳng vào đúng Block chứa từ đó để ôn lại kỹ hơn nếu cần.

   - Danh sách từ KHÔNG cache — pool() đọc thẳng w.S mỗi vòng lặp, nên luôn
     khớp tiến trình mới nhất (Block vừa Done xong là hiện liền, không cần
     ai gọi "refresh" thủ công ở mọi chỗ lưu điểm).
   - Thứ tự thường (seq) / ngẫu nhiên (rand) — nhớ lựa chọn qua localStorage.
   - Desktop: kéo thả đổi vị trí (nhớ vị trí); Mobile: cố định 1 chỗ (trên
     thanh mobile-nav), không có tay kéo — màn nhỏ kéo thả dễ vướng thao tác. */
(function (w) {
  "use strict";

  var LS_VISIBLE = "tjwl_ticker_visible_v1";
  var LS_ORDER = "tjwl_ticker_order_v1";   /* "seq" | "rand" */
  var LS_POS = "tjwl_ticker_pos_v1";       /* {right, bottom} px — chỉ desktop */

  var T = {};
  w.Ticker = T;

  var elBar, elText, elOrderBtn, elToggle, elDrag;
  var timer = null, seqIdx = 0, lastId = null, typing = false;

  function isMobile() { return window.matchMedia("(max-width:760px)").matches; }

  function getOrder() { try { return localStorage.getItem(LS_ORDER) || "rand"; } catch (e) { return "rand"; } }
  function setOrder(v) { try { localStorage.setItem(LS_ORDER, v); } catch (e) {} }
  function getVisible() { try { return localStorage.getItem(LS_VISIBLE) !== "0"; } catch (e) { return true; } }
  function setVisible(v) { try { localStorage.setItem(LS_VISIBLE, v ? "1" : "0"); } catch (e) {} }

  /* Danh sách {id, term, vi, blockId} của mọi từ thuộc Block ĐÃ DONE
     (bp.passed || bp.meaning_passed) trong Page đang mở. */
  function pool() {
    var S = w.S;
    if (!S || !S.pageId || !S.batches || !S.blocks) return [];
    var batchIds = S.batches.filter(function (b) { return b.page_id === S.pageId; })
      .map(function (b) { return b.id; });
    if (!batchIds.length) return [];
    var doneBlocks = S.blocks.filter(function (bl) {
      if (batchIds.indexOf(bl.batch_id) === -1) return false;
      var bp = S.bp[bl.id];
      return bp && (bp.passed || bp.meaning_passed);
    });
    var out = [];
    doneBlocks.forEach(function (bl) {
      S.words.filter(function (x) { return x.block_id === bl.id; }).forEach(function (x) {
        out.push({ id: x.id, term: x.term, vi: x.meaning_vi || "", blockId: bl.id });
      });
    });
    return out;
  }

  function pickNext(list) {
    if (!list.length) return null;
    if (getOrder() === "seq") {
      seqIdx = seqIdx % list.length;
      var item = list[seqIdx];
      seqIdx++;
      return item;
    }
    if (list.length === 1) return list[0];
    var item;
    do { item = list[Math.floor(Math.random() * list.length)]; } while (item.id === lastId);
    return item;
  }

  function typeText(full, cb) {
    var i = 0;
    (function step() {
      if (!typing) return;
      elText.textContent = full.slice(0, i);
      i++;
      timer = i <= full.length ? setTimeout(step, 42) : setTimeout(cb, 1400);
    })();
  }
  function eraseText(cb) {
    var cur = elText.textContent;
    (function step() {
      if (!typing) return;
      cur = cur.slice(0, -1);
      elText.textContent = cur;
      timer = cur.length ? setTimeout(step, 22) : setTimeout(cb, 260);
    })();
  }

  function loop() {
    if (!typing) return;
    var list = pool();
    if (!list.length) {
      elText.textContent = "Chưa có từ nào đã học trong Page này…";
      elText.removeAttribute("data-block-id");
      timer = setTimeout(loop, 3000);
      return;
    }
    var item = pickNext(list);
    lastId = item.id;
    elText.dataset.blockId = item.blockId;
    var full = item.term + "  —  " + (item.vi || "…");
    typeText(full, function () { eraseText(loop); });
  }

  function startTyping() { if (!typing) { typing = true; loop(); } }
  function stopTyping() { typing = false; if (timer) { clearTimeout(timer); timer = null; } }

  function applyVisible() {
    var v = getVisible();
    elBar.hidden = !v;
    if (v) startTyping(); else stopTyping();
  }

  function applyOrderIcon() {
    var seq = getOrder() === "seq";
    elOrderBtn.textContent = seq ? "🔢" : "🔀";
    elOrderBtn.title = seq ? "Đang chạy: Theo thứ tự (bấm để đổi ngẫu nhiên)" : "Đang chạy: Ngẫu nhiên (bấm để đổi theo thứ tự)";
  }

  function applyPos() {
    if (isMobile()) { elBar.style.right = ""; elBar.style.bottom = ""; return; }
    try {
      var p = JSON.parse(localStorage.getItem(LS_POS) || "null");
      if (p && typeof p.right === "number" && typeof p.bottom === "number") {
        elBar.style.right = p.right + "px";
        elBar.style.bottom = p.bottom + "px";
      }
    } catch (e) {}
  }

  function jumpToWord(blockId) {
    var S = w.S;
    var bl = S.blocks.find(function (b) { return b.id === blockId; });
    if (!bl) return;
    S.batchId = bl.batch_id;
    if (w.App && w.App.renderBatches) { try { w.App.renderBatches(); } catch (e) {} }
    if (w.Detail && w.Detail.open) w.Detail.open(blockId);
  }

  /* Kéo thả — chỉ desktop. Điện thoại không có tay kéo, cố định 1 chỗ
     ngay trên thanh mobile-nav (xem CSS). */
  function bindDrag() {
    var dragging = false, startX, startY, startRight, startBottom;
    elDrag.addEventListener("pointerdown", function (e) {
      if (isMobile()) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      var r = elBar.getBoundingClientRect();
      startRight = window.innerWidth - r.right;
      startBottom = window.innerHeight - r.bottom;
      try { elDrag.setPointerCapture(e.pointerId); } catch (e2) {}
    });
    elDrag.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      elBar.style.right = Math.max(4, startRight - dx) + "px";
      elBar.style.bottom = Math.max(4, startBottom - dy) + "px";
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      try {
        localStorage.setItem(LS_POS, JSON.stringify({
          right: parseInt(elBar.style.right, 10) || 16,
          bottom: parseInt(elBar.style.bottom, 10) || 16
        }));
      } catch (e) {}
    }
    elDrag.addEventListener("pointerup", endDrag);
    elDrag.addEventListener("pointercancel", endDrag);
  }

  /* Gọi khi Page/Notebook đổi — pool() vốn tự đọc S mới nhất, chỉ cần reset
     con trỏ thứ tự cho gọn (đổi Page mà đang ở giữa danh sách cũ thì nhảy
     lộn xộn 1 nhịp, không sai gì, nhưng reset cho mượt hơn). */
  T.refresh = function () { seqIdx = 0; };

  function bind() {
    elBar = w.$("#word-ticker"); elText = w.$("#wt-text");
    elOrderBtn = w.$("#wt-order"); elToggle = w.$("#wt-toggle"); elDrag = w.$("#wt-drag");
    if (!elBar || !elToggle) return;

    elToggle.onclick = function () { setVisible(!!elBar.hidden); applyVisible(); };
    w.$("#wt-hide").onclick = function () { setVisible(false); applyVisible(); };
    elOrderBtn.onclick = function () { setOrder(getOrder() === "seq" ? "rand" : "seq"); applyOrderIcon(); };
    elText.onclick = function () {
      var id = elText.dataset.blockId;
      if (id) jumpToWord(id);
    };

    applyOrderIcon();
    applyPos();
    applyVisible();
    bindDrag();
    window.addEventListener("resize", applyPos);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(window);
