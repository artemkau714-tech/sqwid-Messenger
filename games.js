/* ============================================================
   games.js — Sqwid Games
   Угадай число + Рулетка подарков + Слот-машина + Краш + квесты + Sqwid+
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
  let myGifts = {};

  function isPlus() {
    return myData.plusUntil && myData.plusUntil > Date.now();
  }

  /* ============================================================
     ПОДПИСКИ
     ============================================================ */
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    myData = snap.val() || {};
    updateBalanceUI();
    renderDailyBonus();
  });

  onValue(ref(db, "users/" + currentUser.uid + "/gifts"), (snap) => {
    myGifts = snap.val() || {};
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

  /* ============================================================
     ОТКРЫТИЕ ЭКРАНА
     ============================================================ */
  function openGames() {
    updateBalanceUI();
    renderQuests();
    renderDailyBonus();
    S.showScreen("screen-games");
  }
  window.Sqwid.openGames = openGames;
  console.log("✅ openGames опубликован");

  /* ============================================================
     НАГРАДЫ
     ============================================================ */
  async function reward(amount, label) {
    if (amount <= 0) return;
    const plus = isPlus();
    const boosted = plus ? Math.floor(amount * 1.1) : amount;

    let realAmount = boosted;
    if (!plus) {
      const remaining = DAILY_WIN_LIMIT - dailyStats.winAmount;
      if (remaining <= 0) {
        S.showToast("Дневной лимит выигрыша исчерпан", "error");
        return;
      }
      realAmount = Math.min(boosted, remaining);
    }

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
      text: `🎉 ${label}\n+${realAmount} SQ${plus ? " (Sqwid+ +10%)" : ""}`,
      timestamp: Date.now(),
      type: "system",
      kind: "games"
    });

    S.showToast("+" + realAmount + " SQ" + (plus ? " ⭐" : ""), "ok");
  }

  /* ============================================================
     ЕЖЕДНЕВНЫЙ БОНУС SQWID+
     ============================================================ */
  async function claimDailyBonus() {
    if (!isPlus()) {
      S.showToast("Бонус только для Sqwid+", "warn");
      return;
    }
    const today = todayKey();
    const snap = await get(ref(db, "users/" + currentUser.uid + "/plusDailyBonus"));
    const data = snap.val() || {};
    if (data.date === today) {
      S.showToast("Бонус уже получен сегодня", "info");
      return;
    }
    const coins = (myData.coins || 0) + 50;
    await update(ref(db, "users/" + currentUser.uid), { coins });
    await update(ref(db, "users/" + currentUser.uid + "/plusDailyBonus"), { date: today, claimedAt: Date.now() });
    S.showToast("+50 SQ Sqwid+ бонус ⭐", "ok");
  }
  window.Sqwid.claimDailyBonus = claimDailyBonus;

  async function renderDailyBonus() {
    const box = document.getElementById("gamesDailyBonus");
    if (!box) return;
    if (!isPlus()) {
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    const today = todayKey();
    const snap = await get(ref(db, "users/" + currentUser.uid + "/plusDailyBonus"));
    const data = snap.val() || {};
    const claimed = data.date === today;
    box.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(236,72,153,0.15));border:1px solid rgba(245,158,11,0.4);border-radius:16px;padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px;">
        <div style="font-size:32px;">⭐</div>
        <div style="flex:1;">
          <div style="font-weight:800;color:#f59e0b;font-size:15px;">Ежедневный бонус Sqwid+</div>
          <div style="font-size:12.5px;color:#475569;margin-top:2px;">+50 SQ каждый день</div>
        </div>
        <button id="btnClaimDailyBonus" class="quest-btn" style="padding:10px 16px;font-size:13px;" ${claimed ? "disabled" : ""}>
          ${claimed ? "✓ Получено" : "Забрать"}
        </button>
      </div>
    `;
    const btn = document.getElementById("btnClaimDailyBonus");
    if (btn && !claimed) btn.onclick = claimDailyBonus;
  }

  /* ============================================================
     ОБРАБОТЧИКИ ИГР
     ============================================================ */
  document.querySelectorAll("[data-game]").forEach(btn => {
    btn.addEventListener("click", () => {
      const game = btn.dataset.game;
      if (game === "guess") startGuess();
      if (game === "roulette") openRoulette();
      if (game === "slots") openSlots();
      if (game === "crash") openCrash();
    });
  });

  /* ============================================================
     УГАДАЙ ЧИСЛО
     ============================================================ */
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

  /* ============================================================
     РУЛЕТКА ПОДАРКОВ
     ============================================================ */
  let rouletteSelectedGiftId = null;
  let rouletteSelectedGift = null;
  let rouletteSpinning = false;
  let rouletteAngle = 0;

  const ROULETTE_SECTORS = [
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 2,  label: "x2",     emoji: "🔥", color: "#10b981" },
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 5,  label: "x5",     emoji: "💎", color: "#3b82f6" },
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 2,  label: "x2",     emoji: "🔥", color: "#10b981" },
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 20, label: "x20",    emoji: "🌟", color: "#f59e0b" },
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 2,  label: "x2",     emoji: "🔥", color: "#10b981" },
    { mult: 0,  label: "Ничего", emoji: "💨", color: "#3f3f46" },
    { mult: 50, label: "x50",    emoji: "👑", color: "#ec4899" }
  ];

  function drawRouletteWheel() {
    const svg = document.getElementById("rouletteWheel");
    if (!svg) return;
    svg.innerHTML = "";
    const N = ROULETTE_SECTORS.length;
    const R = 100;
    const cx = 100, cy = 100;

    for (let i = 0; i < N; i++) {
      const s = ROULETTE_SECTORS[i];
      const a1 = (i / N) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + R * Math.cos(a1);
      const y1 = cy + R * Math.sin(a1);
      const x2 = cx + R * Math.cos(a2);
      const y2 = cy + R * Math.sin(a2);
      const largeArc = (a2 - a1) > Math.PI ? 1 : 0;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`);
      path.setAttribute("fill", s.color);
      path.setAttribute("stroke", "rgba(255,255,255,0.35)");
      path.setAttribute("stroke-width", "0.6");
      svg.appendChild(path);

      const midA = (a1 + a2) / 2;
      const tx = cx + (R * 0.65) * Math.cos(midA);
      const ty = cy + (R * 0.65) * Math.sin(midA);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", tx);
      text.setAttribute("y", ty);
      text.setAttribute("font-size", "14");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("fill", "#fff");
      text.setAttribute("transform", `rotate(${(midA * 180 / Math.PI) + 90}, ${tx}, ${ty})`);
      text.textContent = s.emoji;
      svg.appendChild(text);
    }
  }

  function openRoulette() {
    rouletteSelectedGiftId = null;
    rouletteSelectedGift = null;
    rouletteSpinning = false;
    rouletteAngle = 0;

    drawRouletteWheel();

    const wheel = document.getElementById("rouletteWheel");
    if (wheel) {
      wheel.style.transition = "transform 0s";
      wheel.style.transform = "rotate(0deg)";
    }
    const res = document.getElementById("rouletteResult");
    if (res) res.textContent = "";
    const center = document.getElementById("rouletteCenter");
    if (center) center.textContent = "🎁";
    const btn = document.getElementById("btnRouletteSpin");
    if (btn) btn.disabled = true;

    renderRouletteGiftPick();
    document.getElementById("modal-roulette").classList.add("active");
  }

  function renderRouletteGiftPick() {
    const box = document.getElementById("rouletteGiftPick");
    if (!box) return;
    box.innerHTML = "";

    const arr = Object.entries(myGifts).map(([gid, g]) => ({ gid, ...g })).filter(g => g && g.icon);

    if (arr.length === 0) {
      box.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:12px;">У вас нет подарков. Получите подарок от друга.</div>';
      return;
    }

    const title = document.createElement("div");
    title.style.cssText = "font-size:13px;color:#475569;margin-bottom:6px;font-weight:700;";
    title.textContent = "Выбери подарок:";
    box.appendChild(title);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:140px;overflow-y:auto;padding:2px;";

    arr.forEach(g => {
      const card = document.createElement("button");
      card.type = "button";
      card.style.cssText = `
        background:${rouletteSelectedGiftId === g.gid ? "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(236,72,153,0.2))" : "rgba(255,255,255,0.6)"};
        border:2px solid ${rouletteSelectedGiftId === g.gid ? "#f59e0b" : "rgba(15,23,42,0.08)"};
        border-radius:12px;
        padding:8px 4px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
        cursor:pointer;
        font-family:inherit;
      `;
      card.innerHTML = `
        <img src="${g.icon}" style="width:30px;height:30px;object-fit:contain;">
        <div style="font-size:10px;color:#f59e0b;font-weight:800;">${g.price || 0} SQ</div>
      `;
      card.onclick = () => {
        rouletteSelectedGiftId = g.gid;
        rouletteSelectedGift = g;
        renderRouletteGiftPick();
        const btn = document.getElementById("btnRouletteSpin");
        if (btn) btn.disabled = false;
      };
      grid.appendChild(card);
    });

    box.appendChild(grid);
  }

  const btnRouletteSpin = document.getElementById("btnRouletteSpin");
  if (btnRouletteSpin) btnRouletteSpin.addEventListener("click", async () => {
    if (rouletteSpinning) return;
    if (!rouletteSelectedGiftId || !rouletteSelectedGift) {
      S.showToast("Выбери подарок", "warn");
      return;
    }

    rouletteSpinning = true;
    btnRouletteSpin.disabled = true;
    const res = document.getElementById("rouletteResult");
    if (res) res.textContent = "";

    const idx = Math.floor(Math.random() * ROULETTE_SECTORS.length);
    const prize = ROULETTE_SECTORS[idx];

    const N = ROULETTE_SECTORS.length;
    const sectorAngle = 360 / N;
    const sectorCenterLocal = idx * sectorAngle + sectorAngle / 2;

    const spins = 5 + Math.floor(Math.random() * 3);
    const maxJitter = sectorAngle * 0.4;
    const jitter = (Math.random() - 0.5) * 2 * maxJitter;

    const finalAngle = rouletteAngle + spins * 360 + (360 - sectorCenterLocal) + jitter;

    const wheel = document.getElementById("rouletteWheel");
    if (wheel) {
      wheel.style.transition = "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 1)";
      wheel.style.transform = `rotate(${finalAngle}deg)`;
    }

    rouletteAngle = finalAngle;
    if (rouletteAngle > 360 * 20) rouletteAngle = rouletteAngle % 360;

    setTimeout(() => {
      showRouletteResult(prize);
    }, 3600);
  });

  async function showRouletteResult(prize) {
    const res = document.getElementById("rouletteResult");
    const center = document.getElementById("rouletteCenter");
    const gift = rouletteSelectedGift;
    const giftId = rouletteSelectedGiftId;

    if (!gift || !giftId) {
      rouletteSpinning = false;
      if (btnRouletteSpin) btnRouletteSpin.disabled = false;
      return;
    }

    if (center) center.textContent = prize.emoji;

    if (prize.mult === 0) {
      if (res) {
        res.style.color = "#ef4444";
        res.textContent = "💨 Ничего. Подарок сгорел";
      }

      try {
        await update(ref(db, "users/" + currentUser.uid + "/gifts/" + giftId), {
          lostAt: Date.now(),
          lostByRoulette: true
        });
        setTimeout(async () => {
          try { await update(ref(db, "users/" + currentUser.uid + "/gifts/" + giftId), null); } catch (e) {}
        }, 800);
      } catch (e) {}

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Games",
        text: `💨 Рулетка: подарок «${gift.name}» сгорел.`,
        timestamp: Date.now(),
        type: "system",
        kind: "games"
      });

    } else {
      const newPrice = (gift.price || 0) * prize.mult;
      if (res) {
        res.style.color = prize.color;
        res.textContent = `${prize.emoji} ${prize.label}! Подарок теперь ${newPrice} SQ`;
      }

      try {
        await update(ref(db, "users/" + currentUser.uid + "/gifts/" + giftId), {
          price: newPrice,
          multiplied: (gift.multiplied || 1) * prize.mult,
          lastMultipliedAt: Date.now()
        });
      } catch (e) {}

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Games",
        text: `🎉 Рулетка: ${prize.emoji} ${prize.label}!\nПодарок «${gift.name}» теперь стоит ${newPrice} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "games"
      });

      S.showToast(`${prize.emoji} ${prize.label}!`, "ok", 3000);
    }

    const today = todayKey();
    const newStats = {
      date: today,
      games: (dailyStats.games || 0) + 1,
      won: (dailyStats.won || 0) + (prize.mult > 0 ? 1 : 0),
      lost: (dailyStats.lost || 0) + (prize.mult > 0 ? 0 : 1),
      winAmount: dailyStats.winAmount || 0
    };
    try {
      await update(ref(db, "users/" + currentUser.uid + "/dailyGames"), newStats);
      dailyStats = newStats;
    } catch (e) {}

    rouletteSpinning = false;
    if (btnRouletteSpin) btnRouletteSpin.disabled = false;
    rouletteSelectedGiftId = null;
    rouletteSelectedGift = null;
    setTimeout(() => renderRouletteGiftPick(), 1200);
  }

  const btnRouletteClose = document.getElementById("btnRouletteClose");
  if (btnRouletteClose) btnRouletteClose.addEventListener("click", () => {
    if (rouletteSpinning) return;
    document.getElementById("modal-roulette").classList.remove("active");
  });

  /* ============================================================
     СЛОТ-МАШИНА
     ============================================================ */
  let slotsSpinning = false;

  const SLOT_SYMBOLS = ["🍒", "🍋", "💎", "7️⃣", "👑", "🍀", "⭐"];
  const SLOT_STAKE = 50;

  const SLOT_WINS = {
    "👑👑👑": { mult: 100, label: "ДЖЕКПОТ!" },
    "7️⃣7️⃣7️⃣": { mult: 50,  label: "Три семёрки!" },
    "💎💎💎": { mult: 20,  label: "Три алмаза!" },
    "🍒🍒🍒": { mult: 10,  label: "Три вишни!" },
    "🍋🍋🍋": { mult: 8,   label: "Три лимона!" },
    "🍀🍀🍀": { mult: 15,  label: "Три клевера!" },
    "⭐⭐⭐":  { mult: 12,  label: "Три звезды!" }
  };

  function openSlots() {
    slotsSpinning = false;
    for (let i = 0; i < 3; i++) {
      const r = document.getElementById("slotReel" + i);
      if (r) {
        r.textContent = "❓";
        r.style.transform = "scale(1)";
      }
    }
    const res = document.getElementById("slotsResult");
    if (res) res.textContent = "";
    const btn = document.getElementById("btnSlotsSpin");
    if (btn) btn.disabled = false;
    document.getElementById("modal-slots").classList.add("active");
  }

  const btnSlotsSpin = document.getElementById("btnSlotsSpin");
  if (btnSlotsSpin) btnSlotsSpin.addEventListener("click", async () => {
    if (slotsSpinning) return;

    const meSnap = await get(ref(db, "users/" + currentUser.uid));
    const me = meSnap.val() || {};
    const coins = me.coins || 0;
    if (coins < SLOT_STAKE) {
      S.showToast("Нужно минимум " + SLOT_STAKE + " SQ", "error");
      return;
    }

    slotsSpinning = true;
    btnSlotsSpin.disabled = true;
    const res = document.getElementById("slotsResult");
    if (res) res.textContent = "";

    await update(ref(db, "users/" + currentUser.uid), { coins: coins - SLOT_STAKE });

    const finalSymbols = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    ];

    const reelEls = [
      document.getElementById("slotReel0"),
      document.getElementById("slotReel1"),
      document.getElementById("slotReel2")
    ];

    const spinIntervals = [];
    for (let i = 0; i < 3; i++) {
      spinIntervals.push(setInterval(() => {
        const el = reelEls[i];
        if (el) el.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
      }, 80 + i * 20));
    }

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        clearInterval(spinIntervals[i]);
        if (reelEls[i]) {
          reelEls[i].textContent = finalSymbols[i];
          reelEls[i].style.transform = "scale(1.15)";
          setTimeout(() => { if (reelEls[i]) reelEls[i].style.transform = "scale(1)"; }, 150);
        }
      }, 1200 + i * 500);
    }

    setTimeout(async () => {
      await resolveSlots(finalSymbols);
    }, 2900);
  });

  async function resolveSlots(symbols) {
    const res = document.getElementById("slotsResult");
    const combo = symbols.join("");
    const match = SLOT_WINS[combo];

    let winMult = 0;
    let winAmount = 0;
    let label = "";

    if (match) {
      winMult = match.mult;
      winAmount = SLOT_STAKE * winMult;
      label = match.label;
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      winMult = 2;
      winAmount = SLOT_STAKE * 2;
      label = "Два одинаковых";
    } else {
      winMult = 0;
      winAmount = 0;
      label = "Не повезло";
    }

    if (winAmount > 0) {
      const meSnap = await get(ref(db, "users/" + currentUser.uid));
      const me = meSnap.val() || {};
      const newCoins = (me.coins || 0) + winAmount;
      await update(ref(db, "users/" + currentUser.uid), { coins: newCoins });

      if (res) {
        res.style.color = "#10b981";
        res.textContent = `🎉 ${label}! +${winAmount} SQ`;
      }

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Games",
        text: `🎰 Слоты: ${combo}\n${label} — +${winAmount} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "games"
      });

      S.showToast("+" + winAmount + " SQ", "ok", 2500);

      const today = todayKey();
      const newStats = {
        date: today,
        games: (dailyStats.games || 0) + 1,
        won: (dailyStats.won || 0) + 1,
        lost: dailyStats.lost || 0,
        winAmount: (dailyStats.winAmount || 0) + winAmount
      };
      await update(ref(db, "users/" + currentUser.uid + "/dailyGames"), newStats);
      dailyStats = newStats;
    } else {
      if (res) {
        res.style.color = "#ef4444";
        res.textContent = `😢 ${label}. −${SLOT_STAKE} SQ`;
      }

      const botRef = push(ref(db, "botChat/" + currentUser.uid));
      await set(botRef, {
        from: "Sqwid Games",
        text: `🎰 Слоты: ${combo}\nПроигрыш −${SLOT_STAKE} SQ`,
        timestamp: Date.now(),
        type: "system",
        kind: "games"
      });

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
    }

    slotsSpinning = false;
    if (btnSlotsSpin) btnSlotsSpin.disabled = false;
  }

  const btnSlotsClose = document.getElementById("btnSlotsClose");
  if (btnSlotsClose) btnSlotsClose.addEventListener("click", () => {
    if (slotsSpinning) return;
    document.getElementById("modal-slots").classList.remove("active");
  });

  /* ============================================================
     КРАШ (макс. x100)
     ============================================================ */
  let crashBet = 0;
  let crashRunning = false;
  let crashInterval = null;
  let crashMultiplier = 1.00;
  let crashPoint = 1.00;
  let crashStartTime = 0;
  let crashCaughtOut = false;

  const CRASH_MIN = 500;

  // Генерация точки краха — максимум x100
  function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.40) return 1.00 + Math.random() * 0.50;      // x1.00–x1.50 (40%)
    if (r < 0.70) return 1.50 + Math.random() * 1.50;      // x1.50–x3.00 (30%)
    if (r < 0.90) return 3.00 + Math.random() * 7.00;      // x3.00–x10.00 (20%)
    if (r < 0.98) return 10.00 + Math.random() * 40.00;    // x10.00–x50.00 (8%)
    return 50.00 + Math.random() * 50.00;                  // x50.00–x100.00 (2%)
  }

  function openCrash() {
    crashRunning = false;
    crashCaughtOut = false;
    if (crashInterval) clearInterval(crashInterval);

    const coins = myData.coins || 0;
    if (coins < CRASH_MIN) {
      S.showAlert(`Для игры нужно минимум ${CRASH_MIN} SQ.\nУ вас: ${coins} SQ`, "Мало монет");
      return;
    }

    document.getElementById("crashSetup").style.display = "block";
    document.getElementById("crashGame").style.display = "none";
    document.getElementById("crashResult").style.display = "none";
    document.getElementById("crashBetInput").value = CRASH_MIN;
    document.getElementById("crashBetInput").max = coins;

    document.getElementById("modal-crash").classList.add("active");
  }

  document.querySelectorAll(".crash-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      const amount = btn.dataset.amount;
      const input = document.getElementById("crashBetInput");
      const coins = myData.coins || 0;
      if (amount === "all") {
        input.value = coins;
      } else {
        const val = Math.min(parseInt(amount), coins);
        input.value = val;
      }
    });
  });

  const btnCrashStart = document.getElementById("btnCrashStart");
  if (btnCrashStart) btnCrashStart.addEventListener("click", async () => {
    const input = document.getElementById("crashBetInput");
    const bet = parseInt(input.value) || 0;
    const coins = myData.coins || 0;

    if (bet < CRASH_MIN) {
      S.showToast(`Минимум ${CRASH_MIN} SQ`, "error");
      return;
    }
    if (bet > coins) {
      S.showToast(`У вас только ${coins} SQ`, "error");
      return;
    }

    try {
      await update(ref(db, "users/" + currentUser.uid), { coins: coins - bet });
    } catch (e) {
      S.showToast("Ошибка: " + e.message, "error");
      return;
    }

    crashBet = bet;
    crashRunning = true;
    crashCaughtOut = false;
    crashMultiplier = 1.00;
    crashPoint = generateCrashPoint();
    crashStartTime = Date.now();

    document.getElementById("crashSetup").style.display = "none";
    document.getElementById("crashGame").style.display = "block";
    document.getElementById("crashResult").style.display = "none";
    document.getElementById("crashBetDisplay").textContent = bet;
    document.getElementById("crashWinDisplay").textContent = bet;
    document.getElementById("crashProgress").style.width = "0%";

    const multEl = document.getElementById("crashMultiplier");
    multEl.textContent = "x1.00";
    multEl.style.color = "#10b981";

    crashInterval = setInterval(() => {
      if (!crashRunning) return;

      const elapsed = (Date.now() - crashStartTime) / 1000;
      crashMultiplier = 1 + (elapsed * 0.15) + (elapsed * elapsed * 0.05);

      if (crashMultiplier >= crashPoint) {
        crashMultiplier = crashPoint;
        multEl.textContent = "x" + crashMultiplier.toFixed(2);
        multEl.style.color = "#ef4444";
        crashRunning = false;
        clearInterval(crashInterval);
        crashInterval = null;

        setTimeout(() => handleCrashLoss(), 500);
        return;
      }

      multEl.textContent = "x" + crashMultiplier.toFixed(2);
      const p = Math.min(1, (crashMultiplier - 1) / 5);
      if (p < 0.5) {
        multEl.style.color = "#10b981";
      } else if (p < 0.8) {
        multEl.style.color = "#f59e0b";
      } else {
        multEl.style.color = "#ef4444";
      }

      const prog = Math.min(100, ((crashMultiplier - 1) / 9) * 100);
      document.getElementById("crashProgress").style.width = prog + "%";

      const potentialWin = Math.floor(crashBet * crashMultiplier);
      document.getElementById("crashWinDisplay").textContent = potentialWin;

    }, 100);
  });

  const btnCrashCashout = document.getElementById("btnCrashCashout");
  if (btnCrashCashout) btnCrashCashout.addEventListener("click", async () => {
    if (!crashRunning || crashCaughtOut) return;
    crashCaughtOut = true;
    crashRunning = false;
    clearInterval(crashInterval);
    crashInterval = null;

    const winAmount = Math.floor(crashBet * crashMultiplier);

    try {
      const meSnap = await get(ref(db, "users/" + currentUser.uid));
      const me = meSnap.val() || {};
      const newCoins = (me.coins || 0) + winAmount;
      await update(ref(db, "users/" + currentUser.uid), { coins: newCoins });
    } catch (e) {}

    document.getElementById("crashGame").style.display = "none";
    document.getElementById("crashResult").style.display = "block";
    document.getElementById("crashResultIcon").textContent = "🎉";
    document.getElementById("crashResultText").textContent = "Забрал на x" + crashMultiplier.toFixed(2);
    document.getElementById("crashResultText").style.color = "#10b981";
    document.getElementById("crashResultAmount").textContent = "+" + winAmount + " SQ";
    document.getElementById("crashResultAmount").style.color = "#10b981";

    const botRef = push(ref(db, "botChat/" + currentUser.uid));
    await set(botRef, {
      from: "Sqwid Games",
      text: `📈 Краш: забрал на x${crashMultiplier.toFixed(2)}\n+${winAmount} SQ (ставка ${crashBet})`,
      timestamp: Date.now(),
      type: "system",
      kind: "games"
    });

    S.showToast("+" + winAmount + " SQ", "ok", 2500);

    const today = todayKey();
    const newStats = {
      date: today,
      games: (dailyStats.games || 0) + 1,
      won: (dailyStats.won || 0) + 1,
      lost: dailyStats.lost || 0,
      winAmount: (dailyStats.winAmount || 0) + winAmount
    };
    await update(ref(db, "users/" + currentUser.uid + "/dailyGames"), newStats);
    dailyStats = newStats;
  });

  async function handleCrashLoss() {
    document.getElementById("crashGame").style.display = "none";
    document.getElementById("crashResult").style.display = "block";
    document.getElementById("crashResultIcon").textContent = "💥";
    document.getElementById("crashResultText").textContent = "Крах на x" + crashMultiplier.toFixed(2);
    document.getElementById("crashResultText").style.color = "#ef4444";
    document.getElementById("crashResultAmount").textContent = "−" + crashBet + " SQ";
    document.getElementById("crashResultAmount").style.color = "#ef4444";

    const botRef = push(ref(db, "botChat/" + currentUser.uid));
    await set(botRef, {
      from: "Sqwid Games",
      text: `💥 Краш: крах на x${crashMultiplier.toFixed(2)}\n−${crashBet} SQ`,
      timestamp: Date.now(),
      type: "system",
      kind: "games"
    });

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
  }

  const btnCrashAgain = document.getElementById("btnCrashAgain");
  if (btnCrashAgain) btnCrashAgain.addEventListener("click", () => {
    openCrash();
  });

  const btnCrashClose = document.getElementById("btnCrashClose");
  if (btnCrashClose) btnCrashClose.addEventListener("click", () => {
    if (crashRunning) {
      S.showToast("Игра идёт! Забирай или жди краха", "warn");
      return;
    }
    if (crashInterval) clearInterval(crashInterval);
    document.getElementById("modal-crash").classList.remove("active");
  });

  /* ============================================================
     ЕЖЕДНЕВНЫЕ КВЕСТЫ
     ============================================================ */
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
      if (btn && !claimed) btn.onclick = () => tryClaimQuest(q);
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

  /* ============================================================
     КНОПКА НАЗАД
     ============================================================ */
  const btnBack = document.getElementById("btnBackGames");
  if (btnBack) btnBack.addEventListener("click", () => S.showScreen("screen-messages"));

  console.log("✅ games.js готов");
});