/* ============================================================
   moderation.js — бан / мут / заморозка
   ============================================================ */

console.log("🚀 moderation.js загружен, жду Sqwid...");

function waitForSqwidModeration(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ moderation.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidModeration((S) => {
  const { db, ref, get, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 moderation.js активирован");

  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    const me = snap.val() || {};
    window._currentUserData = me;
    applyMyStatus(me);
  });

  function applyMyStatus(me) {
    if (me.banned === true) showBannedScreen();
    else hideBannedScreen();

    const inputArea = document.getElementById("inputArea");
    if (inputArea) {
      if (me.muted === true) applyMuteOverlay();
      else removeMuteOverlay();
    }
  }

  function showBannedScreen() {
    const banned = document.getElementById("screen-banned");
    if (!banned) return;
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    banned.classList.add("active");
    const nav = document.getElementById("bottomNav");
    if (nav) nav.style.display = "none";
  }

  function hideBannedScreen() {
    const banned = document.getElementById("screen-banned");
    if (banned && banned.classList.contains("active")) {
      if (S.showScreen) S.showScreen("screen-chats");
    }
  }

  const btnLogout = document.getElementById("btnBannedLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try { localStorage.removeItem("sqwid_pin_ok_" + currentUser.uid); } catch (e) {}
      if (S.signOut) await S.signOut(S.auth);
      window.location.href = "index.html";
    });
  }

  function applyMuteOverlay() {
    const inputArea = document.getElementById("inputArea");
    if (!inputArea) return;
    inputArea.classList.add("muted");

    const old = inputArea.querySelector(".mute-overlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.className = "mute-overlay";
    overlay.innerHTML = `
      <div class="mute-overlay-icon">🔇</div>
      <div class="mute-overlay-text">НА ВАС МУТ!!!</div>
      <div class="mute-overlay-sub">Вы не можете отправлять сообщения</div>
    `;
    inputArea.appendChild(overlay);
  }

  function removeMuteOverlay() {
    const inputArea = document.getElementById("inputArea");
    if (!inputArea) return;
    inputArea.classList.remove("muted");
    const overlay = inputArea.querySelector(".mute-overlay");
    if (overlay) overlay.remove();
  }

  console.log("✅ moderation.js готов");
});