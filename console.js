/* ============================================================
   console.js — Консоль администратора (ФИНАЛЬНЫЙ ФИКС)
   ============================================================ */
console.log("🚀 console.js загружен");

function waitForConsole(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ console.js: Sqwid не появился");
    }
  }, 200);
}

waitForConsole((S) => {
  const { db, ref, get, update, currentUser } = S;
  
  if (!currentUser || currentUser.email !== "artemkau714@gmail.com") return;

  console.log("🔥 console.js активирован для владельца");

  // Кнопка в настройках
  const btnOpen = document.getElementById("openConsoleBtn");
  if (btnOpen) {
    btnOpen.style.display = "flex";
    btnOpen.onclick = () => {
      S.showScreen("screen-console");
      printLog("Консоль открыта.", "#3b82f6");
    };
  }

  const logBox = document.getElementById("consoleLog");
  const input = document.getElementById("consoleInput");
  const runBtn = document.getElementById("consoleRun");

  // КРИТИЧЕСКИЙ ФИКС: проверяем, нашли ли элементы
  if (!logBox) console.warn("❌ consoleLog не найден");
  if (!input) console.warn("❌ consoleInput не найден");
  if (!runBtn) console.warn("❌ consoleRun не найден");

  function printLog(text, color) {
    if (!logBox) return;
    const div = document.createElement("div");
    div.style.color = color || "#10b981";
    div.style.marginBottom = "4px";
    div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  async function findUser(query) {
    if (!query) return null;
    if (query.startsWith("@")) {
      const uname = query.slice(1).toLowerCase();
      const snap = await get(ref(db, "users"));
      const users = snap.val() || {};
      for (const uid in users) {
        if (users[uid].username && users[uid].username.toLowerCase() === uname) {
          return { uid, ...users[uid] };
        }
      }
      return null;
    }
    if (query.includes("@")) {
      const snap = await get(ref(db, "users"));
      const users = snap.val() || {};
      for (const uid in users) {
        if (users[uid].email && users[uid].email.toLowerCase() === query.toLowerCase()) {
          return { uid, ...users[uid] };
        }
      }
      return null;
    }
    const snap = await get(ref(db, "users/" + query));
    const u = snap.val();
    if (u) return { uid: query, ...u };
    return null;
  }

  async function runCommand() {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    printLog("> " + text, "#f97316");

    const parts = text.split(" ");
    const cmd = parts[0].toLowerCase();
    const query = parts[1];
    const arg = parts[2];

    if (!query) return printLog("Ошибка: укажи uid, email или @username", "#ef4444");

    try {
      const user = await findUser(query);
      if (!user) return printLog("Пользователь не найден", "#ef4444");

      printLog("Найден: " + (user.name || user.email || user.uid), "#3b82f6");

      const updates = {};
      switch (cmd) {
        case "ban": updates.banned = true; break;
        case "unban": updates.banned = null; break;
        case "mute": updates.muted = true; break;
        case "unmute": updates.muted = null; break;
        case "freeze": updates.frozen = true; break;
        case "verify": updates.verified = true; break;
        case "unverify": updates.verified = null; break;
        case "takeplus": updates.plusUntil = null; break;
        case "plus":
          const months = parseInt(arg) || 1;
          updates.plusUntil = Date.now() + months * 30 * 24 * 60 * 60 * 1000;
          break;
        case "sq":
          const amt = parseInt(arg) || 0;
          updates.coins = (user.coins || 0) + amt;
          break;
        case "takesq":
          const tamt = parseInt(arg) || 0;
          updates.coins = Math.max(0, (user.coins || 0) - tamt);
          break;
        case "info":
          printLog("--- ИНФО ---", "#f97316");
          printLog("Имя: " + (user.name || "—"), "#fff");
          printLog("Email: " + (user.email || "—"), "#fff");
          printLog("Username: @" + (user.username || "—"), "#fff");
          printLog("UID: " + user.uid, "#fff");
          printLog("Баланс: " + (user.coins || 0) + " SQ", "#fff");
          return;
        default:
          return printLog("❌ Неизвестная команда", "#ef4444");
      }

      await update(ref(db, "users/" + user.uid), updates);
      printLog("✅ Выполнено: " + cmd, "#10b981");

    } catch (e) {
      printLog("Ошибка: " + e.message, "#ef4444");
    }
  }

  // Привязка событий
  if (runBtn) {
    runBtn.onclick = runCommand;
    console.log("✅ Обработчик ОК привязан");
  }
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") runCommand();
    };
  }

  const btnBack = document.getElementById("btnBackConsole");
  if (btnBack) {
    btnBack.onclick = () => S.showScreen("screen-settings");
  }
});