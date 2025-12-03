// ==UserScript==
// @name         Quick Assign Selector
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Quick lead assignment: type N and select N leads (bottom-up), add N leads, or clear selection. Saves N on refresh, hide toggle, compact UI.
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx?reportpreset=pending*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Quick_Assign_Selector.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Quick_Assign_Selector.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const isVisible = el => !!(el && el.offsetParent !== null);

  const getBoxes = () =>
    $$('input[name="processingAdminLoanIds"]').filter(isVisible).filter(b => !b.disabled);

  const countChecked = () => getBoxes().filter(b => b.checked).length;

  const clearOnly = () => getBoxes().forEach(cb => cb.checked = false);

  function clearPageAndZero() {
    clearOnly();
    setN(0);
    rafRefresh();
  }

  function selectLastN(n) {
    n = +n || 0; if (n <= 0) return rafRefresh();
    clearOnly();
    const boxes = getBoxes().reverse();
    for (let i = 0; i < boxes.length && i < n; i++) boxes[i].checked = true;
    rafRefresh();
  }

  function addNFromBottom(n) {
    n = +n || 0; if (n <= 0) return rafRefresh();
    let left = n;
    for (const cb of getBoxes().reverse()) {
      if (!cb.checked) { cb.checked = true; if (--left <= 0) break; }
    }
    rafRefresh();
  }

  // ---------- storage ----------
  const pageKey = (() => {
    const url = new URL(location.href);
    const preset = (url.searchParams.get('reportpreset') || 'default').toLowerCase();
    return `qas:${location.pathname}:${preset}`;
  })();
  const N_KEY   = `${pageKey}:n`;
  const VIS_KEY = `${pageKey}:visible`;

  const getStoredN = () => {
    const v = parseInt(localStorage.getItem(N_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  };
  const setStoredN = v => localStorage.setItem(N_KEY, String(v));
  const getStoredVisible = () => {
    const s = localStorage.getItem(VIS_KEY);
    return s === null ? true : s === 'true';
  };
  const setStoredVisible = b => localStorage.setItem(VIS_KEY, b ? 'true' : 'false');

  // ---------- UI ----------
  let bar, fab, counterEl, inputEl;

  const refreshCounter = () => {
    if (!counterEl) return;
    const total = getBoxes().length;
    const checked = countChecked();
    counterEl.textContent = `Checked: ${checked} / ${total}`;
  };
  const rafRefresh = () => requestAnimationFrame(refreshCounter);

  const getN  = () => parseInt(inputEl.value, 10) || 0;
  const setN  = v => { inputEl.value = String(v); setStoredN(v); };

  function injectStyles() {
    const css = `
    :root{
      --bg:#1f2937; --bg-light:#ffffff;
      --text:#e5e7eb; --text-dark:#0f172a;
      --muted:#94a3b8;
      --chip-bg:#374151; --chip-bg-light:#e5e7eb;
      --green:#22c55e; --blue:#3b82f6; --red:#ef4444;
      --input-bg:#1f2937; --input-bg-light:#f3f4f6;
      --border:#2b3544; --border-light:#e6eaf0;
      --shadow:0 4px 12px rgba(0,0,0,.10);
    }
    @media (prefers-color-scheme: light){
      :root{ --bg:var(--bg-light); --text:var(--text-dark); --muted:#64748b;
             --chip-bg:var(--chip-bg-light); --input-bg:var(--input-bg-light);
             --border:var(--border-light); }
    }

    #cc-toolbar{
      position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%);
      width: min(960px, calc(100% - 24px));
      background: var(--bg); color: var(--text);
      border: 1px solid var(--border); box-shadow: var(--shadow);
      border-radius: 12px; padding: 6px 10px; z-index: 9999;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    }
    #cc-toolbar .cc-inner{ display:flex; align-items:center; gap:12px; width:100%; }
    #cc-toolbar .cc-title{ font-weight:700; font-size:14px; white-space:nowrap; }

    /* input N (без внешнего степпера) */
    #cc-toolbar .cc-input{
      height: 32px; width: 86px; padding: 0 12px; text-align:center;
      border-radius: 9999px; border:1.5px solid rgba(255,255,255,.9); /* постоянная белая обводка */
      background: var(--input-bg); color:#fff; font-weight:500; font-size:14px;
      -moz-appearance:textfield; appearance:textfield;
    }
    #cc-toolbar .cc-input::-webkit-outer-spin-button,
    #cc-toolbar .cc-input::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; } /* скрыть стандартные спиннеры */
    @media (prefers-color-scheme: light){
      #cc-toolbar .cc-input{ color:#111; border-color:#cbd5e1; }
    }

    #cc-toolbar .cc-btn{
      height: 32px; padding: 6px 16px; border-radius:9999px; border:none;
      color:#fff; font-weight:600; font-size:14px;
      display:inline-flex; align-items:center; gap:8px; cursor:pointer;
      transition: filter .12s ease, transform .02s ease;
    }
    #cc-toolbar .cc-btn:active{ transform: translateY(1px); }
    #cc-toolbar .cc-btn:hover{ filter:brightness(.97); }
    #cc-toolbar .cc-green{ background: var(--green); }
    #cc-toolbar .cc-blue{  background: var(--blue);  }
    #cc-toolbar .cc-red{   background: var(--red);   }
    #cc-toolbar .cc-ic{ font-size:16px; line-height:1; }

    #cc-toolbar .cc-chip{
      padding: 6px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;
      background: var(--chip-bg); color: #e5e7eb; white-space: nowrap;
    }
    @media (prefers-color-scheme: light){ #cc-toolbar .cc-chip{ color:#111; } }

    #cc-toolbar .cc-eye{
      height: 32px; width: 32px; border-radius: 9999px; border: 1px solid var(--border);
      background: transparent; color: inherit; cursor: pointer;
      display:flex; align-items:center; justify-content:center;
    }

    #cc-fab{
      position: fixed; right: 12px; bottom: 12px; width: 44px; height: 44px;
      border-radius: 9999px; border: none; background: var(--blue); color: #fff;
      font-weight: 800; cursor: pointer; box-shadow: var(--shadow); z-index: 10000;
    }
    #cc-fab:hover{ filter: brightness(.97); }
    `;
    const style = document.createElement('style');
    style.id = 'cc-toolbar-styles';
    style.textContent = css;
    document.head.appendChild(style);

    // отступ снизу, чтобы панель не перекрывала элементы
    const pad = 64;
    const old = parseInt(getComputedStyle(document.body).paddingBottom || '0', 10);
    document.body.style.paddingBottom = Math.max(old, pad) + 'px';
  }

  const makeButton = ({text, color, icon}) => {
    const btn = document.createElement('button');
    btn.className = `cc-btn ${color}`;
    btn.innerHTML = `<span class="cc-ic">${icon}</span><span>${text}</span>`;
    return btn;
  };

  function buildToolbar() {
    bar = document.createElement('div');
    bar.id = 'cc-toolbar';
    bar.innerHTML = `<div class="cc-inner">
      <span class="cc-title">Quick Assign Selector</span>
      <input class="cc-input" id="cc-n" type="number" min="0" step="1" inputmode="numeric" />
      <div class="cc-btns"></div>
      <div class="cc-spacer" style="flex:1"></div>
      <span class="cc-chip" id="cc-count">Checked: 0 / 0</span>
      <button id="cc-hide" class="cc-eye" title="Hide">👁️</button>
    </div>`;
    document.body.appendChild(bar);

    const btns = bar.querySelector('.cc-btns');
    const btnSelect = makeButton({ text: 'Select N Leads', color: 'cc-green', icon: '✔️' });
    const btnAdd    = makeButton({ text: 'Add N Leads',    color: 'cc-blue',  icon: '➕' });
    const btnClear  = makeButton({ text: 'Clear Selection', color: 'cc-red',   icon: '🗑️' });
    btns.append(btnSelect, btnAdd, btnClear);

    inputEl   = $('#cc-n');
    counterEl = $('#cc-count');

    // восстановить N
    setN(getStoredN());

    // auto-clear 0
    inputEl.addEventListener('focus', () => { if (inputEl.value === '0') inputEl.value = ''; });
    inputEl.addEventListener('blur',  () => { if (inputEl.value.trim() === '') setN(0); else setStoredN(getN()); });
    inputEl.addEventListener('input', () => setStoredN(getN()));
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); selectLastN(getN()); } });

    btnSelect.addEventListener('click', () => selectLastN(getN()));
    btnAdd.addEventListener('click',    () => addNFromBottom(getN()));
    btnClear.addEventListener('click',  () => clearPageAndZero());

    $('#cc-hide').addEventListener('click', () => showToolbar(false));

    // лёгкий listener: только на изменения чекбоксов
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.name === 'processingAdminLoanIds') rafRefresh();
    }, { passive: true });

    // подогнать ширину под «Assign checked customers…» (один раз)
    const anchor = Array.from(document.querySelectorAll('table, div, span'))
      .find(el => /Assign checked customers to processing admin/i.test(el.textContent || ''));
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const widthHint = Math.min(960, Math.max(720, rect.width));
      bar.style.width = `min(${widthHint}px, calc(100% - 24px))`;
    }

    rafRefresh();
  }

  function buildFAB() {
    fab = document.createElement('button');
    fab.id = 'cc-fab';
    fab.textContent = 'QAS';
    fab.title = 'Show Quick Assign Selector';
    fab.addEventListener('click', () => showToolbar(true));
    document.body.appendChild(fab);
  }

  function showToolbar(show) {
    if (!bar || !fab) return;
    bar.style.display = show ? '' : 'none';
    fab.style.display = show ? 'none' : '';
    setStoredVisible(show);
  }

  // hotkey: Ctrl+Alt+Q
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === 'q')) {
      e.preventDefault();
      showToolbar(bar && bar.style.display === 'none');
    }
  }, { passive: true });

  // ---------- boot ----------
  injectStyles();
  buildToolbar();
  buildFAB();
  showToolbar(getStoredVisible());
})();
