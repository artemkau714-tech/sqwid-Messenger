/* ============================================================
   shop.js — Магазин Sqwid (SVG-Значки + SVG-Фоны + Юзернеймы)
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

  // Базовый путь для SVG иконок (чтобы не дублировать код)
  const SVG_PATHS = {
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    heart: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    fire: '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z"/>',
    diamond: '<path d="M6 2l-4 6 10 14L22 8l-4-6z"/>',
    crown: '<path d="M3 7l4 4 5-7 5 7 4-4v12H3V7z"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    skull: '<path d="M12 2a9 9 0 0 0-9 9c0 3 2 5.5 4 7v3h10v-3c2-1.5 4-4 4-7a9 9 0 0 0-9-9z"/>',
    ghost: '<path d="M12 2a8 8 0 0 0-8 8v12l3-3 3 3 3-3 3 3V10a8 8 0 0 0-8-8z"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    sword: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    alien: '<circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>',
    robot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/>',
    planet: '<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    clover: '<path d="M12 2a4 4 0 0 1 4 4c0 1.1-.5 2.1-1.2 2.8C16.1 8.5 17 8 18 8a4 4 0 1 1-4 4c0-1 .5-2 1.2-2.8C14.5 9.5 14 10 14 11a4 4 0 1 1-4-4c1 0 2 .5 2.8 1.2C12.5 7.5 12 6.5 12 5a3 3 0 0 1 3-3z"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>',
    coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    gamepad: '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
    car: '<path d="M14 16H9m10 0h4v-3.46a1.54 1.54 0 0 0-.32-.95l-2.43-3.64A2 2 0 0 0 18.6 7H5.4a2 2 0 0 0-1.65.95L1.32 11.6a1.54 1.54 0 0 0-.32.95V16h4"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  };

  /* ============================================================
     КАТАЛОГ ТОВАРОВ (52 Значка + 10 Фонов)
     ============================================================ */
  const CATALOG = {
    badges: [
      // Звезды
      { id: "b_01", name: "Звезда",        price: 1000, type: "svg_badge", value: "star", color: "#f59e0b" },
      { id: "b_02", name: "Звезда (синяя)",price: 1000, type: "svg_badge", value: "star", color: "#3b82f6" },
      { id: "b_03", name: "Звезда (роз.)", price: 1000, type: "svg_badge", value: "star", color: "#ec4899" },
      // Сердца
      { id: "b_04", name: "Сердце",        price: 1500, type: "svg_badge", value: "heart", color: "#ef4444" },
      { id: "b_05", name: "Сердце (фиол.)",price: 1500, type: "svg_badge", value: "heart", color: "#a855f7" },
      { id: "b_06", name: "Сердце (зел.)", price: 1500, type: "svg_badge", value: "heart", color: "#10b981" },
      // Огонь
      { id: "b_07", name: "Огонь",         price: 2000, type: "svg_badge", value: "fire", color: "#f97316" },
      { id: "b_08", name: "Огонь (крас.)", price: 2000, type: "svg_badge", value: "fire", color: "#ef4444" },
      // Молнии
      { id: "b_09", name: "Молния",        price: 2500, type: "svg_badge", value: "bolt", color: "#facc15" },
      { id: "b_10", name: "Молния (син.)", price: 2500, type: "svg_badge", value: "bolt", color: "#3b82f6" },
      // Черепа
      { id: "b_11", name: "Череп",         price: 3000, type: "svg_badge", value: "skull", color: "#ffffff" },
      { id: "b_12", name: "Череп (крас.)", price: 3000, type: "svg_badge", value: "skull", color: "#ef4444" },
      // Призраки
      { id: "b_13", name: "Призрак",       price: 3500, type: "svg_badge", value: "ghost", color: "#ffffff" },
      { id: "b_14", name: "Призрак (фиол.)",price: 3500, type: "svg_badge", value: "ghost", color: "#a855f7" },
      // Ракеты
      { id: "b_15", name: "Ракета",        price: 4000, type: "svg_badge", value: "rocket", color: "#f97316" },
      { id: "b_16", name: "Ракета (бел.)", price: 4000, type: "svg_badge", value: "rocket", color: "#ffffff" },
      // Подарки
      { id: "b_17", name: "Подарок",       price: 4500, type: "svg_badge", value: "gift", color: "#ec4899" },
      { id: "b_18", name: "Подарок (син.)",price: 4500, type: "svg_badge", value: "gift", color: "#3b82f6" },
      // Музыка
      { id: "b_19", name: "Музыка",        price: 5000, type: "svg_badge", value: "music", color: "#a855f7" },
      { id: "b_20", name: "Музыка (зол.)", price: 5000, type: "svg_badge", value: "music", color: "#f59e0b" },
      // Мечи
      { id: "b_21", name: "Меч",           price: 6000, type: "svg_badge", value: "sword", color: "#94a3b8" },
      { id: "b_22", name: "Меч (зол.)",    price: 6000, type: "svg_badge", value: "sword", color: "#f59e0b" },
      // Щиты
      { id: "b_23", name: "Щит",           price: 7000, type: "svg_badge", value: "shield", color: "#3b82f6" },
      { id: "b_24", name: "Щит (зел.)",    price: 7000, type: "svg_badge", value: "shield", color: "#10b981" },
      // Пришельцы
      { id: "b_25", name: "Пришелец",      price: 8000, type: "svg_badge", value: "alien", color: "#10b981" },
      { id: "b_26", name: "Пришелец (фиол.)",price: 8000, type: "svg_badge", value: "alien", color: "#a855f7" },
      // Роботы
      { id: "b_27", name: "Робот",         price: 9000, type: "svg_badge", value: "robot", color: "#94a3b8" },
      { id: "b_28", name: "Робот (син.)",  price: 9000, type: "svg_badge", value: "robot", color: "#3b82f6" },
      // Планеты
      { id: "b_29", name: "Планета",       price: 10000, type: "svg_badge", value: "planet", color: "#f97316" },
      { id: "b_30", name: "Планета (фиол.)",price: 10000, type: "svg_badge", value: "planet", color: "#a855f7" },
      // Луны
      { id: "b_31", name: "Луна",          price: 11000, type: "svg_badge", value: "moon", color: "#facc15" },
      { id: "b_32", name: "Луна (бел.)",   price: 11000, type: "svg_badge", value: "moon", color: "#ffffff" },
      // Солнце
      { id: "b_33", name: "Солнце",        price: 12000, type: "svg_badge", value: "sun", color: "#f59e0b" },
      { id: "b_34", name: "Солнце (крас.)",price: 12000, type: "svg_badge", value: "sun", color: "#ef4444" },
      // Облака
      { id: "b_35", name: "Облако",        price: 13000, type: "svg_badge", value: "cloud", color: "#ffffff" },
      { id: "b_36", name: "Облако (син.)", price: 13000, type: "svg_badge", value: "cloud", color: "#3b82f6" },
      // Клевер
      { id: "b_37", name: "Клевер",        price: 14000, type: "svg_badge", value: "clover", color: "#10b981" },
      { id: "b_38", name: "Клевер (зол.)", price: 14000, type: "svg_badge", value: "clover", color: "#f59e0b" },
      // Торт
      { id: "b_39", name: "Торт",          price: 15000, type: "svg_badge", value: "cake", color: "#ec4899" },
      { id: "b_40", name: "Торт (син.)",   price: 15000, type: "svg_badge", value: "cake", color: "#3b82f6" },
      // Кофе
      { id: "b_41", name: "Кофе",          price: 16000, type: "svg_badge", value: "coffee", color: "#78350f" },
      { id: "b_42", name: "Кофе (бел.)",   price: 16000, type: "svg_badge", value: "coffee", color: "#ffffff" },
      // Камера
      { id: "b_43", name: "Камера",        price: 17000, type: "svg_badge", value: "camera", color: "#94a3b8" },
      { id: "b_44", name: "Камера (фиол.)",price: 17000, type: "svg_badge", value: "camera", color: "#a855f7" },
      // Геймпад
      { id: "b_45", name: "Геймпад",       price: 18000, type: "svg_badge", value: "gamepad", color: "#ef4444" },
      { id: "b_46", name: "Геймпад (син.)",price: 18000, type: "svg_badge", value: "gamepad", color: "#3b82f6" },
      // Машина
      { id: "b_47", name: "Машина",        price: 19000, type: "svg_badge", value: "car", color: "#ef4444" },
      { id: "b_48", name: "Машина (черн.)",price: 19000, type: "svg_badge", value: "car", color: "#111111" },
      // Кубок
      { id: "b_49", name: "Кубок",         price: 20000, type: "svg_badge", value: "trophy", color: "#f59e0b" },
      { id: "b_50", name: "Кубок (бел.)",  price: 20000, type: "svg_badge", value: "trophy", color: "#ffffff" },
      // Алмаз
      { id: "b_51", name: "Алмаз",         price: 25000, type: "svg_badge", value: "diamond", color: "#06b6d4" },
      // Корона
      { id: "b_52", name: "Корона",        price: 30000, type: "svg_badge", value: "crown", color: "#f59e0b" }
    ],
    profileBg: [
      { id: "bg_01", name: "Сердечки",   price: 1000, type: "floatingBg", value: "hearts" },
      { id: "bg_02", name: "Звёзды",     price: 2500, type: "floatingBg", value: "stars" },
      { id: "bg_03", name: "Искры",      price: 4000, type: "floatingBg", value: "fire" },
      { id: "bg_04", name: "Листья",     price: 5500, type: "floatingBg", value: "leaf" },
      { id: "bg_05", name: "Снежинки",   price: 7000, type: "floatingBg", value: "snow" },
      { id: "bg_06", name: "Ноты",       price: 8500, type: "floatingBg", value: "notes" },
      { id: "bg_07", name: "Пузыри",     price: 10000, type: "floatingBg", value: "bubbles" },
      { id: "bg_08", name: "Планеты",    price: 12000, type: "floatingBg", value: "planets" },
      { id: "bg_09", name: "Призраки",   price: 15000, type: "floatingBg", value: "ghosts" },
      { id: "bg_10", name: "Монеты",     price: 20000, type: "floatingBg", value: "coins" }
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
      renderShop();
    }
  });

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

    // ================= ВКЛАДКА ЮЗЕРНЕЙМЫ =================
    if (currentTab === "usernames") {
      const isAdmin = window.Sqwid.isAdminOrModerator && window.Sqwid.isAdminOrModerator();
      
      const listContainer = document.createElement("div");
      listContainer.className = "us-shop-list";
      listContainer.style.gridColumn = "1 / -1";

      if (isAdmin) {
        const adminBtn = document.createElement("button");
        adminBtn.className = "btn-create";
        adminBtn.innerHTML = "➕ Выставить юзернейм на продажу";
        adminBtn.style.marginBottom = "1rem";
        adminBtn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)"; 
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

    // ================= ЗНАЧКИ И ФОНЫ =================
    const items = CATALOG[currentTab] || [];
    const owned = myData.shopOwned || {};
    
    // Для эмодзи и SVG-значков
    const equippedEmoji = myData.nickEmoji;
    const equippedBg = myData.profileFloatingBg;

    items.forEach(item => {
      const isOwned = owned[item.id] === true;
      
      let isEquipped = false;
      if (item.type === "svg_badge" || item.type === "emoji") {
         // Проверяем, надет ли именно этот значок (совпадение по иконке и цвету)
         isEquipped = equippedEmoji && equippedEmoji.includes(`data-badge-id="${item.id}"`);
      }
      if (item.type === "floatingBg") {
         isEquipped = equippedBg === item.value;
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

  /* ============================================================
     ПРЕВЬЮ (SVG Значки)
     ============================================================ */
  function buildPreview(item) {
    if (item.type === "svg_badge") {
      const path = SVG_PATHS[item.value] || "";
      return `<div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 10px ${item.color}80);">
        <svg viewBox="0 0 24 24" width="50" height="50" fill="${item.color}">${path}</svg>
      </div>`;
    }
    if (item.type === "floatingBg") {
      // Показываем превью в виде иконки
      const iconMap = {
        hearts: '❤️', stars: '⭐', fire: '🔥', leaf: '🍃', snow: '❄️',
        notes: '🎵', bubbles: '🫧', planets: '🪐', ghosts: '👻', coins: '🪙'
      };
      return `<div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;font-size:40px;">${iconMap[item.value] || '✨'}</div>`;
    }
    return `<div style="color:#94a3b8;">?</div>`;
  }

  /* ============================================================
     ПОКУПКА И ПРИМЕНЕНИЕ
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
    const updates = {};
    
    if (item.type === "svg_badge") {
      // Сохраняем как HTML строку, чтобы потом рендерить в профиле/чате
      const path = SVG_PATHS[item.value] || "";
      updates.nickEmoji = `<span data-badge-id="${item.id}" style="display:inline-block;vertical-align:middle;margin-left:4px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="${item.color}">${path}</svg></span>`;
    } else if (item.type === "floatingBg") {
      updates.profileFloatingBg = item.value;
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
    }

    await update(ref(db, "users/" + currentUser.uid), updates);
    S.showToast("Снято", "ok");
  }

  // Снять лот с продажи
  async function removeMyLot(itemId) {
    const ok = await S.showConfirm("Снять лот с продажи?", "Отмена");
    if (!ok) return;

    try {
        const item = shopUsernames[itemId];
        if (!item) return;

        const updates = {};
        updates[`usernames_shop/${itemId}`] = null; 
        
        const purchased = { ...(myData.purchasedUsernames || {}) };
        purchased[item.username] = { boughtAt: Date.now() };
        updates[`users/${currentUser.uid}/purchasedUsernames/${item.username}`] = { boughtAt: Date.now() };
        
        await update(ref(db), updates);
        S.showToast("Лот снят", "ok");
    } catch(e) {
        S.showToast("Ошибка", "error");
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

      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      for (const uid in users) {
        if (users[uid].username && users[uid].username.toLowerCase() === username) {
          return S.showToast("Этот юзернейм уже занят пользователем!", "error");
        }
      }

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
     АДМИНКА ЮЗЕРНЕЙМОВ
     ============================================================ */
  const adminBtn = document.getElementById("adminOpenUsernameManager");
  if (adminBtn) {
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

      if (item.addedBy && item.addedBy !== "SQWID_BOT") {
        const sellerSnap = await get(ref(db, "users/" + item.addedBy));
        const sellerData = sellerSnap.val() || {};
        const sellerCoins = sellerData.coins || 0;
        
        const tax = Math.floor(price * 0.03);
        const sellerGets = price - tax;
        
        await update(ref(db, "users/" + item.addedBy), { coins: sellerCoins + sellerGets });
        
        const botRef = push(ref(db, "botChat/" + item.addedBy));
        await set(botRef, {
            from: "Sqwid Shop",
            text: `💰 Ваш юзернейм @${item.username} куплен!\nВы получили: ${sellerGets} SQ (налог сервиса 3%)`,
            timestamp: Date.now(),
            type: "system"
        });
      }

      await update(ref(db, "users/" + currentUser.uid), {
        coins: myCoins - price,
        purchasedUsernames: purchased
      });

      await update(ref(db, "usernames_shop/" + itemId), {
        sold: true,
        soldTo: currentUser.uid,
        soldAt: Date.now()
      });

      const botRef2 = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef2, {
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

  // Заглушка для подарков (чтобы не падало)
  function renderGiftsTab() {
    const grid = document.getElementById("shopGrid");
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-3);">Подарки скоро появятся</div>';
  }

  console.log("✅ shop.js готов");
});