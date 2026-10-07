/* ============================================================
   search.js — поиск по сообщениям в чате
   ============================================================ */

console.log("🚀 search.js загружен, жду Sqwid...");

function waitForSqwidSearch(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ search.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidSearch((S) => {
  const { db, ref, get, currentUser, showScreen, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 search.js активирован");

  let currentChatId = null;
  let allMessages = [];

  /* ============================================================
     ОТКРЫТИЕ ПОИСКА
     ============================================================ */
  async function openSearch(chatId) {
    if (!chatId) return;
    currentChatId = chatId;

    const snap = await get(ref(db, "messages/" + chatId));
    const data = snap.val() || {};
    allMessages = Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const input = document.getElementById("msgSearchInput");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 100);
    }

    renderResults("");
    showScreen("screen-search-messages");
  }

  window.Sqwid.openSearch = openSearch;

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function renderResults(query) {
    const box = document.getElementById("msgSearchResults");
    const empty = document.getElementById("msgSearchEmpty");
    if (!box) return;
    box.innerHTML = "";

    const q = (query || "").toLowerCase().trim();

    let results = allMessages;
    if (q) {
      results = allMessages.filter(m => {
        if (m.type === "photo") return (m.text || "").toLowerCase().includes(q);
        return (m.text || "").toLowerCase().includes(q);
      });
    } else {
      // Без запроса показываем последние 50
      results = allMessages.slice(0, 50);
    }

    if (results.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    results.slice(0, 100).forEach(m => {
      const u = userMap[m.sender] || {};
      const row = document.createElement("div");
      row.className = "msg-search-item";

      const ava = u.photo && u.photo.startsWith("data:image")
        ? `<img src="${u.photo}">`
        : escH((u.name || u.email || "?").charAt(0).toUpperCase());

      let preview = "";
      if (m.type === "photo") preview = "📷 " + (m.text ? highlight(m.text, q) : "Фото");
      else if (m.type === "gift") preview = "🎁 " + (m.gift?.name || "Подарок");
      else preview = highlight(m.text || "", q);

      row.innerHTML = `
        <div class="msg-search-ava">${ava}</div>
        <div class="msg-search-info">
          <div class="msg-search-name">
            <span>${escH(u.name || u.email || "Пользователь")}</span>
            <span class="msg-search-time">${fmtDate(m.timestamp)}</span>
          </div>
          <div class="msg-search-text">${preview}</div>
        </div>
      `;

      row.addEventListener("click", () => {
        // Закрываем поиск и скроллим к сообщению
        showScreen("screen-messages");
        setTimeout(() => {
          const msgEl = document.querySelector(`[data-msg-id="${m.id}"]`);
          if (msgEl) {
            msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
            msgEl.style.transition = "background 0.6s ease";
            msgEl.style.background = "rgba(99,102,241,0.35)";
            setTimeout(() => { msgEl.style.background = ""; }, 1800);
          } else {
            S.showToast("Сообщение не загружено", "info");
          }
        }, 300);
      });

      box.appendChild(row);
    });
  }

  /* ============================================================
     ПОИСК ПО МЕРЕ ВВОДА
     ============================================================ */
  const input = document.getElementById("msgSearchInput");
  if (input) {
    let tmr = null;
    input.addEventListener("input", (e) => {
      if (tmr) clearTimeout(tmr);
      tmr = setTimeout(() => renderResults(e.target.value), 150);
    });
  }

  const btnBack = document.getElementById("btnBackSearchMsg");
  if (btnBack) btnBack.addEventListener("click", () => {
    showScreen("screen-chat-info");
  });

  /* ============================================================
     ХЕЛПЕРЫ
     ============================================================ */
  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }
  function highlight(text, q) {
    const safe = escH(text);
    if (!q) return safe;
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  console.log("✅ search.js готов");
});