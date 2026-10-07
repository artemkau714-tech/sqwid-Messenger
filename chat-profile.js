/* ============================================================
   chat-profile.js — свой профиль (юзы, номера, подарки, обмен, игры)
   + Sqwid+ плюшки
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
  const { db, ref, get, set, push, update, remove, onValue, currentUser } = S;
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

  /* ---------- ХЕЛПЕР: активен ли Sqwid+ ---------- */
  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }

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
    const plus = isPlus();

    // Имя: градиент для Sqwid+ или обычный цвет
    let nameHTML = "";
    if (plus && myData.plusGradient !== false) {
      // Градиентный ник для Sqwid+
      nameHTML += `<span class="nick-plus">${escH(name)}</span>`;
    } else if (myData.nickColor) {
      nameHTML += `<span style="color:${myData.nickColor}">${escH(name)}</span>`;
    } else {
      nameHTML += escH(name);
    }
    if (myData.nickEmoji) nameHTML += ` <span class="nick-emoji">${myData.nickEmoji}</span>`;
    if (nameEl) nameEl.innerHTML = nameHTML;

    if (unEl) unEl.textContent = myData.username ? "@" + myData.username : "";

    // Bio: до 300 для Sqwid+
    if (bioEl) {
      bioEl.textContent = myData.bio || "";
      bioEl.classList.toggle("bio-long", plus);
    }

    if (coinsEl) coinsEl.textContent = "🪙 " + (myData.coins || 0) + " SQ";

    // Плашка Sqwid+
    renderPlusBadge(plus);

    // Кастомный фон профиля
    renderProfileBg(plus);

    // Рамка авы
    const wrap = document.querySelector("#screen-profile .profile-ava-wrap");
    if (wrap) {
      wrap.classList.remove("frame-gold", "frame-fire", "frame-rainbow", "frame-plus");
      if (myData.avatarFrame) wrap.classList.add("frame-" + myData.avatarFrame);
      else if (plus) wrap.classList.add("frame-plus");
    }

    if (ava) {
      if (myData.photo && myData.photo.startsWith("data:image")) {
        ava.innerHTML = `<img src="${myData.photo}" alt="">`;
      } else {
        ava.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
      }
    }

    renderSocial();
    renderOrbit();
    renderUsernames();
    renderPhones();
    loadStats();
  }

  /* ---------- ПЛАШКА SQWID+ ---------- */
  function renderPlusBadge(plus) {
    let badge = document.getElementById("profilePlusBadge");
    if (!plus) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "profilePlusBadge";
      badge.className = "plus-badge";
      const top = document.querySelector("#screen-profile .profile-top");
      if (top && bioEl) top.insertBefore(badge, bioEl.nextSibling);
    }
    const until = new Date(myData.plusUntil);
    const dateStr = `${String(until.getDate()).padStart(2, "0")}.${String(until.getMonth() + 1).padStart(2, "0")}.${until.getFullYear()}`;
    badge.innerHTML = `⭐ Sqwid+ до ${dateStr}`;
  }

  /* ---------- ФОН ПРОФИЛЯ (только Sqwid+) ---------- */
  function renderProfileBg(plus) {
    if (!scroll) return;
    if (plus && myData.profileBg) {
      scroll.style.backgroundImage = `url(${myData.profileBg})`;
      scroll.classList.add("has-bg");
    } else {
      scroll.style.backgroundImage = "";
      scroll.classList.remove("has-bg");
    }
  }

  /* ---------- СОЦИАЛЬНЫЕ ССЫЛКИ (только Sqwid+) ---------- */
  function renderSocial() {
  let box = document.getElementById("profileSocial");
  const plus = isPlus();
  if (!plus || !myData.socialLinks || Object.keys(myData.socialLinks).length === 0) {
    if (box) box.remove();
    return;
  }
  if (!box) {
    box = document.createElement("div");
    box.id = "profileSocial";
    box.className = "profile-social";
    const top = document.querySelector("#screen-profile .profile-top");
    const badge = document.getElementById("profilePlusBadge");
    if (top) {
      if (badge) top.insertBefore(box, badge.nextSibling);
      else top.appendChild(box);
    }
  }
  box.innerHTML = "";
  const links = myData.socialLinks;
  const icons = { telegram: "✈️", instagram: "📸", youtube: "▶️", tiktok: "🎵", vk: "🅥", github: "🐙", website: "🌐" };

  Object.entries(links).forEach(([key, url]) => {
    if (!url) return;

    // Валидация: только http/https
    const safe = sanitizeUrl(url);
    if (!safe) return; // пропускаем мусор

    const a = document.createElement("a");
    a.href = safe;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `${icons[key] || "🔗"} ${key}`;
    box.appendChild(a);
  });

  // Если после валидации ничего не осталось — убираем блок
  if (box.children.length === 0) box.remove();
}

  /* ---------- ОРБИТА ПОДАРКОВ ---------- */
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

    const plus = isPlus();
    const limit = plus ? 6 : 3; // Sqwid+: 6 подарков на орбите

    const orbit = document.createElement("div");
    orbit.className = "profile-gift-orbit" + (plus ? " orbit-plus" : "");

    const giftSrc = {
      gift_roketa: "roketa.png",
      gift_starblue: "starblue.png",
      gift_stars: "stars.png",
      gift_demon: "demon.png"
    };

    let placed = 0;
    allGiftIds.slice(0, limit).forEach((id, i) => {
      const g = giftCache[id];
      let icon = null;
      if (g && g.icon) icon = g.icon;
      else if (giftSrc[id]) icon = giftSrc[id];
      if (!icon) return;

      const img = document.createElement("img");
      img.src = icon;
      img.style.setProperty("--radius", (75 + 8 * i) + "px");
      img.style.setProperty("--delay", (-i * 2) + "s");
      img.style.setProperty("--glow", (g && g.glow) || "#f59e0b");
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
      let itemId = null;
      for (const id in inv) {
        if (!inv[id]) continue;
        const it = shopItems.find(i => i.id === id);
        if (it && it.type === "username" && it.value === uname) { itemId = id; break; }
      }

      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = "@" + uname;
      chip.onclick = () => openItemInfo({
        value: "@" + uname,
        itemId: itemId || ("uname_" + uname.toLowerCase()),
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
      let itemId = null;
      for (const id in inv) {
        if (!inv[id]) continue;
        const it = shopItems.find(i => i.id === id);
        if (it && it.type === "phone" && it.value === ph) { itemId = id; break; }
      }

      const chip = document.createElement("div");
      chip.className = "up-chip" + (isMain ? " is-main" : "");
      chip.textContent = ph;
      chip.onclick = () => openItemInfo({
        value: ph,
        itemId: itemId || ("phone_" + ph.replace(/\D/g, "").slice(-6)),
        ownerUid: currentUser.uid
      });
      list.appendChild(chip);
    });
  }

  /* ---------- ПОДАРКИ С ОБМЕНОМ ---------- */
  function renderGifts() {
    const grid = document.getElementById("profileGiftsGrid");
    const empty = document.getElementById("profileGiftsEmpty");
    if (!grid) return;
    grid.innerHTML = "";

    const arr = Object.entries(myGifts).map(([gid, g]) => ({ gid, ...g }));
    if (arr.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    arr.forEach(g => {
      if (!g) return;
      const card = document.createElement("div");
      card.className = "profile-gift-card";

      const canExchange = canExchangeGift(g);
      const timeLeft = canExchange ? getExchangeTimeLeft(g) : "";

      let exchangeBtn = "";
      if (canExchange) {
        exchangeBtn = `<button class="profile-gift-exchange" data-exchange="${g.gid}">🔄 ${timeLeft}</button>`;
      }

      card.innerHTML = `
        <img src="${g.icon}" alt="">
        <div class="profile-gift-name">${escH(g.name || "Подарок")}</div>
        ${exchangeBtn}
      `;

      card.onclick = (e) => {
        if (e.target.dataset.exchange) return;
        openGiftInfo(g);
      };

      const btn = card.querySelector("[data-exchange]");
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          openExchangeModal(g.gid, g);
        };
      }

      grid.appendChild(card);
    });
  }

  function canExchangeGift(g) {
    if (!g || !g.receivedAt || g.exchanged) return false;
    if (!g.price || g.price <= 0) return false;
    const age = Date.now() - g.receivedAt;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return age < sevenDays;
  }

  function getExchangeTimeLeft(g) {
    const age = Date.now() - g.receivedAt;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const left = sevenDays - age;
    if (left <= 0) return "0д";
    const days = Math.floor(left / (24 * 60 * 60 * 1000));
    const hours = Math.floor((left % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return days + "д";
    if (hours > 0) return hours + "ч";
    return "<1ч";
  }

  /* ---------- МОДАЛКА ОБМЕНА ---------- */
  let exchangeGiftId = null;
  let exchangeGiftData = null;

  function openExchangeModal(giftId, gift) {
    if (!canExchangeGift(gift)) {
      S.showToast("Срок обмена истёк", "error");
      return;
    }

    exchangeGiftId = giftId;
    exchangeGiftData = gift;

    const price = gift.price || 0;
    const plus = isPlus();
    // Sqwid+: 60% вместо 50%
    const percent = plus ? 0.6 : 0.5;
    const back = Math.floor(price * percent);

    document.getElementById("exGiftImage").src = gift.icon || "sqwidstar.png";
    document.getElementById("exGiftName").textContent = gift.name || "Подарок";
    document.getElementById("exGiftPrice").textContent = price + " SQ";
    document.getElementById("exGiftBack").textContent = "+" + back + " SQ" + (plus ? " (60%)" : "");
    document.getElementById("exGiftBurn").textContent = "-" + (price - back) + " SQ";

    document.getElementById("modal-exchange-gift").classList.add("active");
  }

  const btnExCancel = document.getElementById("btnExchangeCancel");
  if (btnExCancel) btnExCancel.addEventListener("click", () => {
    document.getElementById("modal-exchange-gift").classList.remove("active");
    exchangeGiftId = null;
    exchangeGiftData = null;
  });

  const btnExConfirm = document.getElementById("btnExchangeConfirm");
  if (btnExConfirm) btnExConfirm.addEventListener("click", async () => {
    if (!exchangeGiftId || !exchangeGiftData) return;

    const gift = exchangeGiftData;
    const price = gift.price || 0;
    const plus = isPlus();
    const percent = plus ? 0.6 : 0.5;
    const back = Math.floor(price * percent);

    try {
      const meSnap = await get(ref(db, "users/" + currentUser.uid));
      const me = meSnap.val() || {};
      const newCoins = (me.coins || 0) + back;

      await update(ref(db, "users/" + currentUser.uid), { coins: newCoins });

      await update(ref(db, "users/" + currentUser.uid + "/gifts/" + exchangeGiftId), {
        exchanged: true,
        exchangedAt: Date.now(),
        exchangeBack: back,
        exchangeBurn: price - back
      });

      const gidToDelete = exchangeGiftId;
      setTimeout(async () => {
        await remove(ref(db, "users/" + currentUser.uid + "/gifts/" + gidToDelete));
      }, 1000);

      if (gift.fromUid && gift.hideName !== true) {
        const botRef = push(ref(db, "botChat/" + gift.fromUid));
        await set(botRef, {
          from: "Sqwid Moderator",
          text: `🔄 Подарок «${gift.name}», который вы подарили, был обменян получателем.`,
          timestamp: Date.now(),
          type: "system",
          kind: "moderator"
        });
      }

      S.showToast("+" + back + " SQ зачислено" + (plus ? " (Sqwid+ бонус)" : ""), "ok");

    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    } finally {
      document.getElementById("modal-exchange-gift").classList.remove("active");
      exchangeGiftId = null;
      exchangeGiftData = null;
    }
  });

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
          if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(g.fromUid);
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
      row.style.cursor = "pointer";
      const avatarContent = (c.photo && c.photo.startsWith("data:image"))
        ? `<img src="${c.photo}">`
        : escH((c.name || "?").charAt(0).toUpperCase());
      const badge = c.type === "channel" ? "📢 " : "";
      row.innerHTML = `
        <div class="profile-group-ava">${avatarContent}</div>
        <div class="profile-group-info">
          <div class="profile-group-name">${badge}${escH(c.name || "Группа")}</div>
          <div class="profile-group-sub">${Object.keys(c.members || {}).length} участников</div>
        </div>
      `;
      row.addEventListener("click", () => {
        if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(c.id);
      });
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
  const btnGames = document.getElementById("btnOpenGames");
  if (btnGames) {
    btnGames.addEventListener("click", () => {
      if (window.Sqwid && typeof window.Sqwid.openGames === "function") {
        window.Sqwid.openGames();
      } else {
        S.showToast("Игровой бот не загрузился", "error");
      }
    });
  }

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
    btnBurger.addEventListener("click", () => {
      const modal = document.getElementById("modal-profile-menu");
      if (!modal) {
        S.showAlert("Меню скоро", "Инфо");
        return;
      }
      const isOwner = currentUser.email === "artemkau714@gmail.com";
      const isMod = myData && myData.role === "moderator";
      const pm = document.getElementById("pmOpenOwner");
      if (pm) pm.style.display = (isOwner || isMod) ? "block" : "none";
      modal.classList.add("active");
    });
  }

  /* ---------- ЭКСПОРТ ЧАТОВ (Sqwid+) ---------- */
  async function exportChats() {
    if (!isPlus()) {
      S.showToast("Экспорт доступен только с Sqwid+", "warn");
      return;
    }
    try {
      S.showToast("Готовим экспорт…", "info");
      const chatsSnap = await get(ref(db, "chats"));
      const chats = chatsSnap.val() || {};
      const msgsSnap = await get(ref(db, "messages"));
      const allMsgs = msgsSnap.val() || {};

      const myChats = {};
      for (const id in chats) {
        const c = chats[id];
        if (!c.members || !c.members[currentUser.uid]) continue;
        myChats[id] = {
          name: c.name,
          type: c.type,
          createdAt: c.createdAt,
          members: c.members,
          messages: allMsgs[id] || {}
        };
      }

      const dataStr = JSON.stringify({ user: currentUser.uid, exportedAt: Date.now(), chats: myChats }, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sqwid_export_" + Date.now() + ".json";
      a.click();
      URL.revokeObjectURL(url);
      S.showToast("Экспорт готов", "ok");
    } catch (e) {
      S.showToast("Ошибка экспорта: " + e.message, "error");
    }
  }
  window.Sqwid.exportChats = exportChats;

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
  console.log("✅ chat-profile.js готов");
});