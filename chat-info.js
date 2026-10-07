/* ============================================================
   chat-info.js — информация о чате/группе/канале, участники, роли
   ============================================================ */

console.log("🚀 chat-info.js загружен, жду Sqwid...");

function waitForSqwidChatInfo(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ chat-info.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidChatInfo((S) => {
  const { db, ref, get, set, update, remove, push, onValue, currentUser, showScreen } = S;
  if (!currentUser) return;

  console.log("🔥 chat-info.js активирован");

  let viewingChatId = null;
  let unsubChatInfo = null;
  let unsubMembersUsers = null;
  let currentChat = null;
  let usersCache = {};

  let ecAvatarBase64 = null;
  let ecAvatarChanged = false;
  let ecAutoDelete = 0;

  let memberActionsUid = null;

  /* ============================================================
     ОТКРЫТИЕ ЭКРАНА ИНФОРМАЦИИ
     ============================================================ */
  async function openChatInfo(chatId) {
    if (!chatId) return;
    const snap = await get(ref(db, "chats/" + chatId));
    const chat = snap.val();
    if (!chat) return;

    viewingChatId = chatId;
    if (window.Sqwid) window.Sqwid.viewingChatId = chatId;

    if (unsubChatInfo) unsubChatInfo();
    if (unsubMembersUsers) unsubMembersUsers();

    unsubChatInfo = onValue(ref(db, "chats/" + chatId), (s) => {
      currentChat = s.val() || {};
      renderChatInfo();
    });

    unsubMembersUsers = onValue(ref(db, "users"), (s) => {
      usersCache = s.val() || {};
      renderChatInfo();
    });

    const editBtn = document.getElementById("btnEditChat");
    if (editBtn) editBtn.style.display = chat.type === "private" ? "none" : "block";

    showScreen("screen-chat-info");
  }

  if (window.Sqwid) window.Sqwid.openChatInfo = openChatInfo;

  /* ============================================================
     РЕНДЕР ИНФО
     ============================================================ */
  function renderChatInfo() {
    if (!currentChat || !viewingChatId) return;

    const chat = currentChat;
    const isChannel = chat.type === "channel";
    const isGroup = chat.type === "group";
    const isPrivate = chat.type === "private";

    const membersCount = Object.keys(chat.members || {}).length;
    const isAdmin = chat.owner === currentUser.uid || (chat.admins && chat.admins[currentUser.uid]);
    const isOwner = chat.owner === currentUser.uid;

    const title = document.getElementById("ciHeaderTitle");
    if (title) title.textContent = isChannel ? "О канале" : isGroup ? "О группе" : "О чате";

    const avaEl = document.getElementById("ciAva");
    if (avaEl) {
      let url = "";
      if (isPrivate) {
        const otherUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
        const ou = usersCache[otherUid] || {};
        url = (ou.photo && ou.photo.startsWith("data:image")) ? ou.photo : "";
        const nm = ou.name || ou.email || "?";
        avaEl.innerHTML = url ? `<img src="${url}">` : escH(nm.charAt(0).toUpperCase());
      } else {
        url = (chat.photo && chat.photo.startsWith("data:image")) ? chat.photo : "";
        avaEl.innerHTML = url ? `<img src="${url}">` : escH((chat.name || "?").charAt(0).toUpperCase());
      }
    }

    const nameEl = document.getElementById("ciName");
    if (nameEl) {
      let nm = chat.name || "Чат";
      if (isPrivate) {
        const otherUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
        const ou = usersCache[otherUid] || {};
        nm = ou.name || ou.email || nm;
      }
      let html = escH(nm);
      if (chat.verified) html += ` <img src="verify.png" style="width:16px;height:16px;vertical-align:middle;margin-left:4px;">`;
      nameEl.innerHTML = html;
    }

    const subEl = document.getElementById("ciSub");
    if (subEl) {
      let sub = "";
      if (isChannel) sub = `${membersCount} подписчиков`;
      else if (isGroup) sub = `${membersCount} участников`;
      else sub = "личный чат";
      if (isChannel && chat.username) sub += " · @" + chat.username;
      subEl.textContent = sub;
    }

    const descSection = document.getElementById("ciDescSection");
    const descEl = document.getElementById("ciDesc");
    if (descSection && descEl) {
      if (chat.description) {
        descSection.style.display = "block";
        descEl.textContent = chat.description;
      } else {
        descSection.style.display = "none";
      }
    }

    const unSection = document.getElementById("ciUsernameSection");
    const unEl = document.getElementById("ciUsername");
    if (unSection && unEl) {
      if (isChannel && chat.isPublic && chat.username) {
        unSection.style.display = "block";
        unEl.textContent = "@" + chat.username;
      } else {
        unSection.style.display = "none";
      }
    }

    const adSection = document.getElementById("ciAutoDeleteSection");
    const adEl = document.getElementById("ciAutoDelete");
    if (adSection && adEl) {
      if (isGroup && chat.autoDelete > 0) {
        adSection.style.display = "block";
        adEl.textContent = fmtAutoDelete(chat.autoDelete);
      } else {
        adSection.style.display = "none";
      }
    }

    const invSection = document.getElementById("ciInviteSection");
    const invEl = document.getElementById("ciInviteLink");
    if (invSection && invEl) {
      if (!isPrivate) {
        const base = window.location.origin + window.location.pathname.replace("chat.html", "");
        const link = base + "chat.html?join=" + viewingChatId;
        invSection.style.display = "block";
        invEl.textContent = link;
      } else {
        invSection.style.display = "none";
      }
    }

    const editBtn = document.getElementById("btnEditChat");
    if (editBtn) editBtn.style.display = isAdmin && !isPrivate ? "block" : "none";

    const mutes = (S.currentUserData && S.currentUserData.muted) || {};
    const muted = !!mutes[viewingChatId];
    const muteIcon = document.getElementById("ciMuteIcon");
    const muteLabel = document.getElementById("ciMuteLabel");
    if (muteIcon) muteIcon.textContent = muted ? "🔕" : "🔔";
    if (muteLabel) muteLabel.textContent = muted ? "Вкл. звук" : "Выкл. звук";

    const preview = document.getElementById("ciMembersPreview");
    if (preview) {
      preview.innerHTML = "";
      const uids = Object.keys(chat.members || {});
      const sorted = uids.sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 };
        return order[getRole(chat, a)] - order[getRole(chat, b)];
      });

      sorted.slice(0, 5).forEach(uid => {
        preview.appendChild(buildMemberRow(chat, uid));
      });

      const showAllBtn = document.getElementById("btnShowAllMembers");
      if (showAllBtn) {
        if (uids.length > 5) showAllBtn.style.display = "block";
        else showAllBtn.style.display = "none";
      }
    }

    const addBtn = document.getElementById("btnAddMembers");
    if (addBtn) addBtn.style.display = isAdmin ? "block" : "none";

    const delBtn = document.getElementById("btnDeleteChatFull");
    if (delBtn) delBtn.style.display = isOwner ? "block" : "none";

    const mLabel = document.getElementById("ciMembersLabel");
    if (mLabel) mLabel.textContent = isChannel ? "Подписчики" : "Участники";
  }

  function getRole(chat, uid) {
    if (chat.owner === uid) return "owner";
    if (chat.admins && chat.admins[uid]) return "admin";
    return "member";
  }

  function buildMemberRow(chat, uid) {
    const u = usersCache[uid] || {};
    const role = getRole(chat, uid);
    const row = document.createElement("div");
    row.className = "chat-info-member-row";

    const ava = u.photo && u.photo.startsWith("data:image")
      ? `<img src="${u.photo}">`
      : escH((u.name || u.email || "?").charAt(0).toUpperCase());

    let roleHTML = "";
    if (role === "owner") roleHTML = `<div class="chat-info-member-role owner">Владелец</div>`;
    else if (role === "admin") roleHTML = `<div class="chat-info-member-role admin">Админ</div>`;

    let nameHTML = escH(u.name || u.email || "Пользователь");
    if (u.verified) nameHTML += ` <img src="verify.png" style="width:12px;height:12px;vertical-align:middle;margin-left:3px;">`;

    row.innerHTML = `
      <div class="chat-info-member-ava">${ava}</div>
      <div class="chat-info-member-info">
        <div class="chat-info-member-name">${nameHTML}</div>
        ${roleHTML}
      </div>
    `;

    row.addEventListener("click", () => {
      if (chat.type === "private") {
        if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(uid);
      } else if (uid === currentUser.uid) {
        if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(uid);
      } else {
        openMemberActions(uid);
      }
    });

    return row;
  }

  /* ============================================================
     РЕДАКТИРОВАНИЕ
     ============================================================ */
  const btnEditChat = document.getElementById("btnEditChat");
  if (btnEditChat) btnEditChat.addEventListener("click", openEditChat);

  function openEditChat() {
    if (!currentChat) return;
    const isChannel = currentChat.type === "channel";
    const isGroup = currentChat.type === "group";

    ecAvatarBase64 = null;
    ecAvatarChanged = false;
    ecAutoDelete = currentChat.autoDelete || 0;

    const title = document.getElementById("ecHeaderTitle");
    if (title) title.textContent = isChannel ? "Изменить канал" : "Изменить группу";

    const preview = document.getElementById("ecAvatarPreview");
    if (preview) {
      if (currentChat.photo && currentChat.photo.startsWith("data:image")) {
        preview.style.backgroundImage = `url(${currentChat.photo})`;
        preview.classList.add("has-photo");
      } else {
        preview.style.backgroundImage = "";
        preview.classList.remove("has-photo");
      }
    }

    const nameInput = document.getElementById("ecName");
    if (nameInput) nameInput.value = currentChat.name || "";

    const descInput = document.getElementById("ecDesc");
    if (descInput) descInput.value = currentChat.description || "";

    const chBlock = document.getElementById("ecChannelBlock");
    const grBlock = document.getElementById("ecGroupBlock");
    if (chBlock) chBlock.style.display = isChannel ? "block" : "none";
    if (grBlock) grBlock.style.display = isGroup ? "block" : "none";

    if (isChannel) {
      const isPublic = currentChat.isPublic === true;
      const radio = document.querySelector(`input[name="ecType"][value="${isPublic ? "public" : "private"}"]`);
      if (radio) radio.checked = true;
      const unInput = document.getElementById("ecUsername");
      if (unInput) unInput.value = currentChat.username || "";
      updateEcUsernameVisibility();
    }

    if (isGroup) {
      const ad = document.getElementById("ecAutoDeleteValue");
      if (ad) ad.textContent = ecAutoDelete === 0 ? "Выкл." : fmtAutoDelete(ecAutoDelete);
    }

    showScreen("screen-edit-chat");
  }

  function updateEcUsernameVisibility() {
    const val = document.querySelector('input[name="ecType"]:checked')?.value || "public";
    const block = document.getElementById("ecUsernameBlock");
    if (block) block.style.display = val === "public" ? "block" : "none";
  }

  document.querySelectorAll('input[name="ecType"]').forEach(r => {
    r.addEventListener("change", updateEcUsernameVisibility);
  });

  const ecAvatarInput = document.getElementById("ecAvatarInput");
  if (ecAvatarInput) ecAvatarInput.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 500 * 1024) return S.showToast("Фото до 500 КБ", "error");
    const r = new FileReader();
    r.onload = (ev) => {
      ecAvatarBase64 = ev.target.result;
      ecAvatarChanged = true;
      const p = document.getElementById("ecAvatarPreview");
      if (p) {
        p.style.backgroundImage = `url(${ecAvatarBase64})`;
        p.classList.add("has-photo");
      }
    };
    r.readAsDataURL(f);
  });

  const ecAutoDeleteRow = document.getElementById("ecAutoDeleteRow");
  if (ecAutoDeleteRow) ecAutoDeleteRow.addEventListener("click", () => {
    document.getElementById("modal-autodelete-edit").classList.add("active");
  });
  const btnCloseAutoDeleteEdit = document.getElementById("btnCloseAutoDeleteEdit");
  if (btnCloseAutoDeleteEdit) btnCloseAutoDeleteEdit.addEventListener("click", () => {
    document.getElementById("modal-autodelete-edit").classList.remove("active");
  });
  document.querySelectorAll("#modal-autodelete-edit .menu-row[data-ad]").forEach(row => {
    row.addEventListener("click", () => {
      ecAutoDelete = parseInt(row.dataset.ad) || 0;
      const ad = document.getElementById("ecAutoDeleteValue");
      if (ad) ad.textContent = ecAutoDelete === 0 ? "Выкл." : fmtAutoDelete(ecAutoDelete);
      document.getElementById("modal-autodelete-edit").classList.remove("active");
    });
  });

  const btnBackEdit = document.getElementById("btnBackEditChat");
  if (btnBackEdit) btnBackEdit.addEventListener("click", () => showScreen("screen-chat-info"));

  const btnSaveEdit = document.getElementById("btnSaveEditChat");
  if (btnSaveEdit) btnSaveEdit.addEventListener("click", async () => {
    if (!currentChat || !viewingChatId) return;
    const isChannel = currentChat.type === "channel";
    const isGroup = currentChat.type === "group";

    const name = (document.getElementById("ecName").value || "").trim();
    if (!name) return S.showToast("Введите название", "error");
    const desc = (document.getElementById("ecDesc").value || "").trim();

    const updates = { name, description: desc };
    if (ecAvatarChanged && ecAvatarBase64) updates.photo = ecAvatarBase64;

    if (isChannel) {
      const type = document.querySelector('input[name="ecType"]:checked')?.value || "public";
      if (type === "public") {
        const un = (document.getElementById("ecUsername").value || "").trim().toLowerCase();
        if (un && !/^[a-z0-9_]{5,20}$/.test(un)) {
          return S.showToast("Юзернейм: 5-20, латиница/цифры/_", "error");
        }
        if (un && un !== (currentChat.username || "")) {
          const snap = await get(ref(db, "chats"));
          const chats = snap.val() || {};
          for (const id in chats) {
            if (id === viewingChatId) continue;
            if (chats[id].username && chats[id].username.toLowerCase() === un) {
              return S.showToast("Юзернейм @" + un + " занят", "error");
            }
          }
        }
        updates.isPublic = true;
        updates.username = un || null;
      } else {
        updates.isPublic = false;
        updates.username = null;
      }
    }

    if (isGroup) {
      if (ecAutoDelete > 0) updates.autoDelete = ecAutoDelete;
      else updates.autoDelete = null;
    }

    try {
      await update(ref(db, "chats/" + viewingChatId), updates);
      S.showToast("Сохранено", "ok");
      showScreen("screen-chat-info");
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  });

  /* ============================================================
     СПИСОК УЧАСТНИКОВ
     ============================================================ */
  const btnShowAll = document.getElementById("btnShowAllMembers");
  if (btnShowAll) btnShowAll.addEventListener("click", openMembersScreen);

  const btnAddMembersTop = document.getElementById("btnAddMembersTop");
  if (btnAddMembersTop) btnAddMembersTop.addEventListener("click", openAddMembers);

  const btnAddMembers = document.getElementById("btnAddMembers");
  if (btnAddMembers) btnAddMembers.addEventListener("click", openAddMembers);

  function openMembersScreen() {
    if (!currentChat) return;
    const title = document.getElementById("cmHeaderTitle");
    if (title) title.textContent = currentChat.type === "channel" ? "Подписчики" : "Участники";
    const search = document.getElementById("cmSearchMembers");
    if (search) search.value = "";
    renderFullMembers("");
    showScreen("screen-chat-members");
  }

  const cmSearchMembers = document.getElementById("cmSearchMembers");
  if (cmSearchMembers) cmSearchMembers.addEventListener("input", (e) => renderFullMembers(e.target.value));

  function renderFullMembers(query) {
    if (!currentChat) return;
    const list = document.getElementById("cmMembersList");
    if (!list) return;
    list.innerHTML = "";

    const q = (query || "").toLowerCase().trim();
    const uids = Object.keys(currentChat.members || {});
    const rows = [];

    uids.forEach(uid => {
      const u = usersCache[uid] || {};
      const name = (u.name || u.email || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      if (q && !name.includes(q) && !uname.includes(q)) return;
      rows.push(uid);
    });

    rows.sort((a, b) => {
      const order = { owner: 0, admin: 1, member: 2 };
      const ra = order[getRole(currentChat, a)];
      const rb = order[getRole(currentChat, b)];
      if (ra !== rb) return ra - rb;
      const ua = usersCache[a] || {};
      const ub = usersCache[b] || {};
      return (ua.name || "").localeCompare(ub.name || "");
    });

    if (rows.length === 0) {
      list.innerHTML = '<div class="create-empty">Никого не найдено</div>';
      return;
    }

    rows.forEach(uid => {
      list.appendChild(buildMemberRow(currentChat, uid));
    });
  }

  const btnBackMembers = document.getElementById("btnBackMembers");
  if (btnBackMembers) btnBackMembers.addEventListener("click", () => showScreen("screen-chat-info"));

  /* ============================================================
     ДОБАВЛЕНИЕ УЧАСТНИКОВ
     ============================================================ */
  function openAddMembers() {
  if (!currentChat || !viewingChatId) return;
  if (window.Sqwid && typeof window.Sqwid.openAddMembersToChat === "function") {
    window.Sqwid.openAddMembersToChat(viewingChatId);
  }
}

  /* ============================================================
     ДЕЙСТВИЯ С УЧАСТНИКОМ
     ============================================================ */
  function openMemberActions(uid) {
    if (!currentChat) return;
    const u = usersCache[uid] || {};
    memberActionsUid = uid;

    const ava = document.getElementById("maAva");
    if (ava) {
      if (u.photo && u.photo.startsWith("data:image")) ava.src = u.photo;
      else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#3b82f6"/><text x="50%" y="55%" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${letter}</text></svg>`;
        ava.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      }
    }
    const nameEl = document.getElementById("maName");
    if (nameEl) nameEl.textContent = u.name || u.email || "Пользователь";
    const unEl = document.getElementById("maUsername");
    if (unEl) unEl.textContent = u.username ? "@" + u.username : "";

    const isOwner = currentChat.owner === currentUser.uid;
    const isMeAdmin = isOwner || (currentChat.admins && currentChat.admins[currentUser.uid]);
    const targetRole = getRole(currentChat, uid);
    const targetIsOwner = targetRole === "owner";

    const btnMakeAdmin = document.getElementById("btnMaMakeAdmin");
    const btnRemoveAdmin = document.getElementById("btnMaRemoveAdmin");
    const btnKick = document.getElementById("btnMaKick");
    const btnProfile = document.getElementById("btnMaViewProfile");

    if (btnProfile) {
      btnProfile.onclick = () => {
        closeMemberActions();
        if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(uid);
      };
    }

    if (btnMakeAdmin) {
      if (isOwner && targetRole === "member") {
        btnMakeAdmin.style.display = "block";
        btnMakeAdmin.onclick = async () => {
          const admins = currentChat.admins || {};
          admins[uid] = true;
          await update(ref(db, "chats/" + viewingChatId), { admins });
          S.showToast("Назначен админом", "ok");
          closeMemberActions();
        };
      } else btnMakeAdmin.style.display = "none";
    }

    if (btnRemoveAdmin) {
      if (isOwner && targetRole === "admin") {
        btnRemoveAdmin.style.display = "block";
        btnRemoveAdmin.onclick = async () => {
          const admins = { ...(currentChat.admins || {}) };
          delete admins[uid];
          await update(ref(db, "chats/" + viewingChatId), { admins });
          S.showToast("Снят с админов", "ok");
          closeMemberActions();
        };
      } else btnRemoveAdmin.style.display = "none";
    }

    if (btnKick) {
      if (isMeAdmin && !targetIsOwner && uid !== currentUser.uid) {
        btnKick.style.display = "block";
        btnKick.onclick = async () => {
          const ok = await S.showConfirm("Удалить из чата?", "Удаление участника");
          if (!ok) return;
          await remove(ref(db, "chats/" + viewingChatId + "/members/" + uid));
          if (currentChat.admins && currentChat.admins[uid]) {
            const admins = { ...currentChat.admins };
            delete admins[uid];
            await update(ref(db, "chats/" + viewingChatId), { admins });
          }
          S.showToast("Участник удалён", "ok");
          closeMemberActions();
        };
      } else btnKick.style.display = "none";
    }

    document.getElementById("modal-member-actions").classList.add("active");
  }

  function closeMemberActions() {
    document.getElementById("modal-member-actions").classList.remove("active");
    memberActionsUid = null;
  }

  const btnMaCancel = document.getElementById("btnMaCancel");
  if (btnMaCancel) btnMaCancel.addEventListener("click", closeMemberActions);

  /* ============================================================
     ДЕЙСТВИЯ С ЧАТОМ
     ============================================================ */
  const btnLeave = document.getElementById("btnLeaveChat");
  if (btnLeave) btnLeave.addEventListener("click", async () => {
    if (!viewingChatId) return;
    const ok = await S.showConfirm("Покинуть чат?", "Выход");
    if (!ok) return;
    await remove(ref(db, "chats/" + viewingChatId + "/members/" + currentUser.uid));
    S.showToast("Вы покинули чат", "ok");
    if (window.Sqwid && window.Sqwid.showScreen) window.Sqwid.showScreen("screen-chats");
  });

  const btnDelFull = document.getElementById("btnDeleteChatFull");
  if (btnDelFull) btnDelFull.addEventListener("click", async () => {
    if (!viewingChatId || !currentChat) return;
    if (currentChat.owner !== currentUser.uid) return;
    const ok = await S.showConfirm("Удалить чат для всех?", "Удаление");
    if (!ok) return;
    await remove(ref(db, "chats/" + viewingChatId));
    await remove(ref(db, "messages/" + viewingChatId));
    S.showToast("Чат удалён", "ok");
    if (window.Sqwid && window.Sqwid.showScreen) window.Sqwid.showScreen("screen-chats");
  });

  /* ============================================================
     ЖАЛОБА НА ЧАТ / КАНАЛ
     ============================================================ */
  const btnReportChat = document.getElementById("btnReportChat");
  if (btnReportChat) btnReportChat.addEventListener("click", () => {
    if (!viewingChatId || !currentChat) return;
    if (window.Sqwid && window.Sqwid.openReportModal) {
      window.Sqwid.openReportModal({
        targetType: "chat",
        targetUid: null,
        chatId: viewingChatId,
        targetLabel: `Чат/канал «${currentChat.name || "?"}»`
      });
    }
  });

  /* ============================================================
     КОПИРОВАНИЕ ИНВАЙТА
     ============================================================ */
  const btnCopy = document.getElementById("btnCopyInvite");
  if (btnCopy) btnCopy.addEventListener("click", async () => {
    const link = document.getElementById("ciInviteLink")?.textContent || "";
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        S.showToast("Ссылка скопирована", "ok");
      } else {
        S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
      }
    } catch (e) {
      S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
    }
  });

  /* ============================================================
     УВЕДОМЛЕНИЯ
     ============================================================ */
  const btnMute = document.getElementById("ciActionMute");
  if (btnMute) btnMute.addEventListener("click", async () => {
    if (!viewingChatId) return;
    const mySnap = await get(ref(db, "users/" + currentUser.uid));
    const me = mySnap.val() || {};
    const mutes = { ...(me.muted || {}) };
    if (mutes[viewingChatId]) delete mutes[viewingChatId];
    else mutes[viewingChatId] = true;
    await update(ref(db, "users/" + currentUser.uid), { muted: mutes });
    S.showToast(mutes[viewingChatId] ? "Уведомления выключены" : "Уведомления включены", "ok");
  });

  const btnActionSearch = document.getElementById("ciActionSearch");
if (btnActionSearch) btnActionSearch.addEventListener("click", () => {
  if (!viewingChatId) return;
  if (window.Sqwid && window.Sqwid.openSearch) {
    window.Sqwid.openSearch(viewingChatId);
  }
});

  const btnActionMedia = document.getElementById("ciActionMedia");
if (btnActionMedia) btnActionMedia.addEventListener("click", () => {
  if (!viewingChatId) return;
  if (window.Sqwid && window.Sqwid.openGallery) {
    window.Sqwid.openGallery(viewingChatId);
  }
});

  /* ============================================================
     ХЕЛПЕРЫ
     ============================================================ */
  function fmtAutoDelete(sec) {
    if (sec === 86400) return "24 часа";
    if (sec === 604800) return "7 дней";
    if (sec === 2592000) return "30 дней";
    return "Выкл.";
  }
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  const btnBackCI = document.getElementById("btnBackChatInfo");
  if (btnBackCI) btnBackCI.addEventListener("click", () => {
    if (window.Sqwid && window.Sqwid.getChatId && window.Sqwid.getChatId()) {
      showScreen("screen-messages");
    } else {
      showScreen("screen-chats");
    }
  });

  console.log("✅ chat-info.js готов");
});