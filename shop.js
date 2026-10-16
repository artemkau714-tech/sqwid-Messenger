/* ============================================================
   shop.js — магазин Sqwid (рамки, фоны, значки, ники, подарки за SQ)
   + Вкладка "Подарки" — берёт из window.GIFTS_CATALOG
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

  /* ============================================================
     ИКОНКА МОНЕТКИ
     ============================================================ */
  const COIN_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="7"/></svg>`;

  /* ============================================================
     КАТАЛОГ ТОВАРОВ (кроме подарков)
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
     РЕНДЕР ОБЫЧНОГО МАГАЗИНА
     ============================================================ */
  function renderShop() {
    const grid = document.getElementById("shopGrid");
    if (!grid) return;
    grid.innerHTML = "";

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

  console.log("✅ shop.js готов");
});