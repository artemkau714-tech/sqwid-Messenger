/* ============================================================
   qr-profile.js — QR-код профиля + Эмодзи + Цвета
   ============================================================ */

console.log("🚀 qr-profile.js загружен, жду Sqwid...");

function waitForSqwidQr(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ qr-profile.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidQr((S) => {
  const { db, ref, get, onValue, update, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 qr-profile.js активирован");

  let myData = {};
  let unsubSelf = null;

  // Текущие летающие эмодзи
  let activeEmojis = [];
  const MAX_EMOJIS = 5;
  const DEFAULT_EMOJIS = ["❄️"];

  // Цветовые пресеты
  const COLOR_PRESETS = {
    "blue":      { name: "Сине-голубой",  bg: "linear-gradient(180deg, #38bdf8, #0ea5e9, #0284c7)" },
    "bw":        { name: "Черно-белый",   bg: "linear-gradient(180deg, #4b5563, #1f2937, #111827)" },
    "gray":      { name: "Бело-серый",    bg: "linear-gradient(180deg, #e5e7eb, #9ca3af, #4b5563)" },
    "purple":    { name: "Фиолетовый",    bg: "linear-gradient(180deg, #c084fc, #8b5cf6, #5b21b6)" },
    "darkblue":  { name: "Сине-черный",   bg: "linear-gradient(180deg, #1e3a8a, #0f172a, #000000)" },
    "pink":      { name: "Розово-черный", bg: "linear-gradient(180deg, #f472b6, #db2777, #831843)" },
    "cyan-red":  { name: "Голубо-красный",bg: "linear-gradient(180deg, #22d3ee, #6366f1, #dc2626)" }
  };

  let currentColor = "blue";

  /* ============================================================
     ПОДПИСКА НА СЕБЯ
     ============================================================ */
  if (unsubSelf) unsubSelf();
  unsubSelf = onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    
    if (myData.qrEmojis && Array.isArray(myData.qrEmojis)) {
      activeEmojis = myData.qrEmojis;
    } else {
      activeEmojis = [...DEFAULT_EMOJIS];
    }

    if (myData.qrColor && COLOR_PRESETS[myData.qrColor]) {
      currentColor = myData.qrColor;
    } else {
      currentColor = "blue";
    }

    applyColorToScreen();

    const screen = document.getElementById("screen-qr");
    if (screen && screen.classList.contains("active")) {
      renderQr();
      startFloatingEmojis();
    }
  });

  /* ============================================================
     ПРИМЕНЕНИЕ ЦВЕТА
     ============================================================ */
  function applyColorToScreen() {
    const screen = document.getElementById("screen-qr");
    if (!screen) return;
    const preset = COLOR_PRESETS[currentColor] || COLOR_PRESETS["blue"];
    screen.style.setProperty("background", preset.bg, "important");
    screen.style.setProperty("background-image", preset.bg, "important");
  }

  /* ============================================================
     ССЫЛКА
     ============================================================ */
  function getProfileLink() {
  const base = window.location.origin;
  if (myData.username) return base + "/chat?u=" + myData.username;
  return base + "/chat?uid=" + currentUser.uid;
}

  /* ============================================================
     QR-ГЕНЕРАЦИЯ
     ============================================================ */
  function generateQR(text) {
    const size = 240;
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&data=" + encodeURIComponent(text) + "&color=000000&margin=0";
  }

  /* ============================================================
     ОТКРЫТИЕ ЭКРАНА
     ============================================================ */
  function openQr() {
    applyColorToScreen();
    renderQr();
    S.showScreen("screen-qr");
    startFloatingEmojis();
  }
  window.Sqwid.openQr = openQr;

  const btnBackQr = document.getElementById("btnBackQr");
  if (btnBackQr) {
    btnBackQr.addEventListener("click", () => {
      S.showScreen("screen-profile");
      stopFloatingEmojis();
      document.getElementById("qrColorPanel").style.display = "none";
      document.getElementById("qrEmojiPanel").style.display = "none";
    });
  }

  /* ============================================================
     РЕНДЕР QR
     ============================================================ */
  function renderQr() {
    const canvas = document.getElementById("qrCanvas");
    const nameEl = document.getElementById("qrName");
    const unEl = document.getElementById("qrUsername");

    const name = myData.name || (currentUser.email || "").split("@")[0] || "Пользователь";
    
    if (unEl) {
      unEl.textContent = myData.username ? "@" + myData.username.toUpperCase() : "@" + name.replace(/\s/g, "").toUpperCase();
    }
    if (nameEl) {
      nameEl.textContent = myData.username ? name : "";
    }

    if (canvas) {
      const link = getProfileLink();
      const qrUrl = generateQR(link);
      canvas.innerHTML = `<img src="${qrUrl}" width="240" height="240" alt="QR" style="display:block; border-radius:12px;">`;
    }
  }

  /* ============================================================
     ЛЕТАЮЩИЕ ЭМОДЗИ
     ============================================================ */
  function startFloatingEmojis() {
    stopFloatingEmojis();
    const container = document.getElementById("qrFloatingEmojis");
    if (!container) return;

    container.innerHTML = "";
    const emojisToUse = activeEmojis.length > 0 ? activeEmojis : DEFAULT_EMOJIS;

    for (let i = 0; i < 20; i++) {
      const el = document.createElement("div");
      const emoji = emojisToUse[Math.floor(Math.random() * emojisToUse.length)];
      el.textContent = emoji;
      const size = 12 + Math.random() * 20;
      el.style.cssText = `
        position: absolute;
        font-size: ${size}px;
        opacity: ${0.2 + Math.random() * 0.5};
        pointer-events: none;
        user-select: none;
        left: ${Math.random() * 100}%;
        top: ${-10 - Math.random() * 20}%;
        animation: fallDown ${8 + Math.random() * 10}s linear infinite;
        animation-delay: ${-Math.random() * 15}s;
      `;
      container.appendChild(el);
    }

    if (!document.getElementById("qrFloatingStyles")) {
      const style = document.createElement("style");
      style.id = "qrFloatingStyles";
      style.textContent = `@keyframes fallDown { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  }

  function stopFloatingEmojis() {
    const container = document.getElementById("qrFloatingEmojis");
    if (container) container.innerHTML = "";
  }

  /* ============================================================
     ПАНЕЛЬ ЭМОДЗИ
     ============================================================ */
  const EMOJI_LIST = ["❄️", "🌟", "❤️", "🔥", "✨", "🎉", "💫", "😍", "🌈", "🍀", "🌸", "🎈", "⭐", "💖", "🦋", "🌙", "☀️", "🍭", "🎵", "🐱"];

  function openEmojiPanel() {
    const panel = document.getElementById("qrEmojiPanel");
    const grid = document.getElementById("qrEmojiGrid");
    if (!panel || !grid) return;

    document.getElementById("qrColorPanel").style.display = "none";
    panel.style.display = "block";
    grid.innerHTML = "";

    EMOJI_LIST.forEach(emoji => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      const isActive = activeEmojis.includes(emoji);
      btn.style.cssText = `
        background: ${isActive ? "rgba(255,255,255,0.3)" : "transparent"};
        border: ${isActive ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)"};
        border-radius: 8px; padding: 8px; font-size: 24px; cursor: pointer; transition: 0.2s;
      `;
      btn.addEventListener("click", () => toggleEmoji(emoji));
      grid.appendChild(btn);
    });
  }

  function toggleEmoji(emoji) {
    if (activeEmojis.includes(emoji)) {
      activeEmojis = activeEmojis.filter(e => e !== emoji);
    } else {
      if (activeEmojis.length >= MAX_EMOJIS) return S.showToast("Максимум 5 эмодзи", "warn");
      activeEmojis.push(emoji);
    }
    update(ref(db, "users/" + currentUser.uid), { qrEmojis: activeEmojis }).catch(() => {});
    openEmojiPanel();
    startFloatingEmojis();
  }

  const btnQrEmoji = document.getElementById("btnQrEmoji");
  if (btnQrEmoji) btnQrEmoji.addEventListener("click", openEmojiPanel);

  const btnCloseQrEmoji = document.getElementById("btnCloseQrEmoji");
  if (btnCloseQrEmoji) btnCloseQrEmoji.addEventListener("click", () => { document.getElementById("qrEmojiPanel").style.display = "none"; });

  /* ============================================================
     ПАНЕЛЬ ЦВЕТА
     ============================================================ */
  function openColorPanel() {
    const panel = document.getElementById("qrColorPanel");
    const grid = document.getElementById("qrColorGrid");
    if (!panel || !grid) return;

    document.getElementById("qrEmojiPanel").style.display = "none";
    panel.style.display = "block";
    grid.innerHTML = "";

    Object.keys(COLOR_PRESETS).forEach(key => {
      const preset = COLOR_PRESETS[key];
      const btn = document.createElement("button");
      const isActive = currentColor === key;
      btn.style.cssText = `
        background: ${preset.bg};
        border: ${isActive ? "3px solid #fff" : "2px solid rgba(255,255,255,0.3)"};
        border-radius: 12px; padding: 16px 8px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer; transition: 0.2s;
        box-shadow: ${isActive ? "0 0 15px rgba(255,255,255,0.5)" : "none"};
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      `;
      btn.textContent = preset.name;
      btn.addEventListener("click", () => {
        currentColor = key;
        applyColorToScreen();
        renderQr();
        update(ref(db, "users/" + currentUser.uid), { qrColor: key }).catch(() => {});
        openColorPanel();
      });
      grid.appendChild(btn);
    });
  }

  const btnQrEdit = document.getElementById("btnQrEdit");
  if (btnQrEdit) btnQrEdit.addEventListener("click", openColorPanel);

  const btnCloseQrColor = document.getElementById("btnCloseQrColor");
  if (btnCloseQrColor) btnCloseQrColor.addEventListener("click", () => { document.getElementById("qrColorPanel").style.display = "none"; });

  /* ============================================================
     КОПИРОВАТЬ ССЫЛКУ
     ============================================================ */
  const btnCopy = document.getElementById("btnCopyQrLink");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const link = getProfileLink();
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(link);
          S.showToast("Ссылка скопирована", "ok");
        } else {
          S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
        }
      } catch (e) {
        S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
      }
    });
  }
/* ============================================================
   ОТКРЫТИЕ СКАНЕРА QR
   ============================================================ */
const btnScanQr = document.getElementById("btnScanQrCode");
if (btnScanQr) {
  // Клонируем, чтобы убить старые "мертвые" обработчики
  const newBtn = btnScanQr.cloneNode(true);
  btnScanQr.parentNode.replaceChild(newBtn, btnScanQr);
  
  newBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Вызываем сканер из qr-scanner.js
    if (window.Sqwid && window.Sqwid.openQrScanner) {
      window.Sqwid.openQrScanner();
    } else {
      S.showToast("Сканер загружается...", "info");
    }
  }, true); // capture = true, чтобы сработать первыми
}
  /* ============================================================
   ПОДЕЛИТЬСЯ QR-КОДОМ (ВМЕСТО СКАЧИВАНИЯ)
   ============================================================ */
const btnDownloadQr = document.getElementById("btnDownloadQr");
if (btnDownloadQr) {
  const newBtn = btnDownloadQr.cloneNode(true);
  btnDownloadQr.parentNode.replaceChild(newBtn, btnDownloadQr);
  
  newBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    S.showToast("Готовим картинку...", "info");

    const canvas = document.createElement("canvas");
    const W = 600;
    const H = 800;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // 1. Рисуем ФОН
    const preset = COLOR_PRESETS[currentColor] || COLOR_PRESETS["blue"];
    const colors = preset.bg.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/g) || ["#38bdf8", "#0284c7"];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    colors.forEach((c, i) => {
      grad.addColorStop(i / (colors.length - 1), c);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. Рисуем ЭМОДЗИ
    const emojisToUse = activeEmojis.length > 0 ? activeEmojis : DEFAULT_EMOJIS;
    for (let i = 0; i < 25; i++) {
      const emoji = emojisToUse[Math.floor(Math.random() * emojisToUse.length)];
      ctx.font = `${20 + Math.random() * 20}px sans-serif`;
      ctx.globalAlpha = 0.2 + Math.random() * 0.4;
      ctx.fillText(emoji, Math.random() * W, Math.random() * H);
    }
    ctx.globalAlpha = 1.0;

    // 3. Рисуем БЕЛУЮ КАРТОЧКУ
    const cardW = 400;
    const cardH = 460;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2;
    const radius = 32;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.fill();

    // 4. ЗАГРУЖАЕМ QR
    const link = getProfileLink();
    const qrUrl = generateQR(link);
    
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    
    qrImg.onload = () => {
      const qrSize = 280;
      const qrX = (W - qrSize) / 2;
      const qrY = cardY + 40;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 5. ТЕКСТ
      const un = myData.username ? "@" + myData.username.toUpperCase() : "@" + (myData.name || "USER").replace(/\s/g, "").toUpperCase();
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(un, W / 2, qrY + qrSize + 40);

      if (myData.username) {
        const name = myData.name || "";
        ctx.fillStyle = "#64748b";
        ctx.font = "600 18px sans-serif";
        ctx.fillText(name, W / 2, qrY + qrSize + 70);
      }

      // 6. ПОДЕЛИТЬСЯ
      canvas.toBlob(async (blob) => {
        if (!blob) return S.showToast("Ошибка создания файла", "error");
        
        const file = new File([blob], "sqwid_qr_" + (myData.username || "me") + ".png", { type: "image/png" });

        // Проверяем поддержку Web Share API
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Мой QR-код в Sqwid",
              text: "Добавь меня в Sqwid! " + link
            });
            S.showToast("Меню поделиться открыто", "ok");
          } catch (err) {
            if (err.name !== "AbortError") {
              S.showToast("Ошибка отправки", "error");
            }
          }
        } else {
          // Если Web Share не поддерживается (например, на старом ПК) — скачиваем через Blob
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 1000);
            S.showToast("Картинка скачана", "ok");
          } catch (e) {
            S.showAlert("Не удалось поделиться. Попробуйте открыть в обычном браузере.", "Ошибка");
          }
        }
      }, "image/png");
    };
    
    qrImg.onerror = () => {
      S.showToast("Ошибка загрузки QR-кода", "error");
    };
    
    qrImg.src = qrUrl;
  }, true);
}
  console.log("✅ qr-profile.js готов (с эмодзи и цветами)");
});