// ==UserScript==
// @name         AA In Progress Bulk Cleanup
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      2.6
// @description  Removes "AA In Progress" status for ALL loans in Pending report via background POST to EditStatus.aspx, optionally reassigning Processing Admin from "AA Bot" to "-- no admin --" (no tabs/popups, no page reload).
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
  const AA_FILTER_HEADER = 'AA In Progress:';

  const BTN_TEXT = 'Remove all AA In Progress statuses';
  const BTN2_TEXT = 'Remove AA In Progress and reassign from AA bot';

  const PER_LOAN_DELAY_MS = 250;
  const IFRAME_LOAD_TIMEOUT_MS = 30000;

  // Blocking confirm() dialog before a run. Off by default:
  // the panel only exists when the filters are already correct,
  // and the first seconds of a run are a harmless "collecting" phase.
  const CONFIRM_BEFORE_RUN = false;

  // Safety window after a click, before anything is written.
  // Counts down in the status line; "Stop" cancels. Set to 0 to disable.
  const ARM_DELAY_MS = 3000;

  // How many loans go into a single "assign processing admin" postback
  const ASSIGN_CHUNK_SIZE = 100;

  // If your report is filtered to AA In Progress = Yes, keep true (faster).
  const ONLY_ROWS_THAT_CONTAIN_AA_TEXT = true;

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const qs = (sel, root = document) => root.querySelector(sel);
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function isPendingPresetPage() {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('reportpreset') || '').toLowerCase() === REQUIRED_PRESET;
    } catch {
      return false;
    }
  }

  // -------------------------
  // Filter guards (AA In Progress = Yes, Processing Admin = All Admins)
  // -------------------------
  function getFilterRowByHeader(headerText) {
    const tds = Array.from(document.querySelectorAll('td.FilterHeader'));
    const want = headerText.toLowerCase();
    const td = tds.find((t) => norm(t.textContent).toLowerCase() === want);
    return td ? td.parentElement : null;
  }

  function isAAInProgressYes() {
    const tr = getFilterRowByHeader(AA_FILTER_HEADER);
    if (!tr) return false;
    const yes = tr.querySelector('input[type="radio"][value="yes"]');
    return !!(yes && yes.checked);
  }

  function isProcessingAdminAll() {
    const container = qs('#maincontent_ProcessingAdmins_Container');
    if (!container) return false;

    const modeCb = qs('#maincontent_ProcessingAdmins_checkboxMode');
    if (modeCb && modeCb.checked) {
      // Multiple Admins mode -> "-- All Admins --" aggregate must be checked
      const agg = container.querySelector('.MultiSampleAggregateCheckbox[value="all"]');
      return !!(agg && agg.checked);
    }

    const sel = qs('#maincontent_ProcessingAdmins_SingleValue');
    return !!(sel && sel.value === 'all');
  }

  // -------------------------
  // Report freshness: filters SELECTED vs. filters actually APPLIED
  //
  // Changing a filter does not touch the grid — the user must press
  // "Generate Report". Until then the page still shows the previous result
  // set, so acting on it would hit the wrong loans.
  // -------------------------
  let APPLIED_SIG = null;        // filter state the visible report was built with
  let GENERATE_PENDING = false;  // Generate Report pressed, waiting for the new grid

  function getFilterRegions() {
    const regions = new Set();
    for (const td of document.querySelectorAll('td.FilterHeader')) {
      if (td.parentElement) regions.add(td.parentElement);
    }
    const admins = qs('#maincontent_ProcessingAdmins_Container');
    if (admins) regions.add(admins);
    return Array.from(regions);
  }

  // Fingerprint of every filter control. Compared against the fingerprint
  // taken when the report was generated, so toggling a radio away and back
  // is correctly seen as "nothing changed" rather than as a pending change.
  function filterSignature() {
    const parts = [];
    const seen = new Set();

    for (const region of getFilterRegions()) {
      for (const el of region.querySelectorAll('input, select')) {
        if (seen.has(el)) continue;
        seen.add(el);

        const key = el.id || el.name || '';
        if (/LoanIds$|CustomerIds$/i.test(key)) continue; // row checkboxes, not filters
        if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden') continue;

        parts.push(
          el.type === 'checkbox' || el.type === 'radio'
            ? `${key}#${el.value}=${el.checked ? 1 : 0}`
            : `${key}=${el.value}`
        );
      }
    }
    return parts.join('|');
  }

  function isReportStale() {
    return APPLIED_SIG !== null && filterSignature() !== APPLIED_SIG;
  }


  function isGenerateButton(el) {
    if (!el) return false;
    const txt = norm(el.value || el.textContent || '');
    return /generate\s*report/i.test(txt);
  }

  // Independent proof that the AA filter is really applied to what we see:
  // with "AA In Progress = Yes" every listed loan must carry that status.
  // Bails out on the first row without it, so the stale case is cheap.
  function isGridAAFiltered() {
    const anchors = document.querySelectorAll('a[href*="CustomerDetails.aspx?customerid="]');
    if (!anchors.length) return false;

    const seen = new Set();
    for (const a of anchors) {
      const tr = a.closest('tr');
      if (!tr || seen.has(tr)) continue;
      seen.add(tr);
      if (!(tr.textContent || '').includes(STATUS_LABEL_TEXT)) return false;
    }
    return seen.size > 0;
  }

  function checkGuards() {
    const problems = [];
    if (!isAAInProgressYes()) problems.push('filter "AA In Progress" must be set to Yes');
    if (!isProcessingAdminAll()) problems.push('filter "Processing Admin" must be "-- All Admins --"');

    if (isReportStale()) {
      problems.push('filters changed — press "Generate Report" to apply them');
    } else if (!isGridAAFiltered()) {
      problems.push('the report on screen is not an AA In Progress list — press "Generate Report"');
    }
    return problems;
  }

  // -------------------------
  // Hidden worker frame
  // -------------------------
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

  // -------------------------
  // Panel
  // -------------------------
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
        <button id="cc-aa-x" style="cursor:pointer; border:none; background:transparent; color:#fff; font-size:16px; line-height:16px;">&times;</button>
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

      <div style="margin-top:8px;">
        <button id="cc-aa-run2" style="
          cursor:pointer; border:none; background:#2f9e44; color:#fff; font-weight:700;
          border-radius:8px; padding:8px 10px; width:100%;
        ">${BTN2_TEXT}</button>
      </div>

      <div id="cc-aa-status" style="margin-top:8px; opacity:0.95;">Ready.</div>

      <div id="cc-aa-err" style="margin-top:6px; opacity:0.9; font-size:11px; color:#ffd7d7; display:none;"></div>
    `;

    document.body.appendChild(panel);

    const statusEl = qs('#cc-aa-status', panel);
    const errEl = qs('#cc-aa-err', panel);
    const btnEl = qs('#cc-aa-run', panel);
    const btn2El = qs('#cc-aa-run2', panel);
    const stopEl = qs('#cc-aa-stop', panel);

    const buttons = [btnEl, btn2El];
    const ui = { statusEl, errEl, buttons };

    qs('#cc-aa-x', panel).addEventListener('click', () => {
      STOP = true;
      panel.remove();
      DISMISSED = true;
    });

    stopEl.addEventListener('click', () => { STOP = true; });

    async function start(reassign, confirmText) {
      if (RUNNING) return;
      if (checkGuards().length) { ensurePanelVisibility(); return; }
      if (CONFIRM_BEFORE_RUN && !confirm(confirmText)) return;

      // Lock right away: blocks a double-click and keeps the panel
      // alive even if a filter flickers while we count down.
      RUNNING = true;
      STOP = false;
      errEl.style.display = 'none';
      errEl.textContent = '';
      setButtonsEnabled(false, buttons);

      try {
        if (ARM_DELAY_MS > 0) {
          const what = reassign
            ? 'remove AA In Progress + unassign from AA Bot'
            : 'remove AA In Progress';

          for (let left = Math.ceil(ARM_DELAY_MS / 1000); left > 0; left--) {
            if (STOP) break;
            statusEl.textContent = `Starting in ${left}s — ${what}. Press Stop to cancel.`;
            await sleep(1000);
          }

          if (STOP) {
            statusEl.textContent = 'Cancelled. Ready.';
            return;
          }
        }

        await run({ reassign }, ui);
      } catch (e) {
        console.error(e);
        errEl.style.display = 'block';
        errEl.textContent = `Fatal: ${e.message || e}`;
        statusEl.textContent = 'Stopped with error.';
      } finally {
        RUNNING = false;
        setButtonsEnabled(true, buttons);
      }
    }

    btnEl.title = ARM_DELAY_MS > 0
      ? `Starts after ${Math.ceil(ARM_DELAY_MS / 1000)}s — press Stop to cancel`
      : 'Starts immediately';
    btn2El.title = btnEl.title;

    btnEl.addEventListener('click', () => start(
      false,
      'Remove "AA In Progress" for ALL loans in this Pending list?\n\n' +
      'Processing Admin will NOT be changed.\n' +
      'Runs in background and will NOT reload your report page.'
    ));

    btn2El.addEventListener('click', () => start(
      true,
      'Remove "AA In Progress" for ALL loans in this Pending list\n' +
      'AND set Processing Admin to "-- no admin --" (unassign from AA Bot)?\n\n' +
      'Runs in background and will NOT reload your report page.'
    ));

    return panel;
  }

  function setButtonsEnabled(enabled, btns) {
    for (const b of btns) {
      if (!b) continue;
      b.disabled = !enabled;
      b.style.opacity = enabled ? '1' : '0.5';
      b.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
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
    const rowText = norm(tr.textContent);
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
      const hasAA = rowText.includes(STATUS_LABEL_TEXT);

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

  // -------------------------
  // "Assign processing admin" snapshot (postback payload for the CURRENT DOM)
  // -------------------------
  const NO_ADMIN_VALUE = '0';

  function buildAssignSnapshot() {
    const form = qs('#Page_Form') || qs('form');
    if (!form) return null;

    const container = qs('#maincontent_Tr_AssignProcessingAdminControls');
    if (!container) return null;

    const select = container.querySelector('select');
    const btn = container.querySelector('input[type="submit"], input[type="button"], button');
    if (!select || !btn) return null;

    const selectName = select.getAttribute('name');
    const btnName = btn.getAttribute('name');
    const btnValue = btn.getAttribute('value') || btn.value || 'Update';
    if (!selectName || !btnName) return null;

    // Make sure "-- no admin --" really exists in the dropdown
    const hasNoAdmin = Array.from(select.options).some((o) => o.value === NO_ADMIN_VALUE);
    if (!hasNoAdmin) return null;

    // Snapshot of every field currently posted by the report form
    const base = new URLSearchParams();
    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
      if (typeof v !== 'string') continue;
      // drop every bulk-action checkbox group; we add only ours
      if (/LoanIds$|CustomerIds$/i.test(k)) continue;
      base.append(k, v);
    }

    base.set('__EVENTTARGET', '');
    base.set('__EVENTARGUMENT', '');
    base.set(selectName, NO_ADMIN_VALUE);

    // Loan ids rendered on this page (event-validation-safe set)
    const available = new Set(
      Array.from(document.querySelectorAll('input[name="processingAdminLoanIds"]')).map((cb) => cb.value)
    );

    return {
      action: new URL(form.getAttribute('action') || location.href, location.href).toString(),
      base,
      btnName,
      btnValue,
      available
    };
  }

  async function postAssignNoAdmin(snapshot, loanIds) {
    if (!snapshot || !loanIds.length) return 0;

    let done = 0;
    for (let i = 0; i < loanIds.length; i += ASSIGN_CHUNK_SIZE) {
      const chunk = loanIds.slice(i, i + ASSIGN_CHUNK_SIZE);

      const body = new URLSearchParams(snapshot.base.toString());
      for (const id of chunk) body.append('processingAdminLoanIds', id);
      body.append(snapshot.btnName, snapshot.btnValue);

      const resp = await fetch(snapshot.action, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body
      });

      if (!resp.ok) throw new Error(`Assign POST failed (${resp.status})`);

      const html = await resp.text();
      if (/Validation of viewstate MAC failed|Invalid postback or callback argument/i.test(html)) {
        throw new Error('Assign POST rejected by server (viewstate/event validation). Regenerate the report and retry.');
      }

      done += chunk.length;
      await sleep(200);
    }
    return done;
  }

  // -------------------------
  // Collect across pages + snapshots
  // -------------------------
  async function collectAllPages(statusEl) {
    const all = new Map();
    const pages = [];
    let page = 0;

    while (page < 200) {
      page++;

      const items = collectLoansFromCurrentView();
      for (const it of items) if (!all.has(it.loanId)) all.set(it.loanId, it);

      const snapshot = buildAssignSnapshot();
      if (snapshot) pages.push(snapshot);

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

    return { loans: Array.from(all.values()), pages };
  }

  // -------------------------
  // EditStatus.aspx POST
  // -------------------------
  function findCheckboxByLabelText(doc, labelText) {
    const labels = Array.from(doc.querySelectorAll('label'));
    const lbl = labels.find((l) => (l.textContent || '').trim() === labelText);

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
      const t = norm(cb.parentElement?.textContent);
      if (t === labelText || t.includes(labelText)) return cb;
    }

    return null;
  }

  function findUpdateButton(doc) {
    const btns = Array.from(doc.querySelectorAll('input[type="submit"], input[type="button"], button'));
    return btns.find((b) => ((b.value || b.textContent || '').trim().toLowerCase() === 'update')) || null;
  }

  function formDataToUrlEncoded(fd) {
    const usp = new URLSearchParams();
    for (const [k, v] of fd.entries()) usp.append(k, v);
    return usp;
  }

  async function postEditStatusForm(frameWin, doc, form, updateBtn, uncheckedCheckbox) {
    const fd = new FormData(form);

    const btnName = updateBtn?.getAttribute('name');
    const btnVal = updateBtn?.getAttribute('value') || updateBtn?.value || 'Update';
    if (btnName && !fd.has(btnName)) fd.append(btnName, btnVal);

    if (uncheckedCheckbox && uncheckedCheckbox.name) fd.delete(uncheckedCheckbox.name);

    const actionRaw = (form.getAttribute('action') || '').trim();
    const actionUrl = new URL(actionRaw || frameWin.location.href, frameWin.location.href).toString();

    const body = formDataToUrlEncoded(fd);

    const resp = await fetch(actionUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body
    });

    if (!resp.ok) throw new Error(`POST failed (${resp.status}) -> ${actionUrl}`);
    return true;
  }

  async function removeAAForLoan(frame, loanId) {
    const url = `/plm.net/customers/EditStatus.aspx?loanid=${loanId}`;
    await loadInFrame(frame, url);

    const d = frame.contentDocument;
    const w = frame.contentWindow;
    if (!d || !w) throw new Error('No iframe content');

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
  let RUNNING = false;
  let DISMISSED = false;

  async function run(opts, ui) {
    const { statusEl, errEl, buttons } = ui;
    const reassign = !!opts.reassign;

    STOP = false;
    RUNNING = true;
    errEl.style.display = 'none';
    errEl.textContent = '';
    setButtonsEnabled(false, buttons);

    try {
      statusEl.textContent = 'Collecting loans from report…';

      const { loans: allLoans, pages } = await collectAllPages(statusEl);

      if (!allLoans.length) {
        statusEl.textContent = 'No loans found. (Try: Show all pages + Generate Report)';
        return;
      }

      if (reassign && !pages.length) {
        throw new Error('"Assign processing admin" control not found on the page.');
      }

      const targets = ONLY_ROWS_THAT_CONTAIN_AA_TEXT ? allLoans.filter((x) => x.hasAA) : allLoans;
      if (!targets.length) {
        statusEl.textContent = `Loans found: ${allLoans.length}, but none matched AA text. Set ONLY_ROWS_THAT_CONTAIN_AA_TEXT=false to brute-force.`;
        return;
      }

      const frame = ensureWorkerFrame();

      let ok = 0, already = 0, fail = 0;
      const cleared = new Set();

      statusEl.textContent = `Starting… Targets: ${targets.length}.`;

      for (let i = 0; i < targets.length; i++) {
        if (STOP) break;

        const t = targets[i];
        statusEl.textContent =
          `(${i + 1}/${targets.length}) ${t.name ? t.name + ' — ' : ''}loan ${t.loanId}… | OK:${ok} Already:${already} Fail:${fail}`;

        try {
          const res = await removeAAForLoan(frame, t.loanId);
          if (res === 'already_off') already++;
          else ok++;
          cleared.add(t.loanId);
        } catch (e) {
          fail++;
          errEl.style.display = 'block';
          errEl.textContent = `Last error: ${e.message || e}`;
          console.warn('[AA Remove] Failed', t, e);
        }

        await sleep(PER_LOAN_DELAY_MS);
      }

      const statusPart = STOP
        ? `Stopped. OK:${ok}, Already:${already}, Failed:${fail}.`
        : `Statuses done. OK:${ok}, Already:${already}, Failed:${fail}.`;

      if (!reassign) {
        statusEl.textContent = `${statusPart} Refresh report to verify.`;
        return;
      }

      // ---- Step 2: Processing Admin -> "-- no admin --"
      let assigned = 0;
      let assignFail = 0;

      for (let p = 0; p < pages.length; p++) {
        if (STOP) break;

        const snap = pages[p];
        const ids = Array.from(cleared).filter((id) => snap.available.has(id));
        if (!ids.length) continue;

        statusEl.textContent = `${statusPart} Reassigning admin… (batch ${p + 1}/${pages.length}, ${ids.length} loans)`;

        try {
          assigned += await postAssignNoAdmin(snap, ids);
        } catch (e) {
          assignFail += ids.length;
          errEl.style.display = 'block';
          errEl.textContent = `Assign error: ${e.message || e}`;
          console.warn('[AA Remove] Assign failed', e);
        }
      }

      statusEl.textContent =
        `${statusPart} Admin set to "no admin": ${assigned}` +
        (assignFail ? `, failed: ${assignFail}` : '') +
        `. Refresh report to verify.`;
    } finally {
      RUNNING = false;
      setButtonsEnabled(true, buttons);
    }
  }

  // -------------------------
  // Boot
  // -------------------------
  if (!isPendingPresetPage()) return;

  // The panel exists ONLY while the required filters are selected.
  // Wrong filters -> no panel at all.
  let lastHiddenReason = '';

  function ensurePanelVisibility() {
    if (RUNNING || DISMISSED) return;

    const problems = checkGuards();
    const ok = problems.length === 0;
    const panel = qs('#cc-aa-remove-panel');

    if (ok && !panel) createPanel();
    else if (!ok && panel) panel.remove();

    // No UI noise when hidden — but leave a trace in the console,
    // so "why is there no panel?" is always answerable.
    const reason = problems.join(' | ');
    if (reason !== lastHiddenReason) {
      lastHiddenReason = reason;
      if (reason) console.info('[AA Remove] panel hidden:', reason);
    }
  }

  // On a fresh page load the controls match the report that was rendered.
  APPLIED_SIG = filterSignature();
  ensurePanelVisibility();

  document.addEventListener('change', ensurePanelVisibility, true);

  document.addEventListener('click', (e) => {
    // The report stays stale until the new grid actually arrives.
    if (isGenerateButton(e.target)) GENERATE_PENDING = true;
    setTimeout(ensurePanelVisibility, 0);
  }, true);

  // The grid is refreshed by an async postback, so watch the DOM for the
  // result of a Generate Report instead of waiting for a page reload.
  let mutationTimer = null;
  new MutationObserver((records) => {
    const ours = records.every((r) => {
      const n = r.target;
      return n && n.closest && n.closest('#cc-aa-remove-panel');
    });
    if (ours) return;

    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (GENERATE_PENDING) {
        GENERATE_PENDING = false;
        APPLIED_SIG = filterSignature(); // this filter state is now on screen
      }
      ensurePanelVisibility();
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  setInterval(ensurePanelVisibility, 1000);
})();
