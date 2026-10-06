/* ============================================================
   chat-profile.js — свой профиль (юзы, номера, подарки)
   ============================================================ */

console.log("🚀 chat-profile.js загружен, жду Sqwid...");

function waitForSqwidProfile(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ chat-profile.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidProfile((S) => {
  const { db, ref, get, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 chat-profile.js активирован");

  const scroll = document.getElementById("profileScroll");
  const ava = document.getElementById("profileAva");
  const nameEl = document.getElementById("profileName");
  const unEl = document.getElementById("profileUsername");
  const bioEl = document.getElementById("profileBio");
  const coinsEl = document.getElementById("profileCoins");
  const tabsEl = document.getElementById("profileTabs");
  const tabGifts = document.getElementById("profileTabGifts");
  const tabGroups = document.getElementById("profileTabGroups");
  const statChats = document.getElementById("profileStatChats");
  const statMessages = document.getElementById("profileStatMessages");
  const statPhotos = document.getElementById("profileStatPhotos");

  if (!scroll || !ava) {
    console.warn("❌ chat-profile.js: не найдены элементы профиля");
    return;
  }

  let activeTab = "gifts";
  let myData = {};
  let myGifts = {};
  let shopItems = [];

  /* ---------- ПАРАЛЛАКС ---------- */
  scroll.addEventListener("scroll", () => {
    const y = scroll.scrollTop;
    const scrolled = y > 40;
    ava.classList.toggle("scrolled", scrolled);
    if (nameEl) nameEl.classList.toggle("scrolled", scrolled);
    if (unEl) unEl.classList.toggle("scrolled", scrolled);
    if (bioEl) bioEl.classList.toggle("scrolled", scrolled);
    if (tabsEl) tabsEl.classList.toggle("visible", y > 80);
  });

  /* ---------- ТАБЫ ---------- */
  function applyTab() {
    if (tabGifts) tabGifts.classList.toggle("hidden", activeTab !== "gifts");
    if (tabGroups) tabGroups.classList.toggle("hidden", activeTab !== "groups");
  }
  applyTab();

  document.querySelectorAll(".profile-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".profile-tab").forEach(t => t.classList.toggle("active", t === tab));
      activeTab = tab.dataset.tab;
      applyTab();
    });
  });

  /* ---------- МАГАЗИН ---------- */
  onValue(ref(db, "shop/items"), (snap) => {
    const all = snap.val() || {};
    shopItems = Object.values(all);
    renderProfile();
  });

  /* ---------- ПРОФИЛЬ ---------- */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    renderProfile();
  });

  onValue(ref(db, "users/" + currentUser.uid + "/gifts"), (snap) => {
    myGifts = snap.val() || {};
    renderGifts();
  });

  function renderProfile() {
    const name = myData.name || currentUser.email.split("@")[0];

    let nameHTML = "";
    if (myData.nickColor) nameHTML += `<span style="color:${myData.nickColor}">${escH(name)}</span>`;
    else nameHTML += escH(name);
    if (myData.nickEmoji) nameHTML += ` <span class="nick-emoji">${myData.nickEmoji}</span>`;
    if (nameEl) nameEl.innerHTML = nameHTML;

    if (unEl) unEl.textContent = myData.username ? "@" + myData.username : "";
    if (bioEl) bioEl.textContent = myData.bio || "";
    if (coinsEl) coinsEl.textContent = "🪙 " + (myData.coins || 0) + " SQ";

    const wrap = document.querySelector("#screen-profile .profile-ava-wrap");
    if (wrap) {
      wrap.classList.remove("frame-gold", "frame-fire", "frame-rainbow");
      if (myData.avatarFrame) wrap.classList.add("frame-" + myData.avatarFrame);
    }

    if (ava) {
      if (myData.photo && myData.photo.startsWith("data:image")) {
        ava.innerHTML = `<img src="${myData.photo}" alt="">`;
      } else {
        ava.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
      }
    }

    renderOrbit();
    renderUsernames();
    renderPhones();
    loadStats();
  }

  /* ---------- ОРБИТА ---------- */
  const giftCache = {};
  onValue(ref(db, "shop/gifts"), (snap) => {
    const all = snap.val() || {};
    Object.keys(giftCache).forEach(k => delete giftCache[k]);
    Object.assign(giftCache, all);
    renderOrbit();
  });

  function renderOrbit() {
    const wrap = document.querySelector("#screen-profile .profile-ava-wrap");
    if (!wrap) return;
    const old = wrap.querySelector(".profile-gift-orbit");
    if (old) old.remove();

    const inv = myData.inventory || {};
    const allGiftIds = Object.keys(inv).filter(k => k.startsWith("gift_"));
    if (allGiftIds.length === 0) return;

    const orbit = document.createElement("div");
    orbit.className = "profile-gift-orbit";

    const giftSrc = {
      gift_roketa: "roketa.png",
      gift_starblue: "starblue.png",
      gift_stars: "stars.png",
      gift_demon: "demon.png"
    };

    let placed = 0;
    allGiftIds.slice(0, 6).forEach((id, i) => {
      const g = giftCache[id];
      let icon = null;
      if (g && g.icon) icon = g.icon;
      else if (giftSrc[id]) icon = giftSrc[id];
      if (!icon) return;

      const img = document.createElement("img");
      img.src = icon;
      img.style.setProperty("--radius", (75 + 8 * i) + "px");
      img.style.setProperty("--delay", (-i * 2) + "s");
      img.style.setProperty("--glow", (g && g.glow) || "#f7b500");
      orbit.appendChild(img);
      placed++;
    });

    if (placed > 0) wrap.appendChild(orbit);
  }

  /* ---------- ЮЗЕРНЕЙМЫ ---------- */
  function renderUsernames() {
    const section = document.getElementById("profileUsernamesSection");
    const list = document.getElementById("profileUsernamesList");
    if (!section || !list) return;
    list.innerHTML = "";

    const inv = myData.inventory || {};
    const names = new Set();
    if (myData.username) names.add(myData.username);

    for (const id in inv) {
      if (!inv[id]) continue;
      const item = shopItems.find(i => i.id === id);
      if (item && item.type === "username" && item.value) names.add(item.value);
    }

    if (names.size === 0) { section.style.display = "none"; return; }
    section.style.display = "block";

    names.forEach(uname => {
      const isMain = myData.username === uname;
      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = "@" + uname;
      chip.onclick = () => openItemInfo({
        value: "@" + uname,
        itemId: "uname_" + uname.toLowerCase(),
        ownerUid: currentUser.uid
      });
      list.appendChild(chip);
    });
  }

  /* ---------- НОМЕРА ---------- */
  function renderPhones() {
    const section = document.getElementById("profilePhonesSection");
    const list = document.getElementById("profilePhonesList");
    if (!section || !list) return;
    list.innerHTML = "";

    const inv = myData.inventory || {};
    const phones = new Set();
    if (myData.phone) phones.add(myData.phone);

    for (const id in inv) {
      if (!inv[id]) continue;
      const item = shopItems.find(i => i.id === id);
      if (item && item.type === "phone" && item.value) phones.add(item.value);
    }

    if (phones.size === 0) { section.style.display = "none"; return; }
    section.style.display = "block";

    phones.forEach(ph => {
      const isMain = myData.phone === ph;
      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = ph;
      chip.onclick = () => openItemInfo({
        value: ph,
        itemId: "phone_" + ph.replace(/\D/g, "").slice(-6),
        ownerUid: currentUser.uid
      });
      list.appendChild(chip);
    });
  }

  /* ---------- ПОДАРКИ ---------- */
  function renderGifts() {
    const grid = document.getElementById("profileGiftsGrid");
    const empty = document.getElementById("profileGiftsEmpty");
    if (!grid) return;
    grid.innerHTML = "";

    const arr = Object.values(myGifts);
    if (arr.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

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

  /* ---------- МОДАЛКА ИНФО О ПОДАРКЕ ---------- */
  async function openGiftInfo(g) {
    const modal = document.getElementById("modal-gift-info");
    if (!modal || !g) return;

    document.getElementById("giftInfoImage").src = g.icon || "sqwidstar.png";
    document.getElementById("giftInfoName").textContent = g.name || "Подарок";
    document.getElementById("giftInfoPrice").textContent = g.price ? "🪙 " + g.price + " SQ" : "—";

    const dateEl = document.getElementById("giftInfoDate");
    if (g.receivedAt) {
      const d = new Date(g.receivedAt);
      dateEl.textContent = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
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

  /* ---------- МОДАЛКА ИНФО О ЮЗЕ / НОМЕРЕ ---------- */
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

  /* ---------- ПЕРЕХОД В ЧУЖОЙ ПРОФИЛЬ ---------- */
  async function openOtherProfile(uid) {
    if (!uid || uid === currentUser.uid) {
      S.showScreen("screen-profile");
      return;
    }
    if (window.Sqwid && window.Sqwid.openOtherProfile) {
      window.Sqwid.openOtherProfile(uid);
      return;
    }

    const snap = await get(ref(db, "users/" + uid));
    const u = snap.val() || {};

    const avaEl = document.getElementById("upAva");
    if (avaEl) {
      if (u.photo && u.photo.startsWith("data:image")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
      } else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        avaEl.innerHTML = `<span>${letter}</span>`;
      }
    }
    const nameEl2 = document.getElementById("upName");
    if (nameEl2) nameEl2.textContent = u.name || u.email || "Пользователь";
    const unEl2 = document.getElementById("upUsername");
    if (unEl2) unEl2.textContent = u.username ? "@" + u.username : "";
    const bioEl2 = document.getElementById("upBio");
    if (bioEl2) bioEl2.textContent = u.bio || "";

    S.showScreen("screen-user-profile");
  }

  /* ---------- ГРУППЫ ---------- */
  onValue(ref(db, "chats"), (snap) => {
    const chats = snap.val() || {};
    const list = document.getElementById("profileGroupsList");
    const empty = document.getElementById("profileGroupsEmpty");
    if (!list) return;
    list.innerHTML = "";

    const common = [];
    for (const id in chats) {
      const c = chats[id];
      if (c.type !== "group" && c.type !== "channel") continue;
      if (!c.members || !c.members[currentUser.uid]) continue;
      common.push({ id, ...c });
    }

    if (common.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    common.forEach(c => {
      const row = document.createElement("div");
      row.className = "profile-group-row";
      const avatarContent = (c.photo && c.photo.startsWith("data:image"))
        ? `<img src="${c.photo}">`
        : escH((c.name || "?").charAt(0).toUpperCase());
      row.innerHTML = `
        <div class="profile-group-ava">${avatarContent}</div>
        <div class="profile-group-info">
          <div class="profile-group-name">${escH(c.name || "Группа")}</div>
          <div class="profile-group-sub">${Object.keys(c.members || {}).length} участников</div>
        </div>
      `;
      list.appendChild(row);
    });
  });

  /* ---------- СТАТИСТИКА ---------- */
  async function loadStats() {
    const chatsSnap = await get(ref(db, "chats"));
    const chats = chatsSnap.val() || {};
    let myChats = 0;
    for (const id in chats) {
      const c = chats[id];
      if (c.members && c.members[currentUser.uid]) myChats++;
    }
    if (statChats) statChats.textContent = myChats;

    const msgsSnap = await get(ref(db, "messages"));
    const allMsgs = msgsSnap.val() || {};
    let myMessages = 0, myPhotos = 0;
    for (const chatId in allMsgs) {
      const msgs = allMsgs[chatId] || {};
      for (const mid in msgs) {
        const m = msgs[mid];
        if (m.sender === currentUser.uid) {
          myMessages++;
          if (m.type === "photo") myPhotos++;
        }
      }
    }
    if (statMessages) statMessages.textContent = myMessages;
    if (statPhotos) statPhotos.textContent = myPhotos;
  }

  /* ---------- КНОПКИ ---------- */
  const btnShare = document.getElementById("btnShareProfile");
  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      const base = window.location.origin + window.location.pathname.replace("chat.html", "");
      const link = myData.username
        ? base + "chat.html?u=" + myData.username
        : base + "chat.html?uid=" + currentUser.uid;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(link);
          S.showAlert("Ссылка скопирована:\n" + link, "Готово");
        } else {
          S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
        }
      } catch (e) {
        S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
      }
    });
  }

  const btnEdit = document.getElementById("btnEditProfile");
  if (btnEdit) {
    btnEdit.addEventListener("click", () => S.showScreen("screen-settings"));
  }

  const btnBurger = document.getElementById("btnBurgerFromProfile");
  if (btnBurger) {
    btnBurger.addEventListener("click", () => S.showAlert("Меню скоро", "Инфо"));
  }

  /* ---------- ЗАКРЫТИЕ МОДАЛОК ---------- */
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

  /* ---------- УТИЛИТЫ ---------- */
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  console.log("✅ chat-profile.js готов");
});