// ==UserScript==
// @name         Session Keeper
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.6
// @description  Prevents auto-logout in Infinity LMS: disables the built-in SessionTimeout.js countdown, pings the real SessionKeepAlive endpoint and auto-clicks "I'm still here".
// @match        http*://*/plm.net/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Session_Keeper.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Session_Keeper.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* =================================================================

   Раньше звук глушился только обнулением window.sessionTimeoutSoundUrl.
   Это работает, ТОЛЬКО если сайт читает эту переменную. Если путь к mp3
   зашит в коде или <audio> лежит прямо в разметке — звук всё равно играл.

   Теперь блокируется сам факт воспроизведения:
   • патчится HTMLMediaElement.prototype.play() — звук с "подозрительным"
     именем (beep/warning/session/timeout/...) не проигрывается вообще;
   • существующие <audio>/<video> глушатся (muted + volume 0);
   • MutationObserver ловит элементы, добавленные позже.
   Наш собственный тихий wav (анти-заморозка вкладки) помечен флагом
   и под блокировку не попадает.

   ЧТО ИСПРАВЛЕНО В 3.1

   В 3.0 проверка "жива ли сессия" была слишком грубой: любой ответ
   SessionKeepAlive.ashx кроме 2xx считался смертью сессии — отсюда
   красная плашка на рабочей странице. Теперь:

   • сессия считается мёртвой ТОЛЬКО если запрос реально редиректит
     на LoginPage.aspx, и только после двух проверок подряд;
   • если endpoint не принимает GET (404/405) — автоматически пробуем
     POST и дальше используем рабочий метод;
   • любой другой непонятный ответ = "не знаю", плашка не показывается,
     в консоль идёт предупреждение;
   • сама плашка переехала вниз справа (не перекрывает шапку) и её
     можно закрыть крестиком.

   Механика продления (из 3.0) не менялась:
   1) подмена window.sessionTimeoutWarningMs до старта SessionTimeout.js
   2) keep-alive на /plm.net/SessionKeepAlive.ashx каждые 4 минуты
   3) автонажатие #sessionStillHereBtn
   4) восстановление после окна "session expired"
================================================================= */

