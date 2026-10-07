/* ============================================================
   chat-main.js — список чатов + чат + создание + модерация
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBH4xNY0vcuM_NsGCGnRYEM_beGoQtZ_N0",
  authDomain: "sqwid-messenger.firebaseapp.com",
  databaseURL: "https://sqwid-messenger-default-rtdb.firebaseio.com",
  projectId: "sqwid-messenger",
  storageBucket: "sqwid-messenger.firebasestorage.app",
  messagingSenderId: "943129718217",
  appId: "1:943129718217:web:9e156626c721480a9c0c18"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentUserData = {};
let currentChatId = null;
let currentChatData = null;
let userMap = {};
let unsubMessages = null;
let unsubChats = null;
let unsubUserSelf = null;
let unsubUsers = null;
let longPressMsg = null;
let editingMsgId = null;

let createKind = "group";
let createSelected = {};
let cgAvatarBase64 = null;
let chAvatarBase64 = null;
let cgAutoDelete = 0;

let memberAddMode = false;
let memberAddChatId = null;

/* ============================================================
   ХЕЛПЕРЫ
   ============================================================ */
function escH(t) {
  const d = document.createElement("div");
  d.textContent = t == null ? "" : t;
  return d.innerHTML;
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtShortTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function isImg(s) { return typeof s === "string" && s.startsWith("data:image"); }
function svgLetter(text) {
  const ch = (text || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#3b82f6"/><text x="50%" y="55%" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${ch}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function verifiedIcon(flag) {
  return flag ? `<img src="verify.PNG" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;">` : "";
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === id);
  });
  const nav = document.getElementById("bottomNav");
  const hideNav = [
    "screen-messages", "screen-create-group", "screen-create-channel",
    "screen-choose-members", "screen-chat-info", "screen-edit-chat",
    "screen-chat-members", "screen-owner", "screen-report-view",
    "screen-search-messages", "screen-gallery", "screen-viewer",
    "screen-banned"
  ].includes(id);
  if (nav) nav.style.display = hideNav ? "none" : "flex";
}

/* ============================================================
   МОДАЛКИ
   ============================================================ */
function showAlert(text, title = "Сообщение") {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-alert");
    if (!modal) { window.alert(text); resolve(true); return; }
    document.getElementById("alertTitle").textContent = title;
    document.getElementById("alertText").textContent = text;
    document.getElementById("alertCancel").style.display = "none";
    const okBtn = document.getElementById("alertOk");
    okBtn.textContent = "ОК";
    modal.classList.add("active");
    const cleanup = () => { modal.classList.remove("active"); okBtn.removeEventListener("click", onOk); };
    const onOk = () => { cleanup(); resolve(true); };
    okBtn.addEventListener("click", onOk);
  });
}
function showConfirm(text, title = "Подтверждение") {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-alert");
    if (!modal) { const r = window.confirm(text); resolve(r); return; }
    document.getElementById("alertTitle").textContent = title;
    document.getElementById("alertText").textContent = text;
    const cancelBtn = document.getElementById("alertCancel");
    cancelBtn.style.display = "block";
    const okBtn = document.getElementById("alertOk");
    okBtn.textContent = "Да";
    modal.classList.add("active");
    const cleanup = () => {
      modal.classList.remove("active");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}
function showPrompt(text, placeholder = "", value = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-prompt");
    if (!modal) { const r = window.prompt(text, value); resolve(r); return; }
    document.getElementById("promptTitle").textContent = text;
    const input = document.getElementById("promptInput");
    input.value = value;
    input.placeholder = placeholder;
    modal.classList.add("active");
    setTimeout(() => input.focus(), 50);
    const okBtn = document.getElementById("promptOk");
    const cancelBtn = document.getElementById("promptCancel");
    const cleanup = () => {
      modal.classList.remove("active");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
    };
    const onOk = () => { const v = input.value.trim(); cleanup(); resolve(v); };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e) => { if (e.key === "Enter") onOk(); if (e.key === "Escape") onCancel(); };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}
