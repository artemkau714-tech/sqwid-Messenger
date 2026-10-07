/* ============================================================
   gallery.js — медиа-галерея чата (сетка фото)
   ============================================================ */

console.log("🚀 gallery.js загружен, жду Sqwid...");

function waitForSqwidGallery(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ gallery.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidGallery((S) => {
  const { db, ref, get, onValue, currentUser, showScreen, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 gallery.js активирован");

  let currentChatId = null;
  let photos = [];
  let unsubPhotos = null;

  /* ============================================================
     ОТКРЫТИЕ
     ============================================================ */
  async function openGallery(chatId) {
    if (!chatId) return;
    currentChatId = chatId;

    // Заголовок — имя чата
    const chatSnap = await get(ref(db, "chats/" + chatId));
    const chat = chatSnap.val() || {};
    let name = chat.name || "Медиа";
    if (chat.type === "private") {
      const otherUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
      const ou = userMap[otherUid] || {};
      name = ou.name || ou.email || name;
    }
    const titleEl = document.getElementById("galleryTitle");
    if (titleEl) titleEl.textContent = "🖼 " + name;

    if (unsubPhotos) unsubPhotos();

    unsubPhotos = onValue(ref(db, "messages/" + chatId), (snap) => {
      const data = snap.val() || {};
      photos = [];
      for (const id in data) {
        const m = data[id];
        if (m.type === "photo" && m.photo) {
          photos.push({ id, ...m });
        }
      }
      photos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // новые сверху
      renderGallery();
    });

    showScreen("screen-gallery");
  }

  window.Sqwid.openGallery = openGallery;

  /* ============================================================
     РЕНДЕР СЕТКИ
     ============================================================ */
  function renderGallery() {
    const grid = document.getElementById("galleryGrid");
    const empty = document.getElementById("galleryEmpty");
    const count = document.getElementById("galleryCount");
    if (!grid) return;

    grid.innerHTML = "";

    if (count) count.textContent = photos.length + " фото";

    if (photos.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    photos.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "gallery-item";

      let badge = "";
      if (p.text) {
        badge = `<div class="gallery-item-badge">💬</div>`;
      }

      item.innerHTML = `
        <img src="${p.photo}" alt="" loading="lazy">
        ${badge}
      `;

      item.addEventListener("click", () => {
        if (window.Sqwid && window.Sqwid.openPhotoViewer) {
          window.Sqwid.openPhotoViewer({
            photosArr: photos.slice().reverse(), // viewer открывает с начала
            index: photos.length - 1 - idx
          });
        }
      });

      grid.appendChild(item);
    });
  }

  /* ============================================================
     КНОПКА НАЗАД
     ============================================================ */
  const btnBack = document.getElementById("btnBackGallery");
  if (btnBack) btnBack.addEventListener("click", () => {
    if (unsubPhotos) { unsubPhotos(); unsubPhotos = null; }
    showScreen("screen-chat-info");
  });

  console.log("✅ gallery.js готов");
});