/* ============================================================
   calls.js — WebRTC звонки 1-на-1 + звук вызова + мини-виджет
   ============================================================ */

console.log("🚀 calls.js загружен, жду Sqwid...");

function waitForSqwidCalls(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ calls.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidCalls((S) => {
  const { db, ref, get, set, push, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 calls.js активирован");

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  let peerConnection = null;
  let localStream = null;
  let remoteStream = null;
  let currentCallId = null;
  let currentCallType = null;
  let callPartnerUid = null;
  let callPartnerName = "Пользователь";
  let callPartnerPhoto = "";
  let isCaller = false;
  let incomingCallData = null;
  let unsubCallListener = null;
  let unsubAnswerListener = null;
  let unsubIceListener = null;
  let callTimerInterval = null;
  let callStartTime = 0;
  let isMinimized = false;
/* ============================================================
   ЭКСПОРТ СОСТОЯНИЯ ДЛЯ group-calls.js
   ============================================================ */
window.Sqwid.callState = {
  get peerConnection() { return peerConnection; },
  get localStream() { return localStream; },
  get remoteStream() { return remoteStream; },
  get currentCallId() { return currentCallId; },
  get currentCallType() { return currentCallType; },
  get callPartnerUid() { return callPartnerUid; },
  get callPartnerName() { return callPartnerName; },
  get callPartnerPhoto() { return callPartnerPhoto; },
  get isCaller() { return isCaller; },
  get isMinimized() { return isMinimized; },
  get callStartTime() { return callStartTime; },

  setCallId: (v) => { currentCallId = v; },
  setCallType: (v) => { currentCallType = v; },
  setPartnerUid: (v) => { callPartnerUid = v; },
  setPartnerName: (v) => { callPartnerName = v; },
  setPartnerPhoto: (v) => { callPartnerPhoto = v; },
  setMinimized: (v) => { isMinimized = v; },

  // Флаг: запрет закрывать localStream при cleanup (для передачи в group-calls)
  keepStream: false,
  // Флаг: экран звонка занят групповым режимом
  groupMode: false
};
  /* ============================================================
     ЗВУКИ (WebAudio API — генерация без файлов)
     ============================================================ */
  let audioCtx = null;
  let ringtoneNode = null;
  let ringtoneInterval = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Исходящий вызов — "тууу-тууу-тууу" (гудки)
  function startOutgoingRing() {
    stopAllSounds();
    ensureAudioCtx();
    if (!audioCtx) return;

    const playBeep = () => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 425;
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.7);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.75);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.8);
    };

    playBeep();
    ringtoneInterval = setInterval(playBeep, 1500);

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200, 100, 500]);
  }

  // Входящий — рингтон (более быстрый и громкий)
  function startIncomingRing() {
    stopAllSounds();
    ensureAudioCtx();
    if (!audioCtx) return;

    const playRing = () => {
      if (!audioCtx) return;
      [0, 0.15].forEach((delay, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = i === 0 ? 900 : 700;
        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + delay + 0.02);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay + 0.12);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + 0.2);
      });
    };

    playRing();
    ringtoneInterval = setInterval(playRing, 1200);

    if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500, 300, 500]);
  }

  function stopAllSounds() {
    if (ringtoneInterval) {
      clearInterval(ringtoneInterval);
      ringtoneInterval = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  }

  /* ============================================================
     ТАЙМЕР РАЗГОВОРА
     ============================================================ */
  function startCallTimer() {
    stopCallTimer();
    callStartTime = Date.now();
    const timerEl = document.getElementById("callTimer");
    if (timerEl) timerEl.textContent = "00:00";
    const avaStatus = document.getElementById("callAvatarStatus");
    if (avaStatus) avaStatus.textContent = "В разговоре";

    callTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - callStartTime) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      const timerEl = document.getElementById("callTimer");
      if (timerEl) timerEl.textContent = `${mm}:${ss}`;
      const miniStatus = document.querySelector(".call-mini-status");
      if (miniStatus) miniStatus.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  function stopCallTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }
  }

  /* ============================================================
     ПРОВЕРКА WEBRTC
     ============================================================ */
  function isWebRTCSupported() {
    return !!(navigator.mediaDevices && window.RTCPeerConnection);
  }

  function updateCallButtons() {
    const btnAudio = document.getElementById("btnCallAudio");
    const btnVideo = document.getElementById("btnCallVideo");
    const chat = S.getChatData && S.getChatData();
    const isPrivate = chat && chat.type === "private";
    const supported = isWebRTCSupported();
    if (btnAudio) btnAudio.style.display = (isPrivate && supported) ? "flex" : "none";
    if (btnVideo) btnVideo.style.display = (isPrivate && supported) ? "flex" : "none";
  }

  const origOnChatOpen = window.Sqwid.onChatOpen;
  window.Sqwid.onChatOpen = function (chatId) {
    if (origOnChatOpen) origOnChatOpen(chatId);
    setTimeout(updateCallButtons, 100);
  };

  /* ============================================================
     ПОЛУЧЕНИЕ СОБЕСЕДНИКА
     ============================================================ */
  async function getPartnerInfo(chatId) {
    const chatSnap = await get(ref(db, "chats/" + chatId));
    const chat = chatSnap.val() || {};
    const partnerUid = Object.keys(chat.members || {}).find(u => u !== currentUser.uid);
    if (!partnerUid) return null;
    const userSnap = await get(ref(db, "users/" + partnerUid));
    const user = userSnap.val() || {};
    return {
      uid: partnerUid,
      name: user.name || user.email || "Пользователь",
      photo: user.photo || ""
    };
  }

  /* ============================================================
     МЕДИА
     ============================================================ */
  async function getMedia(type) {
    try {
      const constraints = {
        audio: true,
        video: type === "video"
          ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
          : false
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error("Ошибка доступа к медиа:", err);
      if (err.name === "NotAllowedError") {
        S.showAlert("Разрешите доступ к " + (type === "video" ? "камере и микрофону" : "микрофону"), "Доступ запрещён");
      } else if (err.name === "NotFoundError") {
        S.showAlert("Устройство не найдено", "Ошибка");
      } else {
        S.showAlert("Ошибка: " + err.message, "Ошибка");
      }
      return null;
    }
  }

  /* ============================================================
     UI ЭКРАНА ЗВОНКА
     ============================================================ */
  function showCallScreen() {
  isMinimized = false;
  hideMiniWidget();
  S.showScreen("screen-call");

  // Показываем миникамеру и кнопку камеры ТОЛЬКО при видеозвонке
  const localVideo = document.getElementById("localVideo");
  const btnCam = document.getElementById("btnCallCam");
  const isVideo = currentCallType === "video";

  if (localVideo) localVideo.style.display = isVideo ? "block" : "none";
  if (btnCam) btnCam.style.display = isVideo ? "flex" : "none";
}

  function setCallStatus(text) {
    const el = document.getElementById("callStatus");
    if (el) el.textContent = text;
  }

  function setPeerName(name) {
    const el = document.getElementById("callPeerName");
    if (el) el.textContent = name;
    const avaName = document.getElementById("callAvatarName");
    if (avaName) avaName.textContent = name;
  }

  function setAvatar(photo, name) {
    const avaCircle = document.getElementById("callAvatarCircle");
    const avaLetter = document.getElementById("callAvatarLetter");
    if (!avaCircle) return;
    if (photo && photo.startsWith("data:image")) {
      avaCircle.innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      avaCircle.innerHTML = `<span style="font-size:3.5rem;font-weight:900;color:#fff;">${(name || "?").trim().charAt(0).toUpperCase()}</span>`;
    }
  }

  function setupLocalVideo() {
    const localVideo = document.getElementById("localVideo");
    if (localVideo && localStream) localVideo.srcObject = localStream;
  }

  function setupRemoteVideo() {
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo && remoteStream) remoteVideo.srcObject = remoteStream;
  }

  function hideAvatarOverlay() {
    const ava = document.getElementById("callAvatar");
    if (ava) ava.style.display = "none";
  }

  function showAvatarOverlay(statusText) {
    const ava = document.getElementById("callAvatar");
    if (ava) ava.style.display = "flex";
    const dots = document.getElementById("callRingingDots");
    if (dots) dots.style.display = "flex";
    if (statusText) {
      const avaStatus = document.getElementById("callAvatarStatus");
      if (avaStatus) avaStatus.textContent = statusText;
    }
  }

  /* ============================================================
     МИНИ-ВИДЖЕТ (когда свернули)
     ============================================================ */
  function ensureMiniWidget() {
    let w = document.getElementById("callMiniWidget");
    if (w) return w;
    w = document.createElement("div");
    w.id = "callMiniWidget";
    w.innerHTML = `
      <div class="call-mini-ava" id="miniAva">?</div>
      <div class="call-mini-info">
        <div class="call-mini-name" id="miniName">—</div>
        <div class="call-mini-status" id="miniStatus">Вызов...</div>
      </div>
      <button class="call-mini-end" id="miniEnd">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    document.body.appendChild(w);

    w.addEventListener("click", (e) => {
      if (e.target.closest("#miniEnd")) return;
      isMinimized = false;
      hideMiniWidget();
      S.showScreen("screen-call");
    });

    document.getElementById("miniEnd").addEventListener("click", (e) => {
      e.stopPropagation();
      endCall();
    });

    return w;
  }

  function showMiniWidget() {
    const w = ensureMiniWidget();
    const ava = document.getElementById("miniAva");
    if (ava) {
      if (callPartnerPhoto && callPartnerPhoto.startsWith("data:image")) {
        ava.innerHTML = `<img src="${callPartnerPhoto}">`;
      } else {
        ava.textContent = (callPartnerName || "?").charAt(0).toUpperCase();
      }
    }
    const name = document.getElementById("miniName");
    if (name) name.textContent = callPartnerName;
    w.classList.add("active");
  }

  function hideMiniWidget() {
    const w = document.getElementById("callMiniWidget");
    if (w) w.classList.remove("active");
  }

  /* ============================================================
     ОЧИСТКА
     ============================================================ */
  function cleanupCall() {
    stopAllSounds();
    stopCallTimer();
    hideMiniWidget();

    if (localStream && !window.Sqwid.callState.keepStream) {
  localStream.getTracks().forEach(t => t.stop());
  localStream = null;
} else if (localStream && window.Sqwid.callState.keepStream) {
  // Передали стрим в групповой режим — не трогаем
}
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    remoteStream = null;
    if (unsubAnswerListener) { unsubAnswerListener(); unsubAnswerListener = null; }
    if (unsubIceListener) { unsubIceListener(); unsubIceListener = null; }

    if (!window.Sqwid.callState.groupMode) {
  currentCallId = null;
  currentCallType = null;
  callPartnerUid = null;
  callPartnerPhoto = "";
  isCaller = false;
  incomingCallData = null;
  isMinimized = false;
}

    if (!window.Sqwid.callState.groupMode) {
  if (S.getChatId && S.getChatId()) {
    S.showScreen("screen-messages");
  } else {
    S.showScreen("screen-chats");
  }
}
  }
  /* ============================================================
     PEER CONNECTION
     ============================================================ */
  function createPeerConnection(callId) {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      setupRemoteVideo();
      hideAvatarOverlay();
      setCallStatus("В разговоре");
      startCallTimer();
      stopAllSounds();
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(db, `calls/${callId}/callerCandidates`), event.candidate.toJSON());
      }
    };

    if (unsubIceListener) unsubIceListener();
    unsubIceListener = onValue(ref(db, `calls/${callId}/calleeCandidates`), (snap) => {
      const candidates = snap.val() || {};
      Object.values(candidates).forEach(c => {
        peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
    });

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") {
        setCallStatus("В разговоре");
        startCallTimer();
        stopAllSounds();
      } else if (state === "disconnected") {
        setCallStatus("Связь потеряна");
      } else if (state === "failed") {
        setCallStatus("Ошибка соединения");
        setTimeout(cleanupCall, 2000);
      }
    };

    return peerConnection;
  }

  /* ============================================================
     ИСХОДЯЩИЙ ЗВОНОК
     ============================================================ */
  async function startCall(type) {
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) return;

    if (!isWebRTCSupported()) {
      S.showAlert("Ваш браузер не поддерживает звонки", "Ошибка");
      return;
    }

    const partner = await getPartnerInfo(chatId);
    if (!partner) {
      S.showAlert("Не удалось найти собеседника", "Ошибка");
      return;
    }

    callPartnerUid = partner.uid;
    callPartnerName = partner.name;
    callPartnerPhoto = partner.photo;
    currentCallType = type;
    isCaller = true;

    setPeerName(partner.name);
    setCallStatus("Исходящий вызов...");
    setAvatar(partner.photo, partner.name);
    showAvatarOverlay("Вызов...");
    showCallScreen();

    // Звук гудков
    startOutgoingRing();

    localStream = await getMedia(type);
    if (!localStream) {
      stopAllSounds();
      cleanupCall();
      return;
    }
    setupLocalVideo();

    const callRef = push(ref(db, "calls"));
    currentCallId = callRef.key;

    await set(callRef, {
      from: currentUser.uid,
      fromName: (window._currentUserData && window._currentUserData.name) || "Пользователь",
      fromPhoto: (window._currentUserData && window._currentUserData.photo) || "",
      to: partner.uid,
      type: type,
      status: "ringing",
      createdAt: Date.now()
    });

    if (unsubAnswerListener) unsubAnswerListener();
    unsubAnswerListener = onValue(ref(db, `calls/${currentCallId}/answer`), async (snap) => {
      const answer = snap.val();
      if (answer && peerConnection && peerConnection.signalingState !== "stable") {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus("Соединение...");
          stopAllSounds();
        } catch (e) {}
      }
    });

    // Слушаем отказ
    const statusUnsub = onValue(ref(db, `calls/${currentCallId}/status`), (snap) => {
      const status = snap.val();
      if (status === "declined") {
        S.showToast("Звонок отклонён", "info");
        statusUnsub();
        cleanupCall();
      } else if (status === "ended") {
        S.showToast("Звонок завершён", "info");
        statusUnsub();
        cleanupCall();
      }
    });

    const pc = createPeerConnection(currentCallId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await update(ref(db, `calls/${currentCallId}`), {
      offer: { type: offer.type, sdp: offer.sdp }
    });
  }

  /* ============================================================
     ВХОДЯЩИЙ ЗВОНОК
     ============================================================ */
  function startIncomingListener() {
    if (unsubCallListener) return;
    unsubCallListener = onValue(ref(db, "calls"), (snap) => {
      const calls = snap.val() || {};
      for (const callId in calls) {
        const call = calls[callId];
        if (call.to === currentUser.uid && call.status === "ringing" && !currentCallId) {
          incomingCallData = { callId, ...call };
          showIncomingModal(call);
          startIncomingRing();
          return;
        }
      }
    });
  }

  function showIncomingModal(call) {
  const banner = document.getElementById("incomingCallBanner");
  if (!banner) return;
  if (banner.classList.contains("active")) return;

  const nameEl = document.getElementById("incomingCallName");
  const typeEl = document.getElementById("incomingCallType");
  if (nameEl) nameEl.textContent = call.fromName || "Пользователь";
  if (typeEl) typeEl.textContent = call.type === "video" ? "Видеозвонок" : "Аудиозвонок";

  banner.classList.add("active", "pulsing");
  document.body.classList.add("has-incoming-call");
}

  function hideIncomingModal() {
  const banner = document.getElementById("incomingCallBanner");
  if (banner) {
    banner.classList.remove("active", "pulsing");
  }
  document.body.classList.remove("has-incoming-call");
  incomingCallData = null;
}

  /* ============================================================
     ПРИНЯТЬ
     ============================================================ */
  async function acceptIncoming() {
    if (!incomingCallData) return;
    const call = incomingCallData;

    stopAllSounds();
    hideIncomingModal();

    currentCallId = call.callId;
    callPartnerUid = call.from;
    callPartnerName = call.fromName || "Пользователь";
    callPartnerPhoto = call.fromPhoto || "";
    currentCallType = call.type;
    isCaller = false;

    setPeerName(callPartnerName);
    setCallStatus("Соединение...");
    setAvatar(callPartnerPhoto, callPartnerName);
    showAvatarOverlay("Соединение...");
    showCallScreen();

    localStream = await getMedia(call.type);
    if (!localStream) {
      await update(ref(db, `calls/${currentCallId}`), { status: "declined" });
      cleanupCall();
      return;
    }
    setupLocalVideo();

    const pc = createPeerConnection(currentCallId);

    const callSnap = await get(ref(db, `calls/${currentCallId}`));
    const callData = callSnap.val();
    if (!callData || !callData.offer) {
      S.showToast("Ошибка: нет offer", "error");
      cleanupCall();
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await update(ref(db, `calls/${currentCallId}`), {
      status: "connected",
      answer: { type: answer.type, sdp: answer.sdp }
    });

    if (unsubIceListener) unsubIceListener();
    unsubIceListener = onValue(ref(db, `calls/${currentCallId}/callerCandidates`), (snap) => {
      const candidates = snap.val() || {};
      Object.values(candidates).forEach(c => {
        peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
    });

    setCallStatus("В разговоре");
  }

  /* ============================================================
     ОТКЛОНИТЬ
     ============================================================ */
  async function declineIncoming() {
    if (!incomingCallData) return;
    const callId = incomingCallData.callId;
    stopAllSounds();
    hideIncomingModal();

    await update(ref(db, `calls/${callId}`), { status: "declined" });
    S.showToast("Звонок отклонён", "info");
  }

  /* ============================================================
     ЗАВЕРШИТЬ
     ============================================================ */
  async function endCall() {
  if (window.Sqwid.callState.groupMode) {
    // Групповой режим сам разберётся
    if (window.Sqwid.endGroupCall) {
      window.Sqwid.endGroupCall();
      return;
    }
  }
  if (currentCallId) {
    try {
      await update(ref(db, `calls/${currentCallId}`), {
        status: "ended",
        endedAt: Date.now()
      });
    } catch (e) {}
  }
  cleanupCall();
}

  /* ============================================================
     КНОПКИ
     ============================================================ */
  const btnMute = document.getElementById("btnCallMute");
  if (btnMute) {
    btnMute.addEventListener("click", () => {
      if (!localStream) return;
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        btnMute.classList.toggle("muted", !track.enabled);
        S.showToast(track.enabled ? "Микрофон включён" : "Микрофон выключен", "info");
      }
    });
  }

  const btnCam = document.getElementById("btnCallCam");
  if (btnCam) {
    btnCam.addEventListener("click", () => {
      if (!localStream) return;
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        btnCam.classList.toggle("off", !track.enabled);
        S.showToast(track.enabled ? "Камера включена" : "Камера выключена", "info");
      }
    });
  }

  const btnEnd = document.getElementById("btnCallEnd");
  if (btnEnd) btnEnd.addEventListener("click", endCall);

  const btnMinimize = document.getElementById("btnCallMinimize");
  if (btnMinimize) {
    btnMinimize.addEventListener("click", () => {
      isMinimized = true;
      showMiniWidget();
      // Возвращаемся в чат
      if (S.getChatId && S.getChatId()) S.showScreen("screen-messages");
      else S.showScreen("screen-chats");
    });
  }

  const btnCallAudio = document.getElementById("btnCallAudio");
  if (btnCallAudio) btnCallAudio.addEventListener("click", () => startCall("audio"));

  const btnCallVideo = document.getElementById("btnCallVideo");
  if (btnCallVideo) btnCallVideo.addEventListener("click", () => startCall("video"));

  const btnAccept = document.getElementById("btnIncomingAccept");
  if (btnAccept) btnAccept.addEventListener("click", acceptIncoming);

  const btnDecline = document.getElementById("btnIncomingDecline");
  if (btnDecline) btnDecline.addEventListener("click", declineIncoming);

  startIncomingListener();
  setInterval(updateCallButtons, 1000);

  console.log("✅ calls.js готов");
});