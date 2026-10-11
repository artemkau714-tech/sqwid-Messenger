/* ============================================================
   voice.js — голосовые сообщения (запись + плеер)
   ============================================================ */

console.log("🚀 voice.js загружен, жду Sqwid...");

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

  const MAX_DURATION = 120;      // 2 минуты
  const MAX_SIZE = 500 * 1024;   // 500 КБ

  let mediaRecorder = null;
  let audioChunks = [];
  let audioStream = null;
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
      <div style="width:5rem;height:5rem;border-radius:50%;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3"/>
          <path d="M5 10a7 7 0 0 0 14 0"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="8" y1="22" x2="16" y2="22"/>
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
        <button class="record-action-btn record-send" id="btnRecordSend" aria-label="Отправить">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById("btnRecordCancel").onclick = cancelRecording;
    document.getElementById("btnRecordSend").onclick = stopRecordingAndSend;
    return el;
  }

  function showRecordOverlay() {
    const el = ensureRecordOverlay();
    el.classList.add("active");
    document.getElementById("recordTimer").textContent = "0:00";
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

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      S.showToast("Запись не поддерживается браузером", "error");
      return;
    }

    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      S.showToast("Нет доступа к микрофону", "error");
      return;
    }

    let mime = "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mime = "audio/webm;codecs=opus";
    else if (MediaRecorder.isTypeSupported("audio/webm")) mime = "audio/webm";
    else if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";

    try {
      mediaRecorder = mime
        ? new MediaRecorder(audioStream, { mimeType: mime })
        : new MediaRecorder(audioStream);
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

      const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || "audio/webm" });
      audioChunks = [];

      if (blob.size > MAX_SIZE) {
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
      hideRecordOverlay();
    };

    mediaRecorder.start();

    const btn = document.getElementById("btnRecord");
    if (btn) btn.classList.add("recording");

    showRecordOverlay();

    recordTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - recordStartTime) / 1000);
      const timerEl = document.getElementById("recordTimer");
      if (timerEl) timerEl.textContent = fmtDur(sec);

      if (sec >= MAX_DURATION) {
        S.showToast("Максимум " + MAX_DURATION + " сек", "warn");
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
    const btn = document.getElementById("btnRecord");
    if (btn) btn.classList.remove("recording");
    hideRecordOverlay();
  }

  function stopRecordingAndSend() {
    if (!mediaRecorder) return;
    try { mediaRecorder.stop(); } catch (e) {}
    mediaRecorder = null;
    stopTimer();
    const btn = document.getElementById("btnRecord");
    if (btn) btn.classList.remove("recording");
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

    if (dataUrl.length > MAX_SIZE * 1.5) {
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

  /* ============================================================
     ПРИВЯЗКА КНОПКИ
     ============================================================ */
  function bindRecordBtn() {
    const btn = document.getElementById("btnRecord");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", startRecording);
  }
  bindRecordBtn();
  setInterval(() => {
    const btn = document.getElementById("btnRecord");
    if (btn && !btn.dataset.bound) bindRecordBtn();
  }, 800);

  /* ============================================================
     РЕНДЕР ГОЛОСОВОГО СООБЩЕНИЯ
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
     ПЛЕЕР (делегирование кликов)
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

      // Если играет этот же — пауза
      if (currentAudio && currentVoiceId === voiceId && !currentAudio.paused) {
        currentAudio.pause();
        setPlayIcon(btn, false);
        return;
      }
      // Если играет другой — стоп
      if (currentAudio) {
        currentAudio.pause();
        if (currentBtn) setPlayIcon(currentBtn, false);
        if (rafId) cancelAnimationFrame(rafId);
      }

      const msgWrap = btn.closest(".msg-voice");
      if (!msgWrap) return;

      const chatId = S.getChatId && S.getChatId();
      if (!chatId) return;

      // Найдём msg в DOM по data-voice-id
      const msgId = msgWrap.dataset.voiceId;
      if (!msgId) return;

      // Берём голосовое из Firebase
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

    // Клик по волне — перемотка
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

  console.log("✅ voice.js готов");
});