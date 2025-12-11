// ==UserScript==
// @name         TBW Notes Dropdown_Sales
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.1
// @description  Adds a TBW notes dropdown that auto-fills the Notes field on CustomerNotes page
// @match        http*://*/plm.net/customers/*
// @run-at       document-end
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// ==/UserScript==




/*******************************
 🔧 UPDATE POPUP (TBW Notes Dropdown - Sales)
 --------------------------------------------
 Показывает окно ТОЛЬКО один раз для каждой новой версии.

 ЧТО МЕНЯТЬ ПРИ ОБНОВЛЕНИИ:
 1) CURRENT_VERSION  – ставишь ту же версию, что и @version в шапке.
 2) updateLines      – здесь описываешь, что изменилось (список).
*******************************/

(function () {
    const CURRENT_VERSION = "1.1"; // 🔁 1) МЕНЯЙ ЗДЕСЬ ПРИ КАЖДОМ ОБНОВЛЕНИИ
    const STORAGE_KEY = "tbwNotesDropdownSales_lastSeenVersion";

    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
    if (lastSeenVersion === CURRENT_VERSION) return;

    const titleText = `⚙️ TBW Notes Dropdown for Sales — updated to version ${CURRENT_VERSION}`;

    // 🔧 2) МЕНЯЙ ЭТОТ МАССИВ ПОД КАЖДЫЙ РЕЛИЗ
    const updateLines = [
        "New statuses added:",
        "• TBW – Defaulted with us on the last payment",
        "• TBW – Bank account is not unique",
        "• TBW – Cool off by collections",
        "• TBW – Not approved by collections",
        "• TBW – Verified different SSN",
        "• TBW – DO NOT LOAN"
    ];

    function showUpdateModal() {
        // Полупрозрачный фон
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(0,0,0,0.45)";
        overlay.style.zIndex = "99999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        // Центральное окно
        const modal = document.createElement("div");
        modal.style.background = "#222";
        modal.style.color = "#fff";
        modal.style.padding = "16px 20px";
        modal.style.borderRadius = "10px";
        modal.style.boxShadow = "0 6px 18px rgba(0,0,0,0.6)";
        modal.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
        modal.style.fontSize = "13px";
        modal.style.maxWidth = "520px";  // ширина ограничена, но высота авто
        modal.style.minWidth = "320px";
        modal.style.whiteSpace = "pre-line";

        // Заголовок
        const titleEl = document.createElement("div");
        titleEl.textContent = titleText;
        titleEl.style.fontWeight = "600";
        titleEl.style.marginBottom = "10px";

        // Текст изменений
        const bodyEl = document.createElement("div");
        bodyEl.textContent = "\n" + updateLines.join("\n");
        bodyEl.style.marginBottom = "16px";

        // Кнопка OK
        const btn = document.createElement("button");
        btn.textContent = "OK";
        btn.style.padding = "6px 18px";
        btn.style.borderRadius = "20px";
        btn.style.border = "1px solid #00bcd4";
        btn.style.background = "#111";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "12px";
        btn.onmouseenter = () => { btn.style.background = "#00bcd4"; };
        btn.onmouseleave = () => { btn.style.background = "#111"; };
        btn.onclick = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

      modal.appendChild(titleEl);
modal.appendChild(bodyEl);

// Центрируем кнопку
const btnWrapper = document.createElement("div");
btnWrapper.style.textAlign = "center";
btnWrapper.appendChild(btn);

modal.appendChild(btnWrapper);
overlay.appendChild(modal);

        document.body.appendChild(overlay);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showUpdateModal);
    } else {
        showUpdateModal();
    }

    // Версию помечаем как уже показанную
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
})();



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


(function () {
    'use strict';

    function initTBWDropdown() {
        const standardSelect = document.getElementById('standardNote');
        const notesTextarea = document.getElementById('maincontent_NewNoteText');

        if (!standardSelect || !notesTextarea) return;

        // Создаём новый select
        const tbwSelect = document.createElement('select');
        tbwSelect.id = 'tbwNotes';
        tbwSelect.style.marginLeft = '8px';
        tbwSelect.style.width = '28ex';

        // Плейсхолдер
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- TBW Notes --';
        placeholder.selected = true;
        tbwSelect.appendChild(placeholder);

        // Список TBW-опций
      const tbwOptionsUW = [

    'TBW - Cust not interested',
    'TBW - Amount too low',
    'TBW - Loan too expensive',
    'TBW - Cust did not apply',
    'TBW - Cannot verify online banking',
    'TBW - Cust has an active loan with us',
    'TBW - Unacceptable bank',
    'TBW - Cust Not Cooperating',
    'TBW - No Direct Deposit',
    'TBW - Unacceptable Pay Frequency',
    'TBW - Bank account is not unique',
    'TBW - No Checking account',
    'TBW - New Bank Account',
    'TBW - Unemployed',
    'TBW - Minimum Income Requirement Not Met',
    'TBW - Defaulted with us on the last payment',
    'TBW - Cool off by collections',
    'TBW - DO NOT LOAN',
    'TBW - Not approved by collections',
    'TBW - Cust in Military',
    'TBW - Verified different SSN',
    'TBW - Fraud',
    'TBW - Other: '
]
;


        tbwOptionsUW.forEach(text => {
            const opt = document.createElement('option');
            opt.value = text;
            opt.textContent = text;
            tbwSelect.appendChild(opt);
        });

        // Вставляем справа от стандартного дропа
        standardSelect.parentNode.insertBefore(tbwSelect, standardSelect.nextSibling);

        // Логика подстановки текста
        tbwSelect.addEventListener('change', function () {
            const val = this.value;
            if (!val) return;

            // Полностью заменяем текст в поле Notes выбранным TBW reason
            notesTextarea.value = val;

            // Сбрасываем выбор обратно на плейсхолдер
            this.value = '';
        });
    }

    // Ждём, пока DOM полностью загрузится
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTBWDropdown);
    } else {
        initTBWDropdown();
    }
})();
