// ==UserScript==
// @name         Docs_Status_Checker
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Adds "Check Docs" button near History and checks if Additional Agreement signature was completed today.
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Docs_Status_Checker.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Docs_Status_Checker.user.js
// @grant        none
// ==/UserScript==




(function () {
    'use strict';

    const BTN_ID = 'cc-check-docs-btn';
    const PILL_ID = 'cc-check-docs-pill';

    function getCustomerId() {
        const url = new URL(window.location.href);
        const fromUrl = url.searchParams.get('customerid');
        if (fromUrl) return fromUrl;

        const match = document.body.innerText.match(/Customer\s*#\s*:\s*(\d+)/i);
        return match ? match[1] : null;
    }

    function getTodayMMDDYYYY() {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const yyyy = now.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    async function fetchDocsSignedToday() {
        const customerId = getCustomerId();
        if (!customerId) {
            throw new Error('Customer ID not found');
        }

        const res = await fetch(
            `/plm.net/customers/CustomerNotes.aspx?customerid=${customerId}&isnosection=true`,
            { credentials: 'include' }
        );

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const today = getTodayMMDDYYYY();

        const rows = doc.querySelectorAll('.DataTable tbody tr, table.DataTable tbody tr, .DataTable tr, table.DataTable tr');

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;

            const dateText = normalizeText(cells[0].textContent);
            const noteText = normalizeText(cells[2].innerText || cells[2].textContent);

            const isToday = dateText.startsWith(today);
            const isSigned = /Additional Agreement signature completed\.?/i.test(noteText);

            if (isToday && isSigned) {
                return {
                    found: true,
                    dateText,
                    noteText
                };
            }
        }

        return {
            found: false
        };
    }

    function removeOldPill() {
        const old = document.getElementById(PILL_ID);
        if (old) old.remove();
    }

    function createPill(text, type, tooltipText = '') {
        removeOldPill();

        const pill = document.createElement('span');
        pill.id = PILL_ID;
        pill.textContent = text;
        pill.title = tooltipText;

        pill.style.display = 'inline-block';
        pill.style.marginLeft = '8px';
        pill.style.padding = '4px 10px';
        pill.style.borderRadius = '999px';
        pill.style.fontWeight = 'bold';
        pill.style.fontSize = '12px';
        pill.style.lineHeight = '1.2';
        pill.style.verticalAlign = 'middle';
        pill.style.whiteSpace = 'nowrap';

        if (type === 'ok') {
            pill.style.background = '#dff7df';
            pill.style.border = '1px solid #7bd67b';
            pill.style.color = '#186a18';
        } else if (type === 'no') {
            pill.style.background = '#ffe3e3';
            pill.style.border = '1px solid #ff9d9d';
            pill.style.color = '#b12222';
        } else if (type === 'loading') {
            pill.style.background = '#eef4ff';
            pill.style.border = '1px solid #9bbcff';
            pill.style.color = '#1d4f91';
        } else {
            pill.style.background = '#fff2cc';
            pill.style.border = '1px solid #e0c36d';
            pill.style.color = '#7a5b00';
        }

        return pill;
    }

    function findHistoryButton() {
        const candidates = Array.from(document.querySelectorAll('a, button, input[type="button"]'));

        for (const el of candidates) {
            const text = normalizeText(
                el.tagName === 'INPUT' ? el.value : el.textContent
            );
            if (text === 'History') {
                return el;
            }
        }

        return null;
    }

    function styleButton(btn) {
        btn.style.marginLeft = '8px';
        btn.style.verticalAlign = 'middle';
        btn.style.cursor = 'pointer';

        if (!btn.className) {
            btn.className = 'AButton';
        }
    }

    function ensureUI() {
        const historyBtn = findHistoryButton();
        if (!historyBtn) return;

        if (document.getElementById(BTN_ID)) return;

        const btn = document.createElement('a');
        btn.id = BTN_ID;
        btn.href = 'javascript:void(0)';
        btn.textContent = 'Check Docs';
        btn.className = historyBtn.className || 'AButton';
        styleButton(btn);

        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            btn.textContent = 'Checking...';

            let pill = createPill('Checking...', 'loading', '');
            btn.after(pill);

            try {
                const result = await fetchDocsSignedToday();

                removeOldPill();

                if (result.found) {
                    pill = createPill(
                        '✅ Completed',
                        'ok',
                        `${result.dateText} — ${result.noteText}`
                    );
                } else {
                    pill = createPill(
                        '❌ Not completed',
                       'no'
                    
                    );
                }

                btn.after(pill);
            } catch (err) {
                removeOldPill();

                pill = createPill(
                    '⚠ Error',
                    'warn',
                    err?.message || 'Failed to check notes'
                );
                btn.after(pill);
            } finally {
                btn.textContent = 'Check Docs';
            }
        });

        historyBtn.insertAdjacentElement('afterend', btn);
    }

    const observer = new MutationObserver(() => {
        ensureUI();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    ensureUI();
})();
