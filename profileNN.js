/* ============================================================
   profileNN.js — профиль собеседника (Стиль Telegram)
   + рабочие кнопки Чат, Звонок, Видео
   + купленные рамки, фоны, значки и цвета ников
   ============================================================ */

console.log("🚀 profileNN.js загружен, жду Sqwid...");

function waitForSqwidNN(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ profileNN.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidNN((S) => {
  const { db, ref, get, set, push, onValue, currentUser, userMap, showScreen } = S;
  if (!currentUser) return;

  console.log("🔥 profileNN.js активирован");

  let viewingUid = null;
  let viewingUserName = "Пользователь";
  let unsubUser = null;

  /* ============================================================
     ПРЕСЕТЫ И ИКОНКИ
     ============================================================ */
  const BG_PRESETS = {
    sunset: "linear-gradient(135deg, #f97316, #ec4899)",
    ocean:  "linear-gradient(135deg, #06b6d4, #3b82f6)",
    night:  "linear-gradient(135deg, #1e1b4b, #312e81)",
    forest: "linear-gradient(135deg, #10b981, #047857)",
    space:  "radial-gradient(circle at 50% 30%, #1e1b4b, #000)"
  };

  const BADGE_SVG = {
    star:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" style="vertical-align:middle;margin-left:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    crown:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" style="vertical-align:middle;margin-left:4px;"><path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/></svg>`,
    fire:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f97316" style="vertical-align:middle;margin-left:4px;"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/></svg>`,
    diamond: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#06b6d4" style="vertical-align:middle;margin-left:4px;"><path d="M6 2l-4 6 10 14L22 8l-4-6z"/></svg>`
  };

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  function verifiedIcon(size = 16) {
    return `<span class="verified-tappable" data-verified-open="1" style="margin-left:4px;"><svg width="${size}" height="${size}"><use href="#ico-verified"/></svg></span>`;
  }

  /* ============================================================
     ОТКРЫТИЕ ЧУЖОГО ПРОФИЛЯ
     ============================================================ */
  async function openOtherProfile(uid) {
    if (!uid) return;
    if (uid === currentUser.uid) { showScreen("screen-profile"); return; }
    viewingUid = uid;
    if (window.Sqwid) window.Sqwid.viewingProfileUid = uid;

    let u = userMap[uid] || {};
    if (!u.name && !u.email) {
      try {
        const snap = await get(ref(db, "users/" + uid));
        const fresh = snap.val();
        if (fresh) u = fresh;
      } catch (e) {}
    }

    viewingUserName = u.name || u.email || "Пользователь";

    applyProfileStatus(u, uid);
    subscribeUser(uid);
    showScreen("screen-user-profile");
  }

  if (window.Sqwid) window.Sqwid.openOtherProfile = openOtherProfile;

  /* ============================================================
     СТАТУС, РАМКИ, ЗНАЧКИ, ФОН
     ============================================================ */
  function applyProfileStatus(u, uid) {
    const banned = u.banned === true;
    const frozen = u.frozen === true;

    /* ---- Аватарка и Рамка ---- */
    const avaEl = document.getElementById("upAva");
    if (avaEl) {
      if (banned) {
        avaEl.innerHTML = `<span style="font-size:44px;">🚫</span>`;
      } else if (frozen) {
        avaEl.innerHTML = `<span style="font-size:48px;">❄</span>`;
      } else if (u.photo && u.photo.startsWith("data:image")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
      } else if (u.photo && !u.photo.startsWith("data:")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
      } else {
        avaEl.innerHTML = `<span>${escH((u.name || u.email || "?").trim().charAt(0).toUpperCase())}</span>`;
      }

      const wrap = avaEl.parentElement;
      if (wrap) {
        wrap.classList.remove("frame-gold", "frame-fire", "frame-rainbow", "frame-plus");
        if (!banned && !frozen) {
          const frameValue = (u.shopEquipped && u.shopEquipped.frame) || u.avatarFrame;
          if (frameValue) wrap.classList.add("frame-" + frameValue);
          else if (u.plusUntil && u.plusUntil > Date.now()) wrap.classList.add("frame-plus");
        }
      }
    }

    /* ---- Имя и Значки ---- */
    const nameEl = document.getElementById("upName");
    if (nameEl) {
      let nameHTML = escH(u.name || u.email || "Пользователь");
      
      if (u.nickColor) {
        if (u.nickColor.startsWith("linear-gradient")) {
          nameHTML = `<span style="display:inline-block;background:${u.nickColor};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:800;">${nameHTML}</span>`;
        } else {
          nameHTML = `<span style="color:${u.nickColor};font-weight:800;">${nameHTML}</span>`;
        }
      } else if (u.plusUntil && u.plusUntil > Date.now()) {
        nameHTML = `<span class="nick-plus">${nameHTML}</span>`;
      }

      if (u.verified && !banned) nameHTML += verifiedIcon(16);
      if (u.shopEquipped && u.shopEquipped.badge && BADGE_SVG[u.shopEquipped.badge] && !banned) {
        nameHTML += BADGE_SVG[u.shopEquipped.badge];
      }
      if (u.nickEmoji) nameHTML += ` <span class="nick-emoji">${u.nickEmoji}</span>`;

      if (banned) nameHTML += ` <span style="color:#ef4444;font-size:12px;font-weight:700;margin-left:6px;">ЗАБЛОКИРОВАН</span>`;
      
      nameEl.innerHTML = nameHTML;
      nameEl.classList.remove("frozen-name", "banned-name");
      if (banned) nameEl.classList.add("banned-name");
      else if (frozen) nameEl.classList.add("frozen-name");
    }

    /* ---- Статус "был(а) недавно" ---- */
    const statusText = document.getElementById("upStatusText");
    if (statusText && window.Sqwid && window.Sqwid.getLastSeenText) {
       const t = window.Sqwid.getLastSeenText(uid);
       statusText.textContent = t || "был(а) недавно";
    }

    /* ---- Bio ---- */
    const bioRow = document.getElementById("upBioRow");
    const bioEl = document.getElementById("upBio");
    if (bioRow && bioEl) {
      if (u.bio) {
        bioRow.style.display = "block";
        bioEl.textContent = u.bio;
      } else {
        bioRow.style.display = "none";
      }
    }

    /* ---- Username ---- */
    const unEl = document.getElementById("upUsername");
    if (unEl) unEl.textContent = u.username ? "@" + u.username : "@username";

    /* ---- ФОН ПРОФИЛЯ ---- */
    const scroll = document.querySelector("#screen-user-profile .profile-scroll");
    if (scroll) {
      const equippedBg = u.shopEquipped && u.shopEquipped.bg;
      if (u.profileBg && u.plusUntil > Date.now()) {
        scroll.style.backgroundImage = `url(${u.profileBg})`;
        scroll.style.backgroundSize = "cover";
        scroll.style.backgroundPosition = "center";
        scroll.classList.add("has-bg");
      } else if (equippedBg && BG_PRESETS[equippedBg]) {
        scroll.style.backgroundImage = BG_PRESETS[equippedBg];
        scroll.style.backgroundSize = "cover";
        scroll.style.backgroundPosition = "center";
        scroll.classList.add("has-bg");
      } else {
        scroll.style.backgroundImage = "";
        scroll.classList.remove("has-bg");
      }
    }
  }

  /* ============================================================
     ПОДПИСКА НА ЮЗЕРА (В РЕАЛЬНОМ ВРЕМЕНИ)
     ============================================================ */
  function subscribeUser(uid) {
    if (unsubUser) unsubUser();
    unsubUser = onValue(ref(db, "users/" + uid), (snap) => {
      const fresh = snap.val();
      if (fresh && viewingUid === uid) {
        viewingUserName = fresh.name || fresh.email || "Пользователь";
        applyProfileStatus(fresh, uid);
      }
    });
  }

  /* ============================================================
     ОТКРЫТИЕ ЧАТА И ЗВОНКИ
     ============================================================ */
  async function openPrivateChatWith(uid, displayName) {
    if (!uid || uid === currentUser.uid) return;
    const snap = await get(ref(db, "chats"));
    const chats = snap.val() || {};
    let existing = null;
    for (const chatId in chats) {
      const c = chats[chatId];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[currentUser.uid] && m[uid] && Object.keys(m).length === 2) {
        existing = chatId;
        break;
      }
    }
    if (existing) {
      if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(existing);
      else showScreen("screen-messages");
    } else {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: displayName || "Чат",
        type: "private",
        members: { [currentUser.uid]: true, [uid]: true },
        owner: currentUser.uid,
        createdAt: Date.now(),
        lastMsgAt: Date.now()
      });
      if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(newRef.key);
      else showScreen("screen-messages");
    }
  }

  async function startCallFromProfile(type) {
    if (!viewingUid) return;
    
    // Ищем существующий личный чат
    const snap = await get(ref(db, "chats"));
    const chats = snap.val() || {};
    let existingChatId = null;
    
    for (const chatId in chats) {
      const c = chats[chatId];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[currentUser.uid] && m[viewingUid] && Object.keys(m).length === 2) {
        existingChatId = chatId;
        break;
      }
    }

    // Если чата нет — создаём
    if (!existingChatId) {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: viewingUserName,
        type: "private",
        members: { [currentUser.uid]: true, [viewingUid]: true },
        owner: currentUser.uid,
        createdAt: Date.now(),
        lastMsgAt: Date.now()
      });
      existingChatId = newRef.key;
    }

    // Открываем чат (чтобы calls.js знал, кому звонить)
    if (window.Sqwid && window.Sqwid.openChat) {
      await window.Sqwid.openChat(existingChatId);
    }

    // Ждём секунду, чтобы чат успел загрузиться, и звоним
    setTimeout(() => {
      if (type === "audio" && window.Sqwid && window.Sqwid.startCall) {
        window.Sqwid.startCall("audio");
      } else if (type === "video" && window.Sqwid && window.Sqwid.startCall) {
        window.Sqwid.startCall("video");
      } else {
        S.showToast("Звонки пока не загрузились, подождите", "info");
      }
    }, 500);
  }

  /* ============================================================
     КНОПКИ
     ============================================================ */
  const btnBack = document.getElementById("btnBackUserProfile");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      viewingUid = null;
      viewingUserName = "Пользователь";
      if (window.Sqwid) window.Sqwid.viewingProfileUid = null;
      if (unsubUser) { unsubUser(); unsubUser = null; }
      const chatId = window.Sqwid && window.Sqwid.getChatId ? window.Sqwid.getChatId() : null;
      if (chatId) showScreen("screen-messages");
      else showScreen("screen-chats");
    });
  }

  const btnUpChat = document.getElementById("btnUpChat");
  if (btnUpChat) {
    btnUpChat.addEventListener("click", () => {
      if (viewingUid) openPrivateChatWith(viewingUid, viewingUserName);
    });
  }

  const btnUpMute = document.getElementById("btnUpMute");
  if (btnUpMute) {
    btnUpMute.addEventListener("click", () => {
      S.showToast("Уведомления отключены", "ok");
    });
  }

  const btnUpCall = document.getElementById("btnUpCall");
  if (btnUpCall) {
    btnUpCall.addEventListener("click", () => startCallFromProfile("audio"));
  }

  const btnUpVideo = document.getElementById("btnUpVideo");
  if (btnUpVideo) {
    btnUpVideo.addEventListener("click", () => startCallFromProfile("video"));
  }

  const btnWrite = document.getElementById("btnUpWrite");
  if (btnWrite) {
    btnWrite.onclick = () => {
      if (viewingUid) openPrivateChatWith(viewingUid, viewingUserName);
    };
  }

  const btnReport = document.getElementById("btnUpReport");
  if (btnReport) {
    btnReport.onclick = () => {
      if (!viewingUid) return;
      if (window.Sqwid && window.Sqwid.openReportModal) {
        window.Sqwid.openReportModal({
          targetType: "user",
          targetUid: viewingUid,
          targetLabel: `Пользователь ${viewingUserName}`
        });
      }
    };
  }

  console.log("✅ profileNN.js готов");
});