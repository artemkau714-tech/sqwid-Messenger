/* ============================================================
   chat-profile.js — экран профиля в стиле Telegram
   + QR-иконка в шапке
   + 3 кнопки: Выбрать фото / Изменить / Настройки
   + поля: Почта, @username, Сквидики
   + вкладки: Группы / Каналы
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
  const { db, ref, get, set, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 chat-profile.js активирован");

  let myData = {};
  let myChatsData = {};
  let activeTab = "groups";

  /* ============================================================
     ХЕЛПЕРЫ
     ============================================================ */
  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  /* ============================================================
     ПОДПИСКА НА СЕБЯ
     ============================================================ */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    renderProfile();
  });

  /* ============================================================
     ПОДПИСКА НА ЧАТЫ
     ============================================================ */
  onValue(ref(db, "chats"), (snap) => {
    myChatsData = snap.val() || {};
    renderTabContent();
  });

  /* ============================================================
     РЕНДЕР ПРОФИЛЯ
     ============================================================ */
  function renderProfile() {
    const name = myData.name || (currentUser.email || "").split("@")[0] || "Пользователь";

    /* ---- Имя ---- */
    const nameEl = document.getElementById("profileName");
    if (nameEl) {
      let nameHTML = "";
      let fontStyle = "";
      if (myData.nickFont === "bold") fontStyle += "font-weight:900;";
      if (myData.nickFont === "italic") fontStyle += "font-style:italic;";
      if (myData.nickFont === "mono") fontStyle += "font-family:'JetBrains Mono',monospace;";
      if (myData.nickFont === "script") fontStyle += "font-family:'Caveat',cursive;";

      if (myData.nickColor && typeof myData.nickColor === "string" && myData.nickColor.startsWith("linear-gradient")) {
        nameHTML += `<span style="display:inline-block;background:${myData.nickColor};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:800;${fontStyle}">${escH(name)}</span>`;
      } else if (myData.nickColor) {
        nameHTML += `<span style="color:${myData.nickColor};${fontStyle}">${escH(name)}</span>`;
      } else if (isPlus() && myData.plusGradient !== false) {
        nameHTML += `<span class="nick-plus" style="${fontStyle}">${escH(name)}</span>`;
      } else {
        nameHTML += `<span style="${fontStyle}">${escH(name)}</span>`;
      }

      if (myData.nickEmoji) nameHTML += ` <span class="nick-emoji">${myData.nickEmoji}</span>`;
      nameEl.innerHTML = nameHTML;
    }

    /* ---- @username ---- */
    const unEl = document.getElementById("profileUsername");
    if (unEl) {
      unEl.textContent = myData.username ? "@" + myData.username : "";
    }

    /* ---- Bio ---- */
    const bioEl = document.getElementById("profileBio");
    if (bioEl) bioEl.textContent = myData.bio || "";

    /* ---- Avatar ---- */
    const ava = document.getElementById("profileAva");
    if (ava) {
      if (myData.photo && myData.photo.startsWith("data:image")) {
        ava.innerHTML = `<img src="${myData.photo}" alt="">`;
      } else if (myData.photo && !myData.photo.startsWith("data:")) {
        ava.innerHTML = `<img src="${myData.photo}" alt="">`;
      } else {
        ava.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
      }
    }

    /* ---- Рамка авы ---- */
    const wrap = document.querySelector("#screen-profile .profile-ava-wrap");
    if (wrap) {
      wrap.classList.remove("frame-gold", "frame-fire", "frame-rainbow", "frame-plus");
      if (myData.avatarFrame) wrap.classList.add("frame-" + myData.avatarFrame);
      else if (isPlus()) wrap.classList.add("frame-plus");
    }

    /* ---- Поля информации ---- */
    const emailEl = document.getElementById("profileEmailValue");
    if (emailEl) emailEl.textContent = currentUser.email || "—";

    const unValEl = document.getElementById("profileUsernameValue");
    if (unValEl) unValEl.textContent = myData.username ? "@" + myData.username : "@—";

    const coinsEl = document.getElementById("profileCoinsValue");
    if (coinsEl) {
      const coins = myData.coins || 0;
      coinsEl.innerHTML = (window.Sqwid.coinIcon ? window.Sqwid.coinIcon(14) : "") + " " + coins.toLocaleString("ru-RU") + " SQ";
    }
  }

  /* ============================================================
     ВКЛАДКИ (Группы / Каналы)
     ============================================================ */
  document.querySelectorAll(".profile-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.toggle("active", b === btn));
      activeTab = btn.dataset.ptab;
      const g = document.getElementById("profileTabGroups");
      const c = document.getElementById("profileTabChannels");
      if (g) g.style.display = activeTab === "groups" ? "block" : "none";
      if (c) c.style.display = activeTab === "channels" ? "block" : "none";
    });
  });

  function renderTabContent() {
    const groupsList = document.getElementById("profileGroupsList");
    const channelsList = document.getElementById("profileChannelsList");
    const groupsEmpty = document.getElementById("profileGroupsEmpty");
    const channelsEmpty = document.getElementById("profileChannelsEmpty");

    if (!groupsList || !channelsList) return;
    groupsList.innerHTML = "";
    channelsList.innerHTML = "";

    const groups = [];
    const channels = [];
    for (const id in myChatsData) {
      const c = myChatsData[id];
      if (!c.members || !c.members[currentUser.uid]) continue;
      if (c.type === "group") groups.push({ id, ...c });
      else if (c.type === "channel") channels.push({ id, ...c });
    }

    function buildRow(c) {
      const row = document.createElement("div");
      row.className = "profile-group-row";
      const avatarContent = (c.photo && c.photo.startsWith("data:image"))
        ? `<img src="${c.photo}">`
        : escH((c.name || "?").charAt(0).toUpperCase());
      const badge = c.type === "channel" ? "📢 " : "";
      row.innerHTML = `
        <div class="profile-group-ava">${avatarContent}</div>
        <div class="profile-group-info">
          <div class="profile-group-name">${badge}${escH(c.name || "Без названия")}</div>
          <div class="profile-group-sub">${Object.keys(c.members || {}).length} участников</div>
        </div>
      `;
      row.addEventListener("click", () => {
        if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(c.id);
      });
      return row;
    }

    if (groups.length === 0) {
      if (groupsEmpty) groupsEmpty.style.display = "block";
    } else {
      if (groupsEmpty) groupsEmpty.style.display = "none";
      groups.forEach(c => groupsList.appendChild(buildRow(c)));
    }

    if (channels.length === 0) {
      if (channelsEmpty) channelsEmpty.style.display = "block";
    } else {
      if (channelsEmpty) channelsEmpty.style.display = "none";
      channels.forEach(c => channelsList.appendChild(buildRow(c)));
    }
  }

  /* ============================================================
     КНОПКИ
     ============================================================ */

  /* --- «Выбрать фото» → системный выбор файла --- */
  const btnPhoto = document.getElementById("btnProfilePhoto");
  const avatarInput = document.getElementById("profileAvatarInput");
  if (btnPhoto && avatarInput) {
    btnPhoto.addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        S.showToast("Фото до 500 КБ", "error");
        return;
      }
      const r = new FileReader();
      r.onload = async (ev) => {
        try {
          await update(ref(db, "users/" + currentUser.uid), { photo: ev.target.result });
          S.showToast("Фото обновлено", "ok");
        } catch (err) {
          S.showToast("Ошибка: " + err.message, "error");
        }
      };
      r.readAsDataURL(file);
      avatarInput.value = "";
    });
  }

  /* --- «Изменить» → подэкран «Аккаунт» --- */
  const btnEdit = document.getElementById("btnEditProfile");
  if (btnEdit) {
    btnEdit.addEventListener("click", () => {
      S.showScreen("screen-settings-account");
    });
  }

  /* --- «Настройки» → главный экран настроек --- */
  const btnSettings = document.getElementById("btnProfileSettings");
  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      S.showScreen("screen-settings");
    });
  }

  /* --- QR-иконка в шапке --- */
  const btnQr = document.getElementById("btnProfileQr");
  if (btnQr) {
    btnQr.addEventListener("click", () => {
      if (window.Sqwid && window.Sqwid.openQr) window.Sqwid.openQr();
      else S.showToast("QR загружается...", "info");
    });
  }

  /* --- Share в шапке --- */
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

  /* --- Бургер в шапке --- */
  const btnBurger = document.getElementById("btnBurgerFromProfile");
  if (btnBurger) {
    btnBurger.addEventListener("click", () => {
      const modal = document.getElementById("modal-profile-menu");
      if (!modal) {
        S.showScreen("screen-settings");
        return;
      }
      const isOwner = currentUser.email === "artemkau714@gmail.com";
      const isMod = myData && myData.role === "moderator";
      const pm = document.getElementById("pmOpenOwner");
      if (pm) pm.style.display = (isOwner || isMod) ? "block" : "none";
      modal.classList.add("active");
    });
  }

  console.log("✅ chat-profile.js готов");
});