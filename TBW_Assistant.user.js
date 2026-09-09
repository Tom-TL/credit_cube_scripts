// ==UserScript==
// @name         TBW Assistant
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.3
// @description  Show TBW denial reason, auto-deny some reasons, quick Review to CRP and quick Deny popup, with Copy reason button and auto-denied notice.
// @match        http*://*/plm.net/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Assistant.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Assistant.user.js
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  const href = window.location.href.toLowerCase();

  // Версия скрипта для попапа обновления
  const SCRIPT_VERSION = '1.3';
  const VERSION_KEY = 'tbwAssistant_version_seen';

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

// Попап обновления версии (⚙ TBW Assistant — updated to version ...)
  function maybeShowVersionNotice() {
    try {
      const lastSeen = localStorage.getItem(VERSION_KEY);
      if (lastSeen === SCRIPT_VERSION) return;

      // показываем и сразу помечаем версию как прочитанную
      localStorage.setItem(VERSION_KEY, SCRIPT_VERSION);
      showVersionPopup();
    } catch (e) {
      console.error('Version notice error', e);
    }
  }



 function showVersionPopup() {
  // если уже открыт — второй раз не создаём
  if (document.getElementById('tbw-version-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'tbw-version-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.18)';
  overlay.style.zIndex = '999996';

  const box = document.createElement('div');
  box.id = 'tbw-version-box';
  box.style.position = 'fixed';
  box.style.top = '50%';
  box.style.left = '50%';
  box.style.transform = 'translate(-50%, -50%)';
  box.style.background = '#ffeeb8';
  box.style.padding = '18px 26px 18px';
  box.style.borderRadius = '8px';
  box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  box.style.fontFamily = '"Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  box.style.maxWidth = '500px';
  box.style.maxHeight = 'none';
  box.style.overflow = 'visible';
  box.style.textAlign = 'left';
  box.style.zIndex = '999997';
  box.style.cursor = 'default';

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.fontSize = '20px';
  title.style.marginBottom = '14px';
  title.textContent = `⚙️ TBW Assistant — updated to version ${SCRIPT_VERSION}`;

  const list = document.createElement('ul');
  list.style.margin = '0 0 14px 18px';
  list.style.padding = '0';
  list.style.fontSize = '14px';
  list.style.lineHeight = '1.4';

  const li1 = document.createElement('li');
  li1.textContent = 'Auto-denied popup shows for all customers ';

  const li2 = document.createElement('li');
  li2.textContent = 'Denial reason text is now fully cleaned for copying';

 const li3 = document.createElement('li');
  li3.textContent = 'Review button selects and opens the newest Chirp/Yodlee report in CRP.';

 const li4 = document.createElement('li');
  li4.textContent = 'Added banner: “Opening Chirp/Yodlee Report [date] ”'


 const li5 = document.createElement('li');
  li5.textContent = 'Notification pop-up when script is updated.';

 const li6 = document.createElement('li');
  li6.textContent = 'If [A]/[R]/[D] exists but there is no recent Chirp/Yodlee, shows a Decision Logic manual check alert (with Customer ID + Copy/Open buttons).';


  list.appendChild(li1);
  list.appendChild(li2);
  list.appendChild(li3);
  list.appendChild(li4);
  list.appendChild(li5);
  list.appendChild(li6);

  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.display = 'block';
  okBtn.style.margin = '0 auto';
  okBtn.style.minWidth = '80px';
  okBtn.style.padding = '6px 18px';
  okBtn.style.borderRadius = '4px';
  okBtn.style.border = 'none';
  okBtn.style.background = '#c28a00';
  okBtn.style.color = '#fff';
  okBtn.style.fontWeight = '600';
  okBtn.style.cursor = 'pointer';

  function closeVersionPopup() {
    const ov = document.getElementById('tbw-version-overlay');
    const bx = document.getElementById('tbw-version-box');
    if (ov) ov.remove();
    if (bx) bx.remove();
    // снимаем обработчик Esc
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') {
      closeVersionPopup();
    }
  }

  okBtn.addEventListener('click', closeVersionPopup);

  // клик по затемнению — тоже закрыть
  overlay.addEventListener('click', closeVersionPopup);
  // клик по самому боксу не должен всплывать на оверлей
  box.addEventListener('click', e => e.stopPropagation());

  document.addEventListener('keydown', escHandler);

  box.appendChild(title);
  box.appendChild(list);
  box.appendChild(okBtn);
  document.body.appendChild(overlay);
  document.body.appendChild(box);
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

// Ключ теперь завязан на CUSTOMER #, а не на loanId
function confirmKey(loanId) {
  const cid = getCustomerIdFromPage();
  return cid ? 'cc_autoDeniedPending_cust_' + cid : null;
}




////////////////////////////////////////////////////////////////////////////////////


  // ---------- ALERTS ----------



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
      alert.style.background = '#ff3b30'; // красный, как у iOS
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



////////////////////////////////////////////////////////////////////////////////////////////////


function showDecisionLogicManualAlert(customerId) {
  // не плодим дубликаты
  if (document.getElementById('tbw-dl-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'tbw-dl-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.18);
    z-index:999998;
  `;

  const box = document.createElement('div');
  box.id = 'tbw-dl-box';
  box.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:#ffeeb8; border-radius:8px;
    padding:16px 22px 14px;
    box-shadow:0 4px 12px rgba(0,0,0,0.25);
    font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
    z-index:999999;
    max-width:420px;
    width: auto;
    isplay: inline-block;
    text-align:left;
  `;

  const title = document.createElement('div');
  title.textContent = 'Decision Logic report';
  title.style.cssText = 'font-weight:800; font-size:18px; margin-bottom:8px; color:#000;';



const msg = document.createElement('div');
msg.innerHTML = `
  <div style="font-weight:600; font-size:14px; line-height:1.4; color:#111; margin-bottom:10px;">
    Please check manually.
  </div>
  <div style="font-size:13px; color:#222; margin-bottom:14px;">
    Customer ID: <span style="font-weight:800;">${customerId || '—'}</span>
  </div>
`;



  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:10px; justify-content:center; align-items:center;';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy ID';
  copyBtn.style.cssText = 'padding:6px 14px; border-radius:4px; border:none; background:#4a4a4a; color:#fff; font-weight:700; cursor:pointer;';
  copyBtn.onclick = () => {
    const id = String(customerId || '').trim();
    if (!id) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(() => showCopyAlert('Copied ID'), () => fallbackCopy(id));
    } else {
      fallbackCopy(id);
    }
  };

  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open IBV';
  openBtn.style.cssText = 'padding:6px 14px; border-radius:4px; border:none; background:#c28a00; color:#fff; font-weight:800; cursor:pointer;';
  openBtn.onclick = () => window.open('https://ibv.creditsense.ai/', '_blank');


  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.cssText = 'padding:6px 14px; border-radius:4px; border:none; background:#c28a00; color:#fff; font-weight:800; cursor:pointer;';
  okBtn.onclick = close;

  function close() {
    overlay.remove();
    box.remove();
  }
  overlay.onclick = close;
  box.onclick = (e) => e.stopPropagation();

  btnRow.appendChild(copyBtn);
  btnRow.appendChild(openBtn);
  btnRow.appendChild(okBtn);

  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(btnRow);

  document.body.appendChild(overlay);
  document.body.appendChild(box);
}








////////////////////////////////////////////////////////////////////////////////////////////////////////////////



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




//////////////////////////////////////////////////////////////////////////////////////


  // Чёрный toast alert для Copy
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


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  // Центральное уведомление Auto-denied (держится, пока не кликнут)
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
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.2px;
  margin-bottom: 8px;
  line-height: 1.4;
  color: #000;
}

