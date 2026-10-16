/* ============================================================
   chat-settings.js — настройки
   Профиль, приватность, PIN, аккаунт, темы, Sqwid+, кастомизация ника
   + новая навигация по разделам с подэкранами
   ============================================================ */

console.log("🚀 chat-settings.js загружен, жду Sqwid...");

function waitForSqwidSettings(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ chat-settings.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidSettings((S) => {
  const { db, ref, get, update, remove, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 chat-settings.js активирован");

  let myData = {};
  let avatarBase64 = null;
  let avatarChanged = false;

  /* ============================================================
     ХЕЛПЕР: активен ли Sqwid+
     ============================================================ */
  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }

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

  /* ============================================================
     ХЕЛПЕРЫ
     ============================================================ */
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
  function setCheck(id, v) {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  }
  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }
  function show(id, on) {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? "block" : "none";
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " МБ";
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + " ГБ";
  }

  /* ============================================================
     ТЕМА
     ============================================================ */
  function applyTheme(theme) {
    if (theme === "dark") {
      document.body.setAttribute("data-theme", "dark");
    } else if (theme === "girl") {
      document.body.setAttribute("data-theme", "girl");
    } else {
      document.body.removeAttribute("data-theme");
    }
    try { localStorage.setItem("sqwid_theme", theme); } catch (e) {}
    const light = document.getElementById("themeLight");
    const dark = document.getElementById("themeDark");
    const girl = document.getElementById("themeGirl");
    if (light) light.classList.toggle("active", theme !== "dark" && theme !== "girl");
    if (dark) dark.classList.toggle("active", theme === "dark");
    if (girl) girl.classList.toggle("active", theme === "girl");
  }

  (function initTheme() {
    let saved = "light";
    try { saved = localStorage.getItem("sqwid_theme") || "light"; } catch (e) {}
    applyTheme(saved);
  })();

  /* ============================================================
     ЗАГРУЗКА ДАННЫХ
     ============================================================ */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    const screen = document.getElementById("screen-settings");
    if (screen && screen.classList.contains("active")) renderSettings();
    updateAccountSub();
    updateLangSub();
    updatePlusSub();
    updateSecuritySub();
    updateCoinsInfo();
  });

  /* ============================================================
     ОТКРЫТИЕ НАСТРОЕК
     ============================================================ */
  const navBtns = document.querySelectorAll('.nav-btn[data-screen="screen-settings"]');
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      avatarBase64 = null;
      avatarChanged = false;
      renderSettings();
      renderLangPicker();
      S.showScreen("screen-settings");
    });
  });

  const btnBack = document.getElementById("btnBackSettings");
  if (btnBack) btnBack.addEventListener("click", () => S.showScreen("screen-chats"));

  /* ============================================================
     РЕНДЕР НАСТРОЕК
     ============================================================ */
  function renderSettings() {
    const name = myData.name || currentUser.email.split("@")[0];

    const photoEl = document.getElementById("settingsPhoto");
    if (photoEl) {
      if (avatarBase64) photoEl.src = avatarBase64;
      else if (myData.photo && myData.photo.startsWith("data:image")) photoEl.src = myData.photo;
      else if (myData.photo && !myData.photo.startsWith("data:")) photoEl.src = myData.photo;
      else photoEl.src = S.svgAvatar(name);
    }

    setVal("settingsName", myData.name || "");
    setVal("settingsUsername", myData.username || "");
    setVal("settingsBio", myData.bio || "");
    setVal("settingsEmail", currentUser.email);

    setCheck("settingsHideEmail", myData.hideEmail === true);
    setCheck("settingsHideOnline", myData.hideOnline === true);
    setCheck("settingsShowUsername", myData.showUsername !== false);

    const pinStatus = document.getElementById("settingsPinStatus");
    if (pinStatus) {
      if (myData.pin) {
        pinStatus.textContent = "🔒 Установлен";
        pinStatus.style.color = "#10b981";
      } else {
        pinStatus.textContent = "🔓 Не установлен";
        pinStatus.style.color = "#94a3b8";
      }
    }

    const balEl = document.getElementById("settingsBalance");
    if (balEl) balEl.textContent = "🪙 " + (myData.coins || 0) + " SQ";

    let cur = "light";
    try { cur = localStorage.getItem("sqwid_theme") || "light"; } catch (e) {}
    const light = document.getElementById("themeLight");
    const dark = document.getElementById("themeDark");
    const girl = document.getElementById("themeGirl");
    if (light) light.classList.toggle("active", cur !== "dark" && cur !== "girl");
    if (dark) dark.classList.toggle("active", cur === "dark");
    if (girl) girl.classList.toggle("active", cur === "girl");

    const plusSection = document.getElementById("settingsPlusSection");
    if (plusSection) {
      const plus = isPlus();
      plusSection.style.display = plus ? "block" : "none";
      if (plus) {
        const social = myData.socialLinks || {};
        setVal("settingsSocialTelegram", social.telegram || "");
        setVal("settingsSocialInstagram", social.instagram || "");
        setVal("settingsSocialYoutube", social.youtube || "");
      }
    }

    const nickCustom = document.getElementById("settingsNickCustom");
    const nickFont = document.getElementById("settingsNickFont");
    const nickEmoji = document.getElementById("settingsNickEmoji");
    if (nickCustom && nickEmoji) {
      const plus = isPlus();
      nickCustom.style.display = plus ? "block" : "none";
      if (nickFont) nickFont.style.display = plus ? "block" : "none";
      nickEmoji.style.display = plus ? "block" : "none";
      if (plus) {
        document.querySelectorAll(".nick-color-btn").forEach(b => {
          b.classList.toggle("active", (b.dataset.color || "") === (myData.nickColor || ""));
        });
        document.querySelectorAll(".nick-font-btn").forEach(b => {
          b.classList.toggle("active", (b.dataset.font || "normal") === (myData.nickFont || "normal"));
        });
        document.querySelectorAll(".nick-emoji-btn").forEach(b => {
          b.classList.toggle("active", (b.dataset.emoji || "") === (myData.nickEmoji || ""));
        });
      }
    }
  }

  /* ============================================================
     ТЕМА — обработчики
     ============================================================ */
  const btnThemeLight = document.getElementById("themeLight");
  if (btnThemeLight) btnThemeLight.addEventListener("click", () => applyTheme("light"));

  const btnThemeDark = document.getElementById("themeDark");
  if (btnThemeDark) btnThemeDark.addEventListener("click", () => applyTheme("dark"));

  const btnThemeGirl = document.getElementById("themeGirl");
  if (btnThemeGirl) btnThemeGirl.addEventListener("click", () => applyTheme("girl"));

  /* ============================================================
     АВАТАР
     ============================================================ */
  const avaInput = document.getElementById("settingsAvatarInput");
  if (avaInput) {
    avaInput.addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 500 * 1024) return S.showAlert("Фото до 500 КБ", "Ошибка");
      const r = new FileReader();
      r.onload = (ev) => {
        avatarBase64 = ev.target.result;
        avatarChanged = true;
        const p = document.getElementById("settingsPhoto");
        if (p) p.src = avatarBase64;
      };
      r.readAsDataURL(f);
    });
  }

  /* ============================================================
     СОХРАНЕНИЕ ПРОФИЛЯ
     ============================================================ */
  const btnSave = document.getElementById("settingsSaveProfile");
  if (btnSave) btnSave.addEventListener("click", async () => {
    const name = (document.getElementById("settingsName").value || "").trim();
    const usernameRaw = (document.getElementById("settingsUsername").value || "").trim().toLowerCase();
    const bio = (document.getElementById("settingsBio").value || "").trim();

    if (!name) return S.showAlert("Введите имя", "Ошибка");
    if (name.length > 30) return S.showAlert("Имя до 30 символов", "Ошибка");

    const bioLimit = isPlus() ? 300 : 120;
    if (bio.length > bioLimit) {
      return S.showAlert(
        `Bio до ${bioLimit} символов${isPlus() ? "" : " (Sqwid+ = 300)"}`,
        "Ошибка"
      );
    }

    let username = null;
    if (usernameRaw) {
      if (!/^[a-z0-9_]{3,20}$/.test(usernameRaw)) return S.showAlert("Юзернейм: латиница, цифры и _ , от 3 до 20", "Ошибка");
      username = usernameRaw;

      if (username !== (myData.username || "")) {
        const snap = await get(ref(db, "users"));
        const users = snap.val() || {};
        for (const uid in users) {
          if (uid === currentUser.uid) continue;
          const u = users[uid];
          if (u.username && u.username.toLowerCase() === username) {
            return S.showAlert("Юзернейм @" + username + " занят", "Ошибка");
          }
        }
      }
    }

    const updates = { name, bio };
    if (username) updates.username = username;
    if (avatarChanged && avatarBase64) updates.photo = avatarBase64;

    try {
      await update(ref(db, "users/" + currentUser.uid), updates);
      S.showAlert("Профиль сохранён", "Готово");
      avatarChanged = false;
      avatarBase64 = null;
    } catch (e) {
      S.showAlert("Ошибка: " + e.message, "Ошибка");
    }
  });

  /* ============================================================
     КАСТОМИЗАЦИЯ НИКА
     ============================================================ */
  document.querySelectorAll(".nick-color-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!isPlus()) return S.showAlert("Только для Sqwid+", "Инфо");
      const color = btn.dataset.color || "";
      document.querySelectorAll(".nick-color-btn").forEach(b => b.classList.toggle("active", b === btn));
      await update(ref(db, "users/" + currentUser.uid), { nickColor: color || null });
      S.showToast("Цвет сохранён", "ok");
    });
  });

  document.querySelectorAll(".nick-font-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!isPlus()) return S.showAlert("Только для Sqwid+", "Инфо");
      const font = btn.dataset.font || "normal";
      document.querySelectorAll(".nick-font-btn").forEach(b => b.classList.toggle("active", b === btn));
      await update(ref(db, "users/" + currentUser.uid), { nickFont: font === "normal" ? null : font });
      S.showToast("Шрифт сохранён", "ok");
    });
  });

  document.querySelectorAll(".nick-emoji-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!isPlus()) return S.showAlert("Только для Sqwid+", "Инфо");
      const emoji = btn.dataset.emoji || "";
      document.querySelectorAll(".nick-emoji-btn").forEach(b => b.classList.toggle("active", b === btn));
      await update(ref(db, "users/" + currentUser.uid), { nickEmoji: emoji || null });
      S.showToast("Значок сохранён", "ok");
    });
  });

  /* ============================================================
     SQWID+ — ФОН ПРОФИЛЯ + СОЦСЕТИ
     ============================================================ */
  const btnUploadProfileBg = document.getElementById("btnUploadProfileBg");
  if (btnUploadProfileBg) {
    btnUploadProfileBg.addEventListener("click", () => {
      document.getElementById("settingsProfileBg").click();
    });
  }

  const settingsProfileBg = document.getElementById("settingsProfileBg");
  if (settingsProfileBg) {
    settingsProfileBg.addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) return S.showAlert("Фон до 1 МБ", "Ошибка");
      const r = new FileReader();
      r.onload = async (ev) => {
        try {
          await update(ref(db, "users/" + currentUser.uid), { profileBg: ev.target.result });
          S.showAlert("Фон обновлён", "Готово");
        } catch (err) {
          S.showAlert("Ошибка: " + err.message, "Ошибка");
        }
      };
      r.readAsDataURL(f);
    });
  }

  const btnSavePlus = document.getElementById("settingsSavePlus");
  if (btnSavePlus) {
    btnSavePlus.addEventListener("click", async () => {
      const rawTg = (document.getElementById("settingsSocialTelegram").value || "").trim();
      const rawIg = (document.getElementById("settingsSocialInstagram").value || "").trim();
      const rawYt = (document.getElementById("settingsSocialYoutube").value || "").trim();

      const telegram = sanitizeUrl(rawTg);
      const instagram = sanitizeUrl(rawIg);
      const youtube = sanitizeUrl(rawYt);

      if (rawTg && !telegram) return S.showAlert("Telegram: ссылка должна начинаться с http:// или https://", "Ошибка");
      if (rawIg && !instagram) return S.showAlert("Instagram: ссылка должна начинаться с http:// или https://", "Ошибка");
      if (rawYt && !youtube) return S.showAlert("YouTube: ссылка должна начинаться с http:// или https://", "Ошибка");

      try {
        await update(ref(db, "users/" + currentUser.uid), {
          socialLinks: { telegram, instagram, youtube }
        });
        S.showAlert("Сохранено", "Готово");
      } catch (e) {
        S.showAlert("Ошибка: " + e.message, "Ошибка");
      }
    });
  }

  /* ============================================================
     ПРИВАТНОСТЬ
     ============================================================ */
  bindToggle("settingsHideEmail", "hideEmail");
  bindToggle("settingsHideOnline", "hideOnline");
  bindToggle("settingsShowUsername", "showUsername");

  function bindToggle(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", async () => {
      await update(ref(db, "users/" + currentUser.uid), { [key]: el.checked });
    });
  }

  /* ============================================================
     PIN
     ============================================================ */
  const pinSet = document.getElementById("settingsPinSet");
  if (pinSet) pinSet.addEventListener("click", changePin);
  const pinRemove = document.getElementById("settingsPinRemove");
  if (pinRemove) pinRemove.addEventListener("click", removePin);

  async function changePin() {
    const currentPin = myData.pin;
    if (currentPin) {
      const oldPin = await askPrompt("Введите текущий PIN", "PIN");
      if (oldPin === null) return;
      if (String(oldPin) !== String(currentPin)) return S.showAlert("Неверный текущий PIN", "Ошибка");

      const newPin = await askPrompt("Введите новый PIN (4 цифры)", "PIN");
      if (newPin === null) return;
      if (!/^\d{4}$/.test(newPin)) return S.showAlert("PIN — 4 цифры", "Ошибка");

      const newPin2 = await askPrompt("Повторите PIN", "PIN");
      if (newPin2 === null) return;
      if (newPin !== newPin2) return S.showAlert("PIN не совпадает", "Ошибка");

      await update(ref(db, "users/" + currentUser.uid), { pin: newPin });
      S.showAlert("PIN изменён", "Готово");
    } else {
      const newPin = await askPrompt("Введите новый PIN (4 цифры)", "PIN");
      if (newPin === null) return;
      if (!/^\d{4}$/.test(newPin)) return S.showAlert("PIN — 4 цифры", "Ошибка");

      const newPin2 = await askPrompt("Повторите PIN", "PIN");
      if (newPin2 === null) return;
      if (newPin !== newPin2) return S.showAlert("PIN не совпадает", "Ошибка");

      await update(ref(db, "users/" + currentUser.uid), { pin: newPin });
      S.showAlert("PIN установлен", "Готово");
    }
  }

  async function removePin() {
    if (!myData.pin) return S.showAlert("PIN не установлен", "Ошибка");
    const oldPin = await askPrompt("Введите PIN", "PIN");
    if (oldPin === null) return;
    if (String(oldPin) !== String(myData.pin)) return S.showAlert("Неверный PIN", "Ошибка");
    const ok = await S.showConfirm("Отключить PIN-код?", "PIN");
    if (!ok) return;
    await remove(ref(db, "users/" + currentUser.uid + "/pin"));
    S.showAlert("PIN отключён", "Готово");
  }

  /* ============================================================
     АККАУНТ
     ============================================================ */
  const btnEmail = document.getElementById("settingsChangeEmail");
  if (btnEmail) btnEmail.addEventListener("click", async () => {
    const newEmail = await askPrompt("Новый email", "Email");
    if (!newEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return S.showAlert("Неверный формат email", "Ошибка");
    try {
      const { verifyBeforeUpdateEmail } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");
      await verifyBeforeUpdateEmail(currentUser, newEmail);
      S.showAlert("Письмо отправлено на " + newEmail, "Готово");
    } catch (e) {
      if (e.code === "auth/requires-recent-login") S.showAlert("Слишком давно входили. Выйдите и войдите заново.", "Ошибка");
      else S.showAlert("Ошибка: " + (e.message || e.code), "Ошибка");
    }
  });

  const btnPass = document.getElementById("settingsChangePassword");
  if (btnPass) btnPass.addEventListener("click", async () => {
    const ok = await S.showConfirm("Отправить письмо для смены пароля на " + currentUser.email + "?", "Смена пароля");
    if (!ok) return;
    try {
      const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");
      await sendPasswordResetEmail(S.auth, currentUser.email);
      S.showAlert("Письмо отправлено на " + currentUser.email, "Готово");
    } catch (e) {
      S.showAlert("Ошибка: " + (e.message || e.code), "Ошибка");
    }
  });

  const btnLogout = document.getElementById("settingsLogout");
  if (btnLogout) btnLogout.addEventListener("click", async () => {
    const ok = await S.showConfirm("Выйти из аккаунта?", "Выход");
    if (!ok) return;
    try { localStorage.removeItem("sqwid_pin_ok_" + currentUser.uid); } catch (e) {}
    if (S.signOut) await S.signOut(S.auth);
    window.location.href = "index.html";
  });

  const btnLogoutAll = document.getElementById("settingsLogoutAll");
  if (btnLogoutAll) btnLogoutAll.addEventListener("click", async () => {
    const ok = await S.showConfirm("Выйти и сбросить PIN-сессию?", "Выход");
    if (!ok) return;
    try { localStorage.removeItem("sqwid_pin_ok_" + currentUser.uid); } catch (e) {}
    if (S.signOut) await S.signOut(S.auth);
    window.location.href = "index.html";
  });

  /* ============================================================
     ПРОМПТ
     ============================================================ */
  function askPrompt(text, placeholder) {
    return S.showPrompt(text, placeholder, "");
  }

  /* ============================================================
     ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКОВ
     ============================================================ */
  function renderLangPicker() {
    const box = document.getElementById("langPicker");
    if (!box) return;
    if (!window.SqwidI18n) return;

    const { LANGUAGE_NAMES, LANGUAGE_FLAGS, getLanguage } = window.SqwidI18n;
    const currentLang = getLanguage();
    const ALL_LANGS = ["ru", "en", "es", "de", "fr", "it", "pt", "zh", "ja", "ar"];

    box.innerHTML = "";
    ALL_LANGS.forEach(code => {
      const btn = document.createElement("button");
      btn.className = "theme-btn" + (code === currentLang ? " active" : "");
      btn.type = "button";
      btn.dataset.lang = code;
      btn.dataset.noI18n = "1";
      btn.innerHTML = `
        <div class="theme-btn-icon">${LANGUAGE_FLAGS[code] || "🌐"}</div>
        <div class="theme-btn-label">${LANGUAGE_NAMES[code] || code.toUpperCase()}</div>
      `;
      btn.addEventListener("click", async () => {
        if (window.SqwidI18n && window.SqwidI18n.setLanguage) {
          await window.SqwidI18n.setLanguage(code);
        }
        renderLangPicker();
        updateLangSub();
        S.showToast("Сохранено", "ok");
      });
      box.appendChild(btn);
    });
  }

  /* ============================================================
     ПОДПИСИ В ГЛАВНОМ СПИСКЕ НАСТРОЕК
     ============================================================ */
  function updateAccountSub() {
    const el = document.getElementById("settingsAccountSub");
    if (!el) return;
    const name = myData.name || "без имени";
    const un = myData.username ? "@" + myData.username : "без @username";
    el.textContent = name + " · " + un;
  }

  function updateLangSub() {
    const el = document.getElementById("settingsLangSub");
    if (!el) return;
    if (!window.SqwidI18n) return;
    const lang = window.SqwidI18n.getLanguage();
    const names = window.SqwidI18n.LANGUAGE_NAMES || {};
    el.textContent = names[lang] || lang.toUpperCase();
  }

  function updatePlusSub() {
    const el = document.getElementById("settingsPlusSub");
    if (!el) return;
    if (isPlus()) {
      const d = new Date(myData.plusUntil);
      el.textContent = "Активен до " + d.toLocaleDateString("ru-RU");
    } else {
      el.textContent = "Не активен";
    }
  }

  function updateSecuritySub() {
    const el = document.getElementById("settingsSecuritySub");
    if (!el) return;
    const parts = [];
    if (myData.pin) parts.push("PIN");
    if (myData.twoFA && myData.twoFA.enabled) parts.push("2FA");
    el.textContent = parts.length ? parts.join(" · ") : "PIN, 2FA";
  }

  function updateCoinsInfo() {
    const coins = myData.coins || 0;
    const bigEl = document.getElementById("coinsBigBalance");
    if (bigEl) bigEl.textContent = coins.toLocaleString("ru-RU") + " SQ";

    const topEl = document.getElementById("coinsTopBalance");
    if (topEl) {
      topEl.innerHTML = (window.Sqwid.coinIcon ? window.Sqwid.coinIcon(12) : "") + " " + coins.toLocaleString("ru-RU") + " SQ";
    }

    const valEl = document.getElementById("settingsCoinsValue");
    if (valEl) valEl.textContent = coins.toLocaleString("ru-RU");

    const subEl = document.getElementById("settingsCoinsSub");
    if (subEl) subEl.textContent = coins > 0 ? "Баланс" : "Игровая валюта";
  }

  /* ============================================================
     УВЕДОМЛЕНИЯ
     ============================================================ */
  async function updateNotifyInfo() {
    const statusEl = document.getElementById("notifyPermStatus");
    if (statusEl) {
      if (!("Notification" in window)) {
        statusEl.textContent = "Не поддерживается";
      } else {
        const p = Notification.permission;
        statusEl.textContent = p === "granted" ? "Разрешено" :
                               p === "denied" ? "Запрещено" : "Не запрошено";
        statusEl.style.color = p === "granted" ? "#10b981" :
                               p === "denied" ? "#ef4444" : "var(--text-2)";
      }
    }
    const snd = document.getElementById("settingsNotifySound");
    if (snd && window.Sqwid.notifications) snd.checked = window.Sqwid.notifications.getSound();
    const vib = document.getElementById("settingsNotifyVibrate");
    if (vib && window.Sqwid.notifications) vib.checked = window.Sqwid.notifications.getVibrate();
  }

  const btnNotifyRequest = document.getElementById("btnNotifyRequest");
  if (btnNotifyRequest) {
    btnNotifyRequest.addEventListener("click", async () => {
      if (window.Sqwid.notifications) {
        const p = await window.Sqwid.notifications.request();
        updateNotifyInfo();
        if (p === "granted") S.showToast("Уведомления разрешены", "ok");
      }
    });
  }

  const btnNotifyTest = document.getElementById("btnNotifyTest");
  if (btnNotifyTest) {
    btnNotifyTest.addEventListener("click", () => {
      if (window.Sqwid.notifications) window.Sqwid.notifications.test();
    });
  }

  const settingsNotifySound = document.getElementById("settingsNotifySound");
  if (settingsNotifySound) {
    settingsNotifySound.addEventListener("change", () => {
      if (window.Sqwid.notifications) window.Sqwid.notifications.setSound(settingsNotifySound.checked);
    });
  }

  const settingsNotifyVibrate = document.getElementById("settingsNotifyVibrate");
  if (settingsNotifyVibrate) {
    settingsNotifyVibrate.addEventListener("change", () => {
      if (window.Sqwid.notifications) window.Sqwid.notifications.setVibrate(settingsNotifyVibrate.checked);
    });
  }

  /* ============================================================
     SQWID+ (подэкран)
     ============================================================ */
  function updatePlusInfo() {
    const el = document.getElementById("settingsPlusStatus");
    if (!el) return;
    if (isPlus()) {
      const d = new Date(myData.plusUntil);
      el.textContent = "⭐ Активен до " + d.toLocaleDateString("ru-RU");
      el.style.color = "#10b981";
    } else {
      el.textContent = "Не активен";
      el.style.color = "var(--text-3)";
    }
  }

  const btnSettingsBuyPlus = document.getElementById("btnSettingsBuyPlus");
  if (btnSettingsBuyPlus) {
    btnSettingsBuyPlus.addEventListener("click", () => {
      if (window.Sqwid.openTopUp) window.Sqwid.openTopUp();
    });
  }

  const btnSettingsPlusInfo = document.getElementById("btnSettingsPlusInfo");
  if (btnSettingsPlusInfo) {
    btnSettingsPlusInfo.addEventListener("click", () => {
      if (window.Sqwid.openPlusInfo) window.Sqwid.openPlusInfo();
    });
  }

  /* ============================================================
     ФОН СООБЩЕНИЙ
     ============================================================ */
  const BGS = ["diamonds", "dots", "waves", "grid", "stars"];
  const BGS_PLUS = ["plus-gold", "plus-space", "plus-waves"];

  function renderBgPicker() {
    const box = document.getElementById("bgPicker");
    if (!box) return;
    box.innerHTML = "";
    const all = isPlus() ? BGS.concat(BGS_PLUS) : BGS;
    const current = localStorage.getItem("sqwid_chat_bg_" + currentUser.uid) || "diamonds";

    all.forEach(bg => {
      const item = document.createElement("div");
      item.className = "bg-picker-item" + (bg === current ? " active" : "");
      item.style.background = bgPreviewStyle(bg);
      item.dataset.bg = bg;
      item.addEventListener("click", () => {
        localStorage.setItem("sqwid_chat_bg_" + currentUser.uid, bg);
        if (window.Sqwid.setChatBackground) window.Sqwid.setChatBackground(bg);
        renderBgPicker();
        S.showToast("Фон применён", "ok");
      });
      box.appendChild(item);
    });
  }

  function bgPreviewStyle(bg) {
    const map = {
      diamonds: "linear-gradient(45deg, #f97316 25%, transparent 25%, transparent 75%, #f97316 75%), #fef5ec",
      dots: "radial-gradient(circle, rgba(249,115,22,0.5) 1.5px, transparent 1.5px) 0 0 / 12px 12px, #fff7ed",
      waves: "repeating-linear-gradient(45deg, rgba(245,158,11,0.3) 0, rgba(245,158,11,0.3) 1px, transparent 1px, transparent 10px), #fef3e7",
      grid: "linear-gradient(rgba(251,146,60,0.3) 1px, transparent 1px) 0 0 / 100% 12px, #fff7ed",
      stars: "radial-gradient(circle, rgba(245,158,11,0.5) 1px, transparent 1.5px) 0 0 / 20px 20px, #fffbeb",
      "plus-gold": "linear-gradient(135deg, #f59e0b, #ffd966)",
      "plus-space": "radial-gradient(circle at 50% 50%, #1e1b4b, #000)",
      "plus-waves": "repeating-linear-gradient(90deg, rgba(249,115,22,0.5), rgba(236,72,153,0.5) 20px, rgba(139,92,246,0.5) 40px)"
    };
    return map[bg] || "#eee";
  }

  /* ============================================================
     ПАПКИ
     ============================================================ */
  const FOLDERS = [
    { id: "all", name: "Все" },
    { id: "private", name: "Личные" },
    { id: "group", name: "Группы" },
    { id: "channel", name: "Каналы" },
    { id: "unread", name: "Непрочитанные" }
  ];

  function renderFoldersPicker() {
    const box = document.getElementById("foldersPicker");
    if (!box) return;
    box.innerHTML = "";
    const current = localStorage.getItem("sqwid_folder") || "all";
    FOLDERS.forEach(f => {
      const btn = document.createElement("button");
      btn.className = "folder-picker-btn" + (f.id === current ? " active" : "");
      btn.textContent = f.name;
      btn.addEventListener("click", () => {
        localStorage.setItem("sqwid_folder", f.id);
        if (window.Sqwid.refreshChatList) window.Sqwid.refreshChatList();
        renderFoldersPicker();
        S.showToast("Папка: " + f.name, "ok");
      });
      box.appendChild(btn);
    });
  }

  /* ============================================================
     ДАННЫЕ И ПАМЯТЬ
     ============================================================ */
  async function updateStorageInfo() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        const quota = est.quota || 0;
        setText("storageCacheSize", formatBytes(used));
        setText("storageQuota", formatBytes(quota - used) + " свободно");
      } else {
        setText("storageCacheSize", "не поддерживается");
        setText("storageQuota", "—");
      }
    } catch (e) {
      setText("storageCacheSize", "—");
      setText("storageQuota", "—");
    }

    try {
      let total = 0;
      for (const k in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
          total += (k.length + (localStorage[k] || "").length) * 2;
        }
      }
      setText("storageLocalSize", formatBytes(total));
    } catch (e) {
      setText("storageLocalSize", "—");
    }
  }

  /* ---------- Очистка ---------- */
  const btnClearCache = document.getElementById("btnClearCache");
  if (btnClearCache) {
    btnClearCache.addEventListener("click", async () => {
      const ok = await S.showConfirm("Очистить кэш приложения? Это не удалит ваши сообщения.", "Очистка");
      if (!ok) return;
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        const keep = ["sqwid_theme", "sqwid_lang"];
        const saved = {};
        keep.forEach(k => { saved[k] = localStorage.getItem(k); });
        localStorage.clear();
        keep.forEach(k => { if (saved[k] !== null) localStorage.setItem(k, saved[k]); });
        S.showToast("Кэш очищен", "ok");
        setTimeout(updateStorageInfo, 300);
      } catch (e) {
        S.showToast("Ошибка: " + e.message, "error");
      }
    });
  }

  const btnClearMedia = document.getElementById("btnClearMedia");
  if (btnClearMedia) {
    btnClearMedia.addEventListener("click", async () => {
      const ok = await S.showConfirm("Очистить кэш фото?", "Очистка медиа");
      if (!ok) return;
      try {
        if (window.caches) {
          const keys = await caches.keys();
          const mediaKeys = keys.filter(k => k.includes("media") || k.includes("image"));
          await Promise.all(mediaKeys.map(k => caches.delete(k)));
        }
        S.showToast("Кэш фото очищен", "ok");
        setTimeout(updateStorageInfo, 300);
      } catch (e) {
        S.showToast("Ошибка: " + e.message, "error");
      }
    });
  }

  const btnResetAll = document.getElementById("btnResetAll");
  if (btnResetAll) {
    btnResetAll.addEventListener("click", async () => {
      const ok = await S.showConfirm("Сбросить ВСЕ настройки и выйти?", "Сброс");
      if (!ok) return;
      try {
        localStorage.clear();
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (e) {}
      try { if (S.signOut) await S.signOut(S.auth); } catch (e) {}
      window.location.href = "index.html";
    });
  }

  /* ============================================================
     ПОДДЕРЖКА
     ============================================================ */
  const btnCopySupportEmail = document.getElementById("btnCopySupportEmail");
  if (btnCopySupportEmail) {
    btnCopySupportEmail.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("sqwid.support@gmail.com");
        S.showToast("Email скопирован", "ok");
      } catch (e) {
        S.showAlert("Email поддержки:\nsqwid.support@gmail.com", "Поддержка");
      }
    });
  }

  /* ============================================================
     СКВИДИКИ — кнопки внутри подэкрана
     ============================================================ */
  const coinsOpenShop = document.getElementById("coinsOpenShop");
  if (coinsOpenShop) {
    coinsOpenShop.addEventListener("click", () => {
      if (window.Sqwid.openShop) window.Sqwid.openShop();
    });
  }
  const coinsOpenGames = document.getElementById("coinsOpenGames");
  if (coinsOpenGames) {
    coinsOpenGames.addEventListener("click", () => {
      if (window.Sqwid.openGames) window.Sqwid.openGames();
    });
  }

  /* ============================================================
     РАЗВЛЕЧЕНИЯ — кнопки внутри подэкрана
     ============================================================ */
  const funOpenShop = document.getElementById("funOpenShop");
  if (funOpenShop) funOpenShop.addEventListener("click", () => {
    if (window.Sqwid.openShop) window.Sqwid.openShop();
  });
  const funOpenPremium = document.getElementById("funOpenPremium");
  if (funOpenPremium) funOpenPremium.addEventListener("click", () => {
    if (window.Sqwid.openTopUp) window.Sqwid.openTopUp();
  });
  const funOpenGames = document.getElementById("funOpenGames");
  if (funOpenGames) funOpenGames.addEventListener("click", () => {
    if (window.Sqwid.openGames) window.Sqwid.openGames();
  });
  const funOpenQr = document.getElementById("funOpenQr");
  if (funOpenQr) funOpenQr.addEventListener("click", () => {
    if (window.Sqwid.openQr) window.Sqwid.openQr();
  });

  /* ============================================================
     НАВИГАЦИЯ ПО РАЗДЕЛАМ (делегирование — работает всегда)
     ============================================================ */
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".settings-item[data-open]");
    if (item) {
      const target = item.dataset.open;
      if (window.Sqwid && window.Sqwid.showScreen) {
        window.Sqwid.showScreen(target);
        if (target === "screen-settings-storage") updateStorageInfo();
        if (target === "screen-settings-notify") updateNotifyInfo();
        if (target === "screen-settings-plus") updatePlusInfo();
        if (target === "screen-settings-lang") renderLangPicker();
        if (target === "screen-settings-chats") renderBgPicker();
        if (target === "screen-settings-folders") renderFoldersPicker();
        if (target === "screen-settings-account") renderSettings();
        if (target === "screen-settings-coins") updateCoinsInfo();
      }
      return;
    }

    const back = e.target.closest(".settings-back-btn");
    if (back) {
      if (window.Sqwid && window.Sqwid.showScreen) {
        window.Sqwid.showScreen("screen-settings");
      }
    }
  });

  /* ============================================================
     ОБНОВИТЬ ПОДПИСИ ПРИ СТАРТЕ
     ============================================================ */
  updateAccountSub();
  updateLangSub();
  updatePlusSub();
  updateSecuritySub();
  updateCoinsInfo();

  /* Периодически обновляем подписи на случай изменений */
  setInterval(() => {
    if (document.getElementById("screen-settings")?.classList.contains("active")) {
      updateAccountSub();
      updateLangSub();
      updatePlusSub();
      updateSecuritySub();
      updateCoinsInfo();
    }
  }, 3000);

  console.log("✅ chat-settings.js готов");
});