let toastTimer = null;
function showToast(text, type = "info", duration = 2500) {
  let el = document.getElementById("toastEl");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastEl";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.className = "toast toast-" + type;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

/* ============================================================
   СТАРТ
   ============================================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (unsubChats) { unsubChats(); unsubChats = null; }
    if (unsubMessages) { unsubMessages(); unsubMessages = null; }
    if (unsubUserSelf) { unsubUserSelf(); unsubUserSelf = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    window.location.href = "index.html";
    return;
  }
  currentUser = user;

  window.Sqwid = {
    currentUser,
    currentUserData: {},
    userMap,
    db,
    ref, get, set, update, remove, push, onValue,
    auth, signOut,
    getChatId: () => currentChatId,
    getChatData: () => currentChatData,
    openChat: (id) => openChat(id),
    showScreen: (id) => showScreen(id),
    svgAvatar: (t) => svgLetter(t),
    showAlert, showConfirm, showPrompt, showToast,
    openAddMembersToChat: (id) => openAddMembersToChat(id)
  };

  if (unsubUserSelf) unsubUserSelf();
  unsubUserSelf = onValue(ref(db, "users/" + user.uid), (snap) => {
    currentUserData = snap.val() || {};
    window._currentUserData = currentUserData;
    if (window.Sqwid) window.Sqwid.currentUserData = currentUserData;
    const ava = document.getElementById("myAvatar");
    if (ava) {
      if (isImg(currentUserData.photo)) ava.src = currentUserData.photo;
      else ava.src = svgLetter(currentUserData.name || user.email);
    }
  });

  if (unsubUsers) unsubUsers();
  unsubUsers = onValue(ref(db, "users"), (snap) => {
    userMap = snap.val() || {};
    if (window.Sqwid) window.Sqwid.userMap = userMap;
    loadChats();
    const cm = document.getElementById("screen-choose-members");
    if (cm && cm.classList.contains("active")) renderMembersResults();
  });
});

/* ============================================================
   СПИСОК ЧАТОВ
   ============================================================ */
function loadChats() {
  if (unsubChats) unsubChats();
  unsubChats = onValue(ref(db, "chats"), (snap) => {
    const chats = snap.val() || {};
    const list = document.getElementById("chatList");
    if (!list) return;
    const search = (document.getElementById("searchInput").value || "").toLowerCase();
    list.innerHTML = "";

    const myChats = [];
    for (const id in chats) {
      const c = chats[id];
      if (!c.members || !c.members[currentUser.uid]) continue;
      if (search && !(c.name || "").toLowerCase().includes(search)) continue;
      myChats.push({ id, ...c });
    }

    myChats.sort((a, b) => (b.lastMsgAt || b.createdAt || 0) - (a.lastMsgAt || a.createdAt || 0));

    myChats.forEach(c => {
      const li = document.createElement("li");
      li.dataset.chatId = c.id;

      let displayName = c.name || "Чат";
      let avatarUrl = "";
      let verified = false;
      let isFrozen = false;
      if (c.type === "private") {
        const otherUid = Object.keys(c.members || {}).find(u => u !== currentUser.uid);
        if (otherUid) {
          const ou = userMap[otherUid] || {};
          displayName = ou.name || ou.email || displayName;
          avatarUrl = isImg(ou.photo) ? ou.photo : svgLetter(displayName);
          verified = ou.verified;
          isFrozen = ou.frozen === true;
        }
      } else {
        avatarUrl = isImg(c.photo) ? c.photo : svgLetter(displayName);
        verified = c.verified;
      }

      const avatarHTML = isFrozen
        ? `<span style="font-size:26px;">❄</span>`
        : (avatarUrl ? `<img src="${avatarUrl}" alt="">` : escH(displayName.charAt(0).toUpperCase()));

      const time = c.lastMsgAt ? fmtShortTime(c.lastMsgAt) : "";
      const last = c.lastMsg || "";
      const isChannel = c.type === "channel";
      const badge = isChannel ? `<span style="font-size:11px;color:#00a884;margin-left:6px;">📢</span>` : "";
      const frozenClass = isFrozen ? " frozen-name" : "";
      const frozenAvaClass = isFrozen ? " frozen-ava" : "";

      li.innerHTML = `
        <div class="chat-ava${frozenAvaClass}">${avatarHTML}</div>
        <div class="chat-info">
          <div class="chat-name-row">
            <div class="chat-name${frozenClass}">${escH(displayName)}${verifiedIcon(verified)}${badge}</div>
            <div class="chat-time">${time}</div>
          </div>
          <div class="chat-last">${escH(last)}</div>
        </div>
      `;
      li.addEventListener("click", () => openChat(c.id));
      list.appendChild(li);
    });
  });
}
const searchInputEl = document.getElementById("searchInput");
if (searchInputEl) searchInputEl.addEventListener("input", loadChats);

/* ============================================================
   ОТКРЫТИЕ ЧАТА
   ============================================================ */
async function openChat(chatId) {
  const snap = await get(ref(db, "chats/" + chatId));
  const chat = snap.val();
  if (!chat) return;

  currentChatId = chatId;
  currentChatData = chat;

  let displayName = chat.name || "Чат";
  let avatarUrl = "";
  let verified = false;
  let isFrozen = false;
  if (chat.type === "private") {
    const otherUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
    if (otherUid) {
      const ou = userMap[otherUid] || {};
      displayName = ou.name || ou.email || displayName;
      avatarUrl = isImg(ou.photo) ? ou.photo : svgLetter(displayName);
      verified = ou.verified;
      isFrozen = ou.frozen === true;
    }
  } else {
    avatarUrl = isImg(chat.photo) ? chat.photo : svgLetter(displayName);
    verified = chat.verified;
  }

  const nameEl = document.getElementById("chatName");
  if (nameEl) {
    nameEl.innerHTML = escH(displayName) + verifiedIcon(verified);
    if (isFrozen) nameEl.classList.add("frozen-name");
    else nameEl.classList.remove("frozen-name");
  }
  const ava = document.getElementById("chatAva");
  if (ava) {
    if (isFrozen) ava.innerHTML = `<span style="font-size:22px;">❄</span>`;
    else ava.innerHTML = avatarUrl ? `<img src="${avatarUrl}">` : escH(displayName.charAt(0).toUpperCase());
    ava.classList.toggle("frozen-ava", isFrozen);
  }

const inputArea = document.getElementById("inputArea");
const banner = document.getElementById("chatDeletedBanner");
const bannerText = document.getElementById("chatDeletedText");
const isChannel = chat.type === "channel";
const isAdmin = chat.owner === currentUser.uid || (chat.admins && chat.admins[currentUser.uid]);

let canWrite = true;
let cannotReason = "";

if (isChannel && !isAdmin) {
  canWrite = false;
  cannotReason = "📢 Писать могут только администраторы канала";
}

if (chat.type === "private") {
  const otherUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
  const other = otherUid ? (userMap[otherUid] || {}) : {};
  if (other.banned === true) {
    canWrite = false;
    cannotReason = "🚫 Пользователь заблокирован — писать нельзя";
  } else if (other.frozen === true) {
    canWrite = false;
    cannotReason = "❄ Пользователь заморожен — писать нельзя";
  }
}

if (window._currentUserData && window._currentUserData.banned === true) {
  canWrite = false;
  cannotReason = "🚫 Ваш аккаунт заблокирован";
}

if (inputArea && banner) {
  if (canWrite) {
    inputArea.style.display = "flex";
    banner.style.display = "none";
  } else {
    inputArea.style.display = "none";
    banner.style.display = "flex";
    if (bannerText) bannerText.textContent = cannotReason;
  }
}

  const msgsBox = document.getElementById("messages");
  if (msgsBox) msgsBox.innerHTML = "";
  showScreen("screen-messages");

  if (unsubMessages) unsubMessages();
  const msgsRef = query(ref(db, "messages/" + chatId), orderByChild("timestamp"), limitToLast(200));
  unsubMessages = onValue(msgsRef, (snapshot) => {
    const box = document.getElementById("messages");
    if (!box) return;
    box.innerHTML = "";
    const all = snapshot.val() || {};
    const arr = Object.values(all).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    window._chatPhotos = arr
      .filter(m => m.type === "photo" && m.photo)
      .map(m => ({
        id: m.id,
        photo: m.photo,
        text: m.text || "",
        sender: m.sender,
        timestamp: m.timestamp
      }));

    arr.forEach(m => renderMessage(m, chatId));
    box.scrollTop = box.scrollHeight;
  });
}

/* ============================================================
   РЕНДЕР СООБЩЕНИЯ
   ============================================================ */
function renderMessage(msg, chatId) {
  const box = document.getElementById("messages");
  if (!box) return;
  const isOwn = msg.sender === currentUser.uid;
  const div = document.createElement("div");
  div.className = "msg " + (isOwn ? "own" : "other");
  div.dataset.msgId = msg.id || "";

  const isGroup = currentChatData && currentChatData.type !== "private";
  let senderHTML = "";
  if (!isOwn && isGroup && msg.sender) {
    const su = userMap[msg.sender] || {};
    const isFrozen = su.frozen === true;
    const frozenClass = isFrozen ? " frozen-name" : "";
    senderHTML = `<div class="msg-sender${frozenClass}" style="font-size:11.5px;font-weight:700;color:#6366f1;margin-bottom:3px;">${escH(su.name || su.email || "Пользователь")}${verifiedIcon(su.verified)}</div>`;
  }

  let contentHTML = "";
  if (msg.type === "photo" && msg.photo) {
    contentHTML += `<img class="msg-photo" src="${msg.photo}" alt="">`;
    if (msg.text) contentHTML += `<div>${escH(msg.text)}</div>`;
  } else if (msg.type === "gift" && msg.gift) {
    const g = msg.gift || {};
    const giftIcon = g.icon || "sqwidstar.png";
    const giftName = g.name || "Подарок";
    const giftPrice = g.price || 0;
    const fromLabel = g.hideName && !isOwn ? "Аноним" : (g.fromName || "Пользователь");
    contentHTML = `
      <div class="msg-gift">
        <div class="msg-gift-preview"><img src="${giftIcon}" alt=""></div>
        <div class="msg-gift-name">${escH(giftName)}</div>
        <div class="msg-gift-caption">
          ${escH(fromLabel)} ${isOwn ? "отправил(а)" : "отправил(а) вам"}<br>
          стоимостью <b>${giftPrice} SQ</b>
        </div>
        ${g.message ? `<div class="msg-gift-desc">💬 ${escH(g.message)}</div>` : ""}
      </div>
    `;
  } else {
    contentHTML += `<div>${escH(msg.text || "")}</div>`;
  }

  let reactHTML = "";
  const reactions = msg.reactions || {};
  const keys = Object.keys(reactions).filter(e => Object.keys(reactions[e] || {}).length > 0);
  if (keys.length > 0) {
    reactHTML = `<div class="msg-reactions">${keys.map(e => {
      const cnt = Object.keys(reactions[e]).length;
      const mine = reactions[e][currentUser.uid];
      return `<span class="reaction-chip" data-emoji="${e}" ${mine ? 'style="background:rgba(99,102,241,0.3);"' : ""}>${e} ${cnt}</span>`;
    }).join("")}</div>`;
  }

  div.innerHTML = `
    ${senderHTML}
    ${contentHTML}
    ${reactHTML}
    <div class="msg-time">${fmtTime(msg.timestamp || Date.now())}</div>
  `;

  if (!isOwn && msg.type !== "gift") {
    const reportBtn = document.createElement("button");
    reportBtn.className = "msg-report-btn";
    reportBtn.textContent = "!";
    reportBtn.title = "Пожаловаться";
    reportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.Sqwid.openReportModal) {
        const su = userMap[msg.sender] || {};
        window.Sqwid.openReportModal({
          targetType: "message",
          targetUid: msg.sender,
          chatId: chatId,
          messageIds: [msg.id],
          targetLabel: `Сообщение от ${su.name || "пользователя"}`
        });
      }
    });
    div.appendChild(reportBtn);
  }

  const img = div.querySelector(".msg-photo");
  if (img) img.addEventListener("click", () => {
    if (!window.Sqwid || !window.Sqwid.openPhotoViewer) return;
    const list = window._chatPhotos || [];
    const idx = list.findIndex(p => p.id === msg.id);
    window.Sqwid.openPhotoViewer({
      photosArr: list,
      index: idx >= 0 ? idx : 0
    });
  });

  div.querySelectorAll(".reaction-chip").forEach(chip => {
    chip.addEventListener("click", async (e) => {
      e.stopPropagation();
      const emoji = chip.dataset.emoji;
      const myRef = ref(db, `messages/${chatId}/${msg.id}/reactions/${emoji}/${currentUser.uid}`);
      const snap = await get(myRef);
      if (snap.exists()) await remove(myRef);
      else await set(myRef, true);
    });
  });

  attachLongPress(div, msg, chatId);
  box.appendChild(div);
}

