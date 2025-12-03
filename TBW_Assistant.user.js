// ==UserScript==
// @name         TBW Assistant
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Show TBW denial reason, auto-deny some reasons, quick Review to CRP and quick Deny popup, with Copy reason button and auto-denied notice.
// @match        http*://*/plm.net/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Assistant.user.js
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  const href = window.location.href.toLowerCase();

  if (href.includes('customerdetails.aspx')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleCustomerPage);
    } else {
      handleCustomerPage();
    }
  } else if (href.includes('editloandenialreasons.aspx')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleDenyPopup);
    } else {
      handleDenyPopup();
    }
  }

  // ---------- UTILS ----------

  function titleCaseFirst(str) {
    str = (str || '').trim();
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function autoKey(loanId) {
    return 'cc_autoReason_' + loanId;
  }

  function confirmKey(loanId) {
    return 'cc_autoDeniedPending_' + loanId;
  }

  // ---------- ALERTS ----------

  // Красный iOS-style alert снизу, не исчезает сам – закрывается кликом



// Короткий автоисчезающий алерт (для "No recent IBV found" и т.п.)
function showBottomAlert(text) {
  let alert = document.getElementById('tm-bottom-alert');
  if (!alert) {
    alert = document.createElement('div');
    alert.id = 'tm-bottom-alert';
    alert.style.position = 'fixed';
    alert.style.bottom = '25px';
    alert.style.left = '50%';
    alert.style.transform = 'translateX(-50%)';
    alert.style.padding = '10px 15px';
    alert.style.borderRadius = '12px';
    alert.style.fontSize = '13px';
    alert.style.fontWeight = '600';
    alert.style.background = '#ff3b30';      // красный, как у iOS
    alert.style.color = '#ffffff';
    alert.style.border = '1px solid #d90000';
    alert.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    alert.style.zIndex = '999999';
    alert.style.cursor = 'pointer';
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.25s ease';

    // по клику тоже можно сразу закрыть
    alert.addEventListener('click', () => {
      if (alert._tmTimeout) {
        clearTimeout(alert._tmTimeout);
      }
      alert.remove();
    });

    document.body.appendChild(alert);
  }

  alert.textContent = text;
  alert.style.opacity = '1';

  // сбрасываем прошлый таймер, если был
  if (alert._tmTimeout) {
    clearTimeout(alert._tmTimeout);
  }

  // через 2 сек плавно прячем и удаляем
  alert._tmTimeout = setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => {
      if (alert && alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 250);
  }, 2000);
}

