/* ============================================================
   trade.js — система торгов между юзерами
   ============================================================ */

console.log("🚀 trade.js загружен, жду Sqwid...");

function waitForSqwidTrade(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ trade.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidTrade((S) => {
  const { db, ref, get, set, push, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 trade.js активирован");

  let tradeId = null;
  let tradeData = null;
  let currentPartnerUid = null;
  let myShopItems = [];
  let unsubTrade = null;
  let exchanging = false;

  onValue(ref(db, "shop/items"), (snap) => {
    myShopItems = Object.values(snap.val() || {});
  });

  /* ============================================================
     ОТКРЫТИЕ ТОРГА
     ============================================================ */
  async function openTrade(partnerUid) {
    if (!partnerUid || partnerUid === currentUser.uid) return;
    currentPartnerUid = partnerUid;

    const snap = await get(ref(db, "trades"));
    const all = snap.val() || {};
    let existing = null;
    for (const id in all) {
      const tr = all[id];
      if (tr.status !== "active") continue;
      const m = tr.members || {};
      if (m[currentUser.uid] && m[partnerUid] && Object.keys(m).length === 2) {
        existing = id;
        break;
      }
    }

    if (existing) {
      tradeId = existing;
    } else {
      const newRef = push(ref(db, "trades"));
      tradeId = newRef.key;
      await set(newRef, {
        members: { [currentUser.uid]: true, [partnerUid]: true },
        status: "active",
        offers: {
          [currentUser.uid]: {},
          [partnerUid]: {}
        },
        accepted: {},
        createdAt: Date.now()
      });

      const meName = (S.currentUserData && S.currentUserData.name) || currentUser.email;
      const botRef = push(ref(db, "botChat/" + partnerUid));
      await set(botRef, {
        from: "Sqwid Moderator",
        text: `🤝 ${meName} начал торг с вами. Откройте чат, чтобы принять или отказаться.`,
        timestamp: Date.now(),
        type: "system",
        kind: "moderator"
      });
    }

    if (unsubTrade) unsubTrade();
    unsubTrade = onValue(ref(db, "trades/" + tradeId), (snap) => {
      tradeData = snap.val() || {};
      renderTrade();
      checkBothAccepted();
    });

    S.showScreen("screen-trade");
  }

  window.Sqwid.openTrade = openTrade;

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function renderTrade() {
    if (!tradeData) return;

    const myOffer = (tradeData.offers && tradeData.offers[currentUser.uid]) || {};
    const otherOffer = (tradeData.offers && tradeData.offers[currentPartnerUid]) || {};

    const myBox = document.getElementById("tradeMyItems");
    myBox.innerHTML = "";
    Object.entries(myOffer).forEach(([key, item]) => {
      myBox.appendChild(buildTradeItem(key, item, true));
    });
    if (Object.keys(myOffer).length === 0) {
      myBox.innerHTML = '<div style="color:#667781;font-size:13px;text-align:center;padding:20px;">Пусто</div>';
    }

    const otherBox = document.getElementById("tradeOtherItems");
    otherBox.innerHTML = "";
    Object.entries(otherOffer).forEach(([key, item]) => {
      otherBox.appendChild(buildTradeItem(key, item, false));
    });
    if (Object.keys(otherOffer).length === 0) {
      otherBox.innerHTML = '<div style="color:#667781;font-size:13px;text-align:center;padding:20px;">Пусто</div>';
    }

    const partner = (S.userMap || {})[currentPartnerUid] || {};
    const titleEl = document.getElementById("tradeOtherTitle");
    if (titleEl) titleEl.textContent = (partner.name || "Собеседник") + " предлагает";

    const stEl = document.getElementById("tradeStatus");
    if (stEl) {
      const status = tradeData.status || "active";
      if (status === "active") {
        stEl.textContent = "АКТИВЕН";
        stEl.style.background = "rgba(247,181,0,0.15)";
        stEl.style.color = "#f7b500";
      } else if (status === "done") {
        stEl.textContent = "ОБМЕН СДЕЛАН";
        stEl.style.background = "rgba(0,168,132,0.15)";
        stEl.style.color = "#00a884";
      } else if (status === "cancelled") {
        stEl.textContent = "ОТМЕНЁН";
        stEl.style.background = "rgba(255,107,107,0.15)";
        stEl.style.color = "#ff6b6b";
      }
    }

    const myAccepted = tradeData.accepted && tradeData.accepted[currentUser.uid];
    const btnAccept = document.getElementById("btnTradeAccept");
    if (btnAccept) {
      if (myAccepted) {
        btnAccept.textContent = "✓ Вы приняли";
        btnAccept.classList.add("accepted");
      } else {
        btnAccept.textContent = "✓ Принять";
        btnAccept.classList.remove("accepted");
      }
    }

    const addBtn = document.getElementById("btnTradeAddMy");
    if (addBtn) {
      if (tradeData.status === "active" && !myAccepted) {
        addBtn.style.display = "block";
      } else {
        addBtn.style.display = "none";
      }
    }
  }

  function buildTradeItem(key, item, isMine) {
    const row = document.createElement("div");
    row.className = "trade-item";

    let iconHTML = "🏷";
    if (item.icon && item.icon.startsWith("data:image")) {
      iconHTML = `<img src="${item.icon}">`;
    } else if (item.icon && (item.icon.endsWith(".png") || item.icon.endsWith(".PNG"))) {
      iconHTML = `<img src="${item.icon}">`;
    } else if (item.icon) {
      iconHTML = item.icon;
    }

    const removeBtn = isMine && tradeData.status === "active"
      ? `<button class="trade-item-remove" data-remove="${key}">✕</button>`
      : "";

    row.innerHTML = `
      <div class="trade-item-icon">${iconHTML}</div>
      <div class="trade-item-info">
        <div class="trade-item-name">${escH(item.label || "—")}</div>
        <div class="trade-item-sub">${escH(item.type || "")}</div>
      </div>
      ${removeBtn}
    `;

    const rm = row.querySelector("[data-remove]");
    if (rm) {
      rm.onclick = async () => {
        const offers = tradeData.offers || {};
        const my = offers[currentUser.uid] || {};
        delete my[key];
        offers[currentUser.uid] = my;
        await update(ref(db, "trades/" + tradeId), {
          offers,
          accepted: {}
        });
      };
    }

    return row;
  }

  /* ============================================================
     ДОБАВЛЕНИЕ ПРЕДМЕТА
     ============================================================ */
  let tradePickTab = "usernames";

  const btnAdd = document.getElementById("btnTradeAddMy");
  if (btnAdd) btnAdd.addEventListener("click", () => openPickModal());

  function openPickModal() {
    renderPickList(tradePickTab);
    document.getElementById("modal-trade-pick").classList.add("active");
  }

  const btnPickCancel = document.getElementById("btnTradePickCancel");
  if (btnPickCancel) btnPickCancel.addEventListener("click", () => {
    document.getElementById("modal-trade-pick").classList.remove("active");
  });

  document.querySelectorAll("[data-trade-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-trade-tab]").forEach(x => x.classList.toggle("active", x === btn));
      tradePickTab = btn.dataset.tradeTab;
      renderPickList(tradePickTab);
    });
  });

  function renderPickList(tab) {
    const box = document.getElementById("tradePickList");
    if (!box) return;
    box.innerHTML = "";

    const me = (S.userMap || {})[currentUser.uid] || {};
    const inv = (S.currentUserData && S.currentUserData.inventory) || {};

    const items = [];

    if (tab === "usernames") {
      const names = new Set();
      if (me.username) names.add(me.username);
      for (const id in inv) {
        if (!inv[id]) continue;
        const item = myShopItems.find(i => i.id === id);
        if (item && item.type === "username" && item.value) names.add(item.value);
      }
      names.forEach(uname => {
        let itemId = null;
        for (const id in inv) {
          if (!inv[id]) continue;
          const it = myShopItems.find(i => i.id === id);
          if (it && it.type === "username" && it.value === uname) { itemId = id; break; }
        }
        items.push({
          key: "u_" + uname,
          icon: "🏷",
          label: "@" + uname,
          type: "Юзернейм",
          itemId
        });
      });
    }

    if (tab === "phones") {
      const phones = new Set();
      if (me.phone) phones.add(me.phone);
      for (const id in inv) {
        if (!inv[id]) continue;
        const item = myShopItems.find(i => i.id === id);
        if (item && item.type === "phone" && item.value) phones.add(item.value);
      }
      phones.forEach(ph => {
        let itemId = null;
        for (const id in inv) {
          if (!inv[id]) continue;
          const it = myShopItems.find(i => i.id === id);
          if (it && it.type === "phone" && it.value === ph) { itemId = id; break; }
        }
        items.push({
          key: "p_" + ph,
          icon: "📞",
          label: ph,
          type: "Номер",
          itemId
        });
      });
    }

    if (tab === "gifts") {
      const gifts = (S.currentUserData && S.currentUserData.gifts) || {};
      Object.entries(gifts).forEach(([gid, g]) => {
        if (!g) return;
        items.push({
          key: "g_" + gid,
          icon: g.icon || "🎁",
          label: g.name || "Подарок",
          type: "Подарок",
          itemId: gid
        });
      });
    }

    if (items.length === 0) {
      box.innerHTML = '<div class="create-empty">Ничего нет</div>';
      return;
    }

    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "trade-pick-item";

      let iconHTML = "🏷";
      if (it.icon && it.icon.endsWith(".png")) {
        iconHTML = `<img src="${it.icon}">`;
      } else {
        iconHTML = it.icon;
      }

      row.innerHTML = `
        <div class="trade-pick-icon">${iconHTML}</div>
        <div class="trade-pick-info">
          <div class="trade-pick-name">${escH(it.label)}</div>
          <div class="trade-pick-sub">${escH(it.type)}</div>
        </div>
      `;
      row.onclick = async () => {
        const offers = tradeData.offers || {};
        const my = offers[currentUser.uid] || {};
        my[it.key] = {
          label: it.label,
          icon: it.icon,
          type: it.type,
          itemId: it.itemId || null
        };
        offers[currentUser.uid] = my;
        await update(ref(db, "trades/" + tradeId), {
          offers,
          accepted: {}
        });
        document.getElementById("modal-trade-pick").classList.remove("active");
      };
      box.appendChild(row);
    });
  }

  /* ============================================================
     ПРИНЯТЬ / ОТКАЗАТЬСЯ
     ============================================================ */
  const btnAccept = document.getElementById("btnTradeAccept");
  if (btnAccept) btnAccept.addEventListener("click", async () => {
    if (!tradeId || !tradeData) return;
    const myAccepted = tradeData.accepted && tradeData.accepted[currentUser.uid];
    if (myAccepted) return;

    const accepted = tradeData.accepted || {};
    accepted[currentUser.uid] = true;
    await update(ref(db, "trades/" + tradeId), { accepted });
  });

  const btnReject = document.getElementById("btnTradeReject");
  if (btnReject) btnReject.addEventListener("click", async () => {
    if (!tradeId) return;
    await update(ref(db, "trades/" + tradeId), {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy: currentUser.uid
    });

    const botRef = push(ref(db, "botChat/" + currentPartnerUid));
    await set(botRef, {
      from: "Sqwid Moderator",
      text: "❌ Торг был отменён собеседником.",
      timestamp: Date.now(),
      type: "system",
      kind: "moderator"
    });

    S.showToast("Торг отменён", "info");
    setTimeout(() => S.showScreen("screen-messages"), 500);
  });

  /* ============================================================
     ОБА ПРИНЯЛИ → ОБМЕН
     ============================================================ */
  async function checkBothAccepted() {
    if (!tradeData || exchanging) return;
    if (tradeData.status !== "active") return;

    const accepted = tradeData.accepted || {};
    const members = tradeData.members || {};
    const uids = Object.keys(members);
    if (uids.length !== 2) return;
    if (!accepted[uids[0]] || !accepted[uids[1]]) return;

    exchanging = true;

    try {
      await executeTrade(tradeData, uids);
      await update(ref(db, "trades/" + tradeId), {
        status: "done",
        doneAt: Date.now()
      });
      S.showToast("🤝 Торг завершён успешно!", "ok", 4000);
    } catch (e) {
      console.error(e);
      S.showToast("Ошибка торга: " + e.message, "error");
    } finally {
      exchanging = false;
    }
  }

  async function executeTrade(trade, uids) {
    const offers = trade.offers || {};
    const [u1, u2] = uids;

    const o1 = offers[u1] || {};
    const o2 = offers[u2] || {};

    const updates = {};

    /* u1 → u2 */
    for (const key in o1) {
      const it = o1[key];
      if (!it) continue;

      if (it.type === "Подарок" && it.itemId) {
        const giftSnap = await get(ref(db, `users/${u1}/gifts/${it.itemId}`));
        const gift = giftSnap.val();
        if (gift) {
          updates[`users/${u1}/gifts/${it.itemId}`] = null;
          updates[`users/${u2}/gifts/${it.itemId}`] = gift;
        }
      } else if (it.itemId) {
        updates[`users/${u1}/inventory/${it.itemId}`] = null;
        updates[`users/${u2}/inventory/${it.itemId}`] = true;

        if (it.type === "Юзернейм") {
          const meSnap = await get(ref(db, "users/" + u1));
          const me = meSnap.val() || {};
          if (me.username === it.label.replace("@", "")) {
            updates[`users/${u1}/username`] = null;
          }
        }
        if (it.type === "Номер") {
          const meSnap = await get(ref(db, "users/" + u1));
          const me = meSnap.val() || {};
          if (me.phone === it.label) {
            updates[`users/${u1}/phone`] = null;
          }
        }
      }
    }

    /* u2 → u1 */
    for (const key in o2) {
      const it = o2[key];
      if (!it) continue;

      if (it.type === "Подарок" && it.itemId) {
        const giftSnap = await get(ref(db, `users/${u2}/gifts/${it.itemId}`));
        const gift = giftSnap.val();
        if (gift) {
          updates[`users/${u2}/gifts/${it.itemId}`] = null;
          updates[`users/${u1}/gifts/${it.itemId}`] = gift;
        }
      } else if (it.itemId) {
        updates[`users/${u2}/inventory/${it.itemId}`] = null;
        updates[`users/${u1}/inventory/${it.itemId}`] = true;

        if (it.type === "Юзернейм") {
          const meSnap = await get(ref(db, "users/" + u2));
          const me = meSnap.val() || {};
          if (me.username === it.label.replace("@", "")) {
            updates[`users/${u2}/username`] = null;
          }
        }
        if (it.type === "Номер") {
          const meSnap = await get(ref(db, "users/" + u2));
          const me = meSnap.val() || {};
          if (me.phone === it.label) {
            updates[`users/${u2}/phone`] = null;
          }
        }
      }
    }

    await update(ref(db), updates);

    for (const uid of uids) {
      const other = uid === u1 ? u2 : u1;
      const otherUser = (S.userMap || {})[other] || {};
      const botRef = push(ref(db, "botChat/" + uid));
      await set(botRef, {
        from: "Sqwid Moderator",
        text: `🤝 Торг с ${otherUser.name || "пользователем"} завершён.`,
        timestamp: Date.now(),
        type: "system",
        kind: "moderator"
      });
    }
  }

  /* ============================================================
     КНОПКА НАЗАД
     ============================================================ */
  const btnBack = document.getElementById("btnBackTrade");
  if (btnBack) btnBack.addEventListener("click", () => {
    if (unsubTrade) { unsubTrade(); unsubTrade = null; }
    S.showScreen("screen-messages");
  });

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  console.log("✅ trade.js готов");
});