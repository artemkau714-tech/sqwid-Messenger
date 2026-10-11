/* ============================================================
   folders.js — папки чатов (фильтры)
   ============================================================ */

console.log("🚀 folders.js загружен, жду Sqwid...");

function waitForSqwidFolders(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ folders.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidFolders((S) => {
  if (!S.currentUser) return;

  console.log("🔥 folders.js активирован");

  let currentFolder = "all";

  // Восстанавливаем сохранённую
  try {
    const saved = localStorage.getItem("sqwid_folder");
    if (saved) currentFolder = saved;
  } catch (e) {}

  /* ============================================================
     UI
     ============================================================ */
  const chips = document.querySelectorAll(".folder-chip");
  chips.forEach(chip => {
    chip.classList.toggle("active", chip.dataset.folder === currentFolder);
    chip.addEventListener("click", () => {
      currentFolder = chip.dataset.folder;
      chips.forEach(c => c.classList.toggle("active", c === chip));
      try { localStorage.setItem("sqwid_folder", currentFolder); } catch (e) {}
      if (window.Sqwid.refreshChatList) window.Sqwid.refreshChatList();
    });
  });

  /* ============================================================
     ЭКСПОРТ: фильтр для loadChats
     ============================================================ */
  window.Sqwid.getFolder = () => currentFolder;

  window.Sqwid.passesFolder = function (chat, unreadCount) {
    const f = currentFolder;
    if (f === "all") return true;
    if (f === "private") return chat.type === "private";
    if (f === "group") return chat.type === "group";
    if (f === "channel") return chat.type === "channel";
    if (f === "unread") return unreadCount > 0;
    return true;
  };

  console.log("✅ folders.js готов");
});