// Липкий алерт, который живёт, пока не нажмёшь (для "No TBW reason found in notes")
function showStickyAlert(text) {
  let alert = document.getElementById('tm-sticky-alert');
  if (!alert) {
    alert = document.createElement('div');
    alert.id = 'tm-sticky-alert';
    alert.style.position = 'fixed';
    alert.style.bottom = '25px';
    alert.style.left = '50%';
    alert.style.transform = 'translateX(-50%)';
    alert.style.padding = '10px 15px';
    alert.style.borderRadius = '12px';
    alert.style.fontSize = '13px';
    alert.style.fontWeight = '600';
    alert.style.background = '#ff3b30';
    alert.style.color = '#ffffff';
    alert.style.border = '1px solid #d90000';
    alert.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    alert.style.zIndex = '999999';
    alert.style.cursor = 'pointer';
    alert.style.opacity = '1';

    alert.addEventListener('click', () => {
      alert.remove();
    });

    document.body.appendChild(alert);
  }

  alert.textContent = text;
}







  // Чёрный toast для Copy
  function showCopyAlert(text) {
    let alert = document.getElementById('tm-copy-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.id = 'tm-copy-alert';
      alert.style.position = 'fixed';
      alert.style.bottom = '25px';
      alert.style.left = '50%';
      alert.style.transform = 'translateX(-50%)';
      alert.style.padding = '10px 16px';
      alert.style.borderRadius = '8px';
      alert.style.fontSize = '14px';
      alert.style.fontWeight = '600';
      alert.style.background = '#000000';
      alert.style.color = '#ffffff';
      alert.style.border = '1px solid #333';
      alert.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
      alert.style.zIndex = '999999';
      alert.style.opacity = '0';

      document.body.appendChild(alert);
    }

    alert.textContent = text;
    alert.style.transition = 'opacity 0.25s ease';
    alert.style.opacity = '1';

    setTimeout(() => {
      alert.style.opacity = '0';
    }, 1500);
  }

  // Центральное уведомление Auto-denied (держится пока не кликнут)
  function showAutoDeniedNotice(reasonText, loanId) {
  if (!document.getElementById('tbw-auto-denied-style')) {
    const style = document.createElement('style');
    style.id = 'tbw-auto-denied-style';
    style.textContent = `
#tbw-auto-denied-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.18);   /* затемнение фона */
  z-index: 99998;
}

#tbw-auto-denied-box {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ffeeb8;
  padding: 16px 22px 14px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  z-index: 99999;
  max-width: 360px;
  text-align: center;
  cursor: pointer;
}

/* Заголовок */
#tbw-auto-denied-title {
  font-weight: 700;        /* сделай 700 если хочешь более жирный */
  font-size: 16px;         /* размер шрифта заголовка */
  margin-bottom: 5px;      /* расстояние до следующей строки */
  line-height: 1.3;
}

/* Строка с reason */
#tbw-auto-denied-reason {
  font-size: 13px;         /* размер шрифта reason */
  font-weight: 500;        /* толщина шрифта reason */
  line-height: 1.5;        /* межстрочный интервал */
}
    `;
    document.head.appendChild(style);
  }

  // создаём оверлей, если его ещё нет
  let overlay = document.getElementById('tbw-auto-denied-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tbw-auto-denied-overlay';
    document.body.appendChild(overlay);
  }

  let box = document.getElementById('tbw-auto-denied-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tbw-auto-denied-box';

    const title = document.createElement('div');
    title.id = 'tbw-auto-denied-title';

    const reason = document.createElement('div');
    reason.id = 'tbw-auto-denied-reason';

    box.appendChild(title);
    box.appendChild(reason);
    document.body.appendChild(box);
  }

  const titleDiv = document.getElementById('tbw-auto-denied-title');
  const reasonDiv = document.getElementById('tbw-auto-denied-reason');

  titleDiv.textContent = 'Auto-denied';
  reasonDiv.textContent = 'Reason: ' + (reasonText || '').trim();

  // Закрытие по клику на жёлтый бокс
  box.onclick = () => {
    box.remove();
    const ov = document.getElementById('tbw-auto-denied-overlay');
    if (ov) ov.remove();
    if (loanId) {
      localStorage.removeItem(confirmKey(loanId));
    }
  };
}








  // ---------- POPUP (DENIAL + REVIEW + DENY + COPY) ----------

  function showPopup(text, canReview, loanIdForDeny) {
    if (!document.getElementById('tbw-denial-style')) {
      const style = document.createElement('style');
      style.id = 'tbw-denial-style';
      style.textContent = `
#tbw-denial-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.18);
  z-index: 99998;
}

#tbw-denial-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ffeeb8;
  border-radius: 6px;
  padding: 20px 28px 22px;
  min-width: 260px;
  max-width: 60vw;
  display: inline-block;
  box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  z-index: 99999;
}

#tbw-denial-title {
  font-weight: 600;
  font-size: 17px;
  margin-bottom: 10px;
  text-align: center;
}

#tbw-denial-body {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

#tbw-denial-body-text {
  font-size: 14px;
  line-height: 1.45;
  font-weight: 600;
  color: #333;
}

#tbw-denial-body-text::before {
  content: "\\2022  ";
}

#tbw-denial-copy {
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  background: #4a4a4a;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
#tbw-denial-copy:hover {
  filter: brightness(1.07);
}

#tbw-denial-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

#tbw-denial-ok,
#tbw-denial-deny,
#tbw-denial-review {
  min-width: 80px;
  padding: 6px 18px;
  border-radius: 4px;
  border: none;
  background: #c28a00;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
#tbw-denial-ok:hover,
#tbw-denial-deny:hover,
#tbw-denial-review:hover {
  filter: brightness(1.05);
}
      `;
      document.head.appendChild(style);
    }

    if (document.getElementById('tbw-denial-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'tbw-denial-overlay';

    const box = document.createElement('div');
    box.id = 'tbw-denial-popup';

    const title = document.createElement('div');
    title.id = 'tbw-denial-title';
    title.textContent = 'DENIAL REASON';

    const body = document.createElement('div');
    body.id = 'tbw-denial-body';

    const bodyText = document.createElement('span');
    bodyText.id = 'tbw-denial-body-text';
    bodyText.textContent = text;

    const copyBtn = document.createElement('button');
    copyBtn.id = 'tbw-denial-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      const toCopy = text || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(toCopy).then(
          () => showCopyAlert('Copied to clipboard'),
          () => fallbackCopy(toCopy)
        );
      } else {
        fallbackCopy(toCopy);
      }
    });

    body.appendChild(bodyText);
    body.appendChild(copyBtn);

    const buttons = document.createElement('div');
    buttons.id = 'tbw-denial-buttons';

    const btnOk = document.createElement('button');
    btnOk.id = 'tbw-denial-ok';
    btnOk.textContent = 'OK';
    btnOk.addEventListener('click', () => overlay.remove());

    const btnDeny = document.createElement('button');
    btnDeny.id = 'tbw-denial-deny';
    btnDeny.textContent = 'Deny';
    btnDeny.addEventListener('click', () => {
      overlay.remove();
      if (loanIdForDeny && typeof window.deny_popup === 'function') {
        try {
          window.deny_popup(Number(loanIdForDeny));
        } catch (e) {
          console.error('deny_popup error', e);
        }
      }
    });

    const btnReview = document.createElement('button');
    btnReview.id = 'tbw-denial-review';
    btnReview.textContent = 'Review';
    btnReview.addEventListener('click', () => handleReviewClick(canReview));

    buttons.appendChild(btnOk);
    buttons.appendChild(btnDeny);
    buttons.appendChild(btnReview);

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(buttons);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);

      showCopyAlert('Copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
      showCopyAlert('Copy failed');
    }
  }

  // ---------- IBV REVIEW HELPERS ----------

  function hasIbvStatus() {
    const tds = Array.from(document.querySelectorAll('td'));
    const label = tds.find(
      td => td.textContent.replace(/\s+/g, ' ').trim() === 'Status :'
    );
    if (!label || !label.nextElementSibling) return false;
    const valueText = label.nextElementSibling.textContent || '';
    return /\[(A|R|D)\]/.test(valueText);
  }

  function selectLastIbvReport() {
    const select = document.getElementById(
      'maincontent_ReportBarControl_LendMateIbvReports'
    );
    if (!select) return false;
    const opts = select.options;
    if (!opts || !opts.length) return false;

    let idx = opts.length - 1;
    while (idx >= 0 && !opts[idx].value) idx--;
    if (idx <= 0) return false;

    select.selectedIndex = idx;
    return true;
  }

  function clickOpenInCrpButton() {
    const holder = document.getElementById(
      'maincontent_ReportBarControl_Holder_LendMateIbvReportControls'
    );
    if (!holder) return false;

    const buttons = Array.from(
      holder.querySelectorAll('input[type="button"]')
    );

    let crpBtn =
      buttons.find(b => /open\s+in\s+crp/i.test(b.value || '')) ||
      buttons.find(b => /crp/i.test(b.value || ''));

    if (crpBtn) {
      crpBtn.click();
      return true;
    }
    return false;
  }

  function handleReviewClick(canReviewFlag) {
    if (!canReviewFlag && !hasIbvStatus()) {
      showBottomAlert('No recent IBV found');
      return;
    }

    if (!selectLastIbvReport()) {
      showBottomAlert('No recent IBV found');
      return;
    }

    if (!clickOpenInCrpButton()) {
      showBottomAlert('No recent IBV found');
    }
  }

  // ---------- CUSTOMER PAGE (TBW + NOTES) ----------

  function handleCustomerPage() {
    if (window.ccTbwHelperRan) return;
    window.ccTbwHelperRan = true;

    const lastLoanSection = document.getElementById('LastLoanSection');
    if (!lastLoanSection) return;

    const header = lastLoanSection.querySelector('.Header');
    const headerText = header ? header.textContent.trim() : '';

    const statusSpan = lastLoanSection.querySelector(
      'span[id*="Span_Loan_Status_0"]'
    );
    const statusRowText = statusSpan
      ? statusSpan.parentElement.textContent.trim()
      : '';

    const fullStatus = (headerText + ' ' + statusRowText) || '';
    const combinedStatus = fullStatus.toLowerCase();

    const hasIbvFlag = /\[(A|R|D)\]/.test(fullStatus);
    const isTBW = combinedStatus.includes('tbw');
    const isDenied = combinedStatus.includes('denied');

    const loanDiv = lastLoanSection.querySelector('div[id^="loan_"]');
    if (!loanDiv) return;
    const m = loanDiv.id.match(/loan_(\d+)/);
    if (!m) return;
    const loanId = m[1];

    // если уже Denied и есть сохранённый reason – показываем notice
    const pendingKey = confirmKey(loanId);
    const pendingReason = localStorage.getItem(pendingKey);
    if (isDenied && pendingReason) {
      showAutoDeniedNotice(pendingReason, loanId);
      return;
    }

    // дальше работаем только если TBW и ещё не Denied
    if (!isTBW || isDenied) return;

    const notesUrl =
      '/plm.net/customers/CustomerNotes.aspx?loanid=' +
      encodeURIComponent(loanId) +
      '&isnosection=true';

    fetch(notesUrl, { credentials: 'include' })
      .then(r => r.text())
      .then(html => {
        const tbwData = extractTbwDataFromNotes(html);

       if (!tbwData) {
  showStickyAlert('No TBW reason found in notes');
  return;
}


        if (tbwData.autoReasonCode && typeof window.deny_popup === 'function') {
          const key = autoKey(loanId);
          localStorage.setItem(key, tbwData.autoReasonCode);
          // сохраняем human-readable reason для notice
          localStorage.setItem(confirmKey(loanId), tbwData.displayText || '');

          try {
            window.deny_popup(Number(loanId));
          } catch (e) {
            console.error('deny_popup error', e);
          }
        } else {
          showPopup(tbwData.displayText, hasIbvFlag, loanId);
        }
      })
      .catch(err => console.error('TBW fetch error:', err));
  }

  function extractTbwDataFromNotes(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let grid =
      doc.querySelector('#maincontent_Notes_NotesGrid') ||
      doc.querySelector('table.DataTable');

    if (!grid) return null;

    const rows = Array.from(grid.querySelectorAll('tbody tr'));
    if (!rows.length) return null;

    let tbwRaw = null;

    rows.forEach(row => {
      const cell =
        row.querySelector('td:nth-child(3)') ||
        row.querySelector('td:last-child') ||
        row.querySelector('td');
      if (!cell) return;

      const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/tbw/i.test(text)) return;

      if (/^custom status added\s*:\s*tbw/i.test(text)) return;
      if (/^custom status removed\s*:\s*tbw?/i.test(text)) return;

      tbwRaw = text;
    });

    if (!tbwRaw) return null;

    const displayText = cleanTbwText(tbwRaw);
    if (!displayText) return null;

    const autoReasonCode = detectAutoReason(tbwRaw.toLowerCase());

    return { rawText: tbwRaw, displayText, autoReasonCode };
  }

  function cleanTbwText(text) {
    let t = text;

    t = t.replace(/custom status added\s*:\s*tbw/gi, '');
    t = t.replace(/custom status removed\s*:\s*tbw?/gi, '');
    t = t.replace(/,\s*tbw\b/gi, '');
    t = t.replace(/\btbw\b/gi, '');
    t = t.replace(/\bCust\s+/gi, '');
    t = t.replace(/\s*,\s*/g, ', ');
    t = t.replace(/,{2,}/g, ',');
    t = t.replace(/^\s*,\s*|\s*,\s*$/g, '');
    t = t.replace(/^[\s\-–—•.]+/, '');
    t = t.replace(/\s{2,}/g, ' ').trim();

    if (!t) return '';
    return titleCaseFirst(t);
  }

  function detectAutoReason(lower) {
    if (lower.includes('amount too low')) {
      return 'AMOUNT_TOO_LOW';
    }
    if (lower.includes('loan too expensive')) {
      return 'LOAN_TOO_EXPENSIVE';
    }
    if (
      lower.includes('customer did not apply') ||
      lower.includes('cust did not apply')
    ) {
      return 'CUSTOMER_DID_NOT_APPLY';
    }
    if (
      lower.includes('cannot verify online banking') ||
      lower.includes("can't verify online banking")
    ) {
      return 'CANNOT_VERIFY_ONLINE_BANKING';
    }
    if (
      lower.includes('cust has an active loan with us') ||
      lower.includes('active loan with us')
    ) {
      return 'ACTIVE_LOAN_WITH_US';
    }
    if (lower.includes('unacceptable bank')) {
      return 'UNACCEPTABLE_BANK';
    }
    if (lower.includes('not interested') || lower.includes('not interest')) {
      return 'NOT_INTERESTED';
    }
    return null;
  }

  // ---------- DENY POPUP (AUTO-DENY) ----------

  function handleDenyPopup() {
    const params = new URLSearchParams(window.location.search);
    const loanId = params.get('loanid');
    if (!loanId) return;

    const key = autoKey(loanId);
    const reasonCode = localStorage.getItem(key);
    if (!reasonCode) return;
    localStorage.removeItem(key);

    setTimeout(() => {
      tryAutoDeny(reasonCode);
    }, 300);
  }

  function tryAutoDeny(reasonCode) {
    try {
      const regexMap = {
        NOT_INTERESTED: /cust\s+not\s+interested/i,
        AMOUNT_TOO_LOW: /amount\s+too\s+low/i,
        LOAN_TOO_EXPENSIVE: /loan\s+too\s+expensive/i,
        CUSTOMER_DID_NOT_APPLY: /(customer|cust)\s+did\s+not\s+apply/i,
        CANNOT_VERIFY_ONLINE_BANKING: /cannot\s+verify\s+online\s+banking/i,
        ACTIVE_LOAN_WITH_US:
          /(cust\s+has\s+an\s+active\s+loan\s+with\s+us|active\s+loan\s+with\s+us)/i,
        UNACCEPTABLE_BANK: /unacceptable\s+bank/i
      };

      const regex = regexMap[reasonCode];
      if (!regex) return;

      const rows = Array.from(document.querySelectorAll('tr'));
      let checkbox = null;

      for (const tr of rows) {
        const txt = (tr.textContent || '').trim();
        if (!regex.test(txt)) continue;

        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) {
          checkbox = cb;
          break;
        }
      }

      if (!checkbox) {
        console.warn('Auto deny: checkbox not found for reason', reasonCode);
        return;
      }

      if (!checkbox.checked) {
        checkbox.click();
      }

      const buttons = Array.from(
        document.querySelectorAll(
          'input[type="submit"], input[type="button"], button'
        )
      );
      const denyBtn = buttons.find(el => {
        const t = (el.value || el.textContent || '').trim();
        return /deny\s+loan/i.test(t);
      });

      if (denyBtn) {
        denyBtn.click();
      } else {
        console.warn('Auto deny: "Deny Loan" button not found');
      }
    } catch (e) {
      console.error('Auto deny popup error:', e);
    }
  }
})();