/* ============================================================
   ДОЛГОЕ НАЖАТИЕ
   ============================================================ */
function attachLongPress(el, msg, chatId) {
  let timer = null, triggered = false;
  const start = () => {
    triggered = false;
    timer = setTimeout(() => {
      triggered = true;
      if (navigator.vibrate) navigator.vibrate(20);
      openMsgMenu(msg, chatId);
    }, 500);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("click", (e) => {
    if (triggered) { e.preventDefault(); e.stopPropagation(); triggered = false; }
  }, true);
}

function openMsgMenu(msg, chatId) {
  longPressMsg = { msg, chatId };
  const modal = document.getElementById("modal-msgMenu");
  if (modal) modal.classList.add("active");
}
const closeMsgMenuBtn = document.getElementById("btnCloseMsgMenu");
if (closeMsgMenuBtn) closeMsgMenuBtn.addEventListener("click", () => {
  document.getElementById("modal-msgMenu").classList.remove("active");
  longPressMsg = null;
  editingMsgId = null;
});
const deleteMsgBtn = document.getElementById("btnDeleteMsg");
if (deleteMsgBtn) deleteMsgBtn.addEventListener("click", async () => {
  if (!longPressMsg) return;
  const { msg, chatId } = longPressMsg;
  if (msg.sender !== currentUser.uid) { showToast("Можно удалять только свои", "error"); return; }
  const ok = await showConfirm("Удалить сообщение?", "Удаление");
  if (!ok) return;
  await remove(ref(db, `messages/${chatId}/${msg.id}`));
  document.getElementById("modal-msgMenu").classList.remove("active");
  longPressMsg = null;
});
const editMsgBtn = document.getElementById("btnEditMsg");
if (editMsgBtn) editMsgBtn.addEventListener("click", () => {
  if (!longPressMsg) return;
  const { msg } = longPressMsg;
  if (msg.sender !== currentUser.uid) { showToast("Можно изменять только свои", "error"); return; }
  if (msg.type === "photo") { showToast("Фото не редактируется", "error"); return; }
  if (msg.type === "gift") { showToast("Подарок не редактируется", "error"); return; }
  document.getElementById("msgInput").value = msg.text || "";
  editingMsgId = msg.id;
  document.getElementById("modal-msgMenu").classList.remove("active");
  document.getElementById("msgInput").focus();
});
const reactMsgBtn = document.getElementById("btnReactMsg");
if (reactMsgBtn) reactMsgBtn.addEventListener("click", () => {
  document.getElementById("modal-msgMenu").classList.remove("active");
  openReactPicker();
});
const reportMsgBtn = document.getElementById("btnReportMsg");
if (reportMsgBtn) reportMsgBtn.addEventListener("click", () => {
  if (!longPressMsg) return;
  const { msg, chatId } = longPressMsg;
  if (msg.sender === currentUser.uid) return;
  document.getElementById("modal-msgMenu").classList.remove("active");
  if (window.Sqwid.openReportModal) {
    const su = userMap[msg.sender] || {};
    window.Sqwid.openReportModal({
      targetType: "message",
      targetUid: msg.sender,
      chatId,
      messageIds: [msg.id],
      targetLabel: `Сообщение от ${su.name || "пользователя"}`
    });
  }
  longPressMsg = null;
});

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👎"];
function openReactPicker() {
  const grid = document.getElementById("reactGrid");
  if (!grid) return;
  grid.innerHTML = "";
  REACTIONS.forEach(e => {
    const b = document.createElement("button");
    b.textContent = e;
    b.onclick = async () => {
      if (!longPressMsg) return;
      const { msg, chatId } = longPressMsg;
      const myRef = ref(db, `messages/${chatId}/${msg.id}/reactions/${e}/${currentUser.uid}`);
      const snap = await get(myRef);
      if (snap.exists()) await remove(myRef);
      else await set(myRef, true);
      document.getElementById("modal-react").classList.remove("active");
      longPressMsg = null;
    };
    grid.appendChild(b);
  });
  document.getElementById("modal-react").classList.add("active");
}
const closeReactBtn = document.getElementById("btnCloseReact");
if (closeReactBtn) closeReactBtn.addEventListener("click", () => {
  document.getElementById("modal-react").classList.remove("active");
});

/* ============================================================
   ОТПРАВКА СООБЩЕНИЙ
   ============================================================ */
async function sendMessage() {
  const input = document.getElementById("msgInput");
  const text = input.value.trim();
  if (!currentChatId || !text) return;

  if (window._currentUserData && window._currentUserData.muted === true) {
    showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
    return;
  }
  if (window._currentUserData && window._currentUserData.banned === true) {
    showToast("🚫 Аккаунт заблокирован", "error", 2000);
    return;
  }

  if (editingMsgId) {
    await update(ref(db, `messages/${currentChatId}/${editingMsgId}`), {
      text, editedAt: Date.now()
    });
    editingMsgId = null;
    input.value = "";
    return;
  }

  const newRef = push(ref(db, "messages/" + currentChatId));
  await set(newRef, {
    sender: currentUser.uid,
    type: "text",
    text,
    timestamp: Date.now()
  });

  await update(ref(db, "chats/" + currentChatId), {
    lastMsg: text,
    lastMsgAt: Date.now(),
    lastMsgSender: currentUser.uid
  });

  if (currentChatData && currentChatData.autoDelete > 0) {
    setTimeout(() => {
      remove(ref(db, `messages/${currentChatId}/${newRef.key}`)).catch(() => {});
    }, currentChatData.autoDelete * 1000);
  }

  input.value = "";
}
const btnSend = document.getElementById("btnSend");
if (btnSend) btnSend.addEventListener("click", sendMessage);
const msgInput = document.getElementById("msgInput");
if (msgInput) msgInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

const btnAttach = document.getElementById("btnAttach");
if (btnAttach) btnAttach.addEventListener("click", () => document.getElementById("fileInput").click());
const fileInput = document.getElementById("fileInput");
if (fileInput) fileInput.addEventListener("change", (e) => {
  if (window._currentUserData && window._currentUserData.muted === true) {
    showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
    e.target.value = "";
    return;
  }
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";
  if (!file.type.startsWith("image/")) { showToast("Только изображения", "error"); return; }
  if (file.size > 500 * 1024) { showToast("Фото до 500 КБ", "error"); return; }
  const r = new FileReader();
  r.onload = (ev) => {
    document.getElementById("photoPreviewImg").src = ev.target.result;
    document.getElementById("photoCaption").value = "";
    document.getElementById("photoPreview").classList.add("active");
  };
  r.readAsDataURL(file);
});
const btnCancelPhoto = document.getElementById("btnCancelPhoto");
if (btnCancelPhoto) btnCancelPhoto.addEventListener("click", () => {
  document.getElementById("photoPreview").classList.remove("active");
  document.getElementById("photoPreviewImg").src = "";
});
const btnSendPhoto = document.getElementById("btnSendPhoto");
if (btnSendPhoto) btnSendPhoto.addEventListener("click", async () => {
  if (window._currentUserData && window._currentUserData.muted === true) {
    showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
    return;
  }
  if (window._currentUserData && window._currentUserData.banned === true) {
    showToast("🚫 Аккаунт заблокирован", "error", 2000);
    return;
  }
  const dataUrl = document.getElementById("photoPreviewImg").src;
  const caption = document.getElementById("photoCaption").value.trim();
  if (!currentChatId || !dataUrl) return;
  const newRef = push(ref(db, "messages/" + currentChatId));
  await set(newRef, {
    sender: currentUser.uid, type: "photo", photo: dataUrl, text: caption, timestamp: Date.now()
  });
  await update(ref(db, "chats/" + currentChatId), {
    lastMsg: caption || "📷 Фото", lastMsgAt: Date.now(), lastMsgSender: currentUser.uid
  });
  document.getElementById("photoPreview").classList.remove("active");
  document.getElementById("photoPreviewImg").src = "";
});

/* ============================================================
   НАВИГАЦИЯ
   ============================================================ */
const btnBack = document.getElementById("btnBack");
if (btnBack) btnBack.addEventListener("click", () => {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  currentChatId = null;
  showScreen("screen-chats");
});
const btnBurger = document.getElementById("btnBurger");
if (btnBurger) btnBurger.addEventListener("click", () => showScreen("screen-profile"));

document.querySelectorAll(".nav-btn").forEach(b => {
  b.addEventListener("click", () => {
    if (b.dataset.screen === "screen-chats") {
      if (unsubMessages) { unsubMessages(); unsubMessages = null; }
      currentChatId = null;
    }
    showScreen(b.dataset.screen);
  });
});

/* ============================================================
   КЛИК ПО ШАПКЕ ЧАТА
   ============================================================ */
function attachChatHeaderHandlers() {
  const nameEl = document.getElementById("chatName");
  const avaEl = document.getElementById("chatBarAva");
  const handler = () => {
    if (!currentChatData || !currentChatId) return;
    if (currentChatData.type === "private") {
      if (window.Sqwid && window.Sqwid.openOtherProfile) {
        const otherUid = Object.keys(currentChatData.members || {}).find(u => u !== currentUser.uid);
        if (otherUid) window.Sqwid.openOtherProfile(otherUid);
      }
    } else {
      if (window.Sqwid && window.Sqwid.openChatInfo) {
        window.Sqwid.openChatInfo(currentChatId);
      }
    }
  };
  if (nameEl && !nameEl.dataset.ciAttached) {
    nameEl.dataset.ciAttached = "1";
    nameEl.addEventListener("click", handler);
  }
  if (avaEl && !avaEl.dataset.ciAttached) {
    avaEl.dataset.ciAttached = "1";
    avaEl.addEventListener("click", handler);
  }
}
setInterval(attachChatHeaderHandlers, 800);

/* ============================================================
   МЕНЮ ЧАТА
   ============================================================ */
const btnChatMenu = document.getElementById("btnChatMenu");
if (btnChatMenu) btnChatMenu.addEventListener("click", () => {
  document.getElementById("modal-chatMenu").classList.add("active");
});
const btnCloseChatMenu = document.getElementById("btnCloseChatMenu");
if (btnCloseChatMenu) btnCloseChatMenu.addEventListener("click", () => {
  document.getElementById("modal-chatMenu").classList.remove("active");
});
const btnDeleteChat = document.getElementById("btnDeleteChat");
if (btnDeleteChat) btnDeleteChat.addEventListener("click", async () => {
  if (!currentChatId) return;
  const ok = await showConfirm("Удалить чат?", "Удаление чата");
  if (!ok) return;
  await remove(ref(db, "chats/" + currentChatId + "/members/" + currentUser.uid));
  document.getElementById("modal-chatMenu").classList.remove("active");
  currentChatId = null;
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  showScreen("screen-chats");
});
const btnDeleteFromBanner = document.getElementById("btnDeleteChatFromBanner");
if (btnDeleteFromBanner) btnDeleteFromBanner.addEventListener("click", async () => {
  if (!currentChatId) return;
  const ok = await showConfirm("Удалить чат?", "Удаление чата");
  if (!ok) return;
  await remove(ref(db, "chats/" + currentChatId + "/members/" + currentUser.uid));
  currentChatId = null;
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  showScreen("screen-chats");
});
const btnBlockUser = document.getElementById("btnBlockUser");
if (btnBlockUser) btnBlockUser.addEventListener("click", async () => {
  if (!currentChatId || !currentChatData) return;
  const otherUid = Object.keys(currentChatData.members || {}).find(u => u !== currentUser.uid);
  if (!otherUid) return;
  const ok = await showConfirm("Заблокировать пользователя?", "Блокировка");
  if (!ok) return;
  const mySnap = await get(ref(db, "users/" + currentUser.uid));
  const me = mySnap.val() || {};
  const blocked = me.blocked || {};
  blocked[otherUid] = true;
  await update(ref(db, "users/" + currentUser.uid), { blocked });
  document.getElementById("modal-chatMenu").classList.remove("active");
  showToast("Пользователь заблокирован", "ok");
});

/* ============================================================
   СОЗДАНИЕ
   ============================================================ */
const btnNewChat = document.getElementById("btnNewChat");
if (btnNewChat) btnNewChat.addEventListener("click", () => {
  document.getElementById("modal-create").classList.add("active");
});
const btnCloseCreate = document.getElementById("btnCloseCreate");
if (btnCloseCreate) btnCloseCreate.addEventListener("click", () => {
  document.getElementById("modal-create").classList.remove("active");
});
const btnCreateGroup = document.getElementById("btnCreateGroup");
if (btnCreateGroup) btnCreateGroup.addEventListener("click", () => {
  document.getElementById("modal-create").classList.remove("active");
  resetCreateGroup();
  showScreen("screen-create-group");
});
const btnCreateChannel = document.getElementById("btnCreateChannel");
if (btnCreateChannel) btnCreateChannel.addEventListener("click", () => {
  document.getElementById("modal-create").classList.remove("active");
  resetCreateChannel();
  showScreen("screen-create-channel");
});
const btnCreatePrivate = document.getElementById("btnCreatePrivate");
if (btnCreatePrivate) btnCreatePrivate.addEventListener("click", () => {
  document.getElementById("modal-create").classList.remove("active");
  openPrivateSearch();
});

function resetCreateGroup() {
  cgAvatarBase64 = null;
  cgAutoDelete = 0;
  const preview = document.getElementById("cgAvatarPreview");
  if (preview) { preview.style.backgroundImage = ""; preview.classList.remove("has-photo"); }
  const name = document.getElementById("cgName");
  if (name) name.value = "";
  const ad = document.getElementById("cgAutoDeleteValue");
  if (ad) ad.textContent = "Выкл.";
}

const btnBackCG = document.getElementById("btnBackCreateGroup");
if (btnBackCG) btnBackCG.addEventListener("click", () => showScreen("screen-chats"));

const cgAvatarInput = document.getElementById("cgAvatarInput");
if (cgAvatarInput) cgAvatarInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 500 * 1024) return showToast("Фото до 500 КБ", "error");
  const r = new FileReader();
  r.onload = (ev) => {
    cgAvatarBase64 = ev.target.result;
    const p = document.getElementById("cgAvatarPreview");
    if (p) { p.style.backgroundImage = `url(${cgAvatarBase64})`; p.classList.add("has-photo"); }
  };
  r.readAsDataURL(f);
});

