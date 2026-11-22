/* ============================================================
   admin-panel.js — Админ-панель (Товары + QR-Аккаунты)
   ============================================================ */

console.log("🚀 admin-panel.js загружен");

function waitForAdmin(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
    }
  }, 200);
}

waitForAdmin((S) => {
  const { db, ref, get, set, remove, push, onValue, currentUser } = S;
  
  // 🔥 ДОСТУП ТОЛЬКО ДЛЯ ТЕБЯ
  if (currentUser.email !== "artemkau714@gmail.com") return;

  console.log("🔥 admin-panel.js активирован");

  const modal = document.getElementById("modal-admin-panel");
  const searchInput = document.getElementById("searchInput");

  // 1. ТРИГГЕР ВХОДА (ввод *1234# в поиск)
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      if (e.target.value === "*1234#") {
        e.target.value = "";
        modal.classList.add("active");
        loadAdminStats();
        renderAdminProducts();
        renderAccounts();
      }
    });
  }

  document.getElementById("btnCloseAdminPanel").onclick = () => modal.classList.remove("active");

  // 2. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
  const tabs = {
    products: { btn: document.getElementById("apTabProducts"), pane: document.getElementById("apProductsPane") },
    stats: { btn: document.getElementById("apTabStats"), pane: document.getElementById("apStatsPane") },
    accounts: { btn: document.getElementById("apTabAccounts"), pane: document.getElementById("apAccountsPane") }
  };

  function switchTab(activeKey) {
    for (const key in tabs) {
      const isActive = key === activeKey;
      tabs[key].btn.className = isActive ? "btn-create" : "btn-secondary";
      tabs[key].btn.style.background = isActive ? "var(--accent)" : "";
      tabs[key].pane.style.display = isActive ? "block" : "none";
    }
    if (activeKey === "stats") loadAdminStats();
    if (activeKey === "products") renderAdminProducts();
    if (activeKey === "accounts") renderAccounts();
  }

  tabs.products.btn.onclick = () => switchTab("products");
  tabs.stats.btn.onclick = () => switchTab("stats");
  tabs.accounts.btn.onclick = () => switchTab("accounts");

  // 3. СТАТИСТИКА
  function loadAdminStats() {
    onValue(ref(db, "users"), (snap) => {
      const users = snap.val() || {};
      const now = Date.now();
      let online = 0;
      for (const uid in users) {
        if (users[uid].lastSeen && now - users[uid].lastSeen < 120000) online++;
      }
      document.getElementById("apOnlineCount").textContent = online;
      document.getElementById("apTotalUsers").textContent = Object.keys(users).length;
    });
  }

  // 4. СПИСОК ТОВАРОВ (из shop/custom_items)
  function renderAdminProducts() {
    const box = document.getElementById("apProductsList");
    if (!box) return;
    box.innerHTML = "Загрузка...";
    
    onValue(ref(db, "shop/custom_items"), (snap) => {
      const items = snap.val() || {};
      box.innerHTML = "";
      if (Object.keys(items).length === 0) {
        box.innerHTML = "<div style='text-align:center;color:#888;padding:1rem;'>Товаров нет</div>";
        return;
      }
      for (const id in items) {
        const item = items[id];
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:0.5rem; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:10px;";
        row.innerHTML = `
          <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;background:#222;display:flex;align-items:center;justify-content:center;">
            ${item.icon ? `<img src="${item.icon}" style="width:100%;height:100%;object-fit:cover;">` : "?"}
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.9rem;">${item.name}</div>
            <div style="font-size:0.75rem;color:#f59e0b;">${item.price} SQ · ${item.type}</div>
          </div>
          <button style="background:#ef4444;border:none;color:#fff;padding:0.4rem 0.6rem;border-radius:8px;font-size:0.75rem;font-weight:800;" data-del="${id}">Удалить</button>
        `;
        row.querySelector("[data-del]").onclick = async () => {
          if (confirm("Удалить товар?")) await remove(ref(db, "shop/custom_items/" + id));
        };
        box.appendChild(row);
      }
    });
  }

  // 5. ДОБАВЛЕНИЕ ТОВАРА
  document.getElementById("apAddProductBtn").onclick = () => {
    document.getElementById("modal-add-product").classList.add("active");
  };
  document.getElementById("apCancelProduct").onclick = () => {
    document.getElementById("modal-add-product").classList.remove("active");
  };

  let apProdImageBase64 = null;
  document.getElementById("apProdImage").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { apProdImageBase64 = ev.target.result; };
    r.readAsDataURL(f);
  };

  document.getElementById("apSaveProduct").onclick = async () => {
    const name = document.getElementById("apProdName").value.trim();
    const price = parseInt(document.getElementById("apProdPrice").value) || 0;
    const type = document.getElementById("apProdType").value;
    const value = document.getElementById("apProdValue").value.trim();

    if (!name || price <= 0) return alert("Заполни название и цену");

    const newRef = push(ref(db, "shop/custom_items"));
    await set(newRef, {
      name,
      price,
      type,
      value,
      icon: apProdImageBase64 || null,
      createdAt: Date.now()
    });

    document.getElementById("modal-add-product").classList.remove("active");
    alert("Товар добавлен!");
  };

  // 6. СПИСОК АККАУНТОВ ДЛЯ QR
  function renderAccounts() {
    const box = document.getElementById("apAccountsList");
    if (!box) return;
    box.innerHTML = "Загрузка...";

    onValue(ref(db, "sqwid_accounts"), (snap) => {
      const items = snap.val() || {};
      box.innerHTML = "";
      if (Object.keys(items).length === 0) {
        box.innerHTML = "<div style='text-align:center;color:#888;padding:1rem;'>Аккаунтов нет</div>";
        return;
      }
      for (const phone in items) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:0.5rem; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:10px;";
        row.innerHTML = `
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.9rem;">${phone}</div>
            <div style="font-size:0.75rem;color:#f59e0b;">Пароль: ${items[phone].password}</div>
          </div>
          <button style="background:#ef4444;border:none;color:#fff;padding:0.4rem 0.6rem;border-radius:8px;font-size:0.75rem;font-weight:800;" data-del-acc="${phone}">Удалить</button>
        `;
        row.querySelector("[data-del-acc]").onclick = async () => {
          if (confirm("Удалить аккаунт?")) await remove(ref(db, "sqwid_accounts/" + phone));
        };
        box.appendChild(row);
      }
    });
  }

  // 7. ДОБАВЛЕНИЕ АККАУНТА
  document.getElementById("apAddAccountBtn").onclick = async () => {
    const phone = document.getElementById("apAccPhone").value.trim();
    const pass = document.getElementById("apAccPass").value.trim();
    if (!phone || !pass) return alert("Заполни номер и пароль");

    // Проверяем уникальность
    const existing = await get(ref(db, "sqwid_accounts/" + phone));
    if (existing.exists()) return alert("Этот номер уже занят!");

    // Скрытый email для Firebase
    const hiddenEmail = phone.replace("+", "") + "@sqwid.message";
    const firebasePass = Math.random().toString(36).slice(-12);

    await set(ref(db, "sqwid_accounts/" + phone), {
      password: pass,
      email: hiddenEmail,
      firebasePass: firebasePass,
      createdAt: Date.now()
    });

    document.getElementById("apAccPhone").value = "";
    document.getElementById("apAccPass").value = "";
    alert("Аккаунт добавлен!");
  };
});