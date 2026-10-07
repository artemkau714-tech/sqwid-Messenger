/* ============================================================
   shop.js — магазин, маркет, инвентарь
   + Sqwid+ скидка 10%
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
  const { db, ref, get, set, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 shop.js активирован");

  let shopItems = [];
  let currentUserData = {};
  let pendingSellItem = null;

  /* ---------- Базовые товары ---------- */
  const BASE_ITEMS = [
    { id: "nickColor_gold",   name: "Золотой ник",     price: 100, type: "nickColor", value: "#f59e0b", icon: "🎨", preview: "Цвет: золото" },
    { id: "nickColor_red",    name: "Красный ник",     price: 100, type: "nickColor", value: "#ef4444", icon: "🎨", preview: "Цвет: красный" },
    { id: "nickColor_blue",   name: "Синий ник",       price: 100, type: "nickColor", value: "#3b82f6", icon: "🎨", preview: "Цвет: синий" },
    { id: "nickColor_purple", name: "Фиолетовый ник",  price: 150, type: "nickColor", value: "#8b5cf6", icon: "🎨", preview: "Цвет: фиолетовый" },
    { id: "emoji_fire",       name: "Огненный значок", price: 150, type: "emoji", value: "🔥", icon: "🔥", preview: "Значок рядом с именем" },
    { id: "emoji_diamond",    name: "Алмаз",           price: 200, type: "emoji", value: "💎", icon: "💎", preview: "Значок рядом с именем" },
    { id: "emoji_crown",      name: "Корона",          price: 250, type: "emoji", value: "👑", icon: "👑", preview: "Значок рядом с именем" },
    { id: "frame_gold",       name: "Золотая рамка",   price: 200, type: "frame", value: "gold",    icon: "🖼", preview: "Золотое кольцо вокруг авы" },
    { id: "frame_fire",       name: "Огненная рамка",  price: 300, type: "frame", value: "fire",    icon: "🖼", preview: "Огненное кольцо вокруг авы" },
    { id: "frame_rainbow",    name: "Радужная рамка",  price: 500, type: "frame", value: "rainbow", icon: "🖼", preview: "Радужное кольцо вокруг авы" }
  ];

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
  }

  /* ---------- ХЕЛПЕР: активен ли Sqwid+ ---------- */
  function isPlus() {
    return currentUserData.plusUntil && currentUserData.plusUntil > Date.now();
  }

  /* ---------- Цена с учётом Sqwid+ ---------- */
  function getPrice(item) {
    if (!item || typeof item.price !== "number") return 0;
    return isPlus() ? Math.floor(item.price * 0.9) : item.price;
  }

  /* ---------- Подписка на профиль ---------- */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    currentUserData = snap.val() || {};
    const scr = document.getElementById("screen-shop");
    if (scr && scr.classList.contains("active")) renderShop();
  });

  /* ---------- Подписка на каталог ---------- */
  onValue(ref(db, "shop/items"), (snap) => {
    const all = snap.val() || {};
    shopItems = BASE_ITEMS.concat(Object.values(all));
    const scr = document.getElementById("screen-shop");
    if (scr && scr.classList.contains("active")) renderShop();
  });

  /* ---------- Открытие магазина ---------- */
  function openShop() {
    renderShop();
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "shop"));
    document.getElementById("shopTabShop").style.display = "block";
    document.getElementById("shopTabMarket").style.display = "none";
    document.getElementById("shopTabMy").style.display = "none";
    S.showScreen("screen-shop");
  }

  function openInventory() {
    renderInventory();
    S.showScreen("screen-inventory");
  }

  window.Sqwid.openShop = openShop;
  window.Sqwid.openInventory = openInventory;

  /* ---------- Вкладки ---------- */
  document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.getElementById("shopTabShop").style.display = target === "shop" ? "block" : "none";
      document.getElementById("shopTabMarket").style.display = target === "market" ? "block" : "none";
      document.getElementById("shopTabMy").style.display = target === "my" ? "block" : "none";
      if (target === "market") renderMarket();
      if (target === "my") renderMyUsernames();
    });
  });

  /* ---------- Рендер магазина ---------- */
  async function renderShop() {
    const balanceEl = document.getElementById("shopBalance");
    if (balanceEl) balanceEl.textContent = "🪙 " + (currentUserData.coins || 0) + " SQ";
    const balanceBig = document.getElementById("shopBalanceBig");
    if (balanceBig) balanceBig.textContent = "🪙 " + (currentUserData.coins || 0) + " SQ";

    await renderShopGrid("shopGridNicks", shopItems.filter(i => i.type === "nickColor"));
    await renderShopGrid("shopGridEmojis", shopItems.filter(i => i.type === "emoji"));
    await renderShopGrid("shopGridFrames", shopItems.filter(i => i.type === "frame"));
    await renderShopGrid("shopGridUsernames", shopItems.filter(i => i.type === "username" && !i.isVip));
    await renderShopGrid("shopGridVip", shopItems.filter(i => i.type === "username" && i.isVip));
    await renderShopGrid("shopGridPhones", shopItems.filter(i => i.type === "phone"));
  }

  /* ---------- Превью (живой пример) ---------- */
  function buildPreviewHTML(item) {
    const myName = currentUserData.name || "Имя";
    const firstLetter = myName.charAt(0).toUpperCase();
    const avaSrc = currentUserData.photo && currentUserData.photo.startsWith("data:image")
      ? currentUserData.photo
      : null;

    if (item.type === "nickColor") {
      return `<span style="color:${item.value};font-weight:700;font-size:14px;">${escapeHtml(myName)}</span>`;
    }
    if (item.type === "emoji") {
      return `<span style="font-size:13px;color:#0f172a;">${escapeHtml(myName)}</span> <span style="font-size:14px;">${item.value}</span>`;
    }
    if (item.type === "frame") {
      const frameClass = "frame-" + item.value;
      const inner = avaSrc
        ? `<img src="${avaSrc}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;display:block;">`
        : `<span style="display:flex;width:26px;height:26px;border-radius:50%;background:#6366f1;color:#fff;font-size:12px;font-weight:700;align-items:center;justify-content:center;">${escapeHtml(firstLetter)}</span>`;
      return `<span class="avatar-frame-wrap ${frameClass}" style="display:inline-flex;padding:2px;border-radius:50%;">
        <span style="display:inline-flex;border-radius:50%;border:2px solid #fff;overflow:hidden;">${inner}</span>
      </span>`;
    }
    if (item.type === "username") {
      return `<span style="color:#10b981;font-family:'JetBrains Mono',monospace;font-size:13px;">@${escapeHtml(item.value)}</span>`;
    }
    if (item.type === "phone") {
      return `<span style="color:#10b981;font-family:'JetBrains Mono',monospace;font-size:13px;">${escapeHtml(item.value)}</span>`;
    }
    return `<span style="color:#475569;font-size:12px;">${escapeHtml(item.preview || "")}</span>`;
  }

  /* ---------- Сетка товаров ---------- */
  async function renderShopGrid(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const inv = currentUserData.inventory || {};
    const plus = isPlus();

    const allUsers = (await get(ref(db, "users"))).val() || {};
    const takenUsernames = {};
    const takenPhones = {};
    for (const uid in allUsers) {
      if (allUsers[uid].username) takenUsernames[allUsers[uid].username] = uid;
      if (allUsers[uid].phone) takenPhones[allUsers[uid].phone] = uid;
    }

    items.forEach(item => {
      const owned = inv[item.id] === true;
      let isEquipped = false;
      if (item.type === "nickColor") isEquipped = currentUserData.nickColor === item.value;
      else if (item.type === "emoji") isEquipped = currentUserData.nickEmoji === item.value;
      else if (item.type === "frame") isEquipped = currentUserData.avatarFrame === item.value;
      else if (item.type === "username") isEquipped = currentUserData.username === item.value;
      else if (item.type === "phone") isEquipped = currentUserData.phone === item.value;

      let sold = false;
      if (item.type === "username" && takenUsernames[item.value] && takenUsernames[item.value] !== currentUser.uid) sold = true;
      if (item.type === "phone" && takenPhones[item.value] && takenPhones[item.value] !== currentUser.uid) sold = true;

      const el = document.createElement("div");
      el.className = "shop-item" + (sold ? " sold" : "");
      let btnHTML = "", btnClass = "";
      if (!sold) {
        if (isEquipped) { btnHTML = "✓ Активен"; btnClass = "equipped"; }
        else if (owned) { btnHTML = "Куплено"; btnClass = "owned"; }
        else btnHTML = "Купить";
      }

      const previewHTML = buildPreviewHTML(item);
      const displayPrice = getPrice(item);
      const oldPrice = item.price;
      const discountTag = plus ? ` <span style="color:#f59e0b;font-size:11px;font-weight:800;">−10%</span>` : "";
      const oldPriceHTML = plus && oldPrice !== displayPrice
        ? `<span style="color:#94a3b8;font-size:11px;text-decoration:line-through;margin-left:6px;">${oldPrice} SQ</span>`
        : "";

      el.innerHTML = `
        <div class="shop-item-icon" style="background:transparent;padding:0;">
          ${previewHTML}
        </div>
        <div class="shop-item-info">
          <div class="shop-item-name">${escapeHtml(item.name)}</div>
          <div class="shop-item-preview">${escapeHtml(item.preview)}</div>
          <div class="shop-item-price">🪙 ${displayPrice} SQ${discountTag}${oldPriceHTML}</div>
        </div>
        ${!sold ? `<button class="shop-item-btn ${btnClass}">${btnHTML}</button>` : ""}`;

      const btn = el.querySelector(".shop-item-btn");
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!owned) buyItem(item);
          else if (!isEquipped) equipItem(item);
        };
      }
      container.appendChild(el);
    });
  }

  /* ---------- Покупка (с Sqwid+ скидкой) ---------- */
  async function buyItem(item) {
    const plus = isPlus();
    const finalPrice = getPrice(item);
    const coins = currentUserData.coins || 0;

    if (coins < finalPrice) {
      return S.showAlert(
        "Недостаточно SQ.\nНужно: " + finalPrice +
        (plus ? " (Sqwid+ −10%)" : "") +
        "\nУ вас: " + coins,
        "Мало монет"
      );
    }

    const title = plus
      ? `Купить «${item.name}» за ${finalPrice} SQ?\n\n⭐ Sqwid+ скидка −10% (обычная цена ${item.price} SQ)`
      : `Купить «${item.name}» за ${finalPrice} SQ?`;

    const ok = await S.showConfirm(title, "Покупка");
    if (!ok) return;

    const updates = { coins: coins - finalPrice };
    updates["inventory/" + item.id] = true;
    if (item.type === "username") updates.username = item.value;
    else if (item.type === "phone") updates.phone = item.value;

    try {
      await update(ref(db, "users/" + currentUser.uid), updates);
      S.showAlert("Куплено: " + item.name + (plus ? "\n\nСэкономлено " + (item.price - finalPrice) + " SQ ⭐" : ""), "Готово");
      renderShop();
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  }

  /* ---------- Надеть ---------- */
  async function equipItem(item) {
    const updates = {};
    if (item.type === "nickColor") updates.nickColor = item.value;
    else if (item.type === "emoji") updates.nickEmoji = item.value;
    else if (item.type === "frame") updates.avatarFrame = item.value;
    else if (item.type === "username") updates.username = item.value;
    else if (item.type === "phone") updates.phone = item.value;
    try {
      await update(ref(db, "users/" + currentUser.uid), updates);
      renderShop();
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  }

  /* ---------- Маркет ---------- */
  async function renderMarket() {
    const grid = document.getElementById("marketGrid");
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Загрузка...</div>';
    const listings = (await get(ref(db, "market"))).val() || {};
    grid.innerHTML = "";
    const ids = Object.keys(listings);
    if (ids.length === 0) {
      grid.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#94a3b8;">Пока никто не продаёт юзернеймы</div>';
      return;
    }
    ids.forEach(itemId => {
      const listing = listings[itemId];
      const item = shopItems.find(i => i.id === itemId) || { id: itemId, icon: "🏷" };
      const isOwn = listing.sellerUid === currentUser.uid;
      const el = document.createElement("div");
      el.className = "shop-item on-sale";
      el.innerHTML = `
        <div class="shop-item-icon">${item.icon || "🏷"}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">@${escapeHtml(listing.username)}</div>
          <div class="shop-item-preview">Продавец: ${escapeHtml(listing.sellerName || "—")}</div>
          <div class="shop-item-price">🪙 ${listing.price} SQ</div>
        </div>
        ${!isOwn ? '<button class="shop-item-btn buy-market">Купить</button>' : '<button class="shop-item-btn sell" data-cancel="1">Снять</button>'}`;
      if (!isOwn) el.querySelector(".buy-market").addEventListener("click", () => buyFromMarket(itemId, listing, item));
      else el.querySelector("[data-cancel]").addEventListener("click", () => cancelListing(itemId));
      grid.appendChild(el);
    });
  }

  async function buyFromMarket(itemId, listing, item) {
    const coins = currentUserData.coins || 0;
    if (coins < listing.price) return S.showAlert("Недостаточно SQ", "Мало монет");
    const ok = await S.showConfirm("Купить @" + listing.username + " за " + listing.price + " SQ?", "Покупка");
    if (!ok) return;
    try {
      await update(ref(db, "users/" + currentUser.uid), {
        coins: coins - listing.price,
        ["inventory/" + itemId]: true,
        username: listing.username
      });
      const sellerCoins = (await get(ref(db, "users/" + listing.sellerUid + "/coins"))).val() || 0;
      await update(ref(db, "users/" + listing.sellerUid), {
        coins: sellerCoins + listing.price,
        ["inventory/" + itemId]: null,
        username: null
      });
      await remove(ref(db, "market/" + itemId));
      S.showAlert("Куплено: @" + listing.username, "Готово");
      renderMarket();
      renderShop();
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  }

  async function cancelListing(itemId) {
    const ok = await S.showConfirm("Снять лот с продажи?", "Отмена продажи");
    if (!ok) return;
    await remove(ref(db, "market/" + itemId));
    renderMarket();
    renderMyUsernames();
  }

  /* ---------- Мои юзы ---------- */
  async function renderMyUsernames() {
    const grid = document.getElementById("myUsernamesGrid");
    grid.innerHTML = "";
    const inv = currentUserData.inventory || {};
    const myNames = shopItems.filter(i => i.type === "username" && inv[i.id] === true);
    if (myNames.length === 0) {
      grid.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#94a3b8;">У вас нет купленных юзернеймов</div>';
      return;
    }
    const listings = (await get(ref(db, "market"))).val() || {};
    myNames.forEach(item => {
      const isActive = currentUserData.username === item.value;
      const onSale = listings[item.id] !== undefined;
      const el = document.createElement("div");
      el.className = "shop-item" + (isActive ? " on-sale" : "");
      let statusText = isActive ? "● Активен" : onSale ? "🏪 На продаже" : "Не активен";
      el.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">@${escapeHtml(item.value)}</div>
          <div class="shop-item-preview">${statusText}</div>
        </div>
        ${!onSale ? '<button class="shop-item-btn sell">Продать</button>' : '<button class="shop-item-btn sell" data-cancel="1">Снять</button>'}`;
      if (!onSale) el.querySelector(".sell").addEventListener("click", () => openSellModal(item));
      else el.querySelector("[data-cancel]").addEventListener("click", () => cancelListing(item.id));
      grid.appendChild(el);
    });
  }

  function openSellModal(item) {
    pendingSellItem = item;
    document.getElementById("sellItemName").textContent = "@" + item.value;
    document.getElementById("sellPrice").value = item.price || 1000;
    document.getElementById("modal-sell").classList.add("active");
  }

  document.getElementById("btnSellCancel").addEventListener("click", () => {
    document.getElementById("modal-sell").classList.remove("active");
    pendingSellItem = null;
  });

  document.getElementById("btnSellConfirm").addEventListener("click", async () => {
    if (!pendingSellItem) return;
    const price = parseInt(document.getElementById("sellPrice").value);
    if (isNaN(price) || price <= 0) return S.showAlert("Введи цену больше 0", "Ошибка");
    try {
      await set(ref(db, "market/" + pendingSellItem.id), {
        sellerUid: currentUser.uid,
        sellerName: currentUserData.name || currentUser.email,
        username: pendingSellItem.value,
        price: price,
        listedAt: Date.now()
      });
      document.getElementById("modal-sell").classList.remove("active");
      S.showAlert("@" + pendingSellItem.value + " выставлен за " + price + " SQ", "Готово");
      pendingSellItem = null;
      renderMyUsernames();
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  });

  /* ---------- Инвентарь ---------- */
  async function renderInventory() {
    const all = document.getElementById("inventoryAll");
    const active = document.getElementById("inventoryActive");
    all.innerHTML = "";
    active.innerHTML = "";

    const inv = currentUserData.inventory || {};
    const ids = Object.keys(inv);
    if (ids.length === 0) {
      all.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#94a3b8;">Пусто. Купи что-нибудь в магазине.</div>';
      return;
    }

    const market = (await get(ref(db, "market"))).val() || {};

    ids.forEach(id => {
      const item = shopItems.find(i => i.id === id);
      if (!item) return;

      let isEquipped = false;
      if (item.type === "nickColor") isEquipped = currentUserData.nickColor === item.value;
      else if (item.type === "emoji") isEquipped = currentUserData.nickEmoji === item.value;
      else if (item.type === "frame") isEquipped = currentUserData.avatarFrame === item.value;
      else if (item.type === "username") isEquipped = currentUserData.username === item.value;
      else if (item.type === "phone") isEquipped = currentUserData.phone === item.value;

      const onSale = market[item.id] !== undefined;

      const el = document.createElement("div");
      el.className = "inventory-item" + (isEquipped ? " active" : "");
      let statusText = item.preview;
      if (isEquipped) statusText = "● Активно";

      let actions = "";
      if (item.type === "username" || item.type === "phone") {
        if (isEquipped) actions = '<button class="inventory-item-btn" disabled>● Активен</button>';
        else actions = '<button class="inventory-item-btn" data-action="activate">Сделать активным</button>';
        if (!onSale) actions += '<button class="inventory-item-btn sell" data-action="sell">Продать</button>';
        else actions += '<button class="inventory-item-btn sell" data-action="cancel-sale">Снять</button>';
      } else {
        if (isEquipped) actions = '<button class="inventory-item-btn remove" data-action="remove">Снять</button>';
        else actions = '<button class="inventory-item-btn" data-action="activate">Надеть</button>';
      }

      el.innerHTML = `
        <div class="inventory-item-icon">${item.icon}</div>
        <div class="inventory-item-info">
          <div class="inventory-item-name">${escapeHtml(item.name)}</div>
          <div class="inventory-item-status">${statusText}</div>
        </div>
        <div class="inventory-item-actions">${actions}</div>`;

      el.querySelectorAll("[data-action]").forEach(btn => {
        const action = btn.dataset.action;
        btn.addEventListener("click", async () => {
          if (action === "activate") await equipItem(item).then(renderInventory);
          else if (action === "remove") await unequipItem(item).then(renderInventory);
          else if (action === "sell") openSellModal(item);
          else if (action === "cancel-sale") await cancelListing(item.id).then(renderInventory);
        });
      });

      all.appendChild(el);
      if (isEquipped) active.appendChild(el.cloneNode(true));
    });

    if (active.children.length === 0) {
      active.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Ничего не надето</div>';
    }
  }

  async function unequipItem(item) {
    const updates = {};
    if (item.type === "nickColor") updates.nickColor = null;
    else if (item.type === "emoji") updates.nickEmoji = null;
    else if (item.type === "frame") updates.avatarFrame = null;
    else if (item.type === "username") updates.username = null;
    else if (item.type === "phone") updates.phone = null;
    try {
      await update(ref(db, "users/" + currentUser.uid), updates);
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  }

  /* ---------- Кнопки "назад" ---------- */
  const btnBackShop = document.getElementById("btnBackShop");
  if (btnBackShop) btnBackShop.addEventListener("click", () => S.showScreen("screen-chats"));

  const btnBackInv = document.getElementById("btnBackInventory");
  if (btnBackInv) btnBackInv.addEventListener("click", () => S.showScreen("screen-chats"));

  /* ---------- Кнопки открытия ---------- */
  const btnProfileShop = document.getElementById("btnProfileShop");
  if (btnProfileShop) btnProfileShop.addEventListener("click", openShop);

  console.log("✅ shop.js готов");
});