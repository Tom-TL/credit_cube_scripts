// ==UserScript==
// @name         Bulk Open Tabs
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.3
// @description  Pending Loans report: open N (or 5/10/15/20/all) customers from visible list in new tabs
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx?reportpreset=pending 
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx?reportpreset=approvedoftoday
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx?reportpreset=deniedoftoday
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx?reportpreset=search
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Bulk_Open_Tabs.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Bulk_Open_Tabs.user.js
// @grant        none
// ==/UserScript==



(function () {
  'use strict';

  const SCRIPT_ID = 'cc_bulk_open_pending_loans_v1_7';
  if (document.getElementById(SCRIPT_ID)) return;

  // Speed: smaller = faster (too small may trigger popup blocking)
  const OPEN_DELAY_MS = 70;

  // -----------------------------
  // Helpers
  // -----------------------------
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function notify(msg) {
    if (typeof window.showAlert === 'function') window.showAlert(msg, null, false);
    else window.alert(msg);
  }

  function buildAbsoluteUrl(href) {
    try { return new URL(href, window.location.origin).href; }
    catch { return href; }
  }

  function getCustomerUrlsFromTable() {
    const table = $('table.DataTable.FixedHeader');
    if (!table) return [];

    const links = $all('tbody a[href*="CustomerDetails.aspx?customerid="]', table);

    const seen = new Set();
    const urls = [];
    for (const a of links) {
      const url = buildAbsoluteUrl(a.getAttribute('href') || '');
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }

  function setStatus(text, mode) {
    const el = $('#ccBulkOpenStatus');
    if (!el) return;

    el.textContent = text;

    el.classList.remove('ccok', 'ccwarn');
    if (mode === 'ok') el.classList.add('ccok');
    if (mode === 'warn') el.classList.add('ccwarn');

    window.clearTimeout(setStatus._t);
    setStatus._t = window.setTimeout(() => {
      el.classList.remove('ccok', 'ccwarn');
    }, 1600);
  }

  function showTooManyAlert(requested, available) {
    notify(`Only ${available} customer(s) are in the list.\nPlease enter a number up to ${available}.`);
    setStatus(`Only ${available} in the list.`, 'warn');
  }

  function showNoCustomersAlert() {
    notify('No customers found in the table.');
    setStatus('No customers found.', 'warn');
  }

  function parseN(inputEl) {
    const raw = String(inputEl.value || '').trim();
    if (!raw) return 0;
    const digitsOnly = raw.replace(/[^\d]/g, '');
    const n = Math.floor(Number(digitsOnly));
    return Number.isFinite(n) ? n : 0;
  }

  // ✅ Single-action open: 1 click -> 1 new tab (no double-open)
  function openInNewTabOnce(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // -----------------------------
  // Bulk open logic
  // -----------------------------
  function openCustomersExact(count) {
    const urls = getCustomerUrlsFromTable();
    const total = urls.length;

    if (total === 0) { showNoCustomersAlert(); return; }
    if (count > total) { showTooManyAlert(count, total); return; }
    if (count <= 0) {
      notify('Enter a number greater than 0.');
      setStatus('Enter N > 0.', 'warn');
      return;
    }

    setStatus(`Opening ${count} tab(s)...`, '');

    let i = 0;
    const tick = () => {
      if (i >= count) {
        setStatus(`Done: opened ${count} tab(s).`, 'ok');
        return;
      }
      try {
        openInNewTabOnce(urls[i]); // top -> bottom, exactly once
      } catch (e) {
        // no popup alerts; just status
        setStatus('Some tabs may have been blocked by the browser.', 'warn');
      }
      i++;
      window.setTimeout(tick, OPEN_DELAY_MS);
    };

    tick();
  }

  // -----------------------------
  // UI
  // -----------------------------
  function injectStyles() {
    const style = document.createElement('style');
    style.id = `${SCRIPT_ID}_style`;
    style.textContent = `
      #${SCRIPT_ID}{
        margin: 10px 0 6px 0;
        padding: 10px 12px;
        border: 1px solid #d7d7d7;
        background: #ffffff;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      #${SCRIPT_ID} .ccBulkLabel{
        font-weight: 700;
        color: #333;
        margin-right: 2px;
      }

      #${SCRIPT_ID} .ccBulkInput{
        width: 92px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid #cfcfcf;
        border-radius: 8px;
        outline: none;
        font-size: 12px;
        color: #111;
        background: #fff;
      }
      #${SCRIPT_ID} .ccBulkInput::placeholder{ color: #b5b5b5; }
      #${SCRIPT_ID} .ccBulkInput:focus{
        border-color: #7aa7ff;
        box-shadow: 0 0 0 2px rgba(122,167,255,0.25);
      }

      /* Presets (neutral) */
      #${SCRIPT_ID} .ccBulkBtn{
        height: 30px !important;
        padding: 0 12px !important;
        border-radius: 8px !important;
        border: 1px solid #cfcfcf !important;
        background: #f5f7fa !important;
        color: #1f2a37 !important;
        cursor: pointer !important;
        font-size: 12px !important;
        opacity: 1 !important;
        filter: none !important;
        text-shadow: none !important;
      }
      #${SCRIPT_ID} .ccBulkBtn:hover{ background: #eef2f7 !important; }

      /* LMS-like buttons (AButton) */
      #${SCRIPT_ID} a.ccAButton{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        padding: 0 12px;
        border-radius: 8px;
        text-decoration: none !important;
        cursor: pointer;
        user-select: none;
      }

      #${SCRIPT_ID} .ccDivider{
        width: 1px;
        height: 22px;
        background: #d9d9d9;
        margin: 0 4px 0 2px;
      }

      /* Right pill status */
      #ccBulkOpenStatus{
        margin-left: auto;
        font-size: 12px;
        color: #555;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid #e6e6e6;
        background: #fafafa;
        max-width: 680px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #ccBulkOpenStatus.ccok{
        color: #1f6f2a;
        border-color: rgba(31,111,42,.25);
        background: rgba(34,177,76,.12);
      }
      #ccBulkOpenStatus.ccwarn{
        color: #8a5a00;
        border-color: rgba(255,127,39,.25);
        background: rgba(255,127,39,.12);
      }
    `;
    document.head.appendChild(style);
  }

  function makePresetBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ccBulkBtn';
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }

  function makeLmsBtn(label, onClick) {
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'AButton ccAButton';
    a.textContent = label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return a;
  }

  // 100% clear "0" even if something sets it after focus
  function installZeroKiller(input) {
    function clearIfZero() {
      if (!input) return;
      if (String(input.value || '').trim() === '0') input.value = '';
    }

    function burstClear() {
      clearIfZero();
      const start = Date.now();
      (function loop() {
        clearIfZero();
        if (Date.now() - start < 250) requestAnimationFrame(loop);
      })();
      setTimeout(clearIfZero, 0);
      setTimeout(clearIfZero, 30);
      setTimeout(clearIfZero, 80);
      setTimeout(clearIfZero, 150);
    }

    input.addEventListener('focus', burstClear, true);
    input.addEventListener('click', burstClear, true);
    input.addEventListener('pointerdown', burstClear, true);
    input.addEventListener('mousedown', burstClear, true);
    input.addEventListener('input', clearIfZero, true);

    const mo = new MutationObserver(() => clearIfZero());
    try { mo.observe(input, { attributes: true, attributeFilter: ['value'] }); } catch {}
  }

  function mountUI() {
    const anchor = $('.Message'); // "Loans Count: X"
    const parent = anchor?.parentElement;
    if (!anchor || !parent) return false;

    injectStyles();

    const bar = document.createElement('div');
    bar.id = SCRIPT_ID;

    const label = document.createElement('span');
    label.className = 'ccBulkLabel';
    label.textContent = 'Open tabs:';
    bar.appendChild(label);

    const input = document.createElement('input');
    input.className = 'ccBulkInput';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.placeholder = '0';
    input.value = '';
    input.id = 'ccBulkOpenN';
    bar.appendChild(input);

    installZeroKiller(input);

    const btnOpen = makeLmsBtn('Open', () => openCustomersExact(parseN(input)));
    const btnClear = makeLmsBtn('Clear', () => { input.value = ''; input.focus(); setStatus('Cleared.', ''); });
    bar.appendChild(btnOpen);
    bar.appendChild(btnClear);

    const divider = document.createElement('div');
    divider.className = 'ccDivider';
    bar.appendChild(divider);

    // ✅ Fixed counts (ignore input value)
    bar.appendChild(makePresetBtn('Open 5',  () => openCustomersExact(5)));
    bar.appendChild(makePresetBtn('Open 10', () => openCustomersExact(10)));
    bar.appendChild(makePresetBtn('Open 15', () => openCustomersExact(15)));
    bar.appendChild(makePresetBtn('Open 20', () => openCustomersExact(20)));

    const btnAll = makeLmsBtn('Open All', () => openCustomersExact(getCustomerUrlsFromTable().length));
    bar.appendChild(btnAll);

    const status = document.createElement('div');
    status.id = 'ccBulkOpenStatus';
    status.textContent = 'Ready.';
    bar.appendChild(status);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnOpen.click();
    });

    parent.insertBefore(bar, anchor);
    return true;
  }

  (function init(retries = 20) {
    const ok = mountUI();
    if (ok) return;
    if (retries <= 0) return;
    setTimeout(() => init(retries - 1), 250);
  })();

})();
