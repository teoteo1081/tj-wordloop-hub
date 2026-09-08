/* auth.js — NGƯỜI DÙNG
   ---------------------------------------------------------------
   Có 3 tầng, cố tình thiết kế như vậy để không ai bị chặn ở cửa:

   1) HỒ SƠ TRÊN MÁY (luôn có, không cần mạng)
      Nhiều người học chung 1 máy/1 máy tính bảng: mỗi người 1 hồ sơ,
      tiến trình ôn tập tách riêng. Bấm avatar > "Đổi / Thêm người học".

   2) TÀI KHOẢN CLOUD QUA EMAIL (khi đã cấu hình Supabase)
      Đăng nhập bằng email (magic link — không cần mật khẩu). Lúc này
      tiến trình được lưu lên server nên đổi máy/đổi điện thoại vẫn còn.
      Bị giới hạn bởi quota gửi email miễn phí của Supabase (2 email/giờ)
      nên không dùng được cho nhiều người học hàng ngày.

   3) TÀI KHOẢN CLOUD QUA LINK (MỚI, 2026-09-07 — thay thế (2) cho việc
      dùng hàng ngày) — host (Thao) tự tạo 1 dòng trong bảng "profiles"
      trên Supabase (Table Editor, không cần code), copy "id" (uuid) của
      dòng đó, ghép thành link dạng
      "?u=<id>" (VD .../tj-wordloop-hub/?u=xxxxxxxx-xxxx-...") rồi gửi
      cho người học. Mở link đó 1 lần trên bất kỳ thiết bị nào -> nhận
      diện luôn là ĐÚNG người đó (lưu lại trong localStorage, không cần
      mở lại link mỗi lần) - tiến trình đồng bộ qua Supabase y hệt cách
      (2), nhưng không cần email/không giới hạn số người. Xem
      tryLinkLogin() bên dưới. ĐÁNH ĐỔI: không xác minh danh tính gì cả -
      ai có đúng link (uuid dài, khó đoán) đều xem/ghi được tiến trình
      của người đó - chấp nhận được cho app gia đình dùng nội bộ (đã bỏ
      khoá ngoại profiles.id/word_progress.user_id/... về auth.users +
      mở RLS cho vai trò anon, xem SQL đã chạy trên Supabase Dashboard).
   --------------------------------------------------------------- */
