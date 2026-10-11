/* ============================================================
   calls.js — WebRTC звонки 1-на-1 через Firebase Realtime DB
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
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };

  let peerConnection = null;
  let localStream = null;
  let remoteStream = null;
  let currentCallId = null;
  let currentCallType = null; // "audio" | "video"
  let callPartnerUid = null;
  let callPartnerName = "Пользователь";
  let isCaller = false;
  let incomingCallData = null;
  let unsubCallListener = null;
  let unsubAnswerListener = null;
  let unsubIceListener = null;

  /* ============================================================
     ПРОВЕРКА ДОСТУПНОСТИ WEBRTC
     ============================================================ */
  function isWebRTCSupported() {
    return !!(navigator.mediaDevices && window.RTCPeerConnection);
  }

  /* ============================================================
     ПОКАЗАТЬ/СКРЫТЬ КНОПКИ ЗВОНКА В ШАПКЕ
     ============================================================ */
  function updateCallButtons() {
    const btnAudio = document.getElementById("btnCallAudio");
    const btnVideo = document.getElementById("btnCallVideo");
    const chat = S.getChatData && S.getChatData();

    // Показываем только в личных чатах и если WebRTC поддерживается
    const isPrivate = chat && chat.type === "private";
    const supported = isWebRTCSupported();

    if (btnAudio) btnAudio.style.display = (isPrivate && supported) ? "flex" : "none";
    if (btnVideo) btnVideo.style.display = (isPrivate && supported) ? "flex" : "none";
  }

  // Обновляем кнопки при открытии чата
  const origOnChatOpen = window.Sqwid.onChatOpen;
  window.Sqwid.onChatOpen = function (chatId) {
    if (origOnChatOpen) origOnChatOpen(chatId);
    setTimeout(updateCallButtons, 100);
  };

  /* ============================================================
     ПОЛУЧЕНИЕ ИМЕНИ СОБЕСЕДНИКА
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
     ПОЛУЧЕНИЕ МЕДИА
     ============================================================ */
  async function getMedia(type) {
    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.error("Ошибка доступа к медиа:", err);
      if (err.name === "NotAllowedError") {
        S.showAlert("Разрешите доступ к " + (type === "video" ? "камере и микрофону" : "микрофону"), "Доступ запрещён");
      } else if (err.name === "NotFoundError") {
        S.showAlert("Устройство не найдено", "Ошибка");
      } else {
        S.showAlert("Не удалось получить доступ: " + err.message, "Ошибка");
      }
      return null;
    }
  }

  /* ============================================================
     ЭКРАН ЗВОНКА
     ============================================================ */
  function showCallScreen() {
    S.showScreen("screen-call");
  }

  function setCallStatus(text) {
    const el = document.getElementById("callStatus");
    if (el) el.textContent = text;
  }

  function setPeerName(name) {
    const el = document.getElementById("callPeerName");
    if (el) el.textContent = name;
  }

  function setupLocalVideo() {
    const localVideo = document.getElementById("localVideo");
    if (localVideo && localStream) {
      localVideo.srcObject = localStream;
    }
  }

  function setupRemoteVideo() {
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo && remoteStream) {
      remoteVideo.srcObject = remoteStream;
    }
  }

  function showAvatarFallback(photo, name) {
    const ava = document.getElementById("callAvatar");
    if (!ava) return;
    if (photo && photo.startsWith("data:image")) {
      ava.innerHTML = `<img src="${photo}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;box-shadow:0 0 60px rgba(255,255,255,0.4);">`;
    } else {
      const letter = (name || "?").trim().charAt(0).toUpperCase();
      ava.innerHTML = `<div style="width:120px;height:120px;border-radius:50%;background:var(--grad-1);display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:800;color:#fff;box-shadow:0 0 60px rgba(255,255,255,0.4);">${letter}</div>`;
    }
    ava.style.display = "flex";
  }

  function hideAvatarFallback() {
    const ava = document.getElementById("callAvatar");
    if (ava) ava.style.display = "none";
  }

  /* ============================================================
     ОЧИСТКА РЕСУРСОВ
     ============================================================ */
  function cleanupCall() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    remoteStream = null;
    if (unsubAnswerListener) { unsubAnswerListener(); unsubAnswerListener = null; }
    if (unsubIceListener) { unsubIceListener(); unsubIceListener = null; }
    if (unsubCallListener) { unsubCallListener(); unsubCallListener = null; }

    currentCallId = null;
    currentCallType = null;
    callPartnerUid = null;
    isCaller = false;
    incomingCallData = null;

    // Возвращаемся в чат
    if (S.getChatId && S.getChatId()) {
      S.showScreen("screen-messages");
    } else {
      S.showScreen("screen-chats");
    }
  }

  /* ============================================================
     СОЗДАНИЕ PEER CONNECTION
     ============================================================ */
  function createPeerConnection(callId) {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    remoteStream = new MediaStream();

    // Добавляем наши треки
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Получаем треки собеседника
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      setupRemoteVideo();
      hideAvatarFallback();
      setCallStatus("В разговоре");
    };

    // Отправляем наши ICE-кандидаты
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(db, `calls/${callId}/callerCandidates`), event.candidate.toJSON());
      }
    };

    // Слушаем ICE собеседника
    if (unsubIceListener) unsubIceListener();
    unsubIceListener = onValue(ref(db, `calls/${callId}/calleeCandidates`), (snap) => {
      const candidates = snap.val() || {};
      Object.values(candidates).forEach(c => {
        peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
    });

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === "connected") setCallStatus("В разговоре");
      else if (state === "disconnected") setCallStatus("Связь потеряна");
      else if (state === "failed") {
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
    currentCallType = type;
    isCaller = true;

    setPeerName(partner.name);
    setCallStatus("Вызов...");
    showAvatarFallback(partner.photo, partner.name);
    showCallScreen();

    // Получаем медиа
    localStream = await getMedia(type);
    if (!localStream) {
      cleanupCall();
      return;
    }
    setupLocalVideo();

    // Создаём звонок в Firebase
    const callRef = push(ref(db, "calls"));
    currentCallId = callRef.key;

    await set(callRef, {
      from: currentUser.uid,
      fromName: (window._currentUserData && window._currentUserData.name) || "Пользователь",
      to: partner.uid,
      type: type,
      status: "ringing",
      createdAt: Date.now()
    });

    // Слушаем ответ
    if (unsubAnswerListener) unsubAnswerListener();
    unsubAnswerListener = onValue(ref(db, `calls/${currentCallId}/answer`), async (snap) => {
      const answer = snap.val();
      if (answer && peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus("Соединение...");
      }
    });

    // Создаём offer
    const pc = createPeerConnection(currentCallId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await update(ref(db, `calls/${currentCallId}`), {
      offer: { type: offer.type, sdp: offer.sdp }
    });
  }

  /* ============================================================
     ВХОДЯЩИЙ ЗВОНОК — СЛУШАТЕЛЬ
     ============================================================ */
  function startIncomingListener() {
    if (unsubCallListener) return;
    unsubCallListener = onValue(ref(db, "calls"), (snap) => {
      const calls = snap.val() || {};
      for (const callId in calls) {
        const call = calls[callId];
        if (call.to === currentUser.uid && call.status === "ringing" && !currentCallId) {
          // Показываем модалку входящего
          incomingCallData = { callId, ...call };
          showIncomingModal(call);
          return;
        }
      }
    });
  }

  function showIncomingModal(call) {
    const modal = document.getElementById("modal-incoming-call");
    if (!modal || modal.classList.contains("active")) return;

    const nameEl = document.getElementById("incomingCallName");
    const typeEl = document.getElementById("incomingCallType");
    if (nameEl) nameEl.textContent = call.fromName || "Пользователь";
    if (typeEl) typeEl.textContent = call.type === "video" ? "Видеозвонок" : "Аудиозвонок";

    modal.classList.add("active");
  }

  function hideIncomingModal() {
    const modal = document.getElementById("modal-incoming-call");
    if (modal) modal.classList.remove("active");
    incomingCallData = null;
  }

  /* ============================================================
     ПРИНЯТЬ ВХОДЯЩИЙ
     ============================================================ */
  async function acceptIncoming() {
    if (!incomingCallData) return;
    const call = incomingCallData;

    hideIncomingModal();

    currentCallId = call.callId;
    callPartnerUid = call.from;
    callPartnerName = call.fromName || "Пользователь";
    currentCallType = call.type;
    isCaller = false;

    setPeerName(callPartnerName);
    setCallStatus("Соединение...");
    showCallScreen();

    // Получаем медиа
    localStream = await getMedia(call.type);
    if (!localStream) {
      await update(ref(db, `calls/${currentCallId}`), { status: "declined" });
      cleanupCall();
      return;
    }
    setupLocalVideo();

    // Создаём peer connection
    const pc = createPeerConnection(currentCallId);

    // Получаем offer
    const callSnap = await get(ref(db, `calls/${currentCallId}`));
    const callData = callSnap.val();
    if (!callData || !callData.offer) {
      S.showToast("Ошибка: нет offer", "error");
      cleanupCall();
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

    // Создаём answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Отправляем answer
    await update(ref(db, `calls/${currentCallId}`), {
      status: "connected",
      answer: { type: answer.type, sdp: answer.sdp }
    });

    // Слушаем ICE caller-а
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
     ОТКЛОНИТЬ ВХОДЯЩИЙ
     ============================================================ */
  async function declineIncoming() {
    if (!incomingCallData) return;
    const callId = incomingCallData.callId;
    hideIncomingModal();

    await update(ref(db, `calls/${callId}`), { status: "declined" });
    S.showToast("Звонок отклонён", "info");

    // Уведомляем звонящего
    const callSnap = await get(ref(db, `calls/${callId}`));
    const call = callSnap.val();
    if (call && call.from) {
      const botRef = push(ref(db, "botChat/" + call.from));
      await set(botRef, {
        from: "Sqwid",
        text: `📞 ${call.toName || "Пользователь"} отклонил(а) звонок`,
        timestamp: Date.now(),
        type: "system"
      });
    }
  }

  /* ============================================================
     ЗАВЕРШИТЬ ЗВОНОК
     ============================================================ */
  async function endCall() {
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
     КНОПКИ УПРАВЛЕНИЯ ВО ВРЕМЯ ЗВОНКА
     ============================================================ */
  const btnMute = document.getElementById("btnCallMute");
  if (btnMute) {
    btnMute.addEventListener("click", () => {
      if (!localStream) return;
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        btnMute.style.background = audioTrack.enabled ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.5)";
        S.showToast(audioTrack.enabled ? "Микрофон включён" : "Микрофон выключен", "info");
      }
    });
  }

  const btnCam = document.getElementById("btnCallCam");
  if (btnCam) {
    btnCam.addEventListener("click", () => {
      if (!localStream) return;
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        btnCam.style.background = videoTrack.enabled ? "rgba(255,255,255,0.15)" : "rgba(239,68,68,0.5)";
        S.showToast(videoTrack.enabled ? "Камера включена" : "Камера выключена", "info");
      }
    });
  }

  const btnEnd = document.getElementById("btnCallEnd");
  if (btnEnd) {
    btnEnd.addEventListener("click", endCall);
  }

  /* ============================================================
     КНОПКИ В ШАПКЕ ЧАТА
     ============================================================ */
  const btnCallAudio = document.getElementById("btnCallAudio");
  if (btnCallAudio) {
    btnCallAudio.addEventListener("click", () => startCall("audio"));
  }

  const btnCallVideo = document.getElementById("btnCallVideo");
  if (btnCallVideo) {
    btnCallVideo.addEventListener("click", () => startCall("video"));
  }

  /* ============================================================
     МОДАЛКА ВХОДЯЩЕГО
     ============================================================ */
  const btnAccept = document.getElementById("btnIncomingAccept");
  if (btnAccept) btnAccept.addEventListener("click", acceptIncoming);

  const btnDecline = document.getElementById("btnIncomingDecline");
  if (btnDecline) btnDecline.addEventListener("click", declineIncoming);

  /* ============================================================
     СТАРТ СЛУШАТЕЛЯ
     ============================================================ */
  startIncomingListener();

  // Периодически обновляем кнопки (на случай смены чата)
  setInterval(updateCallButtons, 1000);

  console.log("✅ calls.js готов");
});