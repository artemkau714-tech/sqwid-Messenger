/* ============================================================
   shop-plus.js — ФИНАЛЬНАЯ ВЕРСИЯ (С экраном подтверждения)
   ============================================================ */

console.log("🚀 shop-plus.js загружен");

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
  const { db, ref, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 shop-plus.js активирован");

  // ТВОЙ URL ВОРКЕРА
  const WORKER_URL = "https://sqwid.artemkau714.workers.dev/create-payment"; 

  let myData = {};
  let currentCheckoutData = null; // Данные текущей покупки

  /* ============================================================
     КАТАЛОГ ТАРИФОВ
     ============================================================ */
  const CATALOG = {
    premium: [
      { id: "plus_1m", name: "1 месяц",   price: 199,  months: 1 },
      { id: "plus_3m", name: "3 месяца",  price: 800,  months: 3,  save: "Экономия 200₽" },
      { id: "plus_6m", name: "6 месяцев", price: 1600, months: 6,  save: "Экономия 400₽" }
    ]
  };

  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
  });

  /* ============================================================
     ОТКРЫТИЕ МОДАЛКИ ВЫБОРА ТАРИФА
     ============================================================ */
  function openTopUp() {
    const modal = document.getElementById("modal-topup");
    if (!modal) return;
    renderTopUpMenu();
    modal.classList.add("active");
    const scroll = document.getElementById("topupScroll");
    if (scroll) scroll.scrollTop = 0;
  }
  window.Sqwid.openTopUp = openTopUp;

  /* ============================================================
     РЕНДЕР МЕНЮ ВЫБОРА ТАРИФА (Внутри модалки)
     ============================================================ */
  function renderTopUpMenu() {
    const box = document.getElementById("topupScroll");
    if (!box) return;
    box.innerHTML = "";

    /* ---- Кнопка "Что даёт Sqwid+?" ---- */
    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.style.cssText = `
      width: 100%; padding: 0.7rem 0.9rem;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(236, 72, 153, 0.1));
      border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem;
      color: var(--text); font-family: inherit; font-size: 0.85rem; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; margin-bottom: 0.6rem;
    `;
    infoBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      Что даёт Sqwid+?
    `;
    infoBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-topup");
      if (modal) modal.classList.remove("active");
      if (window.Sqwid.openPlusInfo) window.Sqwid.openPlusInfo();
    });
    box.appendChild(infoBtn);

    /* ---- Тарифы ---- */
    CATALOG.premium.forEach(item => {
      box.appendChild(buildProductRow(item, "premium"));
    });

    /* ---- Плашка про сквидики ---- */
    const coinsInfo = document.createElement("div");
    coinsInfo.style.cssText = `
      margin-top: 1rem; padding: 0.75rem 1rem;
      background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 0.75rem; display: flex; align-items: center; gap: 0.6rem;
      font-size: 0.82rem; color: var(--text-2); line-height: 1.4;
    `;
    coinsInfo.innerHTML = `
      <svg width="20" height="20" style="flex-shrink:0;"><use href="#ico-coin"/></svg>
      <div><b style="color:var(--text);">Сквидики зарабатываются в играх</b><br>Заходи в Sqwid Games и получай SQ.</div>
    `;
    box.appendChild(coinsInfo);
  }

  /* ============================================================
     КАРТОЧКА ТАРИФА
     ============================================================ */
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

    // 🔥 ПРИ КЛИКЕ ОТКРЫВАЕМ НАШ НОВЫЙ ЭКРАН
    row.addEventListener("click", () => {
      openCheckoutScreen(item, type);
    });

    return row;
  }

  /* ============================================================
     ЭКРАН ПОДТВЕРЖДЕНИЯ ОПЛАТЫ (Checkout)
     ============================================================ */
  function openCheckoutScreen(item, type) {
    // Закрываем модалку выбора тарифа
    const modal = document.getElementById("modal-topup");
    if (modal) modal.classList.remove("active");

    // Сохраняем данные текущей покупки
    currentCheckoutData = { item, type };

    // Заполняем данные на экране
    const nameEl = document.getElementById("checkoutName");
    const descEl = document.getElementById("checkoutDesc");
    const periodEl = document.getElementById("checkoutPeriod");
    const priceSubEl = document.getElementById("checkoutPriceSub");
    const priceTotalEl = document.getElementById("checkoutPriceTotal");
    const btnPriceEl = document.getElementById("btnFinalPayPrice");

    const formattedPrice = item.price.toLocaleString("ru-RU") + ",00 ₽";
    
    if (nameEl) nameEl.textContent = (type === "business" ? "Business: " : "Sqwid+: ") + item.name;
    if (descEl) descEl.textContent = type === "business" ? "Ваш доступ к бизнес-функциям." : "Ваш доступ к десяткам эксклюзивных функций.";
    if (periodEl) periodEl.textContent = item.months === 1 ? "Ежемесячный платёж" : "Платёж за " + item.months + " мес.";
    if (priceSubEl) priceSubEl.textContent = formattedPrice;
    if (priceTotalEl) priceTotalEl.textContent = formattedPrice;
    if (btnPriceEl) btnPriceEl.textContent = formattedPrice;

    // Сбрасываем галочку и кнопку
    const agree = document.getElementById("checkoutAgree");
    if (agree) agree.checked = false;
    updatePayButtonState();

    // Переходим на экран
    S.showScreen("screen-checkout");
  }

  function updatePayButtonState() {
    const agree = document.getElementById("checkoutAgree");
    const btn = document.getElementById("btnFinalPay");
    if (!agree || !btn) return;

    if (agree.checked) {
      btn.style.background = "linear-gradient(135deg, #8b5cf6, #ec4899)";
      btn.style.color = "#fff";
      btn.style.cursor = "pointer";
    } else {
      btn.style.background = "#4b5563";
      btn.style.color = "rgba(255,255,255,0.5)";
      btn.style.cursor = "not-allowed";
    }
  }

  // Привязка галочки
  const agreeCheckbox = document.getElementById("checkoutAgree");
  if (agreeCheckbox) {
    const newChk = agreeCheckbox.cloneNode(true);
    agreeCheckbox.parentNode.replaceChild(newChk, agreeCheckbox);
    newChk.addEventListener("change", updatePayButtonState);
  }

  // Привязка кнопки "ЗАПЛАТИТЬ" (Отправка на воркер)
  const btnFinalPay = document.getElementById("btnFinalPay");
  if (btnFinalPay) {
    const newBtn = btnFinalPay.cloneNode(true);
    btnFinalPay.parentNode.replaceChild(newBtn, btnFinalPay);
    
    newBtn.addEventListener("click", async () => {
      const agree = document.getElementById("checkoutAgree");
      if (!agree || !agree.checked) return;
      if (!currentCheckoutData) return;

      const { item, type } = currentCheckoutData;

      // Меняем текст кнопки на время загрузки
      newBtn.textContent = "Создаём платёж...";
      newBtn.disabled = true;

      try {
        const response = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: currentUser.uid,
            planId: item.id,
            type: type,
            price: item.price,
            name: item.name
          }),
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);
        if (!data.redirect) throw new Error("Воркер не вернул ссылку на оплату (redirect)");

        // 🔥 ПЕРЕХОД НА САЙТ ОПЛАТЫ
        window.location.href = data.redirect;

      } catch (e) {
        console.error("Ошибка оплаты:", e);
        S.showAlert("Ошибка оплаты: " + e.message + "\n\nПроверьте, работает ли ваш воркер.", "Ошибка");
        newBtn.textContent = "ЗАПЛАТИТЬ " + item.price.toLocaleString("ru-RU") + ",00 ₽";
        newBtn.disabled = false;
      }
    });
  }

  // Кнопка "Назад" на экране чекаута
  const btnBackCheckout = document.getElementById("btnBackCheckout");
  if (btnBackCheckout) {
    const newBack = btnBackCheckout.cloneNode(true);
    btnBackCheckout.parentNode.replaceChild(newBack, btnBackCheckout);
    newBack.addEventListener("click", () => {
      // Возвращаемся на экран подписки
      const type = currentCheckoutData ? currentCheckoutData.type : "premium";
      S.showScreen(type === "business" ? "screen-settings-business" : "screen-settings-plus");
    });
  }

  /* ============================================================
     МОДАЛКА "ЧТО ДАЁТ SQWID+"
     ============================================================ */
  const PLUS_FEATURES = [
    { title: "Увеличенные лимиты", desc: "4000 символов в сообщении.", svg: `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>` },
    { title: "Больше участников", desc: "До 50 человек в группе.", svg: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    { title: "Кастомный ник", desc: "Цвет, шрифт и значок возле имени.", svg: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` },
    { title: "Фон профиля", desc: "Своя картинка за профилем + соцсети.", svg: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` },
    { title: "Больше реакций", desc: "Дополнительные эмодзи для реакций.", svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>` },
    { title: "Бонус +10% в играх", desc: "Каждый выигрыш увеличивается на 10%.", svg: `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` },
    { title: "Без дневного лимита", desc: "Играй без ограничений в 100 000 SQ.", svg: `<svg viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7l-9-5z"/></svg>` },
    { title: "Ежедневный бонус", desc: "+50 SQ в подарок каждый день.", svg: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    { title: "Автоудаление 1ч / 12ч", desc: "В группах доступны короткие интервалы.", svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>` },
    { title: "Значок Sqwid+", desc: "Особая рамка вокруг аватара.", svg: `<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` }
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
    if (!modal) return;
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

  const btnTopUpCancel = document.getElementById("btnTopUpCancel");
  if (btnTopUpCancel) {
    btnTopUpCancel.addEventListener("click", () => {
      const modal = document.getElementById("modal-topup");
      if (modal) modal.classList.remove("active");
    });
  }

  console.log("✅ shop-plus.js полностью готов (с экраном оплаты)");
});