/* ============================================================
   chat-settings.js — настройки (профиль, приватность, PIN, аккаунт)
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

  /* ---------- загрузка данных ---------- */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    const screen = document.getElementById("screen-settings");
    if (screen && screen.classList.contains("active")) renderSettings();
  });

  /* ---------- открытие настроек ---------- */
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

  /* ---------- рендер ---------- */
  function renderSettings() {
    const name = myData.name || currentUser.email.split("@")[0];

    const photoEl = document.getElementById("settingsPhoto");
    if (photoEl) {
      if (avatarBase64) photoEl.src = avatarBase64;
      else if (myData.photo && myData.photo.startsWith("data:image")) photoEl.src = myData.photo;
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
        pinStatus.style.color = "#00a884";
      } else {
        pinStatus.textContent = "🔓 Не установлен";
        pinStatus.style.color = "#8696a0";
      }
    }

    const balEl = document.getElementById("settingsBalance");
    if (balEl) balEl.textContent = "🪙 " + (myData.coins || 0) + " SQ";
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
  function setCheck(id, v) {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  }

  /* ---------- аватар ---------- */
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

  /* ---------- сохранение профиля ---------- */
  const btnSave = document.getElementById("settingsSaveProfile");
  if (btnSave) btnSave.addEventListener("click", async () => {
    const name = (document.getElementById("settingsName").value || "").trim();
    const usernameRaw = (document.getElementById("settingsUsername").value || "").trim().toLowerCase();
    const bio = (document.getElementById("settingsBio").value || "").trim();

    if (!name) return S.showAlert("Введите имя", "Ошибка");
    if (name.length > 30) return S.showAlert("Имя до 30 символов", "Ошибка");
    if (bio.length > 120) return S.showAlert("Bio до 120 символов", "Ошибка");

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

  /* ---------- приватность ---------- */
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

  /* ---------- PIN ---------- */
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

  /* ---------- аккаунт ---------- */
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

  /* ---------- prompt (модалка) ---------- */
  function askPrompt(text, placeholder) {
    return S.showPrompt(text, placeholder, "");
  }

  console.log("✅ chat-settings.js готов");
});