const cgAutoDeleteRow = document.getElementById("cgAutoDeleteRow");
if (cgAutoDeleteRow) cgAutoDeleteRow.addEventListener("click", () => {
  document.getElementById("modal-autodelete").classList.add("active");
});
const btnCloseAutoDelete = document.getElementById("btnCloseAutoDelete");
if (btnCloseAutoDelete) btnCloseAutoDelete.addEventListener("click", () => {
  document.getElementById("modal-autodelete").classList.remove("active");
});
document.querySelectorAll("#modal-autodelete .menu-row[data-ad]").forEach(row => {
  row.addEventListener("click", () => {
    cgAutoDelete = parseInt(row.dataset.ad) || 0;
    const ad = document.getElementById("cgAutoDeleteValue");
    if (ad) {
      if (cgAutoDelete === 0) ad.textContent = "Выкл.";
      else if (cgAutoDelete === 86400) ad.textContent = "24 ч";
      else if (cgAutoDelete === 604800) ad.textContent = "7 дн";
      else if (cgAutoDelete === 2592000) ad.textContent = "30 дн";
    }
    document.getElementById("modal-autodelete").classList.remove("active");
  });
});
const btnNextCG = document.getElementById("btnNextCreateGroup");
if (btnNextCG) btnNextCG.addEventListener("click", () => {
  const name = (document.getElementById("cgName").value || "").trim();
  if (!name) return showToast("Введите название группы", "error");
  createKind = "group";
  createSelected = {};
  memberAddMode = false;
  memberAddChatId = null;
  openChooseMembers();
});

