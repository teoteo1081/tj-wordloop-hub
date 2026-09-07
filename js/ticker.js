/* ticker.js — Thanh "đánh máy" chạy các từ ĐÃ HỌC (Block done) trong cả
   Notebook đang mở, để tiện lướt ôn thụ động trong lúc học. Mỗi từ là 1
   "chip" màu riêng, gõ ra lấp đầy hàng ngang; đầy rồi thì mỗi từ mới gõ
   ra là cả dải lại trôi (drift) sang trái 1 nhịp để nhường chỗ — kiểu
   băng chuyền, không xoá sạch làm lại như bảng điện tử thường thấy. Bấm
   vào 1 chip để nhảy thẳng vào Block chứa từ đó ôn lại kỹ hơn nếu cần.

   - Danh sách từ KHÔNG cache — pool() đọc thẳng w.S mỗi vòng lặp, nên
     luôn khớp tiến trình mới nhất.
   - Thứ tự thường (seq) / ngẫu nhiên (rand) — nhớ lựa chọn qua localStorage.
   - Desktop: kéo thả đổi vị trí (nhớ vị trí); Mobile: cố định 1 chỗ (trên
     thanh mobile-nav), không có tay kéo — màn nhỏ kéo thả dễ vướng thao tác. */
(function (w) {
  "use strict";

  var LS_VISIBLE = "tjwl_ticker_visible_v1";
  var LS_ORDER = "tjwl_ticker_order_v1";   /* "seq" | "rand" */
  var LS_POS = "tjwl_ticker_pos_v1";       /* {right, bottom} px — chỉ desktop */
  var N_COLORS = 5;                        /* khớp .wt-chip.k0..k4 trong app.css */
  var SHIFT_MS = 620;                      /* khớp .6s transition của .wt-strip + chút dư */
  var TYPE_MS = 62;                        /* mỗi ký tự gõ ra cách nhau — chậm rãi cho dễ đọc */
  var DWELL_MS = 1300;                     /* nghỉ sau khi gõ xong 1 từ trước khi tiếp tục */

  var T = {};
  w.Ticker = T;

  var elBar, elViewport, elStrip, elOrderBtn, elToggle, elDrag;
  var timer = null, seqIdx = 0, lastId = null, typing = false, colorIdx = 0;

  function isMobile() { return window.matchMedia("(max-width:760px)").matches; }

  function getOrder() { try { return localStorage.getItem(LS_ORDER) || "rand"; } catch (e) { return "rand"; } }
  function setOrder(v) { try { localStorage.setItem(LS_ORDER, v); } catch (e) {} }
  function getVisible() { try { return localStorage.getItem(LS_VISIBLE) !== "0"; } catch (e) { return true; } }
  function setVisible(v) { try { localStorage.setItem(LS_VISIBLE, v ? "1" : "0"); } catch (e) {} }

  /* Danh sách {id, term, vi, blockId} của mọi từ thuộc Block ĐÃ DONE
     (bp.passed || bp.meaning_passed) trong CẢ Notebook đang mở — S.blocks/
     S.words trong app.js vốn đã chỉ chứa đúng Notebook đang mở (xem quy
     ước ở đầu app.js), nên không cần lọc thêm theo Page/Batch nữa. */
  function pool() {
    var S = w.S;
    if (!S || !S.blocks || !S.words) return [];
    var doneBlocks = S.blocks.filter(function (bl) {
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

  /* ── Băng chuyền: strip là 1 hàng flex dịch bằng transform, viewport cắt
     phần thừa. Đầy khung thì trôi sang trái đúng 1 chip trước khi gõ tiếp;
     chip vừa trôi khuất hẳn thì xoá khỏi DOM + "bù" transform lại — kiểu
     marquee vô hạn, không phình DOM theo thời gian. ── */
  function gapPx() {
    if (!elStrip) return 6;
    var cs = getComputedStyle(elStrip);
    var g = parseFloat(cs.columnGap || cs.gap || "6");
    return isNaN(g) ? 6 : g;
  }
  function currentShiftX() {
    var m = /translateX\((-?[\d.]+)px\)/.exec(elStrip.style.transform || "");
    return m ? parseFloat(m[1]) : 0;
  }
  function viewportWidth() { return elViewport ? elViewport.clientWidth : 300; }

  function nextColorClass() {
    var cls = "k" + (colorIdx % N_COLORS);
    colorIdx++;
    return cls;
  }

  function addChip(item) {
    var chip = document.createElement("span");
    chip.className = "wt-chip " + nextColorClass();
    chip.dataset.blockId = item.blockId;
    elStrip.appendChild(chip);
    return chip;
  }

  function typeChipText(chip, full, cb) {
    var i = 0;
    chip.classList.add("typing");
    (function step() {
      if (!typing) return;
      chip.textContent = full.slice(0, i);
      i++;
      if (i <= full.length) { timer = setTimeout(step, TYPE_MS); }
      else { chip.classList.remove("typing"); timer = setTimeout(cb, DWELL_MS); }
    })();
  }

  function shiftLeftBy(px, cb) {
    elStrip.style.transform = "translateX(" + (currentShiftX() - px) + "px)";
    timer = setTimeout(cb, SHIFT_MS);
  }

  /* Sau khi trôi đúng 1 chip-footprint, chip cũ nhất (đầu dải) chắc chắn
     đã khuất hẳn khỏi khung nhìn — xoá nó + cộng lại transform đúng bằng
     phần vừa trôi, để số không âm dần vô hạn mà hình không hề nhảy giật
     (bù trừ đúng nhau, mắt không thấy khác biệt). */
  function removeOffscreenChip(stepPx) {
    if (!typing || !elStrip.firstElementChild) return;
    var oldest = elStrip.firstElementChild;
    elStrip.style.transition = "none";
    elStrip.removeChild(oldest);
    elStrip.style.transform = "translateX(" + (currentShiftX() + stepPx) + "px)";
    void elStrip.offsetWidth;   /* ép reflow để lần transition kế tiếp có hiệu lực */
    elStrip.style.transition = "";
  }

  function loop() {
    if (!typing) return;
    var list = pool();
    if (!list.length) {
      elStrip.style.transition = "none";
      elStrip.innerHTML = '<span class="wt-chip" style="background:transparent;color:var(--text-3);font-style:italic;padding:0;">Chưa có từ nào đã học…</span>';
      elStrip.style.transform = "translateX(0px)";
      void elStrip.offsetWidth;
      elStrip.style.transition = "";
      timer = setTimeout(loop, 3000);
      return;
    }

    var item = pickNext(list);
    lastId = item.id;
    var full = item.term + "  —  " + (item.vi || "…");

    function typeInPlace() {
      var chip = addChip(item);
      typeChipText(chip, full, loop);
    }

    /* Còn placeholder "chưa có từ" từ vòng trước -> dọn trước khi gõ thật */
    if (elStrip.children.length === 1 && !elStrip.firstElementChild.dataset.blockId) {
      elStrip.innerHTML = "";
    }

    var used = elStrip.scrollWidth + currentShiftX();   /* phần nội dung đã hiện trong khung, tính từ mép trái */
    if (used >= viewportWidth() - 4 && elStrip.children.length) {
      var oldest = elStrip.firstElementChild;
      var stepPx = oldest.offsetWidth + gapPx();
      shiftLeftBy(stepPx, function () {
        removeOffscreenChip(stepPx);
        typeInPlace();
      });
    } else {
      typeInPlace();
    }
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

  /* Gọi khi Page/Notebook đổi — pool() vốn tự đọc S mới nhất, chỉ cần
     reset con trỏ thứ tự cho gọn. KHÔNG xoá dải chip đang trôi dở (renderAll
     gọi hàm này rất thường xuyên — mọi thao tác thêm/xoá/sửa đều gọi lại,
     xoá sạch mỗi lần vậy sẽ giật hình liên tục, phản tác dụng). */
  T.refresh = function () { seqIdx = 0; };

  function bind() {
    elBar = w.$("#word-ticker"); elViewport = w.$(".wt-viewport", elBar);
    elStrip = w.$("#wt-strip");
    elOrderBtn = w.$("#wt-order"); elToggle = w.$("#wt-toggle"); elDrag = w.$("#wt-drag");
    if (!elBar || !elToggle || !elStrip) return;

    elToggle.onclick = function () { setVisible(!!elBar.hidden); applyVisible(); };
    w.$("#wt-hide").onclick = function () { setVisible(false); applyVisible(); };
    elOrderBtn.onclick = function () { setOrder(getOrder() === "seq" ? "rand" : "seq"); applyOrderIcon(); };
    elStrip.addEventListener("click", function (e) {
      var chip = e.target.closest(".wt-chip");
      var id = chip && chip.dataset.blockId;
      if (id) jumpToWord(id);
    });

    applyOrderIcon();
    applyPos();
    applyVisible();
    bindDrag();
    window.addEventListener("resize", applyPos);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(window);
