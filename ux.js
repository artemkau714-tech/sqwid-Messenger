/* ============================================================
   ux.js — UX-улучшения
   Свайпы, reply, копирование, @username, быстрые ответы
   ============================================================ */

console.log("🚀 ux.js загружен, жду Sqwid...");

function waitForSqwidUx(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ ux.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidUx((S) => {
  const { db, ref, get, currentUser, showScreen } = S;
  if (!currentUser) return;

  console.log("🔥 ux.js активирован");

  let replyToMsg = null;

  /* ============================================================
     1. REPLY BAR — показать/скрыть
     ============================================================ */
  function showReplyBar(msg) {
    if (!msg) return;
    replyToMsg = msg;

    const bar = document.getElementById("replyBar");
    const nameEl = document.getElementById("replyBarName");
    const textEl = document.getElementById("replyBarText");
    if (!bar) return;

    const su = S.userMap[msg.sender] || {};
    const authorName = msg.sender === currentUser.uid
      ? "Вы"
      : (su.name || su.email || "Пользователь");

    let preview = "";
    if (msg.type === "photo") preview = "Фото" + (msg.text ? ": " + msg.text : "");
    else if (msg.type === "voice") preview = "Голосовое";
    else preview = msg.text || "";

    if (preview.length > 60) preview = preview.slice(0, 60) + "…";

    if (nameEl) nameEl.textContent = authorName;
    if (textEl) textEl.textContent = preview;
    bar.style.display = "flex";

    const input = document.getElementById("msgInput");
    if (input) input.focus();
  }

  function hideReplyBar() {
    replyToMsg = null;
    const bar = document.getElementById("replyBar");
    if (bar) bar.style.display = "none";
  }

  const btnCancelReply = document.getElementById("btnCancelReply");
  if (btnCancelReply) btnCancelReply.addEventListener("click", hideReplyBar);

  /* ============================================================
     2. ПЕРЕХВАТ ОТПРАВКИ — добавляем replyTo к сообщению
     ============================================================ */
  // Перехватываем клик по btnSend и Enter — но chat-main.js уже своё отправил.
  // Вместо перехвата — слушаем изменение Firebase: когда появляется новое сообщение
  // от currentUser с пустым replyTo, а у нас в переменной replyToMsg — обновляем.

  // Проще: слушаем поле msgInput на keydown и btnSend на click ДО chat-main.js
  // Но chat-main.js уже навесил. Поэтому используем MutationObserver на .messages
  // чтобы понять что появилось новое сообщение — и патчим его replyTo.

  // Гораздо проще: перехватываем через setTimeout — когда добавляется сообщение,
  // если у нас есть replyToMsg — обновляем его в базе.

  // НО! Это не сработает, потому что сообщение уже создано без replyTo.
  // Поэтому используем другой подход — перехват ДО отправки.

  const msgInput = document.getElementById("msgInput");
  const btnSend = document.getElementById("btnSend");

  async function attachReplyBeforeSend() {
    if (!replyToMsg) return;
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return;

    // Ждём следующего тика (chat-main.js сейчас создаст сообщение)
    await new Promise(r => setTimeout(r, 100));

    // Находим последнее сообщение от currentUser за последние 2 секунды
    const msgsSnap = await get(ref(db, "messages/" + chatId));
    const all = msgsSnap.val() || {};
    const now = Date.now();
    let latestId = null;
    let latestTs = 0;
    for (const id in all) {
      const m = all[id];
      if (m.sender !== currentUser.uid) continue;
      if (!m.timestamp) continue;
      if (now - m.timestamp > 3000) continue;
      if (m.timestamp > latestTs && !m.replyTo) {
        latestTs = m.timestamp;
        latestId = id;
      }
    }

    if (latestId) {
      let preview = "";
      if (replyToMsg.type === "photo") preview = "Фото";
      else if (replyToMsg.type === "voice") preview = "Голосовое";
      else preview = (replyToMsg.text || "").slice(0, 80);

      const su = S.userMap[replyToMsg.sender] || {};

      await S.update(ref(db, "messages/" + chatId + "/" + latestId), {
        replyTo: {
          id: replyToMsg.id,
          sender: replyToMsg.sender,
          senderName: replyToMsg.sender === currentUser.uid
            ? "Вы"
            : (su.name || su.email || "Пользователь"),
          preview: preview,
          type: replyToMsg.type || "text"
        }
      });
    }

    hideReplyBar();
  }

  if (btnSend) {
    btnSend.addEventListener("click", () => {
      if (replyToMsg) attachReplyBeforeSend();
    }, true);
  }
  if (msgInput) {
    msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && replyToMsg) attachReplyBeforeSend();
    }, true);
  }

  /* ============================================================
     3. ПАТЧ RENDER MESSAGE — добавляем reply-цитату и @username
     ============================================================ */
  // Наблюдаем за появлением новых .msg и патчим их
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (!node.classList || !node.classList.contains("msg")) continue;
        patchMessageNode(node);
      }
    }
  });

  function startObserver() {
    const box = document.getElementById("messages");
    if (box) observer.observe(box, { childList: true, subtree: false });
  }

  // Перезапускаем при смене экрана
  setInterval(() => {
    const box = document.getElementById("messages");
    if (box && !box.dataset.uxObserved) {
      box.dataset.uxObserved = "1";
      observer.observe(box, { childList: true, subtree: false });
    }
  }, 1000);

  function patchMessageNode(el) {
    // Патч reply-цитаты (если сообщение имеет replyTo)
    if (el.dataset.uxPatched) return;
    el.dataset.uxPatched = "1";

    // Найдём msgId и получим replyTo из текущего snapshot в Firebase
    const msgId = el.dataset.msgId;
    const chatId = S.getChatId && S.getChatId();
    if (!msgId || !chatId) return;

    get(ref(db, "messages/" + chatId + "/" + msgId)).then(snap => {
      const msg = snap.val();
      if (!msg) return;

      // Reply-цитата
      if (msg.replyTo && !el.querySelector(".msg-reply-quote")) {
        const quote = document.createElement("div");
        quote.className = "msg-reply-quote";
        quote.innerHTML = `
          <div class="msg-reply-name">${escapeHtml(msg.replyTo.senderName || "Пользователь")}</div>
          <div class="msg-reply-text">${escapeHtml(msg.replyTo.preview || "")}</div>
        `;
        quote.addEventListener("click", async () => {
          const target = document.querySelector(`[data-msg-id="${msg.replyTo.id}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.style.transition = "background 0.6s ease";
            target.style.background = "rgba(249,115,22,0.35)";
            setTimeout(() => { target.style.background = ""; }, 1800);
          }
        });
        el.insertBefore(quote, el.firstChild);
      }
    });

    // @username — делаем кликабельным
    el.querySelectorAll("div").forEach(div => {
      if (div.children.length > 0) return; // только текст
      const html = div.innerHTML;
      if (html.includes("@") && !div.dataset.uxMentions) {
        div.dataset.uxMentions = "1";
        div.innerHTML = html.replace(/@([a-zA-Z0-9_]{3,20})/g, '<span class="msg-mention" data-username="$1">@$1</span>');
      }
    });

    el.querySelectorAll(".msg-mention").forEach(m => {
      if (m.dataset.uxBound) return;
      m.dataset.uxBound = "1";
      m.addEventListener("click", async (e) => {
        e.stopPropagation();
        const uname = m.dataset.username;
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val() || {};
        for (const uid in users) {
          if (users[uid].username && users[uid].username.toLowerCase() === uname.toLowerCase()) {
            if (window.Sqwid.openOtherProfile) window.Sqwid.openOtherProfile(uid);
            return;
          }
        }
        S.showToast("Пользователь @" + uname + " не найден", "info");
      });
    });
  }

  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  /* ============================================================
     4. СВАЙПЫ НА СООБЩЕНИЯХ (вправо — reply, влево — удалить)
     ============================================================ */
  let swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false };

  document.addEventListener("touchstart", (e) => {
    const msg = e.target.closest(".msg");
    if (!msg) return;
    const touch = e.touches[0];
    swipeState = {
      el: msg,
      startX: touch.clientX,
      startY: touch.clientY,
      dx: 0,
      active: true
    };
    msg.style.transition = "none";
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!swipeState.active || !swipeState.el) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeState.startX;
    const dy = touch.clientY - swipeState.startY;

    if (Math.abs(dy) > Math.abs(dx)) {
      // Вертикальный свайп — отменяем
      swipeState.active = false;
      swipeState.el.style.transform = "";
      return;
    }

    swipeState.dx = dx;
    const clamped = Math.max(-80, Math.min(80, dx));
    swipeState.el.style.transform = `translateX(${clamped}px)`;
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (!swipeState.active || !swipeState.el) {
      swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false };
      return;
    }

    const el = swipeState.el;
    const dx = swipeState.dx;
    el.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";

    if (dx > 50) {
      // Свайп вправо → reply
      el.style.transform = "";
      const msgId = el.dataset.msgId;
      const chatId = S.getChatId && S.getChatId();
      if (msgId && chatId) {
        get(ref(db, "messages/" + chatId + "/" + msgId)).then(snap => {
          const msg = snap.val();
          if (msg) showReplyBar({ id: msgId, ...msg });
        });
      }
    } else if (dx < -50) {
      // Свайп влево → удалить (только свои)
      el.style.transform = "";
      const msgId = el.dataset.msgId;
      const chatId = S.getChatId && S.getChatId();
      if (!msgId || !chatId) {
        swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false };
        return;
      }
      get(ref(db, "messages/" + chatId + "/" + msgId)).then(async snap => {
        const msg = snap.val();
        if (!msg) return;
        if (msg.sender !== currentUser.uid) {
          S.showToast("Можно удалить только своё", "warn");
          return;
        }
        const ok = await S.showConfirm("Удалить сообщение?", "Удаление");
        if (!ok) return;
        await S.remove(ref(db, `messages/${chatId}/${msgId}`));
      });
    } else {
      el.style.transform = "";
    }

    swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false };
  });

  /* ============================================================
     5. ПУЛЬСАЦИЯ КНОПКИ ОТПРАВКИ ПРИ НАЛИЧИИ ТЕКСТА
     ============================================================ */
  const inputArea = document.getElementById("inputArea");
  if (msgInput && inputArea) {
    function checkText() {
      const hasText = (msgInput.value || "").trim().length > 0;
      inputArea.classList.toggle("has-text", hasText);
    }
    msgInput.addEventListener("input", checkText);
    msgInput.addEventListener("keyup", checkText);
    checkText();
  }

  /* ============================================================
     6. БЫСТРЫЕ ОТВЕТЫ (быстрые фразы над input-area)
     ============================================================ */
  const QUICK_REPLIES = ["Ок", "Спасибо", "👍", "Позже", "Хорошо"];

  function ensureQuickReplies() {
    let bar = document.getElementById("quickReplies");
    if (bar) return bar;
    const inputArea = document.getElementById("inputArea");
    if (!inputArea) return null;

    bar = document.createElement("div");
    bar.id = "quickReplies";
    bar.className = "quick-replies";
    bar.style.display = "none";

    QUICK_REPLIES.forEach(text => {
      const btn = document.createElement("button");
      btn.className = "quick-reply-btn";
      btn.textContent = text;
      btn.addEventListener("click", () => {
        const input = document.getElementById("msgInput");
        if (input) {
          input.value = text;
          input.focus();
          const event = new Event("input", { bubbles: true });
          input.dispatchEvent(event);
        }
        bar.style.display = "none";
      });
      bar.appendChild(btn);
    });

    inputArea.parentNode.insertBefore(bar, inputArea);
    return bar;
  }

  // Показываем быстрые ответы, когда input пустой и нажат attach / или при первом тапе
  if (msgInput) {
    msgInput.addEventListener("focus", () => {
      const bar = ensureQuickReplies();
      if (!bar) return;
      const hasText = (msgInput.value || "").trim().length > 0;
      bar.style.display = hasText ? "none" : "flex";
    });

    msgInput.addEventListener("input", () => {
      const bar = document.getElementById("quickReplies");
      if (!bar) return;
      const hasText = (msgInput.value || "").trim().length > 0;
      bar.style.display = hasText ? "none" : "flex";
    });

    msgInput.addEventListener("blur", () => {
      setTimeout(() => {
        const bar = document.getElementById("quickReplies");
        if (bar) bar.style.display = "none";
      }, 200);
    });
  }

  /* ============================================================
     7. ОБРАБОТКА КЛИКОВ ПО МОДАЛКЕ ДЕЙСТВИЙ С СООБЩЕНИЕМ
     ============================================================ */
  // maActionReply / maActionCopy / maActionDelete — эти кнопки в modal-msgActions
  // Они дублируют логику долгого нажатия. Оставляем как есть, но обрабатываем.

  const maActionReply = document.getElementById("maActionReply");
  if (maActionReply) {
    maActionReply.addEventListener("click", () => {
      const modal = document.getElementById("modal-msgActions");
      if (modal) modal.classList.remove("active");
      // longPressMsg уже установлен chat-main.js
      // Найдём последнее сообщение, на котором было долгое нажатие
      // Это делается через DOM — берём .msg с фокусом или последнее с data-msg-id
      // Проще: пусть chat-main.js даст нам longPressMsg через window
      // Но у нас его нет. Поэтому берём из window._lastLongPressMsg
      // (придётся добавить в chat-main.js).
      // Пока просто скрываем — пользователь может свайпнуть вправо.
    });
  }

  console.log("✅ ux.js готов");
});