function resetCreateChannel() {
  chAvatarBase64 = null;
  const preview = document.getElementById("chAvatarPreview");
  if (preview) { preview.style.backgroundImage = ""; preview.classList.remove("has-photo"); }
  const name = document.getElementById("chName");
  if (name) name.value = "";
  const desc = document.getElementById("chDesc");
  if (desc) desc.value = "";
  const un = document.getElementById("chUsername");
  if (un) un.value = "";
  const radio = document.querySelector('input[name="chType"][value="public"]');
  if (radio) radio.checked = true;
  updateChannelTypeVisibility();
}
function updateChannelTypeVisibility() {
  const val = document.querySelector('input[name="chType"]:checked')?.value || "public";
  const block = document.getElementById("chUsernameBlock");
  if (block) block.style.display = val === "public" ? "block" : "none";
}
document.querySelectorAll('input[name="chType"]').forEach(r => {
  r.addEventListener("change", updateChannelTypeVisibility);
});
const btnBackCH = document.getElementById("btnBackCreateChannel");
if (btnBackCH) btnBackCH.addEventListener("click", () => showScreen("screen-chats"));
const chAvatarInput = document.getElementById("chAvatarInput");
if (chAvatarInput) chAvatarInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 500 * 1024) return showToast("Фото до 500 КБ", "error");
  const r = new FileReader();
  r.onload = (ev) => {
    chAvatarBase64 = ev.target.result;
    const p = document.getElementById("chAvatarPreview");
    if (p) { p.style.backgroundImage = `url(${chAvatarBase64})`; p.classList.add("has-photo"); }
  };
  r.readAsDataURL(f);
});
const btnNextCH = document.getElementById("btnNextCreateChannel");
if (btnNextCH) btnNextCH.addEventListener("click", async () => {
  const name = (document.getElementById("chName").value || "").trim();
  if (!name) return showToast("Введите название канала", "error");
  const type = document.querySelector('input[name="chType"]:checked')?.value || "public";
  if (type === "public") {
    const un = (document.getElementById("chUsername").value || "").trim().toLowerCase();
    if (!un) return showToast("Введите юзернейм канала", "error");
    if (!/^[a-z0-9_]{5,20}$/.test(un)) return showToast("Юзернейм: 5-20, латиница/цифры/_", "error");
    const snap = await get(ref(db, "chats"));
    const chats = snap.val() || {};
    for (const id in chats) {
      if (chats[id].username && chats[id].username.toLowerCase() === un) {
        return showToast("Юзернейм @" + un + " занят", "error");
      }
    }
  }
  createKind = "channel";
  createSelected = {};
  memberAddMode = false;
  memberAddChatId = null;
  openChooseMembers();
});

