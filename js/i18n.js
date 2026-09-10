/* i18n.js — ĐỔI NGÔN NGỮ KHUNG GIAO DIỆN (menu/nút/tiêu đề) THEO TÀI KHOẢN
   ---------------------------------------------------------------------
   Chỉ hỗ trợ "vi" (mặc định) và "en" (2026-09-10, theo yêu cầu TJ — share
   app cho bạn nước ngoài thì khung UI + cột "Nghĩa" tự đổi theo, ĐIỂM SỐ/
   QUIZ KHÔNG đổi). Admin gán ngôn ngữ cho từng tài khoản trong "👑 Quản lý
   tài khoản" (profiles.lang) — xem DB.setProfileLang/Auth.effectiveLang.

   CÁCH LÀM: app này không có sẵn hệ thống key i18n (chữ Việt viết thẳng
   trong HTML/JS khắp nơi) — viết lại toàn bộ thành t('key') là việc RẤT
   lớn, rủi ro cao. Thay vào đó, dùng 1 TỪ ĐIỂN ÁNH XẠ 2 CHIỀU (vi<->en)
   khớp ĐÚNG NGUYÊN VĂN chữ đang hiển thị — quét toàn bộ DOM (đệ quy từng
   text node + vài thuộc tính title/placeholder), thấy khớp thì thay.
   Bởi so khớp NGUYÊN VĂN (không phải chèn key), nên:
     · Nội dung THẬT (từ vựng, bài đọc, tên Notebook/Page do TJ đặt...)
       hầu như không bao giờ trùng y hệt 1 câu chữ khung UI cố định, nên
       an toàn, không bị dịch nhầm.
     · Đổi lại 'vi' cũng chạy được (tự tra chiều ngược lại), không cần lưu
       lại "chữ gốc" ở đâu cả — khớp la ĐÚNG NGUYÊN VĂN nên tự đảo ngược
       được vô hạn lần.
   CHƯA dịch: toast (câu có chèn tên/số liệu, quá nhiều biến thể), các đoạn
   mô tả dài trong modal (ưu tiên thấp hơn nút/menu chính) — mở rộng DICT
   dần dần theo nhu cầu thật, không cần làm hết 1 lần. */
