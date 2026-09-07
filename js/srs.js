/* srs.js — Thuật toán lặp lại ngắt quãng theo Tony Buzan
   -------------------------------------------------------
   Đường cong quên Ebbinghaus: nếu không ôn, sau 1 ngày chỉ còn ~33% trí nhớ.
   Tony Buzan đề xuất 5 mốc ôn để đẩy từ vựng vào trí nhớ dài hạn:
       lần 1: sau 10 phút   lần 2: sau 24 giờ   lần 3: sau 1 tuần
       lần 4: sau 1 tháng   lần 5: sau 3 tháng  (duy trì: 6 tháng)
   `cycle` = số lần đã ôn xong. cycle 0 = chưa ôn lần nào.
*/
(function (w) {
  "use strict";
  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  var STEPS = [
    { cycle: 0, label: "Lần 1 · sau 10 phút", wait: 10 * MIN,  group: 1, short: "10 phút" },
    { cycle: 1, label: "Lần 2 · sau 24 giờ",  wait: 24 * HOUR, group: 1, short: "24 giờ" },
    { cycle: 2, label: "Lần 3 · sau 1 tuần",  wait: 7 * DAY,   group: 2, short: "1 tuần" },
    { cycle: 3, label: "Lần 4 · sau 1 tháng", wait: 30 * DAY,  group: 3, short: "1 tháng" },
    { cycle: 4, label: "Lần 5 · sau 3 tháng", wait: 90 * DAY,  group: 4, short: "3 tháng" },
    { cycle: 5, label: "Lần 6 · sau 6 tháng", wait: 180 * DAY, group: 4, short: "6 tháng" }
  ];

  w.SRS = {
    STEPS: STEPS,
    MAX_CYCLE: STEPS.length,

    /* Bước kế tiếp cần chờ bao lâu, ứng với cycle hiện tại */
    stepFor: function (cycle) {
      var i = Math.min(Math.max(cycle | 0, 0), STEPS.length - 1);
      return STEPS[i];
    },

    /* Ôn xong -> trả về {cycle, next_review_at} mới */
    advance: function (cycle) {
      var c = Math.min((cycle | 0) + 1, STEPS.length);
      var step = STEPS[Math.min(c, STEPS.length - 1)];
      return { cycle: c, next_review_at: Date.now() + step.wait };
    },

    /* Trả lời sai nhiều -> lùi 1 bậc để ôn lại sớm */
    demote: function (cycle) {
      var c = Math.max((cycle | 0) - 1, 0);
      return { cycle: c, next_review_at: Date.now() + STEPS[c].wait };
    },

    /* Nhóm hiển thị 1..4 (ứng với 4 ô thời gian trên giao diện) */
    groupOf: function (cycle) {
      var i = Math.min(Math.max(cycle | 0, 0), STEPS.length - 1);
      return STEPS[i].group;
    },

    /* Trạng thái của 1 block: {started, due, cycle, label, nextAt}
       ------------------------------------------------------------------
       QUAN TRỌNG: một Block CHỈ bước vào chu kỳ Tony Buzan sau khi đã học
       xong và ĐẠT bài kiểm tra cuối bài. Trước đó nó là "chưa học" — không
       bị tính là quá hạn, không nằm trong 4 ô chu kỳ.
       Nếu không làm vậy thì mới nạp 62 block là cả 62 cái đều báo "đến hạn",
       lịch ôn mất hết ý nghĩa. */
    state: function (bp) {
      if (!bp || !bp.passed) {
        /* "Chưa học" chỉ đúng khi CHƯA đụng gì tới Block. Nếu đã Done qua
           thẻ Nghĩa (meaning_passed) hoặc đã thử bài thi mà chưa đạt
           (best_score) thì ghi rõ "chưa vào chu kỳ ôn" — tránh gây hiểu
           lầm "chưa học" trong khi Block đã hiện ✓ Done ở nơi khác (badge
           Block card, ô "Bài tập" trong Chi tiết) — chỉ riêng chu kỳ ôn
           Tony Buzan là chưa bắt đầu (cần đạt Phiếu đầy đủ/Từng câu). */
        var untouched = !bp || !(bp.meaning_passed || bp.best_score || bp.meaning_best);
        return {
          started: false, due: false, cycle: 0, nextAt: null,
          label: untouched ? "Chưa học" : "Chưa vào chu kỳ ôn"
        };
      }
      var cycle = bp.cycle | 0;
      var next = bp.next_review_at || null;
      if (cycle >= STEPS.length) {
        return { started: true, due: false, cycle: cycle, label: "Đã vào trí nhớ dài hạn 💎", nextAt: next };
      }
      var due = !next || next <= Date.now();
      return {
        started: true, due: due, cycle: cycle, nextAt: next,
        label: due ? "Đến hạn ôn ngay" : ("Ôn " + w.humanTime(next, { future: true }))
      };
    }
  };
})(window);
