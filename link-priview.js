/* ============================================================
   link-preview.js — Живое превью ссылок (Open Graph)
   Автоматически парсит URL в сообщениях и показывает карточку
   ============================================================ */

console.log("🚀 link-preview.js загружен, жду Sqwid...");

function waitForSqwidLinkPreview(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser && window.Sqwid.db) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ link-preview.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidLinkPreview((S) => {
  const { db, ref, get, onValue, update, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 link-preview.js активирован");

  const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
  const CACHE = new Map();
  const PENDING = new Map();

  /* ============================================================
     ИЗВЛЕЧЬ ПЕРВУЮ ССЫЛКУ ИЗ ТЕКСТА
     ============================================================ */
  function extractFirstUrl(text) {
    if (!text) return null;
    const matches = text.match(URL_REGEX);
    if (!matches || matches.length === 0) return null;
    // Убираем хвостовую пунктуацию
    return matches[0].replace(/[.,;:!?)]+$/, "");
  }

  /* ============================================================
     ЗАПРОС OG-ДАННЫХ
     Используем публичный API microlink.io (бесплатно, без ключа)
     Fallback: linkpreview.net (бесплатно, с ограничением)
     ============================================================ */
  async function fetchOG(url) {
    if (CACHE.has(url)) return CACHE.get(url);
    if (PENDING.has(url)) return PENDING.get(url);

    const promise = (async () => {
      try {
        // Microlink — бесплатно, до 50 запросов/день без ключа
        const api = "https://api.microlink.io/?url=" + encodeURIComponent(url);
        const res = await fetch(api, { method: "GET" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!data || data.status !== "success" || !data.data) throw new Error("no data");

        const d = data.data;
        const og = {
          url,
          title: d.title || "",
          description: d.description || "",
          image: d.image?.url || d.logo?.url || "",
          siteName: d.publisher || (new URL(url)).hostname.replace(/^www\./, ""),
          favicon: d.logo?.url || ""
        };
        CACHE.set(url, og);
        return og;
      } catch (e) {
        // Fallback: linkpreview.net (бесплатный ключ публичный)
        try {
          const fbApi = "https://api.linkpreview.net/?key=5f4dc78c53b0c9a3c97f4e29&q=" + encodeURIComponent(url);
          const res2 = await fetch(fbApi);
          if (!res2.ok) throw new Error("fallback failed");
          const d2 = await res2.json();
          const og = {
            url,
            title: d2.title || "",
            description: d2.description || "",
            image: d2.image || "",
            siteName: (new URL(url)).hostname.replace(/^www\./, ""),
            favicon: ""
          };
          CACHE.set(url, og);
          return og;
        } catch (e2) {
          CACHE.set(url, null);
          return null;
        }
      } finally {
        PENDING.delete(url);
      }
    })();

    PENDING.set(url, promise);
    return promise;
  }

  /* ============================================================
     ПОСТРОИТЬ HTML КАРТОЧКИ
     ============================================================ */
  function buildPreviewHTML(og) {
    if (!og) return "";
    const title = og.title || og.url;
    const desc = og.description || "";
    const img = og.image || "";
    const site = og.siteName || "";

    return `
      <a class="link-preview" href="${escapeAttr(og.url)}" target="_blank" rel="noopener noreferrer">
        ${img ? `<div class="link-preview-image" style="background-image:url('${escapeAttr(img)}');"></div>` : ""}
        <div class="link-preview-body">
          <div class="link-preview-site">${escapeHtml(site)}</div>
          <div class="link-preview-title">${escapeHtml(title)}</div>
          ${desc ? `<div class="link-preview-desc">${escapeHtml(desc)}</div>` : ""}
        </div>
      </a>
    `;
  }

  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
  }
  function escapeAttr(t) {
    return String(t == null ? "" : t).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ============================================================
     ПОИСК ССЫЛОК В DOM СООБЩЕНИЯ
     ============================================================ */
  function processMessageEl(el) {
    if (el.dataset.linkPreviewDone) return;
    if (el.querySelector(".link-preview")) {
      el.dataset.linkPreviewDone = "1";
      return;
    }

    // Ищем текст сообщения (не в цитатах, не в подписях к фото)
    const contentDiv = el.querySelector(":scope > div:not(.msg-time):not(.msg-reply-quote):not(.msg-sender)");
    if (!contentDiv) return;
    const text = contentDiv.textContent || "";
    const url = extractFirstUrl(text);
    if (!url) {
      el.dataset.linkPreviewDone = "1";
      return;
    }
    el.dataset.linkPreviewDone = "1";

    // Создаём плейсхолдер
    const placeholder = document.createElement("div");
    placeholder.className = "link-preview-loading";
    placeholder.innerHTML = `<div class="link-preview-shimmer"></div>`;
    contentDiv.appendChild(placeholder);

    fetchOG(url).then(og => {
      placeholder.remove();
      if (!og) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildPreviewHTML(og);
      const node = wrapper.firstElementChild;
      if (node) {
        // При клике — не открывать галерею и т.д.
        node.addEventListener("click", (e) => e.stopPropagation());
        contentDiv.appendChild(node);
      }
    });
  }

  /* ============================================================
     OBSERVER
     ============================================================ */
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (!node.classList) continue;
        if (node.classList.contains("msg")) {
          processMessageEl(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll(".msg").forEach(processMessageEl);
        }
      }
    }
  });

  function startObserver() {
    const box = document.getElementById("messages");
    if (!box || box.dataset.linkPreviewObserved) return;
    box.dataset.linkPreviewObserved = "1";
    observer.observe(box, { childList: true, subtree: true });
    // Обработать уже существующие
    box.querySelectorAll(".msg").forEach(processMessageEl);
  }
  setInterval(startObserver, 500);

  console.log("✅ link-preview.js готов");
});