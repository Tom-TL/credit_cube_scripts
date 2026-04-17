// ==UserScript==
// @name         Toggle All Remarks 
// @author       Tom Harris & Liam Moss
// @namespace    https://github.com/TOM-TL/credit_cube_scripts
// @version      1.0
// @match        https://apply.creditcube.com/plm.net/*LoanRemarks.aspx*
// @match        https://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Toggle_All_Remarks.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Toggle_All_Remarks.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const BTN_ID = 'tm_toggle_btn';
    let allChecked = false;

    const TARGET_FIELDS = [
        'Final Approved Amount',
        'Minimum Amount The Customer Agrees To'
    ];

    function getCheckboxes(doc) {
        return Array.from(doc.querySelectorAll("input[type='checkbox']"))
            .filter(cb => {
                const text = cb.closest('tr')?.innerText || '';
                return !text.includes('Verified Via WA');
            });
    }

    function ensureInputField(row) {
        if (!row) return;

        const hasInput = row.querySelector("input[type='text']");
        if (hasInput) return;

        const labelCell = row.children[1];
        if (!labelCell) return;

        const wrapper = document.createElement('span');
        wrapper.style.marginLeft = '10px';

        const label = document.createElement('span');
        label.innerText = 'Details: ';
        label.style.marginRight = '5px';

        const input = document.createElement('input');
        input.type = 'text';
        input.style.width = '80px';

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        labelCell.appendChild(wrapper);
    }

    function handleSpecialFields(cb) {
        const row = cb.closest('tr');
        const text = row?.innerText || '';

        if (TARGET_FIELDS.some(t => text.includes(t))) {
            if (cb.checked) {
                ensureInputField(row);
            }
        }
    }

    function toggleAll(doc) {
        const boxes = getCheckboxes(doc);
        if (!boxes.length) return;

        allChecked = !allChecked;

        boxes.forEach(cb => {
            cb.checked = allChecked;
            cb.dispatchEvent(new Event('change', { bubbles: true }));

            handleSpecialFields(cb); // 🔥 только для нужных
        });
    }

    function addButton(doc) {
        const updateBtn = doc.querySelector('#maincontent_Btn_Update');
        if (!updateBtn) return;

        if (doc.getElementById(BTN_ID)) return;

        const btn = doc.createElement('input');
        btn.type = 'button';
        btn.id = BTN_ID;
        btn.value = 'Toggle all remarks';
        btn.className = updateBtn.className;
        btn.style.marginRight = '5px';

        btn.onclick = function (e) {
            e.preventDefault();
            toggleAll(doc);
        };

        updateBtn.parentNode.insertBefore(btn, updateBtn);
    }

    function init() {
        addButton(document);

        const observer = new MutationObserver(() => {
            addButton(document);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setInterval(() => addButton(document), 1000);
    }

    init();

})();

