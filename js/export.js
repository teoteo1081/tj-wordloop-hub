/* export.js — XUẤT PDF (in đẹp) THEO BLOCK / BATCH / PAGE / SECTION / NOTEBOOK
   ------------------------------------------------------------------------
   Không dùng thư viện PDF nào cả: dựng sẵn 1 khối HTML sạch — chữ to,
   không có nút bấm hay giao diện thao tác — rồi gọi window.print(). Người
   dùng tự chọn "Lưu dưới dạng PDF" ở hộp in của chính trình duyệt. Toàn bộ
   phần còn lại của trang bị ẩn đi lúc in bằng CSS @media print (xem
   app.css, khối "IN PDF"). */
(function (w) {
  "use strict";

  var E = {};
  var WARN_BLOCKS = 30;   /* xuất nhiều hơn ngần này Block thì hỏi lại trước khi in, đỡ đứng máy bất ngờ */

  function S() { return w.S; }

  /* ══════════════ GOM BLOCK THEO TỪNG CẤP ══════════════ */
  function blocksOfPage(pageId) {
    var out = [];
    w.App.batchesOf(pageId).forEach(function (bt) { out = out.concat(w.App.blocksOf(bt.id)); });
    return out;
  }
  function pagesOfSection(sectionId) {
    return S().pages.filter(function (p) { return p.section_id === sectionId; });
  }
  function blocksOfSection(sectionId) {
    var out = [];
    pagesOfSection(sectionId).forEach(function (p) { out = out.concat(blocksOfPage(p.id)); });
    return out;
  }
  function sectionsOfNotebook(notebookId) {
    return S().sections.filter(function (s) { return s.notebook_id === notebookId; });
  }
  function blocksOfNotebook(notebookId) {
    var out = [];
    sectionsOfNotebook(notebookId).forEach(function (s) { out = out.concat(blocksOfSection(s.id)); });
    return out;
  }

  E.blocksOfScope = function (kind, id) {
    switch (kind) {
      case "block": {
        var b = S().blocks.find(function (x) { return x.id === id; });
        return b ? [b] : [];
      }
      case "batch": return w.App.blocksOf(id);
      case "page": return blocksOfPage(id);
      case "section": return blocksOfSection(id);
      case "notebook": return blocksOfNotebook(id);
      default: return [];
    }
  };

  /* ══════════════ CÁC LỰA CHỌN CẤP XUẤT — TUỲ NƠI ĐANG ĐỨNG ══════════════
     Chỉ hiện cấp nào ĐANG THỰC SỰ CHỌN — mở app lên chưa bấm gì thì
     danh sách này rỗng, nút Xuất PDF báo lỗi nhẹ thay vì mở hộp trống. */
  E.scopeOptions = function () {
    var s = S(), opts = [];
    var blockId = w.Detail && w.Detail.blockId;

    if (blockId) {
      var blk = s.blocks.find(function (x) { return x.id === blockId; });
      if (blk) opts.push({ kind: "block", id: blk.id, name: blk.name, label: "Block đang xem" });
    }
    if (s.batchId) {
      var bt = s.batches.find(function (x) { return x.id === s.batchId; });
      if (bt) opts.push({ kind: "batch", id: bt.id, name: bt.name, label: "Batch đang chọn" });
    }
    if (s.pageId) {
      var pg = s.pages.find(function (x) { return x.id === s.pageId; });
      if (pg) opts.push({ kind: "page", id: pg.id, name: pg.name, label: "Page đang chọn" });
    }
    if (s.sectionId) {
      var sec = s.sections.find(function (x) { return x.id === s.sectionId; });
      if (sec) opts.push({ kind: "section", id: sec.id, name: sec.name, label: "Section đang chọn" });
    }
    if (s.notebookId) {
      var nb = s.notebooks.find(function (x) { return x.id === s.notebookId; });
      if (nb) opts.push({ kind: "notebook", id: nb.id, name: nb.name, label: "Notebook đang chọn" });
    }
    return opts;
  };

  /* ══════════════ DỰNG HTML IN ĐẸP CHO 1 BLOCK ══════════════ */
  function blockPrintHtml(block) {
    var ws = w.App.wordsOf(block.id);
    var meta = w.Context.parseMeta(block.context_passage || "");

    var vocabTable = "";
    if (ws.length) {
      vocabTable =
        '<table class="pv-table"><thead><tr>' +
          "<th>Từ vựng</th><th>Cấp độ</th><th>Phiên âm</th><th>Định nghĩa (EN)</th><th>Nghĩa (VI)</th>" +
        "</tr></thead><tbody>" +
        ws.map(function (x) {
          return "<tr><td><b>" + w.esc(x.term) + "</b></td>" +
            "<td>" + w.esc(x.level || "—") + "</td>" +
            "<td>" + w.esc(x.ipa || "—") + "</td>" +
            "<td>" + w.esc(x.def_en || "—") + "</td>" +
            "<td>" + w.esc(x.meaning_vi || "—") + "</td></tr>";
        }).join("") +
        "</tbody></table>";
    }

    var passageHtml = "";
    if (meta.marked) {
      var built = w.Context.build(meta.marked);
      var paras = built.plain.split(/\n\s*\n/).filter(function (p) { return p.trim(); });
      if (paras.length) {
        /* Không còn bịa tiêu đề từ 1 danh sách cố định nữa — có tiêu đề
           thật (AI sinh/bạn tự đặt) thì dùng, không thì lấy tên Block. */
        var title = meta.title || block.name;
        passageHtml =
          '<h3 class="pv-passage-title">📖 ' + w.esc(title) + "</h3>" +
          '<div class="pv-passage">' +
            paras.map(function (p) { return "<p>" + w.esc(p.trim()) + "</p>"; }).join("") +
          "</div>";
      }
    }

    var withDef = ws.filter(function (x) { return x.def_en; });
    var glossaryHtml = withDef.length
      ? '<div class="pv-glossary"><div class="pv-glossary-title">Glossary</div>' +
        withDef.map(function (x) {
          return "<div><b>" + w.esc(x.term) + "</b> — " + w.esc(x.def_en) +
                 (x.meaning_vi ? " <i>(" + w.esc(x.meaning_vi) + ")</i>" : "") + "</div>";
        }).join("") + "</div>"
      : "";

    return '<section class="pv-block">' +
      "<h2>📕 " + w.esc(block.name) + "</h2>" +
      vocabTable + passageHtml + glossaryHtml +
      "</section>";
  }

  /* ══════════════ MỞ HỘP THOẠI XUẤT ══════════════ */
  E.openModal = function () {
    var opts = E.scopeOptions();
    if (!opts.length) { w.toast("Hãy chọn 1 Notebook/Section/Page/Batch/Block trước đã", "err"); return; }

    var m = w.$("#modal-export");
    w.$("#export-scope-list").innerHTML = opts.map(function (o, i) {
      return '<label class="user-row' + (i === 0 ? " active" : "") + '">' +
        '<input type="radio" name="export-scope" value="' + i + '"' + (i === 0 ? " checked" : "") + '> ' +
        "<b>" + w.esc(o.label) + "</b> — " + w.esc(o.name) +
      "</label>";
    }).join("");
    w.$("#export-title").value = opts[0].name;

    w.$$('input[name="export-scope"]', m).forEach(function (r, i) {
      r.onchange = function () {
        w.$("#export-title").value = opts[i].name;
        w.$$(".user-row", w.$("#export-scope-list")).forEach(function (row, j) {
          row.classList.toggle("active", j === i);
        });
      };
    });

    m.hidden = false;
    w.$("#export-title").focus();

    w.$("#export-go").onclick = async function () {
      var checked = m.querySelector('input[name="export-scope"]:checked');
      var i = checked ? +checked.value : 0;
      var scope = opts[i];
      var title = w.$("#export-title").value.trim() || scope.name;
      var sizeEl = m.querySelector('input[name="export-size"]:checked');
      var size = sizeEl ? sizeEl.value : "normal";

      var blocks = E.blocksOfScope(scope.kind, scope.id);
      if (!blocks.length) { w.toast("Không có Block nào để xuất", "err"); return; }

      if (blocks.length > WARN_BLOCKS) {
        var ok = await w.App.askConfirm({
          title: "Xuất " + blocks.length + " Block",
          desc: "Khá nhiều nội dung (" + blocks.length + " Block, khoảng " + (blocks.length * 10) +
                " từ) — trình duyệt có thể mất một lúc để dựng bản in. Vẫn tiếp tục?"
        });
        if (!ok) return;
      }

      m.hidden = true;
      E.print(title, blocks, size);
    };
  };

  /* ══════════════ DỰNG BẢN IN + GỌI window.print() ══════════════ */
  E.print = function (title, blocks, size) {
    var root = w.$("#print-root");
    root.className = "print-" + size;
    root.innerHTML =
      '<div class="pv-cover"><h1>' + w.esc(title) + "</h1>" +
        '<div class="pv-cover-sub">' + blocks.length + " Block · " +
        new Date().toLocaleDateString("vi-VN") + " · TJ WordLoop Hub</div>" +
      "</div>" +
      blocks.map(blockPrintHtml).join("");

    /* chờ 1 nhịp cho trình duyệt vẽ xong nội dung mới rồi mới mở hộp in */
    setTimeout(function () { window.print(); }, 60);
  };

  w.Export = E;
})(window);
