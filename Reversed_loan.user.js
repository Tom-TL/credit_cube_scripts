// ==UserScript==
// @name         Reversed loan
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.1
// @description  Shows Red Reversed Loan button near Max Exposure (only if Status contains Reversed) and sends Email+Text
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Reversed_loan.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Reversed_loan.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===== SINGLETON =====
  if (window.__CC_REVERSED_NOTIFY_V1__) return;
  window.__CC_REVERSED_NOTIFY_V1__ = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ===== DOCS-STYLE TOAST =====
  function toast(msg, isErr = false) {
    let box = document.getElementById('ccDocsToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ccDocsToast';
      box.style.position = 'fixed';
      box.style.bottom = '20px';
      box.style.right = '20px';
      box.style.zIndex = '999999';
      document.body.appendChild(box);
    }

    const t = document.createElement('div');
    t.textContent = msg;
    t.style.background = isErr ? '#dc2626' : '#16a34a';
    t.style.color = '#fff';
    t.style.padding = '10px 14px';
    t.style.marginTop = '8px';
    t.style.borderRadius = '8px';
    t.style.fontFamily = 'Arial';
    t.style.fontSize = '12px';
    t.style.boxShadow = '0 10px 20px rgba(0,0,0,.4)';
    box.appendChild(t);

    setTimeout(() => t.remove(), 3500);
  }

  // ===== Status check: must contain "Reversed" (other words allowed) =====
  function loanIsReversed() {
    const label = Array.from(document.querySelectorAll('td'))
      .find(td => (td.textContent || '').trim() === 'Status :');
    if (!label) return false;

    const row = label.closest('tr');
    const valueCell = row?.querySelectorAll('td')?.[1];
    const txt = (valueCell?.textContent || '').toLowerCase();

    return txt.includes('reversed');
  }

  // =====================================================================
  // MODAL CLOSE
  // =====================================================================
  function closeLMSModals() {
    try {
      document.querySelectorAll('#modalWindow .closeBtn.modal-link').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow a[data-value="ok"]').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow').forEach((m) => m.remove());
      document.querySelectorAll('#sendingFrame').forEach((f) => f.remove());

      document.querySelectorAll('#iframewindow .window-close, #iframewindow .window-titlebar img').forEach((x) => {
        try { x.click(); } catch {}
      });

      document.body.style.overflow = '';
    } catch {}
  }

  async function autoCloseDuringSend(maxMs = 6500) {
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

  // =====================================================================
  // LETTER CONTROLS
  // =====================================================================
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

  // debounce like your script (prevents double-send on rerender)
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

    const key = `${actionType}:${String(templateContains).toLowerCase()}`;
    if (!allowSend(key)) return;

    if (pageShowsContactDisabled()) {
      throw new Error('Contact method disabled');
    }

    // set action (textmessage / send)
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

    // real send + auto-close any Infinity confirm/ok
    ctrls.sendBtn.click();
    await sleep(200);
    await autoCloseDuringSend(6500);

    if (pageShowsContactDisabled()) {
      closeLMSModals();
      throw new Error('Contact method disabled');
    }
  }

  // ===== Main action: Email + Text =====
  let running = false;

  async function handleReversedNotify() {
    if (running) return;
    if (!loanIsReversed()) return;

    running = true;
    try {
      // 1) EMAIL
      try {
        await sendLetter('send', 'Loan Reversed');
        toast('Email sent');
      } catch (e) {
        const msg = (e && e.message ? e.message : '').toLowerCase();
        console.log('[Reversed Notify][EMAIL] error:', e);

        if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed')) {
          toast('Email disabled', true);
        } else {
          toast('Email send failed', true);
        }
      }

      await sleep(400);

      // 2) TEXT
      try {
        await sendLetter('textmessage', 'Reversed Incorrect Bank Info');
        toast('Text sent');
      } catch (e) {
        const msg = (e && e.message ? e.message : '').toLowerCase();
        console.log('[Reversed Notify][TEXT] error:', e);

        if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed') || msg.includes('failed')) {
          toast('Text disabled', true);
        } else {
          toast('Text send failed', true);
        }
      }

    } catch (e) {
      console.log('[Reversed Notify] error:', e);
      alert('Reversed Notify error: ' + (e?.message || e));
    } finally {
      running = false;
    }
  }

  // ===== UI: place near Max Exposure =====
  function injectButton() {
    if (!loanIsReversed()) return;

    const maxBtn = Array.from(document.querySelectorAll('a'))
      .find(a => (a.textContent || '').trim() === 'Max Exposure');

    if (!maxBtn) return;
    if (document.getElementById('ccReversedLoanBtn')) return;

    const btn = document.createElement('a');
    btn.id = 'ccReversedLoanBtn';
    btn.textContent = 'Reversed Loan';
    btn.className = 'AButton';
    btn.style.marginLeft = '8px';

    // DISTINCT STYLE (not like other buttons)
    btn.style.background = '#ff0033';
    btn.style.border = '1px solid #8a001a';
    btn.style.color = '#fff';
    btn.style.fontWeight = '600';
    btn.style.borderRadius = '8px';
    btn.style.boxShadow = '0 6px 16px rgba(0,0,0,.25)';
    btn.style.padding = '6px 10px';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleReversedNotify();
    }, true);

    // Put it AFTER Max Exposure
    maxBtn.parentNode.insertBefore(btn, maxBtn.nextSibling);
  }

  // self-heal like your other scripts
  function boot() {
    injectButton();
    setInterval(injectButton, 2500);

    const mo = new MutationObserver(() => injectButton());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  boot();
})();
