/* util.js — các hàm dùng chung */
(function (w) {
  "use strict";

  w.$  = function (sel, root) { return (root || document).querySelector(sel); };
  w.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  w.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  w.uid = function (prefix) {
    return (prefix || "id") + "_" +
      Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 8);
  };

  /* Chuẩn hoá câu trả lời quiz: bỏ dấu câu, gộp khoảng trắng, thường hoá */
  w.normalizeAnswer = function (s) {
    return String(s || "")
      .toLowerCase().trim()
      .replace(/[.,!?;:"'`()\[\]]/g, "")
      .replace(/\s+/g, " ");
  };

  /* Ngày giờ chính xác: "07/09 14:30" — dùng cho lịch ôn Tony Buzan, nơi
     người học muốn biết ĐÚNG mấy giờ ngày nào chứ không chỉ "sau 3 ngày". */
  w.fmtDateTime = function (ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    function p2(n) { return String(n).padStart(2, "0"); }
    return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  };

  /* "3 phút trước" / "sau 2 ngày" */
  w.humanTime = function (ts, opts) {
    if (!ts) return "chưa ôn";
    var future = (opts && opts.future) || false;
    var diff = future ? (ts - Date.now()) : (Date.now() - ts);
    if (diff < 0) return future ? "đã đến hạn" : "vừa xong";
    var m = Math.floor(diff / 60000);
    if (m < 1)  return future ? "dưới 1 phút nữa" : "vừa xong";
    if (m < 60) return future ? ("sau " + m + " phút") : (m + " phút trước");
    var h = Math.floor(m / 60);
    if (h < 24) return future ? ("sau " + h + " giờ") : (h + " giờ trước");
    var d = Math.floor(h / 24);
    if (d < 30) return future ? ("sau " + d + " ngày") : (d + " ngày trước");
    var mo = Math.floor(d / 30);
    return future ? ("sau " + mo + " tháng") : (mo + " tháng trước");
  };

  w.toast = function (msg, kind) {
    var wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s"; el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  };

  /* ------------------------------------------------------------------
     PARSER — biến text dán vào thành mảng từ vựng
     Nhận các kiểu:
       term | nghĩa
       term | cấp độ | loại từ | phiên âm | định nghĩa Anh | nghĩa Việt
       term <TAB> nghĩa        |   term - nghĩa   |   term = nghĩa
       term            (không có nghĩa -> để trống)
     ------------------------------------------------------------------ */
  w.parseVocabText = function (text) {
    var out = [];
    /* bỏ ký tự BOM vô hình nếu copy từ file .txt do Windows tạo */
    String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (/^[-=_*#]{3,}$/.test(line)) return;           // dòng kẻ ngang

      var parts;
      if (line.indexOf("|") >= 0)      parts = line.split("|");
      else if (line.indexOf("\t") >= 0) parts = line.split("\t");
      else if (/\s+[-–—=:]\s+/.test(line)) parts = line.split(/\s+[-–—=:]\s+/);
      else parts = [line];

      parts = parts.map(function (p) { return p.trim(); });
      var term = parts[0];
      if (!term) return;
      term = term.replace(/^\d+[.)]\s*/, "");           // bỏ "1." đầu dòng

      var item = { term: term, level: "", pos: "", ipa: "", def_en: "", meaning_vi: "" };

      if (parts.length >= 6) {
        item.level = parts[1]; item.pos = parts[2]; item.ipa = parts[3];
        item.def_en = parts[4]; item.meaning_vi = parts[5];
      } else if (parts.length === 5) {
        item.level = parts[1]; item.pos = parts[2]; item.ipa = parts[3]; item.meaning_vi = parts[4];
      } else if (parts.length === 4) {
        item.pos = parts[1]; item.ipa = parts[2]; item.meaning_vi = parts[3];
      } else if (parts.length === 3) {
        item.pos = parts[1]; item.meaning_vi = parts[2];
      } else if (parts.length === 2) {
        item.meaning_vi = parts[1];
      }

      /* nếu lỡ nhét phiên âm vào ô loại từ thì hoán đổi lại */
      if (/^\/.*\/$/.test(item.pos) && !item.ipa) { item.ipa = item.pos; item.pos = ""; }

      /* Sách/vocabulary bank hay gộp vài từ đồng dạng thành 1 dòng kiểu
         "beef / lamb / pork" (nghĩa Việt cũng gộp theo "Thịt bò / thịt
         cừu non / thịt heo") — TÁCH thành TỪNG TỪ RIÊNG thay vì giữ
         nguyên 1 dòng dài (theo yêu cầu TJ — "coi như có thêm từ vựng").
         Chỉ tách khi term CÓ dấu "/" ĐỆM KHOẢNG TRẮNG hai bên (" / ") —
         không đụng vào phiên âm IPA (vốn cũng có "/" nhưng sát chữ, kiểu
         "/bi:f/") hay literal "TP.HCM/VN" không có khoảng trắng.
         meaning_vi tách theo CÙNG SỐ LƯỢNG thì ghép đúng cặp; lệch số
         lượng thì giữ nguyên meaning_vi cho mọi từ con (an toàn hơn bịa
         sai). ipa cũng vậy nếu tách theo dấu phẩy khớp số lượng. def_en
         KHÔNG tách (thường là 1 câu tả chung, tách theo "/" dễ sai nghĩa
         từng từ) — để trống cho từ con, dùng "Tự điền còn thiếu" (AI) bù
         lại definition đúng riêng từng từ sau. */
      if (/\s+\/\s+/.test(item.term)) {
        var subTerms = item.term.split(/\s+\/\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (subTerms.length > 1) {
          var subMeanings = /\s+\/\s+/.test(item.meaning_vi) ? item.meaning_vi.split(/\s+\/\s+/).map(function (s) { return s.trim(); }) : [];
          var subIpas = item.ipa.indexOf(",") >= 0 ? item.ipa.split(",").map(function (s) { return s.trim(); }) : [];
          subTerms.forEach(function (t, i) {
            out.push({
              term: t, level: item.level, pos: item.pos,
              ipa: subIpas.length === subTerms.length ? subIpas[i] : (subTerms.length === 1 ? item.ipa : ""),
              def_en: "",   /* để "Tự điền còn thiếu" (AI) tự tra definition riêng từng từ, tránh bịa sai khi tách */
              meaning_vi: subMeanings.length === subTerms.length ? subMeanings[i] : item.meaning_vi
            });
          });
          return;   /* đã push từng từ con rồi, KHÔNG push nguyên dòng gộp nữa */
        }
      }
      out.push(item);
    });
    return out;
  };

  /* Cắt mảng thành từng khối n phần tử */
  w.chunk = function (arr, n) {
    var res = [];
    for (var i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n));
    return res;
  };

  w.pct = function (num, den) {
    if (!den) return 0;
    return Math.round((num / den) * 100);
  };
})(window);
