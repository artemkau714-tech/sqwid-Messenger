/* ============================================================
   shop.js — магазин Sqwid (рамки, фоны, значки, ники, юзернеймы, подарки)
   ============================================================ */

console.log("🚀 shop.js загружен, жду Sqwid...");

function waitForSqwidShop(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ shop.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidShop((S) => {
  const { db, ref, get, set, push, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 shop.js активирован");

  let myData = {};
  let currentTab = "frames";
  let unsubSelf = null;
  let shopUsernames = {}; // Хранилище для юзернеймов

  /* ============================================================
     ИКОНКА МОНЕТКИ
     ============================================================ */
  const COIN_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="7"/></svg>`;

  /* ============================================================
     КАТАЛОГ ТОВАРОВ (кроме подарков и юзернеймов)
     ============================================================ */
  const CATALOG = {
    frames: [
      { id: "frame_gold",    name: "Золотая",    price: 5000,  type: "frame", value: "gold" },
      { id: "frame_fire",    name: "Огненная",   price: 5000,  type: "frame", value: "fire" },
      { id: "frame_rainbow", name: "Радуга",     price: 15000, type: "frame", value: "rainbow" },
      { id: "frame_plus",    name: "Sqwid+",     price: 0,     type: "frame", value: "plus", onlyPlus: true }
    ],
    backgrounds: [
      { id: "bg_sunset", name: "Закат",  price: 3000,  type: "bg", value: "sunset" },
      { id: "bg_ocean",  name: "Океан",  price: 3000,  type: "bg", value: "ocean" },
      { id: "bg_night",  name: "Ночь",   price: 5000,  type: "bg", value: "night" },
      { id: "bg_forest", name: "Лес",    price: 5000,  type: "bg", value: "forest" },
      { id: "bg_space",  name: "Космос", price: 10000, type: "bg", value: "space" }
    ],
    badges: [
      { id: "badge_star",    name: "Звезда", price: 2000,  type: "badge", value: "star" },
      { id: "badge_crown",   name: "Корона", price: 10000, type: "badge", value: "crown" },
      { id: "badge_fire",    name: "Огонь",  price: 7000,  type: "badge", value: "fire" },
      { id: "badge_diamond", name: "Алмаз",  price: 20000, type: "badge", value: "diamond" }
    ],
    nicks: [
      { id: "nick_gradient_gold",  name: "Золотой градиент", price: 8000, type: "nickColor", value: "linear-gradient(135deg, #f59e0b, #ffd966, #f59e0b)" },
      { id: "nick_gradient_ocean", name: "Океан",            price: 8000, type: "nickColor", value: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
      { id: "nick_gradient_fire",  name: "Огонь",            price: 8000, type: "nickColor", value: "linear-gradient(135deg, #f97316, #ef4444)" },
      { id: "nick_color_red",      name: "Красный",          price: 3000, type: "nickColor", value: "#ef4444" },
      { id: "nick_color_blue",     name: "Синий",            price: 3000, type: "nickColor", value: "#3b82f6" },
      { id: "nick_color_green",    name: "Зелёный",          price: 3000, type: "nickColor", value: "#10b981" }
    ]
  };

  /* ============================================================
     ПОДПИСКА НА СЕБЯ
     ============================================================ */
  if (unsubSelf) unsubSelf();
  unsubSelf = onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    updateBalance();
    const screen = document.getElementById("screen-shop");
    if (screen && screen.classList.contains("active")) {
      if (currentTab === "gifts") renderGiftsTab();
      else renderShop();
    }
  });

  // Подписка на юзернеймы
  onValue(ref(db, "usernames_shop"), (snap) => {
    shopUsernames = snap.val() || {};
    const screen = document.getElementById("screen-shop");
    if (screen && screen.classList.contains("active") && currentTab === "usernames") {
      renderShop();
    }
  });

  function updateBalance() {
    const el = document.getElementById("shopBalance");
    if (!el) return;
    const coins = myData.coins || 0;
    el.innerHTML = window.Sqwid.coinIcon ? window.Sqwid.coinIcon(12) + coins + " SQ" : coins + " SQ";
  }

  /* ============================================================
     ОТКРЫТИЕ / ЗАКРЫТИЕ
     ============================================================ */
  function openShop() {
    updateBalance();
    currentTab = "frames";
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t.dataset.shopTab === "frames"));
    renderShop();
    S.showScreen("screen-shop");
  }
  window.Sqwid.openShop = openShop;

  const btnOpenShop = document.getElementById("btnOpenShop");
  if (btnOpenShop) btnOpenShop.addEventListener("click", openShop);

  const btnBackShop = document.getElementById("btnBackShop");
  if (btnBackShop) btnBackShop.addEventListener("click", () => S.showScreen("screen-profile"));

  /* ============================================================
     ВКЛАДКИ
     ============================================================ */
  document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t === tab));
      currentTab = tab.dataset.shopTab;

      if (currentTab === "gifts") {
        renderGiftsTab();
      } else {
        renderShop();
      }
    });
  });

  /* ============================================================
     РЕНДЕР МАГАЗИНА
     ============================================================ */
  function renderShop() {
    const grid = document.getElementById("shopGrid");
    if (!grid) return;
    grid.innerHTML = "";

    // ================= ВКЛАДКА ЮЗЕРНЕЙМЫ =================
    if (currentTab === "usernames") {
      // Показываем кнопку добавления, если мы админ или модер
      const isAdmin = window.Sqwid.isAdminOrModerator && window.Sqwid.isAdminOrModerator();
      
      const listContainer = document.createElement("div");
      listContainer.className = "us-shop-list";
      listContainer.style.gridColumn = "1 / -1";

      if (isAdmin) {
        const adminBtn = document.createElement("button");
        adminBtn.className = "btn-create";
        adminBtn.innerHTML = "➕ Выставить юзернейм на продажу";
        adminBtn.style.marginBottom = "1rem";
        adminBtn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)"; // Синий для админки
        adminBtn.onclick = () => {
          document.getElementById("adminUnInput").value = "";
          document.getElementById("adminUnPrice").value = "10000";
          document.getElementById("adminUnDesc").value = "";
          document.getElementById("modal-admin-add-username").classList.add("active");
        };
        listContainer.appendChild(adminBtn);
      }

      const items = Object.values(shopUsernames).sort((a, b) => {
        if (a.sold !== b.sold) return a.sold ? 1 : -1;
        return (a.price || 0) - (b.price || 0);
      });

      if (items.length === 0) {
        listContainer.innerHTML += '<div class="create-empty" style="text-align:center;padding:2rem;">Пока нет юзернеймов на продаже</div>';
      } else {
        items.forEach(item => {
          const card = document.createElement("div");
          card.className = "us-card" + (item.sold ? " us-sold" : "");

          const isOwner = item.sold && item.soldTo === currentUser.uid;
          let btnHTML = "";

          if (item.sold) {
            btnHTML = `<button class="us-btn us-btn-sold" disabled>${isOwner ? "✓ Куплено" : "Продано"}</button>`;
          } else {
            btnHTML = `<button class="us-btn us-btn-buy" data-id="${item.id}">${COIN_ICON} ${(item.price || 0).toLocaleString("ru-RU")} SQ</button>`;
          }

          card.innerHTML = `
            <div class="us-card-left">
              <div class="us-username">@${item.username}</div>
              ${item.description ? `<div class="us-desc">${item.description}</div>` : ""}
            </div>
            ${btnHTML}
          `;

          if (!item.sold) {
            card.querySelector("[data-id]").addEventListener("click", () => buyUsername(item.id));
          }
          listContainer.appendChild(card);
        });
      }
      grid.appendChild(listContainer);
      return; // Выходим, чтобы не рендерить стандартные карточки
    }

    // ================= СТАНДАРТНЫЕ ТОВАРЫ =================
    const items = CATALOG[currentTab] || [];
    const owned = myData.shopOwned || {};
    const equipped = myData.shopEquipped || {};

    items.forEach(item => {
      const isOwned = owned[item.id] === true;
      const isEquipped = equipped[item.type] === item.value;
      const isPlusOnly = item.onlyPlus && !(myData.plusUntil && myData.plusUntil > Date.now());

      const card = document.createElement("div");
      card.className = "shop-card" + (isOwned ? " owned" : "");

      let previewHTML = buildPreview(item);
      let btnHTML = "";

      if (isPlusOnly) {
        btnHTML = `<button class="shop-card-btn buy" disabled style="opacity:0.5;">Только Sqwid+</button>`;
      } else if (isEquipped) {
        btnHTML = `<button class="shop-card-btn equipped" data-action="unequip" data-item-id="${item.id}">Снять</button>`;
      } else if (isOwned) {
        btnHTML = `<button class="shop-card-btn equip" data-action="equip" data-item-id="${item.id}">Применить</button>`;
      } else {
        btnHTML = `<button class="shop-card-btn buy" data-action="buy" data-item-id="${item.id}">${COIN_ICON} ${item.price}</button>`;
      }

      card.innerHTML = `
        <div class="shop-card-preview">${previewHTML}</div>
        <div class="shop-card-name">${item.name}</div>
        ${btnHTML}
      `;

      grid.appendChild(card);
    });

    grid.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        const itemId = btn.dataset.itemId;
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        if (action === "buy") await buyItem(item);
        else if (action === "equip") await equipItem(item);
        else if (action === "unequip") await unequipItem(item);
      });
    });
  }

  /* ============================================================
     ПОКУПКА ЮЗЕРНЕЙМА
     ============================================================ */
  async function buyUsername(itemId) {
    const item = shopUsernames[itemId];
    if (!item || item.sold) return;

    const price = item.price || 0;
    const myCoins = myData.coins || 0;

    if (myCoins < price) {
      S.showAlert(`Недостаточно Сквидиков.\nНужно: ${price.toLocaleString("ru-RU")} SQ\nУ тебя: ${myCoins.toLocaleString("ru-RU")} SQ`, "Мало монет");
      return;
    }

    const ok = await S.showConfirm(`Купить @${item.username} за ${price.toLocaleString("ru-RU")} SQ?`, "Покупка");
    if (!ok) return;

    try {
      const purchased = { ...(myData.purchasedUsernames || {}) };
      purchased[item.username] = { boughtAt: Date.now() };

      // Списываем баланс и записываем юзернейм в профиль
      await update(ref(db, "users/" + currentUser.uid), {
        coins: myCoins - price,
        purchasedUsernames: purchased
      });

      // Помечаем как проданный
      await update(ref(db, "usernames_shop/" + itemId), {
        sold: true,
        soldTo: currentUser.uid,
        soldAt: Date.now()
      });

      // Уведомление в бот-чат
      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Username Shop",
        text: `🏷 Ты купил(а) юзернейм @${item.username}\nОн появится в твоём профиле.\nПотрачено: ${price.toLocaleString("ru-RU")} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "username_shop"
      });

      S.showToast("Юзернейм куплен!", "ok");
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  }

  /* ============================================================
     ДОБАВЛЕНИЕ ЮЗЕРНЕЙМА АДМИНОМ
     ============================================================ */
  const btnAdminSubmit = document.getElementById("btnAdminSubmitUsername");
  if (btnAdminSubmit) {
    btnAdminSubmit.addEventListener("click", async () => {
      const unInput = document.getElementById("adminUnInput");
      const priceInput = document.getElementById("adminUnPrice");
      const descInput = document.getElementById("adminUnDesc");
      const catInput = document.getElementById("adminUnCategory");

      const username = unInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      const price = parseInt(priceInput.value) || 0;
      const desc = descInput.value.trim();
      const category = catInput.value;

      if (username.length < 2 || username.length > 20) {
        return S.showToast("Юзернейм: 2-20 символов (a-z, 0-9, _)", "error");
      }
      if (price < 100) {
        return S.showToast("Цена должна быть не менее 100 SQ", "error");
      }

      // Проверка: не занят ли уже пользователем
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      for (const uid in users) {
        if (users[uid].username && users[uid].username.toLowerCase() === username) {
          return S.showToast("Этот юзернейм уже занят пользователем!", "error");
        }
      }

      // Проверка: нет ли уже в магазине
      for (const id in shopUsernames) {
        if (shopUsernames[id].username === username && !shopUsernames[id].sold) {
          return S.showToast("Этот юзернейм уже есть в магазине!", "error");
        }
      }

      try {
        const newRef = push(ref(db, "usernames_shop"));
        await set(newRef, {
          id: newRef.key,
          username,
          price,
          description: desc,
          category,
          addedBy: currentUser.uid,
          addedAt: Date.now(),
          sold: false
        });
        
        S.showToast("Юзернейм выставлен на продажу", "ok");
        document.getElementById("modal-admin-add-username").classList.remove("active");
      } catch(e) {
        S.showToast("Ошибка: " + e.message, "error");
      }
    });
  }

  const btnAdminCancel = document.getElementById("btnAdminCancelUsername");
  if (btnAdminCancel) {
    btnAdminCancel.addEventListener("click", () => {
      document.getElementById("modal-admin-add-username").classList.remove("active");
    });
  }

  /* ============================================================
     ПРЕВЬЮ
     ============================================================ */
  function buildPreview(item) {
    if (item.type === "frame") {
      return `<div class="frame-preview frame-${item.value}"><div>?</div></div>`;
    }
    if (item.type === "bg") {
      const bgColors = {
        sunset: "linear-gradient(135deg, #f97316, #ec4899)",
        ocean:  "linear-gradient(135deg, #06b6d4, #3b82f6)",
        night:  "linear-gradient(135deg, #1e1b4b, #312e81)",
        forest: "linear-gradient(135deg, #10b981, #047857)",
        space:  "radial-gradient(circle, #1e1b4b, #000)"
      };
      return `<div class="bg-preview" style="background:${bgColors[item.value] || '#ccc'};width:70px;height:70px;border-radius:12px;border:2px solid var(--border);"></div>`;
    }
    if (item.type === "badge") {
      const badgeIcons = {
        star:    '<svg viewBox="0 0 24 24" width="42" height="42" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        crown:   '<svg viewBox="0 0 24 24" width="42" height="42" fill="#f59e0b"><path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/></svg>',
        fire:    '<svg viewBox="0 0 24 24" width="42" height="42" fill="#f97316"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/></svg>',
        diamond: '<svg viewBox="0 0 24 24" width="42" height="42" fill="#06b6d4"><path d="M6 2l-4 6 10 14L22 8l-4-6z"/></svg>'
      };
      return `<div style="width:70px;height:70px;display:flex;align-items:center;justify-content:center;">${badgeIcons[item.value] || ""}</div>`;
    }
    if (item.type === "nickColor") {
      const grad = item.value.startsWith("linear") ? item.value : `linear-gradient(135deg, ${item.value}, ${item.value})`;
      return `<div style="width:100%;height:100%;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:24px;">Aa</div>`;
    }
    return `<div style="color:#94a3b8;">?</div>`;
  }

  /* ============================================================
     КУПИТЬ / ПРИМЕНИТЬ / СНЯТЬ (обычные товары)
     ============================================================ */
  async function buyItem(item) {
    const coins = myData.coins || 0;
    if (coins < item.price) {
      S.showToast("Недостаточно SQ. У вас: " + coins, "error");
      return;
    }

    const ok = await S.showConfirm(`Купить «${item.name}» за ${item.price} SQ?`, "Покупка");
    if (!ok) return;

    try {
      const newCoins = coins - item.price;
      const newOwned = { ...(myData.shopOwned || {}) };
      newOwned[item.id] = true;

      await update(ref(db, "users/" + currentUser.uid), {
        coins: newCoins,
        shopOwned: newOwned
      });

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Shop",
        text: `Куплено: ${item.name} за ${item.price} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "shop"
      });

      S.showToast(`Куплено: ${item.name}`, "ok");
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  }

  async function equipItem(item) {
    const newEquipped = { ...(myData.shopEquipped || {}) };
    newEquipped[item.type] = item.value;

    const updates = { shopEquipped: newEquipped };
    if (item.type === "frame") updates.avatarFrame = item.value;
    if (item.type === "nickColor") updates.nickColor = item.value;
    if (item.type === "bg") updates.profileBgPreset = item.value;

    await update(ref(db, "users/" + currentUser.uid), updates);
    S.showToast("Применено", "ok");
  }

  async function unequipItem(item) {
    const newEquipped = { ...(myData.shopEquipped || {}) };
    delete newEquipped[item.type];

    const updates = { shopEquipped: newEquipped };
    if (item.type === "frame") updates.avatarFrame = null;
    if (item.type === "nickColor") updates.nickColor = null;
    if (item.type === "bg") updates.profileBgPreset = null;

    await update(ref(db, "users/" + currentUser.uid), updates);
    S.showToast("Снято", "ok");
  }

  /* ============================================================
     ВКЛАДКА "ПОДАРКИ"
     ============================================================ */
  function renderGiftsTab() {
    const grid = document.getElementById("shopGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const catalog = window.GIFTS_CATALOG || [];

    if (catalog.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-3);">Подарки загружаются...</div>';
      return;
    }

    const owned = myData.giftsOwned || {};

    catalog.forEach(gift => {
      const isOwned = owned[gift.id];
      const card = document.createElement("div");
      card.className = "shop-card gift-shop-card" + (isOwned ? " owned" : "");

      card.innerHTML = `
        <div class="gift-shop-preview">${gift.svg}</div>
        <div class="shop-card-name">${gift.name}</div>
        <div class="gift-shop-desc">${gift.desc || ""}</div>
        <button class="shop-card-btn ${isOwned ? 'equipped' : 'buy'}" data-gift-id="${gift.id}" ${isOwned ? 'disabled' : ''}>
          ${isOwned ? '✓ Куплено' : `
            <svg width="12" height="12"><use href="#ico-coin"/></svg>
            ${gift.price}
          `}
        </button>
      `;

      if (!isOwned) {
        const btn = card.querySelector("[data-gift-id]");
        btn.addEventListener("click", () => buyGiftFromShop(gift));
      }

      grid.appendChild(card);
    });
  }

  async function buyGiftFromShop(gift) {
    const coins = myData.coins || 0;

    if (coins < gift.price) {
      S.showToast("Недостаточно SQ. Нужно: " + gift.price, "error");
      return;
    }

    const ok = await S.showConfirm("Купить «" + gift.name + "» за " + gift.price + " SQ?", "Покупка");
    if (!ok) return;

    try {
      const newOwned = { ...(myData.giftsOwned || {}) };
      newOwned[gift.id] = { boughtAt: Date.now() };

      await update(ref(db, "users/" + currentUser.uid), {
        coins: coins - gift.price,
        giftsOwned: newOwned
      });

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Shop",
        text: `🎁 Куплен подарок: ${gift.name} за ${gift.price} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "shop"
      });

      S.showToast("Куплено: " + gift.name, "ok");
      setTimeout(renderGiftsTab, 300);
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  }
/* ============================================================
   УПРАВЛЕНИЕ ЮЗЕРНЕЙМАМИ (ДЛЯ АДМИНОВ)
   ============================================================ */

