/* ============================================================
   qr-scanner.js — работает и на экране входа, и внутри чата
   ============================================================ */
console.log("🚀 qr-scanner.js загружен");

(function initQrScanner() {
  // -------- локальные хелперы (не зависят от Sqwid) --------
  function showAlert(msg, title) {
    if (window.Sqwid && typeof window.Sqwid.showAlert === "function") {
      window.Sqwid.showAlert(msg, title);
    } else {
      alert((title ? title + "\n\n" : "") + msg);
    }
  }
  function showToast(msg, type) {
    if (window.Sqwid && typeof window.Sqwid.showToast === "function") {
      window.Sqwid.showToast(msg, type);
    } else {
      console.log("[toast:" + (type || "info") + "]", msg);
    }
  }

  function bindIfExists() {
    const video = document.getElementById("qrScannerVideo");
    const modalScanner = document.getElementById("modal-qr-scanner");
    const modalResult = document.getElementById("modal-qr-result");
    const resultLink = document.getElementById("qrResultLink");

    if (!video || !modalScanner) {
      console.warn("qr-scanner.js: нет #qrScannerVideo или #modal-qr-scanner в DOM");
      return;
    }

    let stream = null;
    let animationFrame = null;
    let detector = null;
    let flashOn = false;
    let currentTrack = null;
    let lastScannedText = null;

    // -------- камера --------
    async function startCamera() {
      if (location.protocol !== "https:" && location.hostname !== "localhost") {
        showAlert("Камера работает только по HTTPS.", "Нужен HTTPS");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().catch(() => {});
          currentTrack = stream.getVideoTracks()[0];

          if ("BarcodeDetector" in window) {
            try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) {}
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
        if (err.name === "NotAllowedError") msg += "Вы запретили доступ к камере.";
        else if (err.name === "NotFoundError") msg += "Камера не найдена.";
        else msg += "Ошибка: " + err.message;
        showAlert(msg, "Ошибка доступа");
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
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }

    // -------- сканирование --------
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

      // Если есть колбэк (вход по QR) — вызываем его
      if (window._qrCallback) {
        const cb = window._qrCallback;
        window._qrCallback = null;
        cb(text);
        setTimeout(() => { lastScannedText = null; }, 1500);
        return;
      }

      // Иначе показываем результат
      if (resultLink && modalResult) {
        resultLink.textContent = text;
        modalResult.classList.add("active");
      }
      setTimeout(() => { lastScannedText = null; }, 2000);
    }

    // -------- публичное API --------
    window.Sqwid = window.Sqwid || {};
    window.Sqwid.openQrScanner = function (callback) {
      window._qrCallback = callback || null;
      lastScannedText = null;
      modalScanner.classList.add("active");
      startCamera();
    };

    // -------- кнопки --------
    function forceBind(id, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      const fn = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        handler();
      };
      newEl.addEventListener("click", fn, true);
      newEl.addEventListener("touchend", fn, { passive: false, capture: true });
    }

    forceBind("btnCloseQrScanner", () => {
      stopCamera();
      modalScanner.classList.remove("active");
      window._qrCallback = null;
    });

    forceBind("btnQrFlash", async () => {
      if (!currentTrack) return showToast("Камера не запущена", "warn");
      try {
        const caps = currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};
        if (caps.torch) {
          flashOn = !flashOn;
          await currentTrack.applyConstraints({ advanced: [{ torch: flashOn }] });
          const btn = document.getElementById("btnQrFlash");
          if (btn) btn.style.opacity = flashOn ? "1" : "0.6";
        } else {
          showToast("Вспышка не поддерживается", "info");
        }
      } catch (e) {
        showToast("Ошибка вспышки", "error");
      }
    });

    forceBind("btnQrGallery", () => {
      const input = document.getElementById("qrGalleryInput");
      if (input) input.click();
    });

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
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            let foundText = null;
            if (detector) {
              try {
                const b = await detector.detect(img);
                if (b.length > 0) foundText = b[0].rawValue;
              } catch (err) {}
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
              showAlert("QR-код не найден", "Ошибка");
            }
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        galleryInput.value = "";
      });
    }

    forceBind("btnQrResultOpen", () => {
      if (!resultLink) return;
      let url = resultLink.textContent;
      if (url && !url.startsWith("http")) url = "https://" + url;
      window.open(url, "_blank");
    });

    forceBind("btnQrResultBack", () => {
      if (modalResult) modalResult.classList.remove("active");
    });

    console.log("✅ qr-scanner.js готов");
  }

  // DOM может быть ещё не готов, если скрипт подключён в <head>
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindIfExists);
  } else {
    bindIfExists();
  }
})();