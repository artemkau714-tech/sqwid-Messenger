/* ============================================================
   notifications.js — Уведомления о новых сообщениях
   Браузерные пуши + favicon badge + звук + вибрация
   ============================================================ */

console.log("🚀 notifications.js загружен, жду Sqwid...");

function waitForSqwidNotify(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser && window.Sqwid.db) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ notifications.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidNotify((S) => {
  const { db, ref, get, onValue, currentUser, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 notifications.js активирован");

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  let permission = ("Notification" in window) ? Notification.permission : "denied";
  let lastSeenMsgTs = Date.now();
  let unreadTotal = 0;
  let unsubAllMsgs = null;
  let isFirstLoad = true;
  let soundEnabled = true;
  let vibrateEnabled = true;

  try {
    soundEnabled = localStorage.getItem("sqwid_notify_sound") !== "0";
    vibrateEnabled = localStorage.getItem("sqwid_notify_vibrate") !== "0";
  } catch (e) {}

  /* ============================================================
     ЗВУК (WebAudio, без файлов)
     ============================================================ */
  let audioCtx = null;
  function ensureCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playNotifySound() {
    if (!soundEnabled) return;
    const ctx = ensureCtx();
    if (!ctx) return;

    const play = (freq, delay, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.setValueAtTime(0.18, t0 + dur - 0.05);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };
    play(880, 0, 0.15);
    play(1200, 0.12, 0.18);
  }

  function playSoundCheck() {
    if (!soundEnabled) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  /* ============================================================
     FAVICON С ЧИСЛОМ НЕПРОЧИТАННЫХ
     ============================================================ */
  function updateFavicon(count) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const base = "data:image/svg+xml;utf8,";
    const txt = count > 99 ? "99+" : String(count);
    const fontSize = count > 9 ? 8 : 10;
    const svg = count > 0
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
           <circle cx="16" cy="16" r="16" fill="#ef4444"/>
           <text x="16" y="21" font-size="${fontSize}" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">${txt}</text>
         </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
           <circle cx="16" cy="16" r="16" fill="#f97316"/>
           <path d="M16 6s3 3 3 6a3 3 0 0 1-6 0c0-1.5.7-2.5.7-2.5S10 13 10 18a6 6 0 0 0 12 0c0-5-6-12-6-12z" fill="#fff"/>
         </svg>`;
    link.href = base + encodeURIComponent(svg);
  }

  function updateTitle(count) {
    const baseTitle = "Sqwid Messenger";
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }

  /* ============================================================
     ЗАПРОС РАЗРЕШЕНИЯ
     ============================================================ */
  async function requestPermission() {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const p = await Notification.requestPermission();
      permission = p;
      return p;
    } catch (e) {
      return "denied";
    }
  }

  let askedOnce = false;
  function askOnceOnUserGesture() {
    if (askedOnce) return;
    askedOnce = true;
    requestPermission().then(p => {
      if (p === "granted") {
        S.showToast && S.showToast("Уведомления включены", "ok");
      }
    });
    document.removeEventListener("click", askOnceOnUserGesture);
    document.removeEventListener("touchstart", askOnceOnUserGesture);
  }
  document.addEventListener("click", askOnceOnUserGesture, { once: true });
  document.addEventListener("touchstart", askOnceOnUserGesture, { once: true });

  /* ============================================================
     ПОКАЗ УВЕДОМЛЕНИЯ
     ============================================================ */
  function showNotification({ title, body, chatId, icon, tag }) {
    if (permission !== "granted") return;
    if (document.visibilityState === "visible") return;

    const opts = {
      body: body || "",
      icon: icon || "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="16" fill="#f97316"/>
          <path d="M16 6s3 3 3 6a3 3 0 0 1-6 0c0-1.5.7-2.5.7-2.5S10 13 10 18a6 6 0 0 0 12 0c0-5-6-12-6-12z" fill="#fff"/>
        </svg>`
      ),
      badge: "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#ef4444"/></svg>`
      ),
      tag: tag || ("sqwid_" + (chatId || "msg")),
      renotify: true,
      silent: true,
      data: { chatId }
    };

    try {
      const n = new Notification(title, opts);
      n.onclick = () => {
        try { window.focus(); } catch (e) {}
        if (chatId && window.Sqwid.openChat) {
          window.Sqwid.openChat(chatId);
        }
        n.close();
      };
      setTimeout(() => { try { n.close(); } catch (e) {} }, 8000);
    } catch (e) {
      console.warn("Notification error:", e);
    }
  }

  /* ============================================================
     СЛУШАЕМ НОВЫЕ СООБЩЕНИЯ ВО ВСЕХ ЧАТАХ
     Без query() — просто onValue(ref) и фильтруем на клиенте.
     ============================================================ */
  function startGlobalMessageWatcher() {
    if (unsubAllMsgs) unsubAllMsgs();

    const unsubChats = onValue(ref(db, "chats"), (chatsSnap) => {
      const chats = chatsSnap.val() || {};
      const myChatIds = [];
      for (const id in chats) {
        if (chats[id].members && chats[id].members[currentUser.uid]) {
          myChatIds.push(id);
        }
      }

      // Отписываемся от предыдущих слушателей
      if (window._notifyListeners) {
        window._notifyListeners.forEach(u => { try { u(); } catch (e) {} });
      }
      window._notifyListeners = [];

      myChatIds.forEach(chatId => {
        // Подписка на весь messages чата (Firebase отдаст только при изменениях)
        const unsub = onValue(ref(db, "messages/" + chatId), (msgSnap) => {
          const data = msgSnap.val() || {};

          // Ищем самое свежее сообщение на клиенте
          let latest = null;
          let latestId = null;
          for (const id in data) {
            const m = data[id];
            if (!m || !m.timestamp) continue;
            if (!latest || m.timestamp > latest.timestamp) {
              latest = m;
              latestId = id;
            }
          }

          if (!latest) return;
          if (isFirstLoad) return;
          if (latest.sender === currentUser.uid) return;
          if (latest.timestamp <= lastSeenMsgTs) return;

          // Проверяем, не выключены ли уведомления у этого чата
          const me = userMap[currentUser.uid] || window._currentUserData || {};
          const mutes = me.muted || {};
          if (mutes[chatId]) return;

          // Если открыт этот чат и вкладка активна — не уведомляем
          const currentChatId = S.getChatId && S.getChatId();
          if (currentChatId === chatId && document.visibilityState === "visible") return;

          // Имя отправителя
          const sender = userMap[latest.sender] || {};
          const senderName = sender.name || sender.email || "Пользователь";

          // Заголовок чата
          const chat = chats[chatId] || {};
          let chatName = chat.name || "";
          if (chat.type === "private") chatName = senderName;

          // Текст превью
          let body = "";
          if (latest.type === "photo") body = "📷 Фото" + (latest.text ? ": " + latest.text : "");
          else if (latest.type === "voice") body = "🎤 Голосовое сообщение";
          else body = latest.text || "Новое сообщение";

          // Уведомление
          showNotification({
            title: chat.type === "private" ? senderName : chatName,
            body: chat.type === "private" ? body : (senderName + ": " + body),
            chatId,
            tag: "sqwid_chat_" + chatId
          });

          // Звук + вибрация
          playNotifySound();
          if (vibrateEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);

          lastSeenMsgTs = latest.timestamp;
        });
        window._notifyListeners.push(unsub);
      });

      // После первого прохода включаем флаг
      setTimeout(() => { isFirstLoad = false; }, 1500);
    });

    unsubAllMsgs = () => {
      try { unsubChats(); } catch (e) {}
      if (window._notifyListeners) {
        window._notifyListeners.forEach(u => { try { u(); } catch (e) {} });
        window._notifyListeners = [];
      }
    };
  }

  /* ============================================================
     СЧЁТЧИК НЕПРОЧИТАННЫХ (общий)
     ============================================================ */
  function updateUnreadBadge() {
    updateFavicon(unreadTotal);
    updateTitle(unreadTotal);
  }

  async function recountUnread() {
    try {
      const snap = await get(ref(db, "chats"));
      const chats = snap.val() || {};
      let total = 0;
      for (const id in chats) {
        if (chats[id].members && chats[id].members[currentUser.uid]) {
          const cnt = chats[id].unreadCount || 0;
          total += cnt;
        }
      }
      unreadTotal = total;
      updateUnreadBadge();
    } catch (e) {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      unreadTotal = 0;
      updateUnreadBadge();
      lastSeenMsgTs = Date.now();
    }
  });

  setInterval(recountUnread, 15000);
  recountUnread();

  /* ============================================================
     НАСТРОЙКИ (для settings.js)
     ============================================================ */
  window.Sqwid.notifications = {
    request: requestPermission,
    isGranted: () => Notification.permission === "granted",
    getSound: () => soundEnabled,
    setSound: (v) => {
      soundEnabled = !!v;
      try { localStorage.setItem("sqwid_notify_sound", v ? "1" : "0"); } catch (e) {}
      if (v) playSoundCheck();
    },
    getVibrate: () => vibrateEnabled,
    setVibrate: (v) => {
      vibrateEnabled = !!v;
      try { localStorage.setItem("sqwid_notify_vibrate", v ? "1" : "0"); } catch (e) {}
      if (v && navigator.vibrate) navigator.vibrate(100);
    },
    test: () => {
      showNotification({
        title: "Sqwid",
        body: "Это тестовое уведомление 🔔",
        tag: "sqwid_test"
      });
      playSoundCheck();
    }
  };

  /* ============================================================
     СТАРТ
     ============================================================ */
  startGlobalMessageWatcher();

  console.log("✅ notifications.js готов");
});