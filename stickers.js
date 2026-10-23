/* ============================================================
   stickers.js — Своя загрузка стикеров + Сжатие картинок
   ============================================================ */

console.log("🚀 stickers.js загружен (Свои стикеры + Сжатие)");

(function () {
  const tabs = document.querySelector(".emoji-tabs");
  if (!tabs) return;

  if (document.getElementById("tab-stickers")) return;

  // Добавляем кнопку вкладки
  const stickerTabBtn = document.createElement("button");
  stickerTabBtn.className = "emoji-tab";
  stickerTabBtn.id = "tab-stickers";
  stickerTabBtn.dataset.tab = "stickers";
  stickerTabBtn.textContent = "🎨";
  tabs.appendChild(stickerTabBtn);

  // Контейнер для стикеров
  const grid = document.getElementById("emojiGrid");
  if (!grid) return;

  const stickerContainer = document.createElement("div");
  stickerContainer.id = "stickersContainer";
  stickerContainer.style.display = "none";
  stickerContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(70px, 1fr))";
  stickerContainer.style.gap = "10px";
  stickerContainer.style.padding = "10px";
  stickerContainer.style.overflowY = "auto";
  stickerContainer.style.height = "100%";
  stickerContainer.style.alignContent = "start";

  grid.parentNode.insertBefore(stickerContainer, grid.nextSibling);

  // Кнопка загрузки
  const uploadBtn = document.createElement("div");
  uploadBtn.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:2px dashed var(--accent);border-radius:10px;cursor:pointer;color:var(--accent);font-size:24px;font-weight:bold;">+</div>`;
  uploadBtn.style.aspectRatio = "1/1";
  uploadBtn.onclick = () => document.getElementById("stickerUploadInput").click();
  stickerContainer.appendChild(uploadBtn);

  // Скрытый инпут для файла
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "stickerUploadInput";
  fileInput.accept = "image/png, image/jpeg, image/gif, image/webp";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  // ============================================================
  // ФУНКЦИЯ СЖАТИЯ КАРТИНКИ (Canvas)
  // ============================================================
  function compressImage(file, maxSizeKB, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Если картинка гигантская, уменьшаем до 512px (чтобы не убить память)
        const MAX_DIM = 512;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Сжимаем в WebP (самый легкий формат) с качеством 0.8
        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/webp", quality);

        // Если всё еще больше лимита, снижаем качество
        while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/webp", quality);
        }

        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  // ЛОГИКА СОХРАНЕНИЯ
  // ============================================================
  function getMyStickers() {
    try {
      const saved = localStorage.getItem("sqwid_my_stickers");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  function saveMyStickers(arr) {
    try {
      localStorage.setItem("sqwid_my_stickers", JSON.stringify(arr));
    } catch (e) {
      if (window.Sqwid && window.Sqwid.showToast) {
        window.Sqwid.showToast("Ошибка: память переполнена", "error");
      }
    }
  }

  function renderStickers() {
    stickerContainer.innerHTML = "";
    stickerContainer.appendChild(uploadBtn);

    const stickers = getMyStickers();
    
    stickers.forEach((url, index) => {
      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      wrap.style.aspectRatio = "1/1";
      
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      img.style.cursor = "pointer";
      img.style.borderRadius = "8px";
      img.style.transition = "transform 0.2s ease";
      
      img.onmouseover = () => img.style.transform = "scale(1.1)";
      img.onmouseout = () => img.style.transform = "scale(1)";
      
      img.onclick = () => sendSticker(url);

      // Кнопка удаления
      const delBtn = document.createElement("div");
      delBtn.innerHTML = "✕";
      delBtn.style.position = "absolute";
      delBtn.style.top = "-5px";
      delBtn.style.right = "-5px";
      delBtn.style.width = "20px";
      delBtn.style.height = "20px";
      delBtn.style.borderRadius = "50%";
      delBtn.style.background = "rgba(239, 68, 68, 0.9)";
      delBtn.style.color = "#fff";
      delBtn.style.fontSize = "12px";
      delBtn.style.display = "flex";
      delBtn.style.alignItems = "center";
      delBtn.style.justifyContent = "center";
      delBtn.style.cursor = "pointer";
      delBtn.style.zIndex = "10";
      
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Удалить этот стикер?")) {
          const current = getMyStickers();
          current.splice(index, 1);
          saveMyStickers(current);
          renderStickers();
        }
      };

      wrap.appendChild(img);
      wrap.appendChild(delBtn);
      stickerContainer.appendChild(wrap);
    });
  }

  // Обработка загрузки
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Если картинка изначально больше 5 МБ, браузер может зависнуть при сжатии
    if (file.size > 5 * 1024 * 1024) {
      if (window.Sqwid && window.Sqwid.showToast) {
        window.Sqwid.showToast("Файл слишком большой (макс. 5 МБ)", "error");
      }
      return;
    }

    if (window.Sqwid && window.Sqwid.showToast) {
      window.Sqwid.showToast("Обрабатываем...", "info");
    }

    // Вызываем функцию сжатия (лимит 150 КБ)
    compressImage(file, 150, (compressedBase64) => {
      const current = getMyStickers();
      current.push(compressedBase64);
      saveMyStickers(current);
      renderStickers();
      
      if (window.Sqwid && window.Sqwid.showToast) {
        window.Sqwid.showToast("Стикер добавлен!", "ok");
      }
    });
    
    fileInput.value = ""; // Сброс
  };

  // ============================================================
  // ОТПРАВКА
  // ============================================================
  function sendSticker(url) {
    if (!window.Sqwid || !window.Sqwid.push) return;
    const chatId = window.Sqwid.getChatId();
    if (!chatId) return;

    const { push, ref, set, update, db, currentUser } = window.Sqwid;

    const newRef = push(ref(db, "messages/" + chatId));
    set(newRef, {
      sender: currentUser.uid,
      type: "photo",
      photo: url,
      text: "",
      timestamp: Date.now()
    });

    update(ref(db, "chats/" + chatId), {
      lastMsg: "🎨 Стикер",
      lastMsgAt: Date.now(),
      lastMsgSender: currentUser.uid
    });
  }

  // Переключение вкладок
  stickerTabBtn.addEventListener("click", () => {
    document.querySelectorAll(".emoji-tab").forEach(t => t.classList.remove("active"));
    stickerTabBtn.classList.add("active");
    grid.style.display = "none";
    stickerContainer.style.display = "grid";
    renderStickers();
  });

  document.querySelectorAll(".emoji-tab:not(#tab-stickers)").forEach(tab => {
    tab.addEventListener("click", () => {
      stickerContainer.style.display = "none";
      grid.style.display = "grid";
    });
  });

  console.log("✅ stickers.js готов");
})();