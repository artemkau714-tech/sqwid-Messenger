/* ============================================================
   shop.js — Магазин Sqwid (Значки + Фоны + Юзернеймы + Эффекты)
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
  const { db, ref, get, set, push, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 shop.js активирован");

  let myData = {};
  let currentTab = "badges";
  let unsubSelf = null;
  let shopUsernames = {}; 

  const COIN_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="7"/></svg>`;

  const SVG_PATHS = {
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    heart: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    fire: '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/>',
    diamond: '<path d="M6 2l-4 6 10 14L22 8l-4-6z"/>',
    crown: '<path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/>',
  };

  const CATALOG = {
    badges: [
      { id: "b_01", name: "Звезда",        price: 1000, type: "svg_badge", value: "star", color: "#f59e0b" },
      { id: "b_02", name: "Сердце",        price: 1500, type: "svg_badge", value: "heart", color: "#ef4444" },
      { id: "b_03", name: "Огонь",         price: 2500, type: "svg_badge", value: "fire", color: "#f97316" },
      { id: "b_04", name: "Алмаз",         price: 5000, type: "svg_badge", value: "diamond", color: "#06b6d4" },
      { id: "b_05", name: "Корона",        price: 10000, type: "svg_badge", value: "crown", color: "#f59e0b" }
    ],
    profileBg: [
      { id: "bg_01", name: "Сердечки",   price: 1000, type: "floatingBg", value: "hearts" },
      { id: "bg_02", name: "Звёзды",     price: 2500, type: "floatingBg", value: "stars" }
    ],
    avatar_fx: [
      { id: "fx_paws",      name: "Лапки",     price: 15000, type: "avatar_fx", value: "paws" },
      { id: "fx_tentacles", name: "Щупальца",  price: 25000, type: "avatar_fx", value: "tentacles" },
      { id: "fx_ears",      name: "Ушки",      price: 20000, type: "avatar_fx", value: "ears" },
      { id: "fx_horns",     name: "Рожки",     price: 20000, type: "avatar_fx", value: "horns" },
      { id: "fx_wings",     name: "Крылья",    price: 30000, type: "avatar_fx", value: "wings" }
    ]
  };

  if (unsubSelf) unsubSelf();
  unsubSelf = onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    updateBalance();
    const screen = document.getElementById("screen-shop");
    if (screen && screen.classList.contains("active")) {
      renderShop();
    }
  });


  function updateBalance() {
    const el = document.getElementById("shopBalance");
    if (!el) return;
    const coins = myData.coins || 0;
    el.innerHTML = window.Sqwid.coinIcon ? window.Sqwid.coinIcon(12) + coins + " SQ" : coins + " SQ";
  }

  function openShop() {
    updateBalance();
    currentTab = "badges";
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t.dataset.shopTab === "badges"));
    renderShop();
    S.showScreen("screen-shop");
  }
  window.Sqwid.openShop = openShop;

  const btnOpenShop = document.getElementById("btnOpenShop");
  if (btnOpenShop) btnOpenShop.addEventListener("click", openShop);

  const btnBackShop = document.getElementById("btnBackShop");
  if (btnBackShop) btnBackShop.addEventListener("click", () => S.showScreen("screen-profile"));

  document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t === tab));
      currentTab = tab.dataset.shopTab;
      renderShop();
    });
  });

  function renderShop() {
    const grid = document.getElementById("shopGrid");
    if (!grid) return;
    grid.innerHTML = "";

    // 🔥 ПРОВЕРКА НА SQWID+
    const isPlus = myData.plusUntil && myData.plusUntil > Date.now();
    const avatarTab = document.getElementById("shopTabAvatar");
    if (avatarTab) {
      avatarTab.style.display = isPlus ? "block" : "none";
    }
    if (currentTab === "avatar_fx" && !isPlus) {
      currentTab = "badges";
      document.querySelectorAll(".shop-tab").forEach(t => t.classList.toggle("active", t.dataset.shopTab === "badges"));
    }

    // ================= ВКЛАДКА ЮЗЕРНЕЙМЫ =================
    if (currentTab === "usernames") {
      const isAdmin = window.Sqwid.isAdminOrModerator && window.Sqwid.isAdminOrModerator();
      
      const listContainer = document.createElement("div");
      listContainer.className = "us-shop-list";
      listContainer.style.gridColumn = "1 / -1";

      if (isAdmin) {
        const adminBtn = document.createElement("button");
        adminBtn.className = "btn-create";
        adminBtn.textContent = "➕ Управление юзернеймами";
        adminBtn.style.marginBottom = "1rem";
        adminBtn.onclick = () => {
          S.showScreen("screen-admin-usernames");
          renderAdminShopList();
        };
        listContainer.appendChild(adminBtn);
      }

      const items = Object.values(shopUsernames)
        .filter(item => item && item.sold !== true)
        .sort((a, b) => (a.price || 0) - (b.price || 0));

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "create-empty";
        empty.style.cssText = "text-align:center;padding:2rem;";
        empty.textContent = "Пока нет юзернеймов на продаже";
        listContainer.appendChild(empty);
      } else {
        items.forEach(item => {
          const card = document.createElement("div");
          card.className = "us-card" + (item.sold ? " us-sold" : "");

          const isOwner = item.sold && item.soldTo === currentUser.uid;
          let btnHTML = "";

          if (item.sold) {
            btnHTML = `<button class="us-btn us-btn-sold" disabled>${isOwner ? "✓ Куплено" : "Продано"}</button>`;
          } else {
            if (item.addedBy === currentUser.uid) {
               btnHTML = `<button class="us-btn" style="background:rgba(239,68,68,0.1);color:#ef4444;" data-id="${item.id}" data-action="remove">Снять</button>`;
            } else {
               btnHTML = `<button class="us-btn us-btn-buy" data-id="${item.id}">${COIN_ICON} ${(item.price || 0).toLocaleString("ru-RU")} SQ</button>`;
            }
          }

          card.innerHTML = `
            <div class="us-card-left">
              <div class="us-username">@${item.username}</div>
              ${item.description ? `<div class="us-desc">${item.description}</div>` : ""}
            </div>
            ${btnHTML}
          `;

          if (!item.sold) {
            const btn = card.querySelector("[data-id]");
            if (btn) {
                if (btn.dataset.action === "remove") {
                    btn.addEventListener("click", () => removeMyLot(item.id));
                } else {
                    btn.addEventListener("click", () => buyUsername(item.id));
                }
            }
          }
          listContainer.appendChild(card);
        });
      }
      grid.appendChild(listContainer);
      return; 
    }

    // ================= ЗНАЧКИ, ФОНЫ, ЭФФЕКТЫ =================
    const items = CATALOG[currentTab] || [];
    const owned = myData.shopOwned || {};
    
    const equippedEmoji = myData.nickEmoji;
    const equippedBg = myData.profileFloatingBg;
    const equippedFx = myData.avatarFx;

    items.forEach(item => {
      const isOwned = owned[item.id] === true;
      
      let isEquipped = false;
      if (item.type === "svg_badge") {
         isEquipped = equippedEmoji && equippedEmoji.includes(`data-badge-id="${item.id}"`);
      }
      if (item.type === "floatingBg") {
         isEquipped = equippedBg === item.value;
      }
      if (item.type === "avatar_fx") {
         isEquipped = equippedFx === item.value;
      }

      const card = document.createElement("div");
      card.className = "shop-card" + (isOwned ? " owned" : "");

      let previewHTML = buildPreview(item);
      let btnHTML = "";

      if (isEquipped) {
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

  function buildPreview(item) {
    if (item.type === "svg_badge") {
      const path = SVG_PATHS[item.value] || "";
      return `<div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 10px ${item.color}80);">
        <svg viewBox="0 0 24 24" width="50" height="50" fill="${item.color}">${path}</svg>
      </div>`;
    }
    if (item.type === "avatar_fx") {
      return `<div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;font-size:30px;">✨</div>`;
    }
    return `<div style="color:#94a3b8;">?</div>`;
  }

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
    const updates = {};
    
    if (item.type === "svg_badge") {
      const path = SVG_PATHS[item.value] || "";
      updates.nickEmoji = `<span data-badge-id="${item.id}" style="display:inline-block;vertical-align:middle;margin-left:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="${item.color}">${path}</svg></span>`;
    } else if (item.type === "floatingBg") {
      updates.profileFloatingBg = item.value;
    } else if (item.type === "avatar_fx") {
      updates.avatarFx = item.value;
    }

    await update(ref(db, "users/" + currentUser.uid), updates);
    S.showToast("Применено", "ok");
  }

  async function unequipItem(item) {
    const updates = {};
    if (item.type === "svg_badge") {
      updates.nickEmoji = null;
    } else if (item.type === "floatingBg") {
      updates.profileFloatingBg = null;
    } else if (item.type === "avatar_fx") {
      updates.avatarFx = null;
    }

    await update(ref(db, "users/" + currentUser.uid), updates);
    S.showToast("Снято", "ok");
  }


  // ================= ЮЗЕРНЕЙМЫ: покупка и управление =================
  const normUn = value => String(value || "").trim().replace(/^@/, "").toLowerCase();

  async function buyUsername(itemId) {
    const item = shopUsernames[itemId];
    if (!item || item.sold) return S.showToast("Этот юзернейм уже недоступен", "error");
    const username = normUn(item.username);
    const price = Math.max(0, Number(item.price) || 0);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return S.showToast("Некорректный юзернейм в лоте", "error");
    if (normUn(myData.username) === username ||
        Object.keys(myData.purchasedUsernames || {}).some(n => normUn(n) === username)) {
      return S.showToast("Этот юзернейм уже есть у вас", "error");
    }
    if ((Number(myData.coins) || 0) < price) return S.showToast("Недостаточно SQ", "error");
    if (!await S.showConfirm(`Купить @${username} за ${price.toLocaleString("ru-RU")} SQ?`, "Покупка")) return;

    const registryRef = ref(db, "username_registry/" + username);
    let oldRegistry = null;
    try {
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      for (const uid in users) {
        if (uid === currentUser.uid) continue;
        const u = users[uid] || {};
        const names = [u.username, ...Object.keys(u.purchasedUsernames || {})];
        if (names.some(n => normUn(n) === username)) {
          return S.showToast("Этот юзернейм уже принадлежит пользователю", "error");
        }
      }

      const oldSnap = await get(registryRef);
      oldRegistry = oldSnap.val() || null;
      const claim = await S.runTransaction(registryRef, current => {
        if (current) {
          if (current.status !== "listed") return;
          if (current.listingId && current.listingId !== itemId) return;
          if (current.uid === currentUser.uid) return;
        }
        return { uid: currentUser.uid, username, status: "owned", purchasedFrom: item.addedBy || "SHOP", updatedAt: Date.now() };
      });
      if (!claim.committed) return S.showToast("Юзернейм уже занят или его купили", "error");

      const userRef = ref(db, "users/" + currentUser.uid);
      const debit = await S.runTransaction(userRef, current => {
        if (!current) return;
        const balance = Number(current.coins) || 0;
        const purchased = { ...(current.purchasedUsernames || {}) };
        if (balance < price || purchased[username] === true || normUn(current.username) === username) return;
        purchased[username] = true;
        return { ...current, coins: balance - price, purchasedUsernames: purchased };
      });
      if (!debit.committed) {
        await S.runTransaction(registryRef, current => {
          if (current && current.uid === currentUser.uid && current.username === username) return oldRegistry;
          return current;
        });
        return S.showToast("Недостаточно SQ или юзернейм уже куплен", "error");
      }

      await remove(ref(db, "usernames_shop/" + itemId));
      myData = debit.snapshot.val() || myData;
      renderShop();
      try {
        const botRef = push(ref(db, "botChat/" + currentUser.uid));
        await set(botRef, { from: "Sqwid Shop", text: `Куплен юзернейм @${username} за ${price} SQ`, timestamp: Date.now(), type: "system", kind: "shop" });
      } catch (_) {}
      S.showToast(`Юзернейм @${username} куплен!`, "ok", 3000);
    } catch (e) {
      S.showToast("Ошибка покупки: " + e.message, "error");
    }
  }

  async function removeMyLot(itemId) {
    const item = shopUsernames[itemId];
    if (!item || item.addedBy !== currentUser.uid) return;
    if (!await S.showConfirm(`Снять @${item.username} с продажи?`, "Магазин")) return;
    const username = normUn(item.username);
    try {
      const updates = {};
      updates[`usernames_shop/${itemId}`] = null;
      if (!myData.username) updates[`users/${currentUser.uid}/username`] = username;
      else updates[`users/${currentUser.uid}/purchasedUsernames/${username}`] = true;
      await update(ref(db), updates);
      await S.runTransaction(ref(db, "username_registry/" + username), current => {
        if (current && current.status === "listed" && current.listingId === itemId) {
          return { uid: currentUser.uid, username, status: "owned", updatedAt: Date.now() };
        }
        return current;
      });
      S.showToast("Лот снят с продажи", "ok");
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  }

  const adminSubmit = document.getElementById("btnAdminSubmitUsername");
  if (adminSubmit) adminSubmit.addEventListener("click", async () => {
    if (!(window.Sqwid.isAdminOrModerator && window.Sqwid.isAdminOrModerator())) {
      return S.showToast("Нет прав для этого действия", "error");
    }
    const username = normUn(document.getElementById("adminUnInput")?.value);
    const price = Math.floor(Number(document.getElementById("adminUnPrice")?.value));
    const description = (document.getElementById("adminUnDesc")?.value || "").trim();
    const category = document.getElementById("adminUnCategory")?.value || "custom";
    const status = document.getElementById("adminUnStatus");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      if (status) status.textContent = "Латиница, цифры и _, от 3 до 20 символов";
      return;
    }
    if (!Number.isFinite(price) || price < 100) {
      if (status) status.textContent = "Минимальная цена — 100 SQ";
      return;
    }
    try {
      const [usersSnap, shopSnap] = await Promise.all([get(ref(db, "users")), get(ref(db, "usernames_shop"))]);
      const users = usersSnap.val() || {};
      const shop = shopSnap.val() || {};
      const occupied = Object.values(users).some(u => {
        if (!u) return false;
        return [u.username, ...Object.keys(u.purchasedUsernames || {})].some(n => normUn(n) === username);
      });
      const listed = Object.values(shop).some(i => i && !i.sold && normUn(i.username) === username);
      if (occupied || listed) {
        if (status) status.textContent = "Юзернейм уже занят или выставлен";
        return;
      }

      const newRef = push(ref(db, "usernames_shop"));
      const registryRef = ref(db, "username_registry/" + username);
      const claim = await S.runTransaction(registryRef, current => {
        if (current) return;
        return { uid: "SHOP", username, status: "listed", listingId: newRef.key, updatedAt: Date.now() };
      });
      if (!claim.committed) {
        if (status) status.textContent = "Юзернейм уже зарезервирован";
        return;
      }
      try {
        await set(newRef, { id: newRef.key, username, price, description, category, addedBy: "SHOP", addedAt: Date.now(), sold: false });
      } catch (err) {
        await S.runTransaction(registryRef, current => current && current.listingId === newRef.key ? null : current);
        throw err;
      }
      document.getElementById("adminUnInput").value = "";
      document.getElementById("adminUnPrice").value = "10000";
      document.getElementById("adminUnDesc").value = "";
      if (status) status.textContent = `@${username} выставлен на продажу`;
      S.showToast("Юзернейм выставлен на продажу", "ok");
      renderAdminShopList();
    } catch (e) {
      if (status) status.textContent = "Ошибка: " + e.message;
      S.showToast("Ошибка: " + e.message, "error");
    }
  });

  function renderAdminShopList() {
    const box = document.getElementById("adminShopList");
    if (!box) return;
    if (!(window.Sqwid.isAdminOrModerator && window.Sqwid.isAdminOrModerator())) {
      box.textContent = "Нет доступа";
      return;
    }
    box.innerHTML = "";
    const entries = Object.values(shopUsernames).filter(i => i && !i.sold);
    if (!entries.length) {
      box.textContent = "Активных лотов пока нет";
      return;
    }
    entries.forEach(item => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border-bottom:1px solid var(--border);";
      const label = document.createElement("span");
      label.textContent = `@${item.username} — ${(Number(item.price) || 0).toLocaleString("ru-RU")} SQ`;
      const btn = document.createElement("button");
      btn.className = "btn-secondary";
      btn.textContent = "Снять";
      btn.addEventListener("click", async () => {
        if (!await S.showConfirm(`Удалить @${item.username} из магазина?`, "Администрирование")) return;
        const uname = normUn(item.username);
        await remove(ref(db, "usernames_shop/" + item.id));
        await S.runTransaction(ref(db, "username_registry/" + uname), current => {
          if (current && current.status === "listed" && current.listingId === item.id) return null;
          return current;
        });
        S.showToast("Лот удалён", "ok");
      });
      row.append(label, btn);
      box.appendChild(row);
    });
  }

  const backAdmin = document.getElementById("btnBackAdminUsernames");
  if (backAdmin) backAdmin.addEventListener("click", () => S.showScreen("screen-profile"));

  onValue(ref(db, "usernames_shop"), snap => {
    shopUsernames = snap.val() || {};
    const screen = document.getElementById("screen-shop");
    if (screen && screen.classList.contains("active") && currentTab === "usernames") renderShop();
    renderAdminShopList();
  });

  console.log("✅ shop.js готов");

  
  console.log("✅ shop.js готов");
});