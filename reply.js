/* ============================================================
   reply.js — правильные ответы на сообщения (reply) + АНИМАЦИИ
   ============================================================ */

console.log("🚀 reply.js загружен, жду Sqwid...");

function waitForSqwidReply(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser && window.Sqwid.db) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ reply.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidReply((S) => {
  const { db, ref, get, onValue, currentUser, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 reply.js активирован");

  let replyToMsg = null;

  /* ============================================================
     REPLY BAR (С АНИМАЦИЕЙ)
     ============================================================ */
  function showReplyBar(msg) {
    if (!msg) return;
    replyToMsg = msg;

    const bar = document.getElementById("replyBar");
    const nameEl = document.getElementById("replyBarName");
    const textEl = document.getElementById("replyBarText");
    if (!bar) return;

    const su = userMap[msg.sender] || {};
    const authorName = msg.sender === currentUser.uid
      ? "Вы"
      : (su.name || su.email || "Пользователь");

    let preview = "";
    if (msg.type === "photo") preview = "📷 Фото" + (msg.text ? ": " + msg.text : "");
    else if (msg.type === "voice") preview = "🎤 Голосовое";
    else preview = msg.text || "";

    if (preview.length > 80) preview = preview.slice(0, 80) + "…";

    if (nameEl) nameEl.textContent = authorName;
    if (textEl) textEl.textContent = preview;
    
    // Анимация появления (пружина)
    bar.style.display = "flex";
    bar.style.animation = "none";
    void bar.offsetWidth; // Триггер рефлоу
    bar.style.animation = "replyBarSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both";

    const input = document.getElementById("msgInput");
    if (input) {
      input.focus();
      // Легкий скролл к инпуту, чтобы было видно панель
      input.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    // Экспортируем в window — чтобы sendMessage в chat-main.js видел
    window._sqwidReplyTo = {
      id: msg.id,
      sender: msg.sender,
      senderName: authorName,
      preview: preview,
      type: msg.type || "text"
    };
  }

  function hideReplyBar() {
    replyToMsg = null;
    window._sqwidReplyTo = null;
    const bar = document.getElementById("replyBar");
    if (bar) {
      // Анимация исчезновения
      bar.style.animation = "replyBarHide 0.2s ease-in forwards";
      setTimeout(() => {
        bar.style.display = "none";
        bar.style.animation = "";
      }, 200);
    }
  }

  // Экспорт для других модулей
  window.Sqwid.reply = {
    show: showReplyBar,
    hide: hideReplyBar,
    get: () => window._sqwidReplyTo,
    getMsg: () => replyToMsg
  };

  const btnCancelReply = document.getElementById("btnCancelReply");
  if (btnCancelReply) {
    btnCancelReply.addEventListener("click", () => {
      // Анимация вращения крестика
      const svg = btnCancelReply.querySelector("svg");
      if (svg) svg.style.animation = "rotateCross 0.3s ease-in both";
      hideReplyBar();
    });
  }

  /* ============================================================
     СВАЙП ВПРАВО — REPLY, ВЛЕВО — УДАЛИТЬ (С АНИМАЦИЕЙ)
     ============================================================ */
  let swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false, locked: false };

  document.addEventListener("touchstart", (e) => {
    const msg = e.target.closest(".msg");
    if (!msg) return;
    const touch = e.touches[0];
    swipeState = {
      el: msg,
      startX: touch.clientX,
      startY: touch.clientY,
      dx: 0,
      active: true,
      locked: false
    };
    msg.style.transition = "none";
    msg.style.zIndex = "10"; // Поднимаем над другими
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!swipeState.active || !swipeState.el) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeState.startX;
    const dy = touch.clientY - swipeState.startY;

    // Если вертикально больше — блокируем и отпускаем скролл
    if (!swipeState.locked && Math.abs(dy) > Math.abs(dx) + 8) {
      swipeState.locked = true;
      swipeState.el.style.transform = "";
      swipeState.el.style.boxShadow = "";
      swipeState.el.style.zIndex = "";
      return;
    }
    if (swipeState.locked) return;

    swipeState.dx = dx;
    const clamped = Math.max(-90, Math.min(90, dx));
    
    // Наклоняем сообщение (эффект как в iOS)
    const tilt = clamped * 0.05; 
    
    swipeState.el.style.transform = `translateX(${clamped}px) rotate(${tilt}deg)`;
    
    // Добавляем тень при свайпе
    if (Math.abs(clamped) > 10) {
      swipeState.el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    }

    // Индикация
    if (clamped > 20) {
      swipeState.el.style.background = "rgba(249,115,22,0.08)";
    } else if (clamped < -20) {
      swipeState.el.style.background = "rgba(239,68,68,0.08)";
    } else {
      swipeState.el.style.background = "";
    }
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (!swipeState.active || !swipeState.el) {
      swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false, locked: false };
      return;
    }

    const el = swipeState.el;
    const dx = swipeState.dx;
    
    // Возвращаем плавность (пружинка при отпускании)
    el.style.transition = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.2s ease";
    el.style.transform = "";
    el.style.background = "";
    el.style.boxShadow = "";
    el.style.zIndex = "";

    if (!swipeState.locked && dx > 60) {
      // СВАЙП ВПРАВО → REPLY
      const msgId = el.dataset.msgId;
      const chatId = S.getChatId && S.getChatId();
      if (msgId && chatId) {
        get(ref(db, "messages/" + chatId + "/" + msgId)).then(snap => {
          const msg = snap.val();
          if (msg) showReplyBar({ id: msgId, ...msg });
        });
      }
      if (navigator.vibrate) navigator.vibrate(15);
    } else if (!swipeState.locked && dx < -60) {
      // СВАЙП ВЛЕВО → УДАЛИТЬ (только своё)
      const msgId = el.dataset.msgId;
      const chatId = S.getChatId && S.getChatId();
      if (!msgId || !chatId) {
        swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false, locked: false };
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
        
        // Анимация удаления
        el.style.animation = "msgOut 0.3s ease-in forwards";
        setTimeout(() => {
          S.remove(ref(db, `messages/${chatId}/${msgId}`));
        }, 250);
      });
      if (navigator.vibrate) navigator.vibrate(20);
    }

    swipeState = { el: null, startX: 0, startY: 0, dx: 0, active: false, locked: false };
  });

  /* ============================================================
     КЛИК ПО ЦИТАТЕ ВНУТРИ СООБЩЕНИЯ — ПЕРЕЙТИ К ОРИГИНАЛУ
     ============================================================ */
  document.addEventListener("click", (e) => {
    const quote = e.target.closest(".msg-reply-quote");
    if (!quote) return;
    const targetId = quote.dataset.targetId;
    if (!targetId) return;

    e.stopPropagation();
    const target = document.querySelector(`[data-msg-id="${targetId}"]`);
    if (!target) {
      S.showToast("Сообщение не загружено", "info");
      return;
    }
    
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Анимация пульсации (добавляем класс и убираем)
    target.classList.add("highlight-target");
    setTimeout(() => { 
      target.classList.remove("highlight-target"); 
    }, 1500);
  });

  /* ============================================================
     ПАТЧ ОТРИСОВКИ СООБЩЕНИЙ — ДОБАВЛЯЕМ ЦИТАТУ REPLY
     ============================================================ */
  function patchMessage(el, msgData) {
    if (!msgData || !msgData.replyTo) return;
    if (el.querySelector(".msg-reply-quote")) return;

    const quote = document.createElement("div");
    quote.className = "msg-reply-quote";
    quote.dataset.targetId = msgData.replyTo.id;
    
    // Начальное состояние для анимации
    quote.style.opacity = "0";
    quote.style.transform = "translateY(-10px) scale(0.95)";
    quote.style.maxHeight = "0";
    
    quote.innerHTML = `
      <div class="msg-reply-name">${escapeHtml(msgData.replyTo.senderName || "Пользователь")}</div>
      <div class="msg-reply-text">${escapeHtml(msgData.replyTo.preview || "")}</div>
    `;
    el.insertBefore(quote, el.firstChild);

    // Запускаем анимацию появления цитаты
    setTimeout(() => {
      quote.style.transition = "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
      quote.style.opacity = "1";
      quote.style.transform = "translateY(0) scale(1)";
      quote.style.maxHeight = "100px";
    }, 50);
  }

  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (!node.classList || !node.classList.contains("msg")) continue;
        const msgId = node.dataset.msgId;
        if (!msgId) continue;
        if (node.dataset.replyPatched) continue;
        node.dataset.replyPatched = "1";

        const chatId = S.getChatId && S.getChatId();
        if (!chatId) continue;
        get(ref(db, "messages/" + chatId + "/" + msgId)).then(snap => {
          const msg = snap.val();
          if (msg) patchMessage(node, msg);
        });
      }
    }
  });

  function startObserver() {
    const box = document.getElementById("messages");
    if (!box) return;
    if (box.dataset.replyObserver) return;
    box.dataset.replyObserver = "1";
    observer.observe(box, { childList: true, subtree: true });
  }

  setInterval(startObserver, 500);

  console.log("✅ reply.js готов (с анимациями)");
});