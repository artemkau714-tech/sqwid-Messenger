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
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (currentTrack) {
      try {
        if (flashOn) currentTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      } catch (e) {}
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    currentTrack = null;
    flashOn = false;
    const flashButton = document.getElementById("btnQrFlash");
    if (flashButton) flashButton.style.opacity = "0.75";
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

    if (resultLink) resultLink.textContent = text;
    if (modalResult) modalResult.classList.add("active");
    else S.showAlert("QR-код распознан:\\n" + text, "Результат");

    setTimeout(() => { lastScannedText = null; }, 2000);
  }

  // ============================================================
  // ОТКРЫТИЕ / ЗАКРЫТИЕ
  // ============================================================
  window.Sqwid.openQrScanner = function() {
    lastScannedText = null;
    modalScanner.classList.add("active");
    if (stream) stopCamera();
    startCamera();
  };

  // Одна click-привязка: touchend + pointerdown + click давали дубли на Android.
  function forceBind(id, callback) {
    const el = document.getElementById(id);
    if (!el || el.dataset.qrBound === "1") return;
    el.dataset.qrBound = "1";
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await callback(e);
      } catch (error) {
        console.error("QR button error:", error);
        S.showToast("Не удалось выполнить действие", "error");
      }
    });
  }

  // 1. Крестик (работает всегда, даже если камера висит)
  forceBind("btnCloseQrScanner", () => {
    stopCamera();
    modalScanner.classList.remove("active");
  });

  // 2. Фонарик
  forceBind("btnQrFlash", async () => {
    if (!currentTrack || !stream) {
      return S.showToast("Сначала дождитесь запуска камеры", "info");
    }
    try {
      if (typeof currentTrack.getCapabilities !== "function" ||
          typeof currentTrack.applyConstraints !== "function") {
        return S.showToast("Управление вспышкой не поддерживается браузером", "info");
      }
      const caps = currentTrack.getCapabilities();
      if (!caps || !caps.torch) {
        return S.showToast("На этой камере нет управляемой вспышки", "info");
      }
      const nextState = !flashOn;
      await currentTrack.applyConstraints({ advanced: [{ torch: nextState }] });
      flashOn = nextState;
      const button = document.getElementById("btnQrFlash");
      if (button) button.style.opacity = flashOn ? "1" : "0.75";
    } catch (e) {
      console.warn("Torch error:", e);
      S.showToast("Не удалось переключить фонарик", "error");
    }
  });

  // 3. Галерея
  forceBind("btnQrGallery", () => {
    const input = document.getElementById("qrGalleryInput");
    if (!input) return S.showToast("Выбор фото недоступен", "error");
    input.click();
  });

  // Обработка фото
  const galleryInput = document.getElementById("qrGalleryInput");
  if (galleryInput) {
    galleryInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      const reader = new FileReader();
      reader.onload = async (ev) => {
        img.onload = async () => {
          try {
            let foundText = null;
            if (!detector && "BarcodeDetector" in window) {
              try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (err) {}
            }
            if (detector) {
              try {
                const codes = await detector.detect(img);
                if (codes && codes.length) foundText = codes[0].rawValue;
              } catch (err) {
                console.warn("BarcodeDetector image scan:", err);
              }
            }
            if (!foundText) {
              await loadJsQr();
              if (window.jsQR) {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = window.jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) foundText = code.data;
              }
            }
            if (foundText) {
              handleScannedCode(foundText);
              stopCamera();
              modalScanner.classList.remove("active");
            } else {
              S.showAlert("QR-код не найден на выбранном изображении", "Ошибка");
            }
          } catch (err) {
            console.error("QR gallery scan error:", err);
            S.showAlert("Не удалось обработать изображение", "Ошибка");
          }
        };
        img.onerror = () => S.showAlert("Не удалось открыть это изображение", "Ошибка");
        img.src = ev.target.result;
      };
      reader.onerror = () => S.showAlert("Не удалось прочитать выбранный файл", "Ошибка");
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