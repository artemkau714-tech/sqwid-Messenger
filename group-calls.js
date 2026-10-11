/* ============================================================
   group-calls.js — приглашение 3-го/4-го в активный 1-на-1 звонок
   Mesh-архитектура до 4 участников, signaling через Firebase RTDB
   ============================================================ */

console.log("🚀 group-calls.js загружен, жду Sqwid...");

function waitForSqwidGroupCalls(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser && window.Sqwid.callState) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ group-calls.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidGroupCalls((S) => {
  const { db, ref, get, set, push, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 group-calls.js активирован");

  /* ============================================================
     КОНСТАНТЫ
     ============================================================ */
  const MAX_PARTICIPANTS = 4;
  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  /* ============================================================
     СОСТОЯНИЕ ГРУППОВОГО ЗВОНКА
     ============================================================ */
  let groupCallId = null;              // ID звонка (совпадает с calls/{id} 1-на-1)
  let groupPeers = {};                 // uid -> { pc, stream, videoEl, name, photo, connected }
  let groupParticipants = {};          // uid -> { name, photo, muted, camOff, joinedAt }
  let groupLocalStream = null;         // переиспользуем localStream из calls.js
  let unsubParticipants = null;
  let unsubPeers = null;
  let unsubInvites = null;
  let unsubMyPeerEvents = {};          // по ключу peerKey -> unsubscribe
  let groupModeActive = false;
  let groupStartedAt = 0;
  let groupTimerInterval = null;
  let unsubIncomingInvites = null;     // Глобально: список приглашений, адресованных мне

  /* ============================================================
     УТИЛИТЫ
     ============================================================ */
  function peerKey(uidA, uidB) {
    return [uidA, uidB].sort().join("__");
  }

  function isInitiator(uidA, uidB) {
    // Тот, чей uid лексикографически меньше — инициатор
    return uidA < uidB;
  }

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  /* ============================================================
     СТАРТ ГРУППОВОГО РЕЖИМА — приглашение третьего
     ============================================================ */

  // Вызывается по кнопке "Пригласить" на экране звонка
  function openInvitePicker() {
    if (!window.Sqwid.callState) return;
    const chatId = S.getChatId && S.getChatId();
    if (!chatId) {
      S.showToast("Чат не найден", "error");
      return;
    }

    const currentCallId = window.Sqwid.callState.currentCallId;
    if (!currentCallId) {
      S.showToast("Нет активного звонка", "error");
      return;
    }

    // Открываем модалку, рендерим список
    const modal = document.getElementById("modal-group-invite");
    const search = document.getElementById("groupInviteSearch");
    const results = document.getElementById("groupInviteResults");
    if (!modal || !results) return;

    if (search) search.value = "";
    modal.classList.add("active");

    renderInviteResults("", currentCallId);

    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", (e) => {
        renderInviteResults(e.target.value, currentCallId);
      });
    }
  }

  function renderInviteResults(query, callId) {
    const box = document.getElementById("groupInviteResults");
    if (!box) return;
    box.innerHTML = "";

    const q = (query || "").toLowerCase().trim();
    const users = (S.userMap) || {};
    const alreadyInCall = { [currentUser.uid]: true };
    for (const uid in groupParticipants) alreadyInCall[uid] = true;

    // Уже в 1-на-1 с нами — их не показываем
    const partnerUid = window.Sqwid.callState && window.Sqwid.callState.callPartnerUid;
    if (partnerUid) alreadyInCall[partnerUid] = true;

    const arr = [];
    for (const uid in users) {
      if (alreadyInCall[uid]) continue;
      const u = users[uid];
      const name = (u.name || u.email || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      if (q && !name.includes(q) && !uname.includes(q)) continue;
      arr.push({ uid, ...u });
    }
    arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (arr.length === 0) {
      box.innerHTML = '<div class="create-empty">Никого не найдено</div>';
      return;
    }

    // Проверяем, кому уже отправлено приглашение
    get(ref(db, `calls/${callId}/invites`)).then((snap) => {
      const invites = snap.val() || {};
      arr.slice(0, 40).forEach(u => {
        const invited = invites[u.uid] && invites[u.uid].status === "pending";
        const row = document.createElement("div");
        row.className = "create-result" + (invited ? " already-invited" : "");
        const ava = (u.photo && u.photo.startsWith("data:image"))
          ? `<img src="${u.photo}">`
          : escH((u.name || u.email || "?").charAt(0).toUpperCase());
        row.innerHTML = `
          <div class="create-result-ava">${ava}</div>
          <div class="create-result-info">
            <div class="create-result-name">${escH(u.name || u.email || "Пользователь")}</div>
            <div class="create-result-sub">${u.username ? "@" + escH(u.username) : escH(u.email || "")}</div>
          </div>
        `;
        if (!invited) {
          row.addEventListener("click", () => sendGroupInvite(u.uid, callId));
        }
        box.appendChild(row);
      });
    });
  }

  async function sendGroupInvite(targetUid, callId) {
    if (!targetUid || !callId) return;

    // Заглушаем баннер "уже приглашён"
    const modal = document.getElementById("modal-group-invite");
    if (modal) modal.classList.remove("active");

    // Данные приглашающего
    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    const myName = me.name || me.email || "Пользователь";
    const myPhoto = me.photo || "";

    // Данные того, кому приглашаем
    const toSnap = await get(ref(db, "users/" + targetUid));
    const toUser = toSnap.val() || {};

    // Проверяем — может приглашение уже висит
    const inviteSnap = await get(ref(db, `calls/${callId}/invites/${targetUid}`));
    const existing = inviteSnap.val();
    if (existing && existing.status === "pending") {
      S.showToast("Приглашение уже отправлено", "info");
      return;
    }

    // Записываем приглашение
    await update(ref(db, `calls/${callId}/invites/${targetUid}`), {
      from: currentUser.uid,
      fromName: myName,
      fromPhoto: myPhoto,
      toName: toUser.name || toUser.email || "Пользователь",
      status: "pending",
      at: Date.now()
    });

    S.showToast("Приглашение отправлено", "ok");
  }

  /* ============================================================
     ВХОДЯЩЕЕ ПРИГЛАШЕНИЕ — показываем баннер
     Слушаем глобально: все звонки, где мы в invites с pending
     ============================================================ */
  function startIncomingInvitesListener() {
    if (unsubIncomingInvites) unsubIncomingInvites();

    unsubIncomingInvites = onValue(ref(db, "calls"), (snap) => {
      const calls = snap.val() || {};
      const banner = document.getElementById("incomingCallBanner");
      if (!banner) return;

      // Уже в звонке? не показываем ничего
      if (groupCallId || (window.Sqwid.callState && window.Sqwid.callState.currentCallId)) return;

      for (const callId in calls) {
        const call = calls[callId];
        if (!call.invites) continue;
        const myInvite = call.invites[currentUser.uid];
        if (!myInvite || myInvite.status !== "pending") continue;

        // Нашли висящее приглашение — показываем баннер
        showInviteBanner(callId, myInvite, call);
        return;
      }

      // Ничего не нашли — прячем
      hideInviteBanner();
    });
  }

  let currentInviteCallId = null;
  let currentInviteData = null;

  function showInviteBanner(callId, invite, call) {
    const banner = document.getElementById("incomingCallBanner");
    const nameEl = document.getElementById("incomingCallName");
    const typeEl = document.getElementById("incomingCallType");
    if (!banner) return;

    currentInviteCallId = callId;
    currentInviteData = { callId, invite, call };

    if (nameEl) nameEl.textContent = invite.fromName || "Пользователь";
    if (typeEl) typeEl.textContent = "Приглашает в звонок";

    banner.classList.add("active", "pulsing");
    document.body.classList.add("has-incoming-call");
  }

  function hideInviteBanner() {
    const banner = document.getElementById("incomingCallBanner");
    if (banner) banner.classList.remove("active", "pulsing");
    document.body.classList.remove("has-incoming-call");
    currentInviteCallId = null;
    currentInviteData = null;
  }

  /* ============================================================
     ПРИНЯТЬ ПРИГЛАШЕНИЕ — становимся 3-м (или 4-м)
     ============================================================ */
  async function acceptGroupInvite() {
    if (!currentInviteCallId || !currentInviteData) return;
    const { callId, invite, call } = currentInviteData;

    hideInviteBanner();

    // Помечаем приглашение принятым
    await update(ref(db, `calls/${callId}/invites/${currentUser.uid}`), {
      status: "accepted",
      acceptedAt: Date.now()
    });

    // Готовим локальный стрим — если уже есть в callState, используем его
    let stream = window.Sqwid.callState && window.Sqwid.callState.localStream;
    if (!stream) {
      try {
        const callType = call.type || "audio";
        const constraints = {
          audio: true,
          video: callType === "video"
            ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            : false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        S.showAlert("Не удалось получить доступ к камере/микрофону", "Ошибка");
        return;
      }
    }

    groupLocalStream = stream;
    groupCallId = callId;
    groupModeActive = true;
    groupStartedAt = Date.now();

    // Сообщаем calls.js что мы в групповом режиме
    if (window.Sqwid.callState) {
      window.Sqwid.callState.groupMode = true;
      window.Sqwid.callState.keepStream = true;
      window.Sqwid.callState.setCallId(callId);
      window.Sqwid.callState.setCallType(call.type || "audio");
    }

    // Создаём свою запись в participants
    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    await update(ref(db, `calls/${callId}/participants/${currentUser.uid}`), {
      name: me.name || me.email || "Пользователь",
      photo: me.photo || "",
      joinedAt: Date.now(),
      muted: false,
      camOff: false
    });

    // Запускаем слушатели
    startGroupListeners(callId);

    // Открываем экран звонка
    openGroupCallScreen();
  }

  async function declineGroupInvite() {
    if (!currentInviteCallId) return;
    const callId = currentInviteCallId;
    await update(ref(db, `calls/${callId}/invites/${currentUser.uid}`), {
      status: "declined",
      declinedAt: Date.now()
    });
    hideInviteBanner();
    S.showToast("Приглашение отклонено", "info");
  }

  /* ============================================================
     ЭКРАН ЗВОНКА — переключаемся в режим сетки
     ============================================================ */
  function openGroupCallScreen() {
    // Прячем одиночные видео, показываем сетку
    const videoContainer = document.getElementById("callVideoContainer");
    const groupGrid = document.getElementById("groupCallGrid");
    const avatarOverlay = document.getElementById("callAvatar");
    const btnInvite = document.getElementById("btnCallInvite");
    const btnCam = document.getElementById("btnCallCam");

    if (videoContainer) videoContainer.style.display = "none";
    if (groupGrid) groupGrid.style.display = "grid";
    if (avatarOverlay) avatarOverlay.style.display = "none";
    if (btnInvite) btnInvite.style.display = "flex";

    // Кнопка камеры показывается если тип video
    const callType = window.Sqwid.callState && window.Sqwid.callState.currentCallType;
    if (btnCam) btnCam.style.display = callType === "video" ? "flex" : "none";

    S.showScreen("screen-call");
  }

  /* ============================================================
     ВЫЙТИ ИЗ ГРУППОВОГО РЕЖИМА (завершить)
     ============================================================ */
  async function endGroupCall() {
    if (!groupModeActive) return;
    groupModeActive = false;

    // Убираем себя из participants
    if (groupCallId) {
      try {
        await remove(ref(db, `calls/${groupCallId}/participants/${currentUser.uid}`));
      } catch (e) {}
    }

    // Чистим слушатели
    cleanupGroupListeners();

    // Закрываем все peer connection
    for (const uid in groupPeers) {
      try { groupPeers[uid].pc.close(); } catch (e) {}
    }
    groupPeers = {};

    // Останавливаем локальный стрим (свой — не тот что в calls.js)
    if (groupLocalStream) {
      groupLocalStream.getTracks().forEach(t => t.stop());
      groupLocalStream = null;
    }

    // Сбрасываем флаги
    if (window.Sqwid.callState) {
      window.Sqwid.callState.groupMode = false;
      window.Sqwid.callState.keepStream = false;
    }

    // Обнуляем у себя
    groupCallId = null;
    groupParticipants = {};
    groupStartedAt = 0;

    // Закрываем групповые элементы
    const videoContainer = document.getElementById("callVideoContainer");
    const groupGrid = document.getElementById("groupCallGrid");
    if (groupGrid) groupGrid.innerHTML = "";
    if (groupGrid) groupGrid.style.display = "none";
    if (videoContainer) videoContainer.style.display = "";

    // Возвращаемся в чат
    if (S.getChatId && S.getChatId()) {
      S.showScreen("screen-messages");
    } else {
      S.showScreen("screen-chats");
    }

    // Завершаем сам звонок
    if (groupCallId) {
      try {
        await update(ref(db, `calls/${groupCallId}`), {
          status: "ended",
          endedAt: Date.now()
        });
      } catch (e) {}
    }
  }

  /* ============================================================
     СЛУШАТЕЛИ — participants, invites, peer signaling
     ============================================================ */
  function startGroupListeners(callId) {
    cleanupGroupListeners();

    // 1. Подписка на участников
    unsubParticipants = onValue(ref(db, `calls/${callId}/participants`), (snap) => {
      const parts = snap.val() || {};
      const prevUids = Object.keys(groupParticipants);
      groupParticipants = parts;

      // Для каждого нового — создаём peer connection
      for (const uid in parts) {
        if (uid === currentUser.uid) continue;
        if (!groupPeers[uid]) {
          createPeer(uid, callId);
        }
      }

      // Для тех, кто ушёл — рвём соединение
      for (const uid of prevUids) {
        if (!parts[uid] && groupPeers[uid]) {
          try { groupPeers[uid].pc.close(); } catch (e) {}
          delete groupPeers[uid];
          if (unsubMyPeerEvents[peerKey(currentUser.uid, uid)]) {
            unsubMyPeerEvents[peerKey(currentUser.uid, uid)]();
            delete unsubMyPeerEvents[peerKey(currentUser.uid, uid)];
          }
          removeTile(uid);
        }
      }

      renderGroupGrid();
      updateGridLayout();
    });

    // 2. Подписка на invites — чтобы понимать, кто пришёл через приглашение (не обязательно)
    // Достаточно participants — оставляем пусто.

    // 3. Для каждого peer — подписка на signaling уже внутри createPeer
  }

  function cleanupGroupListeners() {
    if (unsubParticipants) { unsubParticipants(); unsubParticipants = null; }
    if (unsubPeers) { unsubPeers(); unsubPeers = null; }
    if (unsubInvites) { unsubInvites(); unsubInvites = null; }

    for (const key in unsubMyPeerEvents) {
      try { unsubMyPeerEvents[key](); } catch (e) {}
    }
    unsubMyPeerEvents = {};
  }

  /* ============================================================
     СОЗДАНИЕ PEER CONNECTION С КОНКРЕТНЫМ УЧАСТНИКОМ
     ============================================================ */
  async function createPeer(otherUid, callId) {
    const key = peerKey(currentUser.uid, otherUid);
    const iAmInitiator = isInitiator(currentUser.uid, otherUid);

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Добавляем свои треки
    if (groupLocalStream) {
      groupLocalStream.getTracks().forEach(track => {
        pc.addTrack(track, groupLocalStream);
      });
    }

    // Удалённый поток
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      // Обновляем тайл
      const tile = getOrCreateTile(otherUid);
      if (tile) {
        const videoEl = tile.querySelector("video");
        if (videoEl && videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
          videoEl.play().catch(() => {});
          tile.classList.add("has-video");
        }
      }
    };

    // ICE кандидаты — пушим в свою ветку (ice/<мой uid>)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        push(ref(db, `calls/${callId}/peers/${key}/ice/${currentUser.uid}`), event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        const tile = getOrCreateTile(otherUid);
        if (tile) tile.classList.remove("connecting");
      }
      if (state === "failed" || state === "disconnected") {
        // Можно попробовать перезапуск — пока просто помечаем
        console.warn("Peer", otherUid, "state:", state);
      }
    };

    groupPeers[otherUid] = { pc, stream: remoteStream, initiator: iAmInitiator };

    // Подписка на signaling ДРУГОЙ стороны — кандидаты и offer/answer
    const otherUidForIce = otherUid;
    const unsub = onValue(ref(db, `calls/${callId}/peers/${key}`), async (snap) => {
      const data = snap.val();
      if (!data) return;

      // 1. Разбираем offer/answer
      if (iAmInitiator) {
        // Я жду answer от другого
        if (data.answer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch (e) { console.warn("setRemoteDescription(answer):", e); }
        }
      } else {
        // Я жду offer от другого
        if (data.offer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await update(ref(db, `calls/${callId}/peers/${key}`), {
              answer: { type: answer.type, sdp: answer.sdp }
            });
          } catch (e) { console.warn("handle offer:", e); }
        }
      }

      // 2. Разбираем ICE от другого
      const theirIce = data.ice && data.ice[otherUidForIce];
      if (theirIce) {
        for (const id in theirIce) {
          const c = theirIce[id];
          if (c && c.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {}
          }
        }
      }
    });
    unsubMyPeerEvents[key] = unsub;

    // 3. Если я инициатор — создаю offer
    if (iAmInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await update(ref(db, `calls/${callId}/peers/${key}`), {
          initiator: currentUser.uid,
          offer: { type: offer.type, sdp: offer.sdp }
        });
      } catch (e) {
        console.warn("createOffer:", e);
      }
    }

    // Рисуем плитку пока без видео
    const tile = getOrCreateTile(otherUid);
    if (tile) tile.classList.add("connecting");
  }
    /* ============================================================
     РЕНДЕР СЕТКИ УЧАСТНИКОВ
     ============================================================ */
  function getOrCreateTile(uid) {
    const grid = document.getElementById("groupCallGrid");
    if (!grid) return null;

    let tile = grid.querySelector(`[data-uid="${uid}"]`);
    if (tile) return tile;

    const u = (S.userMap && S.userMap[uid]) || groupParticipants[uid] || {};
    const name = u.name || u.email || "Пользователь";
    const photo = u.photo || "";

    tile = document.createElement("div");
    tile.className = "group-call-tile connecting";
    tile.dataset.uid = uid;

    const avaHTML = (photo && photo.startsWith("data:image"))
      ? `<img src="${photo}" alt="">`
      : `<span>${escH(name.charAt(0).toUpperCase())}</span>`;

    tile.innerHTML = `
      <video autoplay playsinline></video>
      <div class="tile-ava">${avaHTML}</div>
      <div class="tile-name">
        <span class="tile-name-text">${escH(name)}</span>
        <span class="tile-mute" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </span>
      </div>
      <div class="tile-badge" style="display:none;">Вы</div>
    `;

    if (uid === currentUser.uid) {
      tile.querySelector(".tile-badge").style.display = "block";
    }

    grid.appendChild(tile);
    return tile;
  }

  function removeTile(uid) {
    const grid = document.getElementById("groupCallGrid");
    if (!grid) return;
    const tile = grid.querySelector(`[data-uid="${uid}"]`);
    if (tile) tile.remove();
  }

  function renderGroupGrid() {
    const grid = document.getElementById("groupCallGrid");
    if (!grid) return;

    // Создаём плитки для всех, включая себя
    for (const uid in groupParticipants) {
      getOrCreateTile(uid);
    }

    // Обновляем mute-иконки и "уже в разговоре"
    for (const uid in groupParticipants) {
      const tile = grid.querySelector(`[data-uid="${uid}"]`);
      if (!tile) continue;
      const part = groupParticipants[uid];

      const muteIcon = tile.querySelector(".tile-mute");
      if (muteIcon) {
        muteIcon.style.display = part.muted ? "inline-flex" : "none";
      }

      // Если camOff — показываем аватар, скрываем video
      if (part.camOff) {
        tile.classList.remove("has-video");
      }
    }

    // Мой собственный тайл — обязательно подключаю локальный стрим
    const myTile = grid.querySelector(`[data-uid="${currentUser.uid}"]`);
    if (myTile && groupLocalStream) {
      const myVideo = myTile.querySelector("video");
      if (myVideo && !myVideo.srcObject) {
        // Клонируем стрим, чтобы можно было attached к нескольким video-элементам
        // (в WebView srcObject один — привязываем напрямую к моему video)
        myVideo.srcObject = groupLocalStream;
        myVideo.muted = true;
        myVideo.play().catch(() => {});
        const hasVideoTrack = groupLocalStream.getVideoTracks().length > 0;
        if (hasVideoTrack) myTile.classList.add("has-video");
      }
    }
  }

  function updateGridLayout() {
    const grid = document.getElementById("groupCallGrid");
    if (!grid) return;
    const count = grid.querySelectorAll(".group-call-tile").length;

    grid.classList.remove("cols-1", "cols-2");
    if (count <= 1) grid.style.gridTemplateColumns = "1fr";
    else grid.style.gridTemplateColumns = "repeat(2, 1fr)";
  }

  /* ============================================================
     КНОПКИ ЭКРАНА ЗВОНКА — mute / cam / invite / end
     ============================================================ */

  // Пригласить
  const btnInvite = document.getElementById("btnCallInvite");
  if (btnInvite) {
    btnInvite.addEventListener("click", () => openInvitePicker());
  }

  // Отмена в модалке приглашения
  const btnInviteCancel = document.getElementById("btnGroupInviteCancel");
  if (btnInviteCancel) {
    btnInviteCancel.addEventListener("click", () => {
      document.getElementById("modal-group-invite").classList.remove("active");
    });
  }

  // Mute — расширяем логику: если групповой режим, шлём состояние в БД
  // (существующий обработчик mute из calls.js трогать не будем, но
  //  добавим свой — при клике в групповом режиме)
  const btnMuteGC = document.getElementById("btnCallMute");
  if (btnMuteGC) {
    btnMuteGC.addEventListener("click", async () => {
      if (!groupModeActive || !groupCallId) return;
      if (!groupLocalStream) return;
      const track = groupLocalStream.getAudioTracks()[0];
      if (!track) return;
      // Меняет enabled после того как calls.js переключит — синхронизируем
      setTimeout(async () => {
        try {
          await update(ref(db, `calls/${groupCallId}/participants/${currentUser.uid}`), {
            muted: !track.enabled
          });
        } catch (e) {}
      }, 10);
    });
  }

  // Cam toggle — синхронизация
  const btnCamGC = document.getElementById("btnCallCam");
  if (btnCamGC) {
    btnCamGC.addEventListener("click", async () => {
      if (!groupModeActive || !groupCallId) return;
      if (!groupLocalStream) return;
      const track = groupLocalStream.getVideoTracks()[0];
      if (!track) return;
      setTimeout(async () => {
        const camOff = !track.enabled;
        try {
          await update(ref(db, `calls/${groupCallId}/participants/${currentUser.uid}`), {
            camOff
          });
          // Обновляем свой тайл
          const grid = document.getElementById("groupCallGrid");
          const myTile = grid && grid.querySelector(`[data-uid="${currentUser.uid}"]`);
          if (myTile) {
            if (camOff) myTile.classList.remove("has-video");
            else myTile.classList.add("has-video");
          }
        } catch (e) {}
      }, 10);
    });
  }

  // End — в групповом режиме вызываем endGroupCall
  const btnEndGC = document.getElementById("btnCallEnd");
  if (btnEndGC) {
    btnEndGC.addEventListener("click", async () => {
      if (groupModeActive) {
        e => {}; // заглушка
        await endGroupCall();
      }
      // Если не в групповом — работает родной обработчик calls.js
    });
  }

  // Кнопка свернуть (miniWidget) — работает как есть, т.к. экран тот же
  // Мини-виджет покажет только имя одного участника — это ок для 1-на-1,
  // в групповом режиме виджет покажет "Групповой звонок" — не реализовано,
  // но не сломает существующий.

  /* ============================================================
     АВТООБНОВЛЕНИЕ ТАЙЛА "СЛЫШНО ГОЛОС"
     Простая эвристика: WebAudio Analyser — слишком сложно.
     Пропускаем — не критично.
     ============================================================ */

  /* ============================================================
     СИНХРОНИЗАЦИЯ С calls.js — кнопка "Пригласить"
     Скрываем её если участников уже 4
     ============================================================ */
  function refreshInviteButton() {
    const btn = document.getElementById("btnCallInvite");
    if (!btn) return;
    const totalCount = Object.keys(groupParticipants).length || 2; // 2 = 1-на-1
    if (totalCount >= MAX_PARTICIPANTS) {
      btn.style.display = "none";
    } else if (groupModeActive || (window.Sqwid.callState && window.Sqwid.callState.currentCallId)) {
      btn.style.display = "flex";
    }
  }

  // Периодически проверяем
  setInterval(refreshInviteButton, 1500);

  /* ============================================================
     ПЕРЕХВАТ: приглашённый принимает — приходит к нам в participants,
     а у нас уже был 1-на-1. Устанавливаем групповой режим у себя тоже.
     ============================================================ */
  // Слушаем чужие звонки, где я участник и появился третий
  onValue(ref(db, "calls"), async (snap) => {
    const calls = snap.val() || {};
    const myCallId = window.Sqwid.callState && window.Sqwid.callState.currentCallId;
    if (!myCallId || groupModeActive) return;

    const call = calls[myCallId];
    if (!call) return;
    if (call.status === "ended") return;

    const participants = call.participants || {};
    const others = Object.keys(participants).filter(u => u !== currentUser.uid);
    // Если в participants больше 1 человека, и мы ещё не в групповом режиме
    if (others.length >= 1 && !groupModeActive) {
      // Значит к нам присоединился третий — переключаемся в групповой режим
      enterGroupMode(myCallId);
    }
  });

  async function enterGroupMode(callId) {
    if (groupModeActive) return;
    groupModeActive = true;
    groupCallId = callId;
    groupStartedAt = Date.now();

    if (window.Sqwid.callState) {
      window.Sqwid.callState.groupMode = true;
      window.Sqwid.callState.keepStream = true;
      window.Sqwid.callState.setCallId(callId);
    }

    // Наш стрим — берём из calls.js
    groupLocalStream = window.Sqwid.callState.localStream;

    // Добавляем себя в participants (если ещё не там)
    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    await update(ref(db, `calls/${callId}/participants/${currentUser.uid}`), {
      name: me.name || me.email || "Пользователь",
      photo: me.photo || "",
      joinedAt: Date.now(),
      muted: false,
      camOff: !(window.Sqwid.callState.currentCallType === "video")
    });

    // Запускаем слушатели (создадут peer connection со всеми)
    startGroupListeners(callId);

    // Перерисовываем экран под сетку
    openGroupCallScreen();
  }

  /* ============================================================
     АВТООБНОВЛЕНИЕ КНОПКИ "ПРИГЛАСИТЬ" на screen-call
     при существующем 1-на-1 звонке
     ============================================================ */
  setInterval(() => {
    const btn = document.getElementById("btnCallInvite");
    if (!btn) return;
    const hasCall = window.Sqwid.callState && window.Sqwid.callState.currentCallId;
    const isGroup = groupModeActive;
    const count = Object.keys(groupParticipants).length || 2;

    if ((hasCall || isGroup) && count < MAX_PARTICIPANTS) {
      // Показываем только если сейчас открыт экран звонка
      const screenCall = document.getElementById("screen-call");
      if (screenCall && screenCall.classList.contains("active")) {
        btn.style.display = "flex";
      }
    } else {
      btn.style.display = "none";
    }
  }, 1000);

  /* ============================================================
     ПРИЁМ/ОТКЛОНЕНИЕ ПРИГЛАШЕНИЯ — вешаем на существующий баннер
     ============================================================ */
  const btnAccept = document.getElementById("btnIncomingAccept");
  const btnDecline = document.getElementById("btnIncomingDecline");

  if (btnAccept) {
    btnAccept.addEventListener("click", (e) => {
      // Если это приглашение в групповой звонок — обрабатываем сами
      if (currentInviteCallId) {
        e.stopImmediatePropagation();
        e.preventDefault();
        acceptGroupInvite();
      }
    }, true);
  }

  if (btnDecline) {
    btnDecline.addEventListener("click", (e) => {
      if (currentInviteCallId) {
        e.stopImmediatePropagation();
        e.preventDefault();
        declineGroupInvite();
      }
    }, true);
  }

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ
     ============================================================ */
  startIncomingInvitesListener();

  /* ============================================================
     ЭКСПОРТ
     ============================================================ */
  window.Sqwid.openGroupInvitePicker = openInvitePicker;
  window.Sqwid.endGroupCall = endGroupCall;
  window.Sqwid.groupCallState = {
    isActive: () => groupModeActive,
    getCallId: () => groupCallId,
    getParticipants: () => ({ ...groupParticipants })
  };

  console.log("✅ group-calls.js готов");
});