/* ============================================================
   floating-bg.js — Интерактивные SVG-фоны профиля (Взрыв и размер)
   ============================================================ */

console.log("🚀 floating-bg.js загружен");

(function() {
  let animationFrame = null;
  let particles = [];
  let canvas = null;
  let ctx = null;
  let currentBgType = null;
  let isDragging = false;
  let lastMousePos = { x: 0, y: 0 };

  // Базовые SVG пути
  const SVG_PATHS = {
    hearts: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    stars: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    fire: 'M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-5 4-5 9a8 8 0 0 0 16 0c0-6-8-14-8-14z',
    leaf: 'M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z',
    snow: 'M12 2v20M2 12h20M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
    notes: 'M9 18V5l12-2v13M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    bubbles: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    planets: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4.93 4.93l14.14 14.14',
    ghosts: 'M12 2a8 8 0 0 0-8 8v12l3-3 3 3 3-3 3 3V10a8 8 0 0 0-8-8z',
    coins: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z'
  };

  const COLORS = {
    hearts: ['#ef4444', '#f43f5e', '#ec4899'],
    stars: ['#f59e0b', '#fbbf24', '#fcd34d'],
    fire: ['#f97316', '#ef4444', '#fbbf24'],
    leaf: ['#10b981', '#34d399', '#059669'],
    snow: ['#60a5fa', '#93c5fd', '#e0f2fe'],
    notes: ['#a855f7', '#c084fc', '#d8b4fe'],
    bubbles: ['#38bdf8', '#7dd3fc', '#bae6fd'],
    planets: ['#f97316', '#a855f7', '#3b82f6'],
    ghosts: ['#ffffff', '#e2e8f0', '#cbd5e1'],
    coins: ['#f59e0b', '#fbbf24', '#d97706']
  };

  function initCanvas() {
    if (canvas) return;
    const profileScroll = document.getElementById("profileScroll");
    if (!profileScroll) return;

    canvas = document.createElement("canvas");
    canvas.id = "floatingBgCanvas";
    canvas.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1;";
    profileScroll.insertBefore(canvas, profileScroll.firstChild);
    
    const contentWrap = document.createElement("div");
    contentWrap.style.cssText = "position:relative; z-index:2;";
    while (profileScroll.children.length > 1) {
      contentWrap.appendChild(profileScroll.children[1]);
    }
    profileScroll.appendChild(contentWrap);

    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }

  function createParticle(type) {
    const color = COLORS[type][Math.floor(Math.random() * COLORS[type].length)];
    // 🔥 УВЕЛИЧИЛИ РАЗМЕР (было 15-30, стало 30-60)
    const size = 30 + Math.random() * 30; 
    
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 50,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.5 - Math.random() * 1.5,
      size: size,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.05,
      color: color,
      type: type,
      path: new Path2D(SVG_PATHS[type]),
      isDragged: false // больше не используется для перетаскивания, но оставим
    };
  }

  function startAnimation(type) {
    if (currentBgType === type) return;
    currentBgType = type;
    initCanvas();
    particles = [];
    
    if (!type || !SVG_PATHS[type]) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Создаем частицы
    for (let i = 0; i < 25; i++) {
      const p = createParticle(type);
      p.y = Math.random() * canvas.height;
      particles.push(p);
    }

    const loop = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        // 🔥 ФИЗИКА: если палец близко — отталкиваем частицу
        if (isDragging) {
          const dx = p.x - lastMousePos.x;
          const dy = p.y - lastMousePos.y;
          const dist = Math.hypot(dx, dy);
          const forceRadius = 150; // Радиус действия пальца

          if (dist < forceRadius) {
            const force = (forceRadius - dist) / forceRadius; // 1 (близко) -> 0 (далеко)
            const angle = Math.atan2(dy, dx);
            
            // Добавляем скорость отталкивания
            p.vx += Math.cos(angle) * force * 0.8;
            p.vy += Math.sin(angle) * force * 0.8;
          }
        }

        // Обычное движение
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;

        // Трение (чтобы не улетали навсегда)
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Постепенно возвращаем базовую скорость полета вверх
        p.vy += (-0.5 - Math.random() * 1.5 - p.vy) * 0.01;
        p.vx += ((Math.random() - 0.5) * 0.5 - p.vx) * 0.01;

        // Если частица улетела вверх или вбок — возвращаем вниз
        if (p.y < -100 || p.x < -100 || p.x > canvas.width + 100) {
          Object.assign(p, createParticle(type));
        }
        
        // Рисуем
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // Масштабируем SVG (он 24x24)
        ctx.scale(p.size / 24, p.size / 24);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.8; // Чуть ярче
        
        if (type === 'snow' || type === 'notes') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.stroke(p.path);
        } else {
          ctx.fill(p.path);
        }
        ctx.restore();
      });

      animationFrame = requestAnimationFrame(loop);
    };
    
    if (animationFrame) cancelAnimationFrame(animationFrame);
    loop();
  }

  /* ============================================================
     ОБРАБОТКА КАСАНИЙ И МЫШИ
     ============================================================ */
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleStart(e) {
    if (!canvas || !currentBgType) return;
    isDragging = true;
    lastMousePos = getCanvasCoords(e);
  }

  function handleMove(e) {
    if (!isDragging) return;
    lastMousePos = getCanvasCoords(e);
    if (e.cancelable) e.preventDefault();
  }

  function handleEnd() {
    isDragging = false;
  }

  document.addEventListener("touchstart", handleStart, { passive: false });
  document.addEventListener("touchmove", handleMove, { passive: false });
  document.addEventListener("touchend", handleEnd);
  document.addEventListener("touchcancel", handleEnd);
  document.addEventListener("mousedown", handleStart);
  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", handleEnd);

  /* ============================================================
     СЛЕДИМ ЗА ПРОФИЛЕМ
     ============================================================ */
  setInterval(() => {
    const profileScreen = document.getElementById("screen-profile");
    if (profileScreen && profileScreen.classList.contains("active")) {
      const userData = window._currentUserData || {};
      const bgType = userData.profileFloatingBg;
      
      if (bgType !== currentBgType) {
        startAnimation(bgType);
      }
    } else {
      if (currentBgType !== null) {
        startAnimation(null);
      }
    }
  }, 500);

  window.Sqwid = window.Sqwid || {};
  window.Sqwid.setFloatingBg = (type) => startAnimation(type);

  console.log("✅ floating-bg.js готов (Взрыв и размер)");
})();