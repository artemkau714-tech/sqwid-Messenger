/* ============================================================
   profileNN.js — профиль собеседника
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

    const avaEl = document.getElementById("upAva");
    if (avaEl) {
      if (u.photo && u.photo.startsWith("data:image")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
      } else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        avaEl.innerHTML = `<span>${escH(letter)}</span>`;
      }
    }
    const nameEl = document.getElementById("upName");
    if (nameEl) {
      let nameHTML = escH(u.name || u.email || "Пользователь");
      if (u.verified) nameHTML += ` <img src="verify.png" style="width:16px;height:16px;vertical-align:middle;margin-left:4px;">`;
      nameEl.innerHTML = nameHTML;
    }
    const unEl = document.getElementById("upUsername");
    if (unEl) unEl.textContent = u.username ? "@" + u.username : "";
    const bioEl = document.getElementById("upBio");
    if (bioEl) bioEl.textContent = u.bio || "";

    /* Кнопка "Написать" */
    const btnWrite = document.getElementById("btnUpWrite");
    if (btnWrite) {
      btnWrite.onclick = () => openPrivateChatWith(uid, u.name || u.email || "Пользователь");
    }

    /* Кнопка "Подарить" */
    const btnGift = document.getElementById("btnUpGift");
    if (btnGift) {
      btnGift.onclick = () => {
        if (window.Sqwid && typeof window.Sqwid.openGiftScreen === "function") {
          window.Sqwid.openGiftScreen(uid);
        } else {
          showScreen("screen-give-gift");
        }
      };
    }

    /* Кнопка "Пожаловаться" */
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

    renderGifts(uid);
    subscribeUser(uid);
    renderUsernames(uid, u);
    renderPhones(uid, u);

    showScreen("screen-user-profile");
  }

  if (window.Sqwid) window.Sqwid.openOtherProfile = openOtherProfile;

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
        const nameEl = document.getElementById("upName");
        if (nameEl) {
          let nameHTML = escH(viewingUserName);
          if (fresh.verified) nameHTML += ` <img src="verify.png" style="width:16px;height:16px;vertical-align:middle;margin-left:4px;">`;
          nameEl.innerHTML = nameHTML;
        }
        const unEl = document.getElementById("upUsername");
        if (unEl) unEl.textContent = fresh.username ? "@" + fresh.username : "";
        const bioEl = document.getElementById("upBio");
        if (bioEl) bioEl.textContent = fresh.bio || "";
        renderUsernames(uid, fresh);
        renderPhones(uid, fresh);
      }
    });
  }

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
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#00a884"/><text x="50%" y="55%" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${letter}</text></svg>`;
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

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  console.log("✅ profileNN.js готов");
});