#tbw-auto-denied-reason {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: 0.15px;
  color: #111;
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
  const cKey = confirmKey(loanId);
  if (cKey) localStorage.removeItem(cKey);
}



    };
  }





/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


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
btnOk.addEventListener('click', () => {
  hideReviewHint();// спрятать баннер
  overlay.remove(); // закрыть попап
});

const btnDeny = document.createElement('button');
btnDeny.id = 'tbw-denial-deny';
btnDeny.textContent = 'Deny';
btnDeny.addEventListener('click', () => {
  hideReviewHint(); // спрятать баннер
  overlay.remove(); // закрыть попап
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




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



  // ---------- IBV REVIEW HELPERS ----------

// проверяем, есть ли статус [A] / [R] / [D] у текущего IBV
function hasIbvStatus() {
  const tds = Array.from(document.querySelectorAll('td'));
  const label = tds.find(
    td => td.textContent.replace(/\s+/g, ' ').trim() === 'Status :'
  );
  if (!label || !label.nextElementSibling) return false;
  const valueText = label.nextElementSibling.textContent || '';
  return /\[(A|R|D)\]/.test(valueText);
}

// [MM/DD/YYYY] -> Date (для IBV, берём самую "позднюю" дату в строке)
// [IBV] -> Date (берём самую "позднюю" дату в строке)
function parseIbvDateFromText(text) {
  if (!text) return null;

  // Ищем все даты формата MM/DD/YYYY в строке
  const matches = text.match(/(\d{2})\/(\d{2})\/(\d{4})/g);
  if (!matches) return null;

  // Берём последнюю дату (для "refreshed 12/09/2025" это будет как раз 12/09/2025)
  const last = matches[matches.length - 1];
  const m = last.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;

  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const d = new Date(year, month - 1, day);

  return isNaN(d.getTime()) ? null : d;
}



// Дата создания текущего лоуна (поле "Created :")
function getLoanCreatedDate() {
  const tds = Array.from(document.querySelectorAll('td'));
  const label = tds.find(
    td => td.textContent.replace(/\s+/g, ' ').trim() === 'Created :'
  );
  if (!label || !label.nextElementSibling) return null;

  const text = label.nextElementSibling.textContent || '';
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;

  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const d = new Date(year, month - 1, day);

  return isNaN(d.getTime()) ? null : d;
}

// Проверяем, подходит ли IBV к текущему лоуну:
// 1) если уже есть статус [A]/[R]/[D] — всегда true
// 2) если флага нет, но дата IBV >= даты Created — тоже считаем валидным
function isIbvValidForCurrentLoan(ibvDate) {
  if (!ibvDate) return false;

  // основной сценарий — есть [A]/[R]/[D]
  if (hasIbvStatus()) return true;

  // fallback — нет флага, но IBV не старше самого лоуна
  const loanDate = getLoanCreatedDate();
  if (!loanDate) return false;

  return ibvDate.getTime() >= loanDate.getTime();
}




// приоритет провайдера при одинаковой дате
function ibvProviderPriority(provider) {
  if (provider === 'chirp') return 2;
  if (provider === 'yodlee') return 1;
  return 0;
}

// ищем самый свежий IBV по Chirp + Yodlee
// возвращает { provider, select, index } или null
function selectLatestIbvReport() {
  const configs = [
    {
      provider: 'chirp',
      selectId: 'maincontent_ReportBarControl_LendMateIbvReports'
    },
    {
      provider: 'yodlee',
      selectId: 'maincontent_ReportBarControl_YodleeIbvReports'
    }
  ];

  let best = null;

  configs.forEach(cfg => {
    const select = document.getElementById(cfg.selectId);
    if (!select || !select.options || !select.options.length) return;

    const opts = select.options;
    for (let i = 0; i < opts.length; i++) {
      const opt = opts[i];
      if (!opt.value) continue; // "-- Saved ... Reports --"

      const d = parseIbvDateFromText(opt.text || opt.innerText || '');
      if (!d) continue;

      const candidate = {
        provider: cfg.provider,
        select,
        index: i,
        date: d
      };

      if (!best) {
        best = candidate;
      } else {
        const diff = candidate.date.getTime() - best.date.getTime();
        if (diff > 0) {
          // этот IBV новее
          best = candidate;
        } else if (diff === 0) {
          // одинаковая дата -> приоритет провайдера
          if (
            ibvProviderPriority(candidate.provider) >
            ibvProviderPriority(best.provider)
          ) {
            best = candidate;
          }
        }
      }
    }
  });

  if (!best) return null;

  // выставляем выбранный отчёт в соответствующем селекте
  best.select.selectedIndex = best.index;
  return {
    provider: best.provider,
    select: best.select,
    index: best.index
  };
}

// открываем IBV для провайдера: сначала "Open in CRP", если нет — "Show"
function openIbvForProvider(provider) {
  const holderId =
    provider === 'chirp'
      ? 'maincontent_ReportBarControl_Holder_LendMateIbvReportControls'
      : 'maincontent_ReportBarControl_Holder_YodleeIbvReportControls';

  const holder = document.getElementById(holderId);
  if (!holder) return false;

  const buttons = Array.from(
    holder.querySelectorAll('input[type="button"]')
  );

  // 1) сначала "Open in CRP"
  let btn =
    buttons.find(b => /open\s+in\s+crp/i.test(b.value || '')) ||
    // 2) если нет — ищем строго "Show"
    buttons.find(b => ((b.value || '').trim().toLowerCase() === 'show')) ||
    // 3) запасной вариант — любое value с "show"
    buttons.find(b => /show/i.test(b.value || ''));

  if (!btn) return false;

  btn.click();
  return true;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



function showReviewHint(message) {
  let bar = document.getElementById('tbw-review-hint');

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'tbw-review-hint';

    bar.style.cssText = [
      // позиционирование зададим ниже, в зависимости от того, есть ли попап
      'background:#fff3bd',
      'color:#444',
      'border:1px solid #e0b435',
      'padding:4px 10px',
      'border-radius:4px',
      'font-weight:600',
      'font-size:12px',
      'z-index:999999',
      'display:inline-flex',
      'align-items:center',
      'white-space:nowrap',
      'box-shadow:0 1px 3px rgba(0,0,0,.15)',
      'font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,system-ui,sans-serif'
    ].join(';');

    const textSpan = document.createElement('span');
    textSpan.className = 'tbw-review-text';
    bar.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = [
      'border:none',
      'background:transparent',
      'font-size:13px',
      'cursor:pointer',
      'line-height:1',
      'padding:0 0 0 6px',
      'margin:0'
    ].join(';');
    closeBtn.addEventListener('click', () => {
      bar.style.display = 'none';
    });

    bar.appendChild(closeBtn);
  }

  const textSpan = bar.querySelector('.tbw-review-text');
  if (textSpan) {
    textSpan.textContent = ' ▸  ' + message;
  }

  // Привязываем хинт к нашему DENIAL-попапу
  const popup = document.getElementById('tbw-denial-popup');

  if (popup) {
    // делаем попап контекстом для absolute-позиционирования (на всякий случай)
    if (getComputedStyle(popup).position === 'static') {
      popup.style.position = 'fixed'; // у тебя и так fixed, но вдруг
    }

    bar.style.position = 'absolute';
    bar.style.bottom = '100%'; // прямо над попапом
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.marginBottom = '6px'; // небольшой отступ от границы попапа
    bar.style.top = '';
    bar.style.right = '';

    // если раньше он был в body — перекидываем внутрь попапа
    if (bar.parentNode !== popup) {
      popup.appendChild(bar);
    }
  } else {
    // Запасной вариант: если попапа нет, показываем под верхним меню (как раньше)
    if (bar.parentNode !== document.body) {
      document.body.appendChild(bar);
    }
    bar.style.position = 'fixed';
    bar.style.top = '160px';
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    bar.style.marginBottom = '0';
    bar.style.bottom = '';
    bar.style.right = '';
  }

  bar.style.display = 'inline-flex';
}





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function hideReviewHint() {
  const bar = document.getElementById('tbw-review-hint');
  if (bar) {
    bar.style.display = 'none';
  }
}




//////////////////////////////////////////



function handleReviewClick(canReviewFlag) {
  const customerId = getCustomerIdFromPage();

  // 1) Пытаемся открыть Chirp/Yodlee как обычно
  const best = selectLatestIbvReport();
  if (!best) {
    // если статуса [A]/[R]/[D] нет — это реально “No recent IBV”
    if (!hasIbvStatus()) {
      showBottomAlert('No recent IBV found');
      return;
    }


    // статус есть, но нет репортов Chirp/Yodlee -> manual DecisionLogic
    showDecisionLogicManualAlert(customerId);
    return;
  }



  let optionText = (best.select.options[best.index].textContent || '').trim();
  const ibvDate = parseIbvDateFromText(optionText);

  // 2) Твоя проверка “свежести/валидности”
  if (!isIbvValidForCurrentLoan(ibvDate)) {
    if (!hasIbvStatus()) {
      showBottomAlert('No recent IBV found');
      return;
    }


    // статус есть, но “свежий” не проходит -> manual DecisionLogic
    showDecisionLogicManualAlert(customerId);
    return;
  }



  // 3) Хинт как раньше (Chirp/Yodlee)
  let cleanText = optionText;
  const m = optionText.match(/(Chirp|Yodlee)\s+Report\s+\[\d{2}\/\d{2}\/\d{4}\]/i);
  if (m) cleanText = m[0];

  cleanText = cleanText
    .replace(/^chirp/i, 'Chirp')
    .replace(/^yodlee/i, 'Yodlee');

  showReviewHint(`Opening ${cleanText}`);

  // 4) Открываем через Open in CRP / Show
  const ok = openIbvForProvider(best.provider);
  if (!ok) {
    showBottomAlert(
      'If the report window did not open, please check your browser pop-up blocker for apply.creditcube.com.'
    );
  }
}




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




  // ---------- CUSTOMER PAGE (TBW + NOTES) ----------

  function handleCustomerPage() {
    // Попап про обновление версии
    maybeShowVersionNotice();

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
     const fullStatusLower = fullStatus.toLowerCase();

    const hasIbvFlag = /\[(A|R|D)\]/.test(fullStatus);
    const isTBW = fullStatusLower.includes('tbw');

    const loanDiv = lastLoanSection.querySelector('div[id^="loan_"]');
    if (!loanDiv) return;
    const m = loanDiv.id.match(/loan_(\d+)/);
   if (!m) return;
      const loanId = m[1];

     // читаем pendingReason по CUSTOMER #
    const pendingKey = confirmKey(loanId);
    const pendingReason = pendingKey ? localStorage.getItem(pendingKey) : null;

    // 💡 НОВАЯ ЛОГИКА:
   // если reason сохранён, но статус УЖЕ НЕ TBW – считаем, что авто-денай случился,
   // независимо от того, Denied там или Active (включая рефайнанс/VIP)
   if (pendingReason && !isTBW) {
    showAutoDeniedNotice(pendingReason, loanId);
    // чтобы попап больше не слетал каждый раз
   localStorage.removeItem(pendingKey);
   return;
}

// дальше работаем только если статус всё ещё TBW
if (!isTBW) return;






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
        const cKey = confirmKey(loanId);
         if (cKey) {
        localStorage.setItem(cKey, tbwData.displayText || '');
}



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





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


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
      if (/^custom status added\s*:\s*tbw,\s*validated/i.test(text)) return;
      if (/^custom status added\s*:\s*\w+\s*;\s*custom status removed\s*:\s*\w+\s*$/i.test(text)) return;

      tbwRaw = text;
    });

    if (!tbwRaw) return null;

    const displayText = cleanTbwText(tbwRaw);
    if (!displayText) return null;

    const autoReasonCode = detectAutoReason(tbwRaw.toLowerCase());

    return { rawText: tbwRaw, displayText, autoReasonCode };

 }



