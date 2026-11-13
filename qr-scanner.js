/* ============================================================
   qr-scanner.js — ФИНАЛЬНЫЙ ФИКС (Обработка ошибок + Крестик)
   ============================================================ */

console.log("🚀 qr-scanner.js загружен");

function waitForSqwidQrScanner(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ qr-scanner.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidQrScanner((S) => {
  const video = document.getElementById("qrScannerVideo");
  const modalScanner = document.getElementById("modal-qr-scanner");
  const modalResult = document.getElementById("modal-qr-result");
  const resultLink = document.getElementById("qrResultLink");
  
  if (!video || !modalScanner) return;

  let stream = null;
  let animationFrame = null;
  let detector = null;
  let flashOn = false;
  let currentTrack = null;
  let lastScannedText = null;

  // ============================================================
  // ЗАПУСК КАМЕРЫ
  // ============================================================
  async function startCamera() {
    // Проверка HTTPS
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      S.showAlert(
        "Камера работает только по защищённому соединению (HTTPS).\n\n" +
        "Если вы открываете приложение по IP или файлу — камера не запустится.",
        "Нужен HTTPS"
      );
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        video.play();
        currentTrack = stream.getVideoTracks()[0];
        
        if ("BarcodeDetector" in window) {
          try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch(e) {}
        }
        
        if (!detector) {
          loadJsQr().then(() => requestAnimationFrame(scanFrame));
        } else {
          requestAnimationFrame(scanFrame);
        }
      };
      
    } catch (err) {
      console.error("Ошибка камеры:", err);
      
      let msg = "Не удалось запустить камеру.\n\n";
      if (err.name === "NotAllowedError") {
        msg += "Вы запретили доступ к камере.\nЗайдите в настройки браузера и разрешите камеру для этого сайта.";
      } else if (err.name === "NotFoundError") {
        msg += "Камера не найдена на устройстве.";
      } else {
        msg += "Ошибка: " + err.message;
      }
      
      S.showAlert(msg, "Ошибка доступа");
      // Закрываем сканер, чтобы не висел черный экран
      stopCamera();
      modalScanner.classList.remove("active");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    currentTrack = null;
    video.srcObject = null;
  }

  function loadJsQr() {
    return new Promise((resolve) => {
      if (window.jsQR) return resolve();
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  // ============================================================
  // СКАНИРОВАНИЕ
  // ============================================================
  async function scanFrame() {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || !stream) {
      animationFrame = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      if (detector) {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          handleScannedCode(barcodes[0].rawValue);
          return;
        }
      } else if (window.jsQR) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleScannedCode(code.data);
          return;
        }
      }
    } catch (e) {}

    animationFrame = requestAnimationFrame(scanFrame);
  }

  function handleScannedCode(text) {
    if (!text || text === lastScannedText) return;
    lastScannedText = text;
    if (navigator.vibrate) navigator.vibrate(100);

    stopCamera();
    modalScanner.classList.remove("active");

    resultLink.textContent = text;
    modalResult.classList.add("active");

    setTimeout(() => { lastScannedText = null; }, 2000);
  }

  // ============================================================
  // ОТКРЫТИЕ / ЗАКРЫТИЕ
  // ============================================================
  window.Sqwid.openQrScanner = function() {
    lastScannedText = null;
    modalScanner.classList.add("active");
    startCamera();
  };

  // 🔥 ЖЕСТКАЯ ПРИВЯЗКА ВСЕХ КНОПОК
  function forceBind(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    
    const handler = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
      callback();
    };
    
    newEl.addEventListener("click", handler, true);
    newEl.addEventListener("touchend", handler, { passive: false, capture: true });
    newEl.addEventListener("pointerdown", handler, true);
  }

  // 1. Крестик (работает всегда, даже если камера висит)
  forceBind("btnCloseQrScanner", () => {
    stopCamera();
    modalScanner.classList.remove("active");
  });

  // 2. Фонарик
  forceBind("btnQrFlash", async () => {
    if (!currentTrack) return S.showToast("Камера не запущена", "warn");
    try {
      const caps = currentTrack.getCapabilities();
      if (caps.torch) {
        flashOn = !flashOn;
        await currentTrack.applyConstraints({ advanced: [{ torch: flashOn }] });
        document.getElementById("btnQrFlash").style.opacity = flashOn ? "1" : "0.5";
      } else {
        S.showToast("Вспышка не поддерживается", "info");
      }
    } catch (e) { S.showToast("Ошибка вспышки", "error"); }
  });

  // 3. Галерея
  forceBind("btnQrGallery", () => {
    document.getElementById("qrGalleryInput").click();
  });

  // Обработка фото
  const galleryInput = document.getElementById("qrGalleryInput");
  if (galleryInput) {
    galleryInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          let foundText = null;
          if (detector) {
            try { const b = await detector.detect(img); if (b.length > 0) foundText = b[0].rawValue; } catch(err) {}
          }
          if (!foundText && window.jsQR) {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) foundText = code.data;
          }

          if (foundText) {
            handleScannedCode(foundText);
            stopCamera();
            modalScanner.classList.remove("active");
          } else {
            S.showAlert("QR-код не найден", "Ошибка");
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      galleryInput.value = "";
    });
  }

  // 4. Открыть ссылку
  forceBind("btnQrResultOpen", () => {
    let url = resultLink.textContent;
    if (url && !url.startsWith("http")) url = "https://" + url;
    window.open(url, "_blank");
  });

  // 5. Назад
  forceBind("btnQrResultBack", () => {
    modalResult.classList.remove("active");
  });

  console.log("✅ qr-scanner.js готов (Финальный фикс)");
});