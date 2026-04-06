// ==UserScript==
// @name         TBW Notes Dropdown_Sales
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.3
// @description  Adds a compact TBW quick search with dropdown below the field that auto-fills the Notes field on CustomerNotes page
// @match        http*://*/plm.net/customers/*
// @run-at       document-end
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_Notes_Dropdown_Sales.user.js
// ==/UserScript==

(function () {
    const CURRENT_VERSION = "1.2";
    const STORAGE_KEY = "tbwNotesDropdownSales_lastSeenVersion";

    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
    if (lastSeenVersion === CURRENT_VERSION) return;

    const titleText = `⚙️ TBW Notes Dropdown for Sales — updated to version ${CURRENT_VERSION}`;

    const updateLines = [
        "UI update:",
        "• Replaced old TBW dropdown with compact quick search",
        "• Dropdown now opens below the field",
        "• Better search and cleaner layout in Notes window",
        "• Keyboard navigation and mouse hover improved",
        "• Selecting a reason still fills Notes instantly"
    ];

    function showUpdateModal() {
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

        const modal = document.createElement("div");
        modal.style.background = "#222";
        modal.style.color = "#fff";
        modal.style.padding = "16px 20px";
        modal.style.borderRadius = "10px";
        modal.style.boxShadow = "0 6px 18px rgba(0,0,0,0.6)";
        modal.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
        modal.style.fontSize = "13px";
        modal.style.maxWidth = "520px";
        modal.style.minWidth = "320px";
        modal.style.whiteSpace = "pre-line";

        const titleEl = document.createElement("div");
        titleEl.textContent = titleText;
        titleEl.style.fontWeight = "600";
        titleEl.style.marginBottom = "10px";

        const bodyEl = document.createElement("div");
        bodyEl.textContent = "\n" + updateLines.join("\n");
        bodyEl.style.marginBottom = "16px";

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
        btn.onclick = () => overlay.remove();

        const btnWrapper = document.createElement("div");
        btnWrapper.style.textAlign = "center";
        btnWrapper.appendChild(btn);

        modal.appendChild(titleEl);
        modal.appendChild(bodyEl);
        modal.appendChild(btnWrapper);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showUpdateModal);
    } else {
        showUpdateModal();
    }

    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
})();

///////////////////////////////////////////////////////////

(function () {
    'use strict';

    const TBW_OPTIONS_SALES = [
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
    ];

    const HOST_ID = 'tbw-quick-host-sales';
    const INPUT_ID = 'tbwQuickSearchSales';
    const LIST_ID = 'tbwQuickListSales';
    const STYLE_ID = 'tbwQuickStylesSales';
    const HIGHLIGHT_CLASS = 'tbw-active';

    function norm(s) {
        return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function fillNotes(notesTextarea, value) {
        if (!notesTextarea || !value) return;

        notesTextarea.value = value;
        notesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        notesTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        notesTextarea.focus();

        if (value === 'TBW - Other: ') {
            try {
                notesTextarea.setSelectionRange(value.length, value.length);
            } catch (e) {}
        }
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #${HOST_ID}{
              position: relative;
              display: inline-block;
              margin-left: 8px;
              vertical-align: top;
          }

          #${INPUT_ID}{
              width: 27ex;
              height: 24px;
              padding: 2px 24px 2px 8px;
              box-sizing: border-box;
              border: 1px solid #b7b7b7;
              background: #fff;
              color: #111;
              font-size: 11px;
              font-family: Arial, sans-serif;
              line-height: 20px;
          }

          #${INPUT_ID}::placeholder{
              color: #222;
              opacity: 1;
          }

          #${INPUT_ID}:focus{
              outline: none;
              border-color: #8f8f8f;
          }

          #${HOST_ID} .tbw-arrow{
              position: absolute;
              right: 9px;
              top: 50%;
              transform: translateY(-50%);
              pointer-events: none;
              color: #000;
              font-size: 10px;
              line-height: 1;
          }

          #${LIST_ID}{
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    width: max-content;
    min-width: 320px;
    max-width: none; /* 👈 важно */
    max-height: 260px;
    overflow-y: auto;
    overflow-x: hidden;
    background: #ffffff; /* 👈 белый */
    color: #000000;
    border: 1px solid #c8c8c8;
    border-radius: 4px;
    box-shadow: 0 4px 10px rgba(0,0,0,.15);
    padding: 4px 0;
    z-index: 99999;
    display: none;
    font-family: Arial, sans-serif;
    white-space: nowrap;
}

          #${LIST_ID}.show{
              display: block;
          }

         #${LIST_ID} .tbw-item{
    padding: 6px 10px;
    font-size: 11px;
    cursor: pointer;
    color: #000;
}

#${LIST_ID} .tbw-item:hover{
    background: #e6f0ff;
}