////////////////////////////////////////////////////////////////////////////////////////////////////////


function getCustomerIdFromPage() {
  // Ищем надпись "Customer # :" и берём следующее значение
  const cells = document.querySelectorAll('td, span, div');
  for (const cell of cells) {
    const txt = (cell.textContent || '').trim();
    if (/^customer\s*#\s*:/i.test(txt)) {
      const next = cell.nextElementSibling;
      if (!next) continue;
      const m = (next.textContent || '').match(/(\d{3,})/);
      if (m) return m[1];
    }
  }
  return null;
}

//////////////////////////////////////////////////////////////////////////////////////////


  // Чистим строку для попапа
  function cleanTbwText(text) {
    let t = text;

   // 1) Игнорируем чисто служебные строки смены статусов
    //    Например:
    //    "Custom Status Added: UW; Custom Status Removed: TBW"
    //    "Custom Status Added: TBW; Custom Status Removed: UW"
    if (/^custom status added\s*:\s*\w+\s*;\s*custom status removed\s*:\s*\w+\s*$/i.test(t)) {
        return ''; // считаем, что reason'а здесь нет
    }
   // Удаляем ", TBW" в конце строк
      t = t.replace(/,\s*tbw\b/gi, '');

      // Убираем Other в начале
     t = t.replace(/^Other\s*[:\-]\s*/i, '');
     t = t.replace(/^TBW\s*[-:]?\s*Other\s*[:\-]?\s*/i, '');

      // 🔹 CCI – убираем в любом месте строки, с любыми знаками вокруг
     t = t.replace(/^\s*CCI\s*[-:,_./\\]*\s*/i, ''); // в начале
     t = t.replace(/\bCCI\s*[-:,_./\\]*\s*/gi, ''); // в любом месте

      // 🔹 TTC – убираем в любом месте строки, с любыми знаками вокруг
     t = t.replace(/^\s*TTC\s*[-:,_./\\]*\s*/i, ''); // в начале
     t = t.replace(/\bTTC\s*[-:,_./\\]*\s*/gi, ''); // в любом месте

      // Удаляем TBW и Cust-токены
     t = t.replace(/\bTBW\b/gi, ''); // "TBW" как отдельное слово
     t = t.replace(/\bCust\s+/gi, '');// "Cust " перед reason

     // Нормализуем запятые, пробелы и ведущие символы
     t = t
     .replace(/\s*,\s*/g, ', ') // аккуратные запятые: "a ,  b" -> "a, b"
     .replace(/,{2,}/g, ', ') // "a,, b" -> "a, b"
     .replace(/^[\s:.\-–—•,]+/, '') // срезаем мусор в начале: пробелы, :, . , тире, буллеты
     .replace(/\s{2,}/g, ' ') // сжимаем повторные пробелы
     .trim(); // финальный trim по краям


    if (!t) return '';
    return titleCaseFirst(t); // поднимает первую букву строки ("stop payment" → "Stop payment")
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
    if (lower.includes('unacceptable state')) {
      return 'UNACCEPTABLE_STATE';
    }
    if (lower.includes('not interested') || lower.includes('not interest')) {
      return 'NOT_INTERESTED';
    }
    return null;
  }




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


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
        UNACCEPTABLE_BANK: /unacceptable\s+bank/i,
        UNACCEPTABLE_STATE: /unacceptable\s+state/i
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
