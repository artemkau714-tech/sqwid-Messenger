/* ============================================================
   sqwidfire.js — МЕГА-ФАЙЛ (финал)
   Бот @sqwidfire + приглашения + плавающая кнопка + страница питомца
   + белые SVG-огоньки + шкала + задания с SVG-иконками
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

  console.log("🔥 sqwidfire.js активирован");

  /* ============================================================
     ЧАСТЬ 1: БОТ @sqwidfire
     ============================================================ */
  const BOT_UID = "sqwidfire_bot";
  const BOT_NAME = "Sqwid Fire";
  const BOT_USERNAME = "sqwidfire";
  const BOT_PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="50" fill="#111"/>' +
    '<path d="M50 15s15 15 15 30a15 15 0 0 1-30 0c0-8 5-12 5-12s-20 15-20 35a30 30 0 0 0 60 0c0-25-30-53-30-53z" fill="#fff"/>' +
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
      verified: true,
      bio: "🔥 Официальный бот Sqwid Fire. Расти общий огонёк с друзьями!",
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
        type: "bot_greeting",
        text: "🔥 Привет! Я Sqwid Fire.\n\nПомогу тебе растить общий огонёк с другом. Нажми «Старт», чтобы начать.",
        timestamp: Date.now()
      });
      await update(ref(db, "chats/" + chatId), {
        lastMsg: "🔥 Привет! Я Sqwid Fire.",
        lastMsgAt: Date.now()
      });
    }

    if (window.Sqwid.openChat) window.Sqwid.openChat(chatId);
  }
  window.Sqwid.openSqwidFire = openBotChat;

  document.addEventListener("click", async (e) => {
    const startBtn = e.target.closest("[data-bot-start]");
    if (!startBtn) return;
    e.preventDefault();
    e.stopPropagation();

    const chatId = startBtn.dataset.chatId;
    if (!chatId) return;
    startBtn.remove();

    const botRef = push(ref(db, "messages/" + chatId));
    await set(botRef, {
      sender: BOT_UID,
      type: "text",
      text: "Отлично! 🔥\n\nЧтобы пригласить друга, напиши:\n\n/pet @username\n\nНапример: /pet @ivan\n\nUsername можно посмотреть в профиле друга.",
      timestamp: Date.now()
    });
    await update(ref(db, "chats/" + chatId), {
      lastMsg: "Отлично! 🔥 Напиши /pet @username",
      lastMsgAt: Date.now()
    });
  });

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

    const usersSnap = await get(ref(db, "users"));
    const users = usersSnap.val() || {};
    let targetUid = null;
    for (const uid in users) {
      if (uid === currentUser.uid || uid === BOT_UID) continue;
      if (users[uid].username && users[uid].username.toLowerCase() === targetUsername) {
        targetUid = uid;
        break;
      }
    }

    if (!targetUid) {
      const botRef = push(ref(db, "messages/" + chatId));
      await set(botRef, {
        sender: BOT_UID,
        type: "text",
        text: "❌ Пользователь @" + targetUsername + " не найден.",
        timestamp: Date.now()
      });
      return;
    }

    await sendPetInvite(targetUid);
    const botRef = push(ref(db, "messages/" + chatId));
    await set(botRef, {
      sender: BOT_UID,
      type: "text",
      text: "✅ Приглашение отправлено @" + targetUsername + "!",
      timestamp: Date.now()
    });
    await update(ref(db, "chats/" + chatId), {
      lastMsg: "✅ Приглашение отправлено",
      lastMsgAt: Date.now()
    });
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
    if (!text.toLowerCase().startsWith("/pet")) return false;

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

  async function sendPetInvite(targetUid) {
    if (targetUid === currentUser.uid) {
      S.showToast("Нельзя пригласить самого себя", "error");
      return;
    }

    const partner = await getPartnerChat(currentUser.uid, targetUid);
    let chatId;
    if (!partner) {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: "Чат",
        type: "private",
        members: { [currentUser.uid]: true, [targetUid]: true },
        owner: currentUser.uid,
        createdAt: Date.now(),
        lastMsgAt: Date.now()
      });
      chatId = newRef.key;
    } else {
      chatId = partner.id;
    }

    const inviterSnap = await get(ref(db, "users/" + currentUser.uid));
    const inviter = inviterSnap.val() || {};
    const inviterName = inviter.name || "Пользователь";

    const invRef = push(ref(db, "messages/" + chatId));
    await set(invRef, {
      sender: currentUser.uid,
      type: "pet_invite",
      text: "🔥 " + inviterName + " приглашает вас растить Sqwid Pet!\n\nЭто общий огонёк, который растёт, когда вы общаетесь и выполняете задания.",
      petInvite: {
        from: currentUser.uid,
        fromName: inviterName,
        status: "pending",
        createdAt: Date.now()
      },
      timestamp: Date.now()
    });
    await update(ref(db, "chats/" + chatId), {
      lastMsg: "🔥 Приглашение в Sqwid Pet",
      lastMsgAt: Date.now(),
      lastMsgSender: currentUser.uid
    });
  }

  document.addEventListener("click", async (e) => {
    const acceptBtn = e.target.closest("[data-pet-accept]");
    const declineBtn = e.target.closest("[data-pet-decline]");
    if (!acceptBtn && !declineBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const btn = acceptBtn || declineBtn;
    const msgId = acceptBtn ? btn.dataset.petAccept : btn.dataset.petDecline;
    const chatId = btn.dataset.chatId;
    if (!msgId || !chatId) return;

    const msgSnap = await get(ref(db, `messages/${chatId}/${msgId}`));
    const msg = msgSnap.val();
    if (!msg || !msg.petInvite) return;
    if (msg.petInvite.status !== "pending") {
      S.showToast("Приглашение уже обработано", "info");
      return;
    }

    if (acceptBtn) {
      const partnerUid = msg.petInvite.from;
      if (partnerUid === currentUser.uid) {
        S.showToast("Это ваше приглашение — его должен принять друг", "error");
        return;
      }

      await update(ref(db, `messages/${chatId}/${msgId}/petInvite`), {
        status: "accepted",
        acceptedAt: Date.now()
      });

      await set(ref(db, "chats/" + chatId + "/pet"), {
        level: 1,
        points: 0,
        pointsNeeded: 50,
        createdAt: Date.now(),
        createdBy: currentUser.uid,
        partnerA: currentUser.uid,
        partnerB: partnerUid,
        lastActiveA: Date.now(),
        lastActiveB: Date.now()
      });

      S.showToast("🔥 Sqwid Pet создан!", "ok", 3000);

      const inviterBotChat = await findBotChatWith(partnerUid);
      if (inviterBotChat) {
        const noteRef = push(ref(db, "messages/" + inviterBotChat));
        await set(noteRef, {
          sender: BOT_UID,
          type: "text",
          text: "🎉 Ваше приглашение принято! Открывайте общий чат — там появился огонёк 🔥",
          timestamp: Date.now()
        });
      }
    } else {
      await update(ref(db, `messages/${chatId}/${msgId}/petInvite`), {
        status: "declined",
        declinedAt: Date.now()
      });
      S.showToast("Приглашение отклонено", "info");

      const partnerUid = msg.petInvite.from;
      const inviterBotChat = await findBotChatWith(partnerUid);
      if (inviterBotChat) {
        const noteRef = push(ref(db, "messages/" + inviterBotChat));
        await set(noteRef, {
          sender: BOT_UID,
          type: "text",
          text: "😔 Ваше приглашение в Sqwid Pet отклонено.",
          timestamp: Date.now()
        });
      }
    }
  });

  async function getPartnerChat(uidA, uidB) {
    const chatsSnap = await get(ref(db, "chats"));
    const chats = chatsSnap.val() || {};
    for (const id in chats) {
      const c = chats[id];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[uidA] && m[uidB] && Object.keys(m).length === 2) {
        return { id, ...c };
      }
    }
    return null;
  }

  async function findBotChatWith(uid) {
    const chatsSnap = await get(ref(db, "chats"));
    const chats = chatsSnap.val() || {};
    for (const id in chats) {
      const c = chats[id];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[uid] && m[BOT_UID] && Object.keys(m).length === 2) {
        return id;
      }
    }
    return null;
  }

  /* ============================================================
     ЧАСТЬ 2: SVG-ОГОНЬКИ (6 стадий)
     ============================================================ */
  const LEVEL_NAMES = ["Искра", "Пламя", "Пожар", "Огонь", "Легенда", "Феникс"];

  function getFlameSVG(level) {
    level = Math.max(1, level || 1);
    const stage = Math.min(6, Math.ceil(level / 5));

    const flamePath = "M50 15s15 15 15 30a15 15 0 0 1-30 0c0-8 5-12 5-12s-20 15-20 35a30 30 0 0 0 60 0c0-25-30-53-30-53z";

    let extras = "";
    if (stage >= 2) {
      extras += `<circle cx="30" cy="30" r="2.5" fill="#fff" opacity="0.9"/>`;
      extras += `<circle cx="70" cy="35" r="2" fill="#fff" opacity="0.8"/>`;
      extras += `<circle cx="35" cy="60" r="1.8" fill="#fff" opacity="0.7"/>`;
      extras += `<circle cx="65" cy="65" r="2.2" fill="#fff" opacity="0.75"/>`;
      extras += `<circle cx="25" cy="48" r="1.5" fill="#fff" opacity="0.6"/>`;
    }
    if (stage >= 3) {
      extras += `<path d="M50 30s8 8 8 16a8 8 0 0 1-16 0c0-5 3-7 3-7s-10 7-10 18a15 15 0 0 0 30 0c0-13-15-27-15-27z" fill="#111" opacity="0.35"/>`;
    }
    if (stage >= 4) {
      extras += `<path d="M35 8 L40 0 L45 8 L50 0 L55 8 L60 0 L65 8 L60 12 L40 12 Z" fill="#fff" opacity="0.9"/>`;
    }
    if (stage >= 5) {
      extras += `<path d="M15 40 Q5 30 10 15 Q20 25 25 30 Q20 35 15 40 Z" fill="#fff" opacity="0.85"/>`;
      extras += `<path d="M85 40 Q95 30 90 15 Q80 25 75 30 Q80 35 85 40 Z" fill="#fff" opacity="0.85"/>`;
    }
    let aura = "";
    if (stage >= 6) {
      aura = `<circle cx="50" cy="50" r="48" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.4"/>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.25"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width="0.4" opacity="0.15"/>`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
        ${aura}
        <path d="${flamePath}" fill="#fff"/>
        ${extras}
      </svg>
    `;
  }

  function getLevelName(level) {
    level = Math.max(1, level || 1);
    const idx = Math.min(5, Math.floor((level - 1) / 5));
    return LEVEL_NAMES[idx];
  }

  /* ============================================================
     ЧАСТЬ 3: ПЛАВАЮЩАЯ КНОПКА
     ============================================================ */
  let currentPetChatId = null;
  let petData = null;
  let unsubPet = null;
  let floatingBtn = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let btnStartX = 0;
  let btnStartY = 0;
  let hasMoved = false;

  const STORAGE_KEY = "sqwid_pet_pos_" + currentUser.uid;

  function createFloatingBtn(pet) {
    if (floatingBtn) return;

    floatingBtn = document.createElement("div");
    floatingBtn.id = "sqwidPetBtn";
    floatingBtn.innerHTML = getFlameSVG(pet.level || 1);

    floatingBtn.style.cssText = `
      position: fixed;
      z-index: 9998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #333, #000);
      box-shadow: 0 4px 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,255,255,0.15);
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;

    if (!document.getElementById("sqwidPetStyles")) {
      const style = document.createElement("style");
      style.id = "sqwidPetStyles";
      style.textContent = `
        @keyframes sqwidPetPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,255,255,0.15); }
          50% { box-shadow: 0 4px 28px rgba(255,255,255,0.65), 0 0 60px rgba(255,255,255,0.25); }
        }
        @keyframes sqwidPetAppear { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        #sqwidPetBtn { animation: sqwidPetPulse 2.5s ease-in-out infinite, sqwidPetAppear 0.4s ease-out; }
        #sqwidPetBtn:active { cursor: grabbing; }
      `;
      document.head.appendChild(style);
    }

    let pos = loadSavedPos();
    if (!pos) {
      pos = { x: window.innerWidth - 76, y: window.innerHeight - 200 };
    }
    floatingBtn.style.left = pos.x + "px";
    floatingBtn.style.top = pos.y + "px";

    document.body.appendChild(floatingBtn);

    const onStart = (e) => {
      e.preventDefault();
      isDragging = true;
      hasMoved = false;

      const point = e.touches ? e.touches[0] : e;
      dragStartX = point.clientX;
      dragStartY = point.clientY;

      const rect = floatingBtn.getBoundingClientRect();
      btnStartX = rect.left;
      btnStartY = rect.top;

      floatingBtn.style.transition = "none";
      floatingBtn.style.animation = "none";

      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - dragStartX;
      const dy = point.clientY - dragStartY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

      let newX = btnStartX + dx;
      let newY = btnStartY + dy;

      const maxX = window.innerWidth - floatingBtn.offsetWidth - 4;
      const maxY = window.innerHeight - floatingBtn.offsetHeight - 4;
      newX = Math.max(4, Math.min(maxX, newX));
      newY = Math.max(4, Math.min(maxY, newY));

      floatingBtn.style.left = newX + "px";
      floatingBtn.style.top = newY + "px";
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);

      floatingBtn.style.transition = "transform 0.15s ease, box-shadow 0.15s ease";
      floatingBtn.style.animation = "sqwidPetPulse 2.5s ease-in-out infinite";

      if (!hasMoved) {
        openPetPage();
        return;
      }

      const rect = floatingBtn.getBoundingClientRect();
      savePos({ x: rect.left, y: rect.top });
    };

    floatingBtn.addEventListener("touchstart", onStart, { passive: false });
    floatingBtn.addEventListener("mousedown", onStart);
  }

  function savePos(pos) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch (e) {}
  }
  function loadSavedPos() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return null;
      const p = JSON.parse(s);
      if (typeof p.x !== "number" || typeof p.y !== "number") return null;
      p.x = Math.max(4, Math.min(window.innerWidth - 60, p.x));
      p.y = Math.max(4, Math.min(window.innerHeight - 60, p.y));
      return p;
    } catch (e) { return null; }
  }

  function removeFloatingBtn() {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  }

  function subscribePet(chatId) {
    if (unsubPet) { unsubPet(); unsubPet = null; }
    if (!chatId) return;

    unsubPet = onValue(ref(db, "chats/" + chatId + "/pet"), (snap) => {
      const pet = snap.val();
      petData = pet;
      if (pet && floatingBtn) {
        floatingBtn.innerHTML = getFlameSVG(pet.level || 1);
      }
    });
  }

  window.Sqwid.onChatOpen = function (chatId) {
    if (!chatId) return;
    currentPetChatId = chatId;
    removeFloatingBtn();

    get(ref(db, "chats/" + chatId + "/pet")).then((snap) => {
      const pet = snap.val();
      if (pet) {
        petData = pet;
        createFloatingBtn(pet);
        subscribePet(chatId);
      } else {
        petData = null;
      }
    }).catch(() => {});
  };

  window.Sqwid.onChatClose = function () {
    currentPetChatId = null;
    petData = null;
    if (unsubPet) { unsubPet(); unsubPet = null; }
    removeFloatingBtn();
  };

  /* ============================================================
     ЧАСТЬ 4: SVG-ИКОНКИ ЗАДАНИЙ
     ============================================================ */
  const TASK_ICONS = {
    chat:     `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    camera:   `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    thumbsUp: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
    mic:      `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
    flame:    `<svg viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/></svg>`,
    clock:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
    heart:    `<svg viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    sunrise:  `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>`,
    moon:     `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    target:   `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    smile:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    shield:   `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    gift:     `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
    rocket:   `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
    phone:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    star:     `<svg viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    music:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    globe:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    cake:     `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/></svg>`,
    palette:  `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    doc:      `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    trophy:   `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
    party:    `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>`,
    crown:    `<svg viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/></svg>`
  };

  /* ============================================================
     ЧАСТЬ 5: СТРАНИЦА ПИТОМЦА
     ============================================================ */
  let unsubPetPage = null;
  let unsubTasks = null;
  let dailyTasks = {};

  function ensurePetPage() {
    let screen = document.getElementById("screen-sqwidpet");
    if (screen) return screen;

    screen = document.createElement("div");
    screen.id = "screen-sqwidpet";
    screen.className = "screen";

    screen.innerHTML = `
      <header class="top-bar">
        <button class="top-new-btn" id="btnBackSqwidPet">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div class="top-title" style="flex:1;display:flex;align-items:center;gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/></svg>
          Sqwid Pet
        </div>
        <div id="petStageLabel" style="font-size:0.75rem;padding:0.25rem 0.6rem;border-radius:999px;background:rgba(255,255,255,0.1);color:#fff;font-weight:800;">Искра</div>
      </header>

      <div id="petPageScroll" style="flex:1;overflow-y:auto;padding-bottom:100px;background:radial-gradient(circle at 50% 20%, #1a1a1a 0%, #000 70%);min-height:100%;">
        <div style="display:flex;justify-content:center;padding:30px 20px 10px;">
          <div id="petAvatarWrap" style="width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #333, #000);box-shadow:0 0 60px rgba(255,255,255,0.4), 0 0 120px rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;padding:24px;position:relative;">
            <div id="petAvatar" style="width:100%;height:100%;"></div>
          </div>
        </div>
        <div style="text-align:center;padding:0 20px 10px;">
          <div id="petPetName" style="font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:-0.5px;">Искра</div>
          <div style="font-size:0.85rem;color:#a1a1aa;font-weight:700;margin-top:2px;">
            Уровень <span id="petLevel" style="color:#fff;">1</span>
          </div>
        </div>
        <div style="padding:16px 24px 4px;">
          <div id="petProgressBar" style="height:20px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;position:relative;box-shadow:inset 0 2px 8px rgba(0,0,0,0.4);">
            <div id="petProgressFill" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#fff 0%, #a78bfa 25%, #f97316 50%, #ec4899 75%, #ef4444 100%);transition:width 0.6s cubic-bezier(0.4,0,0.2,1);box-shadow:0 0 20px rgba(255,255,255,0.6);"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:0 4px;">
            <span id="petPoints" style="font-size:0.82rem;color:#fff;font-weight:800;">0 / 50</span>
            <span id="petPointsLeft" style="font-size:0.75rem;color:#a1a1aa;font-weight:600;">до след. уровня</span>
          </div>
        </div>
        <div style="padding:16px 24px;">
          <button id="btnPetPat" style="width:100%;padding:14px;border-radius:16px;border:none;background:linear-gradient(135deg,#1a1a1a,#333);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 20px rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
            Погладить друга
          </button>
        </div>
        <div style="padding:20px 20px 10px;">
          <div style="font-size:0.75rem;color:#a1a1aa;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;margin:0 4px 12px;">Задания на сегодня</div>
          <div id="petTasksList"></div>
        </div>
        <div style="padding:10px 20px 30px;text-align:center;">
          <div style="font-size:0.72rem;color:#52525b;line-height:1.5;">Общайтесь с другом и выполняйте задания вместе,<br>чтобы растить огонёк</div>
        </div>
      </div>
    `;

    document.body.appendChild(screen);

    if (!document.getElementById("sqwidPetPageStyles")) {
      const style = document.createElement("style");
      style.id = "sqwidPetPageStyles";
      style.textContent = `
        @keyframes petFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes petAvaPulse {
          0%, 100% { box-shadow: 0 0 60px rgba(255,255,255,0.4), 0 0 120px rgba(255,255,255,0.15); }
          50% { box-shadow: 0 0 80px rgba(255,255,255,0.65), 0 0 160px rgba(255,255,255,0.25); }
        }
        #petAvatarWrap { animation: petFloat 3s ease-in-out infinite, petAvaPulse 3s ease-in-out infinite; }
        .pet-task-row { display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-bottom:8px;transition:background 0.2s ease; }
        .pet-task-row.done { background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3); }
        .pet-task-icon { display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0;color:#fff; }
        .pet-task-icon svg { width:22px;height:22px;display:block; }
        .pet-task-info { flex:1;min-width:0; }
        .pet-task-name { font-size:0.9rem;font-weight:700;color:#fff;line-height:1.3; }
        .pet-task-reward { font-size:0.75rem;color:#f59e0b;font-weight:700;margin-top:2px; }
        .pet-task-status { flex-shrink:0;font-size:0.72rem;font-weight:800;padding:6px 12px;border-radius:999px; }
        .pet-task-status.pending { background:rgba(255,255,255,0.08);color:#a1a1aa; }
        .pet-task-status.progress { background:rgba(245,158,11,0.15);color:#f59e0b; }
        .pet-task-status.done { background:rgba(16,185,129,0.15);color:#10b981; }
      `;
      document.head.appendChild(style);
    }

    document.getElementById("btnBackSqwidPet").addEventListener("click", () => {
      if (window.Sqwid && window.Sqwid.showScreen) window.Sqwid.showScreen("screen-messages");
      closePetPage();
    });

    document.getElementById("btnPetPat").addEventListener("click", patPet);

    return screen;
  }

  const TASK_POOL = [
    { id: "t1",  icon: TASK_ICONS.chat,     name: "Отправьте друг другу по 10 сообщений",    reward: 20, need: 10 },
    { id: "t2",  icon: TASK_ICONS.camera,   name: "Отправь другу фото",                      reward: 30, need: 1 },
    { id: "t3",  icon: TASK_ICONS.thumbsUp, name: "Поставь 5 реакций на сообщения друга",    reward: 15, need: 5 },
    { id: "t4",  icon: TASK_ICONS.mic,      name: "Отправь голосовое другу",                 reward: 40, need: 1 },
    { id: "t5",  icon: TASK_ICONS.flame,    name: "Напиши другу 30 сообщений за день",       reward: 50, need: 30 },
    { id: "t6",  icon: TASK_ICONS.clock,    name: "Общайтесь 5 минут подряд",                reward: 35, need: 5 },
    { id: "t7",  icon: TASK_ICONS.heart,    name: "Поставь 10 реакций другу",                reward: 25, need: 10 },
    { id: "t8",  icon: TASK_ICONS.sunrise,  name: "Напиши другу утром (до 12:00)",           reward: 20, need: 1 },
    { id: "t9",  icon: TASK_ICONS.moon,     name: "Напиши другу вечером (после 22:00)",      reward: 20, need: 1 },
    { id: "t10", icon: TASK_ICONS.target,   name: "Отправь 3 фото другу",                    reward: 45, need: 3 },
    { id: "t11", icon: TASK_ICONS.smile,    name: "Отправь 5 смешных сообщений",             reward: 25, need: 5 },
    { id: "t12", icon: TASK_ICONS.shield,   name: "Похвали друга в чате",                    reward: 15, need: 1 },
    { id: "t13", icon: TASK_ICONS.gift,     name: "Обменяйтесь стикерами 3 раза",            reward: 30, need: 3 },
    { id: "t14", icon: TASK_ICONS.rocket,   name: "Первым напиши другу сегодня",             reward: 25, need: 1 },
    { id: "t15", icon: TASK_ICONS.phone,    name: "Созвонитесь (если звонки есть)",          reward: 50, need: 1 },
    { id: "t16", icon: TASK_ICONS.flame,    name: "Сделайте перерыв в 1 час и вернитесь",    reward: 20, need: 1 },
    { id: "t17", icon: TASK_ICONS.star,     name: "Напиши другу 50 сообщений",               reward: 70, need: 50 },
    { id: "t18", icon: TASK_ICONS.music,    name: "Отправь музыкальный трек другу",          reward: 35, need: 1 },
    { id: "t19", icon: TASK_ICONS.globe,    name: "Расскажи другу о своём дне",              reward: 30, need: 1 },
    { id: "t20", icon: TASK_ICONS.cake,     name: "Узнай, как дела у друга",                 reward: 25, need: 1 },
    { id: "t21", icon: TASK_ICONS.heart,    name: "Поставь сердечко на 3 сообщения друга",   reward: 20, need: 3 },
    { id: "t22", icon: TASK_ICONS.palette,  name: "Отправь 2 фото подряд",                   reward: 30, need: 2 },
    { id: "t23", icon: TASK_ICONS.doc,      name: "Напиши длинное сообщение (100+ символов)",reward: 40, need: 1 },
    { id: "t24", icon: TASK_ICONS.star,     name: "Поставь 20 реакций другу",                reward: 60, need: 20 },
    { id: "t25", icon: TASK_ICONS.trophy,   name: "Общайтесь 30 минут подряд",               reward: 80, need: 30 },
    { id: "t26", icon: TASK_ICONS.party,    name: "Поздравь друга с чем-нибудь",             reward: 25, need: 1 },
    { id: "t27", icon: TASK_ICONS.chat,     name: "Отправь 15 сообщений другу",              reward: 40, need: 15 },
    { id: "t28", icon: TASK_ICONS.flame,    name: "Огонёк должен гореть 3 дня подряд",       reward: 100,need: 3 },
    { id: "t29", icon: TASK_ICONS.camera,   name: "Отправь селфи другу",                     reward: 50, need: 1 },
    { id: "t30", icon: TASK_ICONS.crown,    name: "Сделай что-то приятное другу",            reward: 30, need: 1 }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function pickDailyTasks(chatId, date) {
    const seed = (chatId + date).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const picked = [];
    const pool = [...TASK_POOL];
    for (let i = 0; i < 3; i++) {
      const idx = (seed * (i + 7)) % pool.length;
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function renderPetPage() {
    if (!petData) return;

    const level = petData.level || 1;
    const points = petData.points || 0;
    const needed = petData.pointsNeeded || 50;
    const percent = Math.min(100, (points / needed) * 100);

    const avaEl = document.getElementById("petAvatar");
    if (avaEl) avaEl.innerHTML = getFlameSVG(level);

    const nameEl = document.getElementById("petPetName");
    if (nameEl) nameEl.textContent = getLevelName(level);

    const stageEl = document.getElementById("petStageLabel");
    if (stageEl) stageEl.textContent = getLevelName(level);

    const lvlEl = document.getElementById("petLevel");
    if (lvlEl) lvlEl.textContent = level;

    const fillEl = document.getElementById("petProgressFill");
    if (fillEl) fillEl.style.width = percent + "%";

    const pointsEl = document.getElementById("petPoints");
    if (pointsEl) pointsEl.textContent = `${points} / ${needed}`;

    const leftEl = document.getElementById("petPointsLeft");
    if (leftEl) leftEl.textContent = `${Math.max(0, needed - points)} до след. уровня`;

    renderTasks();
  }

  function renderTasks() {
    const list = document.getElementById("petTasksList");
    if (!list) return;

    const today = todayKey();
    const tasks = pickDailyTasks(currentPetChatId, today);

    list.innerHTML = "";

    tasks.forEach((task) => {
      const taskState = dailyTasks[task.id] || { progress: 0, done: false };
      const done = taskState.done === true;
      const progress = taskState.progress || 0;

      const row = document.createElement("div");
      row.className = "pet-task-row" + (done ? " done" : "");

      const iconHTML = `
        <div class="pet-task-icon">
          ${task.icon || ""}
        </div>
      `;

      let statusHTML = "";
      if (done) {
        statusHTML = `<div class="pet-task-status done">+${task.reward}</div>`;
      } else if (progress > 0 && task.need > 1) {
        statusHTML = `<div class="pet-task-status progress">${progress}/${task.need}</div>`;
      } else {
        statusHTML = `<div class="pet-task-status pending">+${task.reward} SQ</div>`;
      }

      row.innerHTML = `
        ${iconHTML}
        <div class="pet-task-info">
          <div class="pet-task-name">${task.name}</div>
          <div class="pet-task-reward">+${task.reward} очков</div>
        </div>
        ${statusHTML}
      `;

      list.appendChild(row);
    });
  }

  async function patPet() {
    if (!currentPetChatId) return;

    const today = todayKey();
    const snap = await get(ref(db, "chats/" + currentPetChatId + "/pet"));
    const pet = snap.val() || {};
    const pats = pet.pats || {};

    if (pats[currentUser.uid] === today) {
      S.showToast("Ты уже гладил(а) сегодня", "info");
      return;
    }

    const newPoints = (pet.points || 0) + 5;
    const needed = pet.pointsNeeded || 50;

    const updates = {
      [`pats/${currentUser.uid}`]: today,
      points: newPoints
    };

    if (newPoints >= needed) {
      const newLevel = (pet.level || 1) + 1;
      updates.level = newLevel;
      updates.points = 0;
      updates.pointsNeeded = Math.round(needed * 1.5);
      S.showToast(`Уровень ${newLevel}! ${getLevelName(newLevel)}`, "ok", 3000);
    } else {
      S.showToast("+5 очков", "ok");
    }

    await update(ref(db, "chats/" + currentPetChatId + "/pet"), updates);
  }

  window.Sqwid.openPetPage = function (chatId) {
    if (!chatId) return;
    currentPetChatId = chatId;

    ensurePetPage();

    if (unsubPetPage) { unsubPetPage(); unsubPetPage = null; }
    unsubPetPage = onValue(ref(db, "chats/" + chatId + "/pet"), (snap) => {
      petData = snap.val();
      if (petData) renderPetPage();
    });

    const today = todayKey();
    if (unsubTasks) { unsubTasks(); unsubTasks = null; }
    unsubTasks = onValue(ref(db, "chats/" + chatId + "/pet/tasks/" + today), (snap) => {
      dailyTasks = snap.val() || {};
      renderTasks();
    });

    S.showScreen("screen-sqwidpet");
  };

  function closePetPage() {
    if (unsubPetPage) { unsubPetPage(); unsubPetPage = null; }
    if (unsubTasks) { unsubTasks(); unsubTasks = null; }
    currentPetChatId = null;
    petData = null;
  }

  function openPetPage() {
    if (!petData || !currentPetChatId) return;
    if (window.Sqwid && window.Sqwid.openPetPage) {
      window.Sqwid.openPetPage(currentPetChatId);
    }
  }

  console.log("✅ sqwidfire.js полностью готов");
});