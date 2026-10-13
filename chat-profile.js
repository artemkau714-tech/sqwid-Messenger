/* ============================================================
   chat-profile.js — свой профиль (статистика, группы)
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

  let activeTab = "groups";
  let myData = {};
  let myChatsData = {};

  /* ---------- ХЕЛПЕР: активен ли Sqwid+ ---------- */
  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }

  /* ---------- ПРЕСЕТЫ ФОНА (из магазина) ---------- */
  const BG_PRESETS = {
    sunset: "linear-gradient(135deg, #f97316, #ec4899)",
    ocean:  "linear-gradient(135deg, #06b6d4, #3b82f6)",
    night:  "linear-gradient(135deg, #1e1b4b, #312e81)",
    forest: "linear-gradient(135deg, #10b981, #047857)",
    space:  "radial-gradient(circle at 50% 30%, #1e1b4b, #000)"
  };

  /* ---------- ЗНАЧКИ (из магазина) ---------- */
  const BADGE_SVG = {
    star:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" style="vertical-align:middle;margin-left:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    crown:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" style="vertical-align:middle;margin-left:4px;"><path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/></svg>`,
    fire:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f97316" style="vertical-align:middle;margin-left:4px;"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/></svg>`,
    diamond: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#06b6d4" style="vertical-align:middle;margin-left:4px;"><path d="M6 2l-4 6 10 14L22 8l-4-6z"/></svg>`
  };

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

  /* ---------- ПРОФИЛЬ ---------- */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    renderProfile();
  });

  function renderProfile() {
    const name = myData.name || currentUser.email.split("@")[0];
    const plus = isPlus();

    // Имя: градиент для Sqwid+, градиент/цвет из магазина, или обычный
    let nameHTML = "";
    let fontStyle = "";
    if (myData.nickFont === "bold") fontStyle += "font-weight:900;";
    if (myData.nickFont === "italic") fontStyle += "font-style:italic;";
    if (myData.nickFont === "mono") fontStyle += "font-family:'JetBrains Mono',monospace;";
    if (myData.nickFont === "script") fontStyle += "font-family:'Caveat',cursive;";

    if (myData.nickColor && typeof myData.nickColor === "string" && myData.nickColor.startsWith("linear-gradient")) {
      // Градиент из магазина
      nameHTML += `<span style="display:inline-block;background:${myData.nickColor};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:800;${fontStyle}">${escH(name)}</span>`;
    } else if (myData.nickColor) {
      // Сплошной цвет из магазина
      nameHTML += `<span style="color:${myData.nickColor};${fontStyle}">${escH(name)}</span>`;
    } else if (plus && myData.plusGradient !== false) {
      // Sqwid+ градиент
      nameHTML += `<span class="nick-plus" style="${fontStyle}">${escH(name)}</span>`;
    } else {
      nameHTML += `<span style="${fontStyle}">${escH(name)}</span>`;
    }

    if (myData.nickEmoji) nameHTML += ` <span class="nick-emoji">${myData.nickEmoji}</span>`;

    // Значок из магазина
    if (myData.shopEquipped && myData.shopEquipped.badge && BADGE_SVG[myData.shopEquipped.badge]) {
      nameHTML += BADGE_SVG[myData.shopEquipped.badge];
    }

    if (nameEl) nameEl.innerHTML = nameHTML;

    if (unEl) unEl.textContent = myData.username ? "@" + myData.username : "";

    // Bio: до 300 для Sqwid+
    if (bioEl) {
      bioEl.textContent = myData.bio || "";
      bioEl.classList.toggle("bio-long", plus);
    }

    // Баланс — как есть, без форматирования
    if (coinsEl) coinsEl.innerHTML = window.Sqwid.coinIcon(16) + (myData.coins || 0) + " SQ";

    // Плашка Sqwid+
    renderPlusBadge(plus);

    // Фон профиля (файл или пресет)
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
      } else if (myData.photo && !myData.photo.startsWith("data:")) {
        ava.innerHTML = `<img src="${myData.photo}" alt="">`;
      } else {
        ava.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
      }
    }

    renderSocial();
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

  /* ---------- ФОН ПРОФИЛЯ ---------- */
  function renderProfileBg(plus) {
    if (!scroll) return;

    // 1) Загруженный фон (Sqwid+)
    if (plus && myData.profileBg) {
      scroll.style.backgroundImage = `url(${myData.profileBg})`;
      scroll.style.backgroundSize = "cover";
      scroll.style.backgroundPosition = "center";
      scroll.style.backgroundRepeat = "no-repeat";
      scroll.classList.add("has-bg");
      return;
    }

    // 2) Пресет из магазина
    const preset = myData.profileBgPreset && BG_PRESETS[myData.profileBgPreset];
    if (preset) {
      scroll.style.backgroundImage = preset;
      scroll.style.backgroundSize = "cover";
      scroll.style.backgroundPosition = "center";
      scroll.style.backgroundRepeat = "no-repeat";
      scroll.classList.add("has-bg");
      return;
    }

    // 3) Ничего
    scroll.style.backgroundImage = "";
    scroll.classList.remove("has-bg");
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
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `${icons[key] || "🔗"} ${key}`;
      box.appendChild(a);
    });
  }

  /* ---------- ГРУППЫ ---------- */
  onValue(ref(db, "chats"), (snap) => {
    myChatsData = snap.val() || {};
    renderGroups();
  });

  function renderGroups() {
    const list = document.getElementById("profileGroupsList");
    const empty = document.getElementById("profileGroupsEmpty");
    if (!list) return;
    list.innerHTML = "";

    const common = [];
    for (const id in myChatsData) {
      const c = myChatsData[id];
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
  }

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

  /* ============================================================
     КНОПКИ МАГАЗИНА И QR
     ============================================================ */
  const btnOpenShop = document.getElementById("btnOpenShop");
  if (btnOpenShop) {
    btnOpenShop.addEventListener("click", () => {
      if (window.Sqwid && window.Sqwid.openShop) {
        window.Sqwid.openShop();
      } else {
        S.showToast("Магазин загружается...", "info");
      }
    });
  }

  const btnOpenQr = document.getElementById("btnOpenQr");
  if (btnOpenQr) {
    btnOpenQr.addEventListener("click", () => {
      if (window.Sqwid && window.Sqwid.openQr) {
        window.Sqwid.openQr();
      } else {
        S.showToast("QR-код загружается...", "info");
      }
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