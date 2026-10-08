/* ============================================================
   inventory.js — инвентарь: подарки, юзернеймы, номера, ники, значки, рамки
   ============================================================ */

console.log("🚀 inventory.js загружен, жду Sqwid...");

function waitForSqwidInventory(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ inventory.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidInventory((S) => {
  const { db, ref, get, set, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 inventory.js активирован");

  let currentUserData = {};
  let currentUserGifts = {};
  let shopItems = [];
  let pendingSellItem = null;

  /* ---------- Базовые товары (копия из shop.js) ---------- */
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

  /* ---------- Подписки ---------- */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    currentUserData = snap.val() || {};
    const inv = document.getElementById("screen-inventory");
    if (inv && inv.classList.contains("active")) renderInventory();
  });

  onValue(ref(db, "users/" + currentUser.uid + "/gifts"), (snap) => {
    currentUserGifts = snap.val() || {};
    const inv = document.getElementById("screen-inventory");
    if (inv && inv.classList.contains("active")) renderInventory();
  });

  onValue(ref(db, "shop/items"), (snap) => {
    const all = snap.val() || {};
    shopItems = BASE_ITEMS.concat(Object.values(all));
    const inv = document.getElementById("screen-inventory");
    if (inv && inv.classList.contains("active")) renderInventory();
  });

  /* ---------- Открытие инвентаря ---------- */
  function openInventory() {
    renderInventory();
    S.showScreen("screen-inventory");
  }

  window.Sqwid.openInventory = openInventory;

  /* ============================================================
     РЕНДЕР ИНВЕНТАРЯ
     ============================================================ */
  async function renderInventory() {
    const activeBox = document.getElementById("inventoryActive");
    const allBox = document.getElementById("inventoryAll");
    if (!activeBox || !allBox) {
      console.warn("inventory.js: не найдены #inventoryActive / #inventoryAll");
      return;
    }
    activeBox.innerHTML = "";
    allBox.innerHTML = "";

    const inv = currentUserData.inventory || {};
    const gifts = currentUserGifts || {};

    const invKeys = Object.keys(inv);
    const giftKeys = Object.keys(gifts);

    if (invKeys.length === 0 && giftKeys.length === 0) {
      allBox.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#94a3b8;">Пусто. Купи что-нибудь в магазине или получи подарок.</div>';
      activeBox.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Ничего не надето</div>';
      return;
    }

    const market = (await get(ref(db, "market"))).val() || {};

    /* ---------- ПОДАРКИ ---------- */
    giftKeys.forEach(gid => {
      const g = gifts[gid];
      if (!g) return;

      const el = document.createElement("div");
      el.className = "inventory-item";

      const price = g.price || 0;
      const multiplied = g.multiplied && g.multiplied > 1
        ? ` <span style="color:#f59e0b;font-weight:800;">x${g.multiplied}</span>`
        : "";

      el.innerHTML = `
        <div class="inventory-item-icon" style="background:transparent;padding:0;">
          <img src="${g.icon || 'sqwidstar.png'}" style="width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(245,158,11,0.4));">
        </div>
        <div class="inventory-item-info">
          <div class="inventory-item-name">${escapeHtml(g.name || "Подарок")}${multiplied}</div>
          <div class="inventory-item-status">🪙 ${price} SQ · подарок</div>
        </div>
        <div class="inventory-item-actions">
          <button class="inventory-item-btn" data-action="gift-open">👁 Открыть</button>
        </div>`;

      el.querySelector('[data-action="gift-open"]').addEventListener("click", () => {
        openGiftInfo(g);
      });

      allBox.appendChild(el);
    });

    /* ---------- ЮЗЕРНЕЙМЫ / НОМЕРА / НИКИ / ЗНАЧКИ / РАМКИ ---------- */
    invKeys.forEach(id => {
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
        if (isEquipped) {
          actions = '<button class="inventory-item-btn" disabled>● Активен</button>';
        } else {
          actions = '<button class="inventory-item-btn" data-action="activate">Надеть</button>';
        }
        if (!onSale) {
          actions += '<button class="inventory-item-btn sell" data-action="sell">Продать</button>';
        } else {
          actions += '<button class="inventory-item-btn sell" data-action="cancel-sale">Снять с продажи</button>';
        }
      } else {
        if (isEquipped) {
          actions = '<button class="inventory-item-btn remove" data-action="remove">Снять</button>';
        } else {
          actions = '<button class="inventory-item-btn" data-action="activate">Надеть</button>';
        }
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
          if (action === "activate") await equipItem(item);
          else if (action === "remove") await unequipItem(item);
          else if (action === "sell") openSellModal(item);
          else if (action === "cancel-sale") await cancelListing(item.id);
        });
      });

      allBox.appendChild(el);
      if (isEquipped) activeBox.appendChild(el.cloneNode(true));
    });

    if (activeBox.children.length === 0) {
      activeBox.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Ничего не надето</div>';
    }
  }

  /* ---------- Надеть / Снять ---------- */
  async function equipItem(item) {
    const updates = {};
    if (item.type === "nickColor") updates.nickColor = item.value;
    else if (item.type === "emoji") updates.nickEmoji = item.value;
    else if (item.type === "frame") updates.avatarFrame = item.value;
    else if (item.type === "username") updates.username = item.value;
    else if (item.type === "phone") updates.phone = item.value;
    try {
      await update(ref(db, "users/" + currentUser.uid), updates);
      S.showToast("Надето: " + item.name, "ok", 1500);
    } catch (e) { S.showToast("Ошибка: " + e.message, "error"); }
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
      S.showToast("Снято", "ok", 1500);
    } catch (e) { S.showToast("Ошибка: " + e.message, "error"); }
  }

  /* ---------- Продажа ---------- */
  function openSellModal(item) {
    pendingSellItem = item;
    const nameEl = document.getElementById("sellItemName");
    const priceEl = document.getElementById("sellPrice");
    if (nameEl) nameEl.textContent = "@" + item.value;
    if (priceEl) priceEl.value = item.price || 1000;
    const modal = document.getElementById("modal-sell");
    if (modal) modal.classList.add("active");
  }

  const btnSellCancel = document.getElementById("btnSellCancel");
  if (btnSellCancel) btnSellCancel.addEventListener("click", () => {
    const m = document.getElementById("modal-sell");
    if (m) m.classList.remove("active");
    pendingSellItem = null;
  });

  const btnSellConfirm = document.getElementById("btnSellConfirm");
  if (btnSellConfirm) btnSellConfirm.addEventListener("click", async () => {
    if (!pendingSellItem) return;
    const priceEl = document.getElementById("sellPrice");
    const price = parseInt(priceEl.value);
    if (isNaN(price) || price <= 0) return S.showAlert("Введи цену больше 0", "Ошибка");
    try {
      await set(ref(db, "market/" + pendingSellItem.id), {
        sellerUid: currentUser.uid,
        sellerName: currentUserData.name || currentUser.email,
        username: pendingSellItem.value,
        price: price,
        listedAt: Date.now()
      });
      const m = document.getElementById("modal-sell");
      if (m) m.classList.remove("active");
      S.showAlert("@" + pendingSellItem.value + " выставлен за " + price + " SQ", "Готово");
      pendingSellItem = null;
    } catch (e) { S.showAlert("Ошибка: " + e.message, "Ошибка"); }
  });

  async function cancelListing(itemId) {
    const ok = await S.showConfirm("Снять лот с продажи?", "Отмена продажи");
    if (!ok) return;
    await remove(ref(db, "market/" + itemId));
    S.showToast("Снято с продажи", "ok");
  }

  /* ---------- Инфо о подарке ---------- */
  function openGiftInfo(g) {
    const modal = document.getElementById("modal-gift-info");
    if (!modal) {
      S.showAlert(`${g.name || "Подарок"}\n🪙 ${g.price || 0} SQ`, "Подарок");
      return;
    }
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

      if (g.fromUid && window.Sqwid.openOtherProfile) {
        fromEl.classList.add("clickable");
        fromEl.onclick = () => {
          modal.classList.remove("active");
          window.Sqwid.openOtherProfile(g.fromUid);
        };
      } else {
        fromEl.classList.remove("clickable");
        fromEl.onclick = null;
      }
    }

    modal.classList.add("active");
  }

  /* ---------- Кнопки ---------- */
  const btnOpenInv = document.getElementById("btnOpenInventory");
  if (btnOpenInv) btnOpenInv.addEventListener("click", openInventory);

  const btnBackInv = document.getElementById("btnBackInventory");
  if (btnBackInv) btnBackInv.addEventListener("click", () => S.showScreen("screen-profile"));

  console.log("✅ inventory.js готов");
});