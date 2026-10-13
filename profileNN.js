/* ============================================================
   profileNN.js — профиль собеседника (соцсети Sqwid+)
   + кликабельная SVG-галочка верификации
   ============================================================ */

console.log("🚀 profileNN.js загружен, жду Sqwid...");

function waitForSqwidNN(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ profileNN.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidNN((S) => {
  const { db, ref, get, set, push, onValue, currentUser, userMap, showScreen } = S;
  if (!currentUser) return;

  console.log("🔥 profileNN.js активирован");

  let viewingUid = null;
  let viewingUserName = "Пользователь";
  let unsubUser = null;

  /* ============================================================
     ВАЛИДАЦИЯ URL
     ============================================================ */
  function sanitizeUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return "";
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      if (!u.hostname || !u.hostname.includes(".")) return "";
      return u.href;
    } catch (e) {
      return "";
    }
  }

  function escH(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }

  function verifiedIcon(size = 16) {
    return `<span class="verified-tappable" data-verified-open="1" style="margin-left:4px;"><svg width="${size}" height="${size}"><use href="#ico-verified"/></svg></span>`;
  }

  /* ============================================================
     ОТКРЫТИЕ ЧУЖОГО ПРОФИЛЯ
     ============================================================ */
  async function openOtherProfile(uid) {
    if (!uid) return;
    if (uid === currentUser.uid) { showScreen("screen-profile"); return; }
    viewingUid = uid;
    if (window.Sqwid) window.Sqwid.viewingProfileUid = uid;

    let u = userMap[uid] || {};
    if (!u.name && !u.email) {
      try {
        const snap = await get(ref(db, "users/" + uid));
        const fresh = snap.val();
        if (fresh) u = fresh;
      } catch (e) {}
    }

    viewingUserName = u.name || u.email || "Пользователь";

    applyProfileStatus(u);

    /* --- Кнопка "Написать" --- */
    const btnWrite = document.getElementById("btnUpWrite");
    if (btnWrite) {
      btnWrite.onclick = () => openPrivateChatWith(uid, u.name || u.email || "Пользователь");
      btnWrite.disabled = u.banned === true;
      btnWrite.style.opacity = u.banned === true ? "0.4" : "1";
    }

    /* --- Кнопка "Пожаловаться" --- */
    const btnReport = document.getElementById("btnUpReport");
    if (btnReport) {
      btnReport.onclick = () => {
        if (!viewingUid) return;
        if (window.Sqwid && window.Sqwid.openReportModal) {
          window.Sqwid.openReportModal({
            targetType: "user",
            targetUid: viewingUid,
            targetLabel: `Пользователь ${viewingUserName}`
          });
        }
      };
    }

    renderSocial(uid, u);
    subscribeUser(uid);

    showScreen("screen-user-profile");
  }

  if (window.Sqwid) window.Sqwid.openOtherProfile = openOtherProfile;

  /* ============================================================
     СОЦСЕТИ (Sqwid+)
     ============================================================ */
  function renderSocial(uid, u) {
    let box = document.getElementById("upSocial");

    const isPlusUser = u.plusUntil && u.plusUntil > Date.now();
    const links = u.socialLinks || {};

    const hasLinks = isPlusUser && Object.values(links).some(v => v && typeof v === "string" && v.trim());

    if (!hasLinks) {
      if (box) box.remove();
      return;
    }

    if (!box) {
      box = document.createElement("div");
      box.id = "upSocial";
      box.className = "up-section";
      box.innerHTML = `<h3 class="up-section-title">🔗 Соцсети</h3><div class="up-chips" id="upSocialList"></div>`;
      const parent = document.querySelector("#screen-user-profile .profile-scroll");
      if (parent) parent.appendChild(box);
    }

    const list = document.getElementById("upSocialList");
    if (!list) return;
    list.innerHTML = "";

    const icons = {
      telegram: "✈️",
      instagram: "📸",
      youtube: "▶️",
      tiktok: "🎵",
      vk: "🅥",
      github: "🐙",
      website: "🌐"
    };

    Object.entries(links).forEach(([key, url]) => {
      if (!url || typeof url !== "string") return;
      const safe = sanitizeUrl(url);
      if (!safe) return;

      const a = document.createElement("a");
      a.href = safe;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "up-chip";
      a.style.textDecoration = "none";
      a.style.display = "inline-flex";
      a.style.alignItems = "center";
      a.style.gap = "6px";
      a.style.cursor = "pointer";
      a.innerHTML = `${icons[key] || "🔗"} ${key}`;
      list.appendChild(a);
    });

    if (list.children.length === 0) box.remove();
  }

  /* ============================================================
     СТАТУС (бан / заморозка)
     ============================================================ */
  function applyProfileStatus(u) {
    const banned = u.banned === true;
    const frozen = u.frozen === true;

    const avaEl = document.getElementById("upAva");
    if (avaEl) {
      if (banned) {
        avaEl.innerHTML = `<span style="font-size:44px;">🚫</span>`;
        avaEl.classList.add("banned-ava");
        avaEl.classList.remove("frozen-ava");
      } else if (frozen) {
        avaEl.innerHTML = `<span style="font-size:48px;">❄</span>`;
        avaEl.classList.add("frozen-ava");
        avaEl.classList.remove("banned-ava");
      } else if (u.photo && u.photo.startsWith("data:image")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      } else if (u.photo && !u.photo.startsWith("data:")) {
        avaEl.innerHTML = `<img src="${u.photo}" alt="">`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      } else {
        const letter = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
        avaEl.innerHTML = `<span>${escH(letter)}</span>`;
        avaEl.classList.remove("frozen-ava", "banned-ava");
      }
    }

    const nameEl = document.getElementById("upName");
    if (nameEl) {
      let nameHTML = escH(u.name || u.email || "Пользователь");
      if (u.verified && !banned) {
        nameHTML += verifiedIcon(16);
      }
      if (banned) {
        nameHTML += ` <span style="color:#ef4444;font-size:12px;font-weight:700;margin-left:6px;">ЗАБЛОКИРОВАН</span>`;
      }
      nameEl.innerHTML = nameHTML;
      nameEl.classList.remove("frozen-name");
      if (banned) nameEl.classList.add("banned-name");
      else if (frozen) nameEl.classList.add("frozen-name");
    }

    const bioEl = document.getElementById("upBio");
    if (bioEl) bioEl.textContent = u.bio || "";

    const unEl = document.getElementById("upUsername");
    if (unEl) unEl.textContent = u.username ? "@" + u.username : "";

    let banner = document.getElementById("upBannedBanner");
    if (banned) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "upBannedBanner";
        banner.className = "up-banned-banner";
        banner.innerHTML = `🚫 Этот аккаунт заблокирован администрацией Sqwid`;
        const top = document.querySelector("#screen-user-profile .profile-top");
        if (top) top.insertBefore(banner, top.firstChild);
      }
    } else {
      if (banner) banner.remove();
    }

    let frozenBanner = document.getElementById("upFrozenBanner");
    if (frozen && !banned) {
      if (!frozenBanner) {
        frozenBanner = document.createElement("div");
        frozenBanner.id = "upFrozenBanner";
        frozenBanner.className = "up-frozen-banner";
        frozenBanner.innerHTML = `❄ Аккаунт заморожен — временно не может тратить SQ`;
        const top = document.querySelector("#screen-user-profile .profile-top");
        if (top) top.insertBefore(frozenBanner, top.firstChild);
      }
    } else {
      if (frozenBanner) frozenBanner.remove();
    }
  }

  /* ============================================================
     ПОДПИСКА НА ЮЗЕРА
     ============================================================ */
  function subscribeUser(uid) {
    if (unsubUser) unsubUser();

    unsubUser = onValue(ref(db, "users/" + uid), (snap) => {
      const fresh = snap.val();
      if (fresh && viewingUid === uid) {
        viewingUserName = fresh.name || fresh.email || "Пользователь";
        applyProfileStatus(fresh);
        renderSocial(uid, fresh);
      }
    });
  }

  /* ============================================================
     ЛИЧНЫЙ ЧАТ
     ============================================================ */
  async function openPrivateChatWith(uid, displayName) {
    if (!uid || uid === currentUser.uid) return;
    const snap = await get(ref(db, "chats"));
    const chats = snap.val() || {};
    let existing = null;
    for (const chatId in chats) {
      const c = chats[chatId];
      if (c.type !== "private") continue;
      const m = c.members || {};
      if (m[currentUser.uid] && m[uid] && Object.keys(m).length === 2) {
        existing = chatId;
        break;
      }
    }
    if (existing) {
      if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(existing);
      else showScreen("screen-messages");
    } else {
      const newRef = push(ref(db, "chats"));
      await set(newRef, {
        name: displayName || "Чат",
        type: "private",
        members: { [currentUser.uid]: true, [uid]: true },
        owner: currentUser.uid,
        description: "",
        photo: null,
        lastMsg: "",
        lastMsgAt: Date.now(),
        createdAt: Date.now()
      });
      if (window.Sqwid && window.Sqwid.openChat) window.Sqwid.openChat(newRef.key);
      else showScreen("screen-messages");
    }
  }

  /* ============================================================
     КНОПКИ
     ============================================================ */
  const btnBack = document.getElementById("btnBackUserProfile");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      viewingUid = null;
      viewingUserName = "Пользователь";
      if (window.Sqwid) window.Sqwid.viewingProfileUid = null;
      if (unsubUser) { unsubUser(); unsubUser = null; }
      const chatId = window.Sqwid && window.Sqwid.getChatId ? window.Sqwid.getChatId() : null;
      if (chatId) showScreen("screen-messages");
      else showScreen("screen-chats");
    });
  }

  console.log("✅ profileNN.js готов");
});