function openPrivateSearch() {
  const search = document.getElementById("privateSearch");
  if (search) search.value = "";
  renderPrivateResults("");
  document.getElementById("modal-private").classList.add("active");
}
const btnClosePrivate = document.getElementById("btnClosePrivate");
if (btnClosePrivate) btnClosePrivate.addEventListener("click", () => {
  document.getElementById("modal-private").classList.remove("active");
});
const privateSearch = document.getElementById("privateSearch");
if (privateSearch) privateSearch.addEventListener("input", (e) => renderPrivateResults(e.target.value));

function renderPrivateResults(q) {
  const box = document.getElementById("privateResults");
  if (!box) return;
  box.innerHTML = "";
  const query = (q || "").toLowerCase().trim();
  const arr = [];
  for (const uid in userMap) {
    if (uid === currentUser.uid) continue;
    const u = userMap[uid];
    const name = (u.name || u.email || "").toLowerCase();
    const uname = (u.username || "").toLowerCase();
    if (query && !name.includes(query) && !uname.includes(query)) continue;
    arr.push({ uid, ...u });
  }
  arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (arr.length === 0) {
    box.innerHTML = '<div class="create-empty">Никого не найдено</div>';
    return;
  }
  arr.slice(0, 30).forEach(u => {
    const row = document.createElement("div");
    row.className = "create-result";
    const ava = isImg(u.photo) ? `<img src="${u.photo}">` : escH((u.name || u.email || "?").charAt(0).toUpperCase());
    row.innerHTML = `
      <div class="create-result-ava">${ava}</div>
      <div class="create-result-info">
        <div class="create-result-name">${escH(u.name || u.email || "Пользователь")}${verifiedIcon(u.verified)}</div>
        <div class="create-result-sub">${u.username ? "@" + escH(u.username) : escH(u.email || "")}</div>
      </div>
    `;
    row.addEventListener("click", async () => {
      document.getElementById("modal-private").classList.remove("active");
      await openOrCreatePrivate(u.uid, u.name || u.email || "Чат");
    });
    box.appendChild(row);
  });
}

