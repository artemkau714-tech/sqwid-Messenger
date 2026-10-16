/* ============================================================
   pwa-install.js — Баннер «Установить Sqwid как приложение»
   ============================================================ */

console.log("🚀 pwa-install.js загружен");

(function () {
  "use strict";

  let deferredPrompt = null;

  /* ---- Уже установлено как PWA — выходим ---- */
  if (window.matchMedia("(display-mode: standalone)").matches) return;
  if (window.navigator.standalone === true) return;

  /* ---- Не показывать 7 дней после закрытия ---- */
  const HIDE_UNTIL = parseInt(localStorage.getItem("sqwid_install_hide_until") || "0");
  const canShow = Date.now() >= HIDE_UNTIL;

  /* ---- Chrome/Android: ловим событие ---- */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (canShow) showInstallBanner();
  });

  /* ---- Установлено ---- */
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstallBanner();
    console.log("✅ Sqwid установлен");
  });

  /* ============================================================
     БАННЕР УСТАНОВКИ
     ============================================================ */
  function showInstallBanner() {
    if (document.getElementById("pwaInstallBanner")) return;
    if (!canShow) return;

    const screenCall = document.getElementById("screen-call");
    if (screenCall && screenCall.classList.contains("active")) return;

    const banner = document.createElement("div");
    banner.id = "pwaInstallBanner";
    banner.innerHTML = `
      <div class="pwa-banner-inner">
        <div class="pwa-banner-icon">
          <svg viewBox="0 0 100 100" width="40" height="40">
            <circle cx="50" cy="50" r="50" fill="#f97316"/>
            <path d="M50 15s15 15 15 30a15 15 0 0 1-30 0c0-8 5-12 5-12s-20 15-20 35a30 30 0 0 0 60 0c0-25-30-53-30-53z" fill="#fff"/>
          </svg>
        </div>
        <div class="pwa-banner-text">
          <div class="pwa-banner-title">Установить Sqwid</div>
          <div class="pwa-banner-sub">Открывай в один тап, получай уведомления</div>
        </div>
        <button class="pwa-banner-btn" id="pwaInstallBtn">Установить</button>
        <button class="pwa-banner-close" id="pwaCloseBtn" aria-label="Закрыть">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    ensureStyles();

    document.getElementById("pwaInstallBtn").addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log("PWA install outcome:", outcome);
      deferredPrompt = null;
      hideInstallBanner();
    });

    document.getElementById("pwaCloseBtn").addEventListener("click", () => {
      localStorage.setItem("sqwid_install_hide_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    const el = document.getElementById("pwaInstallBanner");
    if (el) el.remove();
    const ios = document.querySelector(".pwa-ios-hint");
    if (ios) ios.remove();
  }

  /* ============================================================
     iOS Safari — ручная подсказка
     ============================================================ */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  function isSafari() {
    return /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  }

  if (isIOS() && isSafari() && canShow) {
    setTimeout(() => {
      if (document.querySelector(".pwa-ios-hint")) return;
      if (window.navigator.standalone === true) return;

      const screenCall = document.getElementById("screen-call");
      if (screenCall && screenCall.classList.contains("active")) return;

      const hint = document.createElement("div");
      hint.className = "pwa-ios-hint";
      hint.innerHTML = `
        📲 <b>Чтобы установить Sqwid:</b><br>
        1. Нажми <b>«Поделиться»</b> внизу Safari<br>
        2. Выбери <b>«На экран Домой»</b><br>
        3. Нажми <b>«Добавить»</b>
        <button id="pwaIosClose">Понятно</button>
      `;
      document.body.appendChild(hint);

      ensureStyles();

      hint.querySelector("#pwaIosClose").addEventListener("click", () => {
        localStorage.setItem("sqwid_install_hide_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
        hint.remove();
      });
    }, 5000);
  }

  /* ============================================================
     СТИЛИ
     ============================================================ */
  function ensureStyles() {
    if (document.getElementById("pwaInstallStyles")) return;
    const style = document.createElement("style");
    style.id = "pwaInstallStyles";
    style.textContent = `
      #pwaInstallBanner {
        position: fixed;
        bottom: 90px;
        left: 12px;
        right: 12px;
        z-index: 9997;
        animation: pwaSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes pwaSlideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .pwa-banner-inner {
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #1a1a1a, #000);
        border: 1px solid rgba(249, 115, 22, 0.4);
        border-radius: 16px;
        padding: 10px 12px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 40px rgba(249, 115, 22, 0.2);
      }
      .pwa-banner-icon {
        width: 40px; height: 40px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pwa-banner-text { flex: 1; min-width: 0; }
      .pwa-banner-title {
        font-size: 0.88rem;
        font-weight: 800;
        color: #fff;
        line-height: 1.2;
      }
      .pwa-banner-sub {
        font-size: 0.72rem;
        color: #a1a1aa;
        margin-top: 2px;
        line-height: 1.2;
      }
      .pwa-banner-btn {
        flex-shrink: 0;
        padding: 8px 14px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, #f97316, #f59e0b);
        color: #fff;
        font-size: 0.82rem;
        font-weight: 800;
        cursor: pointer;
        font-family: inherit;
        transition: transform 0.15s ease;
      }
      .pwa-banner-btn:active { transform: scale(0.94); }
      .pwa-banner-close {
        flex-shrink: 0;
        width: 28px; height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        transition: transform 0.15s ease;
      }
      .pwa-banner-close:active { transform: scale(0.9); }

      .pwa-ios-hint {
        position: fixed;
        bottom: 90px;
        left: 12px;
        right: 12px;
        z-index: 9997;
        background: linear-gradient(135deg, #1a1a1a, #000);
        border: 1px solid rgba(249, 115, 22, 0.4);
        border-radius: 16px;
        padding: 14px;
        color: #fff;
        font-size: 0.82rem;
        line-height: 1.55;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        animation: pwaSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .pwa-ios-hint b { color: #f97316; }
      .pwa-ios-hint button {
        margin-top: 10px;
        width: 100%;
        padding: 10px;
        border-radius: 10px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
      }
      .pwa-ios-hint button:active { transform: scale(0.97); }
    `;
    document.head.appendChild(style);
  }

  console.log("✅ pwa-install.js готов");
})();