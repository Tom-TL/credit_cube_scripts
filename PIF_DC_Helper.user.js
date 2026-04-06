// ==UserScript==
// @name         PIF DC Helper
// @author       Tom Harris
// @namespace    https://github.com/TOM-TL/credit_cube_scripts
// @version      1.4
// @description  One-click actions for Active loans: Update DC(Email + Text), create PIF Payment Plan, and send PIF docs (Email + Text).
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/PIF_DC_Helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/PIF_DC_Helper.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===== SINGLETON GUARD =====
  if (window.__CC_PIF_UI13_LOGIC47__) return;
  window.__CC_PIF_UI13_LOGIC47__ = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ===== IDS =====
  const BTN_IDS = {
    updatedc: 'ccUpdateDC_UI13',
    pifpp: 'ccCreatePIFPP_UI13',
    docs: 'ccSendPIFDocs_UI13',
    wrap: 'ccWrap_UI13',
  };

  // ===== THRESHOLDS (v13.7) =====
  const THRESH_HIGH = 3000;
  const THRESH_LOW = 40;

  // ===== STATE (per LOAN) =====
  function getLoanIdFromHeaderText() {
    const txt = document.body?.innerText || '';
    const m = txt.match(/LOAN#\s*(\d+)/i);
    return m ? m[1] : 'X';
  }
  const LOAN = getLoanIdFromHeaderText();

  function doneKey(btnId) {
    return `CC_DONE_${LOAN}_${btnId}`;
  }
  function setDone(btnId) {
    sessionStorage.setItem(doneKey(btnId), '1');
  }
  function clearDone(btnId) {
    sessionStorage.removeItem(doneKey(btnId));
  }
  function isDone(btnId) {
    return sessionStorage.getItem(doneKey(btnId)) === '1';
  }

  // ===== TOAST (STACK like alerts) =====
  function toast(msg, type = 'ok') {
    let box = document.getElementById('ccDocsToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ccDocsToast';
      box.style.position = 'fixed';
      box.style.bottom = '18px';
      box.style.right = '18px';
      box.style.zIndex = '2147483647';
      box.style.display = 'flex';
      box.style.flexDirection = 'column-reverse';
      box.style.alignItems = 'flex-end';
      box.style.pointerEvents = 'none';
      document.body.appendChild(box);
    }

    const t = document.createElement('div');
    const isErr = type === 'err';
    const isWarn = type === 'warn';
    t.textContent = msg;
    t.style.cssText =
      'padding:10px 14px;border-radius:8px;color:#fff;font-size:12px;' +
      (isErr ? 'background:#c62828;' : isWarn ? 'background:#ef6c00;' : 'background:#1b5e20;') +
      ';box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:520px;white-space:pre-line;' +
      'margin-top:8px;pointer-events:auto;';
    box.appendChild(t);

    setTimeout(() => {
      t.remove();
      if (!box.children.length) box.remove();
    }, 3600);
  }

  // ===== CSS (v13.7 + ResetX) =====
  const style = document.createElement('style');
  style.textContent = `
    .cc-ui13-done{
      background:#ef6c00 !important;
      border-color:#ef6c00 !important;
      color:#fff !important;
    }
    .cc-ui13-disabled{
      opacity:.65 !important;
      pointer-events:none !important;
    }
    .cc-reset-x{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:14px;height:14px;
      line-height:14px;
      border-radius:6px;
      font-size:11px;
      margin-left:-4px;
      cursor:pointer;
      background:#ddd;
      border:1px solid #bbb;
      color:#111;
      user-select:none;
    }
    .cc-reset-x:hover{ background:#ccc; }
  `;
  document.head.appendChild(style);

  function makeOrange(btn) {
    if (!btn) return;
    btn.classList.add('cc-ui13-done');
  }
  function removeOrange(btn) {
    if (!btn) return;
    btn.classList.remove('cc-ui13-done');
  }
  function applySavedState() {
    const b1 = document.getElementById(BTN_IDS.updatedc);
    const b2 = document.getElementById(BTN_IDS.pifpp);
    const b3 = document.getElementById(BTN_IDS.docs);
    if (isDone(BTN_IDS.updatedc)) makeOrange(b1); else removeOrange(b1);
    if (isDone(BTN_IDS.pifpp)) makeOrange(b2); else removeOrange(b2);
    if (isDone(BTN_IDS.docs)) makeOrange(b3); else removeOrange(b3);
  }

  // ===== STRICT CLICK ISOLATION =====
  let operationRunning = false;

  function hardStop(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    } catch {}
  }

  function lockButtons(lock) {
    operationRunning = lock;
    [BTN_IDS.updatedc, BTN_IDS.pifpp, BTN_IDS.docs].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = lock;
      if (lock) b.classList.add('cc-ui13-disabled');
      else b.classList.remove('cc-ui13-disabled');
    });
  }

  // =====================================================================
  // POPUP CLOSE
  // =====================================================================
  function closeLMSModals() {
    try {
      document.querySelectorAll('#modalWindow .closeBtn.modal-link').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow a[data-value="ok"]').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow').forEach((m) => m.remove());
      document.querySelectorAll('#sendingFrame').forEach((f) => f.remove());
      document.body.style.overflow = '';
    } catch {}
  }

  async function autoCloseDuringSend(maxMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      closeLMSModals();
      const hasModal = !!document.querySelector('#modalWindow') || !!document.querySelector('#sendingFrame');
      if (!hasModal) return;
      await sleep(250);
    }
    closeLMSModals();
  }

  function pageShowsContactDisabled() {
    return (document.body.innerText || '').toLowerCase().includes('contact method disabled');
  }

  function isOptionDisabledLike(opt) {
    if (!opt) return false;
    const t = (opt.textContent || '').toLowerCase();
    return !!opt.disabled || t.includes('(disabled)') || t.includes(' disabled');
  }

  // ===== LETTER CONTROLS (v13.7) =====
  function getLetterIndex() {
    const actionSel = document.querySelector('select[id*="LoansRepeater_LetterAction_"]');
    if (!actionSel) return null;
    const m = actionSel.id.match(/_(\d+)$/);
    return m ? m[1] : null;
  }

  function byIdOrQuery(idExact, query) {
    return document.getElementById(idExact) || document.querySelector(query);
  }

  function findLetterControls() {
    const idx = getLetterIndex();
    if (idx == null) return null;

    const actionSel = byIdOrQuery(
      `ctl00_LoansRepeater_LetterAction_${idx}`,
      `select[id*="LoansRepeater_LetterAction_${idx}"]`
    );
    const sendBtn = byIdOrQuery(
      `ctl00_LoansRepeater_Btn_DoLetterActionSend_${idx}`,
      `input[id*="LoansRepeater_Btn_DoLetterActionSend_${idx}"]`
    );
    const selText = byIdOrQuery(
      `ctl00_LoansRepeater_Letter_ForTextMessage_${idx}`,
      `select[id*="LoansRepeater_Letter_ForTextMessage_${idx}"]`
    );
    const selEmail = byIdOrQuery(
      `ctl00_LoansRepeater_Letter_ForEmail_${idx}`,
      `select[id*="LoansRepeater_Letter_ForEmail_${idx}"]`
    );

    if (!actionSel || !sendBtn) return null;
    return { actionSel, sendBtn, selText, selEmail };
  }

  const lastSend = new Map();
  function allowSend(key, ms = 2500) {
    const now = Date.now();
    const prev = lastSend.get(key) || 0;
    if (now - prev < ms) return false;
    lastSend.set(key, now);
    return true;
  }

  async function sendLetter(actionType, templateContains) {
    const ctrls = findLetterControls();
    if (!ctrls) throw new Error('Letter controls not found');

    const key = `${LOAN}:${actionType}:${String(templateContains).toLowerCase()}`;
    if (!allowSend(key)) return;

    if (pageShowsContactDisabled()) {
      throw new Error('Contact method disabled');
    }

    ctrls.actionSel.value = actionType;
    ctrls.actionSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);

    const templateSel = actionType === 'textmessage' ? ctrls.selText : ctrls.selEmail;
    if (!templateSel) throw new Error('Template dropdown missing for ' + actionType);

    const opt = Array.from(templateSel.options || []).find((o) =>
      (o.textContent || '').toLowerCase().includes(String(templateContains).toLowerCase())
    );
    if (!opt) throw new Error('Template not found: ' + templateContains);

    if (isOptionDisabledLike(opt)) {
      throw new Error('Contact method disabled');
    }

    templateSel.value = opt.value;
    templateSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);

    ctrls.sendBtn.click();
    await sleep(200);
    await autoCloseDuringSend(6000);

    if (pageShowsContactDisabled()) {
      closeLMSModals();
      throw new Error('Contact method disabled');
    }
  }

  async function sendBothWithSeparateToasts(textContains, emailContains) {
    // EMAIL
    try {
      await sendLetter('send', emailContains);
      toast('Email sent');
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed')) {
        toast('Email disabled', 'err');
      } else {
        toast('Email send failed', 'err');
      }
    }

    await sleep(350);

    // TEXT
    try {
      await sendLetter('textmessage', textContains);
      toast('Text sent');
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed') || msg.includes('failed')) {
        toast('Text disabled', 'err');
      } else {
        toast('Text send failed', 'err');
      }
    }

    await sleep(200);
  }

  // ===== BUSINESS HELPERS (v13.7) =====
  function getTotalDue() {
    const m = (document.body.innerText || '').match(/Total\s+Due\s*:\s*\$?\s*([\d,.]+)/i);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function nextBusinessDay(d) {
    const x = new Date(d);
    x.setDate(x.getDate() + 1);
    if (x.getDay() === 6) x.setDate(x.getDate() + 2);
    if (x.getDay() === 0) x.setDate(x.getDate() + 1);
    return x;
  }

  function formatDate(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  // ===== ACTIONS =====
  async function handleUpdateDC() {
    if (operationRunning) return;
    lockButtons(true);
    try {
      await sendBothWithSeparateToasts('Debit Card Update Link', 'Debit Card Update Link');
      setDone(BTN_IDS.updatedc);
      makeOrange(document.getElementById(BTN_IDS.updatedc));
    } catch (e) {
      toast('Update DC error: ' + (e?.message || e), 'err');
    } finally {
      lockButtons(false);
      applySavedState();
    }
  }

  async function handleCreatePIFPP() {
    if (operationRunning) return;

    const total = getTotalDue();
    if (total == null) {
      toast('Total Due not found', 'err');
      return;
    }

    if (total > THRESH_HIGH || total < THRESH_LOW) {
      const ok = confirm(`Total Due is $${total.toFixed(2)}.\nContinue creating PIF Payment Plan?`);
      if (!ok) {
        toast('Cancelled', 'warn');
        return;
      }
    }

    lockButtons(true);

    try {
      const payBtn = document.querySelector('input[id*="Btn_PaymentPlan"]');
      if (!payBtn || !payBtn.onclick) throw new Error('Payment Plan button not found');

      const m = payBtn.onclick.toString().match(/PaymentPlan\.aspx\?loanid=\d+/i);
      if (!m) throw new Error('Cannot parse PaymentPlan url');
      const url = m[0];

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = async () => {
        try {
          for (let i = 0; i < 40; i++) {
            if (typeof iframe.contentWindow?.jstemplatetable_additem === 'function') break;
            await sleep(200);
          }
          if (typeof iframe.contentWindow?.jstemplatetable_additem !== 'function') {
            throw new Error('PaymentPlan page not ready (jstemplatetable_additem missing)');
          }

          const today = new Date();
          const next = nextBusinessDay(today);

          iframe.contentWindow.jstemplatetable_additem('tbl_paymentplaninfos', null, {
            paymentdate: formatDate(today),
            paymentamount: total.toFixed(2),
            paymenttype: '',
          });

          await sleep(200);

          iframe.contentWindow.jstemplatetable_additem('tbl_paymentplaninfos', null, {
            paymentdate: formatDate(next),
            paymentamount: '0',
            paymenttype: '',
          });

          await sleep(250);

          const submitBtn =
            iframe.contentDocument.querySelector('input[id*="Btn_Submit"]') ||
            iframe.contentDocument.querySelector('input[type="submit"][value="Submit"]');

          if (!submitBtn) throw new Error('Submit not found');
          submitBtn.click();

          await sleep(900);
          try { iframe.remove(); } catch {}

          if (window.refreshSection) window.refreshSection();

          setDone(BTN_IDS.pifpp);
          makeOrange(document.getElementById(BTN_IDS.pifpp));
          toast('Payment Plan created ✓');
        } catch (e) {
          try { iframe.remove(); } catch {}
          toast('PIF error: ' + (e?.message || e), 'err');
        } finally {
          lockButtons(false);
          applySavedState();
        }
      };
    } catch (e) {
      toast('PIF error: ' + (e?.message || e), 'err');
      lockButtons(false);
      applySavedState();
    }
  }

 async function handleSendPIFDocs() {
  if (operationRunning) return;
  lockButtons(true);

  try {
    const link =
      document.querySelector('a[href*="additionalagreements("]') ||
      Array.from(document.querySelectorAll('a')).find((a) =>
        /additionalagreements\(\d+\)/i.test(a.getAttribute('href') || '')
      );

    if (!link) throw new Error('Additional Agreements link not found');

    const mm = (link.getAttribute('href') || '').match(/additionalagreements\((\d+)\)/i);
    if (!mm) throw new Error('Cannot parse loanid');
    const loanid = mm[1];

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `popups/AdditionalAgreements.aspx?loanid=${loanid}`;
    document.body.appendChild(iframe);

    let pifDocsFlowStarted = false;

    iframe.onload = async () => {
      if (pifDocsFlowStarted) return;
      pifDocsFlowStarted = true;

      try {
        const doc = iframe.contentDocument;

        for (let i = 0; i < 40; i++) {
          const sel = doc.querySelector('select');
          if (sel && sel.options && sel.options.length > 1) break;
          await sleep(200);
        }

        const sel = doc.querySelector('select');
        if (!sel) throw new Error('Agreement dropdown not found');

        const opt = Array.from(sel.options || []).find((o) =>
          (o.textContent || '').toLowerCase().includes('repayment plan addendum')
        );
        if (!opt) throw new Error('Repayment Plan Addendum not found');

        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(250);

        const createBtn =
          doc.querySelector('input[value="Create"]') || doc.querySelector('button');
        if (!createBtn) throw new Error('Create button not found');
        createBtn.click();

        await sleep(900);
        try { iframe.remove(); } catch {}

        await sendBothWithSeparateToasts('Payment Plan Agreement', 'Payment Plan Agreement');

        setDone(BTN_IDS.docs);
        makeOrange(document.getElementById(BTN_IDS.docs));

        await autoCloseDuringSend(2000);
      } catch (e) {
        try { iframe.remove(); } catch {}
        toast('PIF Docs error: ' + (e?.message || e), 'err');
        await autoCloseDuringSend(2000);
      } finally {
        lockButtons(false);
        applySavedState();
      }
    };
  } catch (e) {
    toast('PIF Docs error: ' + (e?.message || e), 'err');
    await autoCloseDuringSend(1500);
    lockButtons(false);
    applySavedState();
  }
}






  // ===================== ACTIVE GATE =====================
  function isLoanActive() {
    const tds = Array.from(document.querySelectorAll('td'));
    for (const td of tds) {
      const label = (td.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^status\s*:\s*$/i.test(label) || /^status\s*:?$/i.test(label)) {
        const val = (td.nextElementSibling?.textContent || '').replace(/\s+/g, ' ').trim();
        if (val) return /\bactive\b/i.test(val);
      }
    }
    const txt = document.body?.innerText || '';
    const m = txt.match(/LOAN#\s*\d+\s*\/\s*([A-Z]+)/i);
    return m ? /ACTIVE/i.test(m[1]) : false;
  }

  function removeUIIfExists() {
    const wrap = document.getElementById(BTN_IDS.wrap);
    if (wrap) wrap.remove();
  }

  // ===== UI =====
  function buildBtn(label, id) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'padding:4px 9px;' +
      'background:#2f3640;' +
      'color:#fff;' +
      'border:1px solid #111;' +
      'border-radius:6px;' +
      'cursor:pointer;' +
      'font-size:11px;' +
      'line-height:1.1;' +
      'white-space:nowrap;';
    return b;
  }

  function buildResetX(forBtnId) {
    const x = document.createElement('span');
    x.className = 'cc-reset-x';
    x.textContent = '✕';
    x.title = 'Reset';
    x.addEventListener('click', (e) => {
      hardStop(e);
      clearDone(forBtnId);
      applySavedState();
      toast('Reset ✓', 'warn');
    }, true);
    return x;
  }

  function injectUI() {
    if (!/CustomerDetails\.aspx/i.test(location.href)) return;

    if (!isLoanActive()) {
      removeUIIfExists();
      return;
    }

    const dialer = document.querySelector('a[id*="DialerLeadsLink"]');
    if (!dialer) return;

    const parent = dialer.closest('span')?.parentElement || dialer.parentElement;
    if (!parent) return;

    if (document.getElementById(BTN_IDS.wrap)) {
      applySavedState();
      return;
    }

    const wrap = document.createElement('span');
    wrap.id = BTN_IDS.wrap;
    wrap.style.marginLeft = '10px';
    wrap.style.display = 'inline-flex';
    wrap.style.gap = '4px';
    wrap.style.alignItems = 'center';

    const b1 = buildBtn('Update DC', BTN_IDS.updatedc);
    const x1 = buildResetX(BTN_IDS.updatedc);

    const b2 = buildBtn('Create PIF PP', BTN_IDS.pifpp);
    const x2 = buildResetX(BTN_IDS.pifpp);

    const b3 = buildBtn('Send PIF Docs', BTN_IDS.docs);
    const x3 = buildResetX(BTN_IDS.docs);

    b1.addEventListener('click', async (e) => { hardStop(e); await handleUpdateDC(); }, true);
    b2.addEventListener('click', async (e) => { hardStop(e); await handleCreatePIFPP(); }, true);
    b3.addEventListener('click', async (e) => { hardStop(e); await handleSendPIFDocs(); }, true);

    wrap.appendChild(b1); wrap.appendChild(x1);
    wrap.appendChild(b2); wrap.appendChild(x2);
    wrap.appendChild(b3); wrap.appendChild(x3);

    parent.appendChild(wrap);

    applySavedState();
  }

  // ===== SELF-HEAL =====
  function boot() {
    injectUI();
    setInterval(injectUI, 700);
    const mo = new MutationObserver(() => injectUI());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  boot();
})();
