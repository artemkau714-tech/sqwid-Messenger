/* ============================================================
   send-feedback.js — Анимация отправки сообщения + звук
   Показывает часики/галочку/ошибку в реальном времени
   ============================================================ */

console.log("🚀 send-feedback.js загружен, жду Sqwid...");

function waitForSqwidSendFB(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser && window.Sqwid.db) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ send-feedback.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidSendFB((S) => {
  const { db, ref, get, onValue, remove, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 send-feedback.js активирован");

  /* ============================================================
     ЗВУК ОТПРАВКИ
     ============================================================ */
  let audioCtx = null;
  function ensureCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playSendSound() {
    let enabled = true;
    try { enabled = localStorage.getItem("sqwid_send_sound") !== "0"; } catch (e) {}
    if (!enabled) return;
    const ctx = ensureCtx();
    if (!ctx) return;

    // Короткий «вжух»
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  function playErrorSound() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  }

  /* ============================================================
     ОПТИМИСТИЧНАЯ ОТПРАВКА
     Перехватываем клик по btnSend и Enter — блокируем родной
     обработчик и делаем свой, с оптимистичным рендером.
     ============================================================ */

  let isIntercepting = false;

  // Оптимистичный "пузырь" со статусом отправки
  function renderOptimistic(text, replyTo, tempId) {
    const box = document.getElementById("messages");
    if (!box) return null;

    const div = document.createElement("div");
    div.className = "msg own msg-sending";
    div.dataset.tempId = tempId;
    div.dataset.optimistic = "1";

    let replyHTML = "";
    if (replyTo) {
      replyHTML = `
        <div class="msg-reply-quote" data-target-id="${replyTo.id}">
          <div class="msg-reply-name">${escapeHtml(replyTo.senderName)}</div>
          <div class="msg-reply-text">${escapeHtml(replyTo.preview)}</div>
        </div>
      `;
    }

    div.innerHTML = `
      ${replyHTML}
      <div>${escapeHtml(text)}</div>
      <div class="msg-time">
        ${fmtTime(Date.now())}
        <span class="msg-send-status" title="Отправка...">
          <svg class="send-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" stroke-opacity="0.25"/>
            <path d="M12 3 a9 9 0 0 1 9 9" />
          </svg>
        </span>
      </div>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function setOptimisticStatus(tempId, status, message) {
    const el = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (!el) return;
    const statusEl = el.querySelector(".msg-send-status");
    if (!statusEl) return;

    if (status === "sent") {
      el.classList.remove("msg-sending");
      el.classList.add("msg-sent-flash");
      statusEl.innerHTML = `
        <svg width="12" height="11" viewBox="0 0 14 12" fill="none">
          <polyline points="1,6 5,10 11,2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      statusEl.title = "Отправлено";
      setTimeout(() => el.classList.remove("msg-sent-flash"), 600);
    } else if (status === "error") {
      el.classList.remove("msg-sending");
      el.classList.add("msg-error");
      statusEl.innerHTML = `!`;
      statusEl.title = message || "Ошибка отправки";
      statusEl.style.color = "#ef4444";
      statusEl.style.fontWeight = "900";
      statusEl.style.fontSize = "13px";
      // Позволить повтор по клику
      statusEl.addEventListener("click", (e) => {
        e.stopPropagation();
        S.showToast("Нажмите ещё раз чтобы повторить", "info");
      });
    }
  }

  function removeOptimistic(tempId) {
    const el = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (el) el.remove();
  }

  /* ============================================================
     ПЕРЕХВАТ ОТПРАВКИ
     ============================================================ */
  async function sendOptimistic() {
    const input = document.getElementById("msgInput");
    if (!input) return false;
    const text = input.value.trim();
    if (!text) return false;

    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return false;

    // Проверки (мут, бан)
    if (window._currentUserData && window._currentUserData.muted === true) {
      S.showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
      return true;
    }
    if (window._currentUserData && window._currentUserData.banned === true) {
      S.showToast("🚫 Аккаунт заблокирован", "error", 2000);
      return true;
    }

    // Word-filter
    let pendingFlag = null;
    if (window.SqwidWordFilter) {
      const res = window.SqwidWordFilter.analyze(text);
      if (res.action === "block") {
        S.showToast("Сообщение отклонено: " + res.reason, "error", 3000);
        return true;
      }
      if (res.action === "flag") {
        pendingFlag = {
          reason: res.reason,
          categories: res.categories,
          matches: res.matches.map(m => m.word).slice(0, 5)
        };
      }
    }

    // Лимит длины
    const isPlus = window.Sqwid.isPlus && window.Sqwid.isPlus();
    const maxLen = isPlus ? 4000 : 500;
    if (text.length > maxLen) {
      S.showToast(`Максимум ${maxLen} символов`, "error");
      return true;
    }

    // Режим редактирования — пропускаем к родному обработчику
    // (chat-main.js сам обработает)
    if (window._sqwidEditingMsgId) {
      return false;
    }

    // Мгновенно показываем "пузырь"
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const replyTo = window._sqwidReplyTo || null;

    input.value = "";
    if (window.Sqwid.reply && window.Sqwid.reply.hide) window.Sqwid.reply.hide();
    if (window.Sqwid.stopTyping) window.Sqwid.stopTyping();

    const optimisticEl = renderOptimistic(text, replyTo, tempId);

    // Звук отправки
    playSendSound();

    // Реальная запись в Firebase
    try {
      const newRef = S.push(S.ref(S.db, "messages/" + chatId));
      const payload = {
        sender: currentUser.uid,
        type: "text",
        text,
        timestamp: Date.now()
      };
      if (pendingFlag) {
        payload.flagged = true;
        payload.flagReason = pendingFlag.reason;
        payload.flagCategories = pendingFlag.categories;
        payload.flagMatches = pendingFlag.matches;
      }
      if (replyTo) {
        payload.replyTo = {
          id: replyTo.id,
          sender: replyTo.sender,
          senderName: replyTo.senderName,
          preview: replyTo.preview,
          type: replyTo.type
        };
      }

      await S.set(newRef, payload);
      setOptimisticStatus(tempId, "sent");

      // Убираем оптимистичный — реальное сообщение придёт из onValue
      setTimeout(() => removeOptimistic(tempId), 400);

      // Обновляем чат
      await S.update(S.ref(S.db, "chats/" + chatId), {
        lastMsg: text,
        lastMsgAt: Date.now(),
        lastMsgSender: currentUser.uid
      });

      // Автоудаление
      const chatData = S.getChatData && S.getChatData();
      if (chatData && chatData.autoDelete > 0) {
        setTimeout(() => {
          S.remove(S.ref(S.db, `messages/${chatId}/${newRef.key}`)).catch(() => {});
        }, chatData.autoDelete * 1000);
      }

    } catch (e) {
      setOptimisticStatus(tempId, "error", e.message || "Ошибка");
      playErrorSound();
      S.showToast("Ошибка отправки: " + (e.message || ""), "error", 3000);

      // Вернуть текст в инпут
      if (!input.value) {
        input.value = text;
      }
    }

    return true;
  }

  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /* ============================================================
     ПОДМЕНА КНОПКИ / ENTER
     Используем capture=true, чтобы перехватить ДО chat-main.js
     ============================================================ */
  const btnSend = document.getElementById("btnSend");
  if (btnSend) {
    btnSend.addEventListener("click", async (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      const handled = await sendOptimistic();
      if (!handled) {
        // Пусть родной обработчик выполнится (например, редактирование)
        e.target.dispatchEvent(new Event("click", { bubbles: false }));
      }
    }, true);
  }

  const msgInput = document.getElementById("msgInput");
  if (msgInput) {
    msgInput.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const handled = await sendOptimistic();
      if (!handled) {
        // для edit — родной обработчик
        msgInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      }
    }, true);
  }

  /* ============================================================
     НАСТРОЙКИ ЗВУКА
     ============================================================ */
  window.Sqwid.sendFeedback = {
    getSound: () => {
      try { return localStorage.getItem("sqwid_send_sound") !== "0"; } catch (e) { return true; }
    },
    setSound: (v) => {
      try { localStorage.setItem("sqwid_send_sound", v ? "1" : "0"); } catch (e) {}
      if (v) playSendSound();
    }
  };

  console.log("✅ send-feedback.js готов");
});