async function openOrCreatePrivate(otherUid, displayName) {
  const snap = await get(ref(db, "chats"));
  const chats = snap.val() || {};
  for (const id in chats) {
    const c = chats[id];
    if (c.type !== "private") continue;
    const m = c.members || {};
    if (m[currentUser.uid] && m[otherUid] && Object.keys(m).length === 2) {
      openChat(id);
      return;
    }
  }
  const newRef = push(ref(db, "chats"));
  await set(newRef, {
    name: displayName,
    type: "private",
    members: { [currentUser.uid]: true, [otherUid]: true },
    owner: currentUser.uid,
    createdAt: Date.now(),
    lastMsgAt: Date.now()
  });
  openChat(newRef.key);
}

/* ============================================================
   ВЫБОР УЧАСТНИКОВ
   ============================================================ */
function openChooseMembers() {
  const title = document.getElementById("cmTitle");
  if (title) {
    if (memberAddMode) title.textContent = "Добавить участников";
    else title.textContent = createKind === "channel" ? "Подписчики" : "Участники";
  }
  const search = document.getElementById("cmSearch");
  if (search) search.value = "";
  renderSelectedChips();
  renderMembersResults();
  showScreen("screen-choose-members");
}

function openAddMembersToChat(chatId) {
  if (!chatId) return;
  memberAddMode = true;
  memberAddChatId = chatId;
  createSelected = {};
  openChooseMembers();
}

const btnBackCM = document.getElementById("btnBackChooseMembers");
if (btnBackCM) btnBackCM.addEventListener("click", () => {
  if (memberAddMode) {
    memberAddMode = false;
    memberAddChatId = null;
    createSelected = {};
    if (window.Sqwid.openChatInfo) window.Sqwid.openChatInfo(currentChatId);
    return;
  }
  if (createKind === "channel") showScreen("screen-create-channel");
  else showScreen("screen-create-group");
});
const cmSearch = document.getElementById("cmSearch");
if (cmSearch) cmSearch.addEventListener("input", () => renderMembersResults());

function renderSelectedChips() {
  const box = document.getElementById("cmSelected");
  if (!box) return;
  box.innerHTML = "";
  Object.keys(createSelected).forEach(uid => {
    const u = userMap[uid] || {};
    const chip = document.createElement("div");
    chip.className = "create-chip";
    const ava = isImg(u.photo) ? `<img src="${u.photo}">` : `<span style="width:24px;height:24px;border-radius:50%;background:#3b82f6;display:inline-flex;align-items:center;justify-content:center;font-size:12px;color:#fff;">${escH((u.name || "?").charAt(0).toUpperCase())}</span>`;
    chip.innerHTML = `${ava}<span>${escH(u.name || u.email || "Пользователь")}</span><span class="chip-x">✕</span>`;
    chip.querySelector(".chip-x").addEventListener("click", () => {
      delete createSelected[uid];
      renderSelectedChips();
      renderMembersResults();
    });
    box.appendChild(chip);
  });
}

