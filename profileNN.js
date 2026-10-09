/* ============================================================
   profileNN.js — профиль собеседника
   + соцсети (Sqwid+), юзернеймы, номера, подарки, валидация URL
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
  let unsubGifts = null;
  let unsubUser = null;
  let shopItems = [];

  /* ============================================================
     ВАЛИДАЦИЯ URL
     ============================================================ */
  function sanitizeUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return "";
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      if (!u.hostname || !u.hostname.includes(".")) return "";
      return u.href;
    } catch (e) {
      return "";
    }
  }

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  function currentOtherUid() {
    const S2 = window.Sqwid;
    if (!S2) return null;
    const chatId = S2.getChatId ? S2.getChatId() : null;
    if (!chatId) return null;
    const chatData = S2.getChatData ? S2.getChatData() : null;
    if (!chatData) return null;
    if (chatData.type !== "private") return null;
    return Object.keys(chatData.members || {}).find(u => u !== currentUser.uid) || null;
  }

  onValue(ref(db, "shop/items"), (snap) => {
    const all = snap.val() || {};
    shopItems = Object.values(all);
  });

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

    applyProfileStatus(u);

    /* --- Кнопка "Написать" --- */
    const btnWrite = document.getElementById("btnUpWrite");
    if (btnWrite) {
      btnWrite.onclick = () => openPrivateChatWith(uid, u.name || u.email || "Пользователь");
      btnWrite.disabled = u.banned === true;
      btnWrite.style.opacity = u.banned === true ? "0.4" : "1";
    }

    /* --- Кнопка "Подарить" --- */
    const btnGift = document.getElementById("btnUpGift");
    if (btnGift) {
      btnGift.onclick = () => {
        if (u.banned === true) {
          if (window.Sqwid && window.Sqwid.showToast) window.Sqwid.showToast("🚫 Пользователь заблокирован", "error");
          return;
        }
        if (window.Sqwid && typeof window.Sqwid.openGiftScreen === "function") {
          window.Sqwid.openGiftScreen(uid);
        } else {
          showScreen("screen-give-gift");
        }
      };
      btnGift.style.opacity = u.banned === true ? "0.4" : "1";
    }

    /* --- Кнопка "Торг" --- */
    const btnTrade = document.getElementById("btnUpTrade");
    if (btnTrade) {
      btnTrade.onclick = () => {
        if (u.banned === true) {
          if (window.Sqwid && window.Sqwid.showToast) window.Sqwid.showToast("🚫 Пользователь заблокирован", "error");
          return;
        }
        if (window.Sqwid && window.Sqwid.openTrade) {
          window.Sqwid.openTrade(uid);
        } else {
          if (window.Sqwid && window.Sqwid.showToast) window.Sqwid.showToast("Торг недоступен", "error");
        }
      };
      btnTrade.style.opacity = u.banned === true ? "0.4" : "1";
    }

    /* --- Кнопка "Пожаловаться" --- */
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

    renderSocial(uid, u);
    renderGifts(uid);
    subscribeUser(uid);
    renderUsernames(uid, u);
    renderPhones(uid, u);

    showScreen("screen-user-profile");
  }

  if (window.Sqwid) window.Sqwid.openOtherProfile = openOtherProfile;

  /* ============================================================
     СОЦСЕТИ (Sqwid+)
     ============================================================ */
  function renderSocial(uid, u) {
    let box = document.getElementById("upSocial");

    const isPlusUser = u.plusUntil && u.plusUntil > Date.now();
    const links = u.socialLinks || {};

    // Есть ли хоть одна валидная ссылка
    const hasLinks = isPlusUser && Object.values(links).some(v => v && typeof v === "string" && v.trim());

    if (!hasLinks) {
      if (box) box.remove();
      return;
    }

    if (!box) {
      box = document.createElement("div");
      box.id = "upSocial";
      box.className = "up-section";
      box.innerHTML = `<h3 class="up-section-title">🔗 Соцсети</h3><div class="up-chips" id="upSocialList"></div>`;
      const ref = document.getElementById("upUsernamesSection");
      const parent = document.querySelector("#screen-user-profile .profile-scroll");
      if (parent && ref) parent.insertBefore(box, ref);
      else if (parent) parent.appendChild(box);
    }

    const list = document.getElementById("upSocialList");
    if (!list) return;
    list.innerHTML = "";

    const icons = {
      telegram: "✈️",
      instagram: "📸",
      youtube: "▶️",
      tiktok: "🎵",
      vk: "🅥",
      github: "🐙",
      website: "🌐"
    };

    Object.entries(links).forEach(([key, url]) => {
      if (!url || typeof url !== "string") return;
      const safe = sanitizeUrl(url);
      if (!safe) return;

      const a = document.createElement("a");
      a.href = safe;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "up-chip";
      a.style.textDecoration = "none";
      a.style.display = "inline-flex";
      a.style.alignItems = "center";
      a.style.gap = "6px";
      a.style.cursor = "pointer";
      a.innerHTML = `${icons[key] || "🔗"} ${key}`;
      list.appendChild(a);
    });

    if (list.children.length === 0) box.remove();
  }

  /* ============================================================
     СТАТУС (бан / заморозка)
     ============================================================ */
  function applyProfileStatus(u) {
    const banned = u.banned === true;
    const frozen = u.frozen === true;

    const avaEl = document.getElementById("upAva");
    if (avaEl) {
      if (banned) {
        avaEl.innerHTML = `<span style="font-size:44px;">🚫</span>`;
        avaEl.classList.add("banned-ava");
        avaEl.classList.remove("frozen-ava");
      } else if (frozen) {
        avaEl.innerHTML = `<span style="font-size:48px;">❄</span>`;
        avaEl.classList.add("frozen-ava");
        avaEl.classList.remove("banned-ava");
      } else if (u.photo && u.photo.startsWith("data:image")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      } else if (u.photo && !u.photo.startsWith("data:")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      } else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        avaEl.innerHTML = `<span>${escH(letter)}</span>`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      }
    }

    const nameEl = document.getElementById("upName");
    if (nameEl) {
      let nameHTML = escH(u.name || u.email || "Пользователь");
      if (u.verified && !banned) {
        nameHTML += ` <img src="verify.PNG" style="width:16px;height:16px;vertical-align:middle;margin-left:4px;">`;
      }
      if (banned) {
        nameHTML += ` <span style="color:#ef4444;font-size:12px;font-weight:700;margin-left:6px;">ЗАБЛОКИРОВАН</span>`;
      }
      nameEl.innerHTML = nameHTML;
      nameEl.classList.remove("frozen-name");
      if (banned) nameEl.classList.add("banned-name");
      else if (frozen) nameEl.classList.add("frozen-name");
    }

    let banner = document.getElementById("upBannedBanner");
    if (banned) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "upBannedBanner";
        banner.className = "up-banned-banner";
        banner.innerHTML = `🚫 Этот аккаунт заблокирован администрацией Sqwid`;
        const top = document.querySelector("#screen-user-profile .profile-top");
        if (top) top.insertBefore(banner, top.firstChild);
      }
    } else {
      if (banner) banner.remove();
    }

    let frozenBanner = document.getElementById("upFrozenBanner");
    if (frozen && !banned) {
      if (!frozenBanner) {
        frozenBanner = document.createElement("div");
        frozenBanner.id = "upFrozenBanner";
        frozenBanner.className = "up-frozen-banner";
        frozenBanner.innerHTML = `❄ Аккаунт заморожен — временно не может тратить SQ`;
        const top = document.querySelector("#screen-user-profile .profile-top");
        if (top) top.insertBefore(frozenBanner, top.firstChild);
      }
    } else {
      if (frozenBanner) frozenBanner.remove();
    }
  }

  /* ============================================================
     ПОДПИСКА НА ЮЗЕРА
     ============================================================ */
  function subscribeUser(uid) {
    if (unsubGifts) unsubGifts();
    if (unsubUser) unsubUser();

    unsubGifts = onValue(ref(db, "users/" + uid + "/gifts"), () => {
      renderGifts(uid);
    });
    unsubUser = onValue(ref(db, "users/" + uid), (snap) => {
      const fresh = snap.val();
      if (fresh && viewingUid === uid) {
        viewingUserName = fresh.name || fresh.email || "Пользователь";
        applyProfileStatus(fresh);
        renderSocial(uid, fresh);
        renderUsernames(uid, fresh);
        renderPhones(uid, fresh);
      }
    });
  }

  /* ============================================================
     ПОДАРКИ
     ============================================================ */
  async function renderGifts(uid) {
    const section = document.getElementById("upGiftsSection");
    const grid = document.getElementById("upGiftsGrid");
    if (!section || !grid) return;

    const snap = await get(ref(db, "users/" + uid + "/gifts"));
    const gifts = snap.val() || {};
    const arr = Object.values(gifts);

    if (arr.length === 0) {
      section.style.display = "none";
      grid.innerHTML = "";
      return;
    }

    section.style.display = "block";
    grid.innerHTML = "";

    arr.forEach(g => {
      if (!g) return;
      const card = document.createElement("div");
      card.className = "profile-gift-card";
      card.innerHTML = `
        <img src="${g.icon}" alt="">
        <div class="profile-gift-name">${escH(g.name || "Подарок")}</div>
      `;
      card.onclick = () => openGiftInfo(g);
      grid.appendChild(card);
    });
  }

  async function openGiftInfo(g) {
    const modal = document.getElementById("modal-gift-info");
    if (!modal || !g) return;

    document.getElementById("giftInfoImage").src = g.icon || "sqwidstar.png";
    document.getElementById("giftInfoName").textContent = g.name || "Подарок";
    document.getElementById("giftInfoPrice").textContent = g.price ? "🪙 " + g.price + " SQ" : "—";

    const dateEl = document.getElementById("giftInfoDate");
    if (g.receivedAt) {
      const d = new Date(g.receivedAt);
      dateEl.textContent =
        `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    } else {
      dateEl.textContent = "—";
    }

    const fromEl = document.getElementById("giftInfoFrom");
    if (g.hideName === true) {
      fromEl.textContent = "Аноним";
      fromEl.classList.remove("clickable");
      fromEl.onclick = null;
    } else {
      const displayName = g.fromName || "Пользователь";
      const uname = g.fromUsername ? " (@" + g.fromUsername + ")" : "";
      fromEl.textContent = displayName + uname;

      if (g.fromUid) {
        fromEl.classList.add("clickable");
        fromEl.onclick = () => {
          document.getElementById("modal-gift-info").classList.remove("active");
          openOtherProfile(g.fromUid);
        };
      } else {
        fromEl.classList.remove("clickable");
        fromEl.onclick = null;
      }
    }

    modal.classList.add("active");
  }

  /* ============================================================
     ЮЗЕРНЕЙМЫ
     ============================================================ */
  function renderUsernames(uid, u) {
    const section = document.getElementById("upUsernamesSection");
    const list = document.getElementById("upUsernamesList");
    if (!section || !list) return;
    list.innerHTML = "";

    const inv = u.inventory || {};
    const names = new Set();
    if (u.username) names.add(u.username);

    for (const id in inv) {
      if (!inv[id]) continue;
      const item = shopItems.find(i => i.id === id);
      if (item && item.type === "username" && item.value) names.add(item.value);
    }

    if (names.size === 0) { section.style.display = "none"; return; }
    section.style.display = "block";

    names.forEach(uname => {
      const isMain = u.username === uname;
      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = "@" + uname;
      chip.onclick = () => openItemInfo({
        value: "@" + uname,
        itemId: "uname_" + uname.toLowerCase(),
        ownerUid: uid
      });
      list.appendChild(chip);
    });
  }

  /* ============================================================
     НОМЕРА
     ============================================================ */
  function renderPhones(uid, u) {
    const section = document.getElementById("upPhonesSection");
    const list = document.getElementById("upPhonesList");
    if (!section || !list) return;
    list.innerHTML = "";

    const inv = u.inventory || {};
    const phones = new Set();
    if (u.phone) phones.add(u.phone);

    for (const id in inv) {
      if (!inv[id]) continue;
      const item = shopItems.find(i => i.id === id);
      if (item && item.type === "phone" && item.value) phones.add(item.value);
    }

    if (phones.size === 0) { section.style.display = "none"; return; }
    section.style.display = "block";

    phones.forEach(ph => {
      const isMain = u.phone === ph;
      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = ph;
      chip.onclick = () => openItemInfo({
        value: ph,
        itemId: "phone_" + ph.replace(/\D/g, "").slice(-6),
        ownerUid: uid
      });
      list.appendChild(chip);
    });
  }

  /* ============================================================
     ИНФО О ЮЗЕРНЕЙМЕ / НОМЕРЕ
     ============================================================ */
  async function openItemInfo({ value, itemId, ownerUid }) {
    const modal = document.getElementById("modal-item-info");
    if (!modal) return;

    const ownerSnap = await get(ref(db, "users/" + ownerUid));
    const owner = ownerSnap.val() || {};

    const itemSnap = await get(ref(db, "shop/items/" + itemId));
    const item = itemSnap.val() || {};

    const inv = owner.inventory || {};
    const invEntry = inv[itemId];
    let boughtAt = null;
    if (invEntry && typeof invEntry === "object" && invEntry.boughtAt) {
      boughtAt = invEntry.boughtAt;
    }

    const avaEl = document.getElementById("itemInfoAvatar");
    if (owner.photo && owner.photo.startsWith("data:image")) {
      avaEl.src = owner.photo;
    } else {
      const letter = (owner.name || owner.email || "?").trim().charAt(0).toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#6366f1"/><text x="50%" y="55%" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${letter}</text></svg>`;
      avaEl.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }

    document.getElementById("itemInfoOwnerName").textContent = owner.name || owner.email || "Пользователь";
    document.getElementById("itemInfoOwnerUsername").textContent = owner.username ? "@" + owner.username : "";
    document.getElementById("itemInfoValue").textContent = value;
    document.getElementById("itemInfoPrice").textContent = item.price ? "🪙 " + item.price + " SQ" : "—";

    if (boughtAt) {
      const d = new Date(boughtAt);
      document.getElementById("itemInfoDate").textContent =
        `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
    } else {
      document.getElementById("itemInfoDate").textContent = "Куплено давно";
    }

    modal.classList.add("active");
  }

  /* ============================================================
     ЛИЧНЫЙ ЧАТ
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
        description: "",
        photo: null,
        lastMsg: "",
        lastMsgAt: Date.now(),
        createdAt: Date.now()
      });
      if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(newRef.key);
      else showScreen("screen-messages");
    }
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
      if (unsubGifts) { unsubGifts(); unsubGifts = null; }
      if (unsubUser) { unsubUser(); unsubUser = null; }
      const chatId = window.Sqwid && window.Sqwid.getChatId ? window.Sqwid.getChatId() : null;
      if (chatId) showScreen("screen-messages");
      else showScreen("screen-chats");
    });
  }

  const btnItemInfoClose = document.getElementById("btnItemInfoClose");
  if (btnItemInfoClose) {
    btnItemInfoClose.addEventListener("click", () => {
      document.getElementById("modal-item-info").classList.remove("active");
    });
  }
  const btnGiftInfoClose = document.getElementById("btnGiftInfoClose");
  if (btnGiftInfoClose) {
    btnGiftInfoClose.addEventListener("click", () => {
      document.getElementById("modal-gift-info").classList.remove("active");
    });
  }

  console.log("✅ profileNN.js готов");
});