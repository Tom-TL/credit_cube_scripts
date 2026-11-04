// ==UserScript==
// @name         Processing Admin Quick Search
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      3.2
// @description  Quick admin search field next to Processing Admin
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

     ADMIN_BLACKLIST = the ONLY names hidden from the suggestions.
     Everything else that exists in the LMS is shown, including
     admins created later — the list is re-read from the server
     automatically (see REFRESH_AFTER_MS).

     Names are compared case-insensitively and extra spaces are
     ignored, so "Millie  Cross" matches "millie cross".
  =============================================================== */

   const ADMIN_BLACKLIST = new Set([
    // Hidden from the Processing Admin suggestions.
    "ihor baa","igor ba","brian gonen","sean gonen",
    "shahaf lavi","jerry mcfly","adam mcgee","liam moss portfolio",
    "roman r","kyle samuel","mike stadnyk","alex vysotzky",
    "jessica woods","nicole lennon","zhanna yakymenko","enrique martinez",
    "helen o'riley","tim smith","trysha smith","stephanie bellar",
    "yuliia b","teddy buckland","daisy clark","abby buentipo",
    "leon collins","millie cross","kevin ericson","luna garcia",
    "mark davidson","molly green","craig greenberg","randy felix",
    "george c","mia crosswire","nadezhda k","chris turk",
    "jacob james","max williams","melanie williams","marketing m",
    "test admin","aa bot","voicebot voiso","teststore user",
    "true accord","ccg collections","rsc collections","iryna stadnyk_realstore",
    "oleksii suprun_realstore","donald white_realstore","iryna stadnyk","oleksii suprun",
    "donald white","viktoriia artomtseva","miguel gordon","yauhenia h",
    "yurii holskyi","vitalii k","oleksandr pilyugin","alex voloshyn",
    "raman vysotski","oleksandr bilokrynytskyi","anthony smith","yulia kalashnykov",
    "serhii bruh","bankruptcy admin","bk admin","deletecust admin",
    "chloe maison collections","liam moss collections","andrew ferguson drs","automatic payment plan bot",
    "marketing_walter m_miller","darwin kennedy","helga miller","william brightwell",
    "sandra wells","roy hadad","olivia bloom","michael goggins"
  ]);

  const HOST_ID        = 'cc-pa-host';
  const CSS_ID         = 'cc-pa-css';
  const DLIST_ID       = 'cc-pa-datalist';
  const IFRAME_ID      = 'cc-pa-iframe';       // reads the admin list
  const IFRAME_SAVE_ID = 'cc-pa-iframe-save';  // submits the change
  const CACHE_KEY      = 'cc_pa_admin_cache_v3';

  // The cached list is shown instantly, then silently refreshed when it is
  // older than this, so newly created admins turn up on their own.
  const REFRESH_AFTER_MS = 30 * 60 * 1000; // 30 minutes

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

  // Drops the blacklist, the "-- ... --" separators and empty entries,
  // then de-duplicates and sorts. Applied to fresh AND cached data.
  function normalizeNames(raw) {
    let arr = raw.map(n => (n || '').trim()).filter(Boolean)
                 .filter(n => !/^--.*--$/.test(n.trim()))
                 .filter(n => !ADMIN_BLACKLIST.has(norm(n)));
    const seen = new Set();
    arr = arr.filter(n => { const k = norm(n); if (seen.has(k)) return false; seen.add(k); return true; });
    arr.sort((a,b) => a.localeCompare(b,'en',{sensitivity:'base'}));
    return arr;
  }

  /* ===============================================================
     HIDDEN IFRAMES — one reads the list, one performs the save
  =============================================================== */

  function getOrCreateIframe(id = IFRAME_ID) {
    let f = $('#' + id);
    if (!f) {
      f = document.createElement('iframe');
      f.id = id;
      f.style.cssText = 'display:none !important; width:0; height:0; border:0; position:fixed; top:-9999px; left:-9999px;';
      document.body.appendChild(f);
    }
    return f;
  }

  /**
   * Load EditProcessingAdmin.aspx in a hidden iframe and resolve with the form parts.
   */
  function loadIframePage(loanId, iframeId = IFRAME_ID) {
    return new Promise((resolve, reject) => {
      const iframe = getOrCreateIframe(iframeId);
      const url = `EditProcessingAdmin.aspx?loanid=${loanId}`;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('iframe load timeout')); }
      }, 15000);

      iframe.onload = function onLoad() {
        if (settled) return;
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          // Redirected to ClosePopup => already submitted
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
            settled = true; clearTimeout(timeout);
            reject(new Error('Form not found in iframe'));
          }
        } catch (e) {
          settled = true; clearTimeout(timeout);
          reject(e);
        }
      };

      iframe.src = url;
    });
  }

  /* ===============================================================
     ADMIN LIST — cache for speed, server for freshness
  =============================================================== */

  // Cache format: { ts: <epoch ms>, names: [...] }
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) return { ts: 0, names: obj };          // legacy
      if (obj && Array.isArray(obj.names)) return { ts: obj.ts || 0, names: obj.names };
    } catch { /* fall through */ }
    localStorage.removeItem(CACHE_KEY);
    return null;
  }

  function writeCache(names) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), names }));
    } catch { /* quota — not fatal */ }
  }

  async function ensureAdminList(loanId) {
    if (loadState === 'loading') return;

    // 1) Paint from cache immediately. The blacklist is re-applied every
    //    time, so editing ADMIN_BLACKLIST works without clearing storage.
    const cached = readCache();
    if (cached) {
      adminNames = normalizeNames(cached.names);
      fillDatalist(adminNames);
      loadState = 'done';
      if (Date.now() - cached.ts < REFRESH_AFTER_MS) return; // still fresh
    }

    // 2) Re-read from the server so new admins appear by themselves.
    loadState = 'loading';
    try {
      const { sel } = await loadIframePage(loanId);
      const raw   = [...sel.options].map(o => o.textContent.trim());
      const fresh = normalizeNames(raw);
      if (fresh.length) {
        adminNames = fresh;
        fillDatalist(adminNames);
        writeCache(raw);   // store RAW so blacklist edits apply retroactively
      }
      loadState = 'done';
    } catch (e) {
      console.warn('[CC-PA] Failed to refresh admin list:', e);
      loadState = cached ? 'done' : 'idle';   // keep cache, retry if we had none
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
      // Step 1: load the form (own iframe, so a background refresh can't clash)
      const result = await loadIframePage(loanId, IFRAME_SAVE_ID);
      if (result.closed) throw new Error('Unexpected ClosePopup on load');

      const { sel, btn, win } = result;

      // Step 2: find the option — exact match first, then unique prefix match
      const wanted = norm(name);
      const opts = [...sel.options].filter(o => o.value);
      let opt = opts.find(o => norm(o.textContent) === wanted);
      if (!opt) {
        const partial = opts.filter(o => norm(o.textContent).startsWith(wanted));
        if (partial.length === 1) opt = partial[0];
        else if (partial.length > 1) throw new Error(`"${name}" is ambiguous`);
      }
      if (!opt) throw new Error(`Admin "${name}" not found in list`);

      // Step 3: select it
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 4: submit and wait for the response page
      await new Promise((resolve, reject) => {
        const iframe = getOrCreateIframe(IFRAME_SAVE_ID);
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('Submit timeout')); }
        }, 15000);

        iframe.onload = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();   // any navigation after submit = done
        };

        const onclick = btn.getAttribute('onclick') || '';
        const m = onclick.match(/__doPostBack\('([^']+)','([^']*)'\)/);
        if (m && typeof win.__doPostBack === 'function') {
          win.__doPostBack(m[1], m[2]);
        } else {
          btn.click();
        }
      });

      // Step 5: stop the observer (prevents a double-reload race), then reload
      btnSet.textContent = '✓';
      if (observer) observer.disconnect();
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
  =============================================================== */

  function tryInject() {
    if (isModalOpen()) return;

    const anchor = getAnchor();
    if (!anchor) return;

    const loanId = getLoanId(anchor);
    if (!loanId) return;

    const labelCell = getLabelCell(anchor);
    if (!labelCell) return;

    // Already injected in this exact cell → nothing to do
    const existing = $('#' + HOST_ID);
    if (existing && labelCell.contains(existing)) return;
    if (existing) existing.remove();   // stale/orphaned host

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

    labelCell.appendChild(host);

    /* ---------- events ---------- */
    btnSet.addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) return;
      const id = getLoanId(getAnchor());
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

    input.addEventListener('focus', () => ensureAdminList(loanId));

    ensureAdminList(loanId);   // background preload
  }

  /* ===============================================================
     INIT
  =============================================================== */

  injectCSS();
  ensureDatalist();
  getOrCreateIframe(IFRAME_ID);
  getOrCreateIframe(IFRAME_SAVE_ID);

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
