/* ============================================================
   chat-profile.js — Мой профиль + Анонимный номер + Юзернеймы
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

  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    renderProfile();
  });

  onValue(ref(db, "chats"), (snap) => {
    myChatsData = snap.val() || {};
    renderTabContent();
  });

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

      if (myData.shopEquipped && myData.shopEquipped.badge && BADGE_SVG[myData.shopEquipped.badge]) {
        nameHTML += BADGE_SVG[myData.shopEquipped.badge];
      }
      if (myData.nickEmoji) nameHTML += ` <span class="nick-emoji">${myData.nickEmoji}</span>`;

      nameEl.innerHTML = nameHTML;
    }

    /* ---- Юзернеймы ---- */
    const mainUnEl = document.getElementById("profileMainUsername");
    const extraUnEl = document.getElementById("profileExtraUsernames");

    if (mainUnEl) {
      if (myData.username) {
        mainUnEl.textContent = "@" + myData.username;
        mainUnEl.style.color = "#3b82f6";
        mainUnEl.style.cursor = "pointer";
        mainUnEl.style.textDecoration = "underline";
        mainUnEl.onclick = () => openUsernameInfoModal(myData.username, myData);
      } else {
        mainUnEl.textContent = "Установить @username";
        mainUnEl.style.color = "var(--text-3)";
        mainUnEl.style.cursor = "pointer";
        mainUnEl.style.textDecoration = "none";
        mainUnEl.onclick = () => {
          if (window.Sqwid && window.Sqwid.showScreen) window.Sqwid.showScreen("screen-settings-account");
        };
      }
    }

    if (extraUnEl) {
      const purchased = myData.purchasedUsernames || {};
      const extraList = Object.keys(purchased);
      
      if (extraList.length > 0) {
        extraUnEl.innerHTML = `а также `;
        extraList.forEach((uname, index) => {
          const span = document.createElement("span");
          span.textContent = "@" + uname;
          span.style.cssText = "color: #3b82f6; font-weight: 600; cursor: pointer; text-decoration: underline; margin-right: 4px;";
          span.onclick = () => openUsernameInfoModal(uname, myData);
          extraUnEl.appendChild(span);
          
          if (index < extraList.length - 1) {
            extraUnEl.appendChild(document.createTextNode(", "));
          }
        });
        extraUnEl.style.display = "block";
      } else {
        extraUnEl.style.display = "none";
      }
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
      const frameValue = (myData.shopEquipped && myData.shopEquipped.frame) || myData.avatarFrame;
      if (frameValue) {
        wrap.classList.add("frame-" + frameValue);
      } else if (isPlus()) {
        wrap.classList.add("frame-plus");
      }
    }

    /* ---- ФОН ПРОФИЛЯ ---- */
    const scroll = document.getElementById("profileScroll");
    if (scroll) {
      const equippedBg = myData.shopEquipped && myData.shopEquipped.bg;
      
      if (myData.profileBg && isPlus()) {
        scroll.style.backgroundImage = `url(${myData.profileBg})`;
        scroll.style.backgroundSize = "cover";
        scroll.style.backgroundPosition = "center";
        scroll.style.backgroundRepeat = "no-repeat";
        scroll.classList.add("has-bg");
      } else if (equippedBg && BG_PRESETS[equippedBg]) {
        scroll.style.backgroundImage = BG_PRESETS[equippedBg];
        scroll.style.backgroundSize = "cover";
        scroll.style.backgroundPosition = "center";
        scroll.style.backgroundRepeat = "no-repeat";
        scroll.classList.add("has-bg");
      } else {
        scroll.style.backgroundImage = "";
        scroll.classList.remove("has-bg");
      }
    }

    /* ---- Поля информации ---- */
    const emailEl = document.getElementById("profileEmailValue");
    if (emailEl) emailEl.textContent = currentUser.email || "—";

    /* ---- Анонимный номер ---- */
    let phoneRow = document.getElementById("profilePhoneRow");
    if (!phoneRow) {
      const infoCard = document.querySelector("#screen-profile .profile-info-card");
      if (infoCard) {
        phoneRow = document.createElement("div");
        phoneRow.className = "profile-info-row";
        phoneRow.id = "profilePhoneRow";
        phoneRow.innerHTML = `
          <div class="profile-info-value" id="profilePhoneValue" style="cursor: pointer;">—</div>
          <div class="profile-info-label">Номер телефона</div>
        `;
        infoCard.appendChild(phoneRow);
      }
    }

    const phoneValEl = document.getElementById("profilePhoneValue");
    if (phoneValEl) {
      if (myData.phone) {
        phoneValEl.textContent = myData.phone;
        phoneValEl.style.color = "#10b981"; // Зеленый
        phoneValEl.style.cursor = "pointer";
        phoneValEl.style.textDecoration = "underline";
        
        // 🔥 ПРИ КЛИКЕ ОТКРЫВАЕМ МОДАЛКУ И ЗАПОЛНЯЕМ ТЕКУЩИЙ НОМЕР
        phoneValEl.onclick = () => {
          document.getElementById("changePhoneCurrent").value = myData.phone;
          document.getElementById("changePhoneNew").value = "";
          document.getElementById("changePhoneIfBusy").value = "";
          document.getElementById("changePhoneMessage").value = "";
          document.getElementById("modal-change-phone").classList.add("active");
        };
      } else {
        phoneValEl.textContent = "Придумайте ваш анонимный номер";
        phoneValEl.style.color = "#3b82f6"; // Синий
        phoneValEl.style.cursor = "pointer";
        phoneValEl.style.textDecoration = "none";
        phoneValEl.onclick = () => {
          document.getElementById("anonPhoneInput").value = "";
          document.getElementById("modal-anon-phone").classList.add("active");
        };
      }
    }

    const coinsEl = document.getElementById("profileCoinsValue");
    if (coinsEl) {
      const coins = myData.coins || 0;
      coinsEl.innerHTML = (window.Sqwid.coinIcon ? window.Sqwid.coinIcon(14) : "") + " " + coins.toLocaleString("ru-RU") + " SQ";
    }
  }

  /* ============================================================
     МОДАЛКА ИНФО О ЮЗЕРНЕЙМЕ
     ============================================================ */
  async function openUsernameInfoModal(uname, userData) {
    const modal = document.getElementById("modal-username-info");
    if (!modal) return;

    document.getElementById("unInfoName").textContent = "@" + uname;
    document.getElementById("unInfoOwner").textContent = userData.name || "Вы";

    const shopSnap = await get(ref(db, "usernames_shop"));
    const shop = shopSnap.val() || {};
    let shopItem = null;

    for (const id in shop) {
      if (shop[id].username === uname) {
        shopItem = shop[id];
        break;
      }
    }

    if (shopItem) {
      document.getElementById("unInfoPrice").textContent = (shopItem.price || 0).toLocaleString("ru-RU") + " SQ";
      if (shopItem.soldAt) {
        const d = new Date(shopItem.soldAt);
        document.getElementById("unInfoDate").textContent = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
      } else {
        document.getElementById("unInfoDate").textContent = "—";
      }
    } else {
      document.getElementById("unInfoPrice").textContent = "Основной";
      document.getElementById("unInfoDate").textContent = "—";
    }

    let rarity = "Обычный";
    let rarityColor = "#94a3b8";
    let rarityBg = "rgba(148, 163, 184, 0.15)";

    if (uname.length <= 3) {
      rarity = "Легендарный"; rarityColor = "#f59e0b"; rarityBg = "rgba(245, 158, 11, 0.15)";
    } else if (uname.length <= 5) {
      rarity = "Эпический"; rarityColor = "#a855f7"; rarityBg = "rgba(168, 85, 247, 0.15)";
    } else if (uname.length <= 7) {
      rarity = "Редкий"; rarityColor = "#3b82f6"; rarityBg = "rgba(59, 130, 246, 0.15)";
    }

    const rarEl = document.getElementById("unInfoRarity");
    rarEl.textContent = rarity;
    rarEl.style.color = rarityColor;
    rarEl.style.background = rarityBg;

    // 🔥 ПРИВЯЗКА КНОПКИ УЛУЧШЕНИЯ
    const btnUpgrade = document.getElementById("btnUpgradeUsernameInModal");
    if (btnUpgrade) {
      const newUpg = btnUpgrade.cloneNode(true);
      btnUpgrade.parentNode.replaceChild(newUpg, btnUpgrade);
      
      newUpg.style.display = "block";
      newUpg.onclick = () => {
        modal.classList.remove("active");
        if (window.Sqwid.openUpgradeModal) {
          window.Sqwid.openUpgradeModal(uname);
        } else {
          S.showToast("Рулетка загружается...", "info");
        }
      };
    }

    modal.classList.add("active");
  }

  const btnCloseUnInfo = document.getElementById("btnCloseUnInfo");
  if (btnCloseUnInfo) {
    const newBtn = btnCloseUnInfo.cloneNode(true);
    btnCloseUnInfo.parentNode.replaceChild(newBtn, btnCloseUnInfo);
    newBtn.addEventListener("click", () => {
      document.getElementById("modal-username-info").classList.remove("active");
    });
  }

  /* ============================================================
     СОХРАНЕНИЕ АНОНИМНОГО НОМЕРА
     ============================================================ */
  const btnSaveAnonPhone = document.getElementById("btnSaveAnonPhone");
  if (btnSaveAnonPhone) {
    const newBtn = btnSaveAnonPhone.cloneNode(true);
    btnSaveAnonPhone.parentNode.replaceChild(newBtn, btnSaveAnonPhone);
    
    newBtn.addEventListener("click", async () => {
      const input = document.getElementById("anonPhoneInput");
      const digits = input.value.replace(/\D/g, ""); // Оставляем только цифры

      if (digits.length !== 8) {
        return S.showToast("Введите ровно 8 цифр", "error");
      }

      const fullPhone = "+888" + digits;

      try {
        await update(ref(db, "users/" + currentUser.uid), { phone: fullPhone });
        S.showToast("Номер сохранен навсегда!", "ok");
        document.getElementById("modal-anon-phone").classList.remove("active");
      } catch (e) {
        S.showToast("Ошибка: " + e.message, "error");
      }
    });
  }

  const btnCancelAnonPhone = document.getElementById("btnCancelAnonPhone");
  if (btnCancelAnonPhone) {
    btnCancelAnonPhone.addEventListener("click", () => {
      document.getElementById("modal-anon-phone").classList.remove("active");
    });
  }

  /* ============================================================
     ОТПРАВКА ЗАЯВКИ НА СМЕНУ НОМЕРА
     ============================================================ */
  const btnSendPhoneRequest = document.getElementById("btnSendPhoneRequest");
  if (btnSendPhoneRequest) {
    const newBtn = btnSendPhoneRequest.cloneNode(true);
    btnSendPhoneRequest.parentNode.replaceChild(newBtn, btnSendPhoneRequest);
    
    newBtn.addEventListener("click", async () => {
      const curPhone = document.getElementById("changePhoneCurrent").value;
      let newPhone = document.getElementById("changePhoneNew").value.trim();
      const ifBusy = document.getElementById("changePhoneIfBusy").value.trim();
      const msg = document.getElementById("changePhoneMessage").value.trim();

      // Приводим к формату +888...
      newPhone = newPhone.replace(/\D/g, "");
      if (newPhone.length === 8) newPhone = "+888" + newPhone;
      else if (newPhone.length === 11 && newPhone.startsWith("888")) newPhone = "+888" + newPhone.slice(3);

      if (!newPhone || !/^\+888\d{8}$/.test(newPhone)) {
        return S.showToast("Введите желаемый номер в формате +888XXXXXXXX", "error");
      }

      // Формируем текст письма
      const emailBody = 
        `Здравствуйте! Я хочу изменить свой анонимный номер.\n\n` +
        `Текущий номер: ${curPhone}\n` +
        `Желаемый номер: ${newPhone}\n` +
        `Если номер занят: ${ifBusy || "(не указано)"}\n` +
        `Пожелания: ${msg || "(нет)"}\n\n` +
        `Мой ID: ${currentUser.uid}\n` +
        `Мой email: ${currentUser.email}`;

      const emailSubject = "Смена анонимного номера Sqwid";
      const mailto = `mailto:sqwid.support@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

      // Открываем почтовое приложение
      window.location.href = mailto;
      
      document.getElementById("modal-change-phone").classList.remove("active");
      S.showToast("Открываем почтовое приложение...", "info");
    });
  }

  const btnCancelPhoneRequest = document.getElementById("btnCancelPhoneRequest");
  if (btnCancelPhoneRequest) {
    btnCancelPhoneRequest.addEventListener("click", () => {
      document.getElementById("modal-change-phone").classList.remove("active");
    });
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
  const btnPhoto = document.getElementById("btnProfilePhoto");
  const avatarInput = document.getElementById("profileAvatarInput");
  if (btnPhoto && avatarInput) {
    btnPhoto.addEventListener("click", () => avatarInput.click());
    avatarInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) return S.showToast("Фото до 500 КБ", "error");
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

  const btnEdit = document.getElementById("btnEditProfile");
  if (btnEdit) btnEdit.addEventListener("click", () => S.showScreen("screen-settings-account"));

  const btnSettings = document.getElementById("btnProfileSettings");
  if (btnSettings) btnSettings.addEventListener("click", () => S.showScreen("screen-settings"));

  const btnQr = document.getElementById("btnProfileQr");
  if (btnQr) {
    btnQr.addEventListener("click", () => {
      if (window.Sqwid && window.Sqwid.openQr) window.Sqwid.openQr();
      else S.showToast("QR загружается...", "info");
    });
  }

  const btnShare = document.getElementById("btnShareProfile");
  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      const base = window.location.origin;
      const link = myData.username
        ? base + "/chat?u=" + myData.username
        : base + "/chat?uid=" + currentUser.uid;
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