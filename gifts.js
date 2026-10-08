/* ============================================================
   gifts.js — подарки: базовые, магазин, от админов, Sqwid+
   + Компактное хранение: имя файла вместо base64
   ============================================================ */

console.log("🚀 gifts.js загружен, жду Sqwid...");

function waitForSqwidGifts(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ gifts.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidGifts((S) => {
  const { db, ref, get, set, push, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 gifts.js активирован");

  /* ============================================================
     КОНСТАНТЫ
     ============================================================ */
  const BASE_GIFTS = [
    { id: "gift_roketa",   name: "Ракета",       icon: "roketa.png",   price: 250, glow: "#ff6b6b" },
    { id: "gift_starblue", name: "Синяя звезда", icon: "starblue.png", price: 350, glow: "#3b82f6" },
    { id: "gift_stars",    name: "Звёзды",       icon: "stars.png",    price: 500, glow: "#f7b500" },
    { id: "gift_demon",    name: "Демон",        icon: "demon.png",    price: 750, glow: "#a855f7" }
  ];

  const PLUS_TARIFFS = [
    { months: 1, price: 1500 },
    { months: 3, price: 4500 },
    { months: 6, price: 9000 }
  ];

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  let recipientUid = null;
  let recipientData = {};
  let pending = null;

  let shopGifts = {};
  let normalGifts = {};

  /* ============================================================
     ХЕЛПЕР: получить "ссылку" на иконку (без base64)
     ============================================================ */
  function getIconPath(item) {
    if (!item || !item.icon) return "sqwidstar.png";
    // Если это уже base64 — оставляем как есть (обратная совместимость)
    if (typeof item.icon === "string" && item.icon.startsWith("data:")) {
      return item.icon;
    }
    // Если это уже имя файла — оставляем
    return item.icon;
  }

  /* ============================================================
     КОНФЕТТИ
     ============================================================ */
  function fireConfetti() {
    let layer = document.getElementById("confettiLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "confettiLayer";
      layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
      document.body.appendChild(layer);
    }
    layer.style.display = "block";

    if (!document.getElementById("confettiKeyframes")) {
      const st = document.createElement("style");
      st.id = "confettiKeyframes";
      st.textContent = `
        @keyframes confettiFall {
          0% { transform: translateY(-30px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(st);
    }

    const emojis = ["✨", "⭐", "🎉", "💛", "🌟", "💫", "🎊"];
    const colors = ["#f59e0b", "#ffd966", "#ff6b6b", "#10b981", "#60a5fa", "#a855f7"];
    const pieces = [];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement("span");
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = `
        position:absolute;top:-30px;font-size:${16 + Math.random() * 16}px;
        left:${Math.random() * 100}%;user-select:none;will-change:transform,opacity;
        animation:confettiFall ${1.6 + Math.random() * 1.4}s cubic-bezier(0.4, 0.1, 0.7, 1) forwards;
        animation-delay:${Math.random() * 0.3}s;
        color:${colors[Math.floor(Math.random() * colors.length)]};
      `;
      layer.appendChild(el);
      pieces.push(el);
    }
    setTimeout(() => {
      pieces.forEach(p => p.remove());
      layer.style.display = "none";
    }, 3200);
  }

  /* ============================================================
     ПОДПИСКИ
     ============================================================ */
  onValue(ref(db, "shop/gifts"), (snap) => {
    shopGifts = snap.val() || {};
    const scr = document.getElementById("screen-give-gift");
    if (scr && scr.classList.contains("active")) renderAll();
  });

  onValue(ref(db, "shop/normal_gifts"), (snap) => {
    normalGifts = snap.val() || {};
    const scr = document.getElementById("screen-give-gift");
    if (scr && scr.classList.contains("active")) renderAll();
  });

  /* ============================================================
     ОТКРЫТИЕ ЭКРАНА ПОДАРКОВ
     ============================================================ */
  async function openGiftScreen(uid) {
    console.log("🎁 openGiftScreen для:", uid);
    if (!uid) return S.showAlert("Не удалось определить получателя", "Ошибка");
    if (uid === currentUser.uid) return S.showAlert("Себе дарить нельзя 🙂", "Ошибка");

    const snap = await get(ref(db, "users/" + uid));
    const u = snap.val();
    if (!u) return S.showAlert("Пользователь не найден", "Ошибка");

    recipientUid = uid;
    recipientData = u;

    const photoEl = document.getElementById("giftRecipientPhoto");
    if (photoEl) {
      if (u.photo && u.photo.startsWith("data:image")) {
        photoEl.src = u.photo;
      } else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110"><rect width="100%" height="100%" fill="#6366f1"/><text x="50%" y="55%" font-size="48" fill="#fff" text-anchor="middle" font-family="Arial">${letter}</text></svg>`;
        photoEl.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      }
    }
    const nameEl = document.getElementById("giftRecipientName");
    if (nameEl) nameEl.textContent = u.name || u.email || "Пользователь";

    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    const balEl = document.getElementById("giftMyBalance");
    if (balEl) balEl.textContent = "🪙 " + (me.coins || 0) + " SQ";

    renderAll();
    S.showScreen("screen-give-gift");
  }

  if (window.Sqwid) {
    window.Sqwid.openGiftScreen = openGiftScreen;
  }

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function renderAll() {
    renderPlusGrid();
    renderBaseGifts();
    renderShopGifts();
    renderNormalGifts();
  }

  function renderPlusGrid() {
    const grid = document.getElementById("giftPlusGrid");
    if (!grid) return;
    grid.innerHTML = "";
    PLUS_TARIFFS.forEach(t => {
      const card = document.createElement("button");
      card.className = "gift-plus-card";
      card.innerHTML = `
        <img src="sqwidstar.png" alt="">
        <div class="gift-plus-title">${t.months} мес.</div>
        <div class="gift-plus-price">🪙 ${t.price}</div>
      `;
      card.onclick = () => openConfirm("plus", t);
      grid.appendChild(card);
    });
  }

  function renderBaseGifts() {
    const grid = document.getElementById("giftGrid");
    if (!grid) return;
    grid.innerHTML = "";
    BASE_GIFTS.forEach(g => {
      const card = document.createElement("button");
      card.className = "gift-card";
      card.innerHTML = `
        <img src="${g.icon}" alt="" style="filter:drop-shadow(0 0 8px ${g.glow});">
        <div class="gift-card-name">${escH(g.name)}</div>
        <div class="gift-card-price">🪙 ${g.price}</div>
      `;
      card.onclick = () => openConfirm("gift", { ...g, source: "base" });
      grid.appendChild(card);
    });
  }

  function renderShopGifts() {
    const container = document.querySelector("#screen-give-gift .gift-body");
    if (!container) return;

    let block = document.getElementById("giftShopBlock");
    if (!block) {
      block = document.createElement("div");
      block.id = "giftShopBlock";
      block.innerHTML = `
        <h3 class="gift-section-title">🏪 Подарки из магазина</h3>
        <div class="gift-grid" id="giftShopGrid"></div>
        <div id="giftShopEmpty" style="display:none;text-align:center;color:#94a3b8;font-size:13px;padding:12px;">Пока нет подарков</div>
      `;
      const giftGrid = document.getElementById("giftGrid");
      if (giftGrid && giftGrid.parentElement) {
        giftGrid.parentElement.insertBefore(block, giftGrid.nextSibling);
      } else {
        container.appendChild(block);
      }
    }

    const grid = document.getElementById("giftShopGrid");
    const empty = document.getElementById("giftShopEmpty");
    if (!grid) return;
    grid.innerHTML = "";

    const items = Object.values(shopGifts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (items.length === 0) {
      grid.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }
    grid.style.display = "grid";
    if (empty) empty.style.display = "none";

    items.forEach(item => {
      const left = (item.stock || 0) - (item.sold || 0);
      const outOfStock = left <= 0;
      const card = document.createElement("button");
      card.className = "gift-card";
      card.style.opacity = outOfStock ? "0.4" : "1";
      card.style.pointerEvents = outOfStock ? "none" : "auto";
      card.innerHTML = `
        <img src="${item.icon}" alt="" style="filter:drop-shadow(0 0 8px ${item.glow || "#f59e0b"});">
        <div class="gift-card-name">${escH(item.name || "Подарок")}</div>
        <div class="gift-card-price">🪙 ${item.price || 0}</div>
        ${outOfStock
          ? `<div style="font-size:10px;color:#ef4444;font-weight:800;margin-top:4px;">РАСПРОДАНО</div>`
          : (left <= 5 ? `<div style="font-size:10px;color:#f59e0b;font-weight:800;margin-top:4px;">Осталось ${left}</div>` : "")}
      `;
      card.onclick = () => openConfirm("gift", { ...item, source: "shop" });
      grid.appendChild(card);
    });
  }

  function renderNormalGifts() {
    const container = document.querySelector("#screen-give-gift .gift-body");
    if (!container) return;

    let block = document.getElementById("normalGiftBlock");
    if (!block) {
      block = document.createElement("div");
      block.id = "normalGiftBlock";
      block.innerHTML = `
        <h3 class="gift-section-title">👑 Подарки от админов</h3>
        <div class="gift-grid" id="normalGiftGrid"></div>
        <div id="normalGiftEmpty" style="display:none;text-align:center;color:#94a3b8;font-size:13px;padding:12px;">Пока нет подарков</div>
      `;
      const shopBlock = document.getElementById("giftShopBlock");
      if (shopBlock && shopBlock.parentElement) {
        shopBlock.parentElement.insertBefore(block, shopBlock.nextSibling);
      } else {
        container.appendChild(block);
      }
    }

    const grid = document.getElementById("normalGiftGrid");
    const empty = document.getElementById("normalGiftEmpty");
    if (!grid) return;
    grid.innerHTML = "";

    const items = Object.values(normalGifts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (items.length === 0) {
      grid.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }
    grid.style.display = "grid";
    if (empty) empty.style.display = "none";

    items.forEach(item => {
      const left = (item.stock || 0) - (item.sold || 0);
      const outOfStock = left <= 0;
      const card = document.createElement("button");
      card.className = "gift-card";
      card.style.opacity = outOfStock ? "0.4" : "1";
      card.style.pointerEvents = outOfStock ? "none" : "auto";
      card.innerHTML = `
        <img src="${item.icon}" alt="">
        <div class="gift-card-name">${escH(item.name || "Подарок")}</div>
        <div class="gift-card-price">🪙 ${item.price || 0}</div>
        ${outOfStock
          ? `<div style="font-size:10px;color:#ef4444;font-weight:800;margin-top:4px;">РАСПРОДАНО</div>`
          : (left <= 5 ? `<div style="font-size:10px;color:#f59e0b;font-weight:800;margin-top:4px;">Осталось ${left}</div>` : "")}
      `;
      card.onclick = () => openConfirm("gift", { ...item, source: "normal" });
      grid.appendChild(card);
    });
  }

  /* ============================================================
     ОКНО ПОДТВЕРЖДЕНИЯ
     ============================================================ */
  function openConfirm(kind, item) {
    pending = { kind, item };
    const title = document.getElementById("sendGiftTitle");
    const img = document.getElementById("sendGiftImage");
    const name = document.getElementById("sendGiftName");
    const price = document.getElementById("sendGiftPrice");

    if (kind === "plus") {
      title.textContent = "Подарить Sqwid+?";
      img.src = "sqwidstar.png";
      name.textContent = "Sqwid+ " + item.months + " мес.";
    } else {
      title.textContent = "Отправить подарок?";
      img.src = item.icon;
      name.textContent = item.name;
    }
    price.textContent = item.price;

    document.getElementById("sendGiftMessage").value = "";
    document.getElementById("sendGiftHideName").checked = false;
    document.getElementById("modal-send-gift").classList.add("active");
  }

  const btnSendCancel = document.getElementById("btnSendGiftCancel");
  if (btnSendCancel) {
    btnSendCancel.addEventListener("click", () => {
      document.getElementById("modal-send-gift").classList.remove("active");
      pending = null;
    });
  }

  const btnSendConfirm = document.getElementById("btnSendGiftConfirm");
  if (btnSendConfirm) {
    btnSendConfirm.addEventListener("click", sendGift);
  }

  /* ============================================================
     ОТПРАВКА ПОДАРКА
     ============================================================ */
  async function sendGift() {
    if (!pending || !recipientUid) return;
    const { kind, item } = pending;
    const price = item.price;

    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    const myCoins = me.coins || 0;
    if (myCoins < price) {
      document.getElementById("modal-send-gift").classList.remove("active");
      return S.showAlert(`Недостаточно SQ.\n\nНужно: ${price}\nУ вас: ${myCoins}`, "Мало монет");
    }

    const msg = (document.getElementById("sendGiftMessage").value || "").trim();
    const hideName = document.getElementById("sendGiftHideName").checked;

    // ВАЖНО: получаем ИМЯ ФАЙЛА, а не base64
    const iconPath = getIconPath(item);

    try {
      await update(ref(db, "users/" + currentUser.uid), { coins: myCoins - price });

      let giftName, giftIcon, giftKind = kind;
      let plusMonths = 0;

      if (kind === "plus") {
        giftName = "Sqwid+ " + item.months + " мес.";
        giftIcon = "sqwidstar.png";
        plusMonths = item.months;

        const now = Date.now();
        let baseTime = now;
        if (recipientData.isPlus && recipientData.plusUntil && recipientData.plusUntil > now) {
          baseTime = recipientData.plusUntil;
        }
        const plusUntil = baseTime + item.months * 30 * 24 * 60 * 60 * 1000;
        await update(ref(db, "users/" + recipientUid), { isPlus: true, plusUntil });

        await sendBotNotification(recipientUid, {
          type: "gift",
          text: `⭐ ${hideName ? "Аноним" : (me.name || "Пользователь")} подарил(а) вам Sqwid+ на ${item.months} мес.${msg ? "\n\n💬 " + msg : ""}`
        });
      }

      if (kind === "gift") {
        giftName = item.name;
        giftIcon = iconPath;

        if (item.source === "shop" || item.source === "normal") {
          const path = item.source === "shop" ? "shop/gifts/" : "shop/normal_gifts/";
          const fresh = (await get(ref(db, path + item.id))).val() || {};
          const left = (fresh.stock || 0) - (fresh.sold || 0);
          if (left <= 0) {
            await update(ref(db, "users/" + currentUser.uid), { coins: myCoins });
            document.getElementById("modal-send-gift").classList.remove("active");
            return S.showAlert("Подарок распродан", "Ошибка");
          }
          await update(ref(db, path + item.id), { sold: (fresh.sold || 0) + 1 });
        }

        // ВАЖНО: сохраняем ТОЛЬКО имя файла в icon
        const giftRef = push(ref(db, "users/" + recipientUid + "/gifts"));
        await set(giftRef, {
          giftId: item.id,
          name: item.name,
          icon: iconPath,       // ← имя файла, не base64
          price: item.price,
          glow: item.glow || null,
          fromUid: currentUser.uid,
          fromName: hideName ? "Аноним" : (me.name || "Пользователь"),
          fromUsername: hideName ? "" : (me.username || ""),
          hideName: hideName,
          message: msg,
          source: item.source || "base",
          receivedAt: Date.now()
        });

        await sendBotNotification(recipientUid, {
          type: "gift",
          text: `🎁 ${hideName ? "Аноним" : (me.name || "Пользователь")} подарил(а) вам подарок «${item.name}».${msg ? "\n\n💬 " + msg : ""}`
        });
      }

      const logRef = push(ref(db, "gifts"));
      await set(logRef, {
        kind: giftKind,
        name: giftName,
        icon: giftIcon,   // ← имя файла
        price,
        months: plusMonths,
        fromUid: currentUser.uid,
        fromName: me.name || "Пользователь",
        fromUsername: me.username || "",
        toUid: recipientUid,
        toName: recipientData.name || "Пользователь",
        hideName,
        message: msg,
        giftId: item && item.id ? item.id : null,
        source: item && item.source ? item.source : "plus",
        timestamp: Date.now()
      });

      await sendGiftMessageToChat({
        kind: giftKind,
        name: giftName,
        icon: giftIcon,
        price,
        message: msg,
        hideName,
        fromUid: currentUser.uid,
        fromName: me.name || "Пользователь",
        fromUsername: me.username || ""
      }, recipientData.name || "Пользователь");

      fireConfetti();

      document.getElementById("modal-send-gift").classList.remove("active");
      pending = null;

      setTimeout(() => {
        S.showScreen("screen-user-profile");
      }, 300);

    } catch (e) {
      try { await update(ref(db, "users/" + currentUser.uid), { coins: myCoins }); } catch (e2) {}
      S.showAlert("Ошибка: " + e.message, "Ошибка");
    }
  }

  /* ============================================================
     СООБЩЕНИЕ В ЧАТ
     ============================================================ */
  async function sendGiftMessageToChat(payload, recipientName) {
    const snap = await get(ref(db, "chats"));
    const chats = snap.val() || {};
    let chatId = null;

    for (const id in chats) {
      const c = chats[id];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[currentUser.uid] && m[recipientUid] && Object.keys(m).length === 2) {
        chatId = id;
        break;
      }
    }

    if (!chatId) {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: recipientName || "Чат",
        type: "private",
        members: { [currentUser.uid]: true, [recipientUid]: true },
        owner: currentUser.uid,
        description: "",
        photo: null,
        lastMsg: "🎁 Подарок",
        lastMsgAt: Date.now()
      });
      chatId = newRef.key;
    }

    // ВАЖНО: в сообщении тоже только имя файла
    await push(ref(db, "messages/" + chatId), {
      sender: currentUser.uid,
      type: "gift",
      gift: {
        name: payload.name,
        icon: payload.icon,   // ← имя файла
        price: payload.price,
        message: payload.message,
        hideName: payload.hideName,
        kind: payload.kind,
        fromUid: payload.fromUid,
        fromName: payload.fromName,
        fromUsername: payload.fromUsername
      },
      timestamp: Date.now()
    });

    await update(ref(db, "chats/" + chatId), {
      lastMsg: "🎁 Подарок: " + payload.name,
      lastMsgAt: Date.now(),
      lastMsgSender: currentUser.uid
    });
  }

  async function sendBotNotification(uid, notification) {
    try {
      const botRef = ref(db, "botChat/" + uid);
      const newRef = push(botRef);
      await set(newRef, { ...notification, timestamp: Date.now() });
    } catch (e) {}
  }

  /* ============================================================
     КНОПКИ
     ============================================================ */
  const btnUpGift = document.getElementById("btnUpGift");
  if (btnUpGift) {
    btnUpGift.removeAttribute("onclick");
    btnUpGift.onclick = () => {
      const uid = window.Sqwid && window.Sqwid.viewingProfileUid;
      if (!uid) return S.showAlert("Получатель не выбран", "Ошибка");
      openGiftScreen(uid);
    };
  }

  const btnBack = document.getElementById("btnBackGiveGift");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      pending = null;
      if (window.Sqwid && window.Sqwid.viewingProfileUid) {
        S.showScreen("screen-user-profile");
      } else {
        S.showScreen("screen-chats");
      }
    });
  }

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  console.log("✅ gifts.js готов");
});