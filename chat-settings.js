/* ============================================================
   chat-settings.js — настройки
   Профиль, приватность, PIN, аккаунт, ТЕМА (светлая/тёмная/девчачья),
   Sqwid+ (фон + соцсети), валидация URL
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
     ТЕМА — applyTheme
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

    // Обновить состояние кнопок темы
    let cur = "light";
    try { cur = localStorage.getItem("sqwid_theme") || "light"; } catch (e) {}
    const light = document.getElementById("themeLight");
    const dark = document.getElementById("themeDark");
    const girl = document.getElementById("themeGirl");
    if (light) light.classList.toggle("active", cur !== "dark" && cur !== "girl");
    if (dark) dark.classList.toggle("active", cur === "dark");
    if (girl) girl.classList.toggle("active", cur === "girl");

    // Sqwid+ секция
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
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
  function setCheck(id, v) {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  }

  /* ============================================================
     ТЕМА — обработчики кнопок
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

      // Валидация ссылок
      const telegram = sanitizeUrl(rawTg);
      const instagram = sanitizeUrl(rawIg);
      const youtube = sanitizeUrl(rawYt);

      if (rawTg && !telegram) {
        return S.showAlert("Telegram: ссылка должна начинаться с http:// или https://", "Ошибка");
      }
      if (rawIg && !instagram) {
        return S.showAlert("Instagram: ссылка должна начинаться с http:// или https://", "Ошибка");
      }
      if (rawYt && !youtube) {
        return S.showAlert("YouTube: ссылка должна начинаться с http:// или https://", "Ошибка");
      }

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
      S.showAlert("Письмо отправлено на " + newEmail + "\n\nОткройте ссылку в письме.", "Готово");
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

  console.log("✅ chat-settings.js готов");
});