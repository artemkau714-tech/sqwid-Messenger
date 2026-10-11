/* ============================================================
   qr-profile.js — QR-код профиля
   ============================================================ */

console.log("🚀 qr-profile.js загружен, жду Sqwid...");

function waitForSqwidQr(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ qr-profile.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidQr((S) => {
  const { db, ref, get, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 qr-profile.js активирован");

  let myData = {};
  let unsubSelf = null;

  /* ============================================================
     ПОДПИСКА НА СЕБЯ
     ============================================================ */
  if (unsubSelf) unsubSelf();
  unsubSelf = onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    const screen = document.getElementById("screen-qr");
    if (screen && screen.classList.contains("active")) renderQr();
  });

  /* ============================================================
     ПОЛУЧЕНИЕ ССЫЛКИ
     ============================================================ */
  function getProfileLink() {
    const base = window.location.origin + window.location.pathname.replace("chat.html", "");
    if (myData.username) return base + "chat.html?u=" + myData.username;
    return base + "chat.html?uid=" + currentUser.uid;
  }

  /* ============================================================
     QR-ГЕНЕРАЦИЯ (через api.qrserver.com)
     ============================================================ */
  function generateQR(text) {
    const size = 240;
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&data=" + encodeURIComponent(text) + "&margin=6";
  }

  /* ============================================================
     ОТКРЫТИЕ ЭКРАНА
     ============================================================ */
  function openQr() {
    renderQr();
    S.showScreen("screen-qr");
  }
  window.Sqwid.openQr = openQr;

  const btnOpenQr = document.getElementById("btnOpenQr");
  if (btnOpenQr) btnOpenQr.addEventListener("click", openQr);

  const btnBackQr = document.getElementById("btnBackQr");
  if (btnBackQr) btnBackQr.addEventListener("click", () => S.showScreen("screen-profile"));

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function renderQr() {
    const canvas = document.getElementById("qrCanvas");
    const nameEl = document.getElementById("qrName");
    const unEl = document.getElementById("qrUsername");

    const name = myData.name || currentUser.email?.split("@")[0] || "Пользователь";
    if (nameEl) nameEl.textContent = name;
    if (unEl) unEl.textContent = myData.username ? "@" + myData.username : "";

    if (canvas) {
      const link = getProfileLink();
      const qrUrl = generateQR(link);
      canvas.innerHTML = `<img src="${qrUrl}" width="240" height="240" alt="QR" style="display:block;border-radius:12px;">`;
    }
  }

  /* ============================================================
     КОПИРОВАТЬ ССЫЛКУ
     ============================================================ */
  const btnCopy = document.getElementById("btnCopyQrLink");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const link = getProfileLink();
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(link);
          S.showToast("Ссылка скопирована", "ok");
        } else {
          S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
        }
      } catch (e) {
        S.showAlert("Скопируй вручную:\n" + link, "Ссылка");
      }
    });
  }

  /* ============================================================
     ОБРАБОТКА ПАРАМЕТРОВ URL (?u=username | ?uid=uid)
     ============================================================ */
  const urlParams = new URLSearchParams(window.location.search);
  const targetUsername = urlParams.get("u");
  const targetUid = urlParams.get("uid");

  if (targetUsername || targetUid) {
    setTimeout(async () => {
      try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val() || {};
        let foundUid = null;

        if (targetUid && users[targetUid]) {
          foundUid = targetUid;
        } else if (targetUsername) {
          for (const uid in users) {
            if (users[uid].username && users[uid].username.toLowerCase() === targetUsername.toLowerCase()) {
              foundUid = uid;
              break;
            }
          }
        }

        if (foundUid && window.Sqwid.openOtherProfile) {
          window.Sqwid.openOtherProfile(foundUid);
        } else if (foundUid === currentUser.uid) {
          S.showScreen("screen-profile");
        } else {
          S.showToast("Пользователь не найден", "error");
        }
      } catch (e) {}

      // Чистим URL, чтобы при перезагрузке не срабатывало снова
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", clean);
    }, 2000);
  }

  console.log("✅ qr-profile.js готов");
});