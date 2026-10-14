/* ============================================================
   shop-plus.js — Покупка Sqwid+ Premium
   Без пополнения баланса: только прямая покупка подписки
   + Модалка "Что даёт Sqwid+"
   + Кнопка "Купить Premium" в профиле (без кнопки "+")
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
     КАТАЛОГ — ТОЛЬКО PREMIUM
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
     ОТКРЫТИЕ МОДАЛКИ
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
     РЕНДЕР МОДАЛКИ
     ============================================================ */
  function renderTopUpMenu() {
    const box = document.getElementById("topupScroll");
    if (!box) return;
    box.innerHTML = "";

    /* ---- Кнопка "Что даёт Sqwid+?" ---- */
    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.style.cssText = `
      width: 100%;
      padding: 0.7rem 0.9rem;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(236, 72, 153, 0.1));
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 0.75rem;
      color: var(--text);
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    `;
    infoBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      Что даёт Sqwid+?
    `;
    infoBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-topup");
      if (modal) modal.classList.remove("active");
      openPlusInfo();
    });
    box.appendChild(infoBtn);

    /* ---- Тарифы ---- */
    CATALOG.premium.forEach(item => {
      box.appendChild(buildProductRow(item, "premium"));
    });

    /* ---- Плашка про сквидики ---- */
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
     МОДАЛКА "ЧТО ДАЁТ SQWID+"
     ============================================================ */
  const PLUS_FEATURES = [
    {
      title: "Увеличенные лимиты",
      desc: "4000 символов в сообщении вместо 500.",
      svg: `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>`
    },
    {
      title: "Больше участников",
      desc: "До 50 человек в группе вместо 20.",
      svg: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
    {
      title: "Кастомный ник",
      desc: "Цвет, шрифт и значок возле имени в профиле и чатах.",
      svg: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
    },
    {
      title: "Фон профиля",
      desc: "Своя картинка за профилем + соцсети (Telegram, Instagram, YouTube).",
      svg: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
    },
    {
      title: "Больше реакций",
      desc: "Дополнительные эмодзи для реакций на сообщения.",
      svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`
    },
    {
      title: "Бонус +10% в играх",
      desc: "Каждый выигрыш в Sqwid Games увеличивается на 10%.",
      svg: `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
    },
    {
      title: "Без дневного лимита",
      desc: "Обычные юзеры ограничены 100 000 SQ в день. У Sqwid+ лимита нет.",
      svg: `<svg viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7l-9-5z"/></svg>`
    },
    {
      title: "Ежедневный бонус",
      desc: "+50 SQ в подарок каждый день.",
      svg: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    {
      title: "Автоудаление 1ч / 12ч",
      desc: "В группах доступны короткие интервалы автоудаления сообщений.",
      svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`
    },
    {
      title: "Значок Sqwid+",
      desc: "Особая рамка вокруг аватара и плашка в профиле.",
      svg: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    }
  ];

  function renderPlusInfo() {
    const box = document.getElementById("plusInfoList");
    if (!box) return;
    box.innerHTML = "";

    PLUS_FEATURES.forEach((feat, i) => {
      const item = document.createElement("div");
      item.className = "plus-info-item";
      item.style.animationDelay = (i * 0.03) + "s";
      item.innerHTML = `
        <div class="plus-info-icon">${feat.svg}</div>
        <div class="plus-info-body">
          <div class="plus-info-title">${feat.title}</div>
          <div class="plus-info-desc">${feat.desc}</div>
        </div>
      `;
      box.appendChild(item);
    });
  }

  function openPlusInfo() {
    const modal = document.getElementById("modal-plus-info");
    if (!modal) {
      console.warn("shop-plus: нет #modal-plus-info в HTML");
      return;
    }
    renderPlusInfo();
    modal.classList.add("active");
  }
  window.Sqwid.openPlusInfo = openPlusInfo;

  const btnPlusInfoClose = document.getElementById("btnPlusInfoClose");
  if (btnPlusInfoClose) {
    btnPlusInfoClose.addEventListener("click", () => {
      const modal = document.getElementById("modal-plus-info");
      if (modal) modal.classList.remove("active");
    });
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
     ПРИВЯЗКА КНОПКИ "КУПИТЬ PREMIUM"
     ============================================================ */
  function bindBuyPremiumButton() {
    const btn = document.getElementById("btnBuyPremium");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => openTopUp());
  }

  bindBuyPremiumButton();
  setInterval(bindBuyPremiumButton, 1000);

  console.log("✅ shop-plus.js готов");
});