(function (w) {
  "use strict";

  var LS_USERS = "tjwl_users_v1";
  var LS_CUR = "tjwl_current_user_v1";
  var LS_LINK_ID = "tjwl_link_user_id_v1";

  var EMOJIS = ["🐣","🦊","🐼","🐨","🦁","🐯","🐸","🐙","🦉","🐝","🌟","🚀","📚","🎯","🔥","💎","🍀","⚡"];

  var Auth = {
    user: null,        // {id, name, emoji, email, cloud}
    cloudSession: null,
    EMOJIS: EMOJIS,
    _listeners: []
  };

  /* ---------- hồ sơ trên máy ---------- */
  function readUsers() {
    try {
      var raw = localStorage.getItem(LS_USERS);
      var arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) {}
    var first = [{ id: w.uid("us"), name: "Học viên 1", emoji: "🐣" }];
    localStorage.setItem(LS_USERS, JSON.stringify(first));
    return first;
  }
  function writeUsers(arr) { localStorage.setItem(LS_USERS, JSON.stringify(arr)); }

  Auth.listLocal = function () { return readUsers(); };

  Auth.createLocal = function (name, emoji) {
    var arr = readUsers();
    var u = { id: w.uid("us"), name: name || ("Học viên " + (arr.length + 1)), emoji: emoji || "🐣" };
    arr.push(u); writeUsers(arr);
    return u;
  };

  Auth.deleteLocal = function (id) {
    var arr = readUsers().filter(function (u) { return u.id !== id; });
    if (!arr.length) arr = [{ id: w.uid("us"), name: "Học viên 1", emoji: "🐣" }];
    writeUsers(arr);
    if (Auth.user && Auth.user.id === id && !Auth.user.cloud) Auth.switchTo(arr[0].id);
    return arr;
  };

  Auth.switchTo = function (id) {
    var u = readUsers().find(function (x) { return x.id === id; });
    if (!u) return null;
    localStorage.setItem(LS_CUR, id);
    Auth.user = { id: u.id, name: u.name, emoji: u.emoji, email: null, cloud: false };
    if (w.DB) w.DB.progressCloud = false;
    fire();
    return Auth.user;
  };

  Auth.updateCurrent = function (name, emoji) {
    if (!Auth.user) return;
    Auth.user.name = name || Auth.user.name;
    Auth.user.emoji = emoji || Auth.user.emoji;

    if (!Auth.user.cloud) {
      var arr = readUsers();
      var u = arr.find(function (x) { return x.id === Auth.user.id; });
      if (u) { u.name = Auth.user.name; u.emoji = Auth.user.emoji; writeUsers(arr); }
    } else if (w.DB && w.DB.sb) {
      w.DB.sb.from("profiles")
        .update({ display_name: Auth.user.name, avatar_emoji: Auth.user.emoji })
        .eq("id", Auth.user.id)
        .then(function () {}, function () {});
    }
    fire();
  };

  function loadLocalCurrent() {
    var arr = readUsers();
    var id = localStorage.getItem(LS_CUR);
    var u = arr.find(function (x) { return x.id === id; }) || arr[0];
    localStorage.setItem(LS_CUR, u.id);
    Auth.user = { id: u.id, name: u.name, emoji: u.emoji, email: null, cloud: false };
    if (w.DB) w.DB.progressCloud = false;
  }

  /* ---------- tài khoản cloud ---------- */
  async function adoptSession(session) {
    Auth.cloudSession = session;
    if (!session || !session.user) { loadLocalCurrent(); fire(); return; }

    var uid = session.user.id;
    var email = session.user.email || "";
    var name = email ? email.split("@")[0] : "Học viên";
    var emoji = EMOJIS[Math.abs(hash(uid)) % EMOJIS.length];

    try {
      var r = await w.DB.sb.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (r.data) {
        name = r.data.display_name || name;
        emoji = r.data.avatar_emoji || emoji;
      } else {
        await w.DB.sb.from("profiles").insert({ id: uid, display_name: name, avatar_emoji: emoji });
      }
    } catch (e) { console.warn("[Auth] profiles:", e.message || e); }

    Auth.user = { id: uid, name: name, emoji: emoji, email: email, cloud: true };
    w.DB.progressCloud = true;
    fire();
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
  }

  /* ---------- tài khoản cloud qua LINK (không cần email) ---------- */
  /* Ưu tiên đọc mã ID từ query string "?u=" (link host mới gửi) - có thì
     LUÔN ghi đè lên bất kỳ mã ID cũ nào đã lưu (đổi người học bằng cách
     mở link mới). Không có "?u=" trên URL thì thử mã ID đã lưu từ lần mở
     link trước (LS_LINK_ID) - để không phải mở lại link mỗi lần vào app.
     Trả về true nếu nhận diện được (Auth.user đã được set), false nếu
     không có gì để thử (rơi về hồ sơ trên máy / email như cũ). */
  async function tryLinkLogin() {
    if (!(w.DB && w.DB.mode === "cloud" && w.DB.sb)) return false;

    var qid = null;
    try { qid = new URLSearchParams(location.search).get("u"); } catch (e) {}
    var id = qid;
    if (!id) {
      try { id = localStorage.getItem(LS_LINK_ID); } catch (e) { id = null; }
    }
    if (!id) return false;

    try {
      var r = await w.DB.sb.from("profiles").select("*").eq("id", id).maybeSingle();
      if (!r.data) {
        // Mã ID sai/không tồn tại (VD gõ nhầm link) - đừng lưu lại, để
        // rơi về hồ sơ trên máy như bình thường, không chặn oan.
        return false;
      }
      try { localStorage.setItem(LS_LINK_ID, id); } catch (e) {}
      Auth.user = {
        id: id,
        name: r.data.display_name || "Học viên",
        emoji: r.data.avatar_emoji || "🐣",
        email: null,
        cloud: true
      };
      w.DB.progressCloud = true;

      // Xoá "?u=..." khỏi thanh địa chỉ sau khi nhận diện xong - link đã
      // làm xong việc (lưu vào localStorage rồi), để lộ mã ID trên URL dễ
      // vô tình copy/chia sẻ nhầm (VD copy link trang đang xem gửi người
      // khác) hơn là cần thiết.
      if (qid) {
        try {
          var url = new URL(location.href);
          url.searchParams.delete("u");
          history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
        } catch (e) {}
      }
      fire();
      return true;
    } catch (e) {
      console.warn("[Auth] link login lỗi:", e.message || e);
      return false;
    }
  }

  Auth.init = async function () {
    var linked = await tryLinkLogin();
    if (linked) return Auth.user;

    if (w.DB && w.DB.mode === "cloud" && w.DB.sb) {
      try {
        var r = await w.DB.sb.auth.getSession();
        await adoptSession(r.data ? r.data.session : null);
      } catch (e) { loadLocalCurrent(); }

      w.DB.sb.auth.onAuthStateChange(function (_evt, session) { adoptSession(session); });
    } else {
      loadLocalCurrent();
    }
    if (!Auth.user) loadLocalCurrent();
    return Auth.user;
  };

  Auth.sendMagicLink = async function (email) {
    if (!(w.DB && w.DB.sb)) throw new Error("Chưa cấu hình Supabase trong js/config.js");
    var r = await w.DB.sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.href.split("#")[0] }
    });
    if (r.error) throw r.error;
    return true;
  };

  Auth.signOut = async function () {
    if (w.DB && w.DB.sb && Auth.user && Auth.user.cloud) {
      try { await w.DB.sb.auth.signOut(); } catch (e) {}
    }
    try { localStorage.removeItem(LS_LINK_ID); } catch (e) {}
    Auth.cloudSession = null;
    loadLocalCurrent();
    fire();
  };

  Auth.canCloud = function () { return !!(w.DB && w.DB.mode === "cloud" && w.DB.sb); };

  /* ---------- thông báo cho app khi user đổi ---------- */
  function fire() { Auth._listeners.forEach(function (cb) { try { cb(Auth.user); } catch (e) {} }); }
  Auth.onChange = function (cb) { Auth._listeners.push(cb); };

  w.Auth = Auth;
})(window);
