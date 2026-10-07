/* ============================================================
   games.js — игровой бот Sqwid Games (навык + квесты)
   ============================================================ */

console.log("🚀 games.js загружен, жду Sqwid...");

function waitForSqwidGames(cb) {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (window.Sqwid && window.Sqwid.currentUser) {
      clearInterval(t);
      cb(window.Sqwid);
    } else if (tries > 100) {
      clearInterval(t);
      console.warn("❌ games.js: Sqwid не появился");
    }
  }, 200);
}

waitForSqwidGames((S) => {
  const { db, ref, get, set, push, update, onValue, currentUser } = S;
  if (!currentUser) return;

  console.log("🔥 games.js активирован");

  const DAILY_WIN_LIMIT = 100000;

  let myData = {};
  let dailyStats = { games: 0, won: 0, lost: 0, winAmount: 0 };
  let dailyQuests = {};

  const QUIZ_QUESTIONS = [
    { q: "Сколько планет в Солнечной системе?", a: ["7", "8", "9", "10"], correct: 1 },
    { q: "Какой газ нужен человеку для дыхания?", a: ["Азот", "Кислород", "Водород", "Гелий"], correct: 1 },
    { q: "Столица Франции?", a: ["Лондон", "Берлин", "Париж", "Рим"], correct: 2 },
    { q: "Сколько цветов в радуге?", a: ["5", "6", "7", "8"], correct: 2 },
    { q: "Кто написал «Война и мир»?", a: ["Пушкин", "Толстой", "Достоевский", "Чехов"], correct: 1 },
    { q: "Самое большое животное на Земле?", a: ["Слон", "Синий кит", "Жираф", "Акула"], correct: 1 },
    { q: "Сколько сторон у куба?", a: ["4", "6", "8", "12"], correct: 1 },
    { q: "Какой океан самый большой?", a: ["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"], correct: 2 },
    { q: "Что H2O?", a: ["Соль", "Вода", "Кислород", "Углерод"], correct: 1 },
    { q: "В каком году человек полетел в космос?", a: ["1957", "1961", "1969", "1975"], correct: 1 },
    { q: "Самая длинная река в мире?", a: ["Амазонка", "Нил", "Янцзы", "Миссисипи"], correct: 1 },
    { q: "Сколько ног у паука?", a: ["6", "8", "10", "12"], correct: 1 }
  ];

  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    updateBalanceUI();
  });

  onValue(ref(db, "users/" + currentUser.uid + "/dailyGames"), (snap) => {
    const data = snap.val() || {};
    const today = todayKey();
    if (data.date === today) {
      dailyStats = {
        games: data.games || 0,
        won: data.won || 0,
        lost: data.lost || 0,
        winAmount: data.winAmount || 0
      };
    } else {
      dailyStats = { games: 0, won: 0, lost: 0, winAmount: 0 };
    }
  });

  onValue(ref(db, "users/" + currentUser.uid + "/dailyQuests"), (snap) => {
    const data = snap.val() || {};
    const today = todayKey();
    if (data.date === today) {
      dailyQuests = data.quests || {};
    } else {
      dailyQuests = {};
    }
    renderQuests();
  });

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function updateBalanceUI() {
    const el = document.getElementById("gamesBalance");
    if (el) el.textContent = "🪙 " + (myData.coins || 0) + " SQ";
  }

  function openGames() {
    updateBalanceUI();
    renderQuests();
    S.showScreen("screen-games");
  }
  window.Sqwid.openGames = openGames;
  console.log("✅ openGames опубликован");

  async function reward(amount, label) {
    if (amount <= 0) return;
    const remaining = DAILY_WIN_LIMIT - dailyStats.winAmount;
    if (remaining <= 0) {
      S.showToast("Дневной лимит выигрыша исчерпан", "error");
      return;
    }
    const realAmount = Math.min(amount, remaining);

    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    const newCoins = (me.coins || 0) + realAmount;

    await update(ref(db, "users/" + currentUser.uid), { coins: newCoins });

    const today = todayKey();
    const newStats = {
      date: today,
      games: (dailyStats.games || 0) + 1,
      won: (dailyStats.won || 0) + 1,
      lost: dailyStats.lost || 0,
      winAmount: (dailyStats.winAmount || 0) + realAmount
    };
    await update(ref(db, "users/" + currentUser.uid + "/dailyGames"), newStats);
    dailyStats = newStats;

    const botRef = push(ref(db, "botChat/" + currentUser.uid));
    await set(botRef, {
      from: "Sqwid Games",
      text: `🎉 ${label}\n+${realAmount} SQ`,
      timestamp: Date.now(),
      type: "system",
      kind: "games"
    });

    S.showToast("+" + realAmount + " SQ", "ok");
  }

  /* ---------- ВИКТОРИНА ---------- */
  let quizIndex = 0;
  let quizScore = 0;
  let quizQuestions = [];

  document.querySelectorAll("[data-game]").forEach(btn => {
    btn.addEventListener("click", () => {
      const game = btn.dataset.game;
      if (game === "quiz") startQuiz();
      if (game === "guess") startGuess();
      if (game === "reaction") startReaction();
    });
  });

  function startQuiz() {
    quizQuestions = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    quizIndex = 0;
    quizScore = 0;
    document.getElementById("modal-quiz").classList.add("active");
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const q = quizQuestions[quizIndex];
    if (!q) return finishQuiz();

    document.getElementById("quizProgress").textContent = `Вопрос ${quizIndex + 1} / ${quizQuestions.length}`;
    document.getElementById("quizQuestion").textContent = q.q;

    const box = document.getElementById("quizAnswers");
    box.innerHTML = "";
    q.a.forEach((ans, i) => {
      const btn = document.createElement("button");
      btn.className = "game-choice-btn";
      btn.textContent = ans;
      btn.onclick = () => answerQuiz(i, q.correct);
      box.appendChild(btn);
    });
    document.getElementById("quizResult").textContent = "";
  }

  function answerQuiz(chosen, correct) {
    const box = document.getElementById("quizAnswers");
    const btns = box.querySelectorAll(".game-choice-btn");
    btns.forEach((b, i) => {
      b.disabled = true;
      if (i === correct) b.classList.add("correct");
      else if (i === chosen) b.classList.add("wrong");
    });

    if (chosen === correct) {
      quizScore++;
      document.getElementById("quizResult").textContent = "✅ Правильно! +50 SQ";
      document.getElementById("quizResult").style.color = "#00a884";
    } else {
      document.getElementById("quizResult").textContent = "❌ Неверно";
      document.getElementById("quizResult").style.color = "#ff6b6b";
    }

    setTimeout(() => {
      quizIndex++;
      if (quizIndex >= quizQuestions.length) finishQuiz();
      else renderQuizQuestion();
    }, 1200);
  }

  async function finishQuiz() {
    const totalReward = quizScore * 50;
    if (totalReward > 0) {
      await reward(totalReward, `Викторина: ${quizScore} из ${quizQuestions.length} правильных`);
    } else {
      S.showToast("Викторина: 0 правильных", "info");
    }
    document.getElementById("modal-quiz").classList.remove("active");
  }

  const btnQuizClose = document.getElementById("btnQuizClose");
  if (btnQuizClose) btnQuizClose.addEventListener("click", () => {
    document.getElementById("modal-quiz").classList.remove("active");
  });

  /* ---------- УГАДАЙ ЧИСЛО ---------- */
  let guessNumber = 0;
  let guessAttempts = 5;

  function startGuess() {
    guessNumber = 1 + Math.floor(Math.random() * 100);
    guessAttempts = 5;
    document.getElementById("guessInput").value = "";
    document.getElementById("guessInput").disabled = false;
    document.getElementById("guessResult").textContent = "🤔";
    document.getElementById("guessResultText").textContent = "";
    document.getElementById("guessAttempts").textContent = "Попыток осталось: 5";
    document.getElementById("btnGuessSubmit").disabled = false;
    document.getElementById("modal-guess").classList.add("active");
  }

  const btnGuessSubmit = document.getElementById("btnGuessSubmit");
  if (btnGuessSubmit) btnGuessSubmit.addEventListener("click", async () => {
    const input = document.getElementById("guessInput");
    const n = parseInt(input.value);
    if (isNaN(n) || n < 1 || n > 100) {
      S.showToast("Введи число от 1 до 100", "error");
      return;
    }

    guessAttempts--;
    document.getElementById("guessAttempts").textContent = "Попыток осталось: " + guessAttempts;

    if (n === guessNumber) {
      const rewards = [0, 500, 300, 150, 50, 10];
      const earned = rewards[5 - guessAttempts] || 10;
      document.getElementById("guessResult").textContent = "🎉";
      document.getElementById("guessResultText").textContent = `Угадал! +${earned} SQ`;
      document.getElementById("btnGuessSubmit").disabled = true;
      input.disabled = true;
      await reward(earned, `Угадал число ${guessNumber} с ${5 - guessAttempts} попытки`);
      setTimeout(() => document.getElementById("modal-guess").classList.remove("active"), 1500);
      return;
    }

    if (guessAttempts <= 0) {
      document.getElementById("guessResult").textContent = "😢";
      document.getElementById("guessResultText").textContent = `Не угадал. Было ${guessNumber}`;
      document.getElementById("btnGuessSubmit").disabled = true;
      input.disabled = true;

      const today = todayKey();
      const newStats = {
        date: today,
        games: (dailyStats.games || 0) + 1,
        won: dailyStats.won || 0,
        lost: (dailyStats.lost || 0) + 1,
        winAmount: dailyStats.winAmount || 0
      };
      await update(ref(db, "users/" + currentUser.uid + "/dailyGames"), newStats);
      dailyStats = newStats;
      return;
    }

    if (n < guessNumber) {
      document.getElementById("guessResult").textContent = "⬆️";
      document.getElementById("guessResultText").textContent = "Моё число больше";
    } else {
      document.getElementById("guessResult").textContent = "⬇️";
      document.getElementById("guessResultText").textContent = "Моё число меньше";
    }
    input.value = "";
    input.focus();
  });

  const btnGuessClose = document.getElementById("btnGuessClose");
  if (btnGuessClose) btnGuessClose.addEventListener("click", () => {
    document.getElementById("modal-guess").classList.remove("active");
  });

  /* ---------- РЕАКЦИЯ ---------- */
  let reactionTimeout = null;
  let reactionStart = 0;
  let reactionPhase = "idle";

  function startReaction() {
    document.getElementById("reactionStage").textContent = "Нажми «Старт»";
    document.getElementById("reactionStage").className = "";
    document.getElementById("reactionResult").textContent = "";
    document.getElementById("btnReactionStart").textContent = "Старт";
    reactionPhase = "idle";
    document.getElementById("modal-reaction").classList.add("active");
  }

  const btnReactionStart = document.getElementById("btnReactionStart");
  if (btnReactionStart) btnReactionStart.addEventListener("click", () => {
    if (reactionPhase === "idle") {
      reactionPhase = "waiting";
      const stage = document.getElementById("reactionStage");
      stage.className = "waiting";
      stage.textContent = "Приготовься...";
      document.getElementById("btnReactionStart").textContent = "Жди...";
      document.getElementById("reactionResult").textContent = "Жми, когда фон станет зелёным";

      const delay = 2000 + Math.random() * 3000;
      reactionTimeout = setTimeout(() => {
        reactionPhase = "go";
        stage.className = "go";
        stage.textContent = "ЖМИ!";
        document.getElementById("btnReactionStart").textContent = "ЖМИ!";
        reactionStart = Date.now();
      }, delay);
    } else if (reactionPhase === "go") {
      const ms = Date.now() - reactionStart;
      reactionPhase = "idle";

      let earned = 0;
      let msg = "";
      if (ms < 300) { earned = 100; msg = `${ms} мс — отлично! +100 SQ`; }
      else if (ms < 500) { earned = 50; msg = `${ms} мс — хорошо! +50 SQ`; }
      else if (ms < 800) { earned = 20; msg = `${ms} мс — норм. +20 SQ`; }
      else { earned = 5; msg = `${ms} мс — медленно. +5 SQ`; }

      const stage = document.getElementById("reactionStage");
      stage.className = "ready";
      stage.textContent = ms + " мс";
      document.getElementById("reactionResult").textContent = msg;
      document.getElementById("btnReactionStart").textContent = "Ещё раз";

      reward(earned, `Реакция: ${ms} мс`);
    }
  });

  const reactionStage = document.getElementById("reactionStage");
  if (reactionStage) {
    reactionStage.addEventListener("click", () => {
      if (reactionPhase === "go") {
        btnReactionStart.click();
      } else if (reactionPhase === "waiting") {
        clearTimeout(reactionTimeout);
        reactionPhase = "idle";
        const stage = document.getElementById("reactionStage");
        stage.className = "waiting";
        stage.textContent = "Слишком рано!";
        document.getElementById("reactionResult").textContent = "Подожди зелёного фона";
        document.getElementById("btnReactionStart").textContent = "Ещё раз";
      }
    });
  }

  const btnReactionClose = document.getElementById("btnReactionClose");
  if (btnReactionClose) btnReactionClose.addEventListener("click", () => {
    if (reactionTimeout) clearTimeout(reactionTimeout);
    reactionPhase = "idle";
    document.getElementById("modal-reaction").classList.remove("active");
  });

  /* ---------- ЕЖЕДНЕВНЫЕ КВЕСТЫ ---------- */
  const QUESTS = [
    { key: "gift", icon: "🎁", name: "Подарить 1 подарок", reward: 200 },
    { key: "chat_create", icon: "👥", name: "Создать 1 чат или канал", reward: 150 },
    { key: "buy", icon: "🏷", name: "Купить 1 товар в магазине", reward: 100 },
    { key: "play", icon: "🎮", name: "Пройти 1 мини-игру", reward: 100 }
  ];

  function renderQuests() {
    const box = document.getElementById("gamesQuests");
    if (!box) return;
    box.innerHTML = "";

    QUESTS.forEach(q => {
      const claimed = dailyQuests[q.key] === true;
      const row = document.createElement("div");
      row.className = "quest-item" + (claimed ? " done" : "");
      row.innerHTML = `
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-name">${q.name}</div>
          <div class="quest-reward">+${q.reward} SQ</div>
        </div>
        <button class="quest-btn ${claimed ? "claimed" : ""}" data-quest="${q.key}" ${claimed ? "disabled" : ""}>
          ${claimed ? "✓ Получено" : "Забрать"}
        </button>
      `;
      const btn = row.querySelector("[data-quest]");
      if (btn && !claimed) {
        btn.onclick = () => tryClaimQuest(q);
      }
      box.appendChild(row);
    });
  }

  async function tryClaimQuest(quest) {
    const today = todayKey();
    const done = await checkQuestDone(quest.key);

    if (!done) {
      S.showToast("Сначала выполни задание", "info");
      return;
    }

    await update(ref(db, "users/" + currentUser.uid + "/dailyQuests"), {
      date: today,
      quests: { ...dailyQuests, [quest.key]: true }
    });

    dailyQuests[quest.key] = true;
    renderQuests();

    await reward(quest.reward, `Квест: ${quest.name}`);
  }

  async function checkQuestDone(key) {
    const today = todayKey();

    if (key === "gift") {
      const snap = await get(ref(db, "gifts"));
      const all = snap.val() || {};
      const todayTs = new Date().setHours(0, 0, 0, 0);
      for (const id in all) {
        const g = all[id];
        if (g.fromUid === currentUser.uid && (g.timestamp || 0) >= todayTs) return true;
      }
      return false;
    }

    if (key === "chat_create") {
      const snap = await get(ref(db, "chats"));
      const all = snap.val() || {};
      const todayTs = new Date().setHours(0, 0, 0, 0);
      for (const id in all) {
        const c = all[id];
        if (c.owner === currentUser.uid && (c.createdAt || 0) >= todayTs) return true;
      }
      return false;
    }

    if (key === "buy") {
      const meSnap = await get(ref(db, "users/" + currentUser.uid + "/inventory"));
      const inv = meSnap.val() || {};
      const todayTs = new Date().setHours(0, 0, 0, 0);
      for (const id in inv) {
        const it = inv[id];
        if (it && typeof it === "object" && (it.boughtAt || 0) >= todayTs) return true;
      }
      return false;
    }

    if (key === "play") {
      return (dailyStats.games || 0) > 0;
    }

    return false;
  }

  /* ---------- КНОПКА НАЗАД ---------- */
  const btnBack = document.getElementById("btnBackGames");
  if (btnBack) btnBack.addEventListener("click", () => S.showScreen("screen-messages"));

  console.log("✅ games.js готов");
});