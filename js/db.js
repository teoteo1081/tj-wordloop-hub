/* db.js — MỘT API, HAI ĐƯỜNG CHẠY
   ---------------------------------------------------------------
   Toàn bộ phần còn lại của app chỉ gọi DB.xxx() và không cần biết
   dữ liệu đang nằm ở đâu.

       config.js để trống  -> mode "local"  (localStorage của máy)
       config.js có key    -> mode "cloud"  (Supabase, dùng chung)

   Nhờ vậy bạn chạy thử được ngay hôm nay, và khi nào sẵn sàng thì
   dán key vào là lên mây, KHÔNG phải sửa một dòng nào ở chỗ khác.
   --------------------------------------------------------------- */
(function (w) {
  "use strict";

  var LS_DB = "tjwl_db_v1";
  var LS_VER = "tjwl_starter_ver_v1";   /* vân tay thư viện đang giữ trong máy */
  var LS_DELETED = "tjwl_deleted_ids_v1";   /* "mộ bia" — id đã xoá hẳn, đừng bao giờ hồi sinh lại */
  var cfg = w.APP_CONFIG || {};

  function readDeletedSet() {
    try { return JSON.parse(localStorage.getItem(LS_DELETED)) || {}; } catch (e) { return {}; }
  }
  function saveDeletedSet(set) {
    try { localStorage.setItem(LS_DELETED, JSON.stringify(set)); } catch (e) {}
  }

  var DB = {
    mode: "local",     // "local" | "cloud"  -> kho từ vựng nằm ở đâu
    progressCloud: false, // tiến trình học có lưu lên server không (cần đăng nhập)
    sb: null,
    ready: false
  };

  /* Tiến trình chỉ lưu được lên Supabase khi user đã đăng nhập thật
     (vì bảng word_progress khoá theo auth.uid()). Chưa đăng nhập thì
     vẫn học bình thường — tiến trình nằm tạm trong máy. */
  function progressLocal() { return DB.mode === "local" || !DB.progressCloud; }

  /* ══════════════ DỮ LIỆU MẪU BAN ĐẦU (chế độ local) ══════════════ */
  function seedWords(list, blockId) {
    return list.map(function (x, i) {
      return {
        id: w.uid("wd"), block_id: blockId, sort: i,
        term: x[0], level: x[1] || "", pos: x[2] || "", ipa: x[3] || "",
        def_en: x[4] || "", meaning_vi: x[5] || ""
      };
    });
  }

  function buildSeed() {
    var hubs = [
      { id: "hub_toeic", code: "TOEIC", name: "TOEIC HUB", sort: 1 },
      { id: "hub_ielts", code: "IELTS", name: "IELTS HUB", sort: 2 },
      { id: "hub_comm",  code: "COMM",  name: "COMMUNICATION HUB", sort: 3 }
    ];
    var nb = { id: "nb_tj", hub_id: "hub_toeic", name: "TJ BOOK", icon: "📓", sort: 1 };
    var sec = { id: "sec_lc", notebook_id: "nb_tj", name: "ETS 2024 · LC", sort: 1 };
    var pg = { id: "pg_t1", section_id: "sec_lc", name: "Test 1 — Part 1&2", sort: 1 };
    var bt = { id: "bt_1", page_id: "pg_t1", name: "Batch 1", sort: 1, created_at: Date.now() };

    var b1 = { id: "bl_1", batch_id: "bt_1", name: "Block 1", global_index: 1, sort: 1, context_passage: "" };
    var b2 = { id: "bl_2", batch_id: "bt_1", name: "Block 2", global_index: 2, sort: 2, context_passage: "" };

    var words = [].concat(
      seedWords([
        ["leverage", "B2", "Verb", "/ˈlevərɪdʒ/", "To use something to maximum advantage.", "tận dụng, đòn bẩy"],
        ["cohesive", "B2", "Adjective", "/koʊˈhiːsɪv/", "United and working well together.", "gắn kết"],
        ["unforeseen", "B2", "Adjective", "/ˌʌnfɔːrˈsiːn/", "Not anticipated or predicted.", "không lường trước"],
        ["comply", "B1", "Verb", "/kəmˈplaɪ/", "To act in accordance with a rule.", "tuân thủ"],
        ["mitigate", "C1", "Verb", "/ˈmɪtɪɡeɪt/", "To make something less severe.", "giảm nhẹ"],
        ["streamline", "B2", "Verb", "/ˈstriːmlaɪn/", "To make a process more efficient.", "tối ưu hoá"],
        ["negotiate", "B1", "Verb", "/nɪˈɡoʊʃieɪt/", "To discuss in order to reach an agreement.", "đàm phán"],
        ["revenue", "B1", "Noun", "/ˈrevənuː/", "Income received by a business.", "doanh thu"],
        ["strategy", "B1", "Noun", "/ˈstrætədʒi/", "A plan designed to achieve a goal.", "chiến lược"],
        ["benchmark", "B2", "Noun", "/ˈbentʃmɑːrk/", "A standard used for comparison.", "điểm chuẩn"]
      ], "bl_1"),
      seedWords([
        ["tentative", "B2", "Adjective", "/ˈtentətɪv/", "Not certain or fixed; provisional.", "dự kiến, tạm thời"],
        ["preliminary", "B2", "Adjective", "/prɪˈlɪmɪneri/", "Coming before the main part.", "sơ bộ"],
        ["spearhead", "C1", "Verb", "/ˈspɪrhed/", "To lead an attack or a campaign.", "dẫn đầu"],
        ["unanimous", "B2", "Adjective", "/juˈnænɪməs/", "Fully in agreement.", "nhất trí"],
        ["feasibility", "C1", "Noun", "/ˌfiːzəˈbɪləti/", "The state of being possible to do.", "tính khả thi"],
        ["expedite", "C1", "Verb", "/ˈekspədaɪt/", "To make a process happen sooner.", "xúc tiến"],
        ["budget", "A2", "Noun", "/ˈbʌdʒɪt/", "The money available for a purpose.", "ngân sách"],
        ["itinerary", "B2", "Noun", "/aɪˈtɪnəreri/", "A planned route or schedule for a trip.", "lịch trình"],
        ["agenda", "B1", "Noun", "/əˈdʒendə/", "A list of items to discuss at a meeting.", "chương trình nghị sự"],
        ["minutes", "B1", "Noun", "/ˈmɪnɪts/", "A written record of a meeting.", "biên bản cuộc họp"]
      ], "bl_2")
    );

    return {
      hubs: hubs, notebooks: [nb], sections: [sec], pages: [pg],
      batches: [bt], blocks: [b1, b2], words: words,
      word_progress: [], block_progress: []
    };
  }

  /* ══════════════ LƯU / ĐỌC localStorage ══════════════ */
  var mem = null;

  function local() {
    if (mem) return mem;
    try {
      var raw = localStorage.getItem(LS_DB);
      mem = raw ? JSON.parse(raw) : buildSeed();
    } catch (e) { mem = buildSeed(); }
    ["hubs", "notebooks", "sections", "pages", "batches", "blocks", "words",
     "word_progress", "block_progress"].forEach(function (k) {
      if (!Array.isArray(mem[k])) mem[k] = [];
    });
    return mem;
  }

  function saveLocal() {
    try { localStorage.setItem(LS_DB, JSON.stringify(local())); }
    catch (e) { w.toast("Bộ nhớ trình duyệt đã đầy", "err"); }
  }

  /* ══════════════ CẬP NHẬT THƯ VIỆN GÓI SẴN ══════════════
     Thư viện chỉ được nạp lúc bộ nhớ trình duyệt còn trống. Máy đã mở app
     một lần rồi sẽ giữ mãi bản cũ — dựng lại thư viện bao nhiêu lần cũng
     không thấy gì mới. Ở đây ta so "vân tay" để phát hiện và mời cập nhật. */
  var LIB = ["hubs", "notebooks", "sections", "pages", "batches", "blocks", "words"];

  function stampVersion(v) {
    try { if (v) localStorage.setItem(LS_VER, v); } catch (e) {}
  }

  DB.starterVersion = function () {
    try { return localStorage.getItem(LS_VER) || ""; } catch (e) { return ""; }
  };

  /* Có bản thư viện mới hơn không? -> {version, words, pages} hoặc null.
     Chỉ tải file vân tay vài chục byte, không tải cả kho 3 MB. */
  DB.checkStarter = async function () {
    if (DB.mode !== "local" || typeof fetch !== "function") return null;
    /* Cửa thoát cho bộ test: các suite tự ghi một kho giả 20 từ vào bộ nhớ,
       kho đó không phải "thư viện cũ" nên đừng hỏi cập nhật — hộp thoại bật
       lên giữa chừng sẽ che mất thứ suite đang bấm. App thật không bao giờ
       ghi cờ này. */
    try { if (localStorage.getItem("tjwl_skip_lib_update_v1")) return null; } catch (e) {}
    try {
      var r = await fetch("data/starter.version.json", { cache: "no-store" });
      if (!r.ok) return null;
      var info = await r.json();
      if (!info || !info.version) return null;
      return info.version === DB.starterVersion() ? null : info;
    } catch (e) { return null; }
  };

  /* Nạp thư viện mới nhưng KHÔNG xoá công sức của người học:
       · bảng tiến trình (word_progress, block_progress) giữ nguyên
       · mục nào đã bị người dùng XOÁ HẲN (có "mộ bia") thì không hồi sinh lại
       · mục nào người dùng tự tạo (id không có trong bản mới) cũng giữ lại
       · mục nào trùng id thì lấy bản mới (tên bài, từ vựng đã sửa lại) */
  DB.applyStarter = async function () {
    var r = await fetch("data/starter.json", { cache: "no-store" });
    if (!r.ok) throw new Error("Không tải được thư viện mới");
    var seed = await r.json();
    if (!seed || !Array.isArray(seed.words) || !seed.words.length) {
      throw new Error("File thư viện rỗng");
    }

    /* Cột "cha" (tổ chức cây) của mỗi bảng — người dùng có thể tự CHUYỂN
       (Notebook sang Hub khác, Section sang Notebook khác…) qua menu "⋯".
       Trước đây trùng id là lấy NGUYÊN bản mới, xoá sạch chỗ người dùng
       vừa chuyển tới — chuyển hub xong, gặp đúng lúc thư viện có bản mới
       (như lần này), bấm Cập nhật là bay mất, tưởng đâu mất dữ liệu. */
    var PARENT_FIELD = {
      notebooks: "hub_id", sections: "notebook_id", pages: "section_id",
      batches: "page_id", blocks: "batch_id", words: "block_id"
    };

    var tomb = readDeletedSet();   /* id nào bạn đã tự xoá thì đừng bao giờ hồi sinh lại */
    var old = local();
    var inSeed = {};
    LIB.forEach(function (t) {
      var fresh = (Array.isArray(seed[t]) ? seed[t] : []).filter(function (row) { return !tomb[row.id]; });
      var have = {};
      fresh.forEach(function (row) { have[row.id] = 1; });
      inSeed[t] = have;

      var oldById = {};
      (old[t] || []).forEach(function (row) { oldById[row.id] = row; });
      var pField = PARENT_FIELD[t];

      var merged = fresh.map(function (row) {
        var localRow = oldById[row.id];
        if (localRow && pField && localRow[pField] !== row[pField]) {
          /* Người dùng đã tự chuyển mục này đi chỗ khác — giữ nguyên chỗ
             họ đã chuyển tới, chỉ lấy nội dung mới (tên, định nghĩa,
             phiên âm…) từ bản thư viện cho các cột còn lại. */
          var r = Object.assign({}, row);
          r[pField] = localRow[pField];
          return r;
        }
        return row;
      });

      var mine = (old[t] || []).filter(function (row) { return !have[row.id]; });
      old[t] = merged.concat(mine);          /* của tôi xếp sau, không mất */
    });

    /* Dọn xác của bản thư viện CŨ. Bản cũ để lại những Notebook / Section
       rỗng không (đúng thứ nhìn thấy là "chưa có section nào"). Chúng không
       nằm trong bản mới, cũng chẳng chứa từ nào -> bỏ. Ngược lại, thứ người
       dùng tự tạo bao giờ cũng có từ bên trong nên vẫn còn nguyên. */
    var PARENT = [
      ["notebooks", "hub_id", "hubs"], ["sections", "notebook_id", "notebooks"],
      ["pages", "section_id", "sections"], ["batches", "page_id", "pages"],
      ["blocks", "batch_id", "batches"], ["words", "block_id", "blocks"]
    ];

    function idSet(t) { var s = {}; old[t].forEach(function (r) { s[r.id] = 1; }); return s; }

    for (var pass = 0; pass < 2; pass++) {
      /* bỏ mục mồ côi: cha đã biến mất */
      PARENT.forEach(function (p) {
        var ok = idSet(p[2]);
        old[p[0]] = old[p[0]].filter(function (r) { return ok[r[p[1]]]; });
      });
      /* bỏ mục rỗng của bản cũ, từ dưới lên */
      for (var i = PARENT.length - 1; i >= 0; i--) {
        var t = PARENT[i][2], child = PARENT[i][0], field = PARENT[i][1];
        var used = {};
        old[child].forEach(function (r) { used[r[field]] = 1; });
        old[t] = old[t].filter(function (r) { return used[r.id] || inSeed[t][r.id]; });
      }
    }

    saveLocal();
    stampVersion(seed.version);
    return { words: seed.words.length, pages: (seed.pages || []).length };
  };

  function where(arr, field, val) { return arr.filter(function (r) { return r[field] === val; }); }
  function whereIn(arr, field, vals) {
    var set = {}; vals.forEach(function (v) { set[v] = 1; });
    return arr.filter(function (r) { return set[r[field]]; });
  }
  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  /* ══════════════ KHỞI TẠO ══════════════ */
  DB.init = async function () {
    var url = (cfg.SUPABASE_URL || "").trim();
    var key = (cfg.SUPABASE_ANON_KEY || "").trim();

    if (url && key && w.supabase && w.supabase.createClient) {
      try {
        DB.sb = w.supabase.createClient(url, key);
        var probe = await DB.sb.from("hubs").select("id").limit(1);
        if (probe.error) throw probe.error;
        DB.mode = "cloud";
      } catch (e) {
        console.warn("[DB] Không kết nối được Supabase, quay về chế độ local:", e.message || e);
        DB.mode = "local";
        DB.sb = null;
      }
    } else {
      DB.mode = "local";
    }

    if (DB.mode === "local") {
      /* Lần đầu mở trên một máy/điện thoại mới (bộ nhớ còn trống):
         nạp sẵn kho từ vựng đã gói kèm, để mở ra là có cái học ngay.
         Tạo bằng:  py tools\make_starter.py
         Không có file cũng không sao — rơi về bộ dữ liệu mẫu 20 từ. */
      var empty = false;
      try { empty = !localStorage.getItem(LS_DB); } catch (e) { empty = false; }

      if (empty && typeof fetch === "function") {
        try {
          var r = await fetch("data/starter.json", { cache: "no-store" });
          if (r.ok) {
            var seed = await r.json();
            if (seed && Array.isArray(seed.hubs) && Array.isArray(seed.words) && seed.words.length) {
              mem = seed;
              ["word_progress", "block_progress"].forEach(function (k) {
                if (!Array.isArray(mem[k])) mem[k] = [];
              });
              saveLocal();
              stampVersion(seed.version);
              console.info("[DB] Đã nạp sẵn " + seed.words.length + " từ từ data/starter.json");
            }
          }
        } catch (e) { /* mở bằng file:// hoặc không có file -> bỏ qua */ }
      }
      local();
    }

    DB.ready = true;
    return DB.mode;
  };

  function sbList(table, build) {
    var q = DB.sb.from(table).select("*");
    if (build) q = build(q);
    return q.then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }

  /* ══════════════ ĐỌC CÂY DỮ LIỆU ══════════════ */
  DB.getHubs = async function () {
    if (DB.mode === "local") return local().hubs.slice().sort(bySort);
    return (await sbList("hubs", function (q) { return q.order("sort"); }));
  };

  DB.getNotebooks = async function (hubId) {
    if (DB.mode === "local") return where(local().notebooks, "hub_id", hubId).sort(bySort);
    return (await sbList("notebooks", function (q) { return q.eq("hub_id", hubId).order("sort"); }));
  };

  /* Nạp toàn bộ nội dung của 1 notebook (sections -> words) */
  DB.loadNotebook = async function (notebookId) {
    if (DB.mode === "local") {
      var d = local();
      var sections = where(d.sections, "notebook_id", notebookId).sort(bySort);
      var pages    = whereIn(d.pages, "section_id", sections.map(function (s) { return s.id; })).sort(bySort);
      var batches  = whereIn(d.batches, "page_id", pages.map(function (p) { return p.id; })).sort(bySort);
      var blocks   = whereIn(d.blocks, "batch_id", batches.map(function (b) { return b.id; })).sort(bySort);
      var words    = whereIn(d.words, "block_id", blocks.map(function (b) { return b.id; })).sort(bySort);
      return { sections: sections, pages: pages, batches: batches, blocks: blocks, words: words };
    }

    var sections = await sbList("sections", function (q) { return q.eq("notebook_id", notebookId).order("sort"); });
    var sIds = sections.map(function (s) { return s.id; });
    var pages = sIds.length ? await sbList("pages", function (q) { return q.in("section_id", sIds).order("sort"); }) : [];
    var pIds = pages.map(function (p) { return p.id; });
    var batches = pIds.length ? await sbList("batches", function (q) { return q.in("page_id", pIds).order("sort"); }) : [];
    var bIds = batches.map(function (b) { return b.id; });
    var blocks = bIds.length ? await sbList("blocks", function (q) { return q.in("batch_id", bIds).order("sort"); }) : [];
    var blIds = blocks.map(function (b) { return b.id; });
    var words = blIds.length ? await sbList("words", function (q) { return q.in("block_id", blIds).order("sort"); }) : [];
    return { sections: sections, pages: pages, batches: batches, blocks: blocks, words: words };
  };

  /* ══════════════ THÊM MỚI ══════════════ */
  async function insertOne(table, row) {
    if (DB.mode === "local") {
      row.id = row.id || w.uid(table.slice(0, 2));
      local()[table].push(row);
      saveLocal();
      return row;
    }
    var r = await DB.sb.from(table).insert(row).select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  DB.insertHub = function (name) {
    return insertOne("hubs", {
      code: String(name || "HUB").toUpperCase().slice(0, 12),
      name: name, sort: 9999
    });
  };

  DB.addNotebook = function (hubId, name, icon) {
    return insertOne("notebooks", { hub_id: hubId, name: name, icon: icon || "📓", sort: Date.now() % 100000 });
  };
  DB.addSection = function (notebookId, name) {
    return insertOne("sections", { notebook_id: notebookId, name: name, sort: Date.now() % 100000 });
  };
  DB.addPage = function (sectionId, name) {
    return insertOne("pages", { section_id: sectionId, name: name, sort: Date.now() % 100000 });
  };

  /* Tạo 1 Batch mới + tự cắt danh sách từ thành các Block 10 từ */
  DB.addBatchFromWords = async function (pageId, parsedWords, batchName, startGlobalIndex) {
    var per = cfg.WORDS_PER_BLOCK || 10;
    var groups = w.chunk(parsedWords, per);
    if (!groups.length) throw new Error("Không có từ nào hợp lệ");

    var batch = await insertOne("batches", {
      page_id: pageId, name: batchName, sort: Date.now() % 100000, created_at: Date.now()
    });

    var gi = startGlobalIndex || 1;
    var blocks = [], words = [];

    for (var i = 0; i < groups.length; i++) {
      var blk = await insertOne("blocks", {
        batch_id: batch.id, name: "Block " + gi, global_index: gi, sort: i + 1, context_passage: ""
      });
      gi++;
      blocks.push(blk);

      var rows = groups[i].map(function (x, j) {
        return {
          block_id: blk.id, sort: j, term: x.term, level: x.level || "",
          pos: x.pos || "", ipa: x.ipa || "", def_en: x.def_en || "", meaning_vi: x.meaning_vi || ""
        };
      });

      if (DB.mode === "local") {
        rows.forEach(function (r) { r.id = w.uid("wd"); local().words.push(r); });
        saveLocal();
        words = words.concat(rows);
      } else {
        var res = await DB.sb.from("words").insert(rows).select();
        if (res.error) throw res.error;
        words = words.concat(res.data || []);
      }
    }

    return { batch: batch, blocks: blocks, words: words };
  };

  /* ══════════════ LƯU TỪ KIỂU LingQ ══════════════
     Bôi/bấm một từ trong bài đọc rồi lưu -> từ được đưa vào batch "⭐ Từ đã lưu"
     của Page hiện tại. Cứ đủ 10 từ thì tự ngắt sang Block kế tiếp. */
  var SAVED_BATCH = "⭐ Từ đã lưu";

  DB.saveWordToExtra = async function (pageId, item, ctx) {
    var per = cfg.WORDS_PER_BLOCK || 10;

    /* 1. tìm (hoặc tạo) batch "⭐ Từ đã lưu" của page này */
    var batch;
    if (DB.mode === "local") {
      batch = local().batches.find(function (b) { return b.page_id === pageId && b.name === SAVED_BATCH; });
    } else {
      var rb = await DB.sb.from("batches").select("*").eq("page_id", pageId).eq("name", SAVED_BATCH).maybeSingle();
      if (rb.error) throw rb.error;
      batch = rb.data;
    }
    if (!batch) {
      batch = await insertOne("batches", {
        page_id: pageId, name: SAVED_BATCH, sort: 9999, created_at: Date.now()
      });
    }

    /* 2. các block trong batch đó */
    var blocks;
    if (DB.mode === "local") {
      blocks = where(local().blocks, "batch_id", batch.id).sort(bySort);
    } else {
      blocks = await sbList("blocks", function (q) { return q.eq("batch_id", batch.id).order("sort"); });
    }

    /* 3. block cuối còn chỗ không? chưa đủ 10 từ thì nhét tiếp vào đó */
    var target = null, count = 0;
    if (blocks.length) {
      var last = blocks[blocks.length - 1];
      if (DB.mode === "local") {
        count = where(local().words, "block_id", last.id).length;
      } else {
        var rw = await DB.sb.from("words").select("id").eq("block_id", last.id);
        if (rw.error) throw rw.error;
        count = (rw.data || []).length;
      }
      if (count < per) target = last;
    }

    if (!target) {
      var gi = ctx && ctx.nextGlobalIndex ? ctx.nextGlobalIndex : (blocks.length + 1);
      target = await insertOne("blocks", {
        batch_id: batch.id, name: "Block " + gi, global_index: gi,
        sort: blocks.length + 1, context_passage: ""
      });
      count = 0;
    }

    /* 4. ghi từ */
    var word = await insertOne("words", {
      block_id: target.id, sort: count,
      term: item.term, level: item.level || "", pos: item.pos || "",
      ipa: item.ipa || "", def_en: item.def_en || "", meaning_vi: item.meaning_vi || ""
    });

    return { batch: batch, block: target, word: word, isNewBlock: count === 0 };
  };

  /* Mức độ thuộc kiểu LingQ: 1 (mới) … 4 (gần thuộc) … 5 (đã biết) */
  DB.saveFamiliarity = function (userId, wordId, level) {
    return DB.saveWordProgress(userId, wordId, { familiarity: level, last_reviewed_at: Date.now() });
  };

  /* ══════════════ CẬP NHẬT / XOÁ ══════════════ */
  DB.rename = async function (table, id, name) {
    if (DB.mode === "local") {
      var row = local()[table].find(function (r) { return r.id === id; });
      if (row) { row.name = name; saveLocal(); }
      return row;
    }
    var r = await DB.sb.from(table).update({ name: name }).eq("id", id).select().single();
    if (r.error) throw r.error;
    return r.data;
  };

  /* Đổi thứ tự / chuyển cha: dùng chung cho notebook, section, page, batch, block */
  DB.patch = async function (table, id, fields) {
    if (DB.mode === "local") {
      var row = local()[table].find(function (r) { return r.id === id; });
      if (row) { Object.assign(row, fields); saveLocal(); }
      return row;
    }
    var r = await DB.sb.from(table).update(fields).eq("id", id).select().single();
    if (r.error) throw r.error;
    return r.data;
  };

  /* Cây con của từng bảng — dùng để xoá dây chuyền ở chế độ local.
     Trên cloud thì Postgres tự lo nhờ ON DELETE CASCADE. */
  var CHILD = {
    hubs:      ["notebooks", "hub_id"],
    notebooks: ["sections", "notebook_id"],
    sections:  ["pages", "section_id"],
    pages:     ["batches", "page_id"],
    batches:   ["blocks", "batch_id"],
    blocks:    ["words", "block_id"]
  };

  function removeLocalDeep(table, ids, tomb) {
    var d = local();
    if (!d[table] || !ids.length) return;
    var set = {}; ids.forEach(function (i) { set[i] = 1; tomb[i] = 1; });
    d[table] = d[table].filter(function (r) { return !set[r.id]; });

    var kid = CHILD[table];
    if (!kid) return;
    var childTable = kid[0], fk = kid[1];
    var childIds = (d[childTable] || []).filter(function (r) { return set[r[fk]]; })
                                        .map(function (r) { return r.id; });
    removeLocalDeep(childTable, childIds, tomb);
  }

  DB.remove = async function (table, id) {
    if (DB.mode === "local") {
      /* Ghi "mộ bia" cho id vừa xoá (và mọi con cháu bị xoá theo) — để
         applyStarter() sau này biết mà KHÔNG hồi sinh lại nếu id đó nằm
         trong bản thư viện gốc. Không ghi thì: xoá 1 Notebook gốc, sau
         đó gặp "Thư viện có bản mới" và bấm Đồng ý -> nó sống lại, tưởng
         đâu app không lưu được thao tác xoá của mình. */
      var tomb = readDeletedSet();
      removeLocalDeep(table, [id], tomb);
      saveDeletedSet(tomb);
      saveLocal();
      return true;
    }
    var r = await DB.sb.from(table).delete().eq("id", id);
    if (r.error) throw r.error;
    return true;
  };

  /* field: "context_passage" (mặc định, khe Dễ) | "context_passage_2" (Vừa)
     | "context_passage_3" (Khó) — 3 khe độc lập, đổi qua lại được. */
  DB.saveContext = async function (blockId, text, field) {
    field = field || "context_passage";
    if (DB.mode === "local") {
      var b = local().blocks.find(function (r) { return r.id === blockId; });
      if (b) { b[field] = text; saveLocal(); }
      return true;
    }
    var patch = {}; patch[field] = text;
    var r = await DB.sb.from("blocks").update(patch).eq("id", blockId);
    if (r.error) throw r.error;
    return true;
  };

  /* ══════════════ TIẾN TRÌNH HỌC (riêng từng user) ══════════════ */
  DB.loadProgress = async function (userId, blockIds, wordIds) {
    var wp = {}, bp = {};
    if (!userId) return { wp: wp, bp: bp };

    if (progressLocal()) {
      local().word_progress.forEach(function (r) { if (r.user_id === userId) wp[r.word_id] = r; });
      local().block_progress.forEach(function (r) { if (r.user_id === userId) bp[r.block_id] = r; });
      return { wp: wp, bp: bp };
    }

    if (wordIds && wordIds.length) {
      var a = await sbList("word_progress", function (q) { return q.eq("user_id", userId).in("word_id", wordIds); });
      a.forEach(function (r) { wp[r.word_id] = r; });
    }
    if (blockIds && blockIds.length) {
      var b = await sbList("block_progress", function (q) { return q.eq("user_id", userId).in("block_id", blockIds); });
      b.forEach(function (r) { bp[r.block_id] = r; });
    }
    return { wp: wp, bp: bp };
  };

  DB.saveWordProgress = async function (userId, wordId, data) {
    var row = Object.assign({ user_id: userId, word_id: wordId }, data);
    if (progressLocal()) {
      var arr = local().word_progress;
      var i = arr.findIndex(function (r) { return r.user_id === userId && r.word_id === wordId; });
      if (i >= 0) arr[i] = Object.assign(arr[i], row); else arr.push(row);
      saveLocal();
      return row;
    }
    var r = await DB.sb.from("word_progress").upsert(row, { onConflict: "user_id,word_id" }).select().single();
    if (r.error) throw r.error;
    return r.data;
  };

  DB.saveBlockProgress = async function (userId, blockId, data) {
    var row = Object.assign({ user_id: userId, block_id: blockId }, data);
    if (progressLocal()) {
      var arr = local().block_progress;
      var i = arr.findIndex(function (r) { return r.user_id === userId && r.block_id === blockId; });
      if (i >= 0) arr[i] = Object.assign(arr[i], row); else arr.push(row);
      saveLocal();
      return row;
    }
    var r = await DB.sb.from("block_progress").upsert(row, { onConflict: "user_id,block_id" }).select().single();
    if (r.error) throw r.error;
    return r.data;
  };

  /* Xoá sạch tiến trình học của một nhóm block/word — để học lại từ đầu
     hoặc để chia sẻ kho từ mà không kèm điểm của mình. Từ vựng giữ nguyên. */
  DB.resetProgress = async function (userId, blockIds, wordIds) {
    blockIds = blockIds || []; wordIds = wordIds || [];
    if (progressLocal()) {
      var d = local();
      d.block_progress = d.block_progress.filter(function (r) {
        return !(r.user_id === userId && blockIds.indexOf(r.block_id) >= 0);
      });
      d.word_progress = d.word_progress.filter(function (r) {
        return !(r.user_id === userId && wordIds.indexOf(r.word_id) >= 0);
      });
      saveLocal();
      return true;
    }
    /* cloud: xoá theo lô 200 id một lần cho khỏi quá dài URL */
    async function wipe(table, col, ids) {
      for (var i = 0; i < ids.length; i += 200) {
        var part = ids.slice(i, i + 200);
        var r = await DB.sb.from(table).delete().eq("user_id", userId).in(col, part);
        if (r.error) throw r.error;
      }
    }
    if (blockIds.length) await wipe("block_progress", "block_id", blockIds);
    if (wordIds.length) await wipe("word_progress", "word_id", wordIds);
    return true;
  };

  /* ══════════════ SAO LƯU / PHỤC HỒI (chỉ chế độ local) ══════════════ */
  DB.exportJSON = function () { return JSON.stringify(local(), null, 2); };

  DB.importJSON = function (jsonText) {
    var data = JSON.parse(jsonText);
    if (!data || !Array.isArray(data.hubs)) throw new Error("File không đúng định dạng");
    mem = data;
    saveLocal();
    return true;
  };

  DB.resetLocal = function () {
    mem = buildSeed();
    saveLocal();
  };

  w.DB = DB;
})(window);
