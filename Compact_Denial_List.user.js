// ==UserScript==
// @name         Compact Denial List
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.0
// @description  Compact denial reasons list with custom order, pill toggles, saved ON/OFF state, smaller boxes, faster access.
// @match        http*://*/plm.net/*EditLoanDenialReasons.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Compact_Denial_List.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Compact_Denial_List.user.js
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

    // Скрипт запускается внутри EditLoanDenialReasons.aspx (во внутреннем iframe)
    if (!/EditLoanDenialReasons\.aspx/i.test(location.href)) return;

    const STORAGE_KEY = 'tm_deny_compact_on';

    const DESIRED_ORDER = [
        "Cust Not Cooperating",
        "Multiple Open Loans",
        "Recently Received Loan",
        "Multiple Defaults/NSF",
        "Low EOD Balances",
        "No Direct Deposit",
        "Negative Account Balance",
        "Unacceptable Pay Frequency",
        "Irregular Online Banking Behavior",
        "Low Bank Account Activity",
        "No Checking account",
        "New Bank Account",
        "Minimum Income Requirement Not Met",
        "Unemployed",
        "Fraud",
        "Other"
    ];

    let allRows = [];
    let tbody;
    let mainTextareas = [];
    let extraTextareas = [];
    let compactOnGlobal = false;

    // ====== ФИКС ВЫСОТЫ ПОПАПА (убираем белый хвост) ======================
    function fixPopupHeight() {
        try {
            // работаем только если есть доступ к родителю
            if (window.parent === window) return;

            const pDoc = window.parent.document;
            const container = pDoc.getElementById('iframewindow');
            if (!container) return;

            const titleBar = container.querySelector('.window-titleBar');
            const statusBar = container.querySelector('.window-statusBar');
            const iframe = container.querySelector('iframe');

            const titleH = titleBar ? titleBar.offsetHeight : 0;
            const statusH = statusBar ? statusBar.offsetHeight : 0;
            // минимальный запас сверху/снизу
            const chromeExtra = titleH + statusH + 4;

            // высота контента внутри нашего iframe
            const docHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );

            // ещё сильнее поджимаем, чтобы убрать остаток зазора
            let totalHeight = docHeight + chromeExtra - 30;

            // не вылезать за пределы окна браузера
            const avail = window.parent.innerHeight || window.parent.screen.availHeight || 900;
            const maxH = avail - 40;
            if (totalHeight > maxH) totalHeight = maxH;
            if (totalHeight < 340) totalHeight = 340;

            container.style.height = totalHeight + 'px';

            if (iframe) {
                iframe.removeAttribute('height');
                iframe.style.height = (totalHeight - chromeExtra) + 'px';
            }
        } catch (e) {
            // если что-то пошло не так — тихо игнорируем
        }
    }
    // ======================================================================

    function init() {
        const tables = Array.from(document.querySelectorAll('table'));
        const reasonsTable = tables.find(t =>
            /Cust Not Interested|Cust Not Cooperating|Loan Too Expensive/i.test(t.innerText)
        );
        if (!reasonsTable) {
            return;
        }

        tbody = reasonsTable.querySelector('tbody') || reasonsTable;

        allRows = Array.from(tbody.querySelectorAll('tr'))
            .filter(tr => tr.querySelector('input[type="checkbox"]'));

        if (!allRows.length) return;

        allRows.forEach((row, idx) => {
            row.dataset.originalIndex = idx;
        });

        mainTextareas = [];
        allRows.forEach(row => {
            row.querySelectorAll('textarea').forEach(t => {
                if (!t.dataset.origRows) {
                    t.dataset.origRows = t.rows || '';
                    t.dataset.origHeight = t.style.height || '';
                }
                mainTextareas.push(t);
            });
        });

        extraTextareas = Array.from(document.querySelectorAll('textarea'))
            .filter(t => !mainTextareas.includes(t));

        extraTextareas.forEach(t => {
            if (!t.dataset.origRows) {
                t.dataset.origRows = t.rows || '';
                t.dataset.origHeight = t.style.height || '';
            }
        });

        // позволяем body подстраиваться по высоте
        const style = document.createElement('style');
        style.textContent = `
            html, body, body > form { height: auto !important; min-height: 0 !important; }
        `;
        document.head.appendChild(style);

        addToggleUI(applyCompact, applyFull);

        // если в прошлый раз было ON – перебиваем стандартный список
        if (localStorage.getItem(STORAGE_KEY) === '1') {
            setTimeout(() => {
                applyCompact();
            }, 120);
        } else {
            applyFull();
        }

        // и немного позже подрезаем высоту попапа
        setTimeout(fixPopupHeight, 150);
    }

    function applyCompact() {
        if (!tbody) return;

        allRows.forEach(row => {
            row.style.display = 'none';
        });

        const rowsToShow = [];

        DESIRED_ORDER.forEach(key => {
            const keyLc = key.toLowerCase();
            const row = allRows.find(r =>
                r.innerText.toLowerCase().includes(keyLc)
            );
            if (row && !rowsToShow.includes(row)) {
                row.style.display = '';
                rowsToShow.push(row);
            }
        });

        rowsToShow.forEach(row => {
            tbody.appendChild(row);
        });

        mainTextareas.forEach(t => {
            t.rows = 1;
            t.style.height = '22px';
        });

        extraTextareas.forEach(t => {
            t.rows = 1;
            t.style.height = '30px';
        });

        fixPopupHeight();
    }

    function applyFull() {
        if (!tbody) return;

        const sorted = allRows.slice().sort((a, b) =>
            (parseInt(a.dataset.originalIndex, 10) || 0) -
            (parseInt(b.dataset.originalIndex, 10) || 0)
        );
        sorted.forEach(row => {
            row.style.display = '';
            tbody.appendChild(row);
        });

        const restoreList = (list) => {
            list.forEach(t => {
                if (t.dataset.origRows) {
                    const r = parseInt(t.dataset.origRows, 10);
                    if (!isNaN(r) && r > 0) t.rows = r;
                }
                t.style.height = t.dataset.origHeight || '';
            });
        };
        restoreList(mainTextareas);
        restoreList(extraTextareas);

        fixPopupHeight();
    }

    function removeOldToggles() {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        checkboxes.forEach(cb => {
            const container = cb.closest('div, span, label');
            if (!container) return;

            const text = (container.textContent || '').toLowerCase();
            if (text.includes('deny list') && container.id !== 'tmCompactDenyToggle') {
                container.remove();
            }
        });
    }

    function addToggleUI(onFn, offFn) {
        removeOldToggles();

        if (document.getElementById('tmCompactDenyToggle')) return;

        const container = document.body;
        if (!container) return;

        compactOnGlobal = (localStorage.getItem(STORAGE_KEY) === '1');

        const pill = document.createElement('div');
        pill.id = 'tmCompactDenyToggle';
        pill.style.position = 'fixed';
        pill.style.top = '6px';
        pill.style.right = '10px';
        pill.style.borderRadius = '18px';
        pill.style.padding = '4px 16px';
        pill.style.fontSize = '11px';
        pill.style.fontFamily = 'Segoe UI, Arial, sans-serif';
        pill.style.cursor = 'pointer';
        pill.style.color = '#ffffff';
        pill.style.zIndex = '9999';
        pill.style.boxShadow = '0 0 4px rgba(0,0,0,0.35)';
        pill.style.userSelect = 'none';
        pill.style.display = 'flex';
        pill.style.alignItems = 'center';
        pill.style.justifyContent = 'center';
        pill.style.whiteSpace = 'nowrap';

        function bgColor() {
            return compactOnGlobal ? '#00a0e3' : '#4b4f5c';
        }

        function hoverColor() {
            return compactOnGlobal ? '#00b3ff' : '#5c6170';
        }

        function setText() {
            pill.textContent = 'Compact deny list: ' + (compactOnGlobal ? 'On' : 'Off');
            pill.style.background = bgColor();
        }

        pill.addEventListener('mouseenter', () => {
            pill.style.background = hoverColor();
        });

        pill.addEventListener('mouseleave', () => {
            pill.style.background = bgColor();
        });

        pill.addEventListener('click', () => {
            compactOnGlobal = !compactOnGlobal;
            refresh();
        });

        container.appendChild(pill);

        function refresh() {
            if (compactOnGlobal) {
                onFn();
            } else {
                offFn();
            }
            setText();
            localStorage.setItem(STORAGE_KEY, compactOnGlobal ? '1' : '0');
        }

        const observer = new MutationObserver(() => removeOldToggles());
        observer.observe(document.body, { childList: true, subtree: true });

        // стартовое применение состояния
        refresh();
    }

    const readyInterval = setInterval(() => {
        if (document.readyState === 'complete') {
            clearInterval(readyInterval);
            init();
        }
    }, 100);
})();