async function renderMembersResults() {
  const box = document.getElementById("cmResults");
  if (!box) return;
  box.innerHTML = "";
  const q = (document.getElementById("cmSearch")?.value || "").toLowerCase().trim();

  let alreadyInChat = {};
  if (memberAddMode && memberAddChatId) {
    const chatSnap = await get(ref(db, "chats/" + memberAddChatId));
    const chatData = chatSnap.val() || {};
    alreadyInChat = chatData.members || {};
  }

  const arr = [];
  for (const uid in userMap) {
    if (uid === currentUser.uid) continue;
    if (alreadyInChat[uid]) continue;
    const u = userMap[uid];
    const name = (u.name || u.email || "").toLowerCase();
    const uname = (u.username || "").toLowerCase();
    if (q && !name.includes(q) && !uname.includes(q)) continue;
    arr.push({ uid, ...u });
  }
  arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (arr.length === 0) {
    box.innerHTML = '<div class="create-empty">Никого не найдено</div>';
    return;
  }
  arr.slice(0, 60).forEach(u => {
    const picked = !!createSelected[u.uid];
    const row = document.createElement("div");
    row.className = "create-result" + (picked ? " picked" : "");
    const ava = isImg(u.photo) ? `<img src="${u.photo}">` : escH((u.name || u.email || "?").charAt(0).toUpperCase());
    row.innerHTML = `
      <div class="create-result-ava">${ava}</div>
      <div class="create-result-info">
        <div class="create-result-name">${escH(u.name || u.email || "Пользователь")}${verifiedIcon(u.verified)}</div>
        <div class="create-result-sub">${u.username ? "@" + escH(u.username) : escH(u.email || "")}</div>
      </div>
      ${picked ? '<div class="create-result-check">✓</div>' : ""}
    `;
    row.addEventListener("click", () => {
      if (createSelected[u.uid]) delete createSelected[u.uid];
      else createSelected[u.uid] = true;
      renderSelectedChips();
      renderMembersResults();
    });
    box.appendChild(row);
  });
}

const btnSubmitCreate = document.getElementById("btnSubmitCreate");
if (btnSubmitCreate) btnSubmitCreate.addEventListener("click", async () => {
  if (memberAddMode) {
    await submitAddMembers();
    return;
  }
  if (createKind === "group") await createGroup();
  else await createChannel();
});

async function createGroup() {
  const name = (document.getElementById("cgName").value || "").trim();
  if (!name) return showToast("Введите название группы", "error");
  const members = { [currentUser.uid]: true };
  Object.keys(createSelected).forEach(uid => { members[uid] = true; });
  const newRef = push(ref(db, "chats"));
  const payload = {
    type: "group", name, description: "", photo: cgAvatarBase64 || null,
    members, admins: { [currentUser.uid]: true }, owner: currentUser.uid,
    createdAt: Date.now(), lastMsgAt: Date.now()
  };
  if (cgAutoDelete > 0) payload.autoDelete = cgAutoDelete;
  await set(newRef, payload);
  showToast("Группа создана", "ok");
  openChat(newRef.key);
}

async function createChannel() {
  const name = (document.getElementById("chName").value || "").trim();
  if (!name) return showToast("Введите название канала", "error");
  const desc = (document.getElementById("chDesc").value || "").trim();
  const type = document.querySelector('input[name="chType"]:checked')?.value || "public";
  const username = type === "public" ? (document.getElementById("chUsername").value || "").trim().toLowerCase() : null;
  const members = { [currentUser.uid]: true };
  Object.keys(createSelected).forEach(uid => { members[uid] = true; });
  const newRef = push(ref(db, "chats"));
  await set(newRef, {
    type: "channel", name, description: desc, photo: chAvatarBase64 || null,
    members, admins: { [currentUser.uid]: true }, owner: currentUser.uid,
    isPublic: type === "public", username: username || null,
    createdAt: Date.now(), lastMsgAt: Date.now()
  });
  showToast("Канал создан", "ok");
  openChat(newRef.key);
}

/* ============================================================
   ДОБАВЛЕНИЕ УЧАСТНИКОВ
   ============================================================ */
async function submitAddMembers() {
  if (!memberAddChatId) return;
  const uids = Object.keys(createSelected);
  if (uids.length === 0) {
    showToast("Выбери хотя бы одного", "error");
    return;
  }

  try {
    const snap = await get(ref(db, "chats/" + memberAddChatId));
    const chat = snap.val() || {};
    const chatType = chat.type === "channel" ? "канал" : "группу";

    const updates = {};
    uids.forEach(uid => {
      updates["chats/" + memberAddChatId + "/members/" + uid] = true;
    });
    updates["chats/" + memberAddChatId + "/lastMsgAt"] = Date.now();

    await update(ref(db), updates);

    for (const uid of uids) {
      const botRef = push(ref(db, "botChat/" + uid));
      await set(botRef, {
        from: "Sqwid Moderator",
        text: `👥 Вас добавили в ${chatType} «${chat.name || "?"}»`,
        timestamp: Date.now(),
        type: "system",
        kind: "moderator"
      });
    }

    showToast("Добавлено: " + uids.length, "ok");

    memberAddMode = false;
    memberAddChatId = null;
    createSelected = {};
    if (window.Sqwid.openChatInfo) window.Sqwid.openChatInfo(currentChatId);

  } catch (e) {
    showToast("Ошибка: " + e.message, "error");
  }
}

console.log("✅ chat-main.js загружен");