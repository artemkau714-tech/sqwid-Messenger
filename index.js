import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBH4xNY0vcuM_NsGCGnRYEM_beGoQtZ_N0",
  authDomain: "sqwid-messenger.firebaseapp.com",
  databaseURL: "https://sqwid-messenger-default-rtdb.firebaseio.com",
  projectId: "sqwid-messenger",
  storageBucket: "sqwid-messenger.firebasestorage.app",
  messagingSenderId: "943129718217",
  appId: "1:943129718217:web:9e156626c721480a9c0c18"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById("sqwidSplash");
  if (!splash) return;
  splash.classList.add("hidden");
  setTimeout(() => {
    if (splash.parentNode) splash.parentNode.removeChild(splash);
  }, 500);
}

let toastTimer = null;
function showToast(text, type = "info", duration = 3000) {
  let el = document.getElementById("toastEl");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastEl";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.className = "toast toast-" + type;
  void el.offsetWidth;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const btnGoRegister = document.getElementById("btnGoRegister");
const btnForgotPassword = document.getElementById("btnForgotPassword");

const regAvatarInput = document.getElementById("regAvatarInput");
const regAvatarPreview = document.getElementById("regAvatarPreview");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regName = document.getElementById("regName");
const btnContinue = document.getElementById("btnContinue");
const regStatus = document.getElementById("regStatus");
const btnTogglePass = document.getElementById("btnTogglePass");
const btnBackToLogin = document.getElementById("btnBackToLogin");
const regAgreeCheckbox = document.getElementById("regAgreeCheckbox");

let regAvatarBase64 = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    const splash = document.getElementById("sqwidSplash");
    if (splash) splash.classList.remove("hidden");
    window.location.href = "chat.html";
  } else {
    hideSplash();
  }
});

setTimeout(() => hideSplash(), 8000);

if (btnGoRegister) {
  btnGoRegister.addEventListener("click", () => {
    if (loginEmail.value.trim()) regEmail.value = loginEmail.value.trim();
    if (regStatus) regStatus.textContent = "";
    showScreen("screen-register");
  });
}

if (btnBackToLogin) {
  btnBackToLogin.addEventListener("click", () => {
    if (regStatus) regStatus.textContent = "";
    showScreen("screen-login");
  });
}

if (regAvatarInput) {
  regAvatarInput.addEventListener("change", () => {
    const file = regAvatarInput.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showToast("Фото до 500 КБ", "warn"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      regAvatarBase64 = e.target.result;
      regAvatarPreview.style.backgroundImage = `url(${regAvatarBase64})`;
      regAvatarPreview.classList.add("has-photo");
    };
    reader.readAsDataURL(file);
  });
}

if (btnTogglePass) {
  btnTogglePass.addEventListener("click", () => {
    const isPass = regPassword.type === "password";
    regPassword.type = isPass ? "text" : "password";
    btnTogglePass.classList.toggle("active", isPass);
  });
}

async function login() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) { showToast("Заполните email и пароль", "warn"); return; }
  btnLogin.textContent = "...";
  btnLogin.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "chat.html";
  } catch (err) {
    showToast(translateError(err.code), "error", 4000);
    btnLogin.textContent = "ВОЙТИ";
    btnLogin.disabled = false;
  }
}
if (btnLogin) btnLogin.addEventListener("click", login);
if (loginEmail) loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") loginPassword.focus(); });
if (loginPassword) loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });

if (btnForgotPassword) {
  btnForgotPassword.addEventListener("click", async () => {
    const email = (loginEmail.value || "").trim();
    if (!email) { showToast("Введите email, чтобы сбросить пароль", "warn"); loginEmail.focus(); return; }
    try {
      btnForgotPassword.textContent = "Отправляем...";
      btnForgotPassword.disabled = true;
      await sendPasswordResetEmail(auth, email);
      showToast("Письмо отправлено на " + email + ". Проверьте почту", "ok", 4500);
    } catch (err) {
      showToast(translateError(err.code), "error", 4000);
    } finally {
      btnForgotPassword.textContent = "Забыли пароль?";
      btnForgotPassword.disabled = false;
    }
  });
}

