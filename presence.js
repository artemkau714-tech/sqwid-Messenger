/* ============================================================
   presence.js — онлайн-статусы (lastSeen)
   ============================================================ */

console.log("🚀 presence.js загружен, жду Sqwid...");

function waitForSqwidPresence(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ presence.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidPresence((S) => {
  const { db, ref, update, onDisconnect, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 presence.js активирован");

  const HEARTBEAT = 30000;    // 30 сек
  const ONLINE_THRESHOLD = 60000;  // если lastSeen < 60 сек назад — онлайн

  const myRef = ref(db, "users/" + currentUser.uid + "/lastSeen");

  // Устанавливаем onDisconnect
  try {
    onDisconnect(myRef).set(Date.now());
  } catch (e) {}

  // Пульс
  function beat() {
    update(ref(db, "users/" + currentUser.uid), { lastSeen: Date.now() }).catch(() => {});
  }
  beat();
  const interval = setInterval(beat, HEARTBEAT);

  // При сворачивании — сразу записываем
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      update(ref(db, "users/" + currentUser.uid), { lastSeen: Date.now() }).catch(() => {});
    } else {
      beat();
    }
  });

  window.addEventListener("beforeunload", () => {
    try {
      update(ref(db, "users/" + currentUser.uid), { lastSeen: Date.now() });
    } catch (e) {}
  });

  /* ============================================================
     ПУБЛИЧНЫЙ API
     ============================================================ */
  window.Sqwid.isUserOnline = function (uid) {
    if (uid === currentUser.uid) return true;
    const u = window.Sqwid.userMap && window.Sqwid.userMap[uid];
    if (!u) return false;
    if (u.hideOnline) return false;
    const ls = u.lastSeen || 0;
    return (Date.now() - ls) < ONLINE_THRESHOLD;
  };

  window.Sqwid.getLastSeenText = function (uid) {
    if (uid === currentUser.uid) return "в сети";
    const u = window.Sqwid.userMap && window.Sqwid.userMap[uid];
    if (!u) return "";
    if (u.hideOnline) return "";
    const ls = u.lastSeen || 0;
    if (!ls) return "";
    const diff = Date.now() - ls;
    if (diff < ONLINE_THRESHOLD) return "в сети";
    if (diff < 60 * 60 * 1000) {
      const m = Math.floor(diff / 60000);
      return "был(а) " + m + " мин назад";
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const h = Math.floor(diff / 3600000);
      return "был(а) " + h + " ч назад";
    }
    const d = new Date(ls);
    return "был(а) " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
  };

  console.log("✅ presence.js готов");
});