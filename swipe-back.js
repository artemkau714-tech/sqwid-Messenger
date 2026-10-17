/* ============================================================
   swipe-back.js — Глобальный свайп для закрытия экранов
   (как в iOS/Telegram: с любого места + плавная анимация)
   ============================================================ */

console.log("🚀 swipe-back.js загружен");

(function () {
  let startX = 0;
  let startY = 0;
  let isSwiping = false;
  let isVerticalScroll = false;
  let activeScreen = null;

  document.addEventListener("touchstart", (e) => {
    // Если открыто модальное окно (например, просмотр фото) — свайп не нужен
    if (document.querySelector(".modal.active")) return;
    
    // Если свайпаем внутри горизонтального списка (например, папки или реакции) — игнорируем
    if (e.target.closest(".chat-folders") || e.target.closest(".msg-reactions") || e.target.closest(".profile-tabs-row")) return;

    activeScreen = document.querySelector(".screen.active");
    if (!activeScreen) return;

    // На главных экранах (Чаты, Настройки, Профиль) свайп "Назад" не нужен
    const rootScreens = ["screen-chats", "screen-settings", "screen-profile", "screen-login", "screen-register"];
    if (rootScreens.includes(activeScreen.id)) {
      activeScreen = null;
      return;
    }

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = false;
    isVerticalScroll = false;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!activeScreen) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    // Определяем направление, если еще не определили
    if (!isSwiping && !isVerticalScroll) {
      if (Math.abs(dy) > Math.abs(dx) + 5) {
        // Пошли вниз/вверх — это скролл, отключаем свайп
        isVerticalScroll = true;
        activeScreen.style.transition = "transform 0.2s ease";
        activeScreen.style.transform = "";
        return;
      } else if (dx > 10) {
        // Пошли вправо — это свайп "Назад"
        isSwiping = true;
        activeScreen.style.transition = "none"; // Отключаем анимацию на время движения пальца
      }
    }

    // Если это свайп вправо — двигаем экран
    if (isSwiping) {
      // Блокируем стандартный скролл браузера
      if (e.cancelable) e.preventDefault(); 
      
      // Сопротивление: чем дальше, тем сложнее тянуть (эффект резинки)
      const resistance = dx > 150 ? 150 + (dx - 150) * 0.2 : dx;
      
      // Наклоняем экран для красоты (как в iOS)
      const rotate = Math.min(resistance * 0.05, 10); 
      
      activeScreen.style.transform = `translateX(${resistance}px) scale(1) rotateY(-${rotate}deg)`;
      activeScreen.style.transformOrigin = "left center";
      activeScreen.style.borderRadius = `${Math.min(resistance * 0.3, 20)}px 0 0 ${Math.min(resistance * 0.3, 20)}px`;
    }
  }, { passive: false }); // passive: false нужен, чтобы работал e.preventDefault()

  document.addEventListener("touchend", (e) => {
    if (!activeScreen || isVerticalScroll) {
      activeScreen = null;
      return;
    }

    if (!isSwiping) {
      activeScreen = null;
      return;
    }

    const dx = e.changedTouches[0].clientX - startX;
    const screen = activeScreen;
    activeScreen = null;

    // Включаем плавную анимацию (пружинка)
    screen.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease, border-radius 0.3s ease";

    if (dx > 100) {
      // СВАЙП УСПЕШЕН — закрываем экран
      screen.style.transform = `translateX(100%) scale(1) rotateY(-10deg)`;
      screen.style.opacity = "0";

      setTimeout(() => {
        // Возвращаем стили в исходное состояние для следующего открытия
        screen.style.transform = "";
        screen.style.opacity = "";
        screen.style.borderRadius = "";
        screen.style.transition = "";
        
        // Вызываем логику "Назад"
        triggerBackAction(screen);
      }, 300); // Ждем окончания анимации
    } else {
      // СВАЙП ОТМЕНЕН — возвращаем на место
      screen.style.transform = "";
      screen.style.borderRadius = "";
    }
  });

  // Логика, куда возвращаться
  function triggerBackAction(screen) {
    const screenId = screen.id;
    
    if (screenId === "screen-messages") {
      const backBtn = document.getElementById("btnBack");
      if (backBtn) backBtn.click();
    } 
    else if (screenId.startsWith("screen-settings-")) {
      const backBtn = screen.querySelector(".settings-back-btn");
      if (backBtn) backBtn.click();
      else if (window.Sqwid) window.Sqwid.showScreen("screen-settings");
    }
    else {
      // Для галереи, профиля собеседника, инфо о чате и т.д.
      if (window.Sqwid) {
        const chatId = window.Sqwid.getChatId && window.Sqwid.getChatId();
        if (chatId && screenId !== "screen-chat-info") {
          window.Sqwid.showScreen("screen-messages");
        } else if (chatId) {
          window.Sqwid.showScreen("screen-chat-info"); // Из галереи возвращаем в инфо
        } else {
          window.Sqwid.showScreen("screen-chats");
        }
      }
    }
  }
})();