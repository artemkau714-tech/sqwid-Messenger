/* ============================================================
   sqwidfire.js — Sqwid Help AI (Официальный ИИ-помощник)
   ============================================================ */

console.log("🚀 sqwidfire.js загружен, жду Sqwid...");

function waitForSqwidFire(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ sqwidfire.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidFire((S) => {
  const { db, ref, get, set, push, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 sqwidfire.js (Help AI) активирован");

  /* ============================================================
     ЧАСТЬ 1: БОТ SQWID HELP AI
     ============================================================ */
  const BOT_UID = "sqwidfire_bot";
  const BOT_NAME = "Sqwid Help AI";
  const BOT_USERNAME = "sqwid_help_ai";
  
  // Иконка робота/помощника в стиле Sqwid (фиолетовый щит/робот)
  const BOT_PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>' +
    '<rect width="100" height="100" rx="20" fill="#111"/>' +
    '<circle cx="50" cy="50" r="40" fill="url(#grad)"/>' +
    '<circle cx="35" cy="45" r="6" fill="#fff"/>' +
    '<circle cx="65" cy="45" r="6" fill="#fff"/>' +
    '<path d="M30 65 Q50 80 70 65" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '</svg>'
  );

  async function ensureBot() {
    const snap = await get(ref(db, "users/" + BOT_UID));
    const existing = snap.val() || {};
    if (existing.name === BOT_NAME && existing.username === BOT_USERNAME) return;
    await update(ref(db, "users/" + BOT_UID), {
      name: BOT_NAME,
      username: BOT_USERNAME,
      photo: BOT_PHOTO,
      isBot: true,
      verified: true, // Галочка верификации
      bio: "🤖 Официальный ИИ-помощник Sqwid. Отвечу на любой вопрос о мессенджере!",
      createdAt: existing.createdAt || Date.now()
    });
  }
  ensureBot();

  async function openBotChat() {
    const chatsSnap = await get(ref(db, "chats"));
    const chats = chatsSnap.val() || {};
    let existingId = null;
    for (const id in chats) {
      const c = chats[id];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[currentUser.uid] && m[BOT_UID] && Object.keys(m).length === 2) {
        existingId = id;
        break;
      }
    }

    let chatId = existingId;
    if (!chatId) {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: BOT_NAME,
        type: "private",
        members: { [currentUser.uid]: true, [BOT_UID]: true },
        owner: currentUser.uid,
        photo: BOT_PHOTO,
        createdAt: Date.now(),
        lastMsgAt: Date.now()
      });
      chatId = newRef.key;
    }

    const msgsSnap = await get(ref(db, "messages/" + chatId));
    const msgs = msgsSnap.val() || {};
    const userMsgs = Object.values(msgs).filter(m => m.sender === currentUser.uid);

    if (userMsgs.length === 0) {
      const greetRef = push(ref(db, "messages/" + chatId));
      await set(greetRef, {
        sender: BOT_UID,
        type: "text",
        text: "🤖 Привет! Я — Sqwid Help AI, твой официальный помощник.\n\nЯ знаю абсолютно всё о нашем мессенджере: игры, Сквидики, Sqwid+, юзернеймы, звонки и настройки. \n\nЗадай мне любой вопрос!",
        timestamp: Date.now()
      });
      await update(ref(db, "chats/" + chatId), {
        lastMsg: "🤖 Привет! Я — Sqwid Help AI...",
        lastMsgAt: Date.now()
      });
    }

    if (window.Sqwid.openChat) window.Sqwid.openChat(chatId);
  }
  window.Sqwid.openSqwidFire = openBotChat;

  // Обработка команд (пока оставим /pet, если нужно)
  async function handleBotCommand(chatId, text) {
    const lower = text.toLowerCase().trim();
    if (!lower.startsWith("/pet")) return;

    const parts = lower.split(/\s+/);
    if (parts.length < 2) {
      const botRef = push(ref(db, "messages/" + chatId));
      await set(botRef, {
        sender: BOT_UID,
        type: "text",
        text: "Использование: /pet @username\n\nНапример: /pet @ivan",
        timestamp: Date.now()
      });
      return;
    }

    const targetUsername = parts[1].replace("@", "");

    const mySnap = await get(ref(db, "users/" + currentUser.uid));
    const myData = mySnap.val() || {};
    if (myData.username && myData.username.toLowerCase() === targetUsername) {
      const botRef = push(ref(db, "messages/" + chatId));
      await set(botRef, {
        sender: BOT_UID,
        type: "text",
        text: "🤔 Нельзя пригласить самого себя. Укажи username друга.",
        timestamp: Date.now()
      });
      return;
    }

    // ... (Остальной код /pet можно оставить, если он тебе нужен)
  }

  async function interceptBotSend() {
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return false;
    const chatSnap = await get(ref(db, "chats/" + chatId));
    const chat = chatSnap.val() || {};
    const m = chat.members || {};
    if (!m[BOT_UID]) return false;
    
    const input = document.getElementById("msgInput");
    const text = (input.value || "").trim();
    if (!text) return false;

    // 1. Если это команда /pet
    if (text.toLowerCase().startsWith("/pet")) {
      const newRef = push(ref(db, "messages/" + chatId));
      await set(newRef, {
        sender: currentUser.uid,
        type: "text",
        text: text,
        timestamp: Date.now()
      });
      await update(ref(db, "chats/" + chatId), {
        lastMsg: text, lastMsgAt: Date.now(), lastMsgSender: currentUser.uid
      });
      input.value = "";
      setTimeout(() => handleBotCommand(chatId, text), 400);
      return true;
    }

    // 2. ЛОКАЛЬНЫЙ ИИ
    const aiResponse = window.Sqwid.getAiResponse(text);

    // Отправляем сообщение юзера
    const userMsgRef = push(ref(db, "messages/" + chatId));
    await set(userMsgRef, {
      sender: currentUser.uid,
      type: "text",
      text: text,
      timestamp: Date.now()
    });

    // Бот отвечает через 1 секунду (имитация набора текста)
    setTimeout(async () => {
      const botMsgRef = push(ref(db, "messages/" + chatId));
      await set(botMsgRef, {
        sender: BOT_UID,
        type: "text",
        text: aiResponse,
        timestamp: Date.now()
      });
      await update(ref(db, "chats/" + chatId), {
        lastMsg: aiResponse, lastMsgAt: Date.now(), lastMsgSender: BOT_UID
      });
    }, 1000);

    await update(ref(db, "chats/" + chatId), {
      lastMsg: text, lastMsgAt: Date.now(), lastMsgSender: currentUser.uid
    });

    input.value = "";
    return true;
  }

  const msgInputEl = document.getElementById("msgInput");
  if (msgInputEl) {
    msgInputEl.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const handled = await interceptBotSend();
        if (handled) { e.preventDefault(); e.stopPropagation(); }
      }
    }, true);
  }
  const btnSendEl = document.getElementById("btnSend");
  if (btnSendEl) {
    btnSendEl.addEventListener("click", async (e) => {
      const handled = await interceptBotSend();
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  console.log("✅ sqwidfire.js (Sqwid Help AI) готов");
});