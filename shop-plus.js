/* ============================================================
   shop-plus.js — Магазин пополнения: сквидики + Sqwid+
   Витрина с заглушкой оплаты (готова под подключение платёжки)
   + Кастомная SVG-монетка SQ
   ============================================================ */

console.log("🚀 shop-plus.js загружен, жду Sqwid...");

function waitForSqwidShopPlus(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ shop-plus.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidShopPlus((S) => {
  const { db, ref, get, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 shop-plus.js активирован");

  let myData = {};

  /* ============================================================
     КАТАЛОГ ТОВАРОВ
     ============================================================ */
  const CATALOG = {
    premium: [
      { id: "plus_1m", name: "1 месяц",   price: 199,  months: 1 },
      { id: "plus_3m", name: "3 месяца",  price: 800,  months: 3,  save: "Экономия 200₽" },
      { id: "plus_6m", name: "6 месяцев", price: 1600, months: 6,  save: "Экономия 400₽" }
    ],
    coins: [
      { id: "coins_100",   name: "100 скв",   coins: 100,   price: 115 },
      { id: "coins_250",   name: "250 скв",   coins: 250,   price: 270 },
      { id: "coins_650",   name: "650 скв",   coins: 650,   price: 400 },
      { id: "coins_1000",  name: "1000 скв",  coins: 1000,  price: 700 },
      { id: "coins_1500",  name: "1500 скв",  coins: 1500,  price: 1000 },
      { id: "coins_2500",  name: "2500 скв",  coins: 2500,  price: 3000 },
      { id: "coins_5000",  name: "5000 скв",  coins: 5000,  price: 6000 },
      { id: "coins_10000", name: "10000 скв", coins: 10000, price: 12000 }
    ]
  };

  /* ============================================================
     ПОДПИСКА НА СВОИ ДАННЫЕ
     ============================================================ */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
  });

  /* ============================================================
     ОТКРЫТИЕ МЕНЮ ПОПОЛНЕНИЯ
     ============================================================ */
  function openTopUp() {
    const modal = document.getElementById("modal-topup");
    if (!modal) {
      console.warn("shop-plus: нет #modal-topup в HTML");
      return;
    }
    renderTopUpMenu();
    modal.classList.add("active");
    const scroll = document.getElementById("topupScroll");
    if (scroll) scroll.scrollTop = 0;
  }
  window.Sqwid.openTopUp = openTopUp;

  /* ============================================================
     РЕНДЕР МЕНЮ
     ============================================================ */
  function renderTopUpMenu() {
    const box = document.getElementById("topupScroll");
    if (!box) return;
    box.innerHTML = "";

    /* ---- PREMIUM ---- */
    const premiumTitle = document.createElement("div");
    premiumTitle.className = "topup-section-title";
    premiumTitle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" style="vertical-align:middle;margin-right:6px;">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      Sqwid+ Premium
    `;
    box.appendChild(premiumTitle);

    CATALOG.premium.forEach(item => {
      box.appendChild(buildProductRow(item, "premium"));
    });

    /* ---- COINS ---- */
    const coinsTitle = document.createElement("div");
    coinsTitle.className = "topup-section-title";
    coinsTitle.style.marginTop = "1rem";
    coinsTitle.innerHTML = `
      <svg width="16" height="16" style="vertical-align:middle;margin-right:6px;"><use href="#ico-coin"/></svg>
      Сквидики
    `;
    box.appendChild(coinsTitle);

    CATALOG.coins.forEach(item => {
      box.appendChild(buildProductRow(item, "coins"));
    });
  }

  function buildProductRow(item, type) {
    const row = document.createElement("button");
    row.className = "topup-product";
    row.type = "button";

    const icon = type === "premium"
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg width="22" height="22"><use href="#ico-coin"/></svg>`;

    const saveBadge = item.save ? `<span class="topup-save">${item.save}</span>` : "";

    row.innerHTML = `
      <div class="topup-product-left">
        <div class="topup-product-icon">${icon}</div>
        <div class="topup-product-info">
          <div class="topup-product-name">${item.name}</div>
          ${saveBadge}
        </div>
      </div>
      <div class="topup-product-price">${item.price}₽</div>
    `;

    row.addEventListener("click", () => {
      selectProduct(item, type);
    });

    return row;
  }

  /* ============================================================
     ВЫБОР ТОВАРА → ЭКРАН ЗАГЛУШКИ
     ============================================================ */
  let selectedProduct = null;

  function selectProduct(item, type) {
    selectedProduct = { item, type };

    // Закрываем модалку меню
    const modal = document.getElementById("modal-topup");
    if (modal) modal.classList.remove("active");

    // Заполняем экран заглушки
    const nameEl = document.getElementById("paySelectedName");
    const priceEl = document.getElementById("paySelectedPrice");
    const typeEl = document.getElementById("paySelectedType");

    if (typeEl) {
      typeEl.textContent = type === "premium" ? "Sqwid+ Premium" : "Сквидики";
    }
    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) priceEl.textContent = item.price + "₽";

    // Показываем экран заглушки
    S.showScreen("screen-payment-stub");
  }

  /* ============================================================
     КНОПКИ СПОСОБОВ ОПЛАТЫ (пока заглушки)
     ============================================================ */
  document.querySelectorAll("[data-pay-method]").forEach(btn => {
    btn.addEventListener("click", () => {
      const method = btn.dataset.payMethod;
      const methodName = {
        sbp: "СБП",
        card: "Банковская карта",
        crypto: "Криптовалюта"
      }[method] || method;

      S.showToast("Оплата через " + methodName + " пока недоступна", "info", 3000);
    });
  });

  /* ============================================================
     КНОПКИ НАВИГАЦИИ
     ============================================================ */
  // Отмена в модалке меню
  const btnTopUpCancel = document.getElementById("btnTopUpCancel");
  if (btnTopUpCancel) {
    btnTopUpCancel.addEventListener("click", () => {
      const modal = document.getElementById("modal-topup");
      if (modal) modal.classList.remove("active");
    });
  }

  // Назад из экрана заглушки → в профиль (НЕ в меню!)
  const btnBackFromPay = document.getElementById("btnBackFromPay");
  if (btnBackFromPay) {
    btnBackFromPay.addEventListener("click", () => {
      S.showScreen("screen-profile");
    });
  }

  /* ============================================================
     ПРИВЯЗКА КНОПКИ "+" РЯДОМ С БАЛАНСОМ
     ============================================================ */
  function bindPlusButton() {
    const btn = document.getElementById("btnOpenTopUp");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => openTopUp());
  }

  bindPlusButton();
  // Если DOM пересоздали — перепривязываем
  const bindInterval = setInterval(() => {
    bindPlusButton();
    if (document.getElementById("btnOpenTopUp")) {
      clearInterval(bindInterval);
    }
  }, 1000);

  console.log("✅ shop-plus.js готов");
});