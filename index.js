import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set
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

/* ---------- Переключение экранов ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/* ---------- Toast ---------- */
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

/* ---------- Элементы входа ---------- */
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const btnGoRegister = document.getElementById("btnGoRegister");
const btnForgotPassword = document.getElementById("btnForgotPassword");

/* ---------- Элементы регистрации ---------- */
const regAvatarInput = document.getElementById("regAvatarInput");
const regAvatarPreview = document.getElementById("regAvatarPreview");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regName = document.getElementById("regName");
const btnContinue = document.getElementById("btnContinue");
const regStatus = document.getElementById("regStatus");
const btnTogglePass = document.getElementById("btnTogglePass");
const btnBackToLogin = document.getElementById("btnBackToLogin");

let regAvatarBase64 = null;

/* ---------- Авторизация ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "chat.html";
});

/* ---------- Переход в регистрацию ---------- */
if (btnGoRegister) {
  btnGoRegister.addEventListener("click", () => {
    if (loginEmail.value.trim()) {
      regEmail.value = loginEmail.value.trim();
    }
    if (regStatus) regStatus.textContent = "";
    showScreen("screen-register");
  });
}

/* ---------- Назад на вход ---------- */
if (btnBackToLogin) {
  btnBackToLogin.addEventListener("click", () => {
    if (regStatus) regStatus.textContent = "";
    showScreen("screen-login");
  });
}

/* ---------- Загрузка аватара ---------- */
if (regAvatarInput) {
  regAvatarInput.addEventListener("change", () => {
    const file = regAvatarInput.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast("Фото до 500 КБ", "warn");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      regAvatarBase64 = e.target.result;
      regAvatarPreview.style.backgroundImage = `url(${regAvatarBase64})`;
      regAvatarPreview.classList.add("has-photo");
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Показать/скрыть пароль ---------- */
if (btnTogglePass) {
  btnTogglePass.addEventListener("click", () => {
    const isPass = regPassword.type === "password";
    regPassword.type = isPass ? "text" : "password";
    btnTogglePass.classList.toggle("active", isPass);
  });
}

/* ---------- ВХОД ---------- */
async function login() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    showToast("Заполните email и пароль", "warn");
    return;
  }
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

/* ---------- ЗАБЫЛИ ПАРОЛЬ ---------- */
if (btnForgotPassword) {
  btnForgotPassword.addEventListener("click", async () => {
    const email = (loginEmail.value || "").trim();
    if (!email) {
      showToast("Введите email, чтобы сбросить пароль", "warn");
      loginEmail.focus();
      return;
    }
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

/* ---------- РЕГИСТРАЦИЯ ---------- */
async function register() {
  const email = regEmail.value.trim();
  const password = regPassword.value;
  const name = regName.value.trim();

  if (!email) { regStatus.textContent = "Введите email"; return; }
  if (!password || password.length < 6) { regStatus.textContent = "Пароль минимум 6 символов"; return; }
  if (!name) { regStatus.textContent = "Введите имя"; return; }

  btnContinue.textContent = "...";
  btnContinue.disabled = true;
  regStatus.textContent = "Регистрируем...";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, "users/" + cred.user.uid), {
      email: email,
      name: name,
      photo: regAvatarBase64 || null,
      hideEmail: false,
      createdAt: Date.now()
    });
    regStatus.textContent = "Готово! Заходим...";
    // onAuthStateChanged перекинет в chat.html
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

/* ---------- Перевод ошибок ---------- */
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

console.log("index.js загружен");