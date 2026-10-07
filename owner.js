/* ============================================================
   owner.js — Owner-панель + жалобы + логи + верификация + магазин + лимиты + защита владельца
   ============================================================ */

console.log("🚀 owner.js загружен, жду Sqwid...");

const OWNER_EMAIL = "artemkau714@gmail.com";
const MODERATOR_EMAILS = ["orionovik@gmail.com"];
const DAILY_LIMIT_EMAILS = ["orionovik@gmail.com"];
const DAILY_LIMIT_SQ = 500000;

function waitForSqwidOwner(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ owner.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidOwner((S) => {
  const { db, ref, get, set, update, remove, push, onValue, currentUser } = S;
  if (!currentUser) return;

  const isOwner = currentUser.email === OWNER_EMAIL;
  const isSpecialMod = MODERATOR_EMAILS.includes(currentUser.email);
  let isModerator = false;

  console.log("🔥 owner.js активирован", { isOwner, isSpecialMod });

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  let allUsers = {};
  let allChats = {};
  let allReports = {};
  let allLogs = {};
  let shopItemsCache = {};

  let givePickedUid = null;
  let plusPickedUid = null;
  let ownerUserModalUid = null;
  let reportsFilter = "new";
  let shopFilter = "all";
  let currentReportId = null;
  let reportContext = null;

  function canManageShop() {
    return isOwner || isSpecialMod;
  }

  /* ============================================================
     ПОДПИСКИ
     ============================================================ */
  onValue(ref(db, "users"), (s) => {
    allUsers = s.val() || {};
    if (isOwnerScreenActive()) renderOwnerAll();
    refreshOwnerUserModal();
  });

  onValue(ref(db, "chats"), (s) => {
    allChats = s.val() || {};
    if (isOwnerScreenActive()) renderOwnerAll();
  });

  onValue(ref(db, "reports"), (s) => {
    allReports = s.val() || {};
    updateReportsBadge();
    if (isOwnerScreenActive()) renderOwnerAll();
  });

  onValue(ref(db, "ownerLogs"), (s) => {
    allLogs = s.val() || {};
    if (isOwnerScreenActive()) {
      renderOverview();
      renderModerators();
    }
  });

  onValue(ref(db, "shop/items"), (s) => {
    shopItemsCache = s.val() || {};
    if (isOwnerScreenActive()) renderShopAdmin();
  });

  onValue(ref(db, "users/" + currentUser.uid), (s) => {
    const me = s.val() || {};
    isModerator = isOwner || isSpecialMod || me.role === "moderator";

    const btn = document.getElementById("btnOpenOwnerPanel");
    if (btn) btn.style.display = (isOwner || isModerator) ? "block" : "none";

    const canShop = canManageShop();
    document.querySelectorAll('.owner-tab[data-tab="shop"]').forEach(el => {
      el.style.display = canShop ? "" : "none";
    });
    document.querySelectorAll('.owner-pane[data-pane="shop"]').forEach(el => {
      el.style.display = canShop ? "" : "none";
    });

    const canEconomy = isOwner || isSpecialMod;
    document.querySelectorAll('.owner-tab[data-tab="economy"]').forEach(el => {
      el.style.display = canEconomy ? "" : "none";
    });
    document.querySelectorAll('.owner-pane[data-pane="economy"]').forEach(el => {
      el.style.display = canEconomy ? "" : "none";
    });

    refreshDailyLimitUI();
  });

  /* ============================================================
     ХЕЛПЕРЫ
     ============================================================ */
  function isOwnerScreenActive() {
    const el = document.getElementById("screen-owner");
    return el && el.classList.contains("active");
  }
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function makeAvaHTML(u, size) {
    const sz = size || 40;
    if (u.photo && u.photo.startsWith("data:image")) {
      return `<div class="owner-user-ava" style="width:${sz}px;height:${sz}px;"><img src="${u.photo}"></div>`;
    }
    const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
    return `<div class="owner-user-ava" style="width:${sz}px;height:${sz}px;">${escH(letter)}</div>`;
  }
  function makeChatAvaHTML(c, size) {
    const sz = size || 40;
    if (c.photo && c.photo.startsWith("data:image")) {
      return `<div class="owner-user-ava" style="width:${sz}px;height:${sz}px;"><img src="${c.photo}"></div>`;
    }
    const letter = (c.name || "?").trim().charAt(0).toUpperCase();
    return `<div class="owner-user-ava" style="width:${sz}px;height:${sz}px;">${escH(letter)}</div>`;
  }
  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }
  function show(id, on) {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? "block" : "none";
  }

  /* ============================================================
     ЗАЩИТА: НЕЛЬЗЯ ТРОГАТЬ ВЛАДЕЛЬЦА
     ============================================================ */
  function isSelf(uid) {
    return uid === currentUser.uid;
  }
  function isTargetOwner(uid) {
    const u = allUsers[uid];
    if (!u) return false;
    return (u.email || "").toLowerCase() === OWNER_EMAIL.toLowerCase();
  }
  function guardOwner(uid, action) {
    if (isTargetOwner(uid)) {
      S.showToast("Владельца нельзя " + action, "error");
      return false;
    }
    return true;
  }

  /* ============================================================
     ДНЕВНОЙ ЛИМИТ НА ВЫДАЧУ SQ
     ============================================================ */
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function hasDailyLimit() {
    return DAILY_LIMIT_EMAILS.includes(currentUser.email) && !isOwner;
  }

  async function getTodayLimitUsed() {
    if (!hasDailyLimit()) return 0;
    const snap = await get(ref(db, "users/" + currentUser.uid + "/dailyLimit"));
    const data = snap.val() || {};
    const today = todayKey();
    if (data.date === today) return data.used || 0;
    return 0;
  }

  async function addToDailyLimit(amount) {
    if (!hasDailyLimit()) return;
    const used = await getTodayLimitUsed();
    const newUsed = used + amount;
    await update(ref(db, "users/" + currentUser.uid + "/dailyLimit"), {
      date: todayKey(),
      used: newUsed
    });
  }

  async function refreshDailyLimitUI() {
    const block = document.getElementById("ownerDailyLimit");
    if (!block) return;
    if (!hasDailyLimit()) {
      block.style.display = "none";
      return;
    }
    block.style.display = "block";
    const used = await getTodayLimitUsed();
    setText("ownerDailyUsed", used.toLocaleString("ru-RU"));
  }

  /* ============================================================
     ЛОГИ
     ============================================================ */
  async function logAction(action, note, targetUid, targetType) {
    const logRef = push(ref(db, "ownerLogs"));
    await set(logRef, {
      action,
      from: currentUser.email,
      fromUid: currentUser.uid,
      fromRole: isOwner ? "owner" : "moderator",
      note: note || "",
      targetUid: targetUid || null,
      targetType: targetType || null,
      at: Date.now()
    });

    const meName = allUsers[currentUser.uid]?.name || currentUser.email;
    const botRef = push(ref(db, "botChat/" + currentUser.uid));
    await set(botRef, {
      from: isOwner ? "Sqwid Owner" : "Sqwid Moderator",
      text: `${isOwner ? "👑" : "👮"} ${meName}: ${action}${note ? "\n" + note : ""}`,
      timestamp: Date.now(),
      type: "log",
      kind: isOwner ? "owner" : "moderator"
    });
  }

  /* ============================================================
     ОТКРЫТИЕ ПАНЕЛИ
     ============================================================ */
  function openOwnerPanel() {
    if (!isOwner && !isModerator) {
      S.showAlert("Доступ только для владельца и модераторов", "Отказано");
      return;
    }
    document.querySelectorAll('[data-owner-only="1"]').forEach(el => {
      el.style.display = isOwner ? "" : "none";
    });

    if (canManageShop()) {
      document.querySelectorAll('.owner-tab[data-tab="shop"]').forEach(el => el.style.display = "");
      document.querySelectorAll('.owner-pane[data-pane="shop"]').forEach(el => el.style.display = "");
    }

    if (isOwner || isSpecialMod) {
      document.querySelectorAll('.owner-tab[data-tab="economy"]').forEach(el => el.style.display = "");
      document.querySelectorAll('.owner-pane[data-pane="economy"]').forEach(el => el.style.display = "");
    }

    const badge = document.getElementById("ownerRoleBadge");
    if (badge) {
      badge.textContent = isOwner ? "OWNER" : "MODERATOR";
      badge.style.background = isOwner ? "rgba(247,181,0,0.15)" : "rgba(168,85,247,0.15)";
      badge.style.color = isOwner ? "#f7b500" : "#c084fc";
    }
    S.showScreen("screen-owner");
    renderOwnerAll();
  }
  window.Sqwid.openOwnerPanel = openOwnerPanel;
  window.Sqwid.isOwner = () => isOwner;

  const btnBackOwner = document.getElementById("btnBackOwner");
  if (btnBackOwner) btnBackOwner.addEventListener("click", () => S.showScreen("screen-chats"));

  /* ============================================================
     ВКЛАДКИ
     ============================================================ */
  document.querySelectorAll(".owner-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".owner-tab").forEach(t => t.classList.toggle("active", t === tab));
      const target = tab.dataset.tab;
      document.querySelectorAll(".owner-pane").forEach(p => {
        p.classList.toggle("active", p.dataset.pane === target);
      });
      if (target === "overview")   renderOverview();
      if (target === "economy")    renderEconomy();
      if (target === "users")      renderUsers();
      if (target === "chats")      renderChats();
      if (target === "reports")    renderReports();
      if (target === "moderators") renderModerators();
      if (target === "shop")       renderShopAdmin();
    });
  });

  function renderOwnerAll() {
    renderOverview();
    renderEconomy();
    renderUsers();
    renderChats();
    renderReports();
    renderModerators();
    renderShopAdmin();
  }

  /* ============================================================
     ОБЗОР
     ============================================================ */
  function renderOverview() {
    let usersCount = 0, bannedCount = 0, plusCount = 0, modCount = 0, verifiedUsers = 0;
    for (const uid in allUsers) {
      usersCount++;
      if (allUsers[uid].banned) bannedCount++;
      if (allUsers[uid].plusUntil && allUsers[uid].plusUntil > Date.now()) plusCount++;
      if (allUsers[uid].role === "moderator") modCount++;
      if (allUsers[uid].verified) verifiedUsers++;
    }

    let groupsCount = 0, channelsCount = 0, verifiedChats = 0;
    for (const cid in allChats) {
      const c = allChats[cid];
      if (c.type === "group") groupsCount++;
      if (c.type === "channel") channelsCount++;
      if (c.verified) verifiedChats++;
    }

    let reportsNew = 0, reportsOpen = 0, reportsResolved = 0;
    for (const rid in allReports) {
      const st = allReports[rid].status;
      if (st === "new") reportsNew++;
      else if (st === "open") reportsOpen++;
      else if (st === "resolved") reportsResolved++;
    }

    setText("osUsers", usersCount);
    setText("osChats", groupsCount + channelsCount);
    setText("osReports", reportsNew);
    setText("osBans", bannedCount);
    setText("osPlus", plusCount);
    setText("osVerified", verifiedUsers + verifiedChats);

    const summary = `
Пользователей: ${usersCount}
Верифицировано юзеров: ${verifiedUsers}
Групп: ${groupsCount}, Каналов: ${channelsCount} (верифицировано: ${verifiedChats})
Модераторов: ${modCount}
Забанено: ${bannedCount}
Sqwid+: ${plusCount}
Жалоб: новых ${reportsNew}, в работе ${reportsOpen}, закрыто ${reportsResolved}
    `.trim();
    setText("osSummary", summary);

    const logsList = document.getElementById("ownerLogsList");
    if (logsList) {
      const arr = Object.values(allLogs).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30);
      logsList.innerHTML = "";
      if (arr.length === 0) {
        logsList.innerHTML = '<div class="create-empty">Пока ничего</div>';
      } else {
        arr.forEach(l => {
          const row = document.createElement("div");
          row.className = "owner-log-row";
          row.innerHTML = `
            <div class="owner-log-time">${fmtDate(l.at)}</div>
            <div>
              <span style="color:${l.fromRole === "owner" ? "#f7b500" : "#c084fc"};font-weight:700;">${escH(l.from)}</span>
              — ${escH(l.action)}
              ${l.note ? `<br><span style="color:#8696a0;font-size:12px;">${escH(l.note)}</span>` : ""}
            </div>
          `;
          logsList.appendChild(row);
        });
      }
    }
  }

  /* ============================================================
     ЭКОНОМИКА
     ============================================================ */
  function renderEconomy() {
    if (!isOwner && !isSpecialMod) return;
    const gs = document.getElementById("ownerGiveSearch");
    const ps = document.getElementById("ownerPlusSearch");
    if (gs) gs.oninput = () => renderPickList("ownerGiveResults", gs.value, (uid) => {
      givePickedUid = uid;
      const u = allUsers[uid];
      document.getElementById("ownerGivePicked").style.display = "block";
      document.getElementById("ownerGivePickedName").textContent = u.name || u.email || "—";
    });
    if (ps) ps.oninput = () => renderPickList("ownerPlusResults", ps.value, (uid) => {
      plusPickedUid = uid;
      const u = allUsers[uid];
      document.getElementById("ownerPlusPicked").style.display = "block";
      document.getElementById("ownerPlusPickedName").textContent = u.name || u.email || "—";
    });
    refreshDailyLimitUI();
  }

  function renderPickList(containerId, query, onPick) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const q = (query || "").toLowerCase().trim();
    box.innerHTML = "";

    const arr = [];
    for (const uid in allUsers) {
      const u = allUsers[uid];
      const name = (u.name || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      if (q && !name.includes(q) && !uname.includes(q) && !email.includes(q)) continue;
      arr.push({ uid, ...u });
    }
    arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (arr.length === 0) {
      box.innerHTML = '<div class="create-empty">Никого не найдено</div>';
      return;
    }

    arr.slice(0, 20).forEach(u => {
      const row = document.createElement("div");
      row.className = "create-result";
      const ava = u.photo && u.photo.startsWith("data:image")
        ? `<img src="${u.photo}">`
        : escH((u.name || u.email || "?").charAt(0).toUpperCase());
      row.innerHTML = `
        <div class="create-result-ava">${ava}</div>
        <div class="create-result-info">
          <div class="create-result-name">${escH(u.name || u.email || "Пользователь")}</div>
          <div class="create-result-sub">${u.username ? "@" + escH(u.username) : escH(u.email || "")}</div>
        </div>
      `;
      row.addEventListener("click", () => onPick(u.uid));
      box.appendChild(row);
    });
  }

  /* --- ВЫДАТЬ SQ --- */
  const btnGiveSQ = document.getElementById("btnOwnerGiveSQ");
  if (btnGiveSQ) btnGiveSQ.addEventListener("click", async () => {
    if (!isOwner && !isSpecialMod) return;
    if (!givePickedUid) return S.showToast("Выбери пользователя", "error");
    const amt = parseInt(document.getElementById("ownerGiveAmount").value) || 0;
    if (amt <= 0) return S.showToast("Сумма > 0", "error");

    if (hasDailyLimit()) {
      const used = await getTodayLimitUsed();
      if (used + amt > DAILY_LIMIT_SQ) {
        const left = Math.max(0, DAILY_LIMIT_SQ - used);
        S.showAlert(
          `Превышен дневной лимит.\n\nЛимит: ${DAILY_LIMIT_SQ.toLocaleString("ru-RU")} SQ\nУже выдано: ${used.toLocaleString("ru-RU")} SQ\nОсталось: ${left.toLocaleString("ru-RU")} SQ`,
          "Лимит"
        );
        return;
      }
    }

    const u = allUsers[givePickedUid];
    const newBal = (u.coins || 0) + amt;
    await update(ref(db, "users/" + givePickedUid), { coins: newBal });
    await addToDailyLimit(amt);
    await logAction("Выдал SQ", `${amt} SQ → ${u.name || u.email}`, givePickedUid, "user");
    S.showToast(`+${amt} SQ`, "ok");
    refreshDailyLimitUI();
  });

  /* --- ЗАБРАТЬ SQ --- */
  const btnTakeSQ = document.getElementById("btnOwnerTakeSQ");
  if (btnTakeSQ) btnTakeSQ.addEventListener("click", async () => {
    if (!isOwner && !isSpecialMod) return;
    if (!givePickedUid) return S.showToast("Выбери пользователя", "error");
    const amt = parseInt(document.getElementById("ownerGiveAmount").value) || 0;
    if (amt <= 0) return S.showToast("Сумма > 0", "error");
    const u = allUsers[givePickedUid];
    const newBal = Math.max(0, (u.coins || 0) - amt);
    await update(ref(db, "users/" + givePickedUid), { coins: newBal });
    await logAction("Забрал SQ", `${amt} SQ ← ${u.name || u.email}`, givePickedUid, "user");
    S.showToast(`-${amt} SQ`, "ok");
  });

  /* --- ВЫДАТЬ SQWID+ --- */
  const btnGivePlus = document.getElementById("btnOwnerGivePlus");
  if (btnGivePlus) btnGivePlus.addEventListener("click", async () => {
    if (!isOwner && !isSpecialMod) return;
    if (!plusPickedUid) return S.showToast("Выбери пользователя", "error");
    const months = parseInt(document.getElementById("ownerPlusMonths").value);
    const u = allUsers[plusPickedUid];
    let until = u.plusUntil || Date.now();
    if (until < Date.now()) until = Date.now();
    if (months === -1) until = 9999999999999;
    else until += months * 30 * 24 * 60 * 60 * 1000;
    await update(ref(db, "users/" + plusPickedUid), { plusUntil: until });
    await logAction("Выдал Sqwid+", `${months === -1 ? "навсегда" : months + " мес"} → ${u.name || u.email}`, plusPickedUid, "user");
    const botRef = push(ref(db, "botChat/" + plusPickedUid));
    await set(botRef, {
      from: "Sqwid Owner",
      text: `⭐ Вам выдан Sqwid+ ${months === -1 ? "навсегда" : "на " + months + " мес."}`,
      timestamp: Date.now(), type: "gift", kind: "owner"
    });
    S.showToast("Sqwid+ выдан", "ok");
  });

  /* --- ЗАБРАТЬ SQWID+ --- */
  const btnTakePlus = document.getElementById("btnOwnerTakePlus");
  if (btnTakePlus) btnTakePlus.addEventListener("click", async () => {
    if (!isOwner && !isSpecialMod) return;
    if (!plusPickedUid) return S.showToast("Выбери пользователя", "error");
    const u = allUsers[plusPickedUid];
    await update(ref(db, "users/" + plusPickedUid), { plusUntil: null });
    await logAction("Забрал Sqwid+", `${u.name || u.email}`, plusPickedUid, "user");
    S.showToast("Sqwid+ забран", "ok");
  });

  /* ============================================================
     ПОЛЬЗОВАТЕЛИ
     ============================================================ */
  function renderUsers() {
    const box = document.getElementById("ownerUsersList");
    if (!box) return;
    const q = (document.getElementById("ownerUsersSearch")?.value || "").toLowerCase().trim();
    box.innerHTML = "";

    const arr = [];
    for (const uid in allUsers) {
      const u = allUsers[uid];
      const name = (u.name || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      if (q && !name.includes(q) && !uname.includes(q) && !email.includes(q)) continue;
      arr.push({ uid, ...u });
    }
    arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (arr.length === 0) {
      box.innerHTML = '<div class="create-empty">Никого не найдено</div>';
      return;
    }

    arr.slice(0, 80).forEach(u => {
      const row = document.createElement("div");
      row.className = "owner-user-row";
      const badges = [];
      if (u.verified) badges.push(`<span class="owner-user-badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">✓ VERIFIED</span>`);
      if (u.role === "moderator") badges.push(`<span class="owner-user-badge" style="background:rgba(168,85,247,0.2);color:#c084fc;">MOD</span>`);
      if (u.banned) badges.push(`<span class="owner-user-badge" style="background:rgba(239,68,68,0.2);color:#ff6b6b;">BAN</span>`);
      if (u.muted) badges.push(`<span class="owner-user-badge" style="background:rgba(247,181,0,0.2);color:#f7b500;">MUTE</span>`);
      if (u.frozen) badges.push(`<span class="owner-user-badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">FROZEN</span>`);
      if (u.plusUntil && u.plusUntil > Date.now()) badges.push(`<span class="owner-user-badge" style="background:rgba(247,181,0,0.2);color:#f7b500;">+</span>`);
      row.innerHTML = `
        ${makeAvaHTML(u)}
        <div class="owner-user-info">
          <div class="owner-user-name">${escH(u.name || "Без имени")} ${u.username ? `<span style="color:#8696a0;font-weight:500;">@${escH(u.username)}</span>` : ""}</div>
          <div class="owner-user-sub">${escH(u.email || "")}</div>
          ${badges.length ? `<div class="owner-user-badges">${badges.join("")}</div>` : ""}
        </div>
      `;
      row.addEventListener("click", () => openOwnerUserModal(u.uid));
      box.appendChild(row);
    });
  }
  const ownerUsersSearch = document.getElementById("ownerUsersSearch");
  if (ownerUsersSearch) ownerUsersSearch.addEventListener("input", renderUsers);

  /* ============================================================
     ЧАТЫ
     ============================================================ */
  function renderChats() {
    const box = document.getElementById("ownerChatsList");
    if (!box) return;
    const q = (document.getElementById("ownerChatsSearch")?.value || "").toLowerCase().trim();
    box.innerHTML = "";

    const arr = [];
    for (const cid in allChats) {
      const c = allChats[cid];
      if (q && !(c.name || "").toLowerCase().includes(q)) continue;
      arr.push({ cid, ...c });
    }
    arr.sort((a, b) => (b.lastMsgAt || 0) - (a.lastMsgAt || 0));

    if (arr.length === 0) {
      box.innerHTML = '<div class="create-empty">Ничего не найдено</div>';
      return;
    }

    arr.slice(0, 80).forEach(c => {
      const row = document.createElement("div");
      row.className = "owner-user-row";
      const badges = [];
      if (c.verified) badges.push(`<span class="owner-user-badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">✓ VERIFIED</span>`);
      if (c.type === "channel") badges.push(`<span class="owner-user-badge" style="background:rgba(0,168,132,0.2);color:#00a884;">CHANNEL</span>`);
      if (c.type === "group") badges.push(`<span class="owner-user-badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">GROUP</span>`);
      row.innerHTML = `
        ${makeChatAvaHTML(c)}
        <div class="owner-user-info">
          <div class="owner-user-name">${escH(c.name || "Чат")}</div>
          <div class="owner-user-sub">${Object.keys(c.members || {}).length} участников</div>
          ${badges.length ? `<div class="owner-user-badges">${badges.join("")}</div>` : ""}
        </div>
        <button class="inventory-item-btn" data-verify-chat="${c.cid}" style="color:#60a5fa;">${c.verified ? "Снять ✓" : "✓ Вериф."}</button>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.dataset.verifyChat) return;
        if (window.Sqwid.openChatInfo) window.Sqwid.openChatInfo(c.cid);
      });
      const vbtn = row.querySelector("[data-verify-chat]");
      if (vbtn) vbtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!isOwner && !isModerator) return;
        const newState = !c.verified;
        await update(ref(db, "chats/" + c.cid), { verified: newState || null });
        await logAction(newState ? "✓ Верифицировал чат" : "Снял верификацию чата", c.name || c.cid, c.cid, "chat");
        S.showToast(newState ? "Чат верифицирован" : "Верификация снята", "ok");
      });
      box.appendChild(row);
    });
  }
  const ownerChatsSearch = document.getElementById("ownerChatsSearch");
  if (ownerChatsSearch) ownerChatsSearch.addEventListener("input", renderChats);

  /* ============================================================
     МОДАЛКА ЮЗЕРА
     ============================================================ */
  function openOwnerUserModal(uid) {
    if (!isOwner && !isModerator) return;
    ownerUserModalUid = uid;
    refreshOwnerUserModal();
    document.getElementById("modal-owner-user").classList.add("active");
  }

  function refreshOwnerUserModal() {
    if (!ownerUserModalUid) return;
    const u = allUsers[ownerUserModalUid];
    if (!u) return;

    const avaEl = document.getElementById("ouAva");
    if (avaEl) {
      if (u.photo && u.photo.startsWith("data:image")) avaEl.src = u.photo;
      else {
        const l = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#3b82f6"/><text x="50%" y="55%" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${l}</text></svg>`;
        avaEl.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      }
    }
    setText("ouName", u.name || "Без имени");
    setText("ouUsername", u.username ? "@" + u.username : (u.email || ""));

    // ЗАЩИТА ВЛАДЕЛЬЦА
    const targetIsOwner = isTargetOwner(ownerUserModalUid);
    if (targetIsOwner) {
      // Скрываем все опасные кнопки
      show("btnOuBan", false);
      show("btnOuMute", false);
      show("btnOuFreeze", false);
      show("btnOuUnverify", false);
      show("btnOuMakeModerator", false);
      show("btnOuRemoveModerator", false);
      // Показываем только «разблокировать», если вдруг владелец каким-то образом забанен
      show("btnOuUnban", !!u.banned);
      show("btnOuUnmute", !!u.muted);
      show("btnOuUnfreeze", !!u.frozen);
      show("btnOuVerify", false);
      return;
    }

    // Обычная логика
    show("btnOuBan", !u.banned);
    show("btnOuUnban", !!u.banned);
    show("btnOuMute", !u.muted);
    show("btnOuUnmute", !!u.muted);
    show("btnOuFreeze", !u.frozen);
    show("btnOuUnfreeze", !!u.frozen);
    show("btnOuVerify", !u.verified);
    show("btnOuUnverify", !!u.verified);

    if (isOwner) {
      show("btnOuMakeModerator", u.role !== "moderator" && ownerUserModalUid !== currentUser.uid);
      show("btnOuRemoveModerator", u.role === "moderator" && ownerUserModalUid !== currentUser.uid);
    } else {
      show("btnOuMakeModerator", false);
      show("btnOuRemoveModerator", false);
    }
  }

  const btnOuCancel = document.getElementById("btnOuCancel");
  if (btnOuCancel) btnOuCancel.addEventListener("click", () => {
    document.getElementById("modal-owner-user").classList.remove("active");
    ownerUserModalUid = null;
  });

  const btnOuProfile = document.getElementById("btnOuProfile");
  if (btnOuProfile) btnOuProfile.addEventListener("click", () => {
    if (!ownerUserModalUid) return;
    document.getElementById("modal-owner-user").classList.remove("active");
    if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(ownerUserModalUid);
  });

  /* ============================================================
     ДЕЙСТВИЯ С ЮЗЕРОМ (с защитой владельца)
     ============================================================ */
  bindUserAction("btnOuBan", async () => {
    if (!guardOwner(ownerUserModalUid, "забанить")) return;
    if (isSelf(ownerUserModalUid)) return S.showToast("Нельзя забанить себя", "error");
    await update(ref(db, "users/" + ownerUserModalUid), { banned: true });
    await logAction("Забанил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Забанен", "ok");
  });
  bindUserAction("btnOuUnban", async () => {
    await update(ref(db, "users/" + ownerUserModalUid), { banned: null });
    await logAction("Разбанил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Разбанен", "ok");
  });
  bindUserAction("btnOuMute", async () => {
    if (!guardOwner(ownerUserModalUid, "замутить")) return;
    if (isSelf(ownerUserModalUid)) return S.showToast("Нельзя замутить себя", "error");
    await update(ref(db, "users/" + ownerUserModalUid), { muted: true });
    await logAction("Замутил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Замучен", "ok");
  });
  bindUserAction("btnOuUnmute", async () => {
    await update(ref(db, "users/" + ownerUserModalUid), { muted: null });
    await logAction("Размутил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Размучен", "ok");
  });
  bindUserAction("btnOuFreeze", async () => {
    if (!guardOwner(ownerUserModalUid, "заморозить")) return;
    if (isSelf(ownerUserModalUid)) return S.showToast("Нельзя заморозить себя", "error");
    await update(ref(db, "users/" + ownerUserModalUid), { frozen: true });
    await logAction("Заморозил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Заморожен", "ok");
  });
  bindUserAction("btnOuUnfreeze", async () => {
    await update(ref(db, "users/" + ownerUserModalUid), { frozen: null });
    await logAction("Разморозил", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Разморожен", "ok");
  });
  bindUserAction("btnOuVerify", async () => {
    await update(ref(db, "users/" + ownerUserModalUid), { verified: true });
    await logAction("✓ Верифицировал", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    const botRef = push(ref(db, "botChat/" + ownerUserModalUid));
    await set(botRef, {
      from: "Sqwid Moderator",
      text: "✅ Ваш аккаунт верифицирован администрацией Sqwid.",
      timestamp: Date.now(), type: "system", kind: "moderator"
    });
    S.showToast("Верифицирован", "ok");
  });
  bindUserAction("btnOuUnverify", async () => {
    if (!guardOwner(ownerUserModalUid, "снять верификацию")) return;
    await update(ref(db, "users/" + ownerUserModalUid), { verified: null });
    await logAction("Снял верификацию", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Снято", "ok");
  });
  bindUserAction("btnOuMakeModerator", async () => {
    if (!isOwner) return;
    if (!guardOwner(ownerUserModalUid, "назначить модератором")) return;
    await update(ref(db, "users/" + ownerUserModalUid), { role: "moderator" });
    await logAction("Назначил модератором", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    const botRef = push(ref(db, "botChat/" + ownerUserModalUid));
    await set(botRef, {
      from: "Sqwid Owner",
      text: "👑 Вы назначены модератором Sqwid.\n\nТеперь вы получаете жалобы в боте Sqwid Moderator.",
      timestamp: Date.now(), type: "system", kind: "owner"
    });
    S.showToast("Назначен модератором", "ok");
  });
  bindUserAction("btnOuRemoveModerator", async () => {
    if (!isOwner) return;
    if (!guardOwner(ownerUserModalUid, "снять модератора")) return;
    await update(ref(db, "users/" + ownerUserModalUid), { role: null });
    await logAction("Снял модератора", allUsers[ownerUserModalUid].name || "—", ownerUserModalUid, "user");
    S.showToast("Снят", "ok");
  });

  function bindUserAction(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = async () => {
      try {
        await fn();
        document.getElementById("modal-owner-user").classList.remove("active");
        ownerUserModalUid = null;
        renderUsers();
      } catch (e) {
        S.showToast("Ошибка: " + e.message, "error");
      }
    };
  }

  /* ============================================================
     ЖАЛОБЫ
     ============================================================ */
  function updateReportsBadge() {
    const badge = document.getElementById("ownerReportsBadge");
    if (!badge) return;
    let n = 0;
    for (const rid in allReports) if (allReports[rid].status === "new") n++;
    if (n > 0) { badge.style.display = "inline-block"; badge.textContent = n; }
    else badge.style.display = "none";
  }

  function renderReports() {
    const list = document.getElementById("ownerReportsList");
    if (!list) return;
    list.innerHTML = "";

    const arr = [];
    for (const rid in allReports) {
      const r = allReports[rid];
      if (reportsFilter !== "all" && r.status !== reportsFilter) continue;
      arr.push({ rid, ...r });
    }
    arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (arr.length === 0) {
      list.innerHTML = '<div class="create-empty">Жалоб нет</div>';
      return;
    }

    arr.forEach(r => {
      const row = document.createElement("div");
      row.className = "owner-user-row";
      const fromUser = allUsers[r.fromUid] || {};
      const statusColor = r.status === "new" ? "#ff6b6b" : r.status === "open" ? "#f7b500" : "#00a884";
      const statusText = r.status === "new" ? "NEW" : r.status === "open" ? "OPEN" : "RESOLVED";
      row.innerHTML = `
        <div class="owner-user-info" style="flex:1;">
          <div class="owner-user-name">
            ${escH(r.reason || "Жалоба")}
            <span class="owner-user-badge" style="background:${statusColor}22;color:${statusColor};">${statusText}</span>
          </div>
          <div class="owner-user-sub">${r.targetType === "message" ? "Сообщение" : r.targetType === "chat" ? "Чат/канал" : "Пользователь"} · ${escH(fromUser.name || fromUser.email || "?")}</div>
          <div class="owner-user-sub" style="font-size:11px;color:#667781;">${fmtDate(r.createdAt)}</div>
        </div>
      `;
      row.addEventListener("click", () => openReportView(r.rid));
      list.appendChild(row);
    });
  }

  document.querySelectorAll(".owner-filter").forEach(f => {
    if (!f.dataset.filter) return;
    f.addEventListener("click", () => {
      document.querySelectorAll(".owner-filter[data-filter]").forEach(x => x.classList.toggle("active", x === f));
      reportsFilter = f.dataset.filter;
      renderReports();
    });
  });

  async function openReportView(reportId) {
    const r = allReports[reportId];
    if (!r) return;
    currentReportId = reportId;

    if (r.status === "new") {
      await update(ref(db, "reports/" + reportId), { status: "open", openedAt: Date.now(), openedBy: currentUser.uid });
    }

    const fromUser = allUsers[r.fromUid] || {};
    const targetUser = r.targetUid ? allUsers[r.targetUid] : null;

    setText("rvType", r.targetType === "message" ? "Сообщение" : r.targetType === "chat" ? "Чат / канал" : "Пользователь");
    setText("rvReason", r.reason || "—");
    setText("rvFrom", (fromUser.name || fromUser.email || "?") + (fromUser.username ? " (@" + fromUser.username + ")" : ""));
    setText("rvTarget", targetUser ? (targetUser.name || targetUser.email || "?") : "—");
    setText("rvComment", r.comment || "—");

    const stEl = document.getElementById("reportViewStatus");
    if (stEl) {
      const status = r.status === "new" ? "open" : r.status;
      stEl.textContent = status.toUpperCase();
      stEl.style.background = status === "open" ? "rgba(247,181,0,0.15)" : "rgba(0,168,132,0.15)";
      stEl.style.color = status === "open" ? "#f7b500" : "#00a884";
    }

    const msgSec = document.getElementById("rvMessagesSection");
    const chatSec = document.getElementById("rvChatSection");
    if (msgSec) msgSec.style.display = "none";
    if (chatSec) chatSec.style.display = "none";

    if (r.targetType === "message" && r.messageIds && r.chatId) {
      if (msgSec) msgSec.style.display = "block";
      const list = document.getElementById("rvMessagesList");
      if (list) {
        list.innerHTML = "";
        for (const mid of r.messageIds) {
          const msgSnap = await get(ref(db, `messages/${r.chatId}/${mid}`));
          const m = msgSnap.val();
          if (!m) continue;
          const sender = allUsers[m.sender] || {};
          const card = document.createElement("div");
          card.className = "rv-message-card";
          card.innerHTML = `
            <div class="rv-message-sender">${escH(sender.name || sender.email || "?")}</div>
            <div class="rv-message-text">
              ${m.type === "photo" && m.photo ? `<img src="${m.photo}">` : ""}
              ${escH(m.text || "")}
            </div>
            <div class="rv-message-time">${fmtDate(m.timestamp)}</div>
          `;
          list.appendChild(card);
        }
      }
    }

    if (r.targetType === "chat" && r.chatId) {
      if (chatSec) chatSec.style.display = "block";
      const c = allChats[r.chatId];
      setText("rvChatInfo", c ? `${c.name || "Чат"} · ${Object.keys(c.members || {}).length} участников` : "Чат не найден");
      const btn = document.getElementById("btnRvOpenChat");
      if (btn) btn.onclick = () => {
        if (window.Sqwid.openChatInfo) window.Sqwid.openChatInfo(r.chatId);
      };
    }

    const btnResolve = document.getElementById("btnRvResolve");
    if (btnResolve) btnResolve.onclick = async () => {
      await update(ref(db, "reports/" + reportId), { status: "resolved", resolvedAt: Date.now(), resolvedBy: currentUser.uid });
      await logAction("Закрыл жалобу", `${reportId} · ${r.reason}`, r.fromUid, "report");
      S.showToast("Жалоба закрыта", "ok");
      S.showScreen("screen-owner");
    };

    const btnReject = document.getElementById("btnRvReject");
    if (btnReject) btnReject.onclick = async () => {
      await update(ref(db, "reports/" + reportId), { status: "resolved", resolvedAt: Date.now(), resolvedBy: currentUser.uid, rejected: true });
      await logAction("Отклонил жалобу", `${reportId} · ${r.reason}`, r.fromUid, "report");
      S.showToast("Жалоба отклонена", "ok");
      S.showScreen("screen-owner");
    };

    S.showScreen("screen-report-view");
  }

  const btnBackRV = document.getElementById("btnBackReportView");
  if (btnBackRV) btnBackRV.addEventListener("click", () => S.showScreen("screen-owner"));

  /* ============================================================
     МОДЕРАТОРЫ
     ============================================================ */
  function renderModerators() {
    if (!isOwner) return;
    const list = document.getElementById("ownerModsList");
    if (list) {
      list.innerHTML = "";
      const mods = [];
      for (const uid in allUsers) {
        if (allUsers[uid].role === "moderator") mods.push({ uid, ...allUsers[uid] });
      }
      if (mods.length === 0) {
        list.innerHTML = '<div class="create-empty">Модераторов нет</div>';
      } else {
        mods.forEach(u => {
          const row = document.createElement("div");
          row.className = "owner-user-row";
          row.innerHTML = `
            ${makeAvaHTML(u)}
            <div class="owner-user-info">
              <div class="owner-user-name">${escH(u.name || "—")}</div>
              <div class="owner-user-sub">${u.username ? "@" + escH(u.username) : escH(u.email || "")}</div>
            </div>
            <button class="inventory-item-btn remove" data-mod-remove="${u.uid}">Снять</button>
          `;
          row.querySelector("[data-mod-remove]").addEventListener("click", async (e) => {
            e.stopPropagation();
            const ok = await S.showConfirm("Снять с модераторов?", "Модерация");
            if (!ok) return;
            await update(ref(db, "users/" + u.uid), { role: null });
            await logAction("Снял модератора", u.name || "—", u.uid, "user");
            renderModerators();
          });
          list.appendChild(row);
        });
      }
    }

    const logsBox = document.getElementById("ownerModLogs");
    if (logsBox) {
      const arr = Object.values(allLogs)
        .filter(l => l.fromRole === "moderator")
        .sort((a, b) => (b.at || 0) - (a.at || 0))
        .slice(0, 40);
      logsBox.innerHTML = "";
      if (arr.length === 0) {
        logsBox.innerHTML = '<div class="create-empty">Пока ничего</div>';
      } else {
        arr.forEach(l => {
          const row = document.createElement("div");
          row.className = "owner-log-row";
          row.innerHTML = `
            <div class="owner-log-time">${fmtDate(l.at)}</div>
            <div>
              <span style="color:#c084fc;font-weight:700;">${escH(l.from)}</span>
              — ${escH(l.action)}
              ${l.note ? `<br><span style="color:#8696a0;font-size:12px;">${escH(l.note)}</span>` : ""}
            </div>
          `;
          logsBox.appendChild(row);
        });
      }
    }
  }

  /* ============================================================
     УПРАВЛЕНИЕ МАГАЗИНОМ
     ============================================================ */
  function renderShopAdmin() {
    if (!canManageShop()) return;

    const list = document.getElementById("shopItemsList");
    if (!list) return;
    const q = (document.getElementById("shopItemsSearch")?.value || "").toLowerCase().trim();
    list.innerHTML = "";

    const arr = [];
    for (const id in shopItemsCache) {
      const it = shopItemsCache[id];
      const type = it.type || "unknown";
      if (shopFilter !== "all" && type !== shopFilter) continue;
      if (q && !(it.name || "").toLowerCase().includes(q) && !id.toLowerCase().includes(q)) continue;
      arr.push({ id, ...it });
    }
    arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (arr.length === 0) {
      list.innerHTML = '<div class="create-empty">Товаров нет</div>';
      return;
    }

    arr.forEach(it => {
      const row = document.createElement("div");
      row.className = "owner-user-row";
      row.innerHTML = `
        <div class="owner-user-ava" style="background:#000;font-size:20px;">${escH(it.icon || "🏷")}</div>
        <div class="owner-user-info">
          <div class="owner-user-name">${escH(it.name || it.value || it.id)}</div>
          <div class="owner-user-sub">${escH(it.type || "")} · 🪙 ${it.price || 0} SQ</div>
          <div class="owner-user-sub" style="font-size:11px;color:#667781;font-family:'JetBrains Mono',monospace;">${escH(it.id)}</div>
        </div>
        <button class="inventory-item-btn remove" data-delete="${it.id}">Удалить</button>
      `;
      row.querySelector("[data-delete]").addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await S.showConfirm("Удалить товар «" + (it.name || it.id) + "»?", "Удалить");
        if (!ok) return;
        await remove(ref(db, "shop/items/" + it.id));
        await logAction("Удалил товар", it.name || it.id, null, "shop");
        S.showToast("Товар удалён", "ok");
        renderShopAdmin();
      });
      list.appendChild(row);
    });
  }

  document.querySelectorAll('[data-shop-filter]').forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll('[data-shop-filter]').forEach(x => x.classList.toggle("active", x === btn));
      shopFilter = btn.dataset.shopFilter;
      renderShopAdmin();
    });
  });

  const shopItemsSearch = document.getElementById("shopItemsSearch");
  if (shopItemsSearch) shopItemsSearch.addEventListener("input", renderShopAdmin);

  const shopAddType = document.getElementById("shopAddType");
  if (shopAddType) {
    shopAddType.addEventListener("change", () => {
      const hint = document.getElementById("shopAddValueHint");
      if (!hint) return;
      const t = shopAddType.value;
      const hints = {
        username: "Для юзернейма — только латиница (a-z), цифры, _ . От 3 до 20 символов.",
        vip_username: "VIP юзернейм — то же, но показывается отдельным разделом.",
        phone: "Формат: +7 999 123-45-67 или как удобно.",
        nickColor: "HEX-цвет, например #ff0000.",
        emoji: "Один эмодзи, например 🔥.",
        frame: "Название рамки: gold, fire, rainbow (или своё)."
      };
      hint.textContent = hints[t] || "";
    });
  }

  const btnShopAdd = document.getElementById("btnShopAdd");
  if (btnShopAdd) btnShopAdd.addEventListener("click", async () => {
    if (!canManageShop()) return S.showToast("Нет доступа", "error");

    const type = document.getElementById("shopAddType").value;
    const id = (document.getElementById("shopAddId").value || "").trim();
    const name = (document.getElementById("shopAddName").value || "").trim();
    const value = (document.getElementById("shopAddValue").value || "").trim();
    const price = parseInt(document.getElementById("shopAddPrice").value) || 0;
    const preview = (document.getElementById("shopAddPreview").value || "").trim();
    const icon = (document.getElementById("shopAddIcon").value || "").trim();

    if (!id) return S.showToast("Введите ID товара", "error");
    if (!/^[a-zA-Z0-9_]+$/.test(id)) return S.showToast("ID: только латиница, цифры, _", "error");
    if (!name) return S.showToast("Введите название", "error");
    if (!value) return S.showToast("Введите значение", "error");
    if (price <= 0) return S.showToast("Цена > 0", "error");

    if (type === "username" || type === "vip_username") {
      if (!/^[a-z0-9_]{3,20}$/.test(value.toLowerCase())) {
        return S.showToast("Юзернейм: латиница (a-z), цифры, _ , 3-20", "error");
      }
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      for (const uid in users) {
        if (users[uid].username && users[uid].username.toLowerCase() === value.toLowerCase()) {
          return S.showToast("Юзернейм @" + value + " уже занят", "error");
        }
      }
    }

    if (type === "nickColor" && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return S.showToast("Цвет в формате #RRGGBB", "error");
    }

    if (type === "phone") {
      if (!/^\+?[\d\s\-()]{7,20}$/.test(value)) {
        return S.showToast("Неверный формат номера", "error");
      }
    }

    const payload = {
      id, type, name, value, price,
      preview: preview || (type === "username" ? "Уникальный юзернейм" : name),
      icon: icon || defaultIcon(type),
      createdAt: Date.now(),
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email,
      isVip: type === "vip_username"
    };

    try {
      await set(ref(db, "shop/items/" + id), payload);
      await logAction("Добавил товар", `${type} · ${name} · ${price} SQ`, null, "shop");
      S.showToast("Товар добавлен", "ok");
      document.getElementById("shopAddId").value = "";
      document.getElementById("shopAddName").value = "";
      document.getElementById("shopAddValue").value = "";
      document.getElementById("shopAddPreview").value = "";
      document.getElementById("shopAddIcon").value = "";
      renderShopAdmin();
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
    }
  });

  function defaultIcon(type) {
    if (type === "username") return "🏷";
    if (type === "vip_username") return "💎";
    if (type === "phone") return "📞";
    if (type === "nickColor") return "🎨";
    if (type === "emoji") return "😀";
    if (type === "frame") return "🖼";
    return "🏷";
  }

  /* ============================================================
     КНОПКА ОТКРЫТИЯ ПАНЕЛИ
     ============================================================ */
  setInterval(() => {
    const btn = document.getElementById("btnOpenOwnerPanel");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", openOwnerPanel);
    }
  }, 800);

  /* ============================================================
     ЖАЛОБА
     ============================================================ */
  window.Sqwid.openReportModal = function ({ targetType, targetUid, chatId, messageIds, targetLabel }) {
    reportContext = { targetType, targetUid, chatId, messageIds, targetLabel };
    setText("reportTargetInfo", targetLabel || "—");
    const rr = document.getElementById("reportReason");
    const rc = document.getElementById("reportComment");
    if (rr) rr.value = "spam";
    if (rc) rc.value = "";
    document.getElementById("modal-report").classList.add("active");
  };

  const btnReportCancel = document.getElementById("btnReportCancel");
  if (btnReportCancel) btnReportCancel.addEventListener("click", () => {
    document.getElementById("modal-report").classList.remove("active");
    reportContext = null;
  });

  const btnReportSubmit = document.getElementById("btnReportSubmit");
  if (btnReportSubmit) btnReportSubmit.addEventListener("click", async () => {
    if (!reportContext) return;
    const reason = document.getElementById("reportReason").value;
    const comment = document.getElementById("reportComment").value.trim();

    const reportRef = push(ref(db, "reports"));
    const reportId = reportRef.key;
    await set(reportRef, {
      fromUid: currentUser.uid,
      targetType: reportContext.targetType,
      targetUid: reportContext.targetUid || null,
      chatId: reportContext.chatId || null,
      messageIds: reportContext.messageIds || null,
      reason, comment,
      status: "new",
      createdAt: Date.now()
    });

    for (const uid in allUsers) {
      const u = allUsers[uid];
      if (u.role === "moderator" || u.email === OWNER_EMAIL) {
        const botRef = push(ref(db, "botChat/" + uid));
        await set(botRef, {
          from: "Sqwid Moderator",
          text: `🚨 Новая жалоба!\nТип: ${reportContext.targetType}\nПричина: ${reason}${comment ? "\n💬 " + comment : ""}\n\nОткрой Owner Panel → Жалобы, чтобы проверить.`,
          timestamp: Date.now(),
          type: "report",
          kind: "moderator",
          reportId
        });
      }
    }

    document.getElementById("modal-report").classList.remove("active");
    reportContext = null;
    S.showToast("Жалоба отправлена модераторам", "ok");
  });

  console.log("✅ owner.js готов");
});