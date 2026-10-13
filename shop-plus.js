/* ============================================================
   shop-plus.js — Покупка Sqwid+ Premium
   Кнопка "+" остаётся, но пакеты SQ убраны
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
     КАТАЛОГ — ТОЛЬКО ПРЕМИУМ, БЕЗ ПАКЕТОВ SQ
     ============================================================ */
  const CATALOG = {
    premium: [
      { id: "plus_1m", name: "1 месяц",   price: 199,  months: 1 },
      { id: "plus_3m", name: "3 месяца",  price: 800,  months: 3,  save: "Экономия 200₽" },
      { id: "plus_6m", name: "6 месяцев", price: 1600, months: 6,  save: "Экономия 400₽" }
    ]
  };

  /* ============================================================
     ПОДПИСКА НА СВОИ ДАННЫЕ
     ============================================================ */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
  });

  /* ============================================================
     ОТКРЫТИЕ МЕНЮ (по кнопке "+" или "Купить Sqwid+")
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

    /* ---- Информация о сквидиках ---- */
    const coinsInfo = document.createElement("div");
    coinsInfo.style.cssText = `
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.82rem;
      color: var(--text-2);
      line-height: 1.4;
    `;
    coinsInfo.innerHTML = `
      <svg width="20" height="20" style="flex-shrink:0;"><use href="#ico-coin"/></svg>
      <div>
        <b style="color:var(--text);">Сквидики зарабатываются в играх</b><br>
        Заходи в Sqwid Games и получай SQ за победы, квесты и активность.
      </div>
    `;
    box.appendChild(coinsInfo);
  }

  function buildProductRow(item, type) {
    const row = document.createElement("button");
    row.className = "topup-product";
    row.type = "button";

    const icon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

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

    const modal = document.getElementById("modal-topup");
    if (modal) modal.classList.remove("active");

    const nameEl = document.getElementById("paySelectedName");
    const priceEl = document.getElementById("paySelectedPrice");
    const typeEl = document.getElementById("paySelectedType");

    if (typeEl) typeEl.textContent = "Sqwid+ Premium";
    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) priceEl.textContent = item.price + "₽";

    S.showScreen("screen-payment-stub");
  }

  /* ============================================================
     КНОПКИ СПОСОБОВ ОПЛАТЫ (заглушки)
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
  const btnTopUpCancel = document.getElementById("btnTopUpCancel");
  if (btnTopUpCancel) {
    btnTopUpCancel.addEventListener("click", () => {
      const modal = document.getElementById("modal-topup");
      if (modal) modal.classList.remove("active");
    });
  }

  const btnBackFromPay = document.getElementById("btnBackFromPay");
  if (btnBackFromPay) {
    btnBackFromPay.addEventListener("click", () => {
      S.showScreen("screen-profile");
    });
  }

  /* ============================================================
     ПРИВЯЗКА КНОПОК
     ============================================================ */
  function bindButtons() {
    // Кнопка "+" рядом с балансом
    const btnPlus = document.getElementById("btnOpenTopUp");
    if (btnPlus && !btnPlus.dataset.bound) {
      btnPlus.dataset.bound = "1";
      btnPlus.addEventListener("click", () => openTopUp());
    }

    // Отдельная кнопка "Купить Sqwid+" (если есть в HTML)
    const btnBuyPlus = document.getElementById("btnBuySqwidPlus");
    if (btnBuyPlus && !btnBuyPlus.dataset.bound) {
      btnBuyPlus.dataset.bound = "1";
      btnBuyPlus.addEventListener("click", () => openTopUp());
    }
  }

  bindButtons();
  setInterval(bindButtons, 1000);

  console.log("✅ shop-plus.js готов (только Sqwid+)");
});
