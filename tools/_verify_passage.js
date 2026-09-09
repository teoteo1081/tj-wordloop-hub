/* _verify_passage.js — kiểm 1 bài đọc Claude viết tay TRƯỚC KHI đẩy lên
   Supabase, đúng quy trình bắt buộc trong CLAUDE.md mục "Khi viết bài đọc
   tay hàng loạt". Đọc JSON {terms, marked, meta} từ FILE (argv[2]), in ra
   PASS/FAIL từng điều kiện. Không sửa gì trong context.js, chỉ require()
   thẳng để dùng đúng logic thật app đang chạy — sai ở đây là sai luôn cả
   trên web, không phải sai riêng ở tool.
   Dùng: node tools/_verify_passage.js path/to/case.json */
global.window = {
  esc: function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
};
require("../js/context.js");
var Context = global.window.Context;

var fs = require("fs");
var caseFile = process.argv[2];
if (!caseFile) { console.error("Dùng: node _verify_passage.js case.json"); process.exit(1); }
var data = JSON.parse(fs.readFileSync(caseFile, "utf-8"));

var terms = data.terms;         // ["term1", "term2", ...]
var marked = data.marked;       // đoạn văn có [term]
var meta = data.meta;           // {title, source, vi:{term_lower: câu dịch}, claude:true}

var ok = true;
function check(name, cond, detail) {
  console.log((cond ? "PASS" : "FAIL") + " — " + name + (detail ? " (" + detail + ")" : ""));
  if (!cond) ok = false;
}

var gaps = Context.gapSentences(marked);
check("Số câu gap = số term (" + terms.length + ")", gaps.length === terms.length,
      "gaps=" + gaps.length);

var gapTermsLower = gaps.map(function (g) { return g.term.toLowerCase(); }).sort();
var wantTermsLower = terms.map(function (t) { return t.toLowerCase(); }).sort();
check("Đúng khớp toàn bộ term (không thiếu/thừa/trùng)",
      JSON.stringify(gapTermsLower) === JSON.stringify(wantTermsLower),
      "got=" + JSON.stringify(gapTermsLower) + " want=" + JSON.stringify(wantTermsLower));

var built = Context.build(marked);
var wordCount = built.plain.trim() ? built.plain.trim().split(/\s+/).length : 0;
check("Số từ >= 450", wordCount >= 450, "wordCount=" + wordCount);

var missingVi = [];
gaps.forEach(function (g) {
  var t = Context.translate(g.text, g.term, null, meta.vi);
  if (!t) missingVi.push(g.term);
});
check("meta.vi khớp đủ mọi gap (translate không rỗng)", missingVi.length === 0,
      "thiếu: " + JSON.stringify(missingVi));

var full = marked + Context.META_SEP + JSON.stringify(meta);
var parsed = Context.parseMeta(full);
check("Round-trip parseMeta.marked === marked", parsed.marked === marked);
check("meta.claude === true", meta.claude === true);

console.log(ok ? "\n=== TAT CA PASS ===" : "\n=== CO FAIL, DUNG LAI, SUA TRUOC KHI DAY LEN ===");
process.exit(ok ? 0 : 1);
