// ==UserScript==
// @name         View_All_Buton_CRP
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  View all кнопки на Debt/Income/Flags Summary; каждая управляет ТОЛЬКО своей секцией. 
// @match        *://ibv.creditsense.ai/report/*
// @match        *://*.creditsense.ai/report/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/View_All_Buton_CRP.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/View_All_Buton_CRP.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // =========================
  // PERFORMANCE SETTINGS
  // =========================
  const BOOT_DELAY_MS = 600;
  const DEBOUNCE_MS = 120;

  // Fallback is rare (low load)
  const FALLBACK_INTERVAL_MS = 10000;

  // If React re-renders and buttons disappear, we can re-enable observer
  const REENABLE_OBSERVER_CHECK_MS = 1200;

  function normText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').toLowerCase();
  }

  // =========================
  // SHARED: Find all "eye" button candidates
  // =========================
  function getAllEyeCandidates() {
    const candidates = new Set();

    document.querySelectorAll('svg[data-testid*="Visibility"]').forEach(svg => {
      const btn = svg.closest('button');
      if (btn) candidates.add(btn);
    });

    document
      .querySelectorAll('button[aria-label*="view" i], button[title*="view" i]')
      .forEach(btn => candidates.add(btn));

    document
      .querySelectorAll('i[class*="eye"], i[class*="visibility"], svg[class*="eye"], svg[class*="visibility"]')
      .forEach(icon => {
        const btn = icon.closest('button');
        if (btn) candidates.add(btn);
      });

    // exclude collapse widgets
    return Array.from(candidates).filter(btn => {
      const full =
        ((btn.innerText || '') + ' ' +
          (btn.getAttribute('aria-label') || '') + ' ' +
          (btn.getAttribute('title') || '')
        ).toLowerCase();

      if (full.includes('collapse widgets')) return false;
      if (full.includes('collapse all')) return false;

      return true;
    });
  }

  function isCollapsedEye(btn) {
    const aria = btn.getAttribute('aria-expanded');
    if (aria === 'false') return true;
    if (aria === 'true') return false;

    const svg = btn.querySelector('svg[data-testid]');
    if (svg) {
      const id = (svg.getAttribute('data-testid') || '').toLowerCase();
      if (id.includes('visibilityoff')) return false; // expanded
      if (id.includes('visibility')) return true;     // collapsed
    }
    return true;
  }

  function toggleEyes(eyes, logPrefix) {
    if (!eyes.length) return;
    if (eyes.length > 160) return;

    const collapsed = [];
    const expanded = [];
    eyes.forEach(btn => (isCollapsedEye(btn) ? collapsed : expanded).push(btn));

    const openMode = collapsed.length >= expanded.length;
    const target = openMode ? collapsed : expanded;

    console.log(
      `${logPrefix} toggle: total=${eyes.length}, collapsed=${collapsed.length}, expanded=${expanded.length}, action=${openMode ? 'OPEN' : 'CLOSE'}`
    );

    target.forEach(btn => btn.click());
  }

  function createViewAllButton(className, onClick) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = 'View all';

    Object.assign(btn.style, {
      position: 'absolute',
      top: '50%',
      right: '18px',
      transform: 'translateY(-50%)',
      padding: '6px 18px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.6)',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      background: 'rgba(255,255,255,0.98)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
      zIndex: '5',
      transition: 'box-shadow 0.15s ease, background-color 0.15s ease'
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = '0 3px 10px rgba(0,0,0,0.35)';
      btn.style.backgroundColor = 'white';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.22)';
      btn.style.backgroundColor = 'rgba(255,255,255,0.98)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    return btn;
  }

  // ============================================================
  // STRICT HEADER BAR FINDER (Fix for "button attaches to rows")
  // ============================================================
  function isTransparent(bg) {
    if (!bg) return true;
    const s = bg.replace(/\s+/g, '').toLowerCase();
    return s === 'transparent' || s === 'rgba(0,0,0,0)';
  }

  function findHeaderBar({ title, mustHave = [], mustNotHave = [] }) {
    const divs = document.querySelectorAll('div');
    let best = null;
    let bestHeight = Infinity;

    const titleNeedle = title.toLowerCase();

    for (const el of divs) {
      const t = normText(el);
      if (!t.includes(titleNeedle)) continue;

      // must-have tokens
      let ok = true;
      for (const m of mustHave) {
        if (!t.includes(m)) { ok = false; break; }
      }
      if (!ok) continue;

      // must-not-have tokens (prevents attaching to table/body rows)
      for (const b of mustNotHave) {
        if (t.includes(b)) { ok = false; break; }
      }
      if (!ok) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 300) continue;

      // header bars are "short"
      if (rect.height < 28 || rect.height > 130) continue;

      // header bars usually have a solid bg (income green, flags red, debt orange)
      const bg = window.getComputedStyle(el).backgroundColor;
      if (isTransparent(bg)) continue;

      // Prefer the smallest height = most likely the header strip
      if (rect.height < bestHeight) {
        best = el;
        bestHeight = rect.height;
      }
    }

    return best;
  }

  // ============================================================
  // SECTION A) DEBT (Loans)
  // ============================================================
  function isLoanEyeButton(btn) {
    let el = btn;
    for (let i = 0; i < 15 && el; i++) {
      const t = normText(el);

      if (t.includes('income summary')) return false;
      if (t.includes('flags summary')) return false;

      if (t.includes('high interest payday and installment')) return true;
      if (t.includes('low interest payday and installment')) return true;

      el = el.parentElement;
    }
    return false;
  }

  function getLoanEyes() {
    return getAllEyeCandidates().filter(isLoanEyeButton);
  }

  function toggleLoans() {
    toggleEyes(getLoanEyes(), '[Debt View All]');
  }

  function getDebtBarElement() {
    // debt has stable tokens -> very strict
    return findHeaderBar({
      title: 'debt summary',
      mustHave: [
        'debt summary',
        'est. total active principal',
        'est. total monthly debit',
        'est. upcoming debit'
      ],
      mustNotHave: [
        'high interest payday and installment',
        'low interest payday and installment'
      ]
    });
  }

  let debtBtn = null;
  function ensureDebtButton() {
    document.querySelectorAll('.crp-debt-view-all-btn').forEach(el => {
      if (el !== debtBtn && el.parentElement) el.parentElement.removeChild(el);
    });

    const bar = getDebtBarElement();
    if (!bar) return false;

    if (!debtBtn) debtBtn = createViewAllButton('crp-debt-view-all-btn', toggleLoans);

    if (window.getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    if (debtBtn.parentElement !== bar) bar.appendChild(debtBtn);

    return true;
  }

  // ============================================================
  // SECTION B) INCOME
  // ============================================================
  function isIncomeEyeButton(btn) {
    let el = btn;
    for (let i = 0; i < 18 && el; i++) {
      const t = normText(el);

      if (t.includes('income summary')) return true;

      if (t.includes('debt summary')) return false;
      if (t.includes('flags summary')) return false;

      el = el.parentElement;
    }
    return false;
  }

  function getIncomeEyes() {
    return getAllEyeCandidates().filter(isIncomeEyeButton);
  }

  function toggleIncome() {
    toggleEyes(getIncomeEyes(), '[Income View All]');
  }

  function getIncomeBarElement() {
    // Strict: header must include "income summary" but NOT table/body labels
    return findHeaderBar({
      title: 'income summary',
      mustHave: ['income summary'],
      mustNotHave: [
        'primary income',
        'alt. income',
        'make primary',
        'add income',
        'avg. monthly income',
        'frequency / day',
        'est. next payday',
        'inconsistent'
      ]
    });
  }

  let incomeBtn = null;
  function ensureIncomeButton() {
    document.querySelectorAll('.crp-income-view-all-btn').forEach(el => {
      if (el !== incomeBtn && el.parentElement) el.parentElement.removeChild(el);
    });

    const bar = getIncomeBarElement();
    if (!bar) return false;

    if (!incomeBtn) incomeBtn = createViewAllButton('crp-income-view-all-btn', toggleIncome);

    if (window.getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    if (incomeBtn.parentElement !== bar) bar.appendChild(incomeBtn);

    return true;
  }

  // ============================================================
  // SECTION C) FLAGS
  // ============================================================
  function isFlagsEyeButton(btn) {
    let el = btn;
    for (let i = 0; i < 18 && el; i++) {
      const t = normText(el);

      if (t.includes('flags summary')) return true;

      if (t.includes('income summary')) return false;
      if (t.includes('debt summary')) return false;

      el = el.parentElement;
    }
    return false;
  }

  function getFlagsEyes() {
    return getAllEyeCandidates().filter(isFlagsEyeButton);
  }

  function toggleFlags() {
    toggleEyes(getFlagsEyes(), '[Flags View All]');
  }

  function getFlagsBarElement() {
    return findHeaderBar({
      title: 'flags summary',
      mustHave: ['flags summary'],
      mustNotHave: [
        'stop payments',
        'reversals',
        'nsf',
        'overdraft',
        'amount',
        'balance',
        'date',
        'company'
      ]
    });
  }

  let flagsBtn = null;
  function ensureFlagsButton() {
    document.querySelectorAll('.crp-flags-view-all-btn').forEach(el => {
      if (el !== flagsBtn && el.parentElement) el.parentElement.removeChild(el);
    });

    const bar = getFlagsBarElement();
    if (!bar) return false;

    if (!flagsBtn) flagsBtn = createViewAllButton('crp-flags-view-all-btn', toggleFlags);

    if (window.getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    if (flagsBtn.parentElement !== bar) bar.appendChild(flagsBtn);

    return true;
  }

  // ============================================================
  // OPTIMIZED OBSERVER (Variant 1)
  // ============================================================
  let observer = null;
  let observerEnabled = false;

  function allButtonsAttached() {
    return !!(
      debtBtn && incomeBtn && flagsBtn &&
      debtBtn.isConnected && incomeBtn.isConnected && flagsBtn.isConnected
    );
  }

  function enableObserver() {
    if (observerEnabled) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    observer = new MutationObserver(() => scheduleEnsure());
    observer.observe(root, { childList: true, subtree: true });

    observerEnabled = true;
  }

  function disableObserver() {
    if (!observerEnabled) return;
    try { observer.disconnect(); } catch {}
    observerEnabled = false;
    observer = null;
  }

  function ensureAllButtons() {
    const okDebt = ensureDebtButton();
    const okIncome = ensureIncomeButton();
    const okFlags = ensureFlagsButton();

    if (okDebt && okIncome && okFlags) {
      disableObserver(); // low load after attach
    } else {
      enableObserver();  // keep watching until correct headers appear
    }
  }

  let debounceTimer = null;
  function scheduleEnsure() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      try { ensureAllButtons(); } catch {}
    }, DEBOUNCE_MS);
  }

  function checkAndReenableObserverIfNeeded() {
    if (!allButtonsAttached()) {
      enableObserver();
      scheduleEnsure();
    }
  }

  // INIT
  setTimeout(() => {
    scheduleEnsure();
    enableObserver();
  }, BOOT_DELAY_MS);

  setInterval(() => {
    scheduleEnsure();
    checkAndReenableObserverIfNeeded();
  }, FALLBACK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(checkAndReenableObserverIfNeeded, REENABLE_OBSERVER_CHECK_MS);
    }
  });

})();


