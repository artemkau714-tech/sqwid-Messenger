/* ============================================================
   viewer.js — просмотр фото внутри приложения
   ============================================================ */

console.log("🚀 viewer.js загружен, жду Sqwid...");

function waitForSqwidViewer(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ viewer.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidViewer((S) => {
  const { currentUser, showScreen, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 viewer.js активирован");

  let photos = [];        // список всех фото текущего чата
  let currentIndex = 0;

  /* ============================================================
     ОТКРЫТЬ ПРОСМОТР
     ============================================================ */
  function openPhotoViewer({ photosArr, index }) {
    photos = photosArr || [];
    currentIndex = index || 0;
    renderViewer();
    showScreen("screen-viewer");
  }

  window.Sqwid.openPhotoViewer = openPhotoViewer;

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function renderViewer() {
    const p = photos[currentIndex];
    if (!p) return;

    const img = document.getElementById("viewerImage");
    if (img) img.src = p.photo;

    const titleEl = document.getElementById("viewerTitle");
    if (titleEl) titleEl.textContent = `${currentIndex + 1} / ${photos.length}`;

    const u = userMap[p.sender] || {};
    const senderEl = document.getElementById("viewerSender");
    if (senderEl) senderEl.textContent = u.name || u.email || "Пользователь";

    const timeEl = document.getElementById("viewerTime");
    if (timeEl) timeEl.textContent = fmtDate(p.timestamp);

    const capEl = document.getElementById("viewerCaption");
    if (capEl) capEl.textContent = p.text || "";

    const prevBtn = document.getElementById("btnViewerPrev");
    const nextBtn = document.getElementById("btnViewerNext");
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= photos.length - 1;
  }

  /* ============================================================
     НАВИГАЦИЯ
     ============================================================ */
  const btnPrev = document.getElementById("btnViewerPrev");
  if (btnPrev) btnPrev.addEventListener("click", () => {
    if (currentIndex > 0) { currentIndex--; renderViewer(); }
  });

  const btnNext = document.getElementById("btnViewerNext");
  if (btnNext) btnNext.addEventListener("click", () => {
    if (currentIndex < photos.length - 1) { currentIndex++; renderViewer(); }
  });

  // Свайпы
  const viewerBody = document.querySelector(".viewer-body");
  if (viewerBody) {
    let startX = 0, startY = 0;
    viewerBody.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    viewerBody.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && currentIndex < photos.length - 1) {
          currentIndex++; renderViewer();
        } else if (dx > 0 && currentIndex > 0) {
          currentIndex--; renderViewer();
        }
      }
    }, { passive: true });
  }

  // Клавиатура
  document.addEventListener("keydown", (e) => {
    const viewer = document.getElementById("screen-viewer");
    if (!viewer || !viewer.classList.contains("active")) return;
    if (e.key === "ArrowLeft" && currentIndex > 0) { currentIndex--; renderViewer(); }
    else if (e.key === "ArrowRight" && currentIndex < photos.length - 1) { currentIndex++; renderViewer(); }
    else if (e.key === "Escape") closeViewer();
  });

  /* ============================================================
     КНОПКИ
     ============================================================ */
  function closeViewer() {
    showScreen("screen-messages");
  }

  const btnBack = document.getElementById("btnBackViewer");
  if (btnBack) btnBack.addEventListener("click", closeViewer);

  const btnDownload = document.getElementById("btnDownloadPhoto");
  if (btnDownload) btnDownload.addEventListener("click", () => {
    const p = photos[currentIndex];
    if (!p || !p.photo) return;
    const a = document.createElement("a");
    a.href = p.photo;
    a.download = "sqwid_" + (p.id || Date.now()) + ".jpg";
    a.click();
  });

  /* ============================================================
     ХЕЛПЕР
     ============================================================ */
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getFullYear())} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  console.log("✅ viewer.js готов");
});