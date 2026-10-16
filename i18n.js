/* ============================================================
   i18n.js — мультиязычность (10 языков)
   Автоперевод через бесплатный Google Translate endpoint
   ============================================================ */

(function () {
  "use strict";

  const LANGUAGE_NAMES = {
    ru: "Русский",
    en: "English",
    es: "Español",
    de: "Deutsch",
    fr: "Français",
    it: "Italiano",
    pt: "Português",
    zh: "中文",
    ja: "日本語",
    ar: "العربية"
  };

  const LANGUAGE_FLAGS = {
    ru: "🇷🇺",
    en: "🇬🇧",
    es: "🇪🇸",
    de: "🇩🇪",
    fr: "🇫🇷",
    it: "🇮🇹",
    pt: "🇵🇹",
    zh: "🇨🇳",
    ja: "🇯🇵",
    ar: "🇸🇦"
  };

  /* Кэш переводов — в localStorage, чтобы не звать Google каждый раз */
  const CACHE_KEY = "sqwid_translations_cache_v1";
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch (e) {
    cache = {};
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  /* ============================================================
     ПЕРЕВОД ОДНОЙ ФРАЗЫ ЧЕРЕЗ GOOGLE
     ============================================================ */
  async function translateOne(text, targetLang) {
    if (!text || typeof text !== "string") return text;
    const trimmed = text.trim();
    if (!trimmed) return text;

    /* Если целевой язык — русский, не переводим */
    if (targetLang === "ru") return text;

    /* Проверяем кэш */
    const cacheKey = targetLang + "::" + trimmed;
    if (cache[cacheKey]) return cache[cacheKey];

    /* Проверяем, не английский ли это уже */
    if (!/[а-яёА-ЯЁ]/.test(trimmed)) {
      /* В тексте нет русских букв — оставляем как есть */
      cache[cacheKey] = trimmed;
      return trimmed;
    }

    try {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=" +
        encodeURIComponent(targetLang) + "&dt=t&q=" + encodeURIComponent(trimmed);
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      let translated = "";
      if (data && data[0]) {
        data[0].forEach(part => {
          if (part && part[0]) translated += part[0];
        });
      }
      if (!translated) translated = trimmed;
      cache[cacheKey] = translated;
      return translated;
    } catch (e) {
      console.warn("i18n: перевод не удался для", trimmed, e);
      return trimmed;
    }
  }

  /* ============================================================
     АВТО-ПЕРЕВОДЧИК DOM — батчами
     ============================================================ */
  async function autoTranslateDOM() {
    const lang = getLanguage();
    if (lang === "ru") return;

    /* Собираем все текстовые узлы */
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "INPUT" ||
              tag === "TEXTAREA" || tag === "CODE" || tag === "PRE") {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("svg")) return NodeFilter.FILTER_REJECT;
          if (parent.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
          const trimmed = node.textContent.trim();
          if (!trimmed || trimmed.length < 2) return NodeFilter.FILTER_REJECT;
          /* Пропускаем если уже переведено (сохранён оригинал в dataset) */
          if (node.__sqwidOriginal !== undefined) return NodeFilter.FILTER_ACCEPT;
          /* Ищем русские буквы */
          if (!/[а-яёА-ЯЁ]/.test(trimmed)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    /* Плейсхолдеры */
    const placeholderEls = [];
    document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(el => {
      const ph = el.getAttribute("placeholder");
      if (ph && /[а-яёА-ЯЁ]/.test(ph)) placeholderEls.push(el);
    });

    /* Уникальные фразы */
    const phraseSet = new Set();
    nodes.forEach(n => {
      const t = (n.__sqwidOriginal !== undefined ? n.__sqwidOriginal : n.textContent).trim();
      if (t && /[а-яёА-ЯЁ]/.test(t)) phraseSet.add(t);
    });
    placeholderEls.forEach(el => {
      const orig = el.__sqwidOrigPlaceholder !== undefined ? el.__sqwidOrigPlaceholder : el.getAttribute("placeholder");
      if (orig && /[а-яёА-ЯЁ]/.test(orig)) phraseSet.add(orig.trim());
    });

    const phrases = Array.from(phraseSet);

    /* Переводим батчами — по 10 параллельно */
    const translatedMap = {};
    const CONCURRENCY = 10;
    for (let i = 0; i < phrases.length; i += CONCURRENCY) {
      const batch = phrases.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(p => translateOne(p, lang)));
      batch.forEach((p, idx) => {
        translatedMap[p] = results[idx];
      });
    }

    saveCache();

    /* Применяем перевод к узлам */
    nodes.forEach(node => {
      const orig = node.__sqwidOriginal !== undefined ? node.__sqwidOriginal : node.textContent;
      const trimmed = orig.trim();
      const translated = translatedMap[trimmed];
      if (!translated || translated === trimmed) return;

      const before = orig.match(/^\s*/)[0];
      const after = orig.match(/\s*$/)[0];

      if (node.__sqwidOriginal === undefined) {
        node.__sqwidOriginal = orig;
      }
      node.textContent = before + translated + after;
    });

    /* Применяем перевод к плейсхолдерам */
    placeholderEls.forEach(el => {
      const orig = el.__sqwidOrigPlaceholder !== undefined ? el.__sqwidOrigPlaceholder : el.getAttribute("placeholder");
      const trimmed = orig.trim();
      const translated = translatedMap[trimmed];
      if (!translated || translated === trimmed) return;
      if (el.__sqwidOrigPlaceholder === undefined) {
        el.__sqwidOrigPlaceholder = orig;
      }
      el.placeholder = translated;
    });
  }

  /* ============================================================
     ВОССТАНОВЛЕНИЕ РУССКОГО
     ============================================================ */
  function restoreRussian() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      if (node.__sqwidOriginal !== undefined) {
        node.textContent = node.__sqwidOriginal;
        delete node.__sqwidOriginal;
      }
    });

    document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(el => {
      if (el.__sqwidOrigPlaceholder !== undefined) {
        el.setAttribute("placeholder", el.__sqwidOrigPlaceholder);
        delete el.__sqwidOrigPlaceholder;
      }
    });
  }

  /* ============================================================
     ЯЗЫК
     ============================================================ */
  function getLanguage() {
    try {
      return localStorage.getItem("sqwid_lang") || "ru";
    } catch (e) {
      return "ru";
    }
  }

  async function setLanguage(code) {
    if (!LANGUAGE_NAMES[code]) code = "ru";
    const prev = getLanguage();

    /* Сначала восстанавливаем русский — чтобы перевод шёл с оригинала */
    restoreRussian();

    try {
      localStorage.setItem("sqwid_lang", code);
    } catch (e) {}
    document.documentElement.lang = code;
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";

    /* Переводим */
    if (code !== "ru") {
      await autoTranslateDOM();
    }

    window.dispatchEvent(new CustomEvent("sqwid:lang-changed", { detail: { lang: code } }));
  }

  function t(key) {
    return key;
  }

  /* ============================================================
     OBSERVER — следим за новыми элементами
     ============================================================ */
  let observer = null;
  let translateTimer = null;

  function startObserver() {
    if (observer) return;
    const lang = getLanguage();
    if (lang === "ru") return;

    observer = new MutationObserver(() => {
      if (translateTimer) clearTimeout(translateTimer);
      translateTimer = setTimeout(() => {
        autoTranslateDOM();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (translateTimer) {
      clearTimeout(translateTimer);
      translateTimer = null;
    }
  }

  window.addEventListener("sqwid:lang-changed", (e) => {
    stopObserver();
    if (e.detail.lang !== "ru") startObserver();
  });

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ
     ============================================================ */
  async function init() {
    const lang = getLanguage();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    const run = async () => {
      if (lang !== "ru") {
        await autoTranslateDOM();
        startObserver();
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      await run();
    }
  }

  window.SqwidI18n = {
    LANGUAGE_NAMES,
    LANGUAGE_FLAGS,
    getLanguage,
    setLanguage,
    t,
    autoTranslateDOM,
    restoreRussian,
    init
  };

  init();

  console.log("✅ i18n.js готов. Языков:", Object.keys(LANGUAGE_NAMES).length,
              "| Кэш:", Object.keys(cache).length, "фраз");
})();