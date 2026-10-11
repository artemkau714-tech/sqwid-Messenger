/* ============================================================
   pins.js — закреплённые сообщения в чате
   ============================================================ */

console.log("🚀 pins.js загружен, жду Sqwid...");

function waitForSqwidPins(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ pins.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidPins((S) => {
  const { db, ref, get, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 pins.js активирован");

  let unsubPin = null;
  let currentChatId = null;
  let currentPinId = null;

  /* ============================================================
     ПОДПИСКА НА PIN ТЕКУЩЕГО ЧАТА
     ============================================================ */
  function watchChat(chatId) {
    if (unsubPin) { unsubPin(); unsubPin = null; }
    currentChatId = chatId;
    if (!chatId) { hidePinned(); return; }

    unsubPin = onValue(ref(db, "chats/" + chatId + "/pinned"), (snap) => {
      const pin = snap.val();
      if (!pin || !pin.messageId) { hidePinned(); return; }
      showPinned(pin);
    });
  }

  // Следим за открытием чата через S.getChatId
  setInterval(() => {
    const id = S.getChatId && S.getChatId();
    if (id !== currentChatId) watchChat(id);
  }, 600);

  /* ============================================================
     UI
     ============================================================ */
  function showPinned(pin) {
    const bar = document.getElementById("pinnedBar");
    const text = document.getElementById("pinnedText");
    if (!bar || !text) return;
    currentPinId = pin.messageId;
    text.textContent = pin.text || "Вложение";
    bar.style.display = "flex";
  }

  function hidePinned() {
    const bar = document.getElementById("pinnedBar");
    if (bar) bar.style.display = "none";
    currentPinId = null;
  }

  /* ============================================================
     КЛИК ПО ПЛАШКЕ → СКРОЛЛ К СООБЩЕНИЮ
     ============================================================ */
  const bar = document.getElementById("pinnedBar");
  if (bar) {
    bar.addEventListener("click", (e) => {
      if (e.target.closest("#btnUnpin")) return;
      if (!currentPinId) return;
      const el = document.querySelector(`[data-msg-id="${currentPinId}"]`);
      if (!el) {
        S.showToast("Сообщение не загружено", "info");
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background 0.6s ease";
      el.style.background = "rgba(249,115,22,0.35)";
      setTimeout(() => { el.style.background = ""; }, 1800);
    });
  }

  const btnUnpin = document.getElementById("btnUnpin");
  if (btnUnpin) {
    btnUnpin.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!currentChatId) return;
      await update(ref(db, "chats/" + currentChatId), { pinned: null });
      hidePinned();
      S.showToast("Откреплено", "ok");
    });
  }

  /* ============================================================
     PIN ИЗ МЕНЮ СООБЩЕНИЯ
     ============================================================ */
  // В chat-main.js в openMsgMenu есть longPressMsg
  // Экспортируем функцию, которую он вызовет
  window.Sqwid.pinMessage = async function (msg, chatId) {
    if (!msg || !chatId) return;

    const chatSnap = await get(ref(db, "chats/" + chatId));
    const chat = chatSnap.val() || {};
    const isAdmin = chat.owner === currentUser.uid || (chat.admins && chat.admins[currentUser.uid]);
    const isChannel = chat.type === "channel";

    // Только админ канала / создатель группы может пинить
    if (!isAdmin && !isChannel) {
      S.showToast("Только админы могут закреплять", "warn");
      return;
    }

    let preview = "";
    if (msg.type === "photo") preview = "📷 Фото" + (msg.text ? ": " + msg.text : "");
    else if (msg.type === "voice") preview = "🎤 Голосовое";
    else preview = msg.text || "";

    if (preview.length > 80) preview = preview.slice(0, 80) + "…";

    await update(ref(db, "chats/" + chatId), {
      pinned: {
        messageId: msg.id,
        text: preview,
        by: currentUser.uid,
        at: Date.now()
      }
    });

    S.showToast("Закреплено", "ok");
  };

  console.log("✅ pins.js готов");
});