(function () {
  'use strict';

  /* -------------------------------------------------------------
     🔧 НАСТРОЙКИ
  -------------------------------------------------------------- */

  const DEBUG_UI   = false;  // ← кнопки/кружка нет вообще (stealth). true — вернуть кнопку.
  const LABEL      = "Session";

  const KILL_SITE_TIMER  = true;  // глушить встроенный таймер (главное)
  const MUTE_SITE_SOUND  = true;  // жёстко глушить звук предупреждения (не только через переменную)
  const AUTO_CLICK       = true;  // жать "I'm still here"
  const ANTI_THROTTLE    = true;  // тихий звук против заморозки фоновой вкладки
  const SHOW_DEAD_BANNER = true;  // плашка "сессия закрыта" (можно выключить)

  const KEEPALIVE_EVERY_MS = 4 * 60 * 1000;
  const WATCH_EVERY_MS     = 1000;

  const VERBOSE = true;

  /* -------------------------------------------------------------
     1) ГЛУШИМ ВСТРОЕННЫЙ ТАЙМЕР (до кода страницы)
  -------------------------------------------------------------- */

  const HUGE_MS = 2000000000; // ~23 дня; выше 2147483647 setTimeout переполнится

  function lockGlobal(name, value) {
    try {
      let v = value;
      Object.defineProperty(window, name, {
        configurable: true,
        get: function () { return v; },
        set: function () { /* значение сайта игнорируем */ }
      });
    } catch (e) {}
  }

  if (KILL_SITE_TIMER) {
    lockGlobal('sessionTimeoutWarningMs', HUGE_MS);
    lockGlobal('sessionTimeoutCountdownSeconds', 86400);
    lockGlobal('sessionTimeoutSoundUrl', '');
  }

  /* -------------------------------------------------------------
     1b) ЖЁСТКАЯ БЛОКИРОВКА ЗВУКА

     Обнуления sessionTimeoutSoundUrl мало: сайт может зашить путь
     к mp3 прямо в коде или держать <audio> в разметке. Поэтому
     перехватываем сам момент воспроизведения.
  -------------------------------------------------------------- */

  const OUR_AUDIO_FLAG = '__sessionKeeperSilent';
  const BAD_SOUND_RE = /beep|warn|alert|timeout|session|chime|notify|expire/i;

  function isBlockedSound(el) {
    try {
      if (el && el[OUR_AUDIO_FLAG]) return false;          // наш тихий wav — не трогаем
      const src = (el && (el.currentSrc || el.src)) || '';
      if (!src) return false;
      if (src.indexOf('data:') === 0) return false;        // наш анти-throttle
      return BAD_SOUND_RE.test(src);
    } catch (e) { return false; }
  }

  function muteSiteSound() {
    if (!MUTE_SITE_SOUND) return;

    // 1. перехват play() у любого <audio>/<video>
    try {
      const proto = window.HTMLMediaElement && HTMLMediaElement.prototype;
      if (proto && !proto.__sessionKeeperPatched) {
        const origPlay = proto.play;
        proto.play = function () {
          if (isBlockedSound(this)) {
            log('Звук сайта заблокирован: ' + (this.currentSrc || this.src));
            try { this.pause(); this.muted = true; this.volume = 0; } catch (e) {}
            return Promise.resolve();
          }
          return origPlay.apply(this, arguments);
        };
        proto.__sessionKeeperPatched = true;
      }
    } catch (e) {}

    // 2. глушим уже существующие в разметке <audio>
    function sweep() {
      try {
        document.querySelectorAll('audio, video').forEach(function (el) {
          if (isBlockedSound(el)) {
            try { el.pause(); el.muted = true; el.volume = 0; el.autoplay = false; } catch (e) {}
          }
        });
      } catch (e) {}
    }
    sweep();
    document.addEventListener('DOMContentLoaded', sweep);

    // 3. ловим динамически добавленные элементы
    try {
      new MutationObserver(sweep).observe(document.documentElement, {
        childList: true, subtree: true
      });
    } catch (e) {}
  }

  muteSiteSound();

  /* -------------------------------------------------------------
     ОБЩЕЕ
  -------------------------------------------------------------- */

  const IS_TOP = (window.top === window.self);
  const path = location.pathname.toLowerCase();

  const COLOR_ON   = '#49D892';
  const COLOR_OFF  = '#7E8B8F';
  const KEEPALIVE_URL = '/plm.net/SessionKeepAlive.ashx';
  const LOGIN_URL     = '/plm.net/LoginPage.aspx';

  const STORAGE_ENABLED_KEY   = 'sessionKeeper_enabled_v4_1';
  const STORAGE_COLLAPSED_KEY = 'sessionKeeper_collapsed_v4_1';

  let keepAliveId = null, watchId = null, heartbeatId = null;
  let lastClickAt = 0, lastBeat = Date.now();
  let kaMethod = 'GET';        // переключится на POST, если GET не принимают
  let deadStreak = 0;          // сколько проверок подряд сказали "мертва"
  let netFails = 0;            // сколько запросов подряд не дошли (VPN/сеть)
  let bannerDismissed = false;

  const STATS = { ka: 0, kaLast: '-', saves: 0, saveLast: '-', state: '?' };

  function log()  { if (VERBOSE) console.log.apply(console, ['[SessionKeeper]'].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, ['[SessionKeeper]'].concat([].slice.call(arguments))); }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isEnabled() { const s = safeGet(STORAGE_ENABLED_KEY); return s === null ? true : s === '1'; }
  function setEnabled(v) { safeSet(STORAGE_ENABLED_KEY, v ? '1' : '0'); }
  let isCollapsed = safeGet(STORAGE_COLLAPSED_KEY) === '1';

  function isPopupWindow() {
    const w = window.outerWidth || window.innerWidth;
    const h = window.outerHeight || window.innerHeight;
    return (w < 900 || h < 600) ||
      path.includes('customernotes')    || path.includes('customerfiles')  ||
      path.includes('loanremarks')      || path.includes('loanstatus')     ||
      path.includes('changeloanstatus') || path.includes('editloanremarks')||
      path.includes('createpayment');
  }
  const IS_POPUP = isPopupWindow();

  /* -------------------------------------------------------------
     2) KEEP-ALIVE — ОСТОРОЖНАЯ ВЕРСИЯ
     Возвращает промис со строкой: 'alive' | 'dead' | 'unknown'
  -------------------------------------------------------------- */

  function looksLikeLogin(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.indexOf('loginpage.aspx') !== -1 ||
           u.indexOf('/login') !== -1 ||
           u.indexOf('logout.ashx') !== -1;
  }

  function rawPing(method) {
    return fetch(KEEPALIVE_URL, {
      method: method,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
  }

  function keepAlive(reason) {
    return rawPing(kaMethod).then(function (r) {
      // Метод не подошёл — пробуем второй и запоминаем рабочий
      if ((r.status === 404 || r.status === 405) && kaMethod === 'GET') {
        log('GET не принят (' + r.status + '), пробую POST');
        kaMethod = 'POST';
        return rawPing('POST');
      }
      return r;
    }).then(function (r) {
      STATS.ka++;
      STATS.kaLast = r.status + '';

      // МЁРТВОЙ считаем только явный редирект на страницу входа
      if (looksLikeLogin(r.url) || (r.redirected && looksLikeLogin(r.url))) {
        deadStreak++;
        STATS.state = 'dead?';
        warn('KeepAlive увёл на страницу входа (' + r.status + '), подряд: ' + deadStreak);
        if (deadStreak >= 2) { STATS.state = 'dead'; showDeadBanner(); }
        return 'dead';
      }

      if (r.ok) {
        deadStreak = 0;
        STATS.state = 'alive';
        hideDeadBanner();
        if (netFails > 0) {   // связь вернулась — сразу пробуем закрыть окно
          netFails = 0;
          hideNetBanner();
          log('Связь восстановлена');
          setTimeout(checkOverlay, 100);
        }
        log('KeepAlive →', r.status, kaMethod, reason || '');
        return 'alive';
      }

      // Любой другой код — не повод объявлять логаут
      deadStreak = 0;
      STATS.state = 'unknown';
      warn('KeepAlive вернул ' + r.status + ' (' + kaMethod + '). ' +
           'Сессию мёртвой не считаю. Если так каждый раз — проверь endpoint: ' + KEEPALIVE_URL);
      return 'unknown';
    }).catch(function (e) {
      netFails++;
      STATS.kaLast = 'NET';
      STATS.state = 'offline';
      warn('НЕТ СВЯЗИ С СЕРВЕРОМ (' + netFails + ' подряд). ' +
           'Типичные причины: отключён VPN, упал Wi-Fi, уснул ноутбук. ' +
           'Пока связи нет, продлить сессию невозможно — ни скриптом, ни кнопкой "I\'m still here".', e);
      if (netFails >= 2) showNetBanner();
      return 'offline';
    });
  }

  function startKeepAlive() {
    if (keepAliveId !== null) return;
    keepAlive('start');
    keepAliveId = setInterval(function () { keepAlive('interval'); }, KEEPALIVE_EVERY_MS);
  }
  function stopKeepAlive() { clearInterval(keepAliveId); keepAliveId = null; }

  /* -------------------------------------------------------------
     3) + 4) СЛЕДИМ ЗА ИХ ОКНОМ
  -------------------------------------------------------------- */

  function visible(el) {
    if (!el) return false;
    try {
      if (el.offsetParent !== null) return true;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    } catch (e) { return false; }
  }

  function clickHard(el) {
    const o = { bubbles: true, cancelable: true, view: window, button: 0 };
    try { if (window.PointerEvent) el.dispatchEvent(new PointerEvent('pointerdown', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', o)); } catch (e) {}
    try { el.click(); } catch (e) { try { el.dispatchEvent(new MouseEvent('click', o)); } catch (e2) {} }
  }

  function checkOverlay() {
    if (!AUTO_CLICK || !isEnabled()) return;
    // без связи долбить кнопку бессмысленно — реже пробуем
    if (Date.now() - lastClickAt < (STATS.state === 'offline' ? 20000 : 3000)) return;

    const ov    = document.getElementById('sessionTimeoutOverlay');
    const btn   = document.getElementById('sessionStillHereBtn');
    const login = document.getElementById('sessionLoginBtn');

    if (ov && visible(ov)) {
      // Состояние "уже вылогинило"
      if (login && visible(login) && (!btn || !visible(btn))) {
        lastClickAt = Date.now();
        warn('Окно "session expired". Проверяю сессию на сервере...');
        keepAlive('recover').then(function (state) {
          if (state === 'alive' || state === 'unknown') {
            try { ov.style.display = 'none'; } catch (e) {}
            STATS.saves++; STATS.saveLast = new Date().toLocaleTimeString();
            console.log('%c[SessionKeeper] Сессия отвечает — окно убрано, работаем дальше.',
                        'color:#10b86a;font-weight:bold');
            flashUI();
          } else {
            warn('Сессия действительно закрыта — нужен повторный вход.');
          }
        });
        return;
      }

      // Обычное предупреждение
      if (btn && visible(btn)) {
        lastClickAt = Date.now();
        clickHard(btn);
        STATS.saves++; STATS.saveLast = new Date().toLocaleTimeString();
        console.log('%c[SessionKeeper] Нажал "I\'m still here" — сессия продлена.',
                    'color:#10b86a;font-weight:bold');
        flashUI();
        setTimeout(function () { keepAlive('after-click'); }, 500);
        return;
      }
    }

    genericFallback();
  }

  const STRICT = [/i.?\s*m\s+still\s+here/i, /still\s+here/i, /stay\s+(logged|signed)\s+in/i, /extend\s+(my\s+)?session/i];
  function genericFallback() {
    let nodes;
    try { nodes = document.querySelectorAll('button, input[type=button], input[type=submit], a, [role=button]'); }
    catch (e) { return; }
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!visible(el)) continue;
      const t = ((el.innerText || el.textContent || '') + ' ' + (el.value || '')).replace(/\s+/g, ' ').trim();
      if (!t || t.length > 40) continue;
      for (let j = 0; j < STRICT.length; j++) {
        if (STRICT[j].test(t)) {
          lastClickAt = Date.now();
          clickHard(el);
          STATS.saves++; STATS.saveLast = new Date().toLocaleTimeString();
          console.log('%c[SessionKeeper] Продлил сессию → "' + t + '"', 'color:#10b86a;font-weight:bold');
          flashUI();
          return;
        }
      }
    }
  }

  function startWatcher() {
    if (watchId !== null) return;
    watchId = setInterval(checkOverlay, WATCH_EVERY_MS);
    function observe() {
      const ov = document.getElementById('sessionTimeoutOverlay');
      if (!ov || ov.__skObs) return;
      ov.__skObs = true;
      try {
        new MutationObserver(function () { setTimeout(checkOverlay, 60); })
          .observe(ov, { attributes: true, attributeFilter: ['style', 'class'], childList: true, subtree: true });
      } catch (e) {}
    }
    observe();
    setTimeout(observe, 2000);
  }
  function stopWatcher() { clearInterval(watchId); watchId = null; }

  /* -------------------------------------------------------------
     ДЕТЕКТОР СНА / ЗАМОРОЗКИ
  -------------------------------------------------------------- */

  function startHeartbeat() {
    if (heartbeatId !== null) return;
    lastBeat = Date.now();
    heartbeatId = setInterval(function () {
      const now = Date.now(), gap = now - lastBeat;
      lastBeat = now;
      if (gap > 90 * 1000) {
        warn('Обнаружен разрыв ' + Math.round(gap / 1000) + ' сек ' +
             '(сон ноутбука / заморозка вкладки / потеря сети). Проверяю сессию...');
        keepAlive('after-gap');
        checkOverlay();
      }
    }, 10 * 1000);
  }

  /* -------------------------------------------------------------
     АНТИ-ЗАМОРОЗКА: тихий звук
  -------------------------------------------------------------- */

  function silentWavUri(seconds) {
    const rate = 8000, n = rate * seconds, bytes = 44 + n * 2;
    const buf = new ArrayBuffer(bytes), v = new DataView(buf);
    function str(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i * 0.05) * 6), true);
    let bin = '';
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function startAntiThrottle() {
    if (!ANTI_THROTTLE || !IS_TOP || IS_POPUP) return;
    let audio;
    try {
      audio = new Audio(silentWavUri(2));
      audio[OUR_AUDIO_FLAG] = true;   // чтобы наш же блокировщик его не глушил
      audio.loop = true; audio.volume = 1;
    }
    catch (e) { return; }
    function tryPlay() {
      audio.play().then(function () { log('Анти-заморозка: тихий звук включён'); })
                  .catch(function () {});
    }
    tryPlay();
    ['click', 'keydown', 'mousedown'].forEach(function (ev) {
      document.addEventListener(ev, function once() {
        document.removeEventListener(ev, once, true);
        tryPlay();
      }, true);
    });
  }

  /* -------------------------------------------------------------
     ПЛАШКА "СЕССИЯ ЗАКРЫТА" — внизу справа, с крестиком
  -------------------------------------------------------------- */

  function showDeadBanner() {
    if (!SHOW_DEAD_BANNER || bannerDismissed) return;
    if (!IS_TOP || !document.body) return;
    if (document.getElementById('session-keeper-dead')) return;

    const d = document.createElement('div');
    d.id = 'session-keeper-dead';
    Object.assign(d.style, {
      position: 'fixed', bottom: '46px', right: '14px', padding: '10px 14px',
      background: '#d23f3f', color: '#fff', fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: '12px', fontWeight: '700', borderRadius: '6px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.3)', zIndex: 2147483647, maxWidth: '280px'
    });

    const txt = document.createElement('span');
    txt.textContent = 'Сессия закрыта на сервере. ';
    const a = document.createElement('a');
    a.href = LOGIN_URL; a.textContent = 'Войти';
    a.style.color = '#fff'; a.style.textDecoration = 'underline';
    const x = document.createElement('span');
    x.textContent = '✕';
    Object.assign(x.style, { marginLeft: '10px', cursor: 'pointer', opacity: '0.85' });
    x.addEventListener('click', function () { bannerDismissed = true; hideDeadBanner(); });

    d.appendChild(txt); d.appendChild(a); d.appendChild(x);
    document.body.appendChild(d);
  }

  function hideDeadBanner() {
    const d = document.getElementById('session-keeper-dead');
    if (d && d.parentNode) d.parentNode.removeChild(d);
  }

  // Плашка "нет связи" — оранжевая, чтобы не путать с закрытой сессией
  function showNetBanner() {
    if (!SHOW_DEAD_BANNER || !IS_TOP || !document.body) return;
    if (document.getElementById('session-keeper-net')) return;

    const d = document.createElement('div');
    d.id = 'session-keeper-net';
    Object.assign(d.style, {
      position: 'fixed', bottom: '10px', right: '14px', padding: '10px 14px',
      background: '#e08a20', color: '#fff', fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: '12px', fontWeight: '700', borderRadius: '6px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.3)', zIndex: 2147483647, maxWidth: '300px'
    });
    const txt = document.createElement('span');
    txt.textContent = 'Нет связи с сервером — проверь VPN. Сессия не продлевается.';
    const x = document.createElement('span');
    x.textContent = '✕';
    Object.assign(x.style, { marginLeft: '10px', cursor: 'pointer', opacity: '0.85' });
    x.addEventListener('click', hideNetBanner);
    d.appendChild(txt); d.appendChild(x);
    document.body.appendChild(d);
  }

  function hideNetBanner() {
    const d = document.getElementById('session-keeper-net');
    if (d && d.parentNode) d.parentNode.removeChild(d);
  }

  /* -------------------------------------------------------------
     🎛️ КНОПКА
  -------------------------------------------------------------- */

  let flashUI = function () {};

  function createToggle() {
    if (!DEBUG_UI || !IS_TOP || IS_POPUP || !document.body) return;
    if (document.getElementById('session-keeper-toggle')) return;

    const btn = document.createElement('div');
    btn.id = 'session-keeper-toggle';
    const dot = document.createElement('span');
    const txt = document.createElement('span');
    const arr = document.createElement('span');
    btn.appendChild(dot); btn.appendChild(txt); btn.appendChild(arr);

    Object.assign(btn.style, {
      position: 'fixed', bottom: '10px', left: '10px', padding: '4px 12px',
      background: isEnabled() ? COLOR_ON : COLOR_OFF, color: '#fff',
      fontSize: '11px', fontWeight: '700', fontFamily: 'Segoe UI, Arial, sans-serif',
      borderRadius: '999px', cursor: 'pointer', zIndex: 2147483646, userSelect: 'none',
      boxShadow: '0 4px 10px rgba(0,0,0,0.25)', display: 'inline-flex', alignItems: 'center',
      gap: '6px', transition: 'background .2s ease, transform .1s ease, box-shadow .1s ease'
    });
    btn.addEventListener('mousedown', function () {
      btn.style.transform = 'translateY(1px)'; btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
    });
    btn.addEventListener('mouseup', function () {
      btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
    });

    Object.assign(dot.style, {
      display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)', flexShrink: '0'
    });
    Object.assign(txt.style, { whiteSpace: 'nowrap' });
    arr.textContent = '◀';
    Object.assign(arr.style, {
      marginLeft: '4px', fontSize: '11px', fontWeight: '700', color: '#fff',
      flexShrink: '0', opacity: '0.95'
    });

    function paint() {
      const on = isEnabled();
      btn.style.background = on ? COLOR_ON : COLOR_OFF;
      btn.title = 'Session Keeper v3.4' +
                  '\nKeep-alive: ' + STATS.ka + ' (' + kaMethod + ', последний: ' + STATS.kaLast + ')' +
                  '\nСостояние сессии: ' + STATS.state +
                  '\nАвтопродлений: ' + STATS.saves + ' (последнее: ' + STATS.saveLast + ')' +
                  '\nВстроенный таймер: ' + (KILL_SITE_TIMER ? 'отключён' : 'активен');
      dot.style.background = on
        ? 'radial-gradient(circle at 30% 30%, #d6ffe9, #10b86a)'
        : 'radial-gradient(circle at 30% 30%, #f2e9ff, #b89cff)';
      if (isCollapsed) {
        txt.textContent = ''; arr.style.display = 'none';
        btn.style.padding = '4px 8px'; btn.style.justifyContent = 'center'; btn.style.gap = '0px';
      } else {
        txt.textContent = on ? LABEL + ': ON' : LABEL + ': OFF';
        arr.style.display = 'inline';
        btn.style.padding = '4px 12px'; btn.style.justifyContent = 'flex-start'; btn.style.gap = '6px';
      }
    }

    btn.addEventListener('click', function () {
      if (isCollapsed) { isCollapsed = false; safeSet(STORAGE_COLLAPSED_KEY, '0'); paint(); return; }
      const on = !isEnabled();
      setEnabled(on);
      if (on) { startKeepAlive(); startWatcher(); } else { stopKeepAlive(); stopWatcher(); }
      paint();
    });
    arr.addEventListener('click', function (e) {
      e.stopPropagation(); isCollapsed = true; safeSet(STORAGE_COLLAPSED_KEY, '1'); paint();
    });

    flashUI = function () {
      try { btn.style.background = '#2f80ed'; setTimeout(paint, 900); } catch (e) {}
    };

    paint();
    setInterval(paint, 5000);
    document.body.appendChild(btn);
  }

  /* -------------------------------------------------------------
     🚀 СТАРТ
  -------------------------------------------------------------- */

  function init() {
    createToggle();
    if (isEnabled()) {
      startKeepAlive();
      startWatcher();
      startHeartbeat();
      startAntiThrottle();
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && isEnabled()) { checkOverlay(); keepAlive('visible'); }
    });
    window.addEventListener('focus', function () { if (isEnabled()) checkOverlay(); });
    window.addEventListener('online', function () {
      if (isEnabled()) keepAlive('online').then(function () { checkOverlay(); });
    });

    log('v3.4 started', IS_TOP ? '(main)' : '(frame)',
        '| таймер сайта:', KILL_SITE_TIMER ? 'отключён' : 'активен');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =================================================================
   ПРОВЕРКА (F12 → Console)

   1. window.sessionTimeoutWarningMs   → должно быть 2000000000
   2. Что реально отвечает endpoint:
        fetch('/plm.net/SessionKeepAlive.ashx', {credentials:'include'})
          .then(r => console.log(r.status, r.url, r.redirected));
      • 200 и тот же URL  → всё хорошо
      • 404/405           → скрипт сам переключится на POST
      • редирект на LoginPage.aspx → сессия правда закрыта
      Скинь мне этот вывод, если что-то ведёт себя странно.
   3. Тест окна:  $('#sessionTimeoutOverlay').show()
      → в течение секунды зелёная строка "Нажал I'm still here".
================================================================= */
