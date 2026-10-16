/* ============================================================
   ux.js — UX-улучшения (облегчённая версия)
   Быстрые ответы, пульсация кнопки, @username-меншены
   Свайпы/reply — перенесено в reply.js
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

  /* ============================================================
     1. ПУЛЬСАЦИЯ КНОПКИ ОТПРАВКИ ПРИ НАЛИЧИИ ТЕКСТА
     ============================================================ */
  const msgInput = document.getElementById("msgInput");
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
     2. БЫСТРЫЕ ОТВЕТЫ (быстрые фразы над input-area)
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
     3. КЛИКАБЕЛЬНЫЕ @username В СООБЩЕНИЯХ
     (не конфликтует с reply.js — там работа с цитатами, тут — с текстом)
     ============================================================ */
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains("msg")) {
          patchMentions(node);
        }
      }
    }
  });

  function startObserver() {
    const box = document.getElementById("messages");
    if (box && !box.dataset.uxMentionsObserved) {
      box.dataset.uxMentionsObserved = "1";
      observer.observe(box, { childList: true, subtree: true });
      // Обработать уже существующие
      box.querySelectorAll(".msg").forEach(patchMentions);
    }
  }

  setInterval(startObserver, 500);

  function patchMentions(el) {
    if (el.dataset.uxMentionsDone) return;
    el.dataset.uxMentionsDone = "1";

    // Ищем только текстовые блоки (не цитаты, не время, не отправителя)
    el.querySelectorAll("div").forEach(div => {
      if (div.children.length > 0) return; // только "чистые" текстовые
      if (div.classList.contains("msg-reply-quote") ||
          div.classList.contains("msg-time") ||
          div.classList.contains("msg-sender") ||
          div.classList.contains("msg-reply-name") ||
          div.classList.contains("msg-reply-text")) return;
      const html = div.innerHTML;
      if (html.includes("@") && !div.dataset.uxMentionPatched) {
        div.dataset.uxMentionPatched = "1";
        div.innerHTML = html.replace(
          /@([a-zA-Z0-9_]{3,20})/g,
          '<span class="msg-mention" data-username="$1">@$1</span>'
        );
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

  /* ============================================================
     4. УДАЛЕНО: свайпы, reply-бар, patch reply-цитат
     Всё это теперь в reply.js
     ============================================================ */

  console.log("✅ ux.js готов (облегчённый)");
});