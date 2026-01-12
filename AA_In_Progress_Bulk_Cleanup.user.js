// ==UserScript==
// @name         AA In Progress Bulk Cleanup
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Removes "AA In Progress" status for ALL loans in Pending report via background POST to EditStatus.aspx (no tabs/popups, no page reload).
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/AA_In_Progress_Bulk_Cleanup.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/AA_In_Progress_Bulk_Cleanup.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==





(function () {
  'use strict';

  // -------------------------
  // Settings
  // -------------------------
  const REQUIRED_PRESET = 'pending';
  const STATUS_LABEL_TEXT = 'AA In Progress';
  const BTN_TEXT = 'Remove all AA In Progress statuses';

  const PER_LOAN_DELAY_MS = 250;
  const IFRAME_LOAD_TIMEOUT_MS = 30000;

  // If your report is filtered to AA In Progress = Yes, keep true (faster).
  const ONLY_ROWS_THAT_CONTAIN_AA_TEXT = true;

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const qs = (sel, root = document) => root.querySelector(sel);

  function isPendingPresetPage() {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('reportpreset') || '').toLowerCase() === REQUIRED_PRESET;
    } catch {
      return false;
    }
  }

  function ensureWorkerFrame() {
    let frame = qs('#cc-aa-remove-worker');
    if (frame) return frame;

    frame = document.createElement('iframe');
    frame.id = 'cc-aa-remove-worker';
    frame.name = 'cc-aa-remove-worker';
    frame.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      left: -9999px;
      top: -9999px;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(frame);
    return frame;
  }

  async function loadInFrame(frame, url) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Frame load timeout: ' + url)), IFRAME_LOAD_TIMEOUT_MS);
      frame.onload = () => {
        clearTimeout(t);
        resolve();
      };
      frame.src = url;
    });
  }

  function createPanel() {
    if (qs('#cc-aa-remove-panel')) return qs('#cc-aa-remove-panel');

    const panel = document.createElement('div');
    panel.id = 'cc-aa-remove-panel';
    panel.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
      background: rgba(25, 25, 25, 0.92);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      padding: 10px 12px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      min-width: 430px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.35);
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:700;">AA In Progress remover</div>
        <button id="cc-aa-x" style="cursor:pointer; border:none; background:transparent; color:#fff; font-size:16px; line-height:16px;">×</button>
      </div>

      <div style="margin-top:8px; display:flex; gap:8px;">
        <button id="cc-aa-run" style="
          cursor:pointer; border:none; background:#ff7a00; color:#111; font-weight:700;
          border-radius:8px; padding:8px 10px; flex:1;
        ">${BTN_TEXT}</button>

        <button id="cc-aa-stop" style="
          cursor:pointer; border:1px solid rgba(255,255,255,.25); background:transparent; color:#fff;
          font-weight:700; border-radius:8px; padding:8px 10px; width:84px;
        " title="Stop current run">Stop</button>
      </div>

      <div id="cc-aa-status" style="margin-top:8px; opacity:0.95;">Ready.</div>
      
      <div id="cc-aa-err" style="margin-top:6px; opacity:0.9; font-size:11px; color:#ffd7d7; display:none;"></div>
    `;

    document.body.appendChild(panel);
    qs('#cc-aa-x', panel).addEventListener('click', () => panel.remove());
    return panel;
  }

  // -------------------------
  // Collect loans (from Name links)
  // -------------------------
  function extractLoanIdFromRow(tr) {
    const tds = Array.from(tr.querySelectorAll('td'));
    for (const td of tds) {
      const t = (td.textContent || '').trim();
      if (/^\d{7,9}$/.test(t)) return t;
    }
    const rowText = (tr.textContent || '').replace(/\s+/g, ' ').trim();
    const m = rowText.match(/\b\d{7,9}\b/);
    return m ? m[0] : null;
  }

  function collectLoansFromCurrentView() {
    const anchors = Array.from(document.querySelectorAll('a[href*="CustomerDetails.aspx?customerid="]'));
    const map = new Map();

    for (const a of anchors) {
      const tr = a.closest('tr');
      if (!tr) continue;

      const loanId = extractLoanIdFromRow(tr);
      if (!loanId) continue;

      const name = (a.textContent || '').trim();
      const rowText = (tr.textContent || '');
      const hasAA = rowText.includes('AA In Progress');

      if (!map.has(loanId)) map.set(loanId, { loanId, name, hasAA });
    }
    return Array.from(map.values());
  }

  function getPagerNextButton() {
    const next = qs('#maincontent_PagerNextLinkButton');
    if (!next) return null;

    const href = (next.getAttribute('href') || '').trim();
    const cls = (next.getAttribute('class') || '').trim();
    const disabled = cls.includes('aspNetDisabled') || href === '' || href === '#' || href === 'javascript:void(0)';
    return disabled ? null : next;
  }

  async function collectAllPages(statusEl) {
    const all = new Map();
    let page = 0;

    while (page < 200) {
      page++;

      const items = collectLoansFromCurrentView();
      for (const it of items) if (!all.has(it.loanId)) all.set(it.loanId, it);

      statusEl.textContent = `Collecting loans… Found ${all.size} (scan page ${page}).`;

      const next = getPagerNextButton();
      if (!next) break;

      const firstBefore = items[0]?.loanId || '';
      next.click();

      let changed = false;
      for (let i = 0; i < 70; i++) {
        await sleep(200);
        const now = collectLoansFromCurrentView();
        const firstAfter = now[0]?.loanId || '';
        if (firstAfter && firstAfter !== firstBefore) { changed = true; break; }
      }
      if (!changed) break;
    }

    return Array.from(all.values());
  }

  // -------------------------
  // EditStatus.aspx POST (FIXED URL RESOLUTION)
  // -------------------------
  function findCheckboxByLabelText(doc, labelText) {
    const labels = Array.from(doc.querySelectorAll('label'));
    const lbl = labels.find(l => (l.textContent || '').trim() === labelText);

    if (lbl) {
      const forId = lbl.getAttribute('for');
      if (forId) {
        const input = doc.getElementById(forId);
        if (input && input.type === 'checkbox') return input;
      }
      const wrapped = lbl.querySelector('input[type="checkbox"]');
      if (wrapped) return wrapped;
    }

    const cbs = Array.from(doc.querySelectorAll('input[type="checkbox"]'));
    for (const cb of cbs) {
      const t = (cb.parentElement?.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === labelText || t.includes(labelText)) return cb;
    }

    return null;
  }

  function findUpdateButton(doc) {
    const btns = Array.from(doc.querySelectorAll('input[type="submit"], input[type="button"], button'));
    return btns.find(b => ((b.value || b.textContent || '').trim().toLowerCase() === 'update')) || null;
  }

  function formDataToUrlEncoded(fd) {
    const usp = new URLSearchParams();
    for (const [k, v] of fd.entries()) usp.append(k, v);
    return usp;
  }

  async function postEditStatusForm(frameWin, doc, form, updateBtn, uncheckedCheckbox) {
    const fd = new FormData(form);

    // Ensure Update submit included
    const btnName = updateBtn?.getAttribute('name');
    const btnVal = updateBtn?.getAttribute('value') || updateBtn?.value || 'Update';
    if (btnName && !fd.has(btnName)) fd.append(btnName, btnVal);

    // Ensure checkbox removed from payload (unchecked)
    if (uncheckedCheckbox && uncheckedCheckbox.name) fd.delete(uncheckedCheckbox.name);

    // ✅ FIX: resolve action relative to the iframe page, NOT the parent report page
    const actionRaw = (form.getAttribute('action') || '').trim();
    const actionUrl = new URL(actionRaw || frameWin.location.href, frameWin.location.href).toString();

    const body = formDataToUrlEncoded(fd);

    const resp = await fetch(actionUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body
    });

    // Helpful debug
    if (!resp.ok) {
      throw new Error(`POST failed (${resp.status}) -> ${actionUrl}`);
    }

    return true;
  }

  async function removeAAForLoan(frame, loanId) {
    const url = `/plm.net/customers/EditStatus.aspx?loanid=${loanId}`;
    await loadInFrame(frame, url);

    const d = frame.contentDocument;
    const w = frame.contentWindow;
    if (!d || !w) throw new Error('No iframe content');

    // Wait for form + checkbox
    let form = null;
    let cb = null;
    for (let i = 0; i < 60; i++) {
      form = d.querySelector('form');
      cb = findCheckboxByLabelText(d, STATUS_LABEL_TEXT);
      if (form && cb) break;
      await sleep(150);
    }
    if (!form) throw new Error(`Form not found (loan ${loanId})`);
    if (!cb) throw new Error(`"${STATUS_LABEL_TEXT}" checkbox not found (loan ${loanId})`);

    if (!cb.checked) return 'already_off';

    cb.checked = false;

    const updateBtn = findUpdateButton(d);
    if (!updateBtn) throw new Error(`Update button not found (loan ${loanId})`);

    await postEditStatusForm(w, d, form, updateBtn, cb);
    return 'removed';
  }

  // -------------------------
  // Run
  // -------------------------
  let STOP = false;

  async function run(statusEl, btnEl, errEl) {
    STOP = false;
    errEl.style.display = 'none';
    errEl.textContent = '';

    btnEl.disabled = true;
    btnEl.style.opacity = '0.65';

    statusEl.textContent = 'Collecting loans from report…';

    const allLoans = await collectAllPages(statusEl);
    if (!allLoans.length) {
      statusEl.textContent = 'No loans found. (Try: Show all pages + Generate Report)';
      btnEl.disabled = false;
      btnEl.style.opacity = '1';
      return;
    }

    const targets = ONLY_ROWS_THAT_CONTAIN_AA_TEXT ? allLoans.filter(x => x.hasAA) : allLoans;
    if (!targets.length) {
      statusEl.textContent = `Loans found: ${allLoans.length}, but none matched AA text. Set ONLY_ROWS_THAT_CONTAIN_AA_TEXT=false to brute-force.`;
      btnEl.disabled = false;
      btnEl.style.opacity = '1';
      return;
    }

    const frame = ensureWorkerFrame();

    let ok = 0, already = 0, fail = 0;

    statusEl.textContent = `Starting… Targets: ${targets.length}.`;

    for (let i = 0; i < targets.length; i++) {
      if (STOP) break;

      const t = targets[i];
      statusEl.textContent = `(${i + 1}/${targets.length}) ${t.name ? t.name + ' — ' : ''}loan ${t.loanId}… | OK:${ok} Already:${already} Fail:${fail}`;

      try {
        const res = await removeAAForLoan(frame, t.loanId);
        if (res === 'already_off') already++;
        else ok++;
      } catch (e) {
        fail++;
        errEl.style.display = 'block';
        errEl.textContent = `Last error: ${e.message || e}`;
        console.warn('[AA Remove] Failed', t, e);
      }

      await sleep(PER_LOAN_DELAY_MS);
    }

    statusEl.textContent = STOP
      ? `Stopped. OK:${ok}, Already:${already}, Failed:${fail}.`
      : `Done. OK:${ok}, Already:${already}, Failed:${fail}. Refresh report to verify.`;

    btnEl.disabled = false;
    btnEl.style.opacity = '1';
  }

  // -------------------------
  // Boot
  // -------------------------
  if (!isPendingPresetPage()) return;

  const panel = createPanel();
  const statusEl = qs('#cc-aa-status', panel);
  const btnEl = qs('#cc-aa-run', panel);
  const stopEl = qs('#cc-aa-stop', panel);
  const errEl = qs('#cc-aa-err', panel);

  stopEl.addEventListener('click', () => { STOP = true; });

  btnEl.addEventListener('click', () => {
    const sure = confirm(
      'Remove "AA In Progress" for ALL loans in this Pending list?\n\n' +
      'Tip: enable "Show all pages" and filter AA In Progress = Yes.\n' +
      'Runs in background and will NOT reload your report page.'
    );
    if (!sure) return;

    run(statusEl, btnEl, errEl).catch((e) => {
      console.error(e);
      errEl.style.display = 'block';
      errEl.textContent = `Fatal: ${e.message || e}`;
      statusEl.textContent = 'Stopped with error.';
      btnEl.disabled = false;
      btnEl.style.opacity = '1';
    });
  });
})();
