/* journey.js — Màn "Journey": tổng quan TOÀN APP + lịch học theo ngày.
   Khác với tab "Tiến trình" bên trong 1 Block (chỉ nhìn đúng Block đó),
   màn này nhìn xuyên suốt MỌI Hub/Notebook — dùng DB.getJourneySummary()
   và DB.getDailyLog() (xem js/db.js).

   Quy ước:
     · XANH  = số từ "đã học" hôm đó — cộng dồn mỗi khi 1 trong 3 thẻ bài
       tập (Phiếu đầy đủ / Từng câu / Nghĩa) đạt ≥ 80%.
     · ĐỎ    = số từ đang "quá hạn" ôn tập theo lịch Tony Buzan, tính vào
       đúng ngày đến hạn (bp.next_review_at) — đây là số liệu SỐNG, tính
       lại mỗi lần mở màn này, không phải nhật ký cố định như số học. */
(function (w) {
  "use strict";

  var J = {};
  w.Journey = J;

  var DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  function pad2(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

  J.open = async function () {
    w.Speech.stop();
    /* Nhớ đang ở màn nào để bấm "Về học tiếp" thì quay lại đúng chỗ,
       thay vì luôn nhảy về danh sách Block. */
    J._prevWasDetail = !w.$("#screen-detail").hidden;
    w.$("#screen-blocks").hidden = true;
    w.$("#screen-detail").hidden = true;
    w.$("#btn-back").hidden = true;
    w.$("#screen-journey").hidden = false;
    w.$("#workspace").scrollTop = 0;

    w.$("#journey-cal").innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:1rem">Đang tải…</div>';

    var uid = w.Auth.user && w.Auth.user.id;
    var summary = uid
      ? await w.DB.getJourneySummary(uid)
      : { totalWords: 0, mastered: 0, totalBlocks: 0, blocksDone: 0, overdueWords: 0, overdueByDate: {} };
    var log = uid ? await w.DB.getDailyLog(uid) : {};

    w.$("#j-words").textContent = summary.mastered + " / " + summary.totalWords;
    w.$("#j-blocks").textContent = summary.blocksDone + " / " + summary.totalBlocks;
    w.$("#j-overdue").textContent = summary.overdueWords;

    J.renderCalendar(log, summary.overdueByDate || {});
  };

  J.close = function () {
    w.$("#screen-journey").hidden = true;
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

  /* Gắn nút mở/đóng — script này nằm cuối trang nên các nút đã có sẵn
     trong DOM lúc chạy tới đây, không cần chờ App.init() gọi riêng. */
  w.$("#btn-journey").onclick = function () { J.open(); };
  w.$("#btn-journey-back").onclick = function () { J.close(); };
})(window);
