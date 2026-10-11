/* ============================================================
   twofa.js — TOTP 2FA (RFC 6238)
   ============================================================ */

console.log("🚀 twofa.js загружен, жду Sqwid...");

function waitForSqwid2FA(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ twofa.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwid2FA((S) => {
  const { db, ref, get, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 twofa.js активирован");

  let pendingSecret = null;

  /* ============================================================
     BASE32
     ============================================================ */
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function base32Encode(bytes) {
    let bits = 0, value = 0, out = "";
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += B32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }

  function base32Decode(str) {
    str = (str || "").toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
    let bits = 0, value = 0;
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const idx = B32.indexOf(str[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }

  /* ============================================================
     TOTP
     ============================================================ */
  async function generateTOTP(secretB32, timeStep = 30, digits = 6) {
    const key = base32Decode(secretB32);
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, 0);
    view.setUint32(4, counter);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));

    const offset = sig[sig.length - 1] & 0x0f;
    const code = (
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff)
    ) % Math.pow(10, digits);
    return String(code).padStart(digits, "0");
  }

  async function verifyTOTP(secret, code) {
    // Проверяем текущий и ±1 шаг (окно 90 сек)
    const timeStep = 30;
    const now = Math.floor(Date.now() / 1000 / timeStep);
    for (let i = -1; i <= 1; i++) {
      const testCounter = now + i;
      const key = base32Decode(secret);
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      view.setUint32(0, 0);
      view.setUint32(4, testCounter);
      const cryptoKey = await crypto.subtle.importKey(
        "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
      );
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
      const offset = sig[sig.length - 1] & 0x0f;
      const c = (
        ((sig[offset] & 0x7f) << 24) |
        ((sig[offset + 1] & 0xff) << 16) |
        ((sig[offset + 2] & 0xff) << 8) |
        (sig[offset + 3] & 0xff)
      ) % 1000000;
      if (String(c).padStart(6, "0") === code) return true;
    }
    return false;
  }

  /* ============================================================
     СЕКРЕТ + QR
     ============================================================ */
  function generateSecret() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
  }

  function otpauthURL(secret, email) {
    const label = encodeURIComponent("Sqwid:" + email);
    const params = new URLSearchParams({
      secret: secret,
      issuer: "Sqwid",
      algorithm: "SHA1",
      digits: "6",
      period: "30"
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  function renderQR(container, text) {
    container.innerHTML = "";
    // Простая QR-генерация через Google Chart API (не требует библиотек)
    const img = document.createElement("img");
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(text);
    img.alt = "QR";
    img.style.width = "200px";
    img.style.height = "200px";
    container.appendChild(img);
  }

  /* ============================================================
     UI
     ============================================================ */
  const statusEl = document.getElementById("settings2FAStatus");
  const btnSetup = document.getElementById("btn2FASetup");
  const btnDisable = document.getElementById("btn2FADisable");
  const modal = document.getElementById("modal-2fa");
  const qrBox = document.getElementById("twoFAQr");
  const btnVerify = document.getElementById("btn2FAVerify");
  const btnCancel = document.getElementById("btn2FACancel");

  let myTwoFA = null;

  onValue(ref(db, "users/" + currentUser.uid + "/twoFA"), (snap) => {
    myTwoFA = snap.val();
    refreshUI();
  });

  function refreshUI() {
    const enabled = myTwoFA && myTwoFA.enabled === true;
    if (statusEl) {
      statusEl.textContent = enabled ? "🔒 Включена" : "Не включена";
      statusEl.style.color = enabled ? "#10b981" : "#94a3b8";
    }
    if (btnSetup) btnSetup.style.display = enabled ? "none" : "block";
    if (btnDisable) btnDisable.style.display = enabled ? "block" : "none";
  }

  if (btnSetup) {
    btnSetup.addEventListener("click", () => {
      pendingSecret = generateSecret();
      const url = otpauthURL(pendingSecret, currentUser.email);
      renderQR(qrBox, url);
      // Очищаем поля
      for (let i = 1; i <= 6; i++) {
        const inp = document.getElementById("twofa" + i);
        if (inp) inp.value = "";
      }
      modal.classList.add("active");
      setTimeout(() => document.getElementById("twofa1")?.focus(), 100);
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      modal.classList.remove("active");
      pendingSecret = null;
    });
  }

  // Автотаб между полями
  for (let i = 1; i <= 6; i++) {
    const inp = document.getElementById("twofa" + i);
    if (!inp) continue;
    inp.addEventListener("input", () => {
      if (inp.value && i < 6) document.getElementById("twofa" + (i + 1))?.focus();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && i > 1) {
        document.getElementById("twofa" + (i - 1))?.focus();
      }
    });
  }

  if (btnVerify) {
    btnVerify.addEventListener("click", async () => {
      if (!pendingSecret) return;
      let code = "";
      for (let i = 1; i <= 6; i++) code += document.getElementById("twofa" + i)?.value || "";
      if (code.length !== 6) { S.showToast("Введите 6 цифр", "error"); return; }

      const ok = await verifyTOTP(pendingSecret, code);
      if (!ok) { S.showToast("Неверный код", "error"); return; }

      await update(ref(db, "users/" + currentUser.uid + "/twoFA"), {
        enabled: true,
        secret: pendingSecret,
        createdAt: Date.now()
      });
      modal.classList.remove("active");
      pendingSecret = null;
      S.showToast("2FA включена", "ok");
    });
  }

  if (btnDisable) {
    btnDisable.addEventListener("click", async () => {
      const ok = await S.showConfirm("Отключить 2FA?", "Безопасность");
      if (!ok) return;
      await update(ref(db, "users/" + currentUser.uid), { twoFA: null });
      S.showToast("2FA отключена", "ok");
    });
  }

  /* ============================================================
     ЭКСПОРТ ДЛЯ ПРОВЕРКИ ПРИ ВХОДЕ
     ============================================================ */
  window.Sqwid.verify2FA = verifyTOTP;
  window.Sqwid.has2FA = () => myTwoFA && myTwoFA.enabled === true;

  console.log("✅ twofa.js готов");
});