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
const screenLogin = document.getElementById("screen-login");
const screenRegister = document.getElementById("screen-register");

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/* ---------- ЭЛЕМЕНТЫ ЭКРАНА ВХОДА ---------- */
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const btnGoRegister = document.getElementById("btnGoRegister");

/* ---------- ЭЛЕМЕНТЫ ЭКРАНА РЕГИСТРАЦИИ ---------- */
const regAvatarInput = document.getElementById("regAvatarInput");
const regAvatarPreview = document.getElementById("regAvatarPreview");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regName = document.getElementById("regName");
const btnContinue = document.getElementById("btnContinue");
const regStatus = document.getElementById("regStatus");
const btnTogglePass = document.getElementById("btnTogglePass");

let regAvatarBase64 = null;

/* ---------- АВТОРИЗАЦИЯ (если уже вошёл — кидаем в чат) ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "chat.html";
});

/* ---------- ПЕРЕХОД В РЕГИСТРАЦИЮ ---------- */
btnGoRegister.addEventListener("click", () => {
  // переносим email, если он уже введён на входе
  if (loginEmail.value.trim()) {
    regEmail.value = loginEmail.value.trim();
  }
  regStatus.textContent = "";
  showScreen("screen-register");
});

/* ---------- ЗАГРУЗКА АВАТАРА ---------- */
regAvatarInput.addEventListener("change", () => {
  const file = regAvatarInput.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    regStatus.textContent = "Фото до 500 КБ";
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

/* ---------- ПОКАЗ / СКРЫТИЕ ПАРОЛЯ ---------- */
btnTogglePass.addEventListener("click", () => {
  const isPass = regPassword.type === "password";
  regPassword.type = isPass ? "text" : "password";
  btnTogglePass.classList.toggle("active", isPass);
});

/* ---------- ВХОД ---------- */
async function login() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    alert("Заполните email и пароль");
    return;
  }
  btnLogin.textContent = "...";
  btnLogin.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "chat.html";
  } catch (err) {
    alert(translateError(err.code));
    btnLogin.textContent = "ВОЙТИ";
    btnLogin.disabled = false;
  }
}
btnLogin.addEventListener("click", login);
loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") loginPassword.focus(); });
loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });

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
    regStatus.textContent = translateError(err.code);
    btnContinue.textContent = "ПРОДОЛЖИТЬ";
    btnContinue.disabled = false;
  }
}
btnContinue.addEventListener("click", register);

regEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") regPassword.focus(); });
regPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") regName.focus(); });
regName.addEventListener("keydown", (e) => { if (e.key === "Enter") register(); });

/* ---------- ПЕРЕВОД ОШИБОК ---------- */
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

console.log("index.js (новый дизайн) загружен");