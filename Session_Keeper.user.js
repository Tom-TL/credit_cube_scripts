// ==UserScript==
// @name         Session Keeper
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.3
// @description  Prevents auto-logout in Infinity LMS by sending keep-alive pings and simulating user activity.
// @match        http*://*/plm.net/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Session_Keeper.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Session_Keeper.user.js
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  /* -------------------------------------------------------------
     🔧 НАСТРОЙКИ (менять можно только тут)
  -------------------------------------------------------------- */

  // DEBUG_UI:
  // false → кнопки вообще нет, скрипт тихо работает в фоне (stealth mode)
  // true  → показывается красивая кнопка "Session: ON/OFF" снизу слева
  const DEBUG_UI = true;  // ← если хочешь спрятать кнопку — поставь false

  // LABEL:
  // Текст в кнопке. Можно заменить на "Active", "Keep", "Stay" и т.п.
  const LABEL = "Session"; // кнопка будет "Session: ON" / "Session: OFF"


  /* -------------------------------------------------------------
     ДАЛЬШЕ — ЛОГИКА СКРИПТА (можно не трогать)
  -------------------------------------------------------------- */

  // Не запускать в iframe
  if (window.top !== window.self) return;

  const path = location.pathname.toLowerCase();

  // Цвета фона кнопки ON/OFF (примерно как на твоих скринах)
  const COLOR_ON  = '#49D892';  // мягкий зелёный
  const COLOR_OFF = '#7E8B8F';  // приглушённый серо-синий

  // Ключи в localStorage
  const STORAGE_ENABLED_KEY   = 'sessionKeeper_enabled_v4_1';   // ON/OFF
  const STORAGE_COLLAPSED_KEY = 'sessionKeeper_collapsed_v4_1'; // свернуто/развернуто

  // Интервалы
  const PING_EVERY_MS      = 3 * 60 * 1000; // каждые 3 минуты — пинг на сервер
  const FAKE_ACTIVITY_MS   = 60 * 1000;     // фейк-активность раз в минуту

  let pingIntervalId = null;
  let activityIntervalId = null;

  // --- Определяем, попап ли это (где UI не нужен, но логика всё равно работает) ---
  function isPopupWindow() {
    const w = window.outerWidth || window.innerWidth;
    const h = window.outerHeight || window.innerHeight;

    const smallWindow = (w < 900 || h < 600);

    const popupPath =
      path.includes('customernotes')    ||
      path.includes('customerfiles')    ||
      path.includes('loanremarks')      ||
      path.includes('loanstatus')       ||
      path.includes('changeloanstatus') ||
      path.includes('editloanremarks')  ||
      path.includes('createpayment');   // здесь кнопку не показываем, чтобы не мешала

    return smallWindow || popupPath;
  }

  const IS_POPUP = isPopupWindow();

  // --- Чтение/запись состояния ON/OFF ---
  function isEnabled() {
    const saved = localStorage.getItem(STORAGE_ENABLED_KEY);
    return saved === null ? true : saved === '1';
  }
  function setEnabled(v) {
    localStorage.setItem(STORAGE_ENABLED_KEY, v ? '1' : '0');
  }

  // --- Чтение/запись состояния свернуто/развернуто ---
  function isCollapsedStored() {
    const saved = localStorage.getItem(STORAGE_COLLAPSED_KEY);
    return saved === '1';
  }
  function setCollapsedStored(v) {
    localStorage.setItem(STORAGE_COLLAPSED_KEY, v ? '1' : '0');
  }

  let isCollapsed = isCollapsedStored(); // свернуто ли UI (будет жить между перезагрузками)

  // --- URL для пинга (текущая страница, кроме логина) ---
  function getKeepAliveUrl() {
    let url = window.location.href.split('#')[0];
    if (url.toLowerCase().includes('login')) return null;
    return url;
  }

  // --- ПИНГ СЕРВЕРА ---
  function startPing() {
    if (pingIntervalId !== null) return;

    function doPing() {
      const url = getKeepAliveUrl();
      if (!url) return;

      fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(r => console.log(`[SessionKeeper] Ping → ${r.status}`, IS_POPUP ? '(popup)' : '(main)'))
        .catch(e => console.warn('[SessionKeeper] Ping error:', e));
    }

    doPing();
    pingIntervalId = setInterval(doPing, PING_EVERY_MS);
  }

  function stopPing() {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }

  // --- ФЕЙКОВАЯ АКТИВНОСТЬ ---
  function simulateUserActivity() {
    try {
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 5 }));
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift' }));

      const input = document.querySelector('input, textarea');
      if (input) input.dispatchEvent(new Event('input', { bubbles: true }));

      console.log('[SessionKeeper] Fake activity');
    } catch (e) {}
  }

  function startFakeActivity() {
    if (activityIntervalId !== null) return;
    simulateUserActivity();
    activityIntervalId = setInterval(simulateUserActivity, FAKE_ACTIVITY_MS);
  }

  function stopFakeActivity() {
    clearInterval(activityIntervalId);
    activityIntervalId = null;
  }

  /* -------------------------------------------------------------
     🎛️ КРАСИВАЯ КНОПКА (как на твоих макетах)
     ▸ слева — объёмный кружочек
     ▸ посередине — текст "Session: ON/OFF"
     ▸ справа — белый треугольник "◀" для сворачивания
     ▸ свернутое состояние + ON/OFF сохраняются в localStorage
  -------------------------------------------------------------- */

  function createToggle() {
    // Если UI выключен или это попап — кнопку не рисуем, но логика всё равно работает
    if (!DEBUG_UI) return;
    if (IS_POPUP) return;

    if (document.getElementById('session-keeper-toggle')) return;

    const btn = document.createElement('div');
    btn.id = 'session-keeper-toggle';

    const dotSpan   = document.createElement('span'); // круг слева
    const textSpan  = document.createElement('span'); // "Session: ON/OFF"
    const arrowSpan = document.createElement('span'); // белый треугольник ◀

    btn.appendChild(dotSpan);
    btn.appendChild(textSpan);
    btn.appendChild(arrowSpan);

    // --- Базовый стиль всей кнопки (капсула) ---
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      padding: '4px 12px',
      background: isEnabled() ? COLOR_ON : COLOR_OFF,
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: '700',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      borderRadius: '999px',
      cursor: 'pointer',
      zIndex: 99999,
      userSelect: 'none',
      boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'background 0.2s ease, transform 0.1s ease, box-shadow 0.1s ease'
    });

    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'translateY(1px)';
      btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
    });

    // --- Кружочек слева (объёмный) ---
    Object.assign(dotSpan.style, {
      display: 'inline-block',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      flexShrink: '0'
    });

    // --- Текст "Session: ON/OFF" ---
    Object.assign(textSpan.style, {
      whiteSpace: 'nowrap'
    });

    // --- Стрелка ◀ для сворачивания ---
    arrowSpan.textContent = '◀';
    Object.assign(arrowSpan.style, {
      marginLeft: '4px',
      fontSize: '11px',
      fontWeight: '700',
      color: '#ffffff',
      flexShrink: '0',
      opacity: '0.95'
    });





    // Обновление внешнего вида в зависимости от состояния
      function updateButtonAppearance() {
      const enabled = isEnabled();

      // Цвет фона кнопки
      btn.style.background = enabled ? COLOR_ON : COLOR_OFF;

      // Градиент для кружочка
      if (enabled) {
        dotSpan.style.background =
          'radial-gradient(circle at 30% 30%, #d6ffe9, #10b86a)';
      } else {
        dotSpan.style.background =
          'radial-gradient(circle at 30% 30%, #f2e9ff, #b89cff)';
      }

      if (isCollapsed) {
        // 🔹 СВЕРНУТО:
        //  - показываем только кружок
        //  - центрируем его по капсуле
        //  - убираем любые отступы/гапы справа
        textSpan.textContent = '';
        arrowSpan.style.display = 'none';

        btn.style.padding = '4px 8px';
        btn.style.justifyContent = 'center'; // кружок по центру
        btn.style.gap = '0px';
      } else {
        // 🔹 РАЗВЕРНУТО:
        //  - кружок + текст "Session: ON/OFF" + стрелка ◀
        textSpan.textContent = enabled ? `${LABEL}: ON` : `${LABEL}: OFF`;
        arrowSpan.style.display = 'inline';

        btn.style.padding = '4px 12px';
        btn.style.justifyContent = 'flex-start'; // обычное выравнивание слева
        btn.style.gap = '6px';
      }
    }






    // Клик по кнопке:
    //  - если свернуто → только разворачиваем, состояние ON/OFF не меняем
    //  - если развернуто → переключаем ON/OFF
    btn.addEventListener('click', () => {
      if (isCollapsed) {
        isCollapsed = false;
        setCollapsedStored(false);
        updateButtonAppearance();
        return;
      }

      const newState = !isEnabled();
      setEnabled(newState);

      if (newState) {
        startPing();
        startFakeActivity();
      } else {
        stopPing();
        stopFakeActivity();
      }

      updateButtonAppearance();
    });

    // Отдельный клик по стрелке ◀ — только сворачивает, не меняя ON/OFF
    arrowSpan.addEventListener('click', (e) => {
      e.stopPropagation(); // чтобы не сработал общий click по кнопке
      isCollapsed = true;
      setCollapsedStored(true);
      updateButtonAppearance();
    });

    // Стартовый вид
    updateButtonAppearance();

    document.body.appendChild(btn);
  }

  /* -------------------------------------------------------------
     🚀 ИНИЦИАЛИЗАЦИЯ СКРИПТА
  -------------------------------------------------------------- */

  function init() {
    createToggle();

    if (isEnabled()) {
      startPing();
      startFakeActivity();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
