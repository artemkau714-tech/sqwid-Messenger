/* ============================================================
   voice.js — Голосовые + Видео-кружки + Умная кнопка
   ============================================================ */

console.log("🚀 voice.js загружен (Аудио + Видео)");

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
  const { db, ref, push, set, update, get, currentUser, userMap } = S;
  if (!currentUser) return;

  console.log("🔥 voice.js активирован");

  // Лимиты
  const MAX_AUDIO_DURATION = 120; // 2 минуты
  const MAX_AUDIO_SIZE = 500 * 1024; // 500 КБ
  const MAX_VIDEO_DURATION = 15; // 15 секунд (чтобы влезть в лимит Firebase)
  const MAX_VIDEO_SIZE = 500 * 1024; // 500 КБ после сжатия

  // Состояние
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
      <div class="record-hint">Запись... нажмите ✕ чтобы отменить</div>
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
     ЗАПИСЬ
     ============================================================ */
  async function startRecording() {
    if (mediaRecorder) return;

    if (window._currentUserData?.muted === true) {
      S.showToast("🔇 НА ВАС МУТ!!!", "error", 2000);
      return;
    }
    if (window._currentUserData?.banned === true) {
      S.showToast("🚫 Аккаунт заблокирован", "error", 2000);
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

    try {
      mediaRecorder = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream);
    } catch (e) {
      S.showToast("Ошибка инициализации записи", "error");
      stopStream();
      return;
    }

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

      const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || "video/webm" });
      audioChunks = [];

      if (isVideoMode) {
        if (blob.size > 5 * 1024 * 1024) {
          S.showToast("Видео слишком большое", "error");
          hideRecordOverlay();
          return;
        }
        S.showToast("Обрабатываем видео...", "info");
        await sendVideoMessage(blob, duration);
      } else {
        if (blob.size > MAX_AUDIO_SIZE) {
          S.showToast("Голосовое слишком большое (макс 500 КБ)", "error", 3000);
          hideRecordOverlay();
          return;
        }
        if (duration < 1) {
          S.showToast("Слишком коротко", "warn");
          hideRecordOverlay();
          return;
        }
        await sendVoiceMessage(blob, duration);
      }
      hideRecordOverlay();
    };

    mediaRecorder.start();
    showRecordOverlay();

    recordTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordStartTime) / 1000);
      const timerEl = document.getElementById("recordTimer");
      if (timerEl) timerEl.textContent = fmtDur(sec);

      const limit = isVideoMode ? MAX_VIDEO_DURATION : MAX_AUDIO_DURATION;
      if (sec >= limit) {
        S.showToast("Максимум " + limit + " сек", "warn");
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

    let dataUrl;
    try {
      dataUrl = await blobToDataURL(blob);
    } catch (e) {
      S.showToast("Ошибка кодирования аудио", "error");
      return;
    }

    if (dataUrl.length > MAX_AUDIO_SIZE * 1.5) {
      S.showToast("Голосовое слишком большое", "error");
      return;
    }

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

    let dataUrl;
    try {
      dataUrl = await blobToDataURL(blob);
    } catch (e) {
      S.showToast("Ошибка кодирования видео", "error");
      return;
    }

    if (dataUrl.length > 650 * 1024) {
      S.showToast("Видео всё еще слишком большое (лимит 500 КБ)", "error");
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
     УМНАЯ КНОПКА (Клик - смена режима, Зажатие - запись)
     ============================================================ */
  function updateRecordIcon() {
    const btn = document.getElementById("btnRecord");
    if (!btn) return;
    if (isCurrentlyRecording) return;

    if (isVideoMode) {
      btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
    } else {
      btn.innerHTML = `<svg width="22" height="22"><use href="#ico-mic"/></svg>`;
    }
  }

  function bindRecordBtn() {
    const btn = document.getElementById("btnRecord");
    if (!btn || btn.dataset.toggleBound) return;
    btn.dataset.toggleBound = "1";

    // Клонируем кнопку, чтобы сбросить старые обработчики
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

  // Следим за появлением кнопки
  setInterval(() => {
    bindRecordBtn();
    updateRecordIcon();
  }, 800);

  /* ============================================================
     РЕНДЕР ГОЛОСОВОГО СООБЩЕНИЯ (плеер)
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

  /* ============================================================
     ПЛЕЕР АУДИО
     ============================================================ */
  let currentAudio = null;
  let currentBtn = null;
  let currentVoiceId = null;
  let rafId = null;

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".voice-play-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const voiceId = btn.dataset.play;
      if (!voiceId) return;

      if (currentAudio && currentVoiceId === voiceId && !currentAudio.paused) {
        currentAudio.pause();
        setPlayIcon(btn, false);
        return;
      }
      if (currentAudio) {
        currentAudio.pause();
        if (currentBtn) setPlayIcon(currentBtn, false);
        if (rafId) cancelAnimationFrame(rafId);
      }

      const msgWrap = btn.closest(".msg-voice");
      if (!msgWrap) return;

      const chatId = S.getChatId && S.getChatId();
      if (!chatId) return;

      const msgId = msgWrap.dataset.voiceId;
      if (!msgId) return;

      let voiceData = null;
      try {
        const snap = await get(ref(db, `messages/${chatId}/${msgId}/voice`));
        voiceData = snap.val();
      } catch (e) {}

      if (!voiceData) {
        S.showToast("Голосовое не найдено", "error");
        return;
      }

      const audio = new Audio(voiceData);
      currentAudio = audio;
      currentBtn = btn;
      currentVoiceId = voiceId;

      audio.onended = () => {
        setPlayIcon(btn, false);
        resetWave(msgWrap);
        currentAudio = null;
        currentBtn = null;
        currentVoiceId = null;
        if (rafId) cancelAnimationFrame(rafId);
      };
      audio.onerror = () => {
        setPlayIcon(btn, false);
        S.showToast("Ошибка воспроизведения", "error");
      };

      try {
        await audio.play();
        setPlayIcon(btn, true);
        animateWave(msgWrap, audio);
      } catch (err) {
        S.showToast("Не удалось воспроизвести", "error");
      }
      return;
    }

    const wave = e.target.closest(".voice-wave");
    if (wave && currentAudio) {
      const rect = wave.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      if (currentAudio.duration) {
        currentAudio.currentTime = currentAudio.duration * ratio;
      }
    }
  });

  function setPlayIcon(btn, playing) {
    if (!btn) return;
    if (playing) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>`;
    }
  }

  function resetWave(msgWrap) {
    msgWrap.querySelectorAll(".voice-bar").forEach(b => b.classList.remove("played"));
  }

  function animateWave(msgWrap, audio) {
    const bars = msgWrap.querySelectorAll(".voice-bar");
    const total = bars.length;
    const tick = () => {
      if (!audio.duration) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = audio.currentTime / audio.duration;
      const activeCount = Math.floor(progress * total);
      bars.forEach((b, i) => {
        if (i < activeCount) b.classList.add("played");
        else b.classList.remove("played");
      });
      if (!audio.paused && !audio.ended) {
        rafId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  console.log("✅ voice.js (Аудио + Видео) готов");
});