/* auth.js — NGƯỜI DÙNG
   ---------------------------------------------------------------
   Có 2 tầng, cố tình thiết kế như vậy để không ai bị chặn ở cửa:

   1) HỒ SƠ TRÊN MÁY (luôn có, không cần mạng)
      Nhiều người học chung 1 máy/1 máy tính bảng: mỗi người 1 hồ sơ,
      tiến trình ôn tập tách riêng. Bấm avatar > "Đổi / Thêm người học".

   2) TÀI KHOẢN CLOUD (khi đã cấu hình Supabase)
      Đăng nhập bằng email (magic link — không cần mật khẩu). Lúc này
      tiến trình được lưu lên server nên đổi máy/đổi điện thoại vẫn còn.
   --------------------------------------------------------------- */
(function (w) {
  "use strict";

  var LS_USERS = "tjwl_users_v1";
  var LS_CUR = "tjwl_current_user_v1";

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

  Auth.init = async function () {
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