#${LIST_ID} .tbw-item.${HIGHLIGHT_CLASS}{
    background: #cce0ff;
    color: #000;
}
          #${LIST_ID} .tbw-empty{
              padding: 8px 14px;
              font-size: 11px;
              color: #9fb2b8;
          }

          #${LIST_ID}::-webkit-scrollbar{
              width: 8px;
          }

          #${LIST_ID}::-webkit-scrollbar-thumb{
              background: rgba(255,255,255,0.18);
              border-radius: 8px;
          }
        `;
        document.head.appendChild(style);
    }

    function buildUI(standardSelect, notesTextarea) {
        if (document.getElementById(HOST_ID)) return;

        const host = document.createElement('div');
        host.id = HOST_ID;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = INPUT_ID;
        input.placeholder = '-- TBW Notes --';
        input.autocomplete = 'off';

        input.addEventListener('focus', () => {
            input.placeholder = '';
        });

        input.addEventListener('blur', () => {
            if (!input.value.trim()) {
                input.placeholder = '-- TBW Notes --';
            }
        });

        const arrow = document.createElement('span');
        arrow.className = 'tbw-arrow';
        arrow.textContent = '▼';

        const list = document.createElement('div');
        list.id = LIST_ID;

        host.appendChild(input);
        host.appendChild(arrow);
        host.appendChild(list);

        standardSelect.parentNode.insertBefore(host, standardSelect.nextSibling);

        let filtered = [...TBW_OPTIONS_SALES];
        let activeIndex = -1;

        function renderList(items) {
            filtered = items;
            activeIndex = items.length ? 0 : -1;

            if (!items.length) {
                list.innerHTML = `<div class="tbw-empty">No matches</div>`;
                return;
            }

            list.innerHTML = items.map((item, idx) => `
                <div class="tbw-item ${idx === activeIndex ? HIGHLIGHT_CLASS : ''}" data-index="${idx}">
                    ${item}
                </div>
            `).join('');
        }

        function positionList() {
            const rect = host.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const availableBelow = viewportHeight - rect.bottom - 20;
            list.style.maxHeight = Math.max(180, Math.min(availableBelow, 300)) + 'px';
        }

        function openList() {
            positionList();
            list.classList.add('show');
        }

        function closeList() {
            list.classList.remove('show');
            if (!input.value.trim() && document.activeElement !== input) {
                input.placeholder = '-- TBW Notes --';
            }
        }

        function applyItem(value) {
            fillNotes(notesTextarea, value);
            input.value = '';
            input.placeholder = '-- TBW Notes --';
            closeList();
            input.blur();
        }

        function cleanLabel(text) {
            return norm(text).replace(/^tbw\s*-\s*/, '');
        }

        function filterItems(term) {
            const q = norm(term);
            if (!q) return [...TBW_OPTIONS_SALES];

            const scored = TBW_OPTIONS_SALES
                .map(item => {
                    const full = norm(item);
                    const clean = cleanLabel(item);
                    const words = clean.split(/\s+/);

                    let score = 999;

                    if (clean === q) score = 0;
                    else if (clean.startsWith(q)) score = 1;
                    else if (words.some(w => w.startsWith(q))) score = 2;
                    else if (clean.includes(q)) score = 3;
                    else if (full.includes(q)) score = 4;
                    else return null;

                    return { item, score, clean };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    if (a.score !== b.score) return a.score - b.score;
                    return a.clean.localeCompare(b.clean);
                });

            return scored.map(x => x.item);
        }

        function refreshList() {
            renderList(filterItems(input.value));
            positionList();
        }

        function updateHighlight() {
            const nodes = Array.from(list.querySelectorAll('.tbw-item'));
            nodes.forEach((node, idx) => {
                node.classList.toggle(HIGHLIGHT_CLASS, idx === activeIndex);
            });

            const activeNode = nodes[activeIndex];
            if (activeNode) {
                activeNode.scrollIntoView({ block: 'nearest' });
            }
        }

        input.addEventListener('focus', () => {
            refreshList();
            openList();
        });

        input.addEventListener('input', () => {
            refreshList();
            openList();
        });

        input.addEventListener('keydown', (e) => {
            if (!list.classList.contains('show') && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                refreshList();
                openList();
            }

            if (!filtered.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
                updateHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                updateHighlight();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const chosen = filtered[Math.max(activeIndex, 0)];
                if (chosen) applyItem(chosen);
            } else if (e.key === 'Escape') {
                closeList();
            }
        });

        list.addEventListener('mousemove', (e) => {
            const item = e.target.closest('.tbw-item');
            if (!item) return;

            const idx = Number(item.dataset.index);
            if (idx !== activeIndex) {
                activeIndex = idx;
                updateHighlight();
            }
        });

        list.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.tbw-item');
            if (!item) return;

            e.preventDefault();
            const idx = Number(item.dataset.index);
            const chosen = filtered[idx];
            if (chosen) applyItem(chosen);
        });

        document.addEventListener('mousedown', (e) => {
            if (!host.contains(e.target)) {
                closeList();
            }
        });

        arrow.addEventListener('mousedown', (e) => {
            e.preventDefault();

            if (list.classList.contains('show')) {
                closeList();
            } else {
                refreshList();
                openList();
                input.focus();
            }
        });

        window.addEventListener('resize', () => {
            if (list.classList.contains('show')) positionList();
        });
    }

    function initTBWQuickSearch() {
        const standardSelect = document.getElementById('standardNote');
        const notesTextarea = document.getElementById('maincontent_NewNoteText');

        if (!standardSelect || !notesTextarea) return;

        injectStyles();
        buildUI(standardSelect, notesTextarea);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTBWQuickSearch);
    } else {
        initTBWQuickSearch();
    }
})();
