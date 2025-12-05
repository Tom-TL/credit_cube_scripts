// ==UserScript==
// @name         TBW Notes Dropdown_Sales
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Adds a TBW notes dropdown that auto-fills the Notes field on CustomerNotes page
// @match        http*://*/plm.net/customers/CustomerNotes.aspx*
// @run-at       document-end
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// ==/UserScript==






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
    'TBW - No Checking account',
    'TBW - New Bank Account',
    'TBW - Unemployed',
    'TBW - Duplicate bank account',
    'TBW - Minimum Income Requirement Not Met',
    'TBW - Cust in Military',
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
