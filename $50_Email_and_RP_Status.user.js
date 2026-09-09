// ==UserScript==
// @name         $50 Email + Status
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Sets Reduced Payment Given status and reliably sends the $50 payment NSF email
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/$50_Email_and_RP_Status.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/$50_Email_and_RP_Status.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__CC_50_EMAIL_STATUS_V13__) return;
  window.__CC_50_EMAIL_STATUS_V13__ = true;

  const BUTTON_ID = 'cc50EmailStatusBtn';
  const FLOW_PREFIX = 'CC_50_EMAIL_STATUS_';
  const EMAIL_TEMPLATE = '$50 payment NSF';
  const STATUS_NAME = 'Reduced Payment Given';

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  let running = false;

  // ============================================================
  // FLOW STATE
  // ============================================================

  function getLoanId() {
    const match = (document.body?.innerText || '')
      .match(/LOAN#\s*(\d+)/i);

    return match ? match[1] : null;
  }

  function flowKey() {
    return `${FLOW_PREFIX}${getLoanId() || 'UNKNOWN'}`;
  }

  function getFlow() {
    try {
      return JSON.parse(
        sessionStorage.getItem(flowKey()) || 'null'
      );
    } catch {
      return null;
    }
  }

  function setFlow(phase) {
    sessionStorage.setItem(
      flowKey(),
      JSON.stringify({
        phase,
        startedAt: Date.now()
      })
    );
  }

  function clearFlow() {
    sessionStorage.removeItem(flowKey());
  }

  // ============================================================
  // TOAST
  // ============================================================

  function toast(message, type = 'ok') {
    let box = document.getElementById('ccDocsToast');

    if (!box) {
      box = document.createElement('div');
      box.id = 'ccDocsToast';

      box.style.cssText =
        'position:fixed;' +
        'bottom:18px;' +
        'right:18px;' +
        'z-index:2147483647;' +
        'display:flex;' +
        'flex-direction:column-reverse;' +
        'align-items:flex-end;' +
        'pointer-events:none;';

      document.body.appendChild(box);
    }

    const item = document.createElement('div');
    item.textContent = message;

    const background =
      type === 'err'
        ? '#c62828'
        : type === 'warn'
          ? '#ef6c00'
          : '#1b5e20';

    item.style.cssText =
      'padding:10px 14px;' +
      'margin-top:8px;' +
      'border-radius:8px;' +
      'color:#fff;' +
      'font:12px Arial,sans-serif;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.3);' +
      'max-width:420px;' +
      'white-space:pre-line;' +
      'pointer-events:auto;' +
      `background:${background};`;

    box.appendChild(item);

    setTimeout(() => {
      item.remove();

      if (!box.children.length) {
        box.remove();
      }
    }, 3800);
  }

  function hardStop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function setButtonBusy(isBusy) {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    button.disabled = isBusy;

    button.textContent = isBusy
      ? 'Working…'
      : '$50 Email + Status';

    button.style.opacity = isBusy ? '.65' : '1';
    button.style.cursor = isBusy ? 'default' : 'pointer';
  }

  // ============================================================
  // STATUS
  // ============================================================

  function findStatusLink() {
    return Array.from(document.querySelectorAll('a'))
      .find((link) => {
        const text = (link.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();

        return /^status\s*:?\s*$/i.test(text);
      });
  }

  function accessibleDocuments() {
    const documents = [document];

    for (const frame of document.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) {
          documents.push(frame.contentDocument);
        }
      } catch {}
    }

    return documents;
  }

  function findStatusControls() {
    for (const doc of accessibleDocuments()) {
      const elements = Array.from(
        doc.querySelectorAll('label, td, div, span')
      );

      const statusElement = elements.find((element) => {
        const text = (element.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();

        return text === STATUS_NAME;
      });

      if (!statusElement) continue;

      let checkbox = null;

      if (
        statusElement.tagName === 'LABEL' &&
        statusElement.htmlFor
      ) {
        checkbox = doc.getElementById(statusElement.htmlFor);
      }

      if (!checkbox) {
        checkbox = statusElement.querySelector(
          'input[type="checkbox"]'
        );
      }

      if (!checkbox) {
        checkbox = statusElement.parentElement?.querySelector(
          'input[type="checkbox"]'
        );
      }

      if (
        !checkbox &&
        statusElement.previousElementSibling?.matches?.(
          'input[type="checkbox"]'
        )
      ) {
        checkbox = statusElement.previousElementSibling;
      }

      const buttons = Array.from(
        doc.querySelectorAll(
          'input[type="submit"], ' +
          'input[type="button"], ' +
          'button, a'
        )
      );

      const updateButton = buttons.find((element) => {
        const text = (
          element.value ||
          element.textContent ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        return /^update$/i.test(text);
      });

      if (checkbox && updateButton) {
        return {
          checkbox,
          updateButton
        };
      }
    }

    return null;
  }

  async function setReducedPaymentStatus() {
    const statusLink = findStatusLink();

    if (!statusLink) {
      throw new Error('Status link not found');
    }

    statusLink.click();

    let controls = null;

    for (let i = 0; i < 50; i++) {
      controls = findStatusControls();

      if (controls) break;

      await sleep(200);
    }

    if (!controls) {
      throw new Error(
        `"${STATUS_NAME}" status not found`
      );
    }

    if (!controls.checkbox.checked) {
      controls.checkbox.click();

      controls.checkbox.dispatchEvent(
        new Event('change', {
          bubbles: true
        })
      );

      await sleep(150);
    }

    // После обновления страницы продолжит отправку email.
    setFlow('email');

    controls.updateButton.click();

    toast(`${STATUS_NAME} updated`);

    await sleep(1300);
  }

  // ============================================================
  // MODAL WINDOWS
  // ============================================================

  function closeLMSModals() {
    try {
      document
        .querySelectorAll(
          '#modalWindow .closeBtn.modal-link'
        )
        .forEach((element) => element.click());

      document
        .querySelectorAll(
          '#modalWindow a[data-value="ok"]'
        )
        .forEach((element) => element.click());

      document
        .querySelectorAll('#modalWindow')
        .forEach((element) => element.remove());

      document
        .querySelectorAll('#sendingFrame')
        .forEach((element) => element.remove());

      document
        .querySelectorAll(
          '#iframewindow .window-close, ' +
          '#iframewindow .window-titlebar img'
        )
        .forEach((element) => {
          try {
            element.click();
          } catch {}
        });

      document.body.style.overflow = '';
    } catch {}
  }

  async function autoCloseDuringSend(maxMs = 6500) {
    const start = Date.now();

    while (Date.now() - start < maxMs) {
      closeLMSModals();

      const modalExists =
        !!document.querySelector('#modalWindow') ||
        !!document.querySelector('#sendingFrame');

      if (!modalExists) return;

      await sleep(250);
    }

    closeLMSModals();
  }

  // ============================================================
  // EMAIL
  // ============================================================

  function pageShowsContactDisabled() {
    return (document.body.innerText || '')
      .toLowerCase()
      .includes('contact method disabled');
  }

  function isOptionDisabled(option) {
    if (!option) return false;

    const text = (option.textContent || '')
      .toLowerCase();

    return (
      !!option.disabled ||
      text.includes('(disabled)') ||
      text.includes(' disabled')
    );
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findEmailActionOption(select) {
    const options = Array.from(select?.options || []);

    return options.find((option) => {
      if (isOptionDisabled(option)) return false;

      const text = normalizeText(option.textContent);
      const value = normalizeText(option.value);

      return (
        /(^|\s)e-?mail($|\s)/i.test(text) ||
        /send.*e-?mail|e-?mail.*send/i.test(text) ||
        value === 'send' ||
        value === 'email'
      );
    }) || null;
  }

  function getLetterControls(index) {
    const actionSelect =
      document.getElementById(
        `ctl00_LoansRepeater_LetterAction_${index}`
      ) ||
      document.querySelector(
        `select[id*="LoansRepeater_LetterAction_${index}"]`
      );

    if (!actionSelect) return null;

    const emailSelect =
      document.getElementById(
        `ctl00_LoansRepeater_Letter_ForEmail_${index}`
      ) ||
      document.querySelector(
        `select[id*="LoansRepeater_Letter_ForEmail_${index}"]`
      );

    const sendButton =
      document.getElementById(
        `ctl00_LoansRepeater_Btn_DoLetterActionSend_${index}`
      ) ||
      document.querySelector(
        `input[id*="LoansRepeater_Btn_DoLetterActionSend_${index}"]`
      );

    if (!emailSelect || !sendButton) {
      return null;
    }

    return {
      index,
      actionSelect,
      emailSelect,
      sendButton
    };
  }

  function findLetterControls() {
    const candidates = Array.from(
      document.querySelectorAll(
        'select[id*="LoansRepeater_LetterAction_"]'
      )
    )
      .map((select) => {
        const match = select.id.match(/_(\d+)$/);
        return match ? getLetterControls(match[1]) : null;
      })
      .filter(Boolean)
      .filter((controls) =>
        !!findEmailActionOption(controls.actionSelect)
      );

    if (!candidates.length) return null;

    // На странице может быть несколько займов. Предпочитаем видимый
    // Active/Past Due блок, где доступен email как contact method.
    candidates.sort((a, b) => {
      const score = (controls) => {
        const container =
          controls.actionSelect.closest(
            'tr, table, fieldset, .loan, .panel, div'
          );
        const text = normalizeText(container?.innerText);
        let result = controls.actionSelect.offsetParent ? 5 : 0;

        if (/\b(active|past due)\b/i.test(text)) result += 4;
        if (/\b(reversed|denied|paid|closed)\b/i.test(text)) result -= 3;

        return result;
      };

      return score(b) - score(a);
    });

    return candidates[0];
  }

  async function prepareEmailControls() {
    let controls = findLetterControls();

    if (!controls) {
      throw new Error('Email is not available as a contact method');
    }

    const index = controls.index;
    let emailAction = findEmailActionOption(
      controls.actionSelect
    );

    if (!emailAction) {
      throw new Error('Email is not available as a contact method');
    }

    if (controls.actionSelect.value !== emailAction.value) {
      controls.actionSelect.value = emailAction.value;
      controls.actionSelect.dispatchEvent(
        new Event('input', { bubbles: true })
      );
      controls.actionSelect.dispatchEvent(
        new Event('change', { bubbles: true })
      );
    }

    // LetterAction может запускать ASP.NET postback и перерисовывать
    // весь loan-блок. Поэтому старые DOM-ссылки использовать нельзя.
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      controls = getLetterControls(index);

      if (!controls) continue;

      emailAction = findEmailActionOption(
        controls.actionSelect
      );

      const selected = controls.actionSelect.options[
        controls.actionSelect.selectedIndex
      ];
      const selectedIsEmail =
        !!emailAction &&
        !!selected &&
        selected.value === emailAction.value;

      const templateReady = Array.from(
        controls.emailSelect.options || []
      ).some((option) =>
        normalizeText(option.textContent).includes(
          normalizeText(EMAIL_TEMPLATE)
        )
      );

      if (selectedIsEmail && templateReady) {
        return controls;
      }

      if (emailAction && !selectedIsEmail) {
        controls.actionSelect.value = emailAction.value;
        controls.actionSelect.dispatchEvent(
          new Event('change', { bubbles: true })
        );
      }
    }

    throw new Error('Email controls did not finish loading');
  }

  function visibleLmsMessage() {
    const selectors = [
      '#modalWindow',
      '#sendingFrame',
      '.validation-summary-errors',
      '[class*="error"]',
      '[class*="message"]'
    ];

    return selectors
      .flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
      )
      .filter((element) => element.offsetParent !== null)
      .map((element) => element.innerText || element.textContent || '')
      .join(' ');
  }

  async function clickSendAndVerify(controls) {
    const capturedAlerts = [];
    const originalAlert = window.alert;

    window.alert = function (message) {
      capturedAlerts.push(String(message || ''));
    };

    let sendUiSeen = false;

    try {
      controls.sendButton.click();

      for (let i = 0; i < 32; i++) {
        await sleep(250);

        const message = [
          ...capturedAlerts,
          visibleLmsMessage()
        ].join(' ');

        if (/(?:please\s+)?select\s+(?:a\s+)?(?:letter|loan)\s+type/i.test(message)) {
          throw new Error('Please select letter type');
        }

        if (/contact method disabled|email disabled|not allowed/i.test(message)) {
          throw new Error('Email disabled');
        }

        if (
          document.querySelector('#sendingFrame') ||
          document.querySelector('#modalWindow')
        ) {
          sendUiSeen = true;
        }

        if (sendUiSeen && i >= 2) break;
      }
    } finally {
      window.alert = originalAlert;
    }

    if (!sendUiSeen) {
      throw new Error('LMS did not confirm the email send');
    }

    await autoCloseDuringSend();
  }

  async function sendEmail() {
    if (pageShowsContactDisabled()) {
      throw new Error('Email disabled');
    }

    let controls = await prepareEmailControls();

    const templateOption = Array.from(
      controls.emailSelect.options || []
    ).find((option) => {
      const text = (option.textContent || '')
        .toLowerCase();

      return text.includes(
        EMAIL_TEMPLATE.toLowerCase()
      );
    });

    if (!templateOption) {
      throw new Error(
        `Email template not found: ${EMAIL_TEMPLATE}`
      );
    }

    if (isOptionDisabled(templateOption)) {
      throw new Error('Email disabled');
    }

    controls.emailSelect.value =
      templateOption.value;

    controls.emailSelect.dispatchEvent(
      new Event('input', {
        bubbles: true
      })
    );

    controls.emailSelect.dispatchEvent(
      new Event('change', {
        bubbles: true
      })
    );

    // Шаблон тоже может перерисовать блок. Повторно получаем элементы
    // и проверяем, что выбор действительно сохранился.
    await sleep(500);
    controls = getLetterControls(controls.index) || controls;

    const selectedTemplate = controls.emailSelect.options[
      controls.emailSelect.selectedIndex
    ];

    if (
      !selectedTemplate ||
      !normalizeText(selectedTemplate.textContent).includes(
        normalizeText(EMAIL_TEMPLATE)
      )
    ) {
      const refreshedOption = Array.from(
        controls.emailSelect.options || []
      ).find((option) =>
        normalizeText(option.textContent).includes(
          normalizeText(EMAIL_TEMPLATE)
        )
      );

      if (!refreshedOption) {
        throw new Error(
          `Email template not found: ${EMAIL_TEMPLATE}`
        );
      }

      controls.emailSelect.value = refreshedOption.value;
      controls.emailSelect.dispatchEvent(
        new Event('change', { bubbles: true })
      );
      await sleep(350);
      controls = getLetterControls(controls.index) || controls;
    }

    try {
      await clickSendAndVerify(controls);
    } catch (error) {
      if (!/select (?:letter|loan) type/i.test(String(error?.message || error))) {
        throw error;
      }

      // Один безопасный повтор после типичной гонки LMS.
      controls = await prepareEmailControls();
      const retryTemplate = Array.from(
        controls.emailSelect.options || []
      ).find((option) =>
        normalizeText(option.textContent).includes(
          normalizeText(EMAIL_TEMPLATE)
        )
      );

      if (!retryTemplate) throw error;

      controls.emailSelect.value = retryTemplate.value;
      controls.emailSelect.dispatchEvent(
        new Event('change', { bubbles: true })
      );
      await sleep(500);
      controls = getLetterControls(controls.index) || controls;
      await clickSendAndVerify(controls);
    }

    if (pageShowsContactDisabled()) {
      closeLMSModals();
      throw new Error('Email disabled');
    }
  }

  // ============================================================
  // MAIN ACTION
  // ============================================================

  async function finishEmailPhase() {
    if (running) return;

    running = true;
    setButtonBusy(true);

    try {
      await sendEmail();

      toast('$50 payment NSF email sent');
      clearFlow();
    } catch (error) {
      const message = String(
        error?.message || error
      );

      console.error(
        '[$50 Email + Status][EMAIL]',
        error
      );

      if (
        /disabled|cannot|not allowed/i.test(message)
      ) {
        toast(
          'Email disabled — status was updated',
          'err'
        );
      } else {
        toast(
          `Email failed: ${message}`,
          'err'
        );
      }

      clearFlow();
    } finally {
      running = false;
      setButtonBusy(false);
    }
  }

  async function handleClick() {
    if (running) return;

    running = true;
    setButtonBusy(true);
    setFlow('status');

    try {
      await setReducedPaymentStatus();

      running = false;

      await finishEmailPhase();
    } catch (error) {
      console.error(
        '[$50 Email + Status][STATUS]',
        error
      );

      toast(
        `Status update failed: ${
          error?.message || error
        }`,
        'err'
      );

      clearFlow();

      running = false;
      setButtonBusy(false);
    }
  }

  // ============================================================
  // BUTTON
  // ============================================================

  function getElementText(element) {
    return (
      element?.value ||
      element?.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findButtonByText(pattern) {
    return Array.from(
      document.querySelectorAll('a, button, input')
    ).find((element) =>
      pattern.test(getElementText(element))
    );
  }

  function injectButton() {
    if (
      !/CustomerDetails\.aspx/i.test(location.href)
    ) {
      return;
    }

    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    /*
     * Если есть Send PIF Docs — ставим кнопку справа от неё.
     * Если Send PIF Docs нет — ставим справа от Max Exposure.
     */
    const pifButton =
      document.getElementById('ccSendPIFDocs_UI13') ||
      findButtonByText(
        /^Send PIF (Docs|Documents)$/i
      );

    const maxExposureButton =
      findButtonByText(/^Max Exposure$/i);

    const anchor =
      pifButton?.parentNode
        ? pifButton
        : maxExposureButton;

    if (!anchor?.parentNode) return;

    const button = document.createElement('button');

    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '$50 Email + Status';

    // Стандартный стиль CRM.
    button.className = 'AButton';
    button.style.marginLeft = '4px';
    button.style.whiteSpace = 'nowrap';

    button.addEventListener(
      'click',
      (event) => {
        hardStop(event);
        handleClick();
      },
      true
    );

    /*
     * У Send PIF Docs рядом может стоять кнопка X.
     * В таком случае новую кнопку ставим после X.
     */
    const resetButton =
      anchor === pifButton
        ? pifButton.nextElementSibling
        : null;

    if (
      resetButton?.classList?.contains('cc-reset-x')
    ) {
      resetButton.parentNode.insertBefore(
        button,
        resetButton.nextSibling
      );
    } else {
      anchor.parentNode.insertBefore(
        button,
        anchor.nextSibling
      );
    }
  }

  // ============================================================
  // CONTINUE AFTER PAGE REFRESH
  // ============================================================

  function resumeIfNeeded() {
    const flow = getFlow();

    if (!flow) return;

    if (
      !flow.startedAt ||
      Date.now() - flow.startedAt >
        5 * 60 * 1000
    ) {
      clearFlow();
      return;
    }

    if (flow.phase === 'email') {
      setTimeout(
        finishEmailPhase,
        900
      );
    }
  }

  // ============================================================
  // START
  // ============================================================

  function boot() {
    injectButton();
    resumeIfNeeded();

    /*
     * Только проверяет наличие кнопки.
     * Ничего не перемещает и не вызывает бесконечную перерисовку.
     */
    setInterval(injectButton, 1000);
  }

  boot();
})();
