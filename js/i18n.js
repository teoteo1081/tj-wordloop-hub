/* i18n.js — ĐỔI NGÔN NGỮ KHUNG GIAO DIỆN (menu/nút/tiêu đề) THEO TÀI KHOẢN
   ---------------------------------------------------------------------
   Hỗ trợ "vi" (mặc định), "en", và "zh" (thêm 2026-09-13, theo yêu cầu
   TJ) — share app cho bạn nước ngoài thì khung UI + cột "Nghĩa" tự đổi
   theo, ĐIỂM SỐ/QUIZ KHÔNG đổi. Admin gán ngôn ngữ cho từng tài khoản
   trong "👑 Quản lý tài khoản" (profiles.lang) — xem DB.setProfileLang/
   Auth.effectiveLang.
   LƯU Ý kiến trúc: mọi bản render (HTML/JS) LUÔN xuất ra tiếng Việt gốc
   trước — I18N chỉ dịch ĐÈ LÊN sau khi DOM đã dựng xong (walk toàn bộ
   cây). Vì vậy dịch "vi" (quay lại tiếng Việt) từ trạng thái đang "en"
   HAY "zh" đều thử tra CẢ 2 chiều ngược (REV/REV_ZH) — không cần biết
   trước DOM đang ở ngôn ngữ nào. Đổi THẲNG en<->zh (không qua vi) chưa
   được hỗ trợ đầy đủ (hiếm khi cần — đổi ngôn ngữ tài khoản thường đi
   kèm tải lại trang, lúc đó DOM lại xuất phát từ vi gốc như bình thường).

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

  /* Từ điển vi -> zh (giản thể). Khoá PHẢI khớp NGUYÊN VĂN 100% với DICT
     ở trên (cùng bộ khoá) — nếu thêm khoá mới vào DICT (en) mà quên thêm
     vào đây, chuỗi đó chỉ đơn giản KHÔNG dịch khi ở chế độ "zh" (không
     lỗi, không vỡ layout) — bổ sung dần khi phát hiện thiếu. */
  var DICT_ZH = {
    /* ---- Thanh trên cùng / menu user ---- */
    "🏠 Trang chủ": "🏠 首页",
    "📊 Journey": "📊 学习历程",
    "📖 Learning": "📖 学习",
    "Khách": "访客",
    "Chưa đăng nhập": "尚未登录",
    "Tài khoản Cloud": "云端账户",
    "Hồ sơ trên máy này": "本机档案",
    "Xem như user…": "以用户身份查看…",
    "Giao diện": "外观设置",
    "Cỡ chữ": "字体大小",
    "Màu nhấn": "主题色",
    "Đổi / Thêm người học": "切换 / 添加学习者",
    "Đổi tên & avatar": "修改名称与头像",
    "Đăng nhập Cloud (email)": "云端登录（邮箱）",
    "Quản lý tài khoản": "账户管理",
    "Quản lý chia sẻ": "共享管理",
    "Xem như User": "以用户身份查看",
    "Về giao diện Admin": "返回管理员界面",
    "Báo cáo AI (nguồn bài đọc)": "AI 报告（课文来源）",
    "Xuất PDF (Block/Batch/Page…)": "导出 PDF（区块/批次/页面…）",
    "Dọn từ vựng rác (dòng tiêu đề lẫn vào)": "清理垃圾词汇（混入的标题行）",
    "Xuất dữ liệu (.json)": "导出数据（.json）",
    "Nhập dữ liệu (.json)": "导入数据（.json）",
    "Đăng xuất": "退出登录",

    /* ---- Cột Notebooks / Pages ---- */
    "Notebooks": "笔记本",
    "Pages": "页面",
    "+ Notebook mới": "+ 新建笔记本",
    "+ Thêm Page": "+ 添加页面",
    "+ Thêm section": "+ 添加分区",
    "Dán bài, tự trích từ": "粘贴文章，自动提取单词",
    "Paste từ mới": "粘贴新单词",
    "Chu kỳ Tony Buzan": "Tony Buzan 复习周期",
    "Lần 1–2 · 10 phút / 24 giờ": "第 1–2 次 · 10 分钟 / 24 小时",
    "Lần 3 · 1 tuần": "第 3 次 · 1 周",
    "Lần 4 · 1 tháng": "第 4 次 · 1 个月",
    "Lần 5–6 · 3–6 tháng": "第 5–6 次 · 3–6 个月",

    /* ---- Danh sách Block ---- */
    "← Quay lại danh sách Block": "← 返回区块列表",
    "Block trước": "上一个区块",
    "Block sau": "下一个区块",
    "Đến hạn ôn tập": "到复习期限",
    "Đang tính toán theo chu kỳ suy giảm trí nhớ…": "正在按记忆衰退周期计算…",
    "Ôn ngay →": "立即复习 →",
    "Lần 1–2 · 10p / 24h": "第 1–2 次 · 10 分钟 / 24 小时",
    "Lần 3 · 1 Tuần Sau": "第 3 次 · 1 周后",
    "Lần 4 · 1 Tháng Sau": "第 4 次 · 1 个月后",
    "Lần 5–6 · 3–6 Tháng": "第 5–6 次 · 3–6 个月",
    "Chưa học": "尚未学习",
    "Chưa thi": "尚未测试",
    "trống": "空",
    "🟢 Chưa học": "🟢 尚未学习",
    "🟢 Chưa vào chu kỳ ôn": "🟢 尚未进入复习周期",
    "🟢 Đã vào trí nhớ dài hạn 💎": "🟢 已进入长期记忆 💎",
    "🔴 Đến hạn ôn ngay": "🔴 现已到复习期限",

    /* ---- Tab trong Block ---- */
    "📘 Bài học": "📘 课程",
    "& Đọc": "与阅读",
    "🔀 Nghĩa": "🔀 词义",
    "📋 Phiếu": "📋 练习卷",
    "đầy đủ": "完整版",
    "🔤 Từng câu": "🔤 逐句",
    "📊 Tiến trình": "📊 学习进度",
    "trí nhớ": "记忆",

    /* ---- Bảng từ vựng ---- */
    "📘 1. Danh sách từ vựng cần học": "📘 1. 需要学习的词汇表",
    "▾ Thu gọn": "▾ 收起",
    "▸ Mở rộng": "▸ 展开",
    "📋 Copy": "📋 复制",
    "⏹ Dừng": "⏹ 停止",
    "🔊 Đọc tất cả từ": "🔊 朗读全部单词",
    "🔊 Đọc + định nghĩa": "🔊 朗读 + 释义",
    "🔊 Nghe US": "🔊 收听（美式）",
    "🎧 Nghe US": "🎧 收听（美式）",
    "Nghe US": "收听（美式）",
    "✏️ Prompt AI đang dùng cho \"🔄 Tạo lại\" (bấm để xem/sửa)": "✏️ 用于\"🔄 重新生成\"的 AI 提示词（点击查看/编辑）",
    " — chữ sẽ sáng theo giọng đọc (karaoke). Bấm vào bất kỳ từ nào để xem nghĩa và lưu lại.":
      " — 文字会随朗读高亮（卡拉OK 模式）。点击任意单词可查看释义并保存。",
    "Xoá từ khỏi kho": "从词库中移除",

    /* ---- Bài đọc ---- */
    "📖 2. Đoạn văn ngữ cảnh (tự sinh)": "📖 2. 情境课文（自动生成）",
    "🔄 Tạo lại": "🔄 重新生成",
    "📄 Cả bài": "📄 整篇课文",
    "🔤 Từng câu ": "🔤 逐句 ",
    "📑 Từng đoạn": "📑 逐段",
    "← Trước": "← 上一步",
    "Bài đọc này còn trống — chọn 1 nguồn bên dưới.": "本篇课文还是空的 — 请在下方选择一个来源。",
    "📝 Dán": "📝 粘贴",
    "✅ Dùng bài này": "✅ 使用这篇课文",
    "🗑 Xoá bài này": "🗑 删除这篇课文",
    "Câu tiếp →": "下一句 →",
    "Hiểu rồi, vào kiểm tra →": "明白了，开始测验 →",

    /* ---- Tiến trình / thống kê ---- */
    "Tổng từ vựng": "总词汇量",
    "Đã thuộc": "已掌握",
    "Độ nhớ TB": "平均记忆度",
    "Chu kỳ hiện tại": "当前周期",
    "📊 Lịch ôn theo chu kỳ": "📊 周期复习计划",
    "🔍 Chi tiết từng từ": "🔍 单词详情",
    "Từ vựng": "单词",
    "Nghĩa": "词义",
    "Lần ôn": "复习次数",
    "Đúng": "正确",
    "Tỷ lệ": "正确率",
    "Trạng thái": "状态",

    /* ---- Home / Journey / Leaderboard ---- */
    "← Về học tiếp": "← 返回继续学习",
    "⟳ Tải lại": "⟳ 重新加载",
    "🏆 Xếp hạng": "🏆 排行榜",
    "Điểm = độ khó từ vựng trong Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × hệ số loại bài đã Done qua (🔀 Nghĩa = ×1 · 📋 Phiếu đầy đủ/🔤 Từng câu = ×1.5). Chỉ tính Block đã Done (đạt ≥ 80% ở bất kỳ 1 trong các bài kiểm tra).":
      "分数 = 区块内词汇难度（A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8）× 已完成测验类型的系数（🔀 词义 = ×1 · 📋 完整练习卷/🔤 逐句 = ×1.5）。仅计算已完成的区块（任一测验达到 ≥ 80%）。",
    "Điểm = độ khó từ vựng trong Block (A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8) × hệ số loại bài đã Done qua (🔀 Nghĩa = ×1 · 📋 Phiếu đầy đủ/🔤 Từng câu = ×1.5).":
      "分数 = 区块内词汇难度（A1/A2=1 · B1=2 · B2=3 · C1=5 · C2=8）× 已完成测验类型的系数（🔀 词义 = ×1 · 📋 完整练习卷/🔤 逐句 = ×1.5）。",
    "Chưa ai học xong Block nào trong phạm vi này cả.": "此范围内还没有人完成任何区块。",
    "Chưa có ai Done Block nào trong khoảng thời gian này (hoặc dữ liệu cũ chưa có mốc ngày, xem 'Từ đầu').":
      "此时间段内还没有人完成区块（或旧数据没有日期记录，请查看「从头开始」）。",
    "🏆 Bảng xếp hạng": "🏆 排行榜",
    "Xem xếp hạng": "查看排行榜",
    "Tuần": "本周",
    "Tháng": "本月",
    "Từ đầu": "从头开始",
    "🗓️ Lịch học theo tháng (toàn app)": "🗓️ 每月学习日历（全应用）",
    "🚦 Theo tiến độ Tony Buzan": "🚦 按 Tony Buzan 进度",
    "🗂 Theo cây thư mục": "🗂 按文件夹结构",

    /* ---- Nghĩa của bạn / mức độ thuộc ---- */
    "Nghe phát âm": "听发音",
    "Ghim bảng nghĩa lại": "固定释义面板",
    "Đóng": "关闭",
    "Nghĩa của bạn": "你的释义",
    "Mức độ thuộc — bấm để lưu": "掌握程度 — 点击保存",
    "Bỏ khỏi kho": "从词库移除",
    "Mới hoàn toàn": "完全陌生",
    "Còn mơ hồ": "还很模糊",
    "Nhớ được": "能记住",
    "Gần thuộc": "接近掌握",
    "Đã thuộc ": "已掌握 ",

    /* ---- Journey ---- */
    "🌐 Toàn bộ": "🌐 全部",
    "Toàn bộ": "全部",
    "T2": "周一", "T3": "周二", "T4": "周三", "T5": "周四", "T6": "周五", "T7": "周六", "CN": "周日",
    "+N = số từ đã học hôm đó": "+N = 当天学习的单词数",
    "⚠N = số từ quá hạn ôn hôm đó": "⚠N = 当天逾期未复习的单词数",
    "Cả hai": "两者都要",
    "Lần 1–2": "第 1–2 次", "Lần 3": "第 3 次", "Lần 4": "第 4 次", "Lần 5–6": "第 5–6 次",
    "Không có Block nào": "没有任何区块",

    /* ---- Menu ⋯ (Notebook/Section/Page/Batch/Block) ---- */
    "Đổi tên": "重命名",
    "Chuyển lên": "上移",
    "Chuyển xuống": "下移",
    "Lên đầu": "移到最前",
    "Xuống cuối": "移到最后",
    "Chuyển sang Hub khác": "移动到其他 Hub",
    "Chia sẻ / Ẩn Notebook này…": "共享 / 隐藏此笔记本…",
    "Đặt vào trong Notebook khác": "嵌套到其他笔记本内",
    "Đưa ra ngoài (bỏ làm Notebook con)": "移出（取消嵌套）",
    "Bung 1 nhánh": "展开一层",
    "Bung hết (mọi cấp con)": "展开全部（所有子层级）",
    "Thu 1 nhánh": "收起一层",
    "Thu hết (mọi cấp con)": "收起全部（所有子层级）",
    "Chuyển sang Notebook khác": "移动到其他笔记本",
    "Chuyển sang Section khác": "移动到其他分区",
    "Chuyển sang Page khác": "移动到其他页面",
    "Nhân bản Page": "复制页面",
    "Nhân bản Notebook…": "复制笔记本…",
    "Gộp tất cả Notebook về đây": "将所有笔记本合并到此处",
    "Xoá tiến trình học": "重置学习进度",
    "Xoá Notebook": "删除笔记本",
    "Xoá Section": "删除分区",
    "Xoá Page": "删除页面",
    "Xoá Batch": "删除批次",
    "Xoá Block": "删除区块",
    "Xoá Hub": "删除 Hub",
    "Thao tác": "操作",

    /* ---- Modal chung ---- */
    "Hủy": "取消", "Huỷ": "取消", "Đóng ": "关闭 ", "Xác nhận": "确认",
    "Đồng ý": "确定", "Chọn": "选择", "Nhập tên": "输入名称",
    "💾 Lưu": "💾 保存",

    /* ---- Chia sẻ ---- */
    "🔗 Chia sẻ Notebook": "🔗 共享笔记本",
    "Chỉ người được chia sẻ bên dưới (+ Admin) mới thấy Notebook này": "只有下方被授权的人（+ 管理员）才能看到此笔记本",
    "🔐 Quản lý chia sẻ": "🔐 共享管理",
    "🔒 Riêng tư tất cả": "🔒 全部设为私密",
    "🚫 Không chia sẻ": "🚫 不共享",
    "👁️ Chỉ xem": "👁️ 仅查看",
    "✏️ Toàn quyền": "✏️ 完全权限",
    "Tất cả Hub": "所有 Hub",

    /* ---- Quản lý tài khoản ---- */
    "👑 Quản lý tài khoản": "👑 账户管理",
    "+ Tạo tài khoản mới": "+ 创建新账户",
    "👑 Admin": "👑 管理员",
    "✏️ Sửa đoạn văn": "✏️ 编辑课文",
    "📋 Copy link": "📋 复制链接",
    "📧 Gửi email": "📧 发送邮件",

    /* ---- Người học trên máy ---- */
    "👥 Người học trên máy này": "👥 本机学习者",
    "+ Thêm người học mới": "+ 添加新学习者",

    /* ---- Xuất PDF ---- */
    "🖨️ Xuất PDF": "🖨️ 导出 PDF",
    "Xuất theo cấp nào?": "按哪个层级导出？",
    "Tên / tiêu đề": "名称 / 标题",
    "Cỡ chữ khi in": "打印字体大小",
    "Vừa": "中", "Lớn": "大", "Rất lớn (đọc điện thoại)": "特大（手机阅读）",
    "In / Xuất PDF →": "打印 / 导出 PDF →",

    /* ---- Khối "Đến hạn ôn tập" ---- */
    "Đến hạn ôn tập — đừng để trí nhớ rơi": "到复习期限了 — 别让记忆溜走",
    "Tất cả đều đúng lịch 🎉": "全部按计划进行 🎉",
    "Chu kỳ ôn tập chưa bắt đầu": "复习周期尚未开始",
    "Bắt đầu học →": "开始学习 →",
    "Học block mới →": "学习新区块 →",
    "chưa block nào vào chu kỳ": "还没有区块进入周期",
    "chưa học. Học xong và đạt ≥ 80% ở bài kiểm tra thì Block mới vào lịch ôn Tony Buzan.":
      "尚未学习。完成学习并在测验中达到 ≥ 80% 后，该区块才会进入 Tony Buzan 复习计划。"
  };

  /* Tự sinh chiều ngược lại (en -> vi, zh -> vi) để đổi VỀ tiếng Việt
     cũng chạy được mà không cần lưu "chữ gốc" ở đâu cả. */
  var REV = {};
  Object.keys(DICT).forEach(function (k) { REV[DICT[k]] = k; });
  var REV_ZH = {};
  Object.keys(DICT_ZH).forEach(function (k) { REV_ZH[DICT_ZH[k]] = k; });

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

  var PARTIAL_ZH = {
    "⭐ Từ đã lưu": "⭐ 已存单词",
    "🕒 Cập nhật:": "🕒 更新于：",
    "phút trước": "分钟前",
    "giờ trước": "小时前",
    "ngày trước": "天前",
    "tháng trước": "个月前",
    " chưa học": " 尚未学习",
    " đã đạt bài thi": " 已通过测验",
    "CÂU ": "第 ", // + số + " 题" bị mất do PARTIAL chỉ thay được 1 mảnh, chấp nhận thiếu "题" ở cuối
    "đã làm ": "已完成 ",
    "Tháng ": "月 ",
    "🏆 Xếp hạng — ": "🏆 排行榜 — ",
    "🔴 Đến hạn ôn ngay (": "🔴 现已到复习期限 (",
    "🟢 Đã ôn, chưa tới hạn kế tiếp (": "🟢 已复习，尚未到下次期限 ("
  };
  var PARTIAL_ZH_REV = {};
  Object.keys(PARTIAL_ZH).forEach(function (k) { PARTIAL_ZH_REV[PARTIAL_ZH[k]] = k; });

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1 };
  var ATTRS = ["title", "placeholder", "aria-label"];

  /* Gộp mọi khoảng trắng/xuống dòng thành 1 dấu cách — mấy đoạn mô tả dài
     trong index.html viết xuống dòng nhiều chỗ cho dễ đọc source, nhưng
     textContent giữ nguyên các dấu xuống dòng/thụt lề đó -> so khớp
     NGUYÊN VĂN (kể cả whitespace) sẽ trật lất. DICT lưu key đã gộp sẵn 1
     dấu cách, nên chuẩn hoá TRƯỚC KHI tra thay vì bắt key phải khớp y hệt
     cách viết xuống dòng trong file. */
  function normWs(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  /* target "vi" = quay VỀ tiếng Việt — DOM lúc đó có thể đang là "en" HAY
     "zh" (không track riêng trạng thái hiện tại), nên thử CẢ 2 chiều
     ngược, chiều nào khớp trước dùng chiều đó. */
  function translateText(s, target) {
    var trimmed = String(s || "").trim();
    if (!trimmed) return null;
    var map = target === "en" ? DICT : target === "zh" ? DICT_ZH : null;
    if (map) {
      var hit = map[trimmed];
      if (hit) return hit;
      var norm = normWs(trimmed);
      return norm !== trimmed ? (map[norm] || null) : null;
    }
    var hitVi = REV[trimmed] || REV_ZH[trimmed];
    if (hitVi) return hitVi;
    var normVi = normWs(trimmed);
    if (normVi !== trimmed) return REV[normVi] || REV_ZH[normVi] || null;
    return null;
  }

  /* Thay THEO SUBSTRING (không cần khớp nguyên cả text node) — dùng cho
     câu có chèn số liệu/ngày giờ động (vd "6 phút trước", "61 block chưa
     học") mà so khớp nguyên văn không bao giờ trúng. Có thể thay NHIỀU
     cụm trong cùng 1 text node (vd vừa có "phút trước" vừa có gì khác). */
  function applyPartial(text, target) {
    /* target "vi": DOM có thể đang "en" HAY "zh" — chạy CẢ 2 bảng REV lần
       lượt (không xung đột vì .indexOf từng cụm riêng biệt của mỗi ngôn
       ngữ, khó trùng nhau). */
    var maps = target === "en" ? [PARTIAL] : target === "zh" ? [PARTIAL_ZH] : [PARTIAL_REV, PARTIAL_ZH_REV];
    var out = text;
    maps.forEach(function (map) {
      Object.keys(map).forEach(function (k) {
        if (out.indexOf(k) >= 0) out = out.split(k).join(map[k]);
      });
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

  /* Chạy 1 lượt dịch toàn bộ DOM hiện tại theo Auth.effectiveLang().
     ĐI QUA "vi" TRƯỚC luôn (bước walk(r,"vi") — vô hại/no-op nếu DOM đã
     sẵn là vi, vì REV/REV_ZH không khớp được chữ tiếng Việt) rồi mới
     dịch sang đích thật — bắt buộc phải làm vậy vì DICT/DICT_ZH chỉ có
     chiều "từ vi", không có bản dịch TRỰC TIẾP en<->zh. Thiếu bước này,
     đổi THẲNG en->zh (bỏ qua vi ở giữa, xảy ra thật khi bấm nút xoay
     vòng 🇻🇳→🇬🇧→🇨🇳 mới thêm 2026-09-13) sẽ đứng yên sai ở "en" — đã bắt
     lỗi này bằng Playwright trước khi sửa. Nhờ vậy gọi apply() lại bao
     nhiêu lần cũng an toàn, không cần biết trạng thái DOM trước đó. */
  I18N.apply = function (root) {
    if (!(w.Auth && w.Auth.effectiveLang)) return;
    var target = w.Auth.effectiveLang();
    var normTarget = (target === "en" || target === "zh") ? target : "vi";
    var r = root || document.body;
    walk(r, "vi");
    if (normTarget !== "vi") walk(r, normTarget);
  };

  /* Quan sát DOM để dịch NGAY nội dung mới render (menu ⋯, modal, danh
     sách Block…) — CHỈ thật sự quét khi ngôn ngữ hiện tại là "en"/"zh"
     (đa số user vẫn "vi" — early-return ngay từ đầu, gần như miễn phí,
     không ảnh hưởng hiệu năng render bình thường của TJ). Khi đổi NGÔN
     NGỮ (không phải mỗi lần render) thì luôn chạy apply() 1 lượt đầy đủ
     để xử lý cả chiều đổi VỀ tiếng Việt, xem Auth.onChange bên dưới. */
  var observer = new MutationObserver(function (mutations) {
    var lang = w.Auth && w.Auth.effectiveLang && w.Auth.effectiveLang();
    if (lang !== "en" && lang !== "zh") return;
    mutations.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) { walk(n, lang); });
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
