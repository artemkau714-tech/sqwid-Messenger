/* ============================================================
   voice.js — Голосовые + Видео-кружки (со СЖАТИЕМ)
   ============================================================ */

console.log("🚀 voice.js загружен (Аудио + Видео + Сжатие)");

function waitForSqwidVoice(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ voice.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidVoice((S) => {
  const { db, ref, push, set, update, get, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 voice.js активирован");

  const MAX_AUDIO_DURATION = 120;
  const MAX_AUDIO_SIZE = 500 * 1024;
  const MAX_VIDEO_DURATION = 15;

  let isVideoMode = false;
  let isHolding = false;
  let holdTimer = null;
  let isCurrentlyRecording = false;

  let mediaRecorder = null;
  let audioStream = null;
  let audioChunks = [];
  let recordStartTime = 0;
  let recordTimerInterval = null;
  let recordingCancelled = false;

  /* ============================================================
     UI ОВЕРЛЕЯ
     ============================================================ */
  function ensureRecordOverlay() {
    let el = document.getElementById("recordOverlay");
    if (el) return el;
    
    el = document.createElement("div");
    el.id = "recordOverlay";
    el.className = "record-overlay";
    el.innerHTML = `
      <div id="overlayPreview" style="display:none; width:200px; height:200px; border-radius:50%; overflow:hidden; border:4px solid #ef4444; margin-bottom:20px;">
        <video id="videoPreview" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
      </div>
      <div id="overlayMicIcon" style="width:5rem;height:5rem;border-radius:50%;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
        </svg>
      </div>
      <div class="record-timer" id="recordTimer">0:00</div>
      <div class="record-hint">Запись...</div>
      <div class="record-actions">
        <button class="record-action-btn record-cancel" id="btnRecordCancel" aria-label="Отменить">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById("btnRecordCancel").onclick = cancelRecording;
    return el;
  }

  function showRecordOverlay() {
    const el = ensureRecordOverlay();
    el.classList.add("active");
    document.getElementById("recordTimer").textContent = "0:00";
    document.getElementById("overlayPreview").style.display = isVideoMode ? "block" : "none";
    document.getElementById("overlayMicIcon").style.display = isVideoMode ? "none" : "flex";
  }

  function hideRecordOverlay() {
    const el = document.getElementById("recordOverlay");
    if (el) el.classList.remove("active");
  }

  function fmtDur(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /* ============================================================
     ФУНКЦИЯ СЖАТИЯ ВИДЕО (Canvas)
     ============================================================ */
  async function compressVideo(blob) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(blob);
      video.muted = true;
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        // Уменьшаем разрешение до 240x240 (для кружка идеально)
        canvas.width = 240;
        canvas.height = 240;
        
        const stream = canvas.captureStream(24); // 24 fps
        
        // Переносим аудио из оригинального видео в новый поток
        const audioTracks = video.captureStream().getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
        }
        
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm",
          videoBitsPerSecond: 200000 // 200 kbps — очень легкое видео
        });
        
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
        
        recorder.start();
        video.play();
        
        function draw() {
          if (video.paused || video.ended) {
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(draw);
        }
        draw();
      };
      video.onerror = reject;
    });
  }

  /* ============================================================
     ЗАПИСЬ
     ============================================================ */
  async function startRecording() {
    if (mediaRecorder) return;

    if (window._currentUserData?.muted === true) {
      S.showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
      return;
    }

    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return;

    try {
      const constraints = {
        audio: true,
        video: isVideoMode ? { width: 480, height: 480, facingMode: "user" } : false
      };
      audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      S.showToast("Нет доступа к " + (isVideoMode ? "камере" : "микрофону"), "error");
      return;
    }

    if (isVideoMode) {
      const videoPreview = document.getElementById("videoPreview");
      if (videoPreview) videoPreview.srcObject = audioStream;
    }

    let mime = "";
    if (isVideoMode) {
      mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
    } else {
      mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    }

    mediaRecorder = new MediaRecorder(audioStream, { mimeType: mime });

    audioChunks = [];
    recordingCancelled = false;
    recordStartTime = Date.now();

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) audioChunks.push(ev.data);
    };

    mediaRecorder.onstop = async () => {
      const duration = Math.round((Date.now() - recordStartTime) / 1000);
      stopStream();

      if (recordingCancelled) {
        audioChunks = [];
        hideRecordOverlay();
        return;
      }

      const blob = new Blob(audioChunks, { type: mime });
      audioChunks = [];

      if (isVideoMode) {
        S.showToast("Сжимаем видео...", "info");
        try {
          const compressedBlob = await compressVideo(blob);
          await sendVideoMessage(compressedBlob, duration);
        } catch (err) {
          S.showToast("Ошибка сжатия видео", "error");
        }
      } else {
        if (blob.size > MAX_AUDIO_SIZE) {
          S.showToast("Голосовое слишком большое", "error");
        } else if (duration < 1) {
          S.showToast("Слишком коротко", "warn");
        } else {
          await sendVoiceMessage(blob, duration);
        }
      }
      hideRecordOverlay();
    };

    mediaRecorder.start();
    showRecordOverlay();

    recordTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordStartTime) / 1000);
      const timerEl = document.getElementById("recordTimer");
      if (timerEl) timerEl.textContent = fmtDur(sec);

      if (sec >= (isVideoMode ? MAX_VIDEO_DURATION : MAX_AUDIO_DURATION)) {
        stopRecordingAndSend();
      }
    }, 250);
  }

  function stopStream() {
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
  }

  function stopTimer() {
    if (recordTimerInterval) {
      clearInterval(recordTimerInterval);
      recordTimerInterval = null;
    }
  }

  function cancelRecording() {
    if (!mediaRecorder) return;
    recordingCancelled = true;
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
    stopTimer();
    stopStream();
    hideRecordOverlay();
  }

  function stopRecordingAndSend() {
    if (!mediaRecorder) return;
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
    stopTimer();
  }

  /* ============================================================
     ОТПРАВКА
     ============================================================ */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function sendVoiceMessage(blob, duration) {
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return;

    const dataUrl = await blobToDataURL(blob);
    const newRef = push(ref(db, "messages/" + chatId));
    await set(newRef, {
      sender: currentUser.uid,
      type: "voice",
      voice: dataUrl,
      duration: duration,
      text: "",
      timestamp: Date.now()
    });

    await update(ref(db, "chats/" + chatId), {
      lastMsg: "🎤 Голосовое (" + fmtDur(duration) + ")",
      lastMsgAt: Date.now(),
      lastMsgSender: currentUser.uid
    });
    S.showToast("Голосовое отправлено", "ok");
  }

  async function sendVideoMessage(blob, duration) {
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return;

    const dataUrl = await blobToDataURL(blob);

    // Проверка после сжатия
    if (dataUrl.length > 650 * 1024) {
      S.showToast("Видео всё еще больше 500 КБ", "error");
      return;
    }

    const newRef = push(ref(db, "messages/" + chatId));
    await set(newRef, {
      sender: currentUser.uid,
      type: "video_circle", 
      video: dataUrl,
      duration: duration,
      timestamp: Date.now()
    });

    await update(ref(db, "chats/" + chatId), {
      lastMsg: "🎥 Видео-кружок",
      lastMsgAt: Date.now(),
      lastMsgSender: currentUser.uid
    });
    S.showToast("Кружок отправлен!", "ok");
  }

  /* ============================================================
     УМНАЯ КНОПКА
     ============================================================ */
  function updateRecordIcon() {
    const btn = document.getElementById("btnRecord");
    if (!btn) return;
    if (isCurrentlyRecording) return;

    if (isVideoMode) {
      btn.innerHTML = `<svg width="22" height="22"><use href="#ico-video"/></svg>`;
    } else {
      btn.innerHTML = `<svg width="22" height="22"><use href="#ico-mic"/></svg>`;
    }
  }

  function bindRecordBtn() {
    const btn = document.getElementById("btnRecord");
    if (!btn || btn.dataset.toggleBound) return;
    btn.dataset.toggleBound = "1";

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", (e) => {
      if (isHolding || isCurrentlyRecording) return;
      isVideoMode = !isVideoMode;
      updateRecordIcon();
      S.showToast(isVideoMode ? "Режим: Кружок" : "Режим: Голосовое", "info", 1000);
    });

    const startPress = (e) => {
      if (e.type === "mousedown" && e.button !== 0) return;
      isHolding = true;
      holdTimer = setTimeout(() => {
        if (!isHolding) return;
        isCurrentlyRecording = true;
        startRecording();
      }, 200);
    };

    const endPress = () => {
      clearTimeout(holdTimer);
      if (!isHolding) return;
      isHolding = false;

      if (isCurrentlyRecording) {
        isCurrentlyRecording = false;
        setTimeout(() => {
          stopRecordingAndSend();
        }, 300);
      }
    };

    newBtn.addEventListener("mousedown", startPress);
    newBtn.addEventListener("touchstart", startPress, { passive: true });
    newBtn.addEventListener("mouseup", endPress);
    newBtn.addEventListener("mouseleave", () => { if (isHolding) endPress(); });
    newBtn.addEventListener("touchend", endPress);
    newBtn.addEventListener("touchcancel", () => { isHolding = false; });
  }

  setInterval(() => {
    bindRecordBtn();
    updateRecordIcon();
  }, 800);

  /* ============================================================
     РЕНДЕР ГОЛОСОВОГО
     ============================================================ */
  function renderVoiceContent(msg) {
    const dur = msg.duration || 0;
    const seed = (msg.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const bars = [];
    for (let i = 0; i < 28; i++) {
      const h = 20 + ((seed * (i + 3) * 17) % 80);
      bars.push(`<div class="voice-bar" data-bar="${i}" style="height:${h}%"></div>`);
    }
    return `
      <div class="msg-voice" data-voice-id="${msg.id || ""}">
        <button class="voice-play-btn" data-play="${msg.id || ""}" aria-label="Играть">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>
        </button>
        <div class="voice-wave">${bars.join("")}</div>
        <div class="voice-time">${fmtDur(dur)}</div>
      </div>
    `;
  }
  window.Sqwid.renderVoiceContent = renderVoiceContent;

  console.log("✅ voice.js (со сжатием) готов");
});