async function register() {
  const email = regEmail.value.trim();
  const password = regPassword.value;
  const name = regName.value.trim();

  if (regAgreeCheckbox && !regAgreeCheckbox.checked) {
    regStatus.textContent = "Необходимо принять соглашение";
    showToast("Пожалуйста, примите пользовательское соглашение", "warn");
    return;
  }
  if (!email) { regStatus.textContent = "Введите email"; return; }
  if (!password || password.length < 6) { regStatus.textContent = "Пароль минимум 6 символов"; return; }
  if (!name) { regStatus.textContent = "Введите имя"; return; }

  btnContinue.textContent = "...";
  btnContinue.disabled = true;
  regStatus.textContent = "Регистрируем...";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn("Не удалось отправить письмо:", e);
    }

    await set(ref(db, "users/" + cred.user.uid), {
      email: email,
      name: name,
      photo: regAvatarBase64 || null,
      hideEmail: false,
      createdAt: Date.now()
    });

    regStatus.textContent = "Успех! Проверьте почту и войдите.";
    showToast("Письмо отправлено на " + email, "ok", 5000);

    setTimeout(() => {
      window.location.href = "chat.html";
    }, 2000);

  } catch (err) {
    const msg = translateError(err.code);
    regStatus.textContent = msg;
    showToast(msg, "error", 4000);
    btnContinue.textContent = "ПРОДОЛЖИТЬ";
    btnContinue.disabled = false;
  }
}
if (btnContinue) btnContinue.addEventListener("click", register);

if (regEmail) regEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") regPassword.focus(); });
if (regPassword) regPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") regName.focus(); });
if (regName) regName.addEventListener("keydown", (e) => { if (e.key === "Enter") register(); });

function translateError(code) {
  const map = {
    "auth/invalid-email": "Неверный формат email",
    "auth/user-not-found": "Пользователь не найден",
    "auth/wrong-password": "Неверный пароль",
    "auth/invalid-credential": "Неверный email или пароль",
    "auth/email-already-in-use": "Этот email уже зарегистрирован",
    "auth/weak-password": "Пароль слишком короткий",
    "auth/too-many-requests": "Слишком много попыток. Подождите",
    "auth/network-request-failed": "Нет интернета",
    "auth/operation-not-allowed": "Вход по email выключен"
  };
  return map[code] || ("Ошибка: " + code);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("SW failed:", err));
  });
}

/* ============================================================
   ВХОД ПО QR
   ============================================================ */
const btnQrLogin = document.getElementById("btnQrLogin");

async function loginWithQr(phone, pass) {
  try {
    const snap = await get(ref(db, "sqwid_accounts/" + phone));
    if (!snap.exists()) return showToast("Аккаунт не найден", "error");

    const acc = snap.val();
    if (acc.password !== pass) return showToast("Неверный пароль", "error");

    // Если аккаунт уже создан в Firebase Auth — входим
    if (acc.uid) {
      try {
        await signInWithEmailAndPassword(auth, acc.email, acc.firebasePass);
        window.location.href = "chat.html";
        return;
      } catch (e) {
        // fallthrough — попробуем создать
      }
    }

    // Создаём Firebase-пользователя (первый вход по этому QR)
    try {
      const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.firebasePass);
      await update(ref(db, "sqwid_accounts/" + phone), { uid: cred.user.uid });
      await set(ref(db, "users/" + cred.user.uid), {
        name: "Пользователь",
        email: acc.email,
        phone: phone,
        createdAt: Date.now()
      });
      window.location.href = "chat.html";
    } catch (e) {
      showToast("Ошибка входа по QR: " + (e.code || e.message), "error");
    }
  } catch (e) {
    showToast("Ошибка входа по QR: " + (e.code || e.message), "error");
  }
}

// Экспортируем для qr-scanner.js (обычный скрипт)
window.loginWithQr = loginWithQr;

if (btnQrLogin) {
  btnQrLogin.addEventListener("click", () => {
    if (window.Sqwid && typeof window.Sqwid.openQrScanner === "function") {
      window.Sqwid.openQrScanner((text) => {
        try {
          const data = JSON.parse(text);
          if (data.phone && data.pass) {
            loginWithQr(data.phone, data.pass);
          } else {
            showToast("Неверный формат QR", "error");
          }
        } catch (e) {
          showToast("Ошибка чтения QR", "error");
        }
      });
    } else {
      showToast("Сканер ещё не загружен. Обновите страницу.", "warn");
    }
  });
}

console.log("✅ index.js загружен");