// Проверка на админа
function isAdmin() {
  if (!window._currentUserData) return false;
  return currentUser.email === "artemkau714@gmail.com" || window._currentUserData.role === "moderator";
}

// Показать кнопку в развлечениях, если админ
const adminBtn = document.getElementById("adminOpenUsernameManager");
if (adminBtn) {
  // Ждем загрузки данных юзера
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    const data = snap.val() || {};
    const isMod = data.role === "moderator" || currentUser.email === "artemkau714@gmail.com";
    if (isMod) {
      adminBtn.style.display = "block";
    } else {
      adminBtn.style.display = "none";
    }
  });

  adminBtn.addEventListener("click", () => {
    renderAdminShopList();
    S.showScreen("screen-admin-usernames");
  });
}

const btnBackAdmin = document.getElementById("btnBackAdminUsernames");
if (btnBackAdmin) {
  btnBackAdmin.addEventListener("click", () => S.showScreen("screen-settings-fun"));
}

// Рендер списка в админке
function renderAdminShopList() {
  const list = document.getElementById("adminShopList");
  if (!list) return;
  list.innerHTML = "";

  const items = Object.values(shopUsernames).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  if (items.length === 0) {
    list.innerHTML = '<div class="create-empty">В магазине пока нет юзернеймов</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "owner-user-row";
    const statusColor = item.sold ? "#10b981" : "#f59e0b";
    const statusText = item.sold ? "ПРОДАН" : "В ПРОДАЖЕ";
    
    row.innerHTML = `
      <div class="owner-user-info" style="flex:1;">
        <div class="owner-user-name">
          @${item.username}
          <span class="owner-user-badge" style="background:${statusColor}22;color:${statusColor};">${statusText}</span>
        </div>
        <div class="owner-user-sub">💰 ${(item.price || 0).toLocaleString("ru-RU")} SQ · ${item.category || "custom"}</div>
      </div>
      <button class="btn-secondary" data-del-un="${item.id}" style="width:auto;padding:0.4rem 0.75rem;font-size:1rem;color:#ef4444;font-weight:bold;">✕</button>
    `;

    const delBtn = row.querySelector(`[data-del-un]`);
    if (delBtn) {
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await S.showConfirm(`Удалить @${item.username} из магазина?`, "Удаление");
        if (!ok) return;
        await remove(ref(db, "usernames_shop/" + item.id));
        S.showToast("Удалено", "ok");
      });
    }

    list.appendChild(row);
  });
}
// Обработчик добавления (ИСПРАВЛЕННЫЙ - точная проверка через get)
const btnSubmitAdmin = document.getElementById("btnAdminSubmitUsername");
if (btnSubmitAdmin) {
  btnSubmitAdmin.addEventListener("click", async () => {
    const unInput = document.getElementById("adminUnInput");
    const priceInput = document.getElementById("adminUnPrice");
    const descInput = document.getElementById("adminUnDesc");
    const catInput = document.getElementById("adminUnCategory");
    const statusEl = document.getElementById("adminUnStatus");

    const username = unInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const price = parseInt(priceInput.value) || 0;
    const desc = descInput.value.trim();
    const category = catInput.value;

    if (username.length < 2 || username.length > 20) {
      return S.showToast("Юзернейм: 2-20 символов (a-z, 0-9, _)", "error");
    }
    if (price < 100) {
      return S.showToast("Цена должна быть не менее 100 SQ", "error");
    }

    if (statusEl) {
      statusEl.textContent = "Проверяем...";
      statusEl.style.color = "var(--accent)";
    }

    try {
      // 1. ПРЯМОЙ ЗАПРОС В БАЗУ (игнорируем кеш)
      const freshShopSnap = await get(ref(db, "usernames_shop"));
      const freshShop = freshShopSnap.val() || {};

      // Проверяем, нет ли уже в магазине (среди тех, что НЕ проданы)
      for (const id in freshShop) {
        if (freshShop[id].username === username && freshShop[id].sold !== true) {
          if (statusEl) statusEl.textContent = "";
          return S.showToast("Этот юзернейм уже есть в магазине!", "error");
        }
      }

      // 2. ПРОВЕРКА, НЕ ЗАНЯТ ЛИ ПОЛЬЗОВАТЕЛЕМ
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      for (const uid in users) {
        if (users[uid].username && users[uid].username.toLowerCase() === username) {
          if (statusEl) statusEl.textContent = "";
          return S.showToast("Этот юзернейм уже занят пользователем!", "error");
        }
      }

      // 3. ДОБАВЛЯЕМ
      const newRef = push(ref(db, "usernames_shop"));
      await set(newRef, {
        id: newRef.key,
        username: username,
        price: price,
        description: desc,
        category: category,
        addedBy: currentUser.uid,
        addedAt: Date.now(),
        sold: false // Жестко ставим false
      });
      
      unInput.value = "";
      descInput.value = "";
      if (statusEl) {
        statusEl.textContent = "✅ Юзернейм добавлен!";
        statusEl.style.color = "#10b981";
        setTimeout(() => { statusEl.textContent = ""; }, 3000);
      }

      // Обновляем список внизу экрана админа
      renderAdminShopList();
      S.showToast("Юзернейм выставлен в магазин", "ok");

    } catch(e) {
      if (statusEl) statusEl.textContent = "";
      // Если вылезает ошибка (например, с classList), показываем ее в тосте
      S.showToast("Ошибка: " + e.message, "error");
    }
  });
}
  console.log("✅ shop.js готов");
});