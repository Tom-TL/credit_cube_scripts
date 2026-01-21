// ==UserScript==
// @name         DC Quick Comments
// @namespace    https://github.com/TOM-TL/credit_cube_scripts
// @version      1.0.0
// @description  Adds compact action buttons under Comments to quickly add Green DC-related comments (PIF / Regular payment) without opening the Comments popup.
// @author       Tom Harris
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @grant        none
// @homepageURL  https://github.com/TOM-TL/credit_cube_scripts
// @supportURL   https://github.com/TOM-TL/credit_cube_scripts/issues
// @downloadURL  https://raw.githubusercontent.com/TOM-TL/credit_cube_scripts/main/DC_Quick_Comments.user.js
// @updateURL    https://raw.githubusercontent.com/TOM-TL/credit_cube_scripts/main/DC_Quick_Comments.user.js
// ==/UserScript==


(function () {
  'use strict';

  const GREEN_VALUE = '3';
  let isRunning = false;

  function getCustomerIdFromUrl() {
    return new URL(window.location.href).searchParams.get('customerid');
  }

  function refreshMainSection() {
    try {
      if (typeof window.refreshSection === 'function') {
        window.refreshSection('mainpropertiesview');
        return;
      }
    } catch (_) {}
    location.reload();
  }

  function submitGreenCommentHidden(commentText) {
    return new Promise((resolve, reject) => {
      const customerId = getCustomerIdFromUrl();
      if (!customerId) return reject(new Error('Customer ID not found'));

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      const url =
        `/plm.net/customers/CustomerComments.aspx?customerid=${encodeURIComponent(customerId)}&section=mainpropertiesview&ts=${Date.now()}`;

      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          cleanup();
          reject(new Error('Timeout'));
        }
      }, 10000);

      function cleanup() {
        clearTimeout(timer);
        iframe.onload = null;
        iframe.remove();
      }

      iframe.onload = () => {
        try {
          const doc = iframe.contentWindow.document;

          const category = doc.querySelector('#maincontent_Category');
          const textarea = doc.querySelector('#maincontent_NewCommentText');
          const submit = doc.querySelector('#maincontent_Btn_AddCommentAndClose');

          if (!category || !textarea || !submit) return;

          category.value = GREEN_VALUE;
          category.dispatchEvent(new Event('change', { bubbles: true }));

          textarea.value = commentText;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));

          submit.click();

          setTimeout(() => {
            done = true;
            cleanup();
            resolve();
          }, 1000);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      document.body.appendChild(iframe);
      iframe.src = url;
    });
  }

  function styleCompact(btn) {
    // ключевое — НИКАКОГО resize, только no-wrap
    btn.style.whiteSpace = 'nowrap';
    btn.style.marginTop = '6px';
    btn.style.float = 'none';
    btn.style.display = 'inline-block';
  }

  function createBtn(commentsBtn, id, label, commentText) {
    const btn = document.createElement('a');
    btn.id = id;
    btn.className = commentsBtn.className || 'AButton';
    btn.href = 'javascript:void(0)';
    btn.textContent = label;

    styleCompact(btn);

    btn.addEventListener('click', async () => {
      if (isRunning) return;
      isRunning = true;

      const original = btn.textContent;
      btn.style.pointerEvents = 'none';
      btn.textContent = 'Saving...';

      try {
        await submitGreenCommentHidden(commentText);
        refreshMainSection();
        btn.textContent = 'Saved ✓';
        setTimeout(() => (btn.textContent = original), 800);
      } catch (e) {
        console.error(e);
        alert('Failed to add comment');
        btn.textContent = original;
      } finally {
        btn.style.pointerEvents = '';
        isRunning = false;
      }
    });

    return btn;
  }

  function init() {
    const commentsBtn = document.querySelector('#ctl00_CommentsLink');
    if (!commentsBtn) return;
    if (document.querySelector('#cc_btn_pif_dc')) return;

    const parent = commentsBtn.closest('td') || commentsBtn.parentElement;

    const btnPif = createBtn(
      commentsBtn,
      'cc_btn_pif_dc',
      'PIF (DC)',
      'PIF with DC'
    );

    const btnReg = createBtn(
      commentsBtn,
      'cc_btn_reg_dc',
      'Reg pmt (DC)',
      'Regular payment with DC'
    );

    parent.appendChild(btnReg);
    parent.appendChild(btnPif);
  
  }

  init();
  new MutationObserver(init).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