(function (w) {
  "use strict";

  /* Từ điển vi -> en. Khoá PHẢI khớp NGUYÊN VĂN (đã trim) đúng như trong
     DOM — kể cả icon/emoji đứng đầu nếu icon đó nằm CHUNG 1 text node với
     chữ (không tách riêng bằng <span>). */
  var DICT = {
    /* ---- Thanh trên cùng / menu user ---- */
    "🏠 Trang chủ": "🏠 Home",
    "📊 Journey": "📊 Journey",
    "📖 Learning": "📖 Learning",
    "Khách": "Guest",
    "Chưa đăng nhập": "Not signed in",
    "Tài khoản Cloud": "Cloud account",
    "Hồ sơ trên máy này": "Profile on this device",
    "Xem như user…": "View as user…",
    "Giao diện": "Appearance",
    "Cỡ chữ": "Text size",
    "Màu nhấn": "Accent color",
    "Đổi / Thêm người học": "Switch / Add learner",
    "Đổi tên & avatar": "Edit name & avatar",
    "Đăng nhập Cloud (email)": "Cloud sign-in (email)",
    "Quản lý tài khoản": "Manage accounts",
    "Quản lý chia sẻ": "Manage sharing",
    "Xem như User": "View as user",
    "Về giao diện Admin": "Back to Admin view",
    "Báo cáo AI (nguồn bài đọc)": "AI report (passage sources)",
    "Xuất PDF (Block/Batch/Page…)": "Export PDF (Block/Batch/Page…)",
    "Dọn từ vựng rác (dòng tiêu đề lẫn vào)": "Clean stray rows (headers mixed in)",
    "Xuất dữ liệu (.json)": "Export data (.json)",
    "Nhập dữ liệu (.json)": "Import data (.json)",
    "Đăng xuất": "Log out",

    /* ---- Cột Notebooks / Pages ---- */
    "Notebooks": "Notebooks",
    "Pages": "Pages",
    "+ Notebook mới": "+ New notebook",
    "+ Thêm Page": "+ Add page",
    "+ Thêm section": "+ Add section",
    "Dán bài, tự trích từ": "Paste article, auto-extract",
    "Paste từ mới": "Paste new words",
    "Chu kỳ Tony Buzan": "Tony Buzan cycle",
    "Lần 1–2 · 10 phút / 24 giờ": "Round 1–2 · 10 min / 24 h",
    "Lần 3 · 1 tuần": "Round 3 · 1 week",
    "Lần 4 · 1 tháng": "Round 4 · 1 month",
    "Lần 5–6 · 3–6 tháng": "Round 5–6 · 3–6 months",

    /* ---- Danh sách Block ---- */
    "← Quay lại danh sách Block": "← Back to Block list",
    "Block trước": "Previous Block",
    "Block sau": "Next Block",
    "Đến hạn ôn tập": "Review due",
    "Đang tính toán theo chu kỳ suy giảm trí nhớ…": "Calculating by memory-decay cycle…",
    "Ôn ngay →": "Review now →",
    "Lần 1–2 · 10p / 24h": "Round 1–2 · 10m / 24h",
    "Lần 3 · 1 Tuần Sau": "Round 3 · in 1 week",
    "Lần 4 · 1 Tháng Sau": "Round 4 · in 1 month",
    "Lần 5–6 · 3–6 Tháng": "Round 5–6 · in 3–6 months",
    "Chưa học": "Not started",
    "Chưa thi": "Not tested",
    "trống": "empty",
    /* Nhãn nhỏ trên Block card (🟢/🔴 + label, dính chung 1 text node —
       xem SRS.status trong srs.js). Nhánh "Ôn <humanTime tương đối>" có
       chèn số liệu động (vd "sau 2 ngày") nên CHƯA dịch được ở đây. */
    "🟢 Chưa học": "🟢 Not started",
    "🟢 Chưa vào chu kỳ ôn": "🟢 Not in review cycle yet",
    "🟢 Đã vào trí nhớ dài hạn 💎": "🟢 In long-term memory 💎",
    "🔴 Đến hạn ôn ngay": "🔴 Review due now",

    /* ---- Tab trong Block ---- (mấy nút này chữ tách làm 2-3 text node
       riêng do có <span class="dt-long"> lồng bên trong — phải khớp
       ĐÚNG TỪNG MẢNH đã tách, không phải nguyên câu, xem walk() bên dưới) */
    "📘 Bài học": "📘 Lesson",
    "& Đọc": "& Reading",
    "🔀 Nghĩa": "🔀 Meaning",
    "📋 Phiếu": "📋 Sheet",
    "đầy đủ": "full",
    "🔤 Từng câu": "🔤 Sentence by sentence",
    "📊 Tiến trình": "📊 Progress",
    "trí nhớ": "memory",

    /* ---- Bảng từ vựng ---- */
    "📘 1. Danh sách từ vựng cần học": "📘 1. Vocabulary to learn",
    "▾ Thu gọn": "▾ Collapse",
    "▸ Mở rộng": "▸ Expand",
    "📋 Copy": "📋 Copy",
    "⏹ Dừng": "⏹ Stop",
    "🔊 Đọc tất cả từ": "🔊 Read all words",
    "🔊 Đọc + định nghĩa": "🔊 Read + definition",
    "🔊 Nghe US": "🔊 Listen (US)",
    "🎧 Nghe US": "🎧 Listen (US)",
    "Nghe US": "Listen (US)",
    "✏️ Prompt AI đang dùng cho \"🔄 Tạo lại\" (bấm để xem/sửa)": "✏️ AI prompt used for \"🔄 Regenerate\" (tap to view/edit)",
    " — chữ sẽ sáng theo giọng đọc (karaoke). Bấm vào bất kỳ từ nào để xem nghĩa và lưu lại.":
      " — text lights up as it's read (karaoke). Tap any word to see its meaning and save it.",
    "Xoá từ khỏi kho": "Remove word",

    /* ---- Bài đọc ---- */
    "📖 2. Đoạn văn ngữ cảnh (tự sinh)": "📖 2. Context passage (auto-generated)",
    "🔄 Tạo lại": "🔄 Regenerate",
    "📄 Cả bài": "📄 Whole passage",
    "🔤 Từng câu ": "🔤 Sentence by sentence ",
    "📑 Từng đoạn": "📑 Paragraph by paragraph",
    "← Trước": "← Back",
    "Bài đọc này còn trống — chọn 1 nguồn bên dưới.": "This passage is empty — choose a source below.",
    "📝 Dán": "📝 Paste",
    "✅ Dùng bài này": "✅ Use this passage",
    "🗑 Xoá bài này": "🗑 Delete this passage",
    "Câu tiếp →": "Next →",
    "Hiểu rồi, vào kiểm tra →": "Got it, start the quiz →",

    /* ---- Tiến trình / thống kê ---- */
    "Tổng từ vựng": "Total words",
    "Đã thuộc": "Mastered",
    "Độ nhớ TB": "Avg. recall",
    "Chu kỳ hiện tại": "Current cycle",
    "📊 Lịch ôn theo chu kỳ": "📊 Review schedule",
    "🔍 Chi tiết từng từ": "🔍 Per-word detail",
    "Từ vựng": "Word",
    "Nghĩa": "Meaning",
    "Lần ôn": "Reviews",
    "Đúng": "Correct",
    "Tỷ lệ": "Rate",
    "Trạng thái": "Status",

    /* ---- Home / Journey / Leaderboard ---- */
    "← Về học tiếp": "← Back to learning",
    "⟳ Tải lại": "⟳ Reload",
    "🏆 Xếp hạng": "🏆 Ranking",
    "Điểm = độ khó từ vựng trong Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × hệ số loại bài đã Done qua (🔀 Nghĩa = ×1 · 📋 Phiếu đầy đủ/🔤 Từng câu = ×1.5). Chỉ tính Block đã Done (đạt ≥ 80% ở bất kỳ 1 trong các bài kiểm tra).":
      "Score = word difficulty in the Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × multiplier for the test type passed (🔀 Meaning = ×1 · 📋 Full sheet/🔤 Sentence by sentence = ×1.5). Only counts Blocks that are Done (≥ 80% on any one test).",
    "Điểm = độ khó từ vựng trong Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × hệ số loại bài đã Done qua (🔀 Nghĩa = ×1 · 📋 Phiếu đầy đủ/🔤 Từng câu = ×1.5).":
      "Score = word difficulty in the Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × multiplier for the test type passed (🔀 Meaning = ×1 · 📋 Full sheet/🔤 Sentence by sentence = ×1.5).",
    "Chưa ai học xong Block nào trong phạm vi này cả.": "No one has finished any Block in this scope yet.",
    "Chưa có ai Done Block nào trong khoảng thời gian này (hoặc dữ liệu cũ chưa có mốc ngày, xem 'Từ đầu').":
      "No one has Done a Block in this period yet (or old data has no date, check 'All-time').",
    "🏆 Bảng xếp hạng": "🏆 Leaderboard",
    "Xem xếp hạng": "View ranking",
    "Tuần": "Week",
    "Tháng": "Month",
    "Từ đầu": "All-time",
    "🗓️ Lịch học theo tháng (toàn app)": "🗓️ Monthly study calendar (whole app)",
    "🚦 Theo tiến độ Tony Buzan": "🚦 By Tony Buzan progress",
    "🗂 Theo cây thư mục": "🗂 By folder tree",

    /* ---- Nghĩa của bạn / mức độ thuộc ---- */
    "Nghe phát âm": "Listen",
    "Ghim bảng nghĩa lại": "Pin meaning panel",
    "Đóng": "Close",
    "Nghĩa của bạn": "Your meaning",
    "Mức độ thuộc — bấm để lưu": "Mastery level — tap to save",
    "Bỏ khỏi kho": "Remove from bank",
    "Mới hoàn toàn": "Totally new",
    "Còn mơ hồ": "Still fuzzy",
    "Nhớ được": "Recall it",
    "Gần thuộc": "Almost there",
    "Đã thuộc ": "Mastered ",

    /* ---- Journey ---- */
    "🌐 Toàn bộ": "🌐 All",
    "Toàn bộ": "All",
    "T2": "Mon", "T3": "Tue", "T4": "Wed", "T5": "Thu", "T6": "Fri", "T7": "Sat", "CN": "Sun",
    "+N = số từ đã học hôm đó": "+N = words studied that day",
    "⚠N = số từ quá hạn ôn hôm đó": "⚠N = words overdue that day",
    "Cả hai": "Both",
    "Lần 1–2": "Round 1–2", "Lần 3": "Round 3", "Lần 4": "Round 4", "Lần 5–6": "Round 5–6",
    "Không có Block nào": "No Blocks",

    /* ---- Menu ⋯ (Notebook/Section/Page/Batch/Block) ---- */
    "Đổi tên": "Rename",
    "Chuyển lên": "Move up",
    "Chuyển xuống": "Move down",
    "Lên đầu": "Move to top",
    "Xuống cuối": "Move to bottom",
    "Chuyển sang Hub khác": "Move to another Hub",
    "Chia sẻ / Ẩn Notebook này…": "Share / hide this Notebook…",
    "Đặt vào trong Notebook khác": "Nest inside another Notebook",
    "Đưa ra ngoài (bỏ làm Notebook con)": "Move out (unnest)",
    "Bung 1 nhánh": "Expand 1 level",
    "Bung hết (mọi cấp con)": "Expand all levels",
    "Thu 1 nhánh": "Collapse 1 level",
    "Thu hết (mọi cấp con)": "Collapse all levels",
    "Chuyển sang Notebook khác": "Move to another Notebook",
    "Chuyển sang Section khác": "Move to another Section",
    "Chuyển sang Page khác": "Move to another Page",
    "Nhân bản Page": "Duplicate Page",
    "Nhân bản Notebook…": "Duplicate Notebook…",
    "Gộp tất cả Notebook về đây": "Merge all Notebooks here",
    "Xoá tiến trình học": "Reset learning progress",
    "Xoá Notebook": "Delete Notebook",
    "Xoá Section": "Delete Section",
    "Xoá Page": "Delete Page",
    "Xoá Batch": "Delete Batch",
    "Xoá Block": "Delete Block",
    "Xoá Hub": "Delete Hub",
    "Thao tác": "Actions",

    /* ---- Modal chung ---- */
    "Hủy": "Cancel", "Huỷ": "Cancel", "Đóng ": "Close ", "Xác nhận": "Confirm",
    "Đồng ý": "OK", "Chọn": "Choose", "Nhập tên": "Enter a name",
    "💾 Lưu": "💾 Save",

    /* ---- Chia sẻ ---- */
    "🔗 Chia sẻ Notebook": "🔗 Share Notebook",
    "Chỉ người được chia sẻ bên dưới (+ Admin) mới thấy Notebook này": "Only people shared below (+ Admin) can see this Notebook",
    "🔐 Quản lý chia sẻ": "🔐 Manage sharing",
    "🔒 Riêng tư tất cả": "🔒 Make all private",
    "🚫 Không chia sẻ": "🚫 Not shared",
    "👁️ Chỉ xem": "👁️ View only",
    "✏️ Toàn quyền": "✏️ Full access",
    "Tất cả Hub": "All Hubs",

    /* ---- Quản lý tài khoản ---- */
    "👑 Quản lý tài khoản": "👑 Manage accounts",
    "+ Tạo tài khoản mới": "+ Create new account",
    "👑 Admin": "👑 Admin",
    "✏️ Sửa đoạn văn": "✏️ Edit passage",
    "📋 Copy link": "📋 Copy link",
    "📧 Gửi email": "📧 Send email",

    /* ---- Người học trên máy ---- */
    "👥 Người học trên máy này": "👥 Learners on this device",
    "+ Thêm người học mới": "+ Add new learner",

    /* ---- Xuất PDF ---- */
    "🖨️ Xuất PDF": "🖨️ Export PDF",
    "Xuất theo cấp nào?": "Export at which level?",
    "Tên / tiêu đề": "Name / title",
    "Cỡ chữ khi in": "Print text size",
    "Vừa": "Medium", "Lớn": "Large", "Rất lớn (đọc điện thoại)": "Extra large (mobile)",
    "In / Xuất PDF →": "Print / Export PDF →",

    /* ---- Khối "Đến hạn ôn tập" (chỉ khớp được phần KHÔNG dính số/tên
       chèn động — phần trước/sau số liệu nằm trong <b> riêng, xem
       renderAlert trong app.js, nên vẫn là text node NGUYÊN VẸN) ---- */
    "Đến hạn ôn tập — đừng để trí nhớ rơi": "Review due — don't let it slip",
    "Tất cả đều đúng lịch 🎉": "All on schedule 🎉",
    "Chu kỳ ôn tập chưa bắt đầu": "Review cycle hasn't started",
    "Bắt đầu học →": "Start learning →",
    "Học block mới →": "Learn new block →",
    "chưa block nào vào chu kỳ": "no block in the cycle yet",
    "chưa học. Học xong và đạt ≥ 80% ở bài kiểm tra thì Block mới vào lịch ôn Tony Buzan.":
      "not studied. Finish and score ≥ 80% on the test to enter the Tony Buzan review cycle."
  };

  /* Tự sinh chiều ngược lại (en -> vi) để đổi VỀ tiếng Việt cũng chạy
     được mà không cần lưu "chữ gốc" ở đâu cả. */
  var REV = {};
  Object.keys(DICT).forEach(function (k) { REV[DICT[k]] = k; });

  /* ---- Cụm chèn số/ngày (không thể so khớp NGUYÊN VĂN vì luôn dính số
     liệu động) — thay bằng SUBSTRING (không cần khớp cả câu), phần số
     liệu ở giữa giữ nguyên không đụng tới. Chỉ áp dụng những cụm ngắn,
     ít khả năng trùng lẫn với nội dung thật (từ vựng/tên Notebook...). */
  var PARTIAL = {
    "⭐ Từ đã lưu": "⭐ Saved words",
    "🕒 Cập nhật:": "🕒 Updated:",
    "phút trước": "min ago",
    "giờ trước": "h ago",
    "ngày trước": "d ago",
    "tháng trước": "mo ago",
    " chưa học": " not studied",
    " đã đạt bài thi": " passed the test",
    "CÂU ": "QUESTION ",
    "đã làm ": "done ",
    "Tháng ": "Month ",
    "🏆 Xếp hạng — ": "🏆 Ranking — ",
    "🔴 Đến hạn ôn ngay (": "🔴 Review due now (",
    "🟢 Đã ôn, chưa tới hạn kế tiếp (": "🟢 Reviewed, next round not due ("
  };
  var PARTIAL_REV = {};
  Object.keys(PARTIAL).forEach(function (k) { PARTIAL_REV[PARTIAL[k]] = k; });

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1 };
  var ATTRS = ["title", "placeholder", "aria-label"];

  /* Gộp mọi khoảng trắng/xuống dòng thành 1 dấu cách — mấy đoạn mô tả dài
     trong index.html viết xuống dòng nhiều chỗ cho dễ đọc source, nhưng
     textContent giữ nguyên các dấu xuống dòng/thụt lề đó -> so khớp
     NGUYÊN VĂN (kể cả whitespace) sẽ trật lất. DICT lưu key đã gộp sẵn 1
     dấu cách, nên chuẩn hoá TRƯỚC KHI tra thay vì bắt key phải khớp y hệt
     cách viết xuống dòng trong file. */
  function normWs(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  function translateText(s, target) {
    var trimmed = String(s || "").trim();
    if (!trimmed) return null;
    var map = target === "en" ? DICT : REV;
    var hit = map[trimmed];
    if (hit) return hit;
    var norm = normWs(trimmed);
    if (norm !== trimmed) return map[norm] || null;
    return null;
  }

  /* Thay THEO SUBSTRING (không cần khớp nguyên cả text node) — dùng cho
     câu có chèn số liệu/ngày giờ động (vd "6 phút trước", "61 block chưa
     học") mà so khớp nguyên văn không bao giờ trúng. Có thể thay NHIỀU
     cụm trong cùng 1 text node (vd vừa có "phút trước" vừa có gì khác). */
  function applyPartial(text, target) {
    var map = target === "en" ? PARTIAL : PARTIAL_REV;
    var out = text;
    Object.keys(map).forEach(function (k) {
      if (out.indexOf(k) >= 0) out = out.split(k).join(map[k]);
    });
    return out;
  }

  function applyToTextNode(node, target) {
    var full = node.textContent;
    var trimmed = full.trim();
    if (!trimmed) return;
    var hit = translateText(trimmed, target);
    if (hit) {
      var i = full.indexOf(trimmed);
      node.textContent = full.slice(0, i) + hit + full.slice(i + trimmed.length);
      return;
    }
    var partial = applyPartial(full, target);
    if (partial !== full) node.textContent = partial;
  }

  function applyToAttrs(el, target) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      var hit = translateText(v, target);
      if (hit) el.setAttribute(a, hit);
    }
  }

  function walk(node, target) {
    if (node.nodeType === 3) { applyToTextNode(node, target); return; }
    if (node.nodeType !== 1) return;
    if (SKIP_TAGS[node.tagName]) return;
    applyToAttrs(node, target);
    for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], target);
  }

  var I18N = { DICT: DICT };

  /* Chạy 1 lượt dịch toàn bộ DOM hiện tại theo Auth.effectiveLang() —
     chạy được cả 2 chiều (vi->en lẫn en->vi) nên gọi lại bao nhiêu lần
     cũng an toàn, không cần biết trạng thái trước đó là gì. */
  I18N.apply = function (root) {
    if (!(w.Auth && w.Auth.effectiveLang)) return;
    var target = w.Auth.effectiveLang();
    walk(root || document.body, target === "en" ? "en" : "vi");
  };

  /* Quan sát DOM để dịch NGAY nội dung mới render (menu ⋯, modal, danh
     sách Block…) — CHỈ thật sự quét khi ngôn ngữ hiện tại là "en" (đa số
     user vẫn "vi" — early-return ngay từ đầu, gần như miễn phí, không ảnh
     hưởng hiệu năng render bình thường của TJ). Khi đổi NGÔN NGỮ (không
     phải mỗi lần render) thì luôn chạy apply() 1 lượt đầy đủ để xử lý cả
     chiều đổi VỀ tiếng Việt, xem Auth.onChange bên dưới. */
  var observer = new MutationObserver(function (mutations) {
    if (!(w.Auth && w.Auth.effectiveLang && w.Auth.effectiveLang() === "en")) return;
    mutations.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) { walk(n, "en"); });
    });
  });

  function start() {
    I18N.apply();
    observer.observe(document.body, { childList: true, subtree: true, characterData: false });
    if (w.Auth && w.Auth.onChange) {
      w.Auth.onChange(function () { I18N.apply(); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  w.I18N = I18N;
})(window);
