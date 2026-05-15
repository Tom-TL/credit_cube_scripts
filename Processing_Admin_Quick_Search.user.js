// ==UserScript==
// @name         Processing Admin Quick Search
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      2.5
// @description  Qucik admin search field next to Processing Admin
// @match        *://apply.creditcube.com/plm.net/*CustomerDetails.aspx*
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Processing_Admin_Quick_Search.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Processing_Admin_Quick_Search.user.js
// @grant        none
// ==/UserScript==



(function () {
  'use strict';

  /* ===============================================================
     CONFIG
  =============================================================== */

  const ADMIN_BLACKLIST = new Set([
    "ihor baa","igor ba","brian gonen","sean gonen","shahaf lavi","jerry mcfly","adam mcgee",
    "liam moss portfolio","roman r","kyle samuel","mike stadnyk","alex vysotzky",
    "jessica woods","nicole lennon","zhanna yakymenko","enrique martinez",
    "helen o'riley","tim smith","trysha smith","stephanie bellar","yuliia b",
    "teddy buckland","daisy clark","abby buentipo","leon collins","millie cross",
    "kevin ericson","luna garcia","mark davidson","molly green","craig greenberg","randy felix",
    "george c","mia crosswire","nadezhda k","chris turk","jacob james","max williams","melanie williams",
    "-- corporate --","-- creditcube --","-- creditcube / creditcube --","-- creditcube / test store --",
    "marketing m","test admin","aa bot","voicebot voiso","teststore user",
    "true accord","ccg collections","rsc collections",
    "iryna stadnyk_realstore","oleksii suprun_realstore","donald white_realstore",
    "iryna stadnyk","oleksii suprun","donald white",
    "viktoriia artomtseva","miguel gordon","yauhenia h","yurii holskyi","vitalii k",
    "oleksandr pilyugin","alex voloshyn","raman vysotski"
  ]);

  const HOST_ID   = 'cc-pa-host';
  const CSS_ID    = 'cc-pa-css';
  const DLIST_ID  = 'cc-pa-datalist';
  const IFRAME_ID = 'cc-pa-iframe';
  const CACHE_KEY = 'cc_pa_admin_cache_v2.4';

  /* ===============================================================
     STATE
  =============================================================== */

  let adminNames = [];
  let loadState  = 'idle';
  let setSaving  = false;
  let observer   = null;

  /* ===============================================================
     HELPERS
  =============================================================== */

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' &&
           parseFloat(s.opacity || '1') !== 0 &&
           el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  function isModalOpen() {
    return $$('.ui-dialog,[role="dialog"]').some(isVisible);
  }

  function getAnchor() {
    return $('a[href*="editprocessingadmin("]') ||
           $('a[onclick*="editprocessingadmin("]') ||
           $('a[href*="EditProcessingAdmin.aspx?loanid="]') ||
           $('a[onclick*="EditProcessingAdmin.aspx?loanid="]');
  }

  function getLoanId(anchor) {
    const txt = anchor?.getAttribute('href') || anchor?.getAttribute('onclick') || '';
    const m = txt.match(/editprocessingadmin\((\d+)\)/i) || txt.match(/loanid=(\d+)/i);
    return m ? m[1] : null;
  }

  // The <td> that CONTAINS the anchor (label cell) — widget goes here, after the link
  function getLabelCell(anchor) {
    return anchor?.closest('td') || null;
  }

  /* ===============================================================
     CSS
  =============================================================== */

  function injectCSS() {
    if ($('#' + CSS_ID)) return;
    const el = document.createElement('style');
    el.id = CSS_ID;
    el.textContent = `
      #${HOST_ID} {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 3px;
        background: #fff;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,.10);
        font-size: 11px;
        vertical-align: middle;
        line-height: 16px;
        margin-left: 5px;
      }
      #${HOST_ID} input[type=text] {
        width: 135px;
        height: 15px;
        font-size: 11px;
        padding: 0 3px;
        border: 1px solid #c8c8c8;
        border-radius: 3px;
        outline: none;
        line-height: 15px;
        box-sizing: border-box;
        vertical-align: middle;
      }
      #${HOST_ID} input[type=text]:focus {
        border-color: #5bc0de;
      }
      #${HOST_ID} .pa-btn {
        height: 17px;
        font-size: 11px;
        padding: 0 6px;
        border-radius: 3px;
        cursor: pointer;
        white-space: nowrap;
        line-height: 15px;
        box-sizing: border-box;
        vertical-align: middle;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      #${HOST_ID} .pa-set {
        border: 1px solid #46b8da;
        background: #5bc0de;
        color: #fff;
      }
      #${HOST_ID} .pa-set:hover    { background: #39b3d7; }
      #${HOST_ID} .pa-set:disabled { opacity: .5; cursor: default; }
      #${HOST_ID} .pa-clear {
        border: 1px solid #555;
        background: #222;
        color: #fff;
        font-weight: 700;
        padding: 0 5px;
      }
      #${HOST_ID} .pa-clear:hover { background: #444; }
    `;
    document.head.appendChild(el);
  }

  /* ===============================================================
     DATALIST
  =============================================================== */

  function ensureDatalist() {
    let d = $('#' + DLIST_ID);
    if (!d) {
      d = document.createElement('datalist');
      d.id = DLIST_ID;
      document.body.appendChild(d);
    }
    return d;
  }

  function fillDatalist(names) {
    ensureDatalist().innerHTML = names
      .map(n => `<option value="${esc(n)}">`)
      .join('');
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
                    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function normalizeNames(raw) {
    let arr = raw.map(n => (n||'').trim()).filter(Boolean)
                 .filter(n => !ADMIN_BLACKLIST.has(norm(n)));
    const seen = new Set();
    arr = arr.filter(n => { const k = norm(n); if (seen.has(k)) return false; seen.add(k); return true; });
    arr.sort((a,b) => a.localeCompare(b,'en',{sensitivity:'base'}));
    return arr;
  }

  /* ===============================================================
     HIDDEN IFRAME — used for BOTH loading options AND saving
  =============================================================== */

  function getOrCreateIframe() {
    let f = $('#' + IFRAME_ID);
    if (!f) {
      f = document.createElement('iframe');
      f.id = IFRAME_ID;
      f.style.cssText = 'display:none !important; width:0; height:0; border:0; position:fixed; top:-9999px; left:-9999px;';
      document.body.appendChild(f);
    }
    return f;
  }

  /**
   * Load the EditProcessingAdmin page in a hidden iframe and return
   * a Promise<{doc, sel, btn}> resolving when the form is ready.
   */
  function loadIframePage(loanId) {
    return new Promise((resolve, reject) => {
      const iframe = getOrCreateIframe();
      const url = `EditProcessingAdmin.aspx?loanid=${loanId}`;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('iframe load timeout')); }
      }, 15000);

      function onLoad() {
        if (settled) return;
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          // Check if we got redirected to ClosePopup (means already submitted)
          if (doc.location.href.includes('ClosePopup')) {
            settled = true; clearTimeout(timeout);
            resolve({ closed: true });
            return;
          }
          const sel = doc.querySelector('select');
          const btn = doc.querySelector('input[type=submit][value="Update"], input[value="Update"]');
          if (sel && btn) {
            settled = true; clearTimeout(timeout);
            resolve({ doc, sel, btn, iframe, win: iframe.contentWindow });
          } else {
            // Page loaded but form not found — might be an error page
            settled = true; clearTimeout(timeout);
            reject(new Error('Form not found in iframe'));
          }
        } catch (e) {
          settled = true; clearTimeout(timeout);
          reject(e);
        }
      }

      iframe.onload = onLoad;
      iframe.src = url;
    });
  }

  /* ===============================================================
     LOAD ADMIN LIST
  =============================================================== */

  async function ensureAdminList(loanId) {
    if (loadState === 'done') return;
    if (loadState === 'loading') return;
    loadState = 'loading';

    // Try cache first
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        adminNames = parsed;
        fillDatalist(adminNames);
        loadState = 'done';
        return;
      }
    } catch { localStorage.removeItem(CACHE_KEY); }

    // Load from page in hidden iframe
    try {
      const { sel } = await loadIframePage(loanId);
      const names = normalizeNames([...sel.options].map(o => o.textContent.trim()));
      adminNames = names;
      fillDatalist(adminNames);
      localStorage.setItem(CACHE_KEY, JSON.stringify(adminNames));
      loadState = 'done';
    } catch (e) {
      console.warn('[CC-PA] Failed to load admin list:', e);
      loadState = 'idle'; // allow retry
    }
  }

  /* ===============================================================
     SET ADMIN — fully hidden, no visible popup
  =============================================================== */

  async function setAdmin(loanId, name, btnSet) {
    if (setSaving) return;
    setSaving = true;
    btnSet.disabled = true;
    btnSet.textContent = '…';

    try {
      // Step 1: load the form
      const result = await loadIframePage(loanId);
      if (result.closed) throw new Error('Unexpected ClosePopup on load');

      const { doc, sel, btn, win } = result;

      // Step 2: find the option
      const wanted = norm(name);
      const opt = [...sel.options].find(o => norm(o.textContent) === wanted);
      if (!opt) throw new Error(`Admin "${name}" not found in list`);

      // Step 3: select it
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 4: submit and wait for the response page (ClosePopup or same page)
      await new Promise((resolve, reject) => {
        const iframe = getOrCreateIframe();
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('Submit timeout')); }
        }, 15000);

        iframe.onload = () => {
          if (settled) return;
          try {
            const d = iframe.contentDocument || iframe.contentWindow.document;
            // Any navigation after submit = success
            settled = true;
            clearTimeout(timeout);
            resolve();
          } catch { settled = true; clearTimeout(timeout); resolve(); }
        };

        // Use __doPostBack if available, otherwise click
        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/__doPostBack\('([^']+)','([^']*)'\)/);
        if (m && typeof win.__doPostBack === 'function') {
          win.__doPostBack(m[1], m[2]);
        } else {
          btn.click();
        }
      });

      // Step 5: disconnect observer (prevents double-reload race), then reload once
      btnSet.textContent = '✓';
      observer.disconnect();
      await sleep(400);
      location.reload();

    } catch (e) {
      console.error('[CC-PA] setAdmin error:', e);
      btnSet.textContent = '✗';
      btnSet.title = e.message || 'Error';
      setTimeout(() => { btnSet.textContent = 'Set'; btnSet.title = ''; }, 3000);
      btnSet.disabled = false;
      setSaving = false;
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ===============================================================
     UI INJECTION
     Widget is injected BEFORE the text content of the value <td>
  =============================================================== */

  function tryInject() {
    if (isModalOpen()) return;

    const anchor = getAnchor();
    if (!anchor) return;

    const loanId = getLoanId(anchor);
    if (!loanId) return;

    const labelCell = getLabelCell(anchor);
    if (!labelCell) return;

    // If host already lives inside this exact cell → nothing to do
    const existing = $('#' + HOST_ID);
    if (existing && labelCell.contains(existing)) return;

    // Remove stale/orphaned host
    if (existing) existing.remove();

    /* ---------- build widget ---------- */
    const host = document.createElement('span');
    host.id = HOST_ID;

    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', DLIST_ID);
    input.placeholder = 'Admin...';
    input.autocomplete = 'off';

    const btnSet = document.createElement('button');
    btnSet.className = 'pa-btn pa-set';
    btnSet.textContent = 'Set';

    const btnClear = document.createElement('button');
    btnClear.className = 'pa-btn pa-clear';
    btnClear.title = 'Clear';
    btnClear.textContent = '×';

    host.appendChild(input);
    host.appendChild(btnSet);
    host.appendChild(btnClear);

    /* ---------- append widget after the anchor link, no style changes to td ---------- */
    labelCell.appendChild(host);

    /* ---------- events ---------- */
    btnSet.addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) return;
      const a = getAnchor();
      const id = getLoanId(a);
      if (!id) return;
      setAdmin(id, val, btnSet);
    });

    btnClear.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      input.focus();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); btnSet.click(); }
    });

    input.addEventListener('focus', () => {
      ensureAdminList(loanId);
    });

    /* ---------- kick off background preload ---------- */
    ensureAdminList(loanId);
  }

  /* ===============================================================
     INIT
  =============================================================== */

  injectCSS();
  ensureDatalist();
  getOrCreateIframe();   // pre-create so it's in the DOM

  // MutationObserver with debounce — re-injects after every AJAX refresh
  let debounceTimer = null;
  observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryInject, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Fallback timers
  setTimeout(tryInject, 600);
  setTimeout(tryInject, 1500);
  setTimeout(tryInject, 3500);

})();

