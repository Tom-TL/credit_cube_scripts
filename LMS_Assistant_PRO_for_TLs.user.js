// ==UserScript==
// @name         LMS Assistant PRO for TLs
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.2.8
// @description  Unified TL toolkit for CreditCube LMS — toggleable bundle of 12 helper scripts (DC Quick Comments, Reversed Loan, Docs Status Checker, Last Agent Note, Processing Admin Quick Search, TBW Assistant, TBW TL Helper, PIF DC Helper, Bulk Open Tabs, AA Bulk Cleanup, Compact Denial List, Auto-Assign).
// @author       Tom Harris
// @match        *://apply.creditcube.com/plm.net/*
// @match        http*://*/plm.net/*EditLoanDenialReasons.aspx*
// @run-at       document-end
// @grant        none
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @supportURL   https://github.com/Tom-TL/credit_cube_scripts/issues
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/LMS_Assistant_PRO_for_TLs.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/LMS_Assistant_PRO_for_TLs.user.js
// ==/UserScript==  

/*
  ╔════════════════════════════════════════════════════════════════════════════════╗
  ║                                                                                ║
  ║   🛠️  LMS ASSISTANT PRO for TLs — Unified Module                              ║
  ║                                                                                ║
  ║   This file bundles 12 individual TamperMonkey scripts into one module with   ║
  ║   a unified UI toggle menu in the CRM topbar.                                  ║
  ║                                                                                ║
  ║   HOW TO USE:                                                                  ║
  ║   • Install once — handles all pages (CustomerDetails, LoansReport, popups)   ║
  ║   • Click "🛠️ LMS Assistant PRO (TLs)" in the topbar to open menu              ║
  ║   • Toggle scripts on/off — page reloads matically                         ║
  ║   • State saved per browser via localStorage                                   ║
  ║                                                                                ║
  ║   QUICK CUSTOMIZATION:                                                         ║
  ║   • To permanently disable a script: set enabled: false in SCRIPTS_CONFIG     ║
  ║   • To change Bug Report form URL: edit BUG_REPORT_URL below                  ║
  ║                                                                                ║
  ╚════════════════════════════════════════════════════════════════════════════════╝
*/

(function () {
  'use strict';

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  🔧 MASTER CONFIG — Edit here to permanently disable a script           ║
  // ║                                                                         ║
  // ║  enabled: false  → script is COMPLETELY removed (not even in UI menu)  ║
  // ║  enabled: true   → script appears in UI; user toggle controls runtime  ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const SCRIPTS_CONFIG = {
    // ===== Customer Page =====
    dcQuickComments:    { enabled: true,  defaultOn: true  },
    reversedLoan:       { enabled: true,  defaultOn: true  },
    docsStatusChecker:  { enabled: true,  defaultOn: true  },
    lastAgentNote:      { enabled: true,  defaultOn: true  },
    paQuickSearch:      { enabled: true,  defaultOn: true  },
    tbwAssistant:       { enabled: true,  defaultOn: true  },
    tbwTlHelper:        { enabled: true,  defaultOn: true  },
    pifDcHelper:        { enabled: true,  defaultOn: true  },
    // ===== REPORTS =====
    bulkOpenTabs:       { enabled: true,  defaultOn: true  },
    aaBulkCleanup:      { enabled: true,  defaultOn: true  },
    // ===== POPUPS =====
    compactDenialList:  { enabled: true,  defaultOn: true  },
    // ===== GLOBAL / AUTOMATION =====
    autoAssign:         { enabled: true,  defaultOn: false },  // OFF by default — heavy automation
  };

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  🔗 BUG REPORT FORM URL                                                 ║
  // ║  ⬇ Replace this with your Google Form link once created                ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const BUG_REPORT_URL = 'https://forms.gle/cyWvuEfvYupSfThF6';

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  📜 CHANGELOG — used by the "What's new" popup                          ║
  // ║                                                                         ║
  // ║  After each release, add a new entry at the TOP of the array.           ║
  // ║  Format:                                                                ║
  // ║    { version: 'X.Y.Z', date: 'YYYY-MM-DD', changes: [                  ║
  // ║        { script: 'Script Name', text: 'What changed' },                ║
  // ║        ...                                                              ║
  // ║    ]}                                                                   ║
  // ║                                                                         ║
  // ║  Use script: 'UI' for general UI/framework changes,                    ║
  // ║      script: 'All' for module-wide changes.                            ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const SCRIPT_VERSION = '1.2.8';
  const CHANGELOG = [

    { version: '1.2.8', date: '09/16/2026', changes: [
        { script: 'Auto-Assign', text: 'Fixed: while a job was running, the progress window appeared on every LMS page (customer details, etc.). The panel is now strictly limited to the Pending Loans report; other report tabs still show the "running in another tab" status.' },
    ]},

    { version: '1.2.6', date: '09/10/2026', changes: [
        { script: 'Auto-Assign', text: 'Updated to standalone v2.3 logic: more stable roster loading, verified updates, safer recovery, hang-free engine, and clearer button feedback.' },
    ]},

    { version: '1.2.5', date: '09/10/2026', changes: [
        { script: 'TBW Assistant', text: 'Updated to match standalone v1.5 logic: now auto-denies the Unacceptable State reason as well.' },
    ]},

    { version: '1.2.4', date: '09/04/2026', changes: [
        { script: 'Processing Admin Quick Search', text: 'Fixed: admin list cache had no expiry, so newly added admins never appeared until the cache was manually cleared. Added a 6-hour TTL — the list now refreshes itself automatically.' },
    ]},

    { version: '1.2.2', date: '10/07/2026', changes: [
        { script: 'Auto-Assign', text: 'Added Random mode, assignment progress, Pause/Resume, Stop completely, and detailed assignment summaries.' },
    ]},
   
  ];


  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  📦 SCRIPT REGISTRY (metadata for UI rendering)                         ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const SCRIPT_REGISTRY = [
    //Customer Pagе
    { id: 'dcQuickComments',    name: 'DC Quick Comments',          category: 'Customer Page',
      description: 'Buttons: Adds quick comments PIF with DC and Reg pmt with DC' },

    { id: 'reversedLoan',       name: 'Reversed Loan Notifier',      category: 'Customer Page',
      description: 'Reversed Loan button — -sends Email + Text notification.' },

    { id: 'docsStatusChecker',  name: 'Docs Status Checker',         category: 'Customer Page',
      description: 'Adds Check Docs button — verifies if Additional Agreement was signed today.' },

    { id: 'lastAgentNote',      name: 'Last Agent Note',             category: 'Customer Page',
      description: 'Shows the last  agent note (filters out system events and TLs notes).' },

    { id: 'paQuickSearch',      name: 'Processing Admin Quick Search', category: 'Customer Page',
      description: 'Qucik admin search field next to Processing Admin.' },

    { id: 'tbwAssistant',       name: 'TBW Assistant',               category: 'Customer Page',
      description: 'Shows TBW denial reason, -denies certain reasons, Review in CRP and Copy.' },

    { id: 'tbwTlHelper',        name: 'TBW TL Helper',               category: 'Customer Page',
      description: 'Action buttons for TBW: 1- reassign to TL, remove TBW, put T&C Remark, 2 - send new E-Sign' },

    { id: 'pifDcHelper',        name: 'PIF DC Helper',               category: 'Customer Page',
      description: 'Buttons: Update DC (Email + Text), create PIF PP, send PIF docs for Active loans.' },


    // REPORTS
    { id: 'bulkOpenTabs',       name: 'Bulk Open Tabs',              category: 'Reports',
      description: 'Open N customers with one click in new tabs (5/10/15/20/All).' },
    { id: 'aaBulkCleanup',      name: 'AA In Progress Bulk Cleanup', category: 'Reports',
      description: 'Removes "AA In Progress" for ALL loans in Pending report, optionally unassigning AA Bot. Panel shows up only after Generate Report with AA In Progress = Yes + All Admins.' },


    // POPUPS
    { id: 'compactDenialList',  name: 'Compact Denial List',         category: 'Popups',
      description: 'Makes the denial reasons popup shorter and faster-to-use list.' },


    // AUTOMATION
    { id: 'autoAssign',         name: 'Auto-Assign',                 category: 'automation',
      description: 'Distributes Pending leads to Day/Late/Everyone with Random mode, progress, Pause/Resume and Stop.' },
  ];

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  💾 STORAGE LAYER                                                       ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const STORAGE_PREFIX = 'lms_tl_toggle_';
  const storage = {
    get(scriptId) {
      const raw = localStorage.getItem(STORAGE_PREFIX + scriptId);
      if (raw === null) {
        const cfg = SCRIPT_REGISTRY.find(s => s.id === scriptId);
        return cfg ? !!(SCRIPTS_CONFIG[scriptId]?.defaultOn) : false;
      }
      return raw === '1';
    },
    set(scriptId, value) {
      localStorage.setItem(STORAGE_PREFIX + scriptId, value ? '1' : '0');
    }
  };

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  ⏳ SHARED UTILITIES                                                    ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));


  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  🛡️ SAFE SCRIPT RUNNER (try/catch per script — isolation)              ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  function runScript(scriptId, fn) {
    try {
      fn();
    } catch (e) {
      console.error(`[LMS Assistant PRO TLs] Script "${scriptId}" crashed:`, e);
    }
  }

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  🎨 UI — TOP MENU                                                       ║
  // ║                                                                         ║
  // ║  Built to mirror "LMS Assistant PRO (Sales)" exactly:                  ║
  // ║  - Injects a new <td> into CRM's native #TopMenu, right after Sales    ║
  // ║  - Uses same font/sizing as Sales (Segoe UI 12px uppercase, textShadow)║
  // ║  - Opens on hover (mouseover), closes on mouseout                       ║
  // ║  - Dropdown is position:absolute, anchored to the menu cell             ║
  // ║  - Hover the cell OR the dropdown keeps it open                        ║
  // ╚═════════════════════════════════════════════════════════════════════════╝

function injectMenuStyles() {
  if (document.getElementById('lms-tl-menu-styles')) return;

  const css = `
    .lms-tl-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 18px;
      margin-left: 10px;
      flex-shrink: 0;
    }

    .lms-tl-switch input { display: none; }

    .lms-tl-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 34px;
    }

    .lms-tl-slider::before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }

    .lms-tl-switch input:checked + .lms-tl-slider {
      background-color: #4CAF50;
    }

    .lms-tl-switch input:checked + .lms-tl-slider::before {
      transform: translateX(18px);
    }

    #TopMenu {
      width: 900px !important;
      table-layout:  !important;
      white-space: nowrap !important;
    }

    #TopMenu td {
      white-space: nowrap !important;
    }

    #TopMenu-menuItemLMS-TLs {
      white-space: nowrap !important;
    }

    #lms-tl-dropdown .lms-tl-cat {
      padding: 7px 14px 5px;
      font-size: 10px;
      font-weight: 700;
      color: #6cd96c;
      text-shadow: 1px 1px #000;
      letter-spacing: 0.5px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background-image: url(Images/submenu-back.png);
      background-repeat: repeat-x;
    }

    #lms-tl-dropdown .lms-tl-cat:first-child {
      border-top: none;
    }

   
    
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'lms-tl-menu-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}






  // Find the existing "LMS Assistant PRO (Sales)" cell in the CRM topbar
  function findSalesMenuCell() {
    // First try the known Sales script id
    const byId = document.getElementById('TopMenu-menuItemLMS');
    if (byId) return byId;

    // Fallback — find by text content within #TopMenu
    const cells = document.querySelectorAll('#TopMenu td');
    for (const cell of cells) {
      const t = (cell.textContent || '').trim().toUpperCase();
      if (t.includes('LMS ASSISTANT PRO') && t.includes('SALES')) {
        return cell;
      }
    }
    return null;
  }

  // Find the HELP menu cell as a fallback insertion point
  function findHelpMenuCell() {
    const cells = document.querySelectorAll('#TopMenu td');
    for (const cell of cells) {
      if ((cell.textContent || '').trim().toUpperCase() === 'HELP') {
        return cell;
      }
    }
    return null;
  }






function buildMenu() {
  if (document.getElementById('TopMenu-menuItemLMS-TLs')) return;

  injectMenuStyles();

  const salesCell = findSalesMenuCell();
  const helpCell = findHelpMenuCell();
  const anchor = salesCell || helpCell;

  if (!anchor || !anchor.parentNode) return;

  const topMenu = document.getElementById('TopMenu');
  if (topMenu) {
    topMenu.style.width = '900px';
    topMenu.style.tableLayout = '';
    topMenu.style.whiteSpace = 'nowrap';
  }

  const menuCell = document.createElement('td');
  menuCell.id = 'TopMenu-menuItemLMS-TLs';
  menuCell.innerHTML = '&nbsp;🛠️ LMS Assistant PRO (TLs)&nbsp;';

  Object.assign(menuCell.style, {
    color: 'white',
    cursor: 'pointer',
    padding: '0 10px',
    height: '30px',
    lineHeight: '30px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    fontSize: '12px',
    textShadow: '1px 1px #000',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  });

  anchor.parentNode.insertBefore(menuCell, anchor.nextSibling);
  //  menuCell.style.marginLeft = '6px'; //

  const dropdown = document.createElement('div');
  dropdown.id = 'lms-tl-dropdown';

  Object.assign(dropdown.style, {
    display: 'none',
    position: 'absolute',
    width: '320px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    fontSize: '11px',
    textTransform: 'uppercase',
    textAlign: 'left',
    textShadow: '1px 1px #000',
    color: 'white',
    backgroundImage: 'url(Images/submenu-back.png)',
    backgroundRepeat: 'repeat-x',
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    border: 'none',
    zIndex: '999999',
    boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
    maxHeight: '85vh',
    overflowY: ''
  });

  document.body.appendChild(dropdown);

  const visibleScripts = SCRIPT_REGISTRY.filter(s => SCRIPTS_CONFIG[s.id]?.enabled);
  const categories = [...new Set(visibleScripts.map(s => s.category))];

  for (const cat of categories) {
    const catHeader = document.createElement('div');
    catHeader.className = 'lms-tl-cat';
    catHeader.textContent = '📂 ' + cat;
    dropdown.appendChild(catHeader);

    const scriptsInCat = visibleScripts.filter(s => s.category === cat);

    for (const script of scriptsInCat) {
      const row = document.createElement('div');

      Object.assign(row.style, {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '38px',
        padding: '2px 6px 2px 18px',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '11px',
        textTransform: 'uppercase',
        textAlign: 'left',
        textShadow: '1px 1px #000',
        backgroundImage: 'url(Images/submenu-back.png)',
        backgroundRepeat: 'repeat-x',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'all 0.15s ease'
      });

      const left = document.createElement('div');
      Object.assign(left.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      });

      const title = document.createElement('span');
      title.textContent = script.name;

     
const info = document.createElement('img');
info.src = 'https://cdn-icons-png.flaticon.com/512/108/108153.png';
info.alt = 'Info';
info.title = script.description || '';

Object.assign(info.style, {
  width: '12px',
  height: '12px',
  marginLeft: '4px',
  cursor: 'help',
  filter: 'invert(1)',
  opacity: '0.9',
  flexShrink: '0'
});
    
      left.appendChild(title);
      left.appendChild(info);

      const toggle = document.createElement('label');
      toggle.className = 'lms-tl-switch';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = storage.get(script.id);

      input.onchange = e => {
        e.stopPropagation();
        storage.set(script.id, input.checked);
        location.reload();
      };

      const slider = document.createElement('span');
      slider.className = 'lms-tl-slider';

      toggle.appendChild(input);
      toggle.appendChild(slider);

      row.appendChild(left);
      row.appendChild(toggle);
row.addEventListener('mouseenter', () => {
  row.style.backgroundColor = 'rgb(175, 209, 255)';
  row.style.color = 'black';
  row.style.textShadow = '1px 1px white';
  info.style.filter = 'none';
});

row.addEventListener('mouseleave', () => {
  row.style.backgroundColor = 'transparent';
  row.style.color = 'white';
  row.style.textShadow = '1px 1px black';
  info.style.filter = 'invert(1)';
});
      dropdown.appendChild(row);
    }
  }

  const bugBtn = document.createElement('div');
  bugBtn.textContent = 'NEW IDEAS / BUG REPORT';

  Object.assign(bugBtn.style, {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: '38px',
    padding: '10px 18px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    fontSize: '11px',
    textTransform: 'uppercase',
    textShadow: '1px 1px #000',
    backgroundImage: 'url(Images/submenu-back.png)',
    backgroundRepeat: 'repeat-x',
    backgroundColor: 'transparent',
    color: 'white',
    cursor: 'pointer',
    borderTop: '1px solid rgba(255,255,255,0.08)'
  });

  bugBtn.addEventListener('mouseenter', () => {
    bugBtn.style.backgroundColor = 'rgb(175, 209, 255)';
    bugBtn.style.color = 'black';
    bugBtn.style.textShadow = '1px 1px white';
  });

  bugBtn.addEventListener('mouseleave', () => {
    bugBtn.style.backgroundColor = 'transparent';
    bugBtn.style.color = 'white';
    bugBtn.style.textShadow = '1px 1px black';
  });

  bugBtn.onclick = () => window.open(BUG_REPORT_URL, '_blank');
  dropdown.appendChild(bugBtn);

  let hideTimer = null;

  function positionDropdown() {
    const rect = menuCell.getBoundingClientRect();

dropdown.style.left = `${rect.left + window.scrollX}px`;
dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  }

  function activateMenu() {
    clearTimeout(hideTimer);
    positionDropdown();

  

    dropdown.style.display = 'block';

    menuCell.style.backgroundColor = 'rgb(175, 209, 255)';
    menuCell.style.color = 'black';
    menuCell.style.textShadow = '1px 1px white';
  }



function deactivateMenu() {
  hideTimer = setTimeout(() => {
    dropdown.style.display = 'none';

    menuCell.style.backgroundColor = '';
    menuCell.style.color = 'white';
    menuCell.style.textShadow = '1px 1px black';
  }, 60);
}



  menuCell.addEventListener('mouseenter', activateMenu);
  menuCell.addEventListener('mouseleave', deactivateMenu);

  dropdown.addEventListener('mouseenter', activateMenu);
  dropdown.addEventListener('mouseleave', deactivateMenu);

  window.addEventListener('scroll', () => {
    if (dropdown.style.display === 'block') positionDropdown();
  }, true);

  window.addEventListener('resize', () => {
    if (dropdown.style.display === 'block') positionDropdown();
  });
}






  function initUI() {
    // EditLoanDenialReasons.aspx runs inside an iframe — don't inject UI there
    if (/EditLoanDenialReasons\.aspx/i.test(location.href)) return;

    injectMenuStyles();
    buildMenu();

    // Re-inject if CRM re-renders the topbar (AJAX) — handled by interval
    setInterval(() => {
      if (!document.getElementById('TopMenu-menuItemLMS-TLs')) {
        buildMenu();
      }
    }, 1000);
  }

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  📢 "WHAT'S NEW" POPUP — shows changelog after version bump             ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  const CHANGELOG_SEEN_KEY = 'lms_tl_changelog_seen_version';

  function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] || 0, db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  function maybeShowChangelog() {
    // Skip in iframes (e.g. denial popup)
    if (/EditLoanDenialReasons\.aspx/i.test(location.href)) return;
    if (window.top !== window.self) return;

    try {
      const lastSeen = localStorage.getItem(CHANGELOG_SEEN_KEY);

      // First install — silently record current version, don't spam popup
      if (!lastSeen) {
        localStorage.setItem(CHANGELOG_SEEN_KEY, SCRIPT_VERSION);
        return;
      }

      // Same or newer already seen — nothing to show
      if (compareVersions(lastSeen, SCRIPT_VERSION) >= 0) return;

      // Collect all entries strictly newer than lastSeen
      const newEntries = CHANGELOG.filter(e =>
        compareVersions(e.version, lastSeen) > 0 &&
        compareVersions(e.version, SCRIPT_VERSION) <= 0
      );
      if (newEntries.length === 0) {
        localStorage.setItem(CHANGELOG_SEEN_KEY, SCRIPT_VERSION);
        return;
      }

      showChangelogPopup(newEntries, lastSeen);
    } catch (e) {
      console.warn('[LMS Assistant PRO TLs] Changelog popup error:', e);
    }
  }

  function showChangelogPopup(entries, fromVersion) {
    if (document.getElementById('lms-tl-changelog-popup')) return;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'lms-tl-changelog-popup';
    Object.assign(backdrop.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)',
      zIndex: '2147483647', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    });

    // Card
    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#ffffff',
      color: '#1a1a1a',
      borderRadius: '10px',
      width: 'min(460px, 92vw)',
      maxHeight: '80vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 6px 20px rgba(0,0,0,0.30)',
      overflow: 'hidden',
      textAlign: 'left',
    });

    // Header (amber bar)
    const header = document.createElement('div');
    Object.assign(header.style, {
      background: '#c28a00',
      padding: '14px 22px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: '0',
    });
    header.innerHTML =
      `<span style="font-weight:600;font-size:15px;color:#ffffff;">⚙️ LMS Assistant PRO (TLs) — what's new</span>
       <span style="font-size:12px;font-weight:500;color:#ffffff;opacity:0.92;margin-left:10px;white-space:nowrap;">v${fromVersion} → v${SCRIPT_VERSION}</span>`;
    card.appendChild(header);

    // Body (scrollable)
    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '16px 22px 12px',
      overflowY: '',
      fontSize: '14px',
      lineHeight: '1.5',
      flex: '1 1 ',
      color: '#1a1a1a',
      background: '#ffffff',
    });

    entries.forEach(entry => {
      // version row: bold version + grey date
      const versionRow = document.createElement('div');
      versionRow.style.cssText = 'margin:6px 0 8px;display:flex;align-items:baseline;gap:8px;';
      versionRow.innerHTML =
        `<span style="font-weight:600;color:#1a1a1a;font-size:14px;">v${entry.version}</span>` +
        `<span style="color:#888;font-size:12px;">${entry.date}</span>`;
      body.appendChild(versionRow);

      // changes list
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:0 0 14px 0;padding:0;list-style:none;';
      entry.changes.forEach(ch => {
        const li = document.createElement('li');
        li.style.cssText = 'margin:6px 0;display:flex;gap:10px;align-items:flex-start;';

        const tag = document.createElement('span');
        tag.textContent = ch.script;
        tag.style.cssText =
          'display:inline-block;flex-shrink:0;margin-top:2px;' +
          'padding:2px 9px;border-radius:4px;' +
          'background:#fceec5;color:#5a4400;' +
          'font-size:11px;font-weight:600;letter-spacing:0.2px;';

        const txt = document.createElement('span');
        txt.textContent = ch.text;
        txt.style.cssText = 'font-size:14px;color:#1a1a1a;line-height:1.5;';

        li.appendChild(tag);
        li.appendChild(txt);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    });

    card.appendChild(body);

    // Footer (button)
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      padding: '12px 22px 16px',
      borderTop: '1px solid #ececec',
      display: 'flex', justifyContent: 'flex-end',
      flexShrink: '0',
      background: '#ffffff',
    });

    const btn = document.createElement('button');
    btn.textContent = 'OK';
    Object.assign(btn.style, {
      padding: '7px 24px',
      borderRadius: '5px',
      border: 'none',
      background: '#c28a00',
      color: '#ffffff',
      fontWeight: '600',
      fontSize: '13px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    });
    btn.onmouseover = () => { btn.style.filter = 'brightness(1.08)'; };
    btn.onmouseout  = () => { btn.style.filter = ''; };
    btn.onclick = () => {
      try { localStorage.setItem(CHANGELOG_SEEN_KEY, SCRIPT_VERSION); } catch {}
      backdrop.remove();
    };
    footer.appendChild(btn);
    card.appendChild(footer);

    // Click on backdrop closes too
    card.addEventListener('click', e => e.stopPropagation());
    backdrop.addEventListener('click', () => btn.click());

    backdrop.appendChild(card);
    (document.body || document.documentElement).appendChild(backdrop);

    // Close on Escape
    function onKey(e) {
      if (e.key === 'Escape') {
        btn.click();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);
  }


  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║  🚀 INIT UI (always runs)                                               ║
  // ╚═════════════════════════════════════════════════════════════════════════╝
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initUI(); maybeShowChangelog(); });
  } else {
    initUI();
    maybeShowChangelog();
  }

  // ╔═════════════════════════════════════════════════════════════════════════╗
  // ║                                                                         ║
  // ║   📦 SCRIPT BUNDLE — each script is an isolated IIFE wrapped in        ║
  // ║   runScript() for try/catch isolation. They check both:                ║
  // ║     1) SCRIPTS_CONFIG[id].enabled (master kill-switch)                 ║
  // ║     2) storage.get(id)            (user toggle)                        ║
  // ║                                                                         ║
  // ║   Only runs if BOTH are true.                                           ║
  // ║                                                                         ║
  // ╚═════════════════════════════════════════════════════════════════════════╝

  function shouldRun(scriptId) {
    if (!SCRIPTS_CONFIG[scriptId]?.enabled) return false;
    return storage.get(scriptId);
  }

  // ============================================================================
  // SCRIPT BUNDLES (Stage 1: 9 ready scripts + 3 placeholders for Stage 2)
  // ============================================================================

  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: dcQuickComments
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('dcQuickComments')) runScript('dcQuickComments', function () {
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
      let _dcDebounce = null;
      new MutationObserver(() => {
        clearTimeout(_dcDebounce);
        _dcDebounce = setTimeout(init, 120);
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: reversedLoan
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('reversedLoan')) runScript('reversedLoan', function () {

      const sleep = _sleep;

      // ===== DOCS-STYLE TOAST =====
      function toast(msg, isErr = false) {
       let box = document.getElementById('ccToast_reversedLoan');
        if (!box) {
          box = document.createElement('div');
        box.id = 'ccToast_reversedLoan';
          box.style.position = 'fixed';
          box.style.bottom = '20px';
          box.style.right = '20px';
          box.style.zIndex = '999999';
          document.body.appendChild(box);
        }

        const t = document.createElement('div');
        t.textContent = msg;
        t.style.background = isErr ? '#dc2626' : '#16a34a';
        t.style.color = '#fff';
        t.style.padding = '10px 14px';
        t.style.marginTop = '8px';
        t.style.borderRadius = '8px';
        t.style.fontFamily = 'Arial';
        t.style.fontSize = '12px';
        t.style.boxShadow = '0 10px 20px rgba(0,0,0,.4)';
        box.appendChild(t);

        setTimeout(() => t.remove(), 3500);
      }

      // ===== Status check: must contain "Reversed" (other words allowed) =====
      function loanIsReversed() {
        const label = Array.from(document.querySelectorAll('td'))
          .find(td => (td.textContent || '').trim() === 'Status :');
        if (!label) return false;

        const row = label.closest('tr');
        const valueCell = row?.querySelectorAll('td')?.[1];
        const txt = (valueCell?.textContent || '').toLowerCase();

        return txt.includes('reversed');
      }

      // =====================================================================
      // MODAL CLOSE
      // =====================================================================
      function closeLMSModals() {
        try {
          document.querySelectorAll('#modalWindow .closeBtn.modal-link').forEach((b) => b.click());
          document.querySelectorAll('#modalWindow a[data-value="ok"]').forEach((b) => b.click());
          document.querySelectorAll('#modalWindow').forEach((m) => m.remove());
          document.querySelectorAll('#sendingFrame').forEach((f) => f.remove());

          document.querySelectorAll('#iframewindow .window-close, #iframewindow .window-titlebar img').forEach((x) => {
            try { x.click(); } catch {}
          });

          document.body.style.overflow = '';
        } catch {}
      }

      async function CloseDuringSend(maxMs = 6500) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
          closeLMSModals();
          const hasModal = !!document.querySelector('#modalWindow') || !!document.querySelector('#sendingFrame');
          if (!hasModal) return;
          await sleep(250);
        }
        closeLMSModals();
      }

      function pageShowsContactDisabled() {
        return (document.body.innerText || '').toLowerCase().includes('contact method disabled');
      }

      function isOptionDisabledLike(opt) {
        if (!opt) return false;
        const t = (opt.textContent || '').toLowerCase();
        return !!opt.disabled || t.includes('(disabled)') || t.includes(' disabled');
      }

      // =====================================================================
      // LETTER CONTROLS
      // =====================================================================
      function getLetterIndex() {
        const actionSel = document.querySelector('select[id*="LoansRepeater_LetterAction_"]');
        if (!actionSel) return null;
        const m = actionSel.id.match(/_(\d+)$/);
        return m ? m[1] : null;
      }

      function byIdOrQuery(idExact, query) {
        return document.getElementById(idExact) || document.querySelector(query);
      }

      function findLetterControls() {
        const idx = getLetterIndex();
        if (idx == null) return null;

        const actionSel = byIdOrQuery(
          `ctl00_LoansRepeater_LetterAction_${idx}`,
          `select[id*="LoansRepeater_LetterAction_${idx}"]`
        );

        const sendBtn = byIdOrQuery(
          `ctl00_LoansRepeater_Btn_DoLetterActionSend_${idx}`,
          `input[id*="LoansRepeater_Btn_DoLetterActionSend_${idx}"]`
        );

        const selText = byIdOrQuery(
          `ctl00_LoansRepeater_Letter_ForTextMessage_${idx}`,
          `select[id*="LoansRepeater_Letter_ForTextMessage_${idx}"]`
        );

        const selEmail = byIdOrQuery(
          `ctl00_LoansRepeater_Letter_ForEmail_${idx}`,
          `select[id*="LoansRepeater_Letter_ForEmail_${idx}"]`
        );

        if (!actionSel || !sendBtn) return null;
        return { actionSel, sendBtn, selText, selEmail };
      }

      // debounce like your script (prevents double-send on rerender)
      const lastSend = new Map();
      function allowSend(key, ms = 2500) {
        const now = Date.now();
        const prev = lastSend.get(key) || 0;
        if (now - prev < ms) return false;
        lastSend.set(key, now);
        return true;
      }

      async function sendLetter(actionType, templateContains) {
        const ctrls = findLetterControls();
        if (!ctrls) throw new Error('Letter controls not found');

        const key = `${actionType}:${String(templateContains).toLowerCase()}`;
        if (!allowSend(key)) return;

        if (pageShowsContactDisabled()) {
          throw new Error('Contact method disabled');
        }

        // set action (textmessage / send)
        ctrls.actionSel.value = actionType;
        ctrls.actionSel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);

        const templateSel = actionType === 'textmessage' ? ctrls.selText : ctrls.selEmail;
        if (!templateSel) throw new Error('Template dropdown missing for ' + actionType);

        const opt = Array.from(templateSel.options || []).find((o) =>
          (o.textContent || '').toLowerCase().includes(String(templateContains).toLowerCase())
        );
        if (!opt) throw new Error('Template not found: ' + templateContains);

        if (isOptionDisabledLike(opt)) {
          throw new Error('Contact method disabled');
        }

        templateSel.value = opt.value;
        templateSel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);

        // real send + -close any Infinity confirm/ok
        ctrls.sendBtn.click();
        await sleep(200);
        await CloseDuringSend(6500);

        if (pageShowsContactDisabled()) {
          closeLMSModals();
          throw new Error('Contact method disabled');
        }
      }

      // ===== Main action: Email + Text =====
      let running = false;

      async function handleReversedNotify() {
        if (running) return;
        if (!loanIsReversed()) return;

        running = true;
        try {
          // 1) EMAIL
          try {
            await sendLetter('send', 'Loan Reversed');
            toast('Email sent');
          } catch (e) {
            const msg = (e && e.message ? e.message : '').toLowerCase();
            console.log('[Reversed Notify][EMAIL] error:', e);

            if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed')) {
              toast('Email disabled', true);
            } else {
              toast('Email send failed', true);
            }
          }

          await sleep(400);

          // 2) TEXT
          try {
            await sendLetter('textmessage', 'Reversed Incorrect Bank Info');
            toast('Text sent');
          } catch (e) {
            const msg = (e && e.message ? e.message : '').toLowerCase();
            console.log('[Reversed Notify][TEXT] error:', e);

            if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed') || msg.includes('failed')) {
              toast('Text disabled', true);
            } else {
              toast('Text send failed', true);
            }
          }

        } catch (e) {
          console.log('[Reversed Notify] error:', e);
          alert('Reversed Notify error: ' + (e?.message || e));
        } finally {
          running = false;
        }
      }

      // ===== UI: place near Max Exposure =====
      function injectButton() {
        if (!loanIsReversed()) return;

        const maxBtn = Array.from(document.querySelectorAll('a'))
          .find(a => (a.textContent || '').trim() === 'Max Exposure');

        if (!maxBtn) return;
        if (document.getElementById('ccReversedLoanBtn')) return;

        const btn = document.createElement('a');
        btn.id = 'ccReversedLoanBtn';
        btn.textContent = 'Reversed Loan';
        btn.className = 'AButton';
        btn.style.marginLeft = '8px';

        // DISTINCT STYLE (not like other buttons)
        btn.style.background = '#ff0033';
        btn.style.border = '1px solid #8a001a';
        btn.style.color = '#fff';
        btn.style.fontWeight = '600';
        btn.style.borderRadius = '8px';
        btn.style.boxShadow = '0 6px 16px rgba(0,0,0,.25)';
        btn.style.padding = '6px 10px';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleReversedNotify();
        }, true);

        // Put it AFTER Max Exposure
        maxBtn.parentNode.insertBefore(btn, maxBtn.nextSibling);
      }


    
      // self-heal like your other scripts
      function boot() {
        injectButton();
      
        let _rlDebounce = null;
        const mo = new MutationObserver(() => {
          clearTimeout(_rlDebounce);
          _rlDebounce = setTimeout(injectButton, 120);
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }




    
      boot();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: docsStatusChecker
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('docsStatusChecker')) runScript('docsStatusChecker', function () {
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

        let _docsDebounce = null;
        const observer = new MutationObserver(() => {
            clearTimeout(_docsDebounce);
            _docsDebounce = setTimeout(ensureUI, 120);
        });

        observer.observe(document.body, { childList: true, subtree: true });

        ensureUI();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: lastAgentNote
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('lastAgentNote')) runScript('lastAgentNote', function () {
    const EXCLUDED = [
            "tom harris",
            "veronica lodge",
            "paul caffrey",
            "john lim",
            "ben jameson",
            "desa solingan",
            "benjamin alla",
            "system",
            "lead",
            "marketing_walter m_miller",
            " extension",
            "monica smith",
            "liam moss collections",
            "liam moss portfolio",
            "enrique martinez",
            "customer site service"
        ];

        let isLoading = false; // 🔒 фикс дублей

        function getLoanId() {
            const match = document.body.innerText.match(/LOAN#\s*(\d+)/i);
            return match ? match[1] : null;
        }

        async function fetchLastCreatedBySimple() {
            const loanid = getLoanId();
            if (!loanid) return null;

            const res = await fetch(
                `/plm.net/customers/CustomerNotes.aspx?loanid=${loanid}&isnosection=true`,
                { credentials: "include" }
            );

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");

            const rows = doc.querySelectorAll(".DataTable > tbody > tr");

            for (let i = rows.length - 1; i >= 0; i--) {

                const cells = rows[i].querySelectorAll("td");
                if (cells.length < 4) continue;

                let name = cells[3].textContent
                    .replace(/[<>]/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

                const lower = name.toLowerCase();
                if (EXCLUDED.includes(lower)) continue;

                let noteText = cells[2].innerText
                    .replace(/\s+/g, " ")
                    .trim();

                if (
                    noteText.startsWith("Text message sent") ||
                    noteText.startsWith("E-mail message sent") ||
                    noteText.startsWith("Custom Status Added") ||
                    noteText.startsWith("Loan Remark(s) Added") ||
                    noteText.startsWith(" Due Date changed ") ||
                    noteText.startsWith(" Rate changed ") ||
                    noteText.startsWith("Reviewing admin changed from ") ||
                    noteText.startsWith("Loan") ||
                    noteText.startsWith("Custom Status Removed")
                ) {
                    continue;
                }

                return {
                    name: name,
                    note: noteText
                };
            }

            return null;
        }

        function findCategoriesHost() {
            const labels = Array.from(document.querySelectorAll("label"));
            const support = labels.find(l => l.textContent.trim() === "Support");
            if (!support) return null;
            return support.closest("td, div, span") || support.parentElement;
        }

        function ensureUI() {
            const host = findCategoriesHost();
            if (!host) return;

            if (document.getElementById("cc-notes-name-btn")) return;

            const btn = document.createElement("a");
            btn.id = "cc-notes-name-btn";
            btn.className = "AButton";
            btn.textContent = "Last Agent Note";
            btn.style.marginLeft = "10px";

            btn.addEventListener("click", async (e) => {
                e.preventDefault();

                if (isLoading) return; // 🚫 фикс дублей
                isLoading = true;

                const old = document.getElementById("cc-notes-name-pill");
                const oldTip = document.getElementById("cc-notes-tooltip");
                if (old) old.remove();
                if (oldTip) oldTip.remove();

                try {
                    const result = await fetchLastCreatedBySimple();

                    if (!result) {
                        const pill = document.createElement("span");
                        pill.id = "cc-notes-name-pill";
                        pill.textContent = "⚠ No notes found";

                        pill.style.background = "transparent";
                        pill.style.border = "none";
                        pill.style.padding = "0";
                        pill.style.color = "#d32f2f";
                        pill.style.fontWeight = "600";
                        pill.style.fontSize = "13px";
                        pill.style.marginLeft = "18px";
                        pill.style.verticalAlign = "middle";

                        btn.after(pill);

                        setTimeout(() => {
                            pill.style.transition = "opacity 0.2s ease";
                            pill.style.opacity = "0";
                            setTimeout(() => pill.remove(), 300);
                        }, 3500);

                        return;
                    }

                    let shortNote = result.note;
                    if (shortNote.length > 100) {
                        shortNote = shortNote.substring(0, 100) + "...";
                    }

                    const pill = document.createElement("span");
                    pill.id = "cc-notes-name-pill";
                    pill.textContent = result.name + " — " + shortNote;

                    pill.style.display = "inline-block";
                    pill.style.marginLeft = "8px";
                    pill.style.padding = "2px 12px";
                    pill.style.borderRadius = "12px";
                    pill.style.background = "#dff7df";
                    pill.style.border = "1px solid #7bd67b";
                    pill.style.fontWeight = "bold";
                    pill.style.whiteSpace = "nowrap";
                    pill.style.cursor = "pointer";

                    btn.after(pill);

                    const tooltip = document.createElement("div");
                    tooltip.id = "cc-notes-tooltip";
                    tooltip.textContent = result.name + " — " + result.note;

                    tooltip.style.position = "absolute";
                    tooltip.style.display = "none";
                    tooltip.style.maxWidth = "450px";
                    tooltip.style.background = "#1f1f1f";
                    tooltip.style.color = "#fff";
                    tooltip.style.padding = "8px 10px";
                    tooltip.style.borderRadius = "6px";
                    tooltip.style.fontSize = "12px";
                    tooltip.style.lineHeight = "1.4";
                    tooltip.style.whiteSpace = "normal";
                    tooltip.style.wordBreak = "break-word";
                    tooltip.style.zIndex = "9999";
                    tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

                    document.body.appendChild(tooltip);

                    pill.addEventListener("mouseenter", () => {
                        const rect = pill.getBoundingClientRect();
                        tooltip.style.left = rect.left + "px";
                        tooltip.style.top = (rect.bottom + 6 + window.scrollY) + "px";
                        tooltip.style.display = "block";
                    });

                    pill.addEventListener("mouseleave", () => {
                        tooltip.style.display = "none";
                    });

                } catch (err) {
                    console.error(err);
                } finally {
                    isLoading = false; // 🔓 разблокировка
                }
            });

            host.appendChild(btn);
        }

        let _lanDebounce = null;
        const observer = new MutationObserver(() => {
            clearTimeout(_lanDebounce);
            _lanDebounce = setTimeout(ensureUI, 120);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        ensureUI();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: paQuickSearch
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('paQuickSearch')) runScript('paQuickSearch', function () {
    (function () {
    /* ===============================================================
         CONFIG
      =============================================================== */

      const ADMIN_BLACKLIST = new Set([
        "ihor baa","igor ba","brian gonen","sean gonen","shahaf lavi","jerry mcfly","adam mcgee",
        "liam moss portfolio","roman r","kyle samuel","mike stadnyk","alex vysotzky",
        "jessica woods","nicole lennon","zhanna yakymenko","enrique martinez",
        "helen o'riley","tim smith","trysha smith","stephanie bellar","yuliia b",
        "teddy buckland","daisy clark","abby buentipo","leon collins","millie cross",
        "kevin ericson","luna garcia","mark davidson","molly green","craig greenberg","randy felix",
        "george c","mia crosswire","nadezhda k","chris turk","jacob james","max williams","melanie williams",
        "-- corporate --","-- creditcube --","-- creditcube / creditcube --","-- creditcube / test store --",
        "marketing m","test admin","aa bot","voicebot voiso","teststore user",
        "true accord","ccg collections","rsc collections",
        "iryna stadnyk_realstore","oleksii suprun_realstore","donald white_realstore",
        "iryna stadnyk","oleksii suprun","donald white",
        "viktoriia artomtseva","miguel gordon","yauhenia h","yurii holskyi","vitalii k",
        "oleksandr pilyugin","alex voloshyn","raman vysotski", "oleksandr bilokrynytskyi", "anthony smith", "yulia kalashnykov", "serhii bruh" 
      ]);

      const HOST_ID   = 'cc-pa-host';
      const CSS_ID    = 'cc-pa-css';
      const DLIST_ID  = 'cc-pa-datalist';
      const IFRAME_ID = 'cc-pa-iframe';
      const CACHE_KEY = 'cc_pa_admin_cache_v2.4';
      const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов — после этого кэш считается устаревшим

      /* ===============================================================
         STATE
      =============================================================== */

      let adminNames = [];
      let loadState  = 'idle';
      let setSaving  = false;
      let observer   = null;

      /* ===============================================================
         HELPERS
      =============================================================== */

      const $  = (s, r = document) => r.querySelector(s);
      const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
      const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

      function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' &&
               parseFloat(s.opacity || '1') !== 0 &&
               el.offsetWidth > 0 && el.offsetHeight > 0;
      }

      function isModalOpen() {
        return $$('.ui-dialog,[role="dialog"]').some(isVisible);
      }

      function getAnchor() {
        return $('a[href*="editprocessingadmin("]') ||
               $('a[onclick*="editprocessingadmin("]') ||
               $('a[href*="EditProcessingAdmin.aspx?loanid="]') ||
               $('a[onclick*="EditProcessingAdmin.aspx?loanid="]');
      }

      function getLoanId(anchor) {
        const txt = anchor?.getAttribute('href') || anchor?.getAttribute('onclick') || '';
        const m = txt.match(/editprocessingadmin\((\d+)\)/i) || txt.match(/loanid=(\d+)/i);
        return m ? m[1] : null;
      }

      // The <td> that CONTAINS the anchor (label cell) — widget goes here, after the link
      function getLabelCell(anchor) {
        return anchor?.closest('td') || null;
      }

      /* ===============================================================
         CSS
      =============================================================== */

      function injectCSS() {
        if ($('#' + CSS_ID)) return;
        const el = document.createElement('style');
        el.id = CSS_ID;
        el.textContent = `
          #${HOST_ID} {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 3px;
            background: #fff;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,.10);
            font-size: 11px;
            vertical-align: middle;
            line-height: 16px;
            margin-left: 5px;
          }
          #${HOST_ID} input[type=text] {
            width: 135px;
            height: 15px;
            font-size: 11px;
            padding: 0 3px;
            border: 1px solid #c8c8c8;
            border-radius: 3px;
            outline: none;
            line-height: 15px;
            box-sizing: border-box;
            vertical-align: middle;
          }
          #${HOST_ID} input[type=text]:focus {
            border-color: #5bc0de;
          }
          #${HOST_ID} .pa-btn {
            height: 17px;
            font-size: 11px;
            padding: 0 6px;
            border-radius: 3px;
            cursor: pointer;
            white-space: nowrap;
            line-height: 15px;
            box-sizing: border-box;
            vertical-align: middle;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          #${HOST_ID} .pa-set {
            border: 1px solid #46b8da;
            background: #5bc0de;
            color: #fff;
          }
          #${HOST_ID} .pa-set:hover    { background: #39b3d7; }
          #${HOST_ID} .pa-set:disabled { opacity: .5; cursor: default; }
          #${HOST_ID} .pa-clear {
            border: 1px solid #555;
            background: #222;
            color: #fff;
            font-weight: 700;
            padding: 0 5px;
          }
          #${HOST_ID} .pa-clear:hover { background: #444; }
        `;
        document.head.appendChild(el);
      }

      /* ===============================================================
         DATALIST
      =============================================================== */

      function ensureDatalist() {
        let d = $('#' + DLIST_ID);
        if (!d) {
          d = document.createElement('datalist');
          d.id = DLIST_ID;
          document.body.appendChild(d);
        }
        return d;
      }

      function fillDatalist(names) {
        ensureDatalist().innerHTML = names
          .map(n => `<option value="${esc(n)}">`)
          .join('');
      }

      function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
                        .replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }

      function normalizeNames(raw) {
        let arr = raw.map(n => (n||'').trim()).filter(Boolean)
                     .filter(n => !ADMIN_BLACKLIST.has(norm(n)));
        const seen = new Set();
        arr = arr.filter(n => { const k = norm(n); if (seen.has(k)) return false; seen.add(k); return true; });
        arr.sort((a,b) => a.localeCompare(b,'en',{sensitivity:'base'}));
        return arr;
      }

      /* ===============================================================
         HIDDEN IFRAME — used for BOTH loading options AND saving
      =============================================================== */

      function getOrCreateIframe() {
        let f = $('#' + IFRAME_ID);
        if (!f) {
          f = document.createElement('iframe');
          f.id = IFRAME_ID;
          f.style.cssText = 'display:none !important; width:0; height:0; border:0; position:fixed; top:-9999px; left:-9999px;';
          document.body.appendChild(f);
        }
        return f;
      }

      /**
       * Load the EditProcessingAdmin page in a hidden iframe and return
       * a Promise<{doc, sel, btn}> resolving when the form is ready.
       */
      function loadIframePage(loanId) {
        return new Promise((resolve, reject) => {
          const iframe = getOrCreateIframe();
          const url = `EditProcessingAdmin.aspx?loanid=${loanId}`;
          let settled = false;

          const timeout = setTimeout(() => {
            if (!settled) { settled = true; reject(new Error('iframe load timeout')); }
          }, 15000);

          function onLoad() {
            if (settled) return;
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
              // Check if we got redirected to ClosePopup (means already submitted)
              if (doc.location.href.includes('ClosePopup')) {
                settled = true; clearTimeout(timeout);
                resolve({ closed: true });
                return;
              }
              const sel = doc.querySelector('select');
              const btn = doc.querySelector('input[type=submit][value="Update"], input[value="Update"]');
              if (sel && btn) {
                settled = true; clearTimeout(timeout);
                resolve({ doc, sel, btn, iframe, win: iframe.contentWindow });
              } else {
                // Page loaded but form not found — might be an error page
                settled = true; clearTimeout(timeout);
                reject(new Error('Form not found in iframe'));
              }
            } catch (e) {
              settled = true; clearTimeout(timeout);
              reject(e);
            }
          }

          iframe.onload = onLoad;
          iframe.src = url;
        });
      }

      /* ===============================================================
         LOAD ADMIN LIST
      =============================================================== */

      async function ensureAdminList(loanId) {
        if (loadState === 'done') return;
        if (loadState === 'loading') return;
        loadState = 'loading';

        // Try cache first — but only if it's still fresh (TTL)
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            // Поддержка старого формата кэша (просто массив, без ts) —
            // такой кэш считаем устаревшим и обновляем сразу.
            const isFreshObj = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                                && Array.isArray(parsed.names) && typeof parsed.ts === 'number';
            if (isFreshObj && (Date.now() - parsed.ts) < CACHE_TTL_MS) {
              adminNames = parsed.names;
              fillDatalist(adminNames);
              loadState = 'done';
              return;
            }
            // Кэш просрочен или в старом формате — используем его как временный
            // фолбэк (чтобы даталист не был пустым, пока грузится свежий список),
            // но всё равно идём за актуальными данными ниже.
            if (isFreshObj) {
              adminNames = parsed.names;
              fillDatalist(adminNames);
            } else if (Array.isArray(parsed)) {
              adminNames = parsed;
              fillDatalist(adminNames);
            }
          }
        } catch { localStorage.removeItem(CACHE_KEY); }

        // Load from page in hidden iframe (первый запуск ИЛИ кэш устарел)
        try {
          const { sel } = await loadIframePage(loanId);
          const names = normalizeNames([...sel.options].map(o => o.textContent.trim()));
          adminNames = names;
          fillDatalist(adminNames);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ names: adminNames, ts: Date.now() }));
          loadState = 'done';
        } catch (e) {
          console.warn('[CC-PA] Failed to load admin list:', e);
          // Если свежий список не подгрузился, но был фолбэк из старого кэша —
          // не блокируем работу поиска, просто разрешаем повторную попытку позже.
          loadState = adminNames.length ? 'done' : 'idle';
        }
      }

      /* ===============================================================
         SET ADMIN — fully hidden, no visible popup
      =============================================================== */

      async function setAdmin(loanId, name, btnSet) {
        if (setSaving) return;
        setSaving = true;
        btnSet.disabled = true;
        btnSet.textContent = '…';

        try {
          // Step 1: load the form
          const result = await loadIframePage(loanId);
          if (result.closed) throw new Error('Unexpected ClosePopup on load');

          const { doc, sel, btn, win } = result;

          // Step 2: find the option
          const wanted = norm(name);
          const opt = [...sel.options].find(o => norm(o.textContent) === wanted);
          if (!opt) throw new Error(`Admin "${name}" not found in list`);

          // Step 3: select it
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));

          // Step 4: submit and wait for the response page (ClosePopup or same page)
          await new Promise((resolve, reject) => {
            const iframe = getOrCreateIframe();
            let settled = false;

            const timeout = setTimeout(() => {
              if (!settled) { settled = true; reject(new Error('Submit timeout')); }
            }, 15000);

            iframe.onload = () => {
              if (settled) return;
              try {
                const d = iframe.contentDocument || iframe.contentWindow.document;
                // Any navigation after submit = success
                settled = true;
                clearTimeout(timeout);
                resolve();
              } catch { settled = true; clearTimeout(timeout); resolve(); }
            };

            // Use __doPostBack if available, otherwise click
            const onclick = btn.getAttribute('onclick') || '';
            const m = onclick.match(/__doPostBack\('([^']+)','([^']*)'\)/);
            if (m && typeof win.__doPostBack === 'function') {
              win.__doPostBack(m[1], m[2]);
            } else {
              btn.click();
            }
          });

          // Step 5: disconnect observer (prevents double-reload race), then reload once
          btnSet.textContent = '✓';
          observer.disconnect();
          await sleep(400);
          location.reload();

        } catch (e) {
          console.error('[CC-PA] setAdmin error:', e);
          btnSet.textContent = '✗';
          btnSet.title = e.message || 'Error';
          setTimeout(() => { btnSet.textContent = 'Set'; btnSet.title = ''; }, 3000);
          btnSet.disabled = false;
          setSaving = false;
        }
      }

      const sleep = _sleep;

      /* ===============================================================
         UI INJECTION
         Widget is injected BEFORE the text content of the value <td>
      =============================================================== */

      function tryInject() {
        if (isModalOpen()) return;

        const anchor = getAnchor();
        if (!anchor) return;

        const loanId = getLoanId(anchor);
        if (!loanId) return;

        const labelCell = getLabelCell(anchor);
        if (!labelCell) return;

        // If host already lives inside this exact cell → nothing to do
        const existing = $('#' + HOST_ID);
        if (existing && labelCell.contains(existing)) return;

        // Remove stale/orphaned host
        if (existing) existing.remove();

        /* ---------- build widget ---------- */
        const host = document.createElement('span');
        host.id = HOST_ID;

        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', DLIST_ID);
        input.placeholder = 'Admin...';
        input.complete = 'off';

        const btnSet = document.createElement('button');
        btnSet.className = 'pa-btn pa-set';
        btnSet.textContent = 'Set';

        const btnClear = document.createElement('button');
        btnClear.className = 'pa-btn pa-clear';
        btnClear.title = 'Clear';
        btnClear.textContent = '×';

        host.appendChild(input);
        host.appendChild(btnSet);
        host.appendChild(btnClear);

        /* ---------- append widget after the anchor link, no style changes to td ---------- */
        labelCell.appendChild(host);

        /* ---------- events ---------- */
        btnSet.addEventListener('click', () => {
          const val = input.value.trim();
          if (!val) return;
          const a = getAnchor();
          const id = getLoanId(a);
          if (!id) return;
          setAdmin(id, val, btnSet);
        });

        btnClear.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          input.value = '';
          input.focus();
        });

        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); btnSet.click(); }
        });

        input.addEventListener('focus', () => {
          ensureAdminList(loanId);
        });

        /* ---------- kick off background preload ---------- */
        ensureAdminList(loanId);
      }

      /* ===============================================================
         INIT
      =============================================================== */

      injectCSS();
      ensureDatalist();
      getOrCreateIframe();   // pre-create so it's in the DOM

      // MutationObserver with debounce — re-injects after every AJAX refresh
      let debounceTimer = null;
      observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(tryInject, 100);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Fallback timers
      setTimeout(tryInject, 600);
      setTimeout(tryInject, 1500);
      setTimeout(tryInject, 3500);

    })();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: bulkOpenTabs
  // ─────────────────────────────────────────────────────────────────────────────
if (shouldRun('bulkOpenTabs')) runScript('bulkOpenTabs', function () {
    const SCRIPT_ID = 'cc_bulk_open_pending_loans_v1_7';
      if (document.getElementById(SCRIPT_ID)) return;

      // ← Page guard: run only on allowed report presets
      const ALLOWED_PRESETS = ['pending','deniedoftoday' ,"approvedoftoday" ,'search' ];
      const _preset = (new URL(location.href).searchParams.get('reportpreset') || '').toLowerCase();
      if (!ALLOWED_PRESETS.includes(_preset)) return;

      // Speed: smaller = faster ...

      // Speed: smaller = faster (too small may trigger popup blocking)
      const OPEN_DELAY_MS = 70;

      // -----------------------------
      // Helpers
      // -----------------------------
      function $(sel, root = document) { return root.querySelector(sel); }
      function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

      function notify(msg) {
        if (typeof window.showAlert === 'function') window.showAlert(msg, null, false);
        else window.alert(msg);
      }

   function buildAbsoluteUrl(href) {
    try {
        const u = new URL(href, window.location.origin);
        if (!u.pathname.startsWith('/plm.net/')) {
            u.pathname = '/plm.net' + u.pathname;
        }
        return u.href;
    } catch { return href; }
}

      function getCustomerUrlsFromTable() {
        const table = $('table.DataTable.FixedHeader');
        if (!table) return [];

        const links = $all('tbody a[href*="CustomerDetails.aspx?customerid="]', table);

        const seen = new Set();
        const urls = [];
        for (const a of links) {
          const url = buildAbsoluteUrl(a.getAttribute('href') || '');
          if (!url) continue;
          if (seen.has(url)) continue;
          seen.add(url);
          urls.push(url);
        }
        return urls;
      }

      function setStatus(text, mode) {
        const el = $('#ccBulkOpenStatus');
        if (!el) return;

        el.textContent = text;

        el.classList.remove('ccok', 'ccwarn');
        if (mode === 'ok') el.classList.add('ccok');
        if (mode === 'warn') el.classList.add('ccwarn');

        window.clearTimeout(setStatus._t);
        setStatus._t = window.setTimeout(() => {
          el.classList.remove('ccok', 'ccwarn');
        }, 1600);
      }

      function showTooManyAlert(requested, available) {
        notify(`Only ${available} customer(s) are in the list.\nPlease enter a number up to ${available}.`);
        setStatus(`Only ${available} in the list.`, 'warn');
      }

      function showNoCustomersAlert() {
        notify('No customers found in the table.');
        setStatus('No customers found.', 'warn');
      }

      function parseN(inputEl) {
        const raw = String(inputEl.value || '').trim();
        if (!raw) return 0;
        const digitsOnly = raw.replace(/[^\d]/g, '');
        const n = Math.floor(Number(digitsOnly));
        return Number.isFinite(n) ? n : 0;
      }

      // ✅ Single-action open: 1 click -> 1 new tab (no double-open)
      function openInNewTabOnce(url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // -----------------------------
      // Bulk open logic
      // -----------------------------
      function openCustomersExact(count) {
        const urls = getCustomerUrlsFromTable();
        const total = urls.length;

        if (total === 0) { showNoCustomersAlert(); return; }
        if (count > total) { showTooManyAlert(count, total); return; }
        if (count <= 0) {
          notify('Enter a number greater than 0.');
          setStatus('Enter N > 0.', 'warn');
          return;
        }

        setStatus(`Opening ${count} tab(s)...`, '');

        let i = 0;
        const tick = () => {
          if (i >= count) {
            setStatus(`Done: opened ${count} tab(s).`, 'ok');
            return;
          }
          try {
            openInNewTabOnce(urls[i]); // top -> bottom, exactly once
          } catch (e) {
            // no popup alerts; just status
            setStatus('Some tabs may have been blocked by the browser.', 'warn');
          }
          i++;
          window.setTimeout(tick, OPEN_DELAY_MS);
        };

        tick();
      }

      // -----------------------------
      // UI
      // -----------------------------
      function injectStyles() {
        const style = document.createElement('style');
        style.id = `${SCRIPT_ID}_style`;
        style.textContent = `
          #${SCRIPT_ID}{
            margin: 10px 0 6px 0;
            padding: 10px 12px;
            border: 1px solid #d7d7d7;
            background: #ffffff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          #${SCRIPT_ID} .ccBulkLabel{
            font-weight: 700;
            color: #333;
            margin-right: 2px;
          }

          #${SCRIPT_ID} .ccBulkInput{
            width: 92px;
            height: 30px;
            padding: 0 10px;
            border: 1px solid #cfcfcf;
            border-radius: 8px;
            outline: none;
            font-size: 12px;
            color: #111;
            background: #fff;
          }
          #${SCRIPT_ID} .ccBulkInput::placeholder{ color: #b5b5b5; }
          #${SCRIPT_ID} .ccBulkInput:focus{
            border-color: #7aa7ff;
            box-shadow: 0 0 0 2px rgba(122,167,255,0.25);
          }

          /* Presets (neutral) */
          #${SCRIPT_ID} .ccBulkBtn{
            height: 30px !important;
            padding: 0 12px !important;
            border-radius: 8px !important;
            border: 1px solid #cfcfcf !important;
            background: #f5f7fa !important;
            color: #1f2a37 !important;
            cursor: pointer !important;
            font-size: 12px !important;
            opacity: 1 !important;
            filter: none !important;
            text-shadow: none !important;
          }
          #${SCRIPT_ID} .ccBulkBtn:hover{ background: #eef2f7 !important; }

          /* LMS-like buttons (AButton) */
          #${SCRIPT_ID} a.ccAButton{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 30px;
            padding: 0 12px;
            border-radius: 8px;
            text-decoration: none !important;
            cursor: pointer;
            user-select: none;
          }

          #${SCRIPT_ID} .ccDivider{
            width: 1px;
            height: 22px;
            background: #d9d9d9;
            margin: 0 4px 0 2px;
          }

          /* Right pill status */
          #ccBulkOpenStatus{
            margin-left: ;
            font-size: 12px;
            color: #555;
            padding: 5px 10px;
            border-radius: 999px;
            border: 1px solid #e6e6e6;
            background: #fafafa;
            max-width: 680px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          #ccBulkOpenStatus.ccok{
            color: #1f6f2a;
            border-color: rgba(31,111,42,.25);
            background: rgba(34,177,76,.12);
          }
          #ccBulkOpenStatus.ccwarn{
            color: #8a5a00;
            border-color: rgba(255,127,39,.25);
            background: rgba(255,127,39,.12);
          }
        `;
        document.head.appendChild(style);
      }

      function makePresetBtn(label, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ccBulkBtn';
        b.textContent = label;
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        });
        return b;
      }

      function makeLmsBtn(label, onClick) {
        const a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.className = 'AButton ccAButton';
        a.textContent = label;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(e);
        });
        return a;
      }

      // 100% clear "0" even if something sets it after focus
      function installZeroKiller(input) {
        function clearIfZero() {
          if (!input) return;
          if (String(input.value || '').trim() === '0') input.value = '';
        }

        function burstClear() {
          clearIfZero();
          const start = Date.now();
          (function loop() {
            clearIfZero();
            if (Date.now() - start < 250) requestAnimationFrame(loop);
          })();
          setTimeout(clearIfZero, 0);
          setTimeout(clearIfZero, 30);
          setTimeout(clearIfZero, 80);
          setTimeout(clearIfZero, 150);
        }

        input.addEventListener('focus', burstClear, true);
        input.addEventListener('click', burstClear, true);
        input.addEventListener('pointerdown', burstClear, true);
        input.addEventListener('mousedown', burstClear, true);
        input.addEventListener('input', clearIfZero, true);

        const mo = new MutationObserver(() => clearIfZero());
        try { mo.observe(input, { attributes: true, attributeFilter: ['value'] }); } catch {}
      }

      function mountUI() {
        const anchor = $('.Message'); // "Loans Count: X"
        const parent = anchor?.parentElement;
        if (!anchor || !parent) return false;

        injectStyles();

        const bar = document.createElement('div');
        bar.id = SCRIPT_ID;

        const label = document.createElement('span');
        label.className = 'ccBulkLabel';
        label.textContent = 'Open tabs:';
        bar.appendChild(label);

        const input = document.createElement('input');
        input.className = 'ccBulkInput';
        input.type = 'text';
        input.inputMode = 'numeric';
        input.complete = 'off';
        input.placeholder = '0';
        input.value = '';
        input.id = 'ccBulkOpenN';
        bar.appendChild(input);

        installZeroKiller(input);

        const btnOpen = makeLmsBtn('Open', () => openCustomersExact(parseN(input)));
        const btnClear = makeLmsBtn('Clear', () => { input.value = ''; input.focus(); setStatus('Cleared.', ''); });
        bar.appendChild(btnOpen);
        bar.appendChild(btnClear);

        const divider = document.createElement('div');
        divider.className = 'ccDivider';
        bar.appendChild(divider);

        // ✅ Fixed counts (ignore input value)
        bar.appendChild(makePresetBtn('Open 5',  () => openCustomersExact(5)));
        bar.appendChild(makePresetBtn('Open 10', () => openCustomersExact(10)));
        bar.appendChild(makePresetBtn('Open 15', () => openCustomersExact(15)));
        bar.appendChild(makePresetBtn('Open 20', () => openCustomersExact(20)));

        const btnAll = makeLmsBtn('Open All', () => openCustomersExact(getCustomerUrlsFromTable().length));
        bar.appendChild(btnAll);

        const status = document.createElement('div');
        status.id = 'ccBulkOpenStatus';
        status.textContent = 'Ready.';
        bar.appendChild(status);

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btnOpen.click();
        });

        parent.insertBefore(bar, anchor);
        return true;
      }

      (function init(retries = 20) {
        const ok = mountUI();
        if (ok) return;
        if (retries <= 0) return;
        setTimeout(() => init(retries - 1), 250);
      })();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: aaBulkCleanup
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('aaBulkCleanup')) runScript('aaBulkCleanup', function () {
    // -------------------------
    // Settings
    // -------------------------
    const REQUIRED_PRESET = 'pending';
    const STATUS_LABEL_TEXT = 'AA In Progress';
    const AA_FILTER_HEADER = 'AA In Progress:';

    const BTN_TEXT = 'Remove all AA In Progress statuses';
    const BTN2_TEXT = 'Remove AA In Progress and reassign from AA bot';

    const PER_LOAN_DELAY_MS = 250;
    const IFRAME_LOAD_TIMEOUT_MS = 30000;

    // Blocking confirm() dialog before a run.
    // true — вернуть старое окно подтверждения
    const CONFIRM_BEFORE_RUN = false;

    // Safety window after a click, before anything is written.
    // Counts down in the status line; "Stop" cancels.
    // 0 — запуск мгновенно, без отсчёта
    const ARM_DELAY_MS = 0;

    // How many loans go into a single "assign processing admin" postback
    const ASSIGN_CHUNK_SIZE = 100;

    // If your report is filtered to AA In Progress = Yes, keep true (faster).
    const ONLY_ROWS_THAT_CONTAIN_AA_TEXT = true;

    // -------------------------
    // Helpers
    // -------------------------
    const sleep = _sleep;
    const qs = (sel, root = document) => root.querySelector(sel);
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

    function isPendingPresetPage() {
      try {
        const u = new URL(location.href);
        return (u.searchParams.get('reportpreset') || '').toLowerCase() === REQUIRED_PRESET;
      } catch {
        return false;
      }
    }

    // -------------------------
    // Filter guards (AA In Progress = Yes, Processing Admin = All Admins)
    // -------------------------
    function getFilterRowByHeader(headerText) {
      const tds = Array.from(document.querySelectorAll('td.FilterHeader'));
      const want = headerText.toLowerCase();
      const td = tds.find((t) => norm(t.textContent).toLowerCase() === want);
      return td ? td.parentElement : null;
    }

    function isAAInProgressYes() {
      const tr = getFilterRowByHeader(AA_FILTER_HEADER);
      if (!tr) return false;
      const yes = tr.querySelector('input[type="radio"][value="yes"]');
      return !!(yes && yes.checked);
    }

    function isProcessingAdminAll() {
      const container = qs('#maincontent_ProcessingAdmins_Container');
      if (!container) return false;

      const modeCb = qs('#maincontent_ProcessingAdmins_checkboxMode');
      if (modeCb && modeCb.checked) {
        // Multiple Admins mode -> "-- All Admins --" aggregate must be checked
        const agg = container.querySelector('.MultiSampleAggregateCheckbox[value="all"]');
        return !!(agg && agg.checked);
      }

      const sel = qs('#maincontent_ProcessingAdmins_SingleValue');
      return !!(sel && sel.value === 'all');
    }

    // -------------------------
    // Report freshness: filters SELECTED vs. filters actually APPLIED
    //
    // Changing a filter does not touch the grid — the user must press
    // "Generate Report". Until then the page still shows the previous result
    // set, so acting on it would hit the wrong loans.
    // -------------------------
    let APPLIED_SIG = null;        // filter state the visible report was built with
    let GENERATE_PENDING = false;  // Generate Report pressed, waiting for the new grid

    function getFilterRegions() {
      const regions = new Set();
      for (const td of document.querySelectorAll('td.FilterHeader')) {
        if (td.parentElement) regions.add(td.parentElement);
      }
      const admins = qs('#maincontent_ProcessingAdmins_Container');
      if (admins) regions.add(admins);
      return Array.from(regions);
    }

    // Fingerprint of every filter control. Compared against the fingerprint
    // taken when the report was generated, so toggling a radio away and back
    // is correctly seen as "nothing changed" rather than as a pending change.
    function filterSignature() {
      const parts = [];
      const seen = new Set();

      for (const region of getFilterRegions()) {
        for (const el of region.querySelectorAll('input, select')) {
          if (seen.has(el)) continue;
          seen.add(el);

          const key = el.id || el.name || '';
          if (/LoanIds$|CustomerIds$/i.test(key)) continue; // row checkboxes, not filters
          if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden') continue;

          parts.push(
            el.type === 'checkbox' || el.type === 'radio'
              ? `${key}#${el.value}=${el.checked ? 1 : 0}`
              : `${key}=${el.value}`
          );
        }
      }
      return parts.join('|');
    }

    function isReportStale() {
      return APPLIED_SIG !== null && filterSignature() !== APPLIED_SIG;
    }

    function isGenerateButton(el) {
      if (!el) return false;
      const txt = norm(el.value || el.textContent || '');
      return /generate\s*report/i.test(txt);
    }

    // Independent proof that the AA filter is really applied to what we see:
    // with "AA In Progress = Yes" every listed loan must carry that status.
    // Bails out on the first row without it, so the stale case is cheap.
    function isGridAAFiltered() {
      const anchors = document.querySelectorAll('a[href*="CustomerDetails.aspx?customerid="]');
      if (!anchors.length) return false;

      const seen = new Set();
      for (const a of anchors) {
        const tr = a.closest('tr');
        if (!tr || seen.has(tr)) continue;
        seen.add(tr);
        if (!(tr.textContent || '').includes(STATUS_LABEL_TEXT)) return false;
      }
      return seen.size > 0;
    }

    function checkGuards() {
      const problems = [];
      if (!isAAInProgressYes()) problems.push('filter "AA In Progress" must be set to Yes');
      if (!isProcessingAdminAll()) problems.push('filter "Processing Admin" must be "-- All Admins --"');

      if (isReportStale()) {
        problems.push('filters changed — press "Generate Report" to apply them');
      } else if (!isGridAAFiltered()) {
        problems.push('the report on screen is not an AA In Progress list — press "Generate Report"');
      }
      return problems;
    }

    // -------------------------
    // Hidden worker frame
    // -------------------------
    function ensureWorkerFrame() {
      let frame = qs('#cc-aa-remove-worker');
      if (frame) return frame;

      frame = document.createElement('iframe');
      frame.id = 'cc-aa-remove-worker';
      frame.name = 'cc-aa-remove-worker';
      frame.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        left: -9999px;
        top: -9999px;
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(frame);
      return frame;
    }

    async function loadInFrame(frame, url) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Frame load timeout: ' + url)), IFRAME_LOAD_TIMEOUT_MS);
        frame.onload = () => {
          clearTimeout(t);
          resolve();
        };
        frame.src = url;
      });
    }

    // -------------------------
    // Panel
    // -------------------------
    function createPanel() {
      if (qs('#cc-aa-remove-panel')) return qs('#cc-aa-remove-panel');

      const panel = document.createElement('div');
      panel.id = 'cc-aa-remove-panel';
      panel.style.cssText = `
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        background: rgba(25, 25, 25, 0.92);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        padding: 10px 12px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        min-width: 430px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      `;

      panel.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:700;">AA In Progress remover</div>
          <button id="cc-aa-x" style="cursor:pointer; border:none; background:transparent; color:#fff; font-size:16px; line-height:16px;">&times;</button>
        </div>

        <div style="margin-top:8px; display:flex; gap:8px;">
          <button id="cc-aa-run" style="
            cursor:pointer; border:none; background:#ff7a00; color:#111; font-weight:700;
            border-radius:8px; padding:8px 10px; flex:1;
          ">${BTN_TEXT}</button>

          <button id="cc-aa-stop" style="
            cursor:pointer; border:1px solid rgba(255,255,255,.25); background:transparent; color:#fff;
            font-weight:700; border-radius:8px; padding:8px 10px; width:84px;
          " title="Stop current run">Stop</button>
        </div>

        <div style="margin-top:8px;">
          <button id="cc-aa-run2" style="
            cursor:pointer; border:none; background:#2f9e44; color:#fff; font-weight:700;
            border-radius:8px; padding:8px 10px; width:100%;
          ">${BTN2_TEXT}</button>
        </div>

        <div id="cc-aa-status" style="margin-top:8px; opacity:0.95;">Ready.</div>

        <div id="cc-aa-err" style="margin-top:6px; opacity:0.9; font-size:11px; color:#ffd7d7; display:none;"></div>
      `;

      document.body.appendChild(panel);

      const statusEl = qs('#cc-aa-status', panel);
      const errEl = qs('#cc-aa-err', panel);
      const btnEl = qs('#cc-aa-run', panel);
      const btn2El = qs('#cc-aa-run2', panel);
      const stopEl = qs('#cc-aa-stop', panel);

      const buttons = [btnEl, btn2El];
      const ui = { statusEl, errEl, buttons };

      qs('#cc-aa-x', panel).addEventListener('click', () => {
        STOP = true;
        panel.remove();
        DISMISSED = true;
      });

      stopEl.addEventListener('click', () => { STOP = true; });

      async function start(reassign, confirmText) {
        if (RUNNING) return;
        if (checkGuards().length) { ensurePanelVisibility(); return; }
        if (CONFIRM_BEFORE_RUN && !confirm(confirmText)) return;

        // Lock right away: blocks a double-click and keeps the panel
        // alive even if a filter flickers while we count down.
        RUNNING = true;
        STOP = false;
        errEl.style.display = 'none';
        errEl.textContent = '';
        setButtonsEnabled(false, buttons);

        try {
          if (ARM_DELAY_MS > 0) {
            const what = reassign
              ? 'remove AA In Progress + unassign from AA Bot'
              : 'remove AA In Progress';

            for (let left = Math.ceil(ARM_DELAY_MS / 1000); left > 0; left--) {
              if (STOP) break;
              statusEl.textContent = `Starting in ${left}s — ${what}. Press Stop to cancel.`;
              await sleep(1000);
            }

            if (STOP) {
              statusEl.textContent = 'Cancelled. Ready.';
              return;
            }
          }

          await run({ reassign }, ui);
        } catch (e) {
          console.error(e);
          errEl.style.display = 'block';
          errEl.textContent = `Fatal: ${e.message || e}`;
          statusEl.textContent = 'Stopped with error.';
        } finally {
          RUNNING = false;
          setButtonsEnabled(true, buttons);
        }
      }

      btnEl.title = ARM_DELAY_MS > 0
        ? `Starts after ${Math.ceil(ARM_DELAY_MS / 1000)}s — press Stop to cancel`
        : 'Starts immediately';
      btn2El.title = btnEl.title;

      btnEl.addEventListener('click', () => start(
        false,
        'Remove "AA In Progress" for ALL loans in this Pending list?\n\n' +
        'Processing Admin will NOT be changed.\n' +
        'Runs in background and will NOT reload your report page.'
      ));

      btn2El.addEventListener('click', () => start(
        true,
        'Remove "AA In Progress" for ALL loans in this Pending list\n' +
        'AND set Processing Admin to "-- no admin --" (unassign from AA Bot)?\n\n' +
        'Runs in background and will NOT reload your report page.'
      ));

      return panel;
    }

    function setButtonsEnabled(enabled, btns) {
      for (const b of btns) {
        if (!b) continue;
        b.disabled = !enabled;
        b.style.opacity = enabled ? '1' : '0.5';
        b.style.cursor = enabled ? 'pointer' : 'not-allowed';
      }
    }

    // -------------------------
    // Collect loans (from Name links)
    // -------------------------
    function extractLoanIdFromRow(tr) {
      const tds = Array.from(tr.querySelectorAll('td'));
      for (const td of tds) {
        const t = (td.textContent || '').trim();
        if (/^\d{7,9}$/.test(t)) return t;
      }
      const rowText = norm(tr.textContent);
      const m = rowText.match(/\b\d{7,9}\b/);
      return m ? m[0] : null;
    }

    function collectLoansFromCurrentView() {
      const anchors = Array.from(document.querySelectorAll('a[href*="CustomerDetails.aspx?customerid="]'));
      const map = new Map();

      for (const a of anchors) {
        const tr = a.closest('tr');
        if (!tr) continue;

        const loanId = extractLoanIdFromRow(tr);
        if (!loanId) continue;

        const name = (a.textContent || '').trim();
        const rowText = (tr.textContent || '');
        const hasAA = rowText.includes(STATUS_LABEL_TEXT);

        if (!map.has(loanId)) map.set(loanId, { loanId, name, hasAA });
      }
      return Array.from(map.values());
    }

    function getPagerNextButton() {
      const next = qs('#maincontent_PagerNextLinkButton');
      if (!next) return null;

      const href = (next.getAttribute('href') || '').trim();
      const cls = (next.getAttribute('class') || '').trim();
      const disabled = cls.includes('aspNetDisabled') || href === '' || href === '#' || href === 'javascript:void(0)';
      return disabled ? null : next;
    }

    // -------------------------
    // "Assign processing admin" snapshot (postback payload for the CURRENT DOM)
    // -------------------------
    const NO_ADMIN_VALUE = '0';

    function buildAssignSnapshot() {
      const form = qs('#Page_Form') || qs('form');
      if (!form) return null;

      const container = qs('#maincontent_Tr_AssignProcessingAdminControls');
      if (!container) return null;

      const select = container.querySelector('select');
      const btn = container.querySelector('input[type="submit"], input[type="button"], button');
      if (!select || !btn) return null;

      const selectName = select.getAttribute('name');
      const btnName = btn.getAttribute('name');
      const btnValue = btn.getAttribute('value') || btn.value || 'Update';
      if (!selectName || !btnName) return null;

      // Make sure "-- no admin --" really exists in the dropdown
      const hasNoAdmin = Array.from(select.options).some((o) => o.value === NO_ADMIN_VALUE);
      if (!hasNoAdmin) return null;

      // Snapshot of every field currently posted by the report form
      const base = new URLSearchParams();
      const fd = new FormData(form);
      for (const [k, v] of fd.entries()) {
        if (typeof v !== 'string') continue;
        // drop every bulk-action checkbox group; we add only ours
        if (/LoanIds$|CustomerIds$/i.test(k)) continue;
        base.append(k, v);
      }

      base.set('__EVENTTARGET', '');
      base.set('__EVENTARGUMENT', '');
      base.set(selectName, NO_ADMIN_VALUE);

      // Loan ids rendered on this page (event-validation-safe set)
      const available = new Set(
        Array.from(document.querySelectorAll('input[name="processingAdminLoanIds"]')).map((cb) => cb.value)
      );

      return {
        action: new URL(form.getAttribute('action') || location.href, location.href).toString(),
        base,
        btnName,
        btnValue,
        available
      };
    }

    async function postAssignNoAdmin(snapshot, loanIds) {
      if (!snapshot || !loanIds.length) return 0;

      let done = 0;
      for (let i = 0; i < loanIds.length; i += ASSIGN_CHUNK_SIZE) {
        const chunk = loanIds.slice(i, i + ASSIGN_CHUNK_SIZE);

        const body = new URLSearchParams(snapshot.base.toString());
        for (const id of chunk) body.append('processingAdminLoanIds', id);
        body.append(snapshot.btnName, snapshot.btnValue);

        const resp = await fetch(snapshot.action, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body
        });

        if (!resp.ok) throw new Error(`Assign POST failed (${resp.status})`);

        const html = await resp.text();
        if (/Validation of viewstate MAC failed|Invalid postback or callback argument/i.test(html)) {
          throw new Error('Assign POST rejected by server (viewstate/event validation). Regenerate the report and retry.');
        }

        done += chunk.length;
        await sleep(200);
      }
      return done;
    }

    // -------------------------
    // Collect across pages + snapshots
    // -------------------------
    async function collectAllPages(statusEl) {
      const all = new Map();
      const pages = [];
      let page = 0;

      while (page < 200) {
        page++;

        const items = collectLoansFromCurrentView();
        for (const it of items) if (!all.has(it.loanId)) all.set(it.loanId, it);

        const snapshot = buildAssignSnapshot();
        if (snapshot) pages.push(snapshot);

        statusEl.textContent = `Collecting loans… Found ${all.size} (scan page ${page}).`;

        const next = getPagerNextButton();
        if (!next) break;

        const firstBefore = items[0]?.loanId || '';
        next.click();

        let changed = false;
        for (let i = 0; i < 70; i++) {
          await sleep(200);
          const now = collectLoansFromCurrentView();
          const firstAfter = now[0]?.loanId || '';
          if (firstAfter && firstAfter !== firstBefore) { changed = true; break; }
        }
        if (!changed) break;
      }

      return { loans: Array.from(all.values()), pages };
    }

    // -------------------------
    // EditStatus.aspx POST
    // -------------------------
    function findCheckboxByLabelText(doc, labelText) {
      const labels = Array.from(doc.querySelectorAll('label'));
      const lbl = labels.find((l) => (l.textContent || '').trim() === labelText);

      if (lbl) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const input = doc.getElementById(forId);
          if (input && input.type === 'checkbox') return input;
        }
        const wrapped = lbl.querySelector('input[type="checkbox"]');
        if (wrapped) return wrapped;
      }

      const cbs = Array.from(doc.querySelectorAll('input[type="checkbox"]'));
      for (const cb of cbs) {
        const t = norm(cb.parentElement?.textContent);
        if (t === labelText || t.includes(labelText)) return cb;
      }

      return null;
    }

    function findUpdateButton(doc) {
      const btns = Array.from(doc.querySelectorAll('input[type="submit"], input[type="button"], button'));
      return btns.find((b) => ((b.value || b.textContent || '').trim().toLowerCase() === 'update')) || null;
    }

    function formDataToUrlEncoded(fd) {
      const usp = new URLSearchParams();
      for (const [k, v] of fd.entries()) usp.append(k, v);
      return usp;
    }

    async function postEditStatusForm(frameWin, doc, form, updateBtn, uncheckedCheckbox) {
      const fd = new FormData(form);

      const btnName = updateBtn?.getAttribute('name');
      const btnVal = updateBtn?.getAttribute('value') || updateBtn?.value || 'Update';
      if (btnName && !fd.has(btnName)) fd.append(btnName, btnVal);

      if (uncheckedCheckbox && uncheckedCheckbox.name) fd.delete(uncheckedCheckbox.name);

      const actionRaw = (form.getAttribute('action') || '').trim();
      const actionUrl = new URL(actionRaw || frameWin.location.href, frameWin.location.href).toString();

      const body = formDataToUrlEncoded(fd);

      const resp = await fetch(actionUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body
      });

      if (!resp.ok) throw new Error(`POST failed (${resp.status}) -> ${actionUrl}`);
      return true;
    }

    async function removeAAForLoan(frame, loanId) {
      const url = `/plm.net/customers/EditStatus.aspx?loanid=${loanId}`;
      await loadInFrame(frame, url);

      const d = frame.contentDocument;
      const w = frame.contentWindow;
      if (!d || !w) throw new Error('No iframe content');

      let form = null;
      let cb = null;
      for (let i = 0; i < 60; i++) {
        form = d.querySelector('form');
        cb = findCheckboxByLabelText(d, STATUS_LABEL_TEXT);
        if (form && cb) break;
        await sleep(150);
      }
      if (!form) throw new Error(`Form not found (loan ${loanId})`);
      if (!cb) throw new Error(`"${STATUS_LABEL_TEXT}" checkbox not found (loan ${loanId})`);

      if (!cb.checked) return 'already_off';

      cb.checked = false;

      const updateBtn = findUpdateButton(d);
      if (!updateBtn) throw new Error(`Update button not found (loan ${loanId})`);

      await postEditStatusForm(w, d, form, updateBtn, cb);
      return 'removed';
    }

    // -------------------------
    // Run
    // -------------------------
    let STOP = false;
    let RUNNING = false;
    let DISMISSED = false;

    async function run(opts, ui) {
      const { statusEl, errEl, buttons } = ui;
      const reassign = !!opts.reassign;

      STOP = false;
      RUNNING = true;
      errEl.style.display = 'none';
      errEl.textContent = '';
      setButtonsEnabled(false, buttons);

      try {
        statusEl.textContent = 'Collecting loans from report…';

        const { loans: allLoans, pages } = await collectAllPages(statusEl);

        if (!allLoans.length) {
          statusEl.textContent = 'No loans found. (Try: Show all pages + Generate Report)';
          return;
        }

        if (reassign && !pages.length) {
          throw new Error('"Assign processing admin" control not found on the page.');
        }

        const targets = ONLY_ROWS_THAT_CONTAIN_AA_TEXT ? allLoans.filter((x) => x.hasAA) : allLoans;
        if (!targets.length) {
          statusEl.textContent = `Loans found: ${allLoans.length}, but none matched AA text. Set ONLY_ROWS_THAT_CONTAIN_AA_TEXT=false to brute-force.`;
          return;
        }

        const frame = ensureWorkerFrame();

        let ok = 0, already = 0, fail = 0;
        const cleared = new Set();

        statusEl.textContent = `Starting… Targets: ${targets.length}.`;

        for (let i = 0; i < targets.length; i++) {
          if (STOP) break;

          const t = targets[i];
          statusEl.textContent =
            `(${i + 1}/${targets.length}) ${t.name ? t.name + ' — ' : ''}loan ${t.loanId}… | OK:${ok} Already:${already} Fail:${fail}`;

          try {
            const res = await removeAAForLoan(frame, t.loanId);
            if (res === 'already_off') already++;
            else ok++;
            cleared.add(t.loanId);
          } catch (e) {
            fail++;
            errEl.style.display = 'block';
            errEl.textContent = `Last error: ${e.message || e}`;
            console.warn('[AA Remove] Failed', t, e);
          }

          await sleep(PER_LOAN_DELAY_MS);
        }

        const statusPart = STOP
          ? `Stopped. OK:${ok}, Already:${already}, Failed:${fail}.`
          : `Statuses done. OK:${ok}, Already:${already}, Failed:${fail}.`;

        if (!reassign) {
          statusEl.textContent = `${statusPart} Refresh report to verify.`;
          return;
        }

        // ---- Step 2: Processing Admin -> "-- no admin --"
        let assigned = 0;
        let assignFail = 0;

        for (let p = 0; p < pages.length; p++) {
          if (STOP) break;

          const snap = pages[p];
          const ids = Array.from(cleared).filter((id) => snap.available.has(id));
          if (!ids.length) continue;

          statusEl.textContent = `${statusPart} Reassigning admin… (batch ${p + 1}/${pages.length}, ${ids.length} loans)`;

          try {
            assigned += await postAssignNoAdmin(snap, ids);
          } catch (e) {
            assignFail += ids.length;
            errEl.style.display = 'block';
            errEl.textContent = `Assign error: ${e.message || e}`;
            console.warn('[AA Remove] Assign failed', e);
          }
        }

        statusEl.textContent =
          `${statusPart} Admin set to "no admin": ${assigned}` +
          (assignFail ? `, failed: ${assignFail}` : '') +
          `. Refresh report to verify.`;
      } finally {
        RUNNING = false;
        setButtonsEnabled(true, buttons);
      }
    }

    // -------------------------
    // Boot
    // -------------------------
    if (!isPendingPresetPage()) return;

    // The panel exists ONLY while the required filters are selected
    // AND the report on screen was generated with them.
    let lastHiddenReason = '';

    function ensurePanelVisibility() {
      if (RUNNING || DISMISSED) return;

      const problems = checkGuards();
      const ok = problems.length === 0;
      const panel = qs('#cc-aa-remove-panel');

      if (ok && !panel) createPanel();
      else if (!ok && panel) panel.remove();

      // No UI noise when hidden — but leave a trace in the console,
      // so "why is there no panel?" is always answerable.
      const reason = problems.join(' | ');
      if (reason !== lastHiddenReason) {
        lastHiddenReason = reason;
        if (reason) console.info('[AA Remove] panel hidden:', reason);
      }
    }

    // On a fresh page load the controls match the report that was rendered.
    APPLIED_SIG = filterSignature();
    ensurePanelVisibility();

    document.addEventListener('change', ensurePanelVisibility, true);

    document.addEventListener('click', (e) => {
      // The report stays stale until the new grid actually arrives.
      if (isGenerateButton(e.target)) GENERATE_PENDING = true;
      setTimeout(ensurePanelVisibility, 0);
    }, true);

    // The grid is refreshed by an async postback, so watch the DOM for the
    // result of a Generate Report instead of waiting for a page reload.
    let mutationTimer = null;
    new MutationObserver((records) => {
      const ours = records.every((r) => {
        const n = r.target;
        return n && n.closest && n.closest('#cc-aa-remove-panel');
      });
      if (ours) return;

      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        if (GENERATE_PENDING) {
          GENERATE_PENDING = false;
          APPLIED_SIG = filterSignature(); // this filter state is now on screen
        }
        ensurePanelVisibility();
      }, 300);
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(ensurePanelVisibility, 1000);
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: compactDenialList
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('compactDenialList')) runScript('compactDenialList', function () {
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
            "Cust in Collections",
            "New Job",
            "Unemployed",
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
                html, body, body > form { height:  !important; min-height: 0 !important; }
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
                t.style.height = '20px';
            });

            extraTextareas.forEach(t => {
                t.rows = 1;
                t.style.height = '28px';
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

            let _cdlDebounce = null;
            const observer = new MutationObserver(() => {
                clearTimeout(_cdlDebounce);
                _cdlDebounce = setTimeout(removeOldToggles, 120);
            });
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
  });




  
  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: autoAssign
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('autoAssign')) runScript('autoAssign', function () {

///////////////////////////////////////////paste after this 
    



    ///////////////////////////////////////////////////////////
  if (window.__SA_ONCE__) return; window.__SA_ONCE__ = true;

  // Emergency kill switch. If a page is stuck, run this in the console:
  //   localStorage.setItem('sa:disabled','1'); localStorage.removeItem('sa:job');
  //   localStorage.removeItem('sa:step'); location.reload();
  if (localStorage.getItem('sa:disabled') === '1') {
    console.warn('[Auto-Assign] disabled via sa:disabled. Remove the key to re-enable.');
    return;
  }

  // Only on the Pending Loans report page. This is a hard gate: no matter what
  // a saved job says, the panel must never appear on customer pages or on any
  // other LMS screen. The bundle itself runs on all of /plm.net/, so this check
  // is what keeps the Auto Assign UI confined to the report.
  const ON_LOANS_REPORT = /\/plm\.net\/reports\/LoansReport\.aspx$/i.test(location.pathname);
  if (!ON_LOANS_REPORT) return;

  const usp = new URLSearchParams(location.search);
  // Infinity can occasionally drop the reportpreset query after a POST. An
  // existing job must still boot so its progress and recovery are not lost —
  // but only while we are still on the Pending Loans report itself.
  const hasSavedJobAtBoot=!!localStorage.getItem('sa:job');
  if (usp.get('reportpreset') !== 'pending' && !hasSavedJobAtBoot) return;

  // ---------- helpers ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const uniq=(a)=>[...new Set(a)];
  const norm = s => (s||'').replace(/\([^)]*\)\s*$/,'').replace(/\s+/g,' ').trim().toLowerCase();

  // ---------- storage keys ----------
  const LS = {
    POS:'sa:pos',
    COL:'sa:collapsed',
    DRAFT:'sa:draftNames',          // Excluded draft: names (as typed)
    SAVED_N:'sa:savedNormNames',    // Excluded saved: normalized names
    SAVED_IDS:'sa:savedIds',        // Excluded saved: ids
    CH_DRAFT:'sa:chooseDraft',      // Choose reps draft: names (as typed)
    CH_IDS:'sa:chooseIds',          // Choose reps saved: ids
    JOB:'sa:job',
    STEP:'sa:step',
    RES:'sa:res',
    LPR:'sa:lpr',                   // Leads per rep (int) — empty means auto
    RANDOM:'sa:random',             // false = bottom-up, true = random visible leads
    LOG:'sa:log',                   // rolling event log for post-mortems
    ROSTER:'sa:rosterCache'         // last good CSV roster, used when the fetch fails
  };
  const SS = { NAV:'sa:navigating', TOKEN:'sa:runToken', TAB:'sa:tabId' };
  const HEARTBEAT_MS=3000;
  const OWNER_STALE_MS=120000;
  const SAME_PAGE_VERIFY_MS=25000;
  const PAGE_ID='page-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const TAB_ID=(()=>{
    let id=sessionStorage.getItem(SS.TAB);
    if(!id){ id='tab-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); sessionStorage.setItem(SS.TAB,id); }
    return id;
  })();

  const save=(k,v)=>localStorage.setItem(k, JSON.stringify(v));
  const load=(k,d)=>{ try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(d)); } catch { return d; } };
  const ssDel=(k)=>sessionStorage.removeItem(k);
  const isOwner=(job)=>!!job && String(job.ownerTabId||'')===TAB_ID;

  // Rolling event log. Survives reloads, so an odd run can be inspected after
  // the fact instead of guessing.
  const LOG_MAX=400;
  function logEvent(kind,text){
    try{
      const log=load(LS.LOG,[]);
      log.push({t:new Date().toISOString(),kind,text:String(text||'')});
      while(log.length>LOG_MAX) log.shift();
      save(LS.LOG,log);
    }catch{}
  }
  const formatLog=()=>load(LS.LOG,[])
    .map(e=>`${e.t.slice(11,19)}  ${e.kind.padEnd(9)}  ${e.text}`)
    .join('\n')||'(empty)';

  // ---------- Infinity DOM hooks ----------
  const getAssignDD = ()=> $('#maincontent_AssignToProcessingAdminId') ||
    $$('select').find(s=>/Assign checked customers to processing admin/i.test(s.closest('tr,div,section')?.textContent||''));
  const getUpdateBtn = ()=> $$('input[type="submit"],button').find(b=>/update/i.test((b.value||b.textContent||'')));
  const getBoxes = ()=> $$('input[name="processingAdminLoanIds"]').filter(el=>el.offsetParent!==null && !el.disabled);
  const getBoxKey = (el)=>{
    const value=String(el?.value||'').trim();
    if(value && value.toLowerCase()!=='on') return value;
    const data=String(el?.getAttribute?.('data-id')||'').trim();
    if(data) return data;
    const id=String(el?.id||'').trim();
    return id || '';
  };
  const getReportBoxKeys=()=>new Set($$('input[name="processingAdminLoanIds"]').map(getBoxKey).filter(Boolean));

  // Cheap memoisation. getBoxes() and topIsNoAdmin() walk the whole report
  // table, and they used to run on every mutation and every heartbeat.
  const DOM_CACHE_MS=400;
  let _boxCache={t:0,v:null};
  let _adminCache={t:0,v:null};
  const getBoxesCached=()=>{
    const now=performance.now();
    if(_boxCache.v && now-_boxCache.t<DOM_CACHE_MS) return _boxCache.v;
    _boxCache={t:now,v:getBoxes()};
    return _boxCache.v;
  };
  const invalidateDomCache=()=>{ _boxCache={t:0,v:null}; _adminCache={t:0,v:null}; };

  const clearChecks = ()=> getBoxes().forEach(b=>b.checked=false);
  const pickBottom = (n)=>{ const arr=getBoxes().reverse(); const out=[]; for(const b of arr){ if(!b.checked){ out.push(b); if(out.length>=n) break; } } return out; };
  const pickRandom = (n)=>{ const arr=getBoxes().filter(b=>!b.checked); for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr.slice(0,n); };
  const topFilterSelect=()=> $$('select').find(sel => (/Processing Admin/i.test(sel.closest('tr,div,section')?.textContent||'')) && sel!==getAssignDD());
  const topIsNoAdmin=()=>{
    const now=performance.now();
    if(_adminCache.v!==null && now-_adminCache.t<DOM_CACHE_MS) return _adminCache.v;
    const s=topFilterSelect();
    const v=!s ? true : (s.options[s.selectedIndex]?.text||'').toLowerCase().includes('no admin');
    _adminCache={t:now,v};
    return v;
  };
  // Plain `dd.value=x; dd.dispatchEvent(new Event('change'))` only updates the
  // raw DOM property. If the report's dropdown is a React-controlled (or
  // similar framework-controlled) <select>, the framework's own internal
  // state tracks changes through its synthetic event system and can miss a
  // scripted assignment entirely — the box visibly shows the new rep, but
  // whatever actually gets submitted on Update can silently stay the
  // *previous* selection. Using the native property setter before dispatching
  // both 'input' and 'change' is the standard workaround: it forces the
  // framework's change-detection to see a real transition instead of a
  // same-value no-op.
  const nativeSelectValueSetter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set;
  const setAssignAdmin=(id)=>{
    const dd=getAssignDD(); if(!dd) return false;
    if(nativeSelectValueSetter) nativeSelectValueSetter.call(dd,String(id));
    else dd.value=String(id);
    dd.dispatchEvent(new Event('input',{bubbles:true}));
    dd.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  };

  // ---------- roster CSV ----------
  const CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vQgWqtMjWSM3pxso2zs8mUh51JS0u2EqsN5_d_l2rjhsXGlcQ-A0F2gzk8nRtrNmjG2YurSxqbcIo0Z/pub?gid=355516630&single=true&output=csv';
  let roster={day:[], late:[]};
  let id2name=new Map(), name2id=new Map();
  let rosterLoading=false;
  // True whenever the *current* roster in memory came from a cached copy
  // that the user explicitly chose to use (via "Use last working list"),
  // rather than a fresh CSV. Set only by useLastWorkingRoster(), never
  // automatically — a failed/empty live fetch leaves the roster empty
  // instead of silently substituting stale data.
  let rosterStale=false;
  let rosterStaleSince=0;
  // Set whenever a live fetch fails or parses to zero IDs *and* a cached
  // copy exists to fall back to. Drives the "Use last working list" button;
  // cleared the moment a fresh live fetch succeeds, or the user applies it.
  let cacheOffer=null;

  function parseRosterCsv(text){
    const lines=text.split(/\r?\n/);
    const day=[], late=[];
    for(let i=1;i<lines.length;i++){
      if(!lines[i]) continue;
      const parts=lines[i].split(',');
      const d=(parts[0]||'').trim();
      const l=(parts[1]||'').trim();
      if(/^\d+$/.test(d)) day.push(d);
      if(/^\d+$/.test(l)) late.push(l);
    }
    return {day:uniq(day), late:uniq(late)};
  }

  async function loadRoster(force=false){
    if(!force && (roster.day.length+roster.late.length)) return roster;

    // A plain fetch() has no timeout. When the sheet was slow or unreachable
    // the await below never settled, boot() never finished, and the Assign
    // buttons stayed disabled forever showing "Loading representatives…".
    let text=null;
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),10000);
      try{
        const res=await fetch(CSV_URL,{cache:'no-store',signal:ctrl.signal});
        if(!res.ok) throw new Error('CSV '+res.status);
        text=await res.text();
      } finally { clearTimeout(timer); }
    }catch(err){
      logEvent('roster','fetch failed: '+(err?.message||err));
    }

    if(text){
      const parsed=parseRosterCsv(text);
      if(parsed.day.length+parsed.late.length){
        roster=parsed;
        rosterStale=false;
        cacheOffer=null;
        save(LS.ROSTER,{ts:Date.now(),day:roster.day,late:roster.late});
        return roster;
      }
      logEvent('roster','CSV parsed but contained no representative ids');
    }

    // Live data is missing or empty (network error, or the sheet itself is
    // broken — e.g. every DayIDs/LateIDs cell is "#N/A"). Do NOT silently
    // substitute a cached copy: leave the roster genuinely empty so Exclude/
    // Choose/Assign all correctly reflect "no live data", and surface an
    // explicit "Use last working list" option for the user to opt into
    // instead. If the user never clicks it, everything just stays empty.
    roster={day:[],late:[]};
    const cached=load(LS.ROSTER,null);
    cacheOffer=(cached && (cached.day?.length || cached.late?.length)) ? cached : null;
    return roster;
  }

  function previewCacheNames(cache){
    const ids=uniq([...(cache?.day||[]), ...(cache?.late||[])]);
    const dd=getAssignDD();
    if(!dd) return ids.map(id=>`#${id}`);
    const map=new Map();
    for(const o of dd.options){
      const id=(o.value||'').trim(), nm=(o.textContent||'').trim();
      if(id) map.set(id,nm);
    }
    return ids.map(id=> map.get(id) || `#${id}`).sort((a,b)=>a.localeCompare(b));
  }

  // Explicit opt-in to run on the last known-good roster. Shows who's
  // actually in it (cross-referenced against the live LMS dropdown) before
  // applying anything, per the request to never populate Exclude/Choose/
  // Assign from stale data without the user seeing and choosing it first.
  function useLastWorkingRoster(){
    if(!cacheOffer) return;
    const when=cacheOffer.ts ? new Date(cacheOffer.ts).toLocaleString() : 'an earlier load';
    const names=previewCacheNames(cacheOffer);
    const list=names.length ? names.join(', ') : '(none matched the current LMS dropdown)';
    const ok=confirm(`Use the last working roster from ${when}?\n\n${names.length} representative(s):\n${list}\n\nThis will fill Exclude/Choose and unlock Assign using this cached list until a fresh sheet load succeeds.`);
    if(!ok) return;
    roster={day:cacheOffer.day||[], late:cacheOffer.late||[]};
    rosterStale=true;
    rosterStaleSince=cacheOffer.ts||0;
    cacheOffer=null;
    rebuildMaps();
    syncControls();
    updateWarn();
  }

  function rebuildMaps(){
    id2name.clear(); name2id.clear();
    const dd=getAssignDD(); if(!dd) return;
    const allowed=new Set([...(roster.day||[]), ...(roster.late||[])]);
    for(const o of dd.options){
      const id=(o.value||'').trim(), nm=(o.textContent||'').trim();
      if(/^\d+$/.test(id) && nm && allowed.has(id)){ id2name.set(id,nm); name2id.set(norm(nm), id); }
    }
    // refresh datalists
    for(const sel of ['#sa-dl','#sa-choose-dl']){
      const dl=$(sel); if(!dl) continue; dl.innerHTML='';
      Array.from(id2name.entries()).sort((a,b)=>a[1].localeCompare(b[1]))
        .forEach(([id,nm])=>{ const opt=document.createElement('option'); opt.value=nm; dl.appendChild(opt);});
    }
    const active=load(LS.JOB,null);
    if(active) hydrateJobNames(active);
  }
  const safeRosterName=(id)=>String(id2name.get(String(id))||'').trim();
  const repName=(job,id)=>{
    const key=String(id);
    const saved=String(job?.repNames?.[key]||'').trim();
    if(saved && saved!=='Representative' && saved!==key) return saved;
    return safeRosterName(key)||saved||key;
  };
  const names=(ids)=>ids.map(id=>safeRosterName(id)||String(id));

  function hydrateJobNames(job){
    if(!job) return job;
    job.repNames=job.repNames&&typeof job.repNames==='object' ? job.repNames : {};
    let changed=false;
    for(const q of job.queue||[]){
      const key=String(q.id);
      const existing=String(job.repNames[key]||'').trim();
      if(existing && existing!=='Representative' && existing!==key) continue;
      const name=safeRosterName(key);
      if(name){ job.repNames[key]=name; changed=true; }
    }
    if(changed) save(LS.JOB,job);
    return job;
  }

  async function ensureRepresentativeMaps(force=false,timeoutMs=15000){
    rosterLoading=true;
    try{
      try { await loadRoster(force); } catch { return false; }
      if(!(roster.day.length+roster.late.length)){
        // No live data at all (and no cache was applied) — nothing to wait
        // for. Clear any stale maps/datalists and bail out immediately
        // instead of polling for the full timeout on a call that can't
        // possibly succeed.
        if(getAssignDD()) rebuildMaps();
        return false;
      }
      const started=performance.now();
      while(performance.now()-started<timeoutMs){
        if(getAssignDD()){
          rebuildMaps();
          if(id2name.size>0) return true;
        }
        await sleep(150);
      }
      rebuildMaps();
      return id2name.size>0;
    } finally {
      rosterLoading=false;
      syncControls();
    }
  }

  // ---------- styles ----------
  function injectCSS(){
    if($('#sa-css')) return;
    const st=document.createElement('style'); st.id='sa-css';
    st.textContent=`
      #sa,#sa-cfm,#sa-modal,#sa-pause-modal{--bg:#0f172a;--text:#e5e7eb;--mut:#94a3b8;--line:#1f2937;--chip:#111827;--y:#facc15;--b:#3b82f6;--p:#8b5cf6;--g:#6b7280;}
      @media (prefers-color-scheme:light){#sa,#sa-cfm,#sa-modal,#sa-pause-modal{--bg:#fff;--text:#0f172a;--mut:#475569;--line:#e5e7eb;--chip:#eef2ff;}}
      #sa{position:fixed;left:16px;top:calc(100vh - 420px);width:960px;max-width:calc(100% - 32px);z-index:2147483647;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.18);}
      #sa.collapsed .body{display:none;}
      .sa-inner{padding:12px 14px 16px;display:flex;flex-direction:column;gap:10px;}
      .sa-h{display:flex;align-items:center;justify-content:space-between;user-select:none;}
      .sa-title{font-weight:800;font-size:20px;}
      .sa-h .right{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
      .sa-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
      .sa-btn{type:button;height:36px;padding:6px 14px;border:none;border-radius:12px;font-weight:700;cursor:pointer;pointer-events:auto;position:relative;z-index:1;}
      .sa-ic{width:36px;padding:6px 0;}
      .sa-day{background:var(--y); color:#111827 !important;}
      .sa-late{background:var(--b);color:#fff;}
      .sa-all{background:var(--p);color:#fff;}
      .sa-gray{background:var(--g);color:#fff;}
      .sa-inp{height:36px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit;}
      .sa-small{font-size:12px;color:var(--mut);}
      .sa-chips{display:flex;gap:8px;flex-wrap:wrap;min-height:24px;max-height:112px;overflow:auto;}
      .sa-chip{background:var(--chip);padding:5px 12px;border-radius:9999px;font-size:13px;display:inline-flex;gap:8px;align-items:center;}
      .sa-chip button{border:none;background:transparent;color:inherit;font-weight:900;cursor:pointer;}
      .sa-colwrap{display:grid;grid-template-columns:1fr 14px 1fr;gap:12px;align-items:start;margin-top:8px;}
      .sa-sep{width:1px;background:var(--line);height:180px;align-self:stretch;opacity:.8;border-radius:1px;}
      .sa-btn:disabled{opacity:.55;cursor:not-allowed;}
      .sa-toggle{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-weight:700;font-size:13px;}
      .sa-toggle input{position:absolute;opacity:0;pointer-events:none;}
      .sa-toggle-track{width:42px;height:24px;border-radius:999px;background:#4b5563;position:relative;transition:.18s;}
      .sa-toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.35);}
      .sa-toggle input:checked + .sa-toggle-track{background:#16a34a;}
      .sa-toggle input:checked + .sa-toggle-track .sa-toggle-knob{transform:translateX(18px);}
      #sa-progress{display:none;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:rgba(59,130,246,.08);}
      .sa-progress-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .sa-progress-title{font-weight:800;font-size:14px;}
      .sa-progress-metrics{display:grid;grid-template-columns:repeat(2,minmax(190px,1fr));gap:4px 18px;margin-top:6px;}
      .sa-progress-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .sa-progress-bar{height:8px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:9px;}
      #sa-progress-fill{height:100%;width:0;background:#3b82f6;transition:width .2s ease;}
      #sa-pause-job{background:#eab308;color:#111827;}
      #sa-resume-job{background:#16a34a;color:#fff;}
      #sa-stop-job{background:#dc2626;color:#fff;}
      #sa-copy-job{background:#374151;color:#fff;}
      #sa-takeover-job{background:#f97316;color:#fff;}
      #sa-confirm-step{background:#16a34a;color:#fff;}
      #sa-retry-step{background:#2563eb;color:#fff;}
      #sa-progress.sa-owner-warning{background:rgba(234,179,8,.10);border-color:#ca8a04;}
      #sa-progress.sa-blocked{background:rgba(220,38,38,.09);border-color:#dc2626;}
      #sa-progress-details{display:none;margin-top:10px;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px;}
      #sa-progress-details .sa-detail{min-width:0;}
      #sa-progress-details pre{margin:4px 0 0;max-height:130px;overflow:auto;white-space:pre-wrap;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(0,0,0,.08);}
      @media (max-width:760px){.sa-progress-metrics{grid-template-columns:1fr;}}

      /* Modals */
      #sa-cfm,#sa-modal,#sa-pause-modal{
        position: fixed; inset: 0; z-index: 2147483648;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.45);
      }
      .sa-card{
        width: min(960px, 96vw);
        max-height: min(90vh, 900px);
        background: var(--bg); color: var(--text);
        border: 1px solid var(--line); border-radius: 14px;
        box-shadow: 0 12px 36px rgba(0,0,0,.25);
        display: flex; flex-direction: column;
      }
      .sa-card .hd{
        display:flex; align-items:center; justify-content:space-between;
        padding: 12px 16px; border-bottom:1px solid var(--line);
        font-weight:800; font-size:18px;
      }
      .sa-card .content{flex:1; min-height:0; display:flex; flex-direction:column; overflow:auto;}
      .sa-card .sub{ padding:10px 16px; display:flex; flex-direction:column; gap:6px; flex:none; }
      .sa-card .bd{ padding: 12px 16px; display:grid; grid-template-columns: 1fr 1fr; gap:12px; flex:1; min-height:0; }
      .sa-card .col{ display:flex; flex-direction:column; gap:8px; min-height:0; }
      .sa-card .col h4{ margin:0; font-size:14px; opacity:.85; flex:none; }
      .sa-card pre{
        margin:0; padding:10px 12px; border:1px solid var(--line);border-radius:10px;
        background: rgba(0,0,0,.08);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre; overflow:auto; line-height:1.35; flex:1; min-height:0;
      }
      .sa-card .ft{ display:flex; gap:8px; justify-content:flex-end; padding: 10px 16px; border-top:1px solid var(--line); flex:none; background:rgba(0,0,0,.04);}
      .sa-card .btn{ height:34px; padding:6px 12px; border:none; border-radius:10px; font-weight:700; cursor:pointer; }
      .sa-card .btn.primary{ background:#3b82f6; color:#fff; }
      .sa-card .btn.ghost{ background:#374151; color:#fff; }
      .sa-card .btn.success{ background:#16a34a; color:#fff; }
      .sa-card .btn.danger{ background:#dc2626; color:#fff; }
      .sa-label{font-size:12px; opacity:.85;}
      .sa-inline-note{font-size:12px;color:#eab308;margin-top:6px;}
    `;
    (document.head||document.documentElement).appendChild(st);
  }

  // ---------- panel UI ----------
  // The panel can be rebuilt many times per session (Infinity replaces the
  // body on partial refreshes). Window listeners must therefore be installed
  // exactly once, or every rebuild adds another mousemove handler and the tab
  // eventually grinds to a halt.
  let dragState={active:false,sx:0,sy:0,sl:0,st:0};
  let windowHandlersBound=false;
  function clampPanel(left,top){
    const panel=$('#sa'); if(!panel) return null;
    const l=Math.max(8,Math.min(left,window.innerWidth-panel.offsetWidth-8));
    const t=Math.max(8,Math.min(top,window.innerHeight-panel.offsetHeight-8));
    panel.style.left=l+'px'; panel.style.top=t+'px';
    return {left:l,top:t};
  }
  function bindWindowHandlersOnce(){
    if(windowHandlersBound) return;
    windowHandlersBound=true;
    window.addEventListener('mousemove',(e)=>{
      if(!dragState.active) return;
      clampPanel(dragState.sl+(e.clientX-dragState.sx), dragState.st+(e.clientY-dragState.sy));
    });
    window.addEventListener('mouseup',()=>{
      if(!dragState.active) return;
      dragState.active=false;
      document.body.style.userSelect='';
      const panel=$('#sa'); if(!panel) return;
      const r=panel.getBoundingClientRect();
      save(LS.POS,{left:r.left,top:r.top});
    });
    window.addEventListener('resize',()=>{
      const panel=$('#sa'); if(!panel) return;
      const r=panel.getBoundingClientRect();
      const pos=clampPanel(r.left,r.top);
      if(pos) save(LS.POS,pos);
    });
  }

  function buildPanel(){
    if($('#sa') || !document.body) return;
    const box=document.createElement('div'); box.id='sa';
    box.innerHTML=`
      <div class="sa-inner">
        <div class="sa-h" id="sa-drag">
          <div class="sa-title">Auto Assign</div>
          <div class="right">
            <span class="sa-label">Leads per rep</span>
            <input id="sa-lpr" class="sa-inp" type="number" min="1" step="1" style="width:120px" placeholder="auto">
            <button id="sa-lpr-save" class="sa-btn sa-gray" type="button" title="Save">Save</button>
            <span id="sa-lpr-saved" class="sa-small">Saved: auto</span>
            <button id="sa-lpr-reset" class="sa-btn sa-gray" type="button" title="Reset">Reset</button>
            <button id="sa-collapse" class="sa-btn sa-gray sa-ic" type="button" title="Collapse">−</button>
            <button id="sa-refresh" class="sa-btn sa-late" type="button">Refresh</button>
          </div>
        </div>

        <div class="sa-row" style="margin-top:6px;">
          <button id="sa-day"  class="sa-btn sa-day"  type="button">Assign Day</button>
          <button id="sa-late" class="sa-btn sa-late" type="button">Assign Late</button>
          <button id="sa-all"  class="sa-btn sa-all"  type="button">Assign Everyone</button>
          <label class="sa-toggle" title="OFF = bottom-up, ON = random visible leads">
            <input id="sa-random" type="checkbox">
            <span class="sa-toggle-track"><span class="sa-toggle-knob"></span></span>
            <span id="sa-random-text">Random: OFF</span>
          </label>
          <span class="sa-small" id="sa-warn" style="margin-left:auto;"></span>
        </div>

        <div class="sa-row" id="sa-cache-offer-row" style="display:none;margin-top:2px;">
          <span class="sa-small" id="sa-cache-offer-text" style="color:#f59e0b;"></span>
          <button id="sa-use-cache" class="sa-btn sa-gray" type="button">Use last working list</button>
        </div>

        <div id="sa-progress">
          <div class="sa-progress-top">
            <div style="flex:1;min-width:360px;">
              <div id="sa-progress-title" class="sa-progress-title">Assignment in progress</div>
              <div class="sa-progress-metrics">
                <div id="sa-progress-reps" class="sa-small"></div>
                <div id="sa-progress-remaining-reps" class="sa-small"></div>
                <div id="sa-progress-leads" class="sa-small"></div>
                <div id="sa-progress-remaining-leads" class="sa-small"></div>
                <div id="sa-progress-next" class="sa-small"></div>
                <div id="sa-progress-mode" class="sa-small"></div>
              </div>
              <div id="sa-progress-detail" class="sa-small" style="display:none;margin-top:6px;color:#f59e0b;"></div>
            </div>
            <div class="sa-progress-actions">
              <button id="sa-pause-job" class="sa-btn" type="button">Pause</button>
              <button id="sa-resume-job" class="sa-btn" type="button" style="display:none;">Resume</button>
              <button id="sa-confirm-step" class="sa-btn" type="button" style="display:none;">Assigned — Continue</button>
              <button id="sa-retry-step" class="sa-btn" type="button" style="display:none;">Not assigned — Retry</button>
              <button id="sa-takeover-job" class="sa-btn" type="button" style="display:none;">Take over session</button>
              <button id="sa-copy-job" class="sa-btn" type="button" style="display:none;">Copy report</button>
              <button id="sa-stop-job" class="sa-btn" type="button">Stop completely</button>
            </div>
          </div>
          <div class="sa-progress-bar"><div id="sa-progress-fill"></div></div>
          <div id="sa-progress-details">
            <div class="sa-detail"><div class="sa-small">✅ Confirmed assigned</div><pre id="sa-detail-assigned">(none)</pre></div>
            <div class="sa-detail"><div class="sa-small">⚠ Uncertain</div><pre id="sa-detail-uncertain">(none)</pre></div>
            <div class="sa-detail"><div class="sa-small">⏸ Remaining</div><pre id="sa-detail-remaining">(none)</pre></div>
          </div>
        </div>

        <div class="sa-body body">
          <div class="sa-colwrap">
            <div>
              <div class="sa-small" style="margin:6px 0;">Excluded representatives:</div>
              <div class="sa-row">
                <input id="sa-inp" class="sa-inp" list="sa-dl" placeholder="Type a name and press Enter" style="flex:1;min-width:260px;">
                <datalist id="sa-dl"></datalist>
                <button id="sa-add" class="sa-btn sa-gray" type="button">Add</button>
              </div>
              <div class="sa-row" style="margin-top:8px; justify-content:space-between;">
                <div style="display:flex;gap:10px;align-items:center;">
                  <button id="sa-save" class="sa-btn sa-gray" type="button">Save list</button>
                  <span id="sa-saved" class="sa-small">Saved: 0</span>
                </div>
                <button id="sa-clear" class="sa-btn sa-gray" type="button">Clear</button>
              </div>
              <div id="sa-chips" class="sa-chips" style="margin-top:6px;"></div>
            </div>

            <div class="sa-sep"></div>

            <div>
              <div class="sa-small" style="margin:6px 0;">Choose representatives:</div>
              <div class="sa-row">
                <input id="sa-choose-inp" class="sa-inp" list="sa-choose-dl" placeholder="If empty → All reps" style="flex:1;min-width:260px;">
                <datalist id="sa-choose-dl"></datalist>
                <button id="sa-choose-add" class="sa-btn sa-gray" type="button">Add</button>
              </div>
              <div class="sa-row" style="margin-top:8px; justify-content:space-between;">
                <div style="display:flex;gap:10px;align-items:center;">
                  <button id="sa-choose-save" class="sa-btn sa-gray" type="button">Save list</button>
                  <span id="sa-choose-saved" class="sa-small">Saved: 0</span>
                </div>
                <button id="sa-choose-clear" class="sa-btn sa-gray" type="button">Clear</button>
              </div>
              <div id="sa-choose-note" class="sa-inline-note" style="display:none;"></div>
              <div id="sa-choose-chips" class="sa-chips" style="margin-top:6px;"></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(box);
    lastProgressSig=''; // a fresh panel must always be repainted

    // position + drag
    const pos=load(LS.POS,{left:16,top:Math.max(16,window.innerHeight-420)});
    box.style.left=pos.left+'px'; box.style.top=pos.top+'px';
    $('#sa-drag').addEventListener('mousedown',e=>{
      if(e.target.closest('.right')) return;
      const panel=$('#sa'); if(!panel) return;
      const r=panel.getBoundingClientRect();
      dragState={active:true,sx:e.clientX,sy:e.clientY,sl:r.left,st:r.top};
      document.body.style.userSelect='none';
    });
    bindWindowHandlersOnce();

    const collapsed=!!load(LS.COL,false);
    box.classList.toggle('collapsed',collapsed);
    $('#sa-collapse').textContent = collapsed ? '▢':'−';

    // preload saved "Leads per rep" -> input + Saved label
    const lprSaved = load(LS.LPR, null);
    if (lprSaved && Number.isFinite(lprSaved)) $('#sa-lpr').value = String(lprSaved);
    $('#sa-lpr-saved').textContent = 'Saved: ' + (lprSaved ? lprSaved : 'auto');

    // preload saved Random mode
    const randomSaved = !!load(LS.RANDOM, false);
    $('#sa-random').checked = randomSaved;
    $('#sa-random-text').textContent = randomSaved ? 'Random: ON' : 'Random: OFF';
  }

  // ---------- delegated click for robust Collapse ----------
  document.addEventListener('click', (e)=>{
    const t = e.target;
    if (t && t.id === 'sa-collapse'){
      const panel = $('#sa');
      const collapsed = panel.classList.toggle('collapsed');
      $('#sa-collapse').textContent = collapsed ? '▢' : '−';
      save(LS.COL, collapsed);
      e.preventDefault();
    }
  });

  // ---------- confirm modal ----------
  function showConfirmModal({shift, reps, perRep, visible, totalAssign, remainder, randomMode=false, assignees=[], excluded=[]}) {
    return new Promise((resolve)=>{
      const wrap = document.createElement('div'); wrap.id='sa-cfm';
      wrap.innerHTML = `
        <div class="sa-card" role="dialog" aria-modal="true" aria-label="Confirm Auto-Assign">
          <div class="hd">
            <div>Confirm Auto-Assign</div>
            <button class="btn ghost" id="cfm-x" title="Close">✕</button>
          </div>
          <div class="content">
            <div class="sub">
              <div>Shift: ${shift}</div>
              <div>Reps: ${reps}</div>
              <div>Leads per rep: ${perRep}</div>
              <div>Lead selection: ${randomMode ? 'Random' : 'Bottom-up'}</div>
              <div>Total visible leads: ${visible}</div>
              <div>Total leads to assign: ${totalAssign}</div>
            ${remainder>0 ? `<div>Expected leads left after completion: ${remainder}</div>` : ``}
            </div>
            <div class="bd">
              <div class="col">
                <h4>Assignees</h4>
                <pre>${assignees.map(n=>`- ${n}`).join('\n') || '(none)'}</pre>
              </div>
              <div class="col">
                <h4>Excluded</h4>
                <pre>${excluded.map(n=>`- ${n}`).join('\n') || '(none)'}</pre>
              </div>
            </div>
          </div>
          <div class="ft">
            <button class="btn" id="cfm-cancel" type="button">Cancel</button>
            <button class="btn primary" id="cfm-ok" type="button">Assign</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = (v)=>{ wrap.remove(); resolve(v); };
      wrap.addEventListener('click', (ev)=>{ if(ev.target===wrap) close(false); });
      $('#cfm-ok').onclick=()=>close(true);
      $('#cfm-cancel').onclick=()=>close(false);
      $('#cfm-x').onclick=()=>close(false);
    });
  }

  // ---------- summary modal ----------
 function showSummaryModal({
  title='Assigning completed',
  perRep,
  reps,
  totalPlanned,
  totalAssigned,
  currentVisible=null,
  randomMode=false,
  assignedDetails=[],
  skippedNames=[],
  remainingNames=[]
}) {
    const rightTitle = remainingNames.length ? '⏸ Not assigned' : '⏭ Skipped';
    const rightNames = remainingNames.length ? uniq([...remainingNames,...skippedNames]) : skippedNames;
    const assignedReps = assignedDetails.filter(x=>x.count>=perRep).length;
    const remainingReps = remainingNames.length;
    const leadsRemaining = Math.max(0, totalPlanned-totalAssigned);

    const wrap = document.createElement('div'); wrap.id='sa-modal';
    wrap.innerHTML = `
      <div class="sa-card" role="dialog" aria-modal="true" aria-label="Auto-Assign summary">
        <div class="hd">
          <div>${title}</div>
          <button class="btn ghost" id="sa-close-x" title="Close">✕</button>
        </div>
        <div class="content">
          <div class="sub">
            <div>Leads per rep: ${perRep}</div>
            <div>Lead selection: ${randomMode ? 'Random' : 'Bottom-up'}</div>
            <div>Assigned reps: ${assignedReps} / ${reps}</div>
            ${remainingReps ? `<div>Remaining reps: ${remainingReps}</div>` : ``}
            <div>Leads assigned: ${totalAssigned} / ${totalPlanned}</div>
            ${leadsRemaining ? `<div>Leads remaining: ${leadsRemaining}</div>` : ``}
         ${currentVisible !== null ? `<div>Current visible unassigned leads: ${currentVisible}</div>` : ``}
          </div>
          <div class="bd">
            <div class="col">
              <h4>✅ Assigned</h4>
              <pre id="sa-pre-assigned">${assignedDetails.map(x=>`- ${x.name}: ${x.count}`).join('\n') || '(none)'}</pre>
              <button class="btn ghost" id="sa-copy-assigned" type="button">Copy assigned</button>
            </div>
            <div class="col">
              <h4>${rightTitle}</h4>
              <pre id="sa-pre-skipped">${rightNames.map(n=>`- ${n}`).join('\n') || '(none)'}</pre>
              <button class="btn ghost" id="sa-copy-skipped" type="button">Copy list</button>
            </div>
          </div>
        </div>
        <div class="ft">
          <button class="btn primary" id="sa-close" type="button">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = ()=> wrap.remove();
    wrap.addEventListener('click', (e)=>{ if(e.target === wrap) close(); });
    $('#sa-close').onclick = close;
    $('#sa-close-x').onclick = close;

    const copy = (id)=>{
      const txt = document.getElementById(id).innerText;
      navigator.clipboard?.writeText(txt).catch(()=>{});
    };
    $('#sa-copy-assigned').onclick = ()=> copy('sa-pre-assigned');
    $('#sa-copy-skipped').onclick  = ()=> copy('sa-pre-skipped');
  }

  function showPauseModal(job) {
    const existing=$('#sa-pause-modal'); if(existing) existing.remove();
    const details=getAssignedDetails(job);
    const remaining=getRemainingNames(job);
    const totalDone=getAssignedTotal(job);
    const completedReps=getAssignedRepCount(job);
    const next=getNextRepName(job);

    const wrap=document.createElement('div'); wrap.id='sa-pause-modal';
    wrap.innerHTML=`
      <div class="sa-card" role="dialog" aria-modal="true" aria-label="Auto-Assign paused">
        <div class="hd">
          <div>Assignment paused</div>
          <button class="btn ghost" id="pause-x" title="Keep paused and close">✕</button>
        </div>
        <div class="content">
          <div class="sub">
            <div>Assigned reps: ${completedReps} / ${job.queue.length}</div>
            <div>Remaining reps: ${getRemainingRepCount(job)}</div>
            <div>Leads assigned: ${totalDone} / ${job.totalAssign}</div>
            <div>Leads remaining: ${Math.max(0,job.totalAssign-totalDone)}</div>
            <div>Next rep: ${next}</div>
            <div>Leads per rep: ${job.perRep}</div>
            <div>Mode: ${job.randomMode ? 'Random' : 'Bottom-up'}</div>
          </div>
          <div class="bd">
            <div class="col">
              <h4>✅ Assigned so far</h4>
              <pre>${details.map(x=>`- ${x.name}: ${x.count}`).join('\n') || '(none)'}</pre>
            </div>
            <div class="col">
              <h4>⏸ Remaining</h4>
              <pre>${remaining.map(n=>`- ${n}`).join('\n') || '(none)'}</pre>
            </div>
          </div>
        </div>
        <div class="ft">
          <button class="btn ghost" id="pause-keep" type="button">Keep paused</button>
          <button class="btn ghost" id="pause-copy" type="button">Copy report</button>
          <button class="btn danger" id="pause-stop" type="button">Stop completely</button>
          <button class="btn success" id="pause-resume" type="button">Resume assignment</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const close=()=>wrap.remove();
    wrap.addEventListener('click',(e)=>{ if(e.target===wrap) close(); });
    $('#pause-x').onclick=close;
    $('#pause-keep').onclick=close;
    $('#pause-copy').onclick=()=>copyJobReport(job);
    $('#pause-resume').onclick=()=>{ close(); resumeCurrentJob(); };
    $('#pause-stop').onclick=()=>{ if(stopCurrentJob(true)) close(); };
  }

  // ---------- model/state ----------
  let draft=new Set(load(LS.DRAFT,[]));
  let savedN=new Set(load(LS.SAVED_N,[]));
  let savedIds=new Set(load(LS.SAVED_IDS,[]));

  let chDraft=new Set(load(LS.CH_DRAFT,[]));
  let chIds=new Set(load(LS.CH_IDS,[]));

  function renderChips(){
    const host=$('#sa-chips'); if(host){ host.innerHTML='';
      Array.from(draft).forEach(n=>{
        const chip=document.createElement('span');
        chip.className='sa-chip'; chip.innerHTML=`${n} <button title="Remove" type="button">×</button>`;
        chip.querySelector('button').onclick=()=>{ draft.delete(n); save(LS.DRAFT,Array.from(draft)); renderChips(); };
        host.appendChild(chip);
      });
      $('#sa-saved').textContent=`Saved: ${savedIds.size}`;
    }
    const chHost=$('#sa-choose-chips'); if(chHost){ chHost.innerHTML='';
      Array.from(chDraft).forEach(n=>{
        const chip=document.createElement('span');
        chip.className='sa-chip'; chip.innerHTML=`${n} <button title="Remove" type="button">×</button>`;
        chip.querySelector('button').onclick=()=>{ chDraft.delete(n); save(LS.CH_DRAFT,Array.from(chDraft)); renderChips(); };
        chHost.appendChild(chip);
      });
      $('#sa-choose-saved').textContent=`Saved: ${chIds.size}`;
    }
  }

  const floorSplit=(total,parts)=> Math.floor(total/parts);
  function buildQueue(poolIds, each){ return poolIds.map(id=>({id,remaining:each,tries:0})); }

  const getAssignedTotal=(job)=> Object.values(job?.assignedCounts||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
  const getAssignedRepCount=(job)=> job.queue.filter(q=>q.remaining===0).length;
  const getRemainingRepCount=(job)=> job.queue.filter(q=>q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY).length;
  const getAssignedDetails=(job)=> job.queue.map(q=>({
    id:q.id,
    name:repName(job,q.id),
    count:Number(job.assignedCounts?.[q.id]||0)
  })).filter(x=>x.count>0);
  const getRemainingNames=(job)=> job.queue.filter(q=>q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY).map(q=>repName(job,q.id));
  const getSkippedNames=(job)=> job.queue.filter(q=>q.remaining===Number.POSITIVE_INFINITY).map(q=>repName(job,q.id));
  const getPendingStep=(job)=> job?.pendingStep || load(LS.STEP,null);
  const isOwnerStale=(job)=>!!job && (Date.now()-Number(job.ownerHeartbeat||0))>OWNER_STALE_MS;
  const formatStep=(step,job=load(LS.JOB,null))=>{
    if(!step) return '(none)';
    const name=repName(job,step.id);
    const result=step.verification==='not_applied'
      ? 'not applied — safe to retry'
      : step.verification==='partial'
        ? 'partially changed — manual check required'
        : 'submitted, result unknown';
    return `${name}: ${Number(step.expected||0)} ${result}`;
  };

  function cleanPendingUrl(){
    const url=new URL(location.href);
    url.hash='';
    url.searchParams.set('reportpreset','pending');
    return url.href;
  }

  function goToCleanPending(){
    ssDel(SS.NAV);
    location.replace(cleanPendingUrl());
  }

  // The POST response already contains the refreshed Pending report. Replace
  // only the history entry, then keep processing in this document. This avoids
  // an unnecessary second reload and removes the form-resubmission entry.
  function markCurrentPageAsCleanGet(){
    ssDel(SS.NAV);
    try { history.replaceState(history.state||{},'',cleanPendingUrl()); } catch {}
  }

  function verifyPendingStep(step){
    if(!step) return {state:'none',detail:'No pending step.'};
    if(!getAssignDD() || !getUpdateBtn()){
      return {state:'uncertain',detail:'The normal Pending report controls are not available. The LMS may be showing an error page.'};
    }
    if(!topIsNoAdmin()) return {state:'uncertain',detail:'The top Processing Admin filter is not set to no admin.'};
    const selected=uniq((step.selectedIds||[]).map(String).filter(Boolean));
    if(!selected.length || selected.length!==Number(step.expected||0)){
      return {state:'uncertain',detail:'This step came from an older version or has no complete lead-ID snapshot.'};
    }
    const visible=getReportBoxKeys();
    const stillVisible=selected.filter(id=>visible.has(id));
    if(stillVisible.length===0){
      return {state:'confirmed',detail:'All submitted lead IDs disappeared from the no-admin list.'};
    }
    if(stillVisible.length===selected.length){
      return {state:'not_applied',detail:'All submitted lead IDs are still visible in the no-admin list.'};
    }
    return {
      state:'partial',
      detail:`${selected.length-stillVisible.length} of ${selected.length} submitted lead IDs disappeared; ${stillVisible.length} are still visible.`
    };
  }

  function clearPendingStep(job){
    localStorage.removeItem(LS.STEP);
    delete job.pendingStep;
    ssDel(SS.NAV);
  }

  function applyConfirmedStep(job,step,source='verified'){
    if(!job || !step) return false;
    job.confirmedSteps=Array.isArray(job.confirmedSteps)?job.confirmedSteps:[];
    const stepId=String(step.stepId||`${step.id}:${step.ts||0}`);
    if(job.confirmedSteps.some(s=>String(s.stepId)===stepId)){
      clearPendingStep(job);
      return true;
    }
    const idx=job.queue.findIndex(q=>String(q.id)===String(step.id));
    if(idx<0) return false;
    const node=job.queue[idx];
    const applied=Math.min(Number(step.expected||0),Math.max(0,Number(node.remaining||0)));
    node.remaining=Math.max(0,Number(node.remaining||0)-applied);
    job.assignedCounts=job.assignedCounts||{};
    job.assignedCounts[node.id]=Number(job.assignedCounts[node.id]||0)+applied;
    node.tries=0;
    job.lastId=node.id;
    // Move to the next rep. Math.max() was used here, which meant that after a
    // wrap-around round the cursor could never move back to reps 0..idx and
    // they were starved of their quota for another full round.
    job.idx=(idx+1)%Math.max(1,job.queue.length);
    job.confirmedSteps.push({stepId,id:node.id,count:applied,confirmedAt:Date.now(),source});
    logEvent('confirmed',`${repName(job,node.id)}: +${applied} (${source}), quota left ${node.remaining}`);
    clearPendingStep(job);
    job.status='running';
    job.lastEngineActivity=Date.now();
    delete job.blockReason;
    delete job.blockDetail;
    return true;
  }

  function reconcilePendingStep(job){
    const step=getPendingStep(job);
    if(!step) return 'none';
    const check=verifyPendingStep(step);
    if(check.state==='confirmed'){
      if(!applyConfirmedStep(job,step,'lead-id verification')){
        job.status='blocked';
        job.blockReason='The submitted representative is no longer in the saved queue.';
        job.blockDetail=check.detail;
        save(LS.JOB,job);
        return 'blocked';
      }
      save(LS.JOB,job);
      return 'confirmed';
    }
    step.verification=check.state;
    step.verificationDetail=check.detail;
    job.pendingStep=step;
    job.status='blocked';
    job.blockReason=check.state==='not_applied'
      ? 'The last Update did not assign the selected leads.'
      : check.state==='partial'
        ? 'The last Update produced a partial or ambiguous result.'
        : 'The last submitted Update could not be verified safely.';
    job.blockDetail=check.detail;
    save(LS.STEP,step);
    save(LS.JOB,job);
    return 'blocked';
  }

  function getNextRepName(job){
    if(!job) return '(none)';
    for(let i=job.idx;i<job.queue.length;i++){
      const q=job.queue[i];
      if(q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY && (!job.lastId || String(q.id)!==String(job.lastId))) return repName(job,q.id);
    }
    for(let i=0;i<Math.min(job.idx,job.queue.length);i++){
      const q=job.queue[i];
      if(q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY && (!job.lastId || String(q.id)!==String(job.lastId))) return repName(job,q.id);
    }
    return '(finishing)';
  }

  // reason is shown as a tooltip while disabled=true, so a stuck-looking
  // button always has a one-hover explanation instead of just going gray.
  function setAssignButtonsDisabled(disabled,reason=''){
    ['#sa-day','#sa-late','#sa-all'].forEach(sel=>{
      const b=$(sel); if(!b) return;
      b.disabled=disabled;
      b.title=disabled ? (reason||'Not available right now.') : '';
    });
  }

  function hideProgress(){
    const box=$('#sa-progress'); if(box) box.style.display='none';
    setAssignButtonsDisabled(false);
  }

  function restorePanelIfNeeded(){
    if($('#sa') || !document.body) return;
    injectCSS();
    buildPanel();
    bindUI();
    renderChips();
    rebuildMaps();
    const job=load(LS.JOB,null);
    if(job) updateProgress(job);
  }

  function buildReport(job){
    if(!job) return 'No active Auto Assign job.';
    const assigned=getAssignedDetails(job).map(x=>`- ${x.name}: ${x.count}`).join('\n')||'(none)';
    const pending=getPendingStep(job);
    const remaining=job.queue.filter(q=>q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY)
      .map(q=>`- ${repName(job,q.id)}: ${q.remaining}`).join('\n')||'(none)';
    const skipped=getSkippedNames(job).map(n=>`- ${n}`).join('\n')||'(none)';
    return [
      'AUTO ASSIGN REPORT',
      `Status: ${job.status||'running'}`,
      `${job.group||'Unknown'} · ${job.randomMode?'Random':'Bottom-up'} · ${job.perRep} leads per rep`,
      `Planned total: ${job.totalAssign}`,
      `Confirmed assigned total: ${getAssignedTotal(job)}`,
      `Current visible unassigned leads: ${getBoxes().length}`,
      '', 'Confirmed assigned:', assigned,
      '', 'Uncertain:', pending ? `- ${formatStep(pending)}` : '(none)',
      '', 'Remaining:', remaining,
      '', 'Skipped:', skipped,
      job.blockReason ? `\nReason: ${job.blockReason}` : '',
      job.blockDetail ? `Detail: ${job.blockDetail}` : '',
      '', 'Event log:', formatLog()
    ].join('\n');
  }

  function copyJobReport(job=load(LS.JOB,null)){
    const text=buildReport(job);
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>prompt('Copy report:',text));
    else prompt('Copy report:',text);
  }

  let lastProgressSig='';
  function updateProgress(job,force=false){
    const box=$('#sa-progress'); if(!box || !job) return;
    // The heartbeat repaints this every 3s. Doing ~25 DOM writes each time for
    // an unchanged job is wasted work, so bail out when nothing moved.
    const sig=JSON.stringify([job.status,job.idx,job.lastId,job.assignedCounts,job.blockReason,
      job.pendingStep?.stepId||null,isOwner(job),box.isConnected]);
    if(!force && sig===lastProgressSig && box.style.display==='block') return;
    lastProgressSig=sig;
    const assignedReps=getAssignedRepCount(job);
    const remainingReps=getRemainingRepCount(job);
    const assignedLeads=getAssignedTotal(job);
    const remainingLeads=Math.max(0,(job.totalAssign||0)-assignedLeads);
    const pct=job.totalAssign>0 ? Math.min(100,Math.round((assignedLeads/job.totalAssign)*100)) : 0;
    const paused=job.status==='paused';
    const blocked=job.status==='blocked';
    const owner=isOwner(job);
    const pending=getPendingStep(job);
    const recovery=!!pending && blocked;
    const stale=!owner && isOwnerStale(job);

    box.style.display='block';
    box.classList.toggle('sa-owner-warning',!owner);
    box.classList.toggle('sa-blocked',blocked);
    $('#sa-progress-title').textContent=!owner
      ? stale ? 'Original Auto Assign tab is no longer active' : 'Auto Assign is already running in another tab'
      : recovery ? 'Auto Assign — Recovery required'
      : blocked ? 'Auto Assign paused due to LMS issue'
      : paused ? 'Assignment paused' : 'Auto Assign — Running';
    $('#sa-progress-reps').textContent=`Assigned reps: ${assignedReps} / ${job.queue.length}`;
    $('#sa-progress-remaining-reps').textContent=`Remaining reps: ${remainingReps}`;
    $('#sa-progress-leads').textContent=`Leads assigned: ${assignedLeads} / ${job.totalAssign}`;
    $('#sa-progress-remaining-leads').textContent=`Leads remaining: ${remainingLeads}`;
    $('#sa-progress-next').textContent=!owner
      ? stale ? 'The owner heartbeat is stale. You can take over this saved session.' : 'Please continue, pause or stop it in the original tab.'
      : recovery ? `Check: ${formatStep(pending,job)}`
      : pending ? `Assigning to: ${repName(job,pending.id)} · waiting for LMS confirmation`
      : blocked && job.blockReason ? `Reason: ${job.blockReason}` : `Next rep: ${getNextRepName(job)}`;
    $('#sa-progress-mode').textContent=`Leads per rep: ${job.perRep} · Mode: ${job.randomMode ? 'Random' : 'Bottom-up'}`;
    $('#sa-progress-detail').style.display=job.blockDetail ? '' : 'none';
    $('#sa-progress-detail').textContent=job.blockDetail||'';
    $('#sa-progress-fill').style.width=pct+'%';
    // Pause used to be display:none while a batch was pending confirmation
    // from the LMS, which happens on every single batch (submit → reload →
    // verify). That made it disappear and reappear every 1-2s during a
    // normal run. It now stays put like Stop does, just disabled with a
    // tooltip for that brief window, so the layout doesn't jump.
    const pauseAvailable=owner && !paused && !blocked;
    const pauseBtn=$('#sa-pause-job');
    pauseBtn.style.display=pauseAvailable ? '' : 'none';
    pauseBtn.disabled=pauseAvailable && !!pending;
    pauseBtn.title=pauseBtn.disabled ? 'Waiting for the last batch to be confirmed by the LMS…' : '';
    $('#sa-resume-job').style.display=owner && (paused||blocked) && !pending ? '' : 'none';
    $('#sa-resume-job').textContent=blocked ? 'Retry / Resume' : 'Resume';
    $('#sa-confirm-step').style.display=owner && recovery ? '' : 'none';
    $('#sa-retry-step').style.display=owner && recovery ? '' : 'none';
    $('#sa-takeover-job').style.display=stale ? '' : 'none';
    $('#sa-stop-job').style.display=owner ? '' : 'none';
    $('#sa-copy-job').style.display=(paused||blocked||!owner) ? '' : 'none';
    $('#sa-progress-details').style.display=(paused||blocked) && owner ? 'grid' : 'none';
    $('#sa-detail-assigned').textContent=getAssignedDetails(job).map(x=>`- ${x.name}: ${x.count}`).join('\n')||'(none)';
    $('#sa-detail-uncertain').textContent=recovery ? `- ${formatStep(pending,job)}` : '(none)';
    $('#sa-detail-remaining').textContent=job.queue.filter(q=>q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY).map(q=>`- ${repName(job,q.id)}: ${q.remaining}`).join('\n')||'(none)';
    setAssignButtonsDisabled(true,'An Auto Assign job is already active. Use Pause/Resume/Stop above.');
  }

  function clearJobState(){
    localStorage.removeItem(LS.JOB);
    localStorage.removeItem(LS.STEP);
    ssDel(SS.NAV);
    ssDel(SS.TOKEN);
  }

  function blockJob(reason,detail=''){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return;
    job.status='blocked'; job.blockReason=reason||'LMS report page is not ready.';
    job.blockDetail=detail||'';
    logEvent('blocked',`${job.blockReason} ${job.blockDetail}`.trim());
    const step=load(LS.STEP,null); if(step) job.pendingStep=step;
    save(LS.JOB,job); updateProgress(job);
  }

  function pauseCurrentJob(){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return;
    job.status='paused';
    save(LS.JOB,job);
    updateProgress(job);
    showPauseModal(job);
  }

  function resumeCurrentJob(){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return;
    if(getPendingStep(job)){
      alert('Resolve the last submitted step first: choose “Assigned — Continue” or “Not assigned — Retry”.\n\n'+formatStep(getPendingStep(job)));
      updateProgress(job); return;
    }
    job.status='running';
    delete job.blockReason;
    save(LS.JOB,job);
    updateProgress(job);
    if(!getAssignDD() || !getUpdateBtn()) goToCleanPending();
    else scheduleRun(50);
  }

  function markPendingAssigned(){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return;
    const step=getPendingStep(job); if(!step) return;
    const name=repName(job,step.id);
    if(!confirm(`Confirm that ${Number(step.expected||0)} lead(s) were assigned to ${name}?\n\nOnly confirm after checking the LMS manually.`)) return;
    if(!applyConfirmedStep(job,step,'manual confirmation')){
      blockJob('Could not match the uncertain representative to the saved queue.'); return;
    }
    save(LS.JOB,job);
    updateProgress(job);
    markCurrentPageAsCleanGet();
    scheduleRun(100);
  }

  function retryPendingStep(){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return;
    const step=getPendingStep(job); if(!step) return;
    const name=repName(job,step.id);
    if(!confirm(`Retry ${Number(step.expected||0)} lead(s) for ${name}?\n\nUse this only after checking that the previous Update did not assign them.`)) return;
    const idx=job.queue.findIndex(q=>String(q.id)===String(step.id));
    if(idx<0){ blockJob('Could not match the uncertain representative to the saved queue.'); return; }
    clearPendingStep(job);
    job.idx=idx;
    job.status='running';
    delete job.blockReason;
    delete job.blockDetail;
    save(LS.JOB,job);
    updateProgress(job);
    markCurrentPageAsCleanGet();
    scheduleRun(100);
  }

  function takeOverCurrentJob(){
    const job=load(LS.JOB,null); if(!job || isOwner(job) || !isOwnerStale(job)) return;
    if(!confirm('The original tab has not updated its heartbeat for at least 2 minutes. Take over this Auto Assign session in this tab?')) return;
    job.ownerTabId=TAB_ID;
    job.ownerHeartbeat=Date.now();
    sessionStorage.setItem(SS.TOKEN,job.token||'');
    if(getPendingStep(job)){
      job.status='blocked';
      job.blockReason='Recovered from an inactive tab. Verify the last submitted step.';
    }
    save(LS.JOB,job);
    updateProgress(job);
    if(getPendingStep(job)){
      const result=reconcilePendingStep(job);
      const fresh=load(LS.JOB,null); if(fresh) updateProgress(fresh);
      if(result==='confirmed'){
        markCurrentPageAsCleanGet();
        scheduleRun(100);
      }
    } else if(job.status==='running') scheduleRun(50);
  }

  function stopCurrentJob(ask=true){
    const job=load(LS.JOB,null); if(!job || !isOwner(job)) return false;
    if(ask && !confirm('Stop this assignment completely? It cannot be resumed after stopping.')) return false;

  const details=getAssignedDetails(job);
const remaining=getRemainingNames(job);
const skipped=getSkippedNames(job);
const totalDone=getAssignedTotal(job);
const currentVisible=getBoxes().length;
clearJobState();

    hideProgress();
    const pauseModal=$('#sa-pause-modal'); if(pauseModal) pauseModal.remove();

    showSummaryModal({
      title:'Assignment stopped',
      perRep:job.perRep,
      reps:job.queue.length,
      totalPlanned:job.totalAssign,
      totalAssigned:totalDone,

    currentVisible,


      randomMode:!!job.randomMode,
      assignedDetails:details,
      skippedNames:skipped,
      remainingNames:remaining
    });
    return true;
  }

  // ---------- start job ----------
  let startingJob=false;
  function cancelJobStart(message){
    startingJob=false;
    setAssignButtonsDisabled(false);
    if(message) alert(message);
  }
  async function startJob(group, baseIds){
    if(startingJob) return;
    if(load(LS.JOB,null)){
      const active=load(LS.JOB,null); updateProgress(active);
      alert(isOwner(active)
        ? 'An Auto Assign job is already active. Resume it or stop it completely first.'
        : 'Auto Assign is already running in another tab. Please finish, pause or stop it there.');
      return;
    }
    if(!topIsNoAdmin()){ alert('Please set top filter "Processing Admin" to "-- no admin --".'); return; }

    startingJob=true;
    setAssignButtonsDisabled(true,'Starting assignment…');
    const warn=$('#sa-warn');
    if(warn) warn.textContent='Loading representatives…';
    let mapsReady=false;
    try { mapsReady=await ensureRepresentativeMaps(false,15000); }
    catch(err){ logEvent('roster','startJob failed: '+(err?.message||err)); }
    finally { startingJob=false; rosterLoading=false; }
    if(!mapsReady){
      syncControls();
      updateWarn();
      alert('Representatives are not loaded from the LMS yet. Please click Refresh and try again.');
      return;
    }
    if(warn) warn.textContent='';

    const poolBase=baseIds.filter(id=> id2name.has(id));
    if(!baseIds.length){
      setAssignButtonsDisabled(false);
      alert(`No representatives were found in the ${group} roster.`);
      return;
    }
    if(!poolBase.length){
      setAssignButtonsDisabled(false);
      alert('The roster loaded, but its representatives could not be matched to the LMS dropdown. Click Refresh and try again.');
      return;
    }
    const excl=new Set(load(LS.SAVED_IDS,[]));
    const filtered=poolBase.filter(id=> !excl.has(id)); // after exclusions

    // Choose representatives (optional): if saved list non-empty → intersect
    const chooseSaved = new Set(load(LS.CH_IDS,[]));
    const finalPool = chooseSaved.size
      ? filtered.filter(id => chooseSaved.has(id))
      : filtered; // If empty -> All reps

    if (chooseSaved.size && finalPool.length===0){
      cancelJobStart('No representatives selected.');
      return;
    }
    if(!finalPool.length){ setAssignButtonsDisabled(false); alert('No reps to assign (all excluded).'); return; }

    const visible = getBoxes().length;

    // Leads per rep (user or auto)
    const lprValueRaw = ($('#sa-lpr').value||'').trim();
    let perRep = null;
    if (lprValueRaw === '') {
      if (visible < finalPool.length){
        cancelJobStart('Not enough leads. Needed ' + finalPool.length + ', available ' + visible + '.');
        return;
      }
      perRep = floorSplit(visible, finalPool.length);
    } else {
      const parsed = parseInt(lprValueRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        cancelJobStart('Leads per rep must be at least 1.');
        return;
      }
      const needed = parsed * finalPool.length;
      if (visible < needed) {
        cancelJobStart(`Not enough leads. Needed ${needed}, available ${visible}.`);
        return;
      }
      perRep = parsed;
    }

    const totalAssign = perRep * finalPool.length;
    const remainder   = visible - totalAssign;
    const randomMode  = !!$('#sa-random')?.checked;

    // Confirm modal
    const ok = await showConfirmModal({
      shift: group,
      reps: finalPool.length,
      perRep,
      visible,
      totalAssign,
      remainder,
      randomMode,
      assignees: names(finalPool),
      excluded: names([...excl])
    });
    if(!ok){ setAssignButtonsDisabled(false); return; }

    const token = Math.random().toString(36).slice(2);
    sessionStorage.setItem(SS.TOKEN, token);
    const job={
      token,
      ownerTabId:TAB_ID,
      ownerHeartbeat:Date.now(),
      group,
      queue:buildQueue(finalPool,perRep),
      idx:0,
      lastId:null,
      perRep,
      totalAssign,
      remainder,
      visible0:visible,
      randomMode,
      status:'running',
      lastEngineActivity:Date.now(),
      repNames:Object.fromEntries(finalPool.map(id=>[String(id),safeRosterName(id)||String(id)])),
      assignedCounts:{},
      confirmedSteps:[]
    };
    save(LS.JOB, job);
    save(LS.LOG,[]); // fresh log per job
    logEvent('start',`${group}: ${finalPool.length} rep(s) x ${perRep} = ${totalAssign}, visible ${visible}, ${randomMode?'random':'bottom-up'}`);
    updateProgress(job);
    scheduleRun(0);
  }

  async function waitReady(ms=12000){
    const t=performance.now();
    while(performance.now()-t<ms){
      if(document.readyState!=='loading' && getAssignDD() && getUpdateBtn()) return true;
      await sleep(100);
    }
    return false;
  }

  // ---------- engine ----------
  let running=false;
  let runTimer=0;
  function scheduleRun(delay=0){
    clearTimeout(runTimer);
    runTimer=setTimeout(()=>{
      const job=load(LS.JOB,null);
      if(job && isOwner(job) && job.status==='running') runJob();
    },Math.max(0,delay));
  }

  async function runJob(){
    if(running) return; running=true;
    try{
      let job=load(LS.JOB,null);
      if(!job || !isOwner(job)) return;
      if(!(await waitReady())){ blockJob('Report page not ready / assignment controls not found.'); return; }

      job.assignedCounts=job.assignedCounts||{};
      job.status=job.status||'running';
      job.ownerHeartbeat=Date.now();

      // A submitted step is confirmed only when its exact lead IDs disappeared
      // from the current "no admin" list. A reload alone is never proof.
      if(getPendingStep(job)){
        const result=reconcilePendingStep(job);
        job=load(LS.JOB,null);
        if(!job || !isOwner(job)) return;
        updateProgress(job);
        if(result==='confirmed'){
          markCurrentPageAsCleanGet();
          await sleep(250);
          job=load(LS.JOB,null);
          if(!job || !isOwner(job) || job.status!=='running') return;
        } else {
          return;
        }
      }

      updateProgress(job);

      // Give the user a clear chance to Pause or Stop before the next rep.
      await sleep(1000);
      job=load(LS.JOB,null);
      if(!job || !isOwner(job)) return;
      if(job.status==='paused'){ updateProgress(job); return; }
      if(job.status==='blocked'){ updateProgress(job); return; }

      // main loop
      // Every path through this loop must either submit an Update (and return),
      // finish, block, or strictly reduce the amount of work left. A hard
      // iteration budget is kept as a last-resort backstop so a logic mistake
      // can never freeze the tab again.
      let guard=0;
      while(true){
        if(++guard > job.queue.length*4 + 50){
          blockJob('Internal loop guard tripped.', 'The queue could not make progress. Use Recovery or stop the job.');
          return;
        }
        await sleep(0); // yield to the browser so the UI stays responsive

        job=load(LS.JOB,null);
        if(!job || !isOwner(job)) return;
        if(job.status!=='running'){ updateProgress(job); return; }
        job.lastEngineActivity=Date.now();
        job.ownerHeartbeat=Date.now();
        save(LS.JOB,job);
        invalidateDomCache();
        if(!topIsNoAdmin()){ blockJob('Top Processing Admin filter is not set to "-- no admin --".'); return; }

        const needsWork=(q)=> q.remaining>0 && q.remaining!==Number.POSITIVE_INFINITY;
        const pending=job.queue.filter(needsWork);
        if(!pending.length) break; // every quota is filled

        const available=getBoxes().length; // live count, never cached here
        if(available<=0){
          blockJob('No visible unassigned leads.', 'The live no-admin pool is empty or the report has not finished loading.');
          return;
        }

        // Pick the next rep: forward from idx, then wrap. The previous version
        // skipped a rep whenever it matched lastId, with no check that another
        // candidate existed — when the last unfinished rep was also lastId the
        // loop wrapped forever and locked up the page.
        const order=[];
        for(let i=job.idx;i<job.queue.length;i++) order.push(i);
        for(let i=0;i<Math.min(job.idx,job.queue.length);i++) order.push(i);
        const otherAvailable=pending.some(q=>String(q.id)!==String(job.lastId));
        let chosen=-1;
        for(const i of order){
          const q=job.queue[i];
          if(!needsWork(q)) continue;
          // Avoid two consecutive batches for the same rep, but only when
          // somebody else can actually take this turn.
          if(otherAvailable && job.lastId && String(q.id)===String(job.lastId)) continue;
          chosen=i; break;
        }
        if(chosen<0) break; // nothing left that we are allowed to assign

        job.idx=chosen;
        save(LS.JOB,job);

        const node=job.queue[chosen];
        // Original behaviour, unchanged: each rep gets its full quota in one
        // batch. perRep is fixed at start (floor(visible/reps) or the manual
        // "Leads per rep" value), so 100 leads across 10 reps stays 10 each.
        const take=Math.min(node.remaining, available);
        if(take<=0){ node.remaining=0; save(LS.JOB,job); continue; }

        clearChecks();
        let picked=job.randomMode ? pickRandom(take) : pickBottom(take);

        // The pool is measured, then the checkboxes are ticked. If Infinity
        // repaints the table in between, fewer boxes than requested come back.
        // The old code submitted the short batch anyway, which silently left
        // the rep one or two leads short and forced an extra round. Recount
        // once against the live DOM instead of submitting a partial batch.
        if(picked.length<take){
          clearChecks();
          await sleep(600);
          invalidateDomCache();
          const liveAvailable=getBoxes().length;
          const retryTake=Math.min(node.remaining,liveAvailable);
          picked=job.randomMode ? pickRandom(retryTake) : pickBottom(retryTake);
          if(picked.length<retryTake || !picked.length){
            clearChecks();
            blockJob(
              'The lead list changed while leads were being selected.',
              `Needed ${take} lead(s) for ${repName(job,node.id)}, but only ${picked.length} could be selected. Nothing was submitted. Reload the Pending report and press Resume.`
            );
            return;
          }
        }
        if(!picked.length){ blockJob('No selectable visible leads found.'); return; }
        picked.forEach(cb=>cb.checked=true);

        if(!setAssignAdmin(node.id)){
          blockJob('Processing Admin dropdown not found or representative could not be selected.'); return;
        }
        // Give the report's own change handlers a moment to settle, then
        // re-read the dropdown before submitting. Without this, a same-tick
        // click could go out while the underlying app still has the
        // *previous* admin selected, silently assigning this batch to the
        // wrong rep even though our own JS property looked correct.
        await sleep(200);
        const ddCheck=getAssignDD();
        if(!ddCheck || String(ddCheck.value)!==String(node.id)){
          clearChecks();
          blockJob(
            'The Processing Admin selection did not hold before Update.',
            `Expected admin id ${node.id} (${repName(job,node.id)}) but the dropdown shows "${ddCheck?String(ddCheck.value):'(missing)'}" right before submit. Nothing was submitted — reload and press Resume.`
          );
          return;
        }

        const selectedIds=picked.map(getBoxKey).filter(Boolean);
        const pendingStep={
          stepId:'step-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
          id:node.id,
          expected:picked.length,
          beforeCount:available,
          selectedIds,
          ts:Date.now(),
          verification:'submitted',
          submitPageId:PAGE_ID
        };
        save(LS.STEP,pendingStep); job.pendingStep=pendingStep; job.lastEngineActivity=Date.now(); save(LS.JOB,job);
        logEvent('submit',`${repName(job,node.id)}: ${picked.length} lead(s), pool ${available}, quota left ${node.remaining}`);
        sessionStorage.setItem(SS.NAV,'1');

        const btn=getUpdateBtn();
        if(!btn){
          sessionStorage.removeItem(SS.NAV);
          localStorage.removeItem(LS.STEP); delete job.pendingStep; save(LS.JOB,job);
          blockJob('Update button not found. Nothing was submitted.'); return;
        }
        btn.click();
        // A normal full POST destroys this document. If Infinity instead uses
        // a same-page/partial refresh, the controller verifies it after a safe
        // grace period and continues without user intervention.
        return;
      }

      // Finish: summary modal
      if(job){
        const details       = getAssignedDetails(job);
        const assignedNames = details.map(x=>x.name);
        const skippedNames  = getSkippedNames(job);
        const totalDone     = getAssignedTotal(job);
        const currentVisible = getBoxes().length;

         save(LS.RES,{group:job.group,assignedNames,skippedNames,perRep:job.perRep,assignedDetails:details,totalDone});
        clearJobState();
        hideProgress();

        showSummaryModal({
          title:'Assigning completed',
          perRep:job.perRep,
          reps:job.queue.length,
          totalPlanned:job.totalAssign,
          totalAssigned:totalDone,
           currentVisible,
          randomMode:!!job.randomMode,
          assignedDetails:details,
          skippedNames
        });
      }
    } finally { running=false; }
  }

  // ---------- bindings ----------
  function bindUI(){
    // refresh roster
    $('#sa-refresh').onclick = async ()=>{
      const btn=$('#sa-refresh');
      const originalLabel=btn.textContent;
      btn.disabled=true;
      // Visible feedback that the button is *working*, not just frozen — the
      // CSV fetch can legitimately take a few seconds.
      btn.textContent='Refreshing…';
      updateWarn();
      try{
        await ensureRepresentativeMaps(true,15000);
      } catch(err){
        logEvent('roster','refresh failed: '+(err?.message||err));
      } finally {
        rosterLoading=false;
        const b=$('#sa-refresh'); if(b){ b.disabled=false; b.textContent=originalLabel; }
        syncControls();
        updateWarn();
      }
    };

    $('#sa-use-cache').onclick = useLastWorkingRoster;

    // Random mode toggle
    $('#sa-random').onchange = ()=>{
      const enabled=$('#sa-random').checked;
      save(LS.RANDOM,enabled);
      $('#sa-random-text').textContent=enabled ? 'Random: ON' : 'Random: OFF';
    };

    // Job controls
    $('#sa-pause-job').onclick = pauseCurrentJob;
    $('#sa-resume-job').onclick = resumeCurrentJob;
    $('#sa-confirm-step').onclick = markPendingAssigned;
    $('#sa-retry-step').onclick = retryPendingStep;
    $('#sa-takeover-job').onclick = takeOverCurrentJob;
    $('#sa-stop-job').onclick = ()=> stopCurrentJob(true);
    $('#sa-copy-job').onclick = ()=> copyJobReport();

    // assign buttons (явное навешивание)
    $('#sa-day').onclick  = ()=> startJob('Day', roster.day);
    $('#sa-late').onclick = ()=> startJob('Late', roster.late);
    $('#sa-all').onclick  = ()=> startJob('Everyone', uniq([...(roster.day||[]), ...(roster.late||[])]));

    // exclusions input
    const inp=$('#sa-inp'); const add=$('#sa-add');
    const addCurrent=()=>{ const v=(inp.value||'').trim(); if(!v) return;
      const ok=Array.from($('#sa-dl').options).some(o=>o.value===v);
      if(!ok){ alert('Name is not in roster.'); return; } // важное предупреждение оставляем
      const d=new Set(load(LS.DRAFT,[])); d.add(v); save(LS.DRAFT,Array.from(d));
      draft=d; renderChips(); inp.value=''; };
    inp.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); addCurrent(); } };
    add.onclick= addCurrent;

    $('#sa-save').onclick = ()=>{
      const normed=Array.from(draft).map(norm);
      const ids=new Set(); for(const n of normed){ const id=name2id.get(n); if(id) ids.add(id); }
      savedIds=ids; savedN=new Set(normed.filter(n=>name2id.has(n)));
      save(LS.SAVED_IDS, Array.from(savedIds)); save(LS.SAVED_N, Array.from(savedN));
      renderChips(); // no alerts
    };
    $('#sa-clear').onclick = ()=>{
      draft.clear(); savedIds.clear(); savedN.clear();
      save(LS.DRAFT,[]); save(LS.SAVED_IDS,[]); save(LS.SAVED_N,[]);
      renderChips(); // no alerts
    };

    // Choose representatives input
    const chInp=$('#sa-choose-inp'); const chAdd=$('#sa-choose-add');
    const addChoose=()=>{ const v=(chInp.value||'').trim(); if(!v) return;
      const ok=Array.from($('#sa-choose-dl').options).some(o=>o.value===v);
      if(!ok){ alert('Name is not in roster.'); return; }
      const d=new Set(load(LS.CH_DRAFT,[])); d.add(v); save(LS.CH_DRAFT,Array.from(d));
      chDraft=d; renderChips(); chInp.value=''; };
    chInp.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); addChoose(); } };
    chAdd.onclick= addChoose;

    $('#sa-choose-save').onclick = ()=>{
      const normed=Array.from(chDraft).map(norm);
      const ids=[]; // silently drop excluded
      for(const n of normed){ const id=name2id.get(n); if(id && !savedIds.has(id)) ids.push(id); }
      chIds=new Set(ids);
      save(LS.CH_IDS, Array.from(chIds));
      renderChips(); // no alerts
    };
    $('#sa-choose-clear').onclick = ()=>{
      chDraft.clear(); chIds.clear();
      save(LS.CH_DRAFT,[]); save(LS.CH_IDS,[]);
      renderChips(); // no alerts
    };

    // Leads per rep Save/Reset (no alerts)
    $('#sa-lpr-save').onclick = ()=>{
      const raw = ($('#sa-lpr').value||'').trim();
      if (raw===''){ localStorage.removeItem(LS.LPR); $('#sa-lpr-saved').textContent='Saved: auto'; return; }
      const v = parseInt(raw,10);
      if (!Number.isFinite(v) || v<1) { alert('Leads per rep must be at least 1.'); return; }
      save(LS.LPR, v);
      $('#sa-lpr-saved').textContent='Saved: '+v;
    };
    $('#sa-lpr-reset').onclick = ()=>{
      $('#sa-lpr').value=''; localStorage.removeItem(LS.LPR);
      $('#sa-lpr-saved').textContent='Saved: auto';
    };
  }

  // ---------- boot ----------
  let warnTimer=0;

  // Single source of truth for the top-row controls. Driven by a timer, so a
  // hung network request can no longer leave the buttons disabled forever.
  function syncControls(){
    if(load(LS.JOB,null)) return; // an active job owns the buttons
    const noRoster=id2name.size===0;
    setAssignButtonsDisabled(noRoster, noRoster ? 'Representatives are not loaded yet. Click Refresh or wait a moment.' : '');
  }

  function updateWarn(){
    const warn=$('#sa-warn'); if(!warn) return;
    const offerRow=$('#sa-cache-offer-row');
    const offerText=$('#sa-cache-offer-text');
    if(startingJob) return;
    let text='', color='', showOffer=false;
    if(rosterLoading && id2name.size===0) text='Loading representatives…';
    else if(cacheOffer){
      // Live fetch failed or the sheet parsed to zero IDs (e.g. every
      // DayIDs/LateIDs cell is "#N/A"). Nothing is auto-applied: Exclude/
      // Choose/Assign all stay empty until the user explicitly opts into
      // the cached copy via the button below, or the sheet is fixed.
      text='⚠ Roster file is empty or missing data — no live representatives loaded. Fix the Google Sheet, or use the last working list below.';
      color='#f59e0b';
      const since=cacheOffer.ts ? new Date(cacheOffer.ts).toLocaleString() : 'an earlier load';
      const count=uniq([...(cacheOffer.day||[]),...(cacheOffer.late||[])]).length;
      if(offerText) offerText.textContent=`Cached list available from ${since} (${count} reps).`;
      showOffer=true;
    }
    else if(rosterStale){
      // The user explicitly chose to run on the cached list (via the button
      // above). This clears itself automatically the moment a fresh, valid
      // CSV load succeeds.
      const since=rosterStaleSince ? new Date(rosterStaleSince).toLocaleString() : 'an earlier load';
      text=`⚠ Using cached list from ${since} (chosen manually) — not live data.`;
      color='#f59e0b';
    }
    else if(!topIsNoAdmin()) text='Set Processing Admin = "-- no admin --"';
    else if(!load(LS.JOB,null) && id2name.size===0) text='Representatives are not loaded. Click Refresh.';
    if(warn.textContent!==text) warn.textContent=text;
    if(warn.style.color!==color) warn.style.color=color;
    if(offerRow) offerRow.style.display=showOffer ? '' : 'none';
    syncControls();
  }

  let booted=false;
  async function boot(){
    if(booted) return;
    booted=true;
    injectCSS(); buildPanel(); bindUI(); renderChips();

    // The warning/button poll starts before anything is awaited. Previously the
    // buttons were only re-enabled on the line after `await rosterPromise`, so
    // a slow or hung CSV request left them disabled forever.
    // A MutationObserver on document.body/subtree used to drive this. Writing
    // the warning text is itself a mutation, so the observer re-triggered
    // itself in a tight loop and each pass rescanned every <select> on the
    // report. A slow poll that only writes on change is enough here.
    clearInterval(warnTimer);
    warnTimer=setInterval(updateWarn,1500);

    // Render a saved job immediately. Recovery must not wait for the roster CSV.
    let job=load(LS.JOB,null);
    if(job) updateProgress(job);
    else { hideProgress(); setAssignButtonsDisabled(true,'Loading representatives…'); }
    updateWarn();

    // Fire and forget: the roster load must never gate the rest of boot.
    // No cache is ever applied automatically here — only a genuine live
    // fetch populates the roster. If it fails or parses to zero IDs,
    // Exclude/Choose/Assign correctly stay empty and updateWarn() surfaces
    // the "Use last working list" button instead of silently substituting
    // stale data.
    ensureRepresentativeMaps(true,15000).then(()=>{
      const current=load(LS.JOB,null);
      if(current) updateProgress(current);
      updateWarn();
    }).catch(()=>{ rosterLoading=false; updateWarn(); });

    job=load(LS.JOB,null);
    if(!job){
      hideProgress();
      updateWarn();
      return;
    }

    // Safe migration for a 2.1 job: only the tab carrying its old token may own it.
    if(!job.ownerTabId && job.token && sessionStorage.getItem(SS.TOKEN)===job.token){
      job.ownerTabId=TAB_ID; job.ownerHeartbeat=Date.now(); save(LS.JOB,job);
    }
    updateProgress(job);
    if(!isOwner(job)) return; // read-only: never clear or run another tab's job

    const step=getPendingStep(job);
    if(step){
      // At document-start the Auto Assign panel is already visible, but the LMS
      // report controls may still be loading. Never classify that brief state
      // as a failed Update.
      const ready=await waitReady(15000);
      if(!ready){
        blockJob('The LMS did not load the normal Pending controls.', 'The assignment is saved. Open a clean Pending page and use Recovery; the last Update will not be repeated automatically.');
        return;
      }
      reconciledOnThisPage.add(String(step.stepId||step.ts||'')+'@'+PAGE_ID);
      invalidateDomCache();
      const result=reconcilePendingStep(job);
      job=load(LS.JOB,null);
      if(job) updateProgress(job);
      if(result==='confirmed'){
        markCurrentPageAsCleanGet();
        scheduleRun(100);
      }
      return;
    }
    if(job.status==='running') scheduleRun(50);
  }

  let controllerBusy=false;
  const reconciledOnThisPage=new Set();
  setInterval(()=>{
    restorePanelIfNeeded();
    const job=load(LS.JOB,null);
    if(!job){ return; }
    if(isOwner(job)){
      job.ownerHeartbeat=Date.now(); save(LS.JOB,job);
    }
    updateProgress(job);

    // Persistent controller: a running job is never left idle merely because
    // a page lifecycle event or an Infinity partial refresh was missed.
    if(!job || !isOwner(job) || controllerBusy) return;
    const step=getPendingStep(job);
    if(step){
      // Once a step has been verified in this document and the answer was
      // "blocked", the user has to decide. Re-running reconcile every 3s
      // rescanned the whole report table forever and was the main reason a
      // recovered page became unresponsive.
      const stepKey=String(step.stepId||step.ts||'')+'@'+PAGE_ID;
      if(reconciledOnThisPage.has(stepKey)) return;
      const isNewDocument=String(step.submitPageId||'')!==PAGE_ID;
      const samePageTimedOut=Date.now()-Number(step.ts||0)>=SAME_PAGE_VERIFY_MS;
      if((isNewDocument||samePageTimedOut) && document.readyState!=='loading' && getAssignDD() && getUpdateBtn()){
        controllerBusy=true;
        reconciledOnThisPage.add(stepKey);
        try{
          invalidateDomCache();
          const result=reconcilePendingStep(job);
          const fresh=load(LS.JOB,null);
          if(fresh) updateProgress(fresh);
          if(result==='confirmed'){
            markCurrentPageAsCleanGet();
            scheduleRun(100);
          }
        } finally { controllerBusy=false; }
      }
      return;
    }
    if(job.status==='running' && !running) scheduleRun(50);
  },HEARTBEAT_MS);

  window.addEventListener('storage',(e)=>{
    if(e.key!==LS.JOB && e.key!==LS.STEP) return;
    const job=load(LS.JOB,null);
    if(job) updateProgress(job); else hideProgress();
  });
  function startBoot(){
    if(document.body){ boot(); return; }
    const root=document.documentElement;
    if(!root){ document.addEventListener('DOMContentLoaded',boot,{once:true}); return; }
    const bodyObserver=new MutationObserver(()=>{
      if(!document.body) return;
      bodyObserver.disconnect();
      boot();
    });
    bodyObserver.observe(root,{childList:true,subtree:true});
    document.addEventListener('DOMContentLoaded',()=>{
      bodyObserver.disconnect();
      if(!$('#sa')) boot();
    },{once:true});
  }
  startBoot();

///////////////////////////////////


//////////////////////////////////////// paste before this
  });





  
  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: tbwAssistant
  // Original source: tbw_assistant.js
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('tbwAssistant')) runScript('tbwAssistant', function () {
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
    if (/unacc\w*\s+state/i.test(lower)) {
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
        UNACCEPTABLE_STATE: /unacc\w*\s+state/i
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
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: tbwTlHelper
  // Original source: tbw_tl_helper.js
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('tbwTlHelper')) runScript('tbwTlHelper', function () {
const TL_LIST = [
    "Tom Harris",
    "Veronica Lodge",
    "Paul Caffrey",
    "Ben Jameson",
    "Desa Solingan",
    "Benjamin Alla",
    "John Lim",
    "Monica Smith"
  ];

  const TL_STORAGE_KEY = "cc_selected_tl";
  const TL_SELECT_ID   = "tm_tl_selector";
  const TL_SELECT_BTN  = "tm_tl_select_btn";

  const REMARK_TEXT = "T&C Read and Agreed";

  const EMAIL_ESIG_MATCHERS = ["esig", "additional", "do not edit"];
  const TXT_ESIG_MATCHERS   = ["esig", "additional", "do not edit"];

  const BTN_ID_REMOVE = "tm_tl_remove_tbw";
  const BTN_ID_ESIG   = "tm_tl_send_esig";
  const CONTAINER_MARK = "tm_tbw_container_mark_v1";

  const sleep = _sleep;
  const norm  = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  const isVisible = (el) => !!el && (el.getClientRects?.().length || el.offsetParent !== null);

  function fireChange(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitFor(fn, { timeout = 20000, interval = 120 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const val = fn();
      if (val) return val;
      await sleep(interval);
    }
    return null;
  }

  function includesAll(haystack, needles) {
    const h = norm(haystack);
    return needles.every(n => h.includes(norm(n)));
  }

  // ===== DOCS-STYLE TOAST =====
  function toast(message, isErr = false) {
    let box = document.getElementById("ccToast_tbwHelper");
    if (!box) {
      box = document.createElement("div");
     box.id = "ccToast_tbwHelper";
      box.style.position = "fixed";
      box.style.bottom = "20px";
      box.style.right = "20px";
      box.style.zIndex = "999999";
      document.body.appendChild(box);
    }

    const t = document.createElement("div");
    t.textContent = message;
    t.style.background = isErr ? "#dc2626" : "#16a34a";
    t.style.color = "#fff";
    t.style.padding = "10px 14px";
    t.style.marginTop = "8px";
    t.style.borderRadius = "8px";
    t.style.fontFamily = "Arial";
    t.style.fontSize = "12px";
    t.style.boxShadow = "0 10px 20px rgba(0,0,0,.4)";
    box.appendChild(t);

    setTimeout(() => t.remove(), 3500);
  }

  // ===== MODAL CLOSE (auto-close OK confirmations) =====
  function closeLMSModals() {
    try {
      document.querySelectorAll("#modalWindow .closeBtn.modal-link").forEach((b) => b.click());
      document.querySelectorAll("#modalWindow a[data-value='ok']").forEach((b) => b.click());
      document.querySelectorAll("#modalWindow").forEach((m) => m.remove());
      document.querySelectorAll("#sendingFrame").forEach((f) => f.remove());

      // BE popup container often:
      document.querySelectorAll("#iframewindow .window-close, #iframewindow .window-titlebar img").forEach((x) => {
        try { x.click(); } catch {}
      });

      document.body.style.overflow = "";
    } catch {}
  }

  async function autoCloseDuringSend(maxMs = 6500) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      closeLMSModals();
      const hasModal = !!document.querySelector("#modalWindow") || !!document.querySelector("#sendingFrame");
      if (!hasModal) return;
      await sleep(250);
    }
    closeLMSModals();
  }

  function pageShowsContactDisabled() {
    return (document.body.innerText || "").toLowerCase().includes("contact method disabled");
  }

  function isOptionDisabledLike(opt) {
    if (!opt) return false;
    const t = (opt.textContent || "").toLowerCase();
    return !!opt.disabled || t.includes("(disabled)") || t.includes(" disabled");
  }

  function getTargetAdminName() {
    const saved = localStorage.getItem(TL_STORAGE_KEY);
    if (saved) return saved;

    const v = (window.adminname || "").toString().trim();
    return v ? v : FALLBACK_ADMIN;
  }

  function getDocsToScan() {
    const docs = [document];
    const iframes = [...document.querySelectorAll("iframe")].filter(isVisible);
    for (const fr of iframes) {
      try {
        const d = fr.contentDocument;
        if (d && d.documentElement) docs.push(d);
      } catch (_) {}
    }
    return docs;
  }

  function findButtonByText(root, txt) {
    const want = norm(txt);

    const IGNORE_IDS = new Set([
      "ccUpdateDC_UI13",
      "ccCreatePIFPP_UI13",
      "ccSendPIFDocs_UI13",
      "ccWrap_UI13"
    ]);

    const btns = [...root.querySelectorAll("input, button, a")]
      .filter(isVisible)
      .filter(b => !b.closest("#ccWrap_UI13"))
      .filter(b => !IGNORE_IDS.has(b.id));

    return (
      btns.find(b => norm(b.value || b.textContent) === want) ||
      btns.find(b => norm(b.value || b.textContent).includes(want)) ||
      null
    );
  }

  function findCheckboxByLabel(root, labelText) {
    const wanted = norm(labelText);

    for (const lbl of [...root.querySelectorAll("label")]) {
      const lt = norm(lbl.textContent);
      if (lt === wanted || lt.includes(wanted)) {
        const inside = lbl.querySelector('input[type="checkbox"]');
        if (inside) return inside;

        const forId = lbl.getAttribute("for");
        if (forId) {
          const byFor = root.querySelector(`#${CSS.escape(forId)}`);
          if (byFor && byFor.type === "checkbox") return byFor;
        }

        const prev = lbl.previousElementSibling;
        if (prev && prev.tagName === "INPUT" && prev.type === "checkbox") return prev;
      }
    }

    for (const cb of [...root.querySelectorAll('input[type="checkbox"]')]) {
      const row = cb.closest("tr") || cb.closest("div") || cb.parentElement;
      if (row && norm(row.textContent).includes(wanted)) return cb;
    }
    return null;
  }

  // ---------------------------
  // Strong anti-freeze (overlay / updateprogress)
  // ---------------------------
  function isFullscreenLike(el) {
    try {
      const r = el.getBoundingClientRect();
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      return r.width >= vw * 0.7 && r.height >= vh * 0.5;
    } catch {
      return false;
    }
  }

  function isBlocking(el) {
    if (!el) return false;
    let st;
    try { st = getComputedStyle(el); } catch { return false; }
    if (!st) return false;

    const pe = st.pointerEvents || "auto";
    const displayOk = st.display !== "none";
    const visOk = st.visibility !== "hidden";
    const positioned = (st.position === "fixed" || st.position === "absolute");
    const z = parseInt(st.zIndex || "0", 10);
    const fullscreen = isFullscreenLike(el);

    return displayOk && visOk && positioned && fullscreen && pe !== "none" && (z >= 0);
  }

  function findBlockingOverlays() {
    const selectors = [
      '[id*="UpdateProgress"]',
      '[id*="ModalBackground"]',
      ".modalBackground",
      ".ui-widget-overlay",
      ".ui-dialog-overlay",
      ".ajax__loading",
      ".blockUI",
      ".blockOverlay",
      ".blockMsg",
      ".loading",
      ".spinner"
    ];

    const explicit = [...document.querySelectorAll(selectors.join(","))].filter(isVisible);

    const generic = [...document.querySelectorAll("div, span", "section")]
      .filter(isVisible)
      .slice(0, 1400)
      .filter(isBlocking);

    return [...new Set([...explicit, ...generic])];
  }

  async function waitForUiIdle({ timeout = 12000, interval = 150 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const blockers = findBlockingOverlays();
      if (blockers.length === 0) return true;
      await sleep(interval);
    }
    return false;
  }

  function unfreezeSoft() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));

    for (const el of findBlockingOverlays()) {
      try { el.style.pointerEvents = "none"; } catch {}
    }
  }

  function unfreezeHard() {
    try { document.documentElement.style.pointerEvents = "auto"; } catch {}
    try { document.body.style.pointerEvents = "auto"; } catch {}

    for (const el of findBlockingOverlays()) {
      try {
        el.style.pointerEvents = "none";
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      } catch {}
    }

    try { document.body.style.cursor = "default"; } catch {}
    try { document.documentElement.style.cursor = "default"; } catch {}
  }

  async function watchdogStep(label, fn, { idleTimeout = 12000, hardReloadAfterFail = true } = {}) {
    await fn();

    if (await waitForUiIdle({ timeout: idleTimeout })) return;

    console.warn(`[TBW Helper] UI stuck after: ${label}. soft unfreeze...`);
    unfreezeSoft();
    if (await waitForUiIdle({ timeout: 4000 })) return;

    console.warn(`[TBW Helper] Still stuck after: ${label}. hard unfreeze...`);
    unfreezeHard();
    if (await waitForUiIdle({ timeout: 4000 })) return;

    if (hardReloadAfterFail) {
      console.warn(`[TBW Helper] Still stuck after: ${label}. Reloading...`);
      setTimeout(() => location.reload(), 250);
    }
  }

  // ---------------------------
  // Find Dialer (top-right cluster)
  // ---------------------------
  function findBtnInLoanHeader(keyword) {
    const candidates = [...document.querySelectorAll("a,button,input")]
      .filter(isVisible)
      .filter(el => norm(el.value || el.textContent).includes(norm(keyword)));

    if (!candidates.length) return null;

    const score = (el) => {
      let s = 0;
      let node = el;
      for (let i = 0; i < 7 && node; i++) {
        node = node.parentElement;
        if (!node) break;
        const t = norm(node.textContent || "");
        if (t.includes("files")) s += 3;
        if (t.includes("notes")) s += 3;
        if (t.includes("history") && t.includes("watch") && t.includes("pdf")) s -= 10;
      }
      return s;
    };

    candidates.sort((a, b) => score(b) - score(a));
    return candidates[0] || null;
  }

  const findDialer = () => findBtnInLoanHeader("dialer");

  // ---------------------------
  // Template (standard blue buttons)
  // ---------------------------
  function findStandardBlueTemplate() {
    const preferred = ["Change pending loan details", "Approve", "Deny", "Withdraw", "Max Exposure"];
    for (const label of preferred) {
      const el = [...document.querySelectorAll("a,button,input")]
        .filter(isVisible)
        .find(x => norm(x.value || x.textContent) === norm(label));
      if (el) return el;
    }
    return null;
  }

  function cleanupButtons() {
    for (const id of [BTN_ID_REMOVE, BTN_ID_ESIG]) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }

  function attachReliableClick(el, handler) {
    const run = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      handler();
      return false;
    };
    el.addEventListener("pointerdown", run, true);
    el.addEventListener("click", run, true);
    el.style.cursor = "pointer";
    el.style.pointerEvents = "auto";
  }

  function setTemplateButtonText(btn, text) {
    const spans = [...btn.querySelectorAll("span")];
    if (spans.length) spans[spans.length - 1].textContent = text;
    else if ("value" in btn && btn.tagName === "INPUT") btn.value = text;
    else btn.textContent = text;
  }

  function cloneStandardTemplate(templateEl) {
    const btn = templateEl.cloneNode(true);
    btn.removeAttribute("onclick");
    btn.removeAttribute("onmousedown");
    btn.removeAttribute("onmouseup");
    btn.removeAttribute("onkeydown");
    btn.removeAttribute("onkeypress");
    btn.removeAttribute("onkeyup");
    if (btn.tagName === "A") btn.href = "#";
    return btn;
  }

  function makeStandardButton(templateEl, text, id, onClick) {
    const btn = cloneStandardTemplate(templateEl);
    btn.id = id;
    setTemplateButtonText(btn, text);
    attachReliableClick(btn, onClick);
    return btn;
  }

  function applyMinimalContainerFlex(container) {
    if (!container) return;
    if (container.dataset[CONTAINER_MARK] === "1") return;
    container.dataset[CONTAINER_MARK] = "1";

    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "flex-end";
  }

  function ensureButtonsPlaced() {
    if (document.getElementById(TL_SELECT_ID) &&
        document.getElementById(TL_SELECT_BTN)) {
      const dialer = findDialer();
      if (!dialer) return;

      const container = dialer.parentElement;
      const select = document.getElementById(TL_SELECT_ID);
      const selectBtn = document.getElementById(TL_SELECT_BTN);

      if (select && select.nextSibling !== selectBtn) {
        container.insertBefore(selectBtn, dialer);
        container.insertBefore(select, selectBtn);
      }

      return;
    }

    const dialer = findDialer();
    if (!dialer || !dialer.parentElement) return false;

    const container = dialer.parentElement;
    const template = findStandardBlueTemplate() || dialer;

    let tlSelect = document.getElementById(TL_SELECT_ID);
    let tlSelectBtn = document.getElementById(TL_SELECT_BTN);

    if (!tlSelect) {
      tlSelect = document.createElement("select");
      tlSelect.id = TL_SELECT_ID;

      TL_LIST.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        tlSelect.appendChild(opt);
      });

      const saved = localStorage.getItem(TL_STORAGE_KEY);
      if (saved) tlSelect.value = saved;

      const ds = getComputedStyle(dialer);
      tlSelect.style.cssFloat = ds.float;
      tlSelect.style.marginTop = ds.marginTop;
      tlSelect.style.marginRight = "6px";
      tlSelect.style.verticalAlign = ds.verticalAlign;
      tlSelect.style.height = ds.height;
      tlSelect.style.fontSize = "12px";
    }

    if (!tlSelectBtn) {
      tlSelectBtn = makeStandardButton(
        template,
        "Select",
        TL_SELECT_BTN,
        () => {
          const selected = tlSelect.value;
          localStorage.setItem(TL_STORAGE_KEY, selected);
          showTLToast("Team Leader Selected: " + selected);
        }
      );

      const ds = getComputedStyle(dialer);
      tlSelectBtn.style.cssFloat = ds.float;
      tlSelectBtn.style.marginTop = ds.marginTop;
      tlSelectBtn.style.marginRight = "6px";
      tlSelectBtn.style.verticalAlign = ds.verticalAlign;
    }

    let removeBtn = document.getElementById(BTN_ID_REMOVE);
    let esigBtn   = document.getElementById(BTN_ID_ESIG);

    if (!removeBtn) {
      removeBtn = makeStandardButton(
        template,
        "Remove TBW",
        BTN_ID_REMOVE,
        runRemoveTBWFlow
      );
    }

    if (!esigBtn) {
      esigBtn = makeStandardButton(
        template,
        "Send New Esig",
        BTN_ID_ESIG,
        runSendEsigFlow
      );
    }

    const ds = getComputedStyle(dialer);

    removeBtn.style.cssFloat = ds.float;
    esigBtn.style.cssFloat   = ds.float;

    removeBtn.style.marginTop = ds.marginTop;
    esigBtn.style.marginTop   = ds.marginTop;

    removeBtn.style.verticalAlign = ds.verticalAlign;
    esigBtn.style.verticalAlign   = ds.verticalAlign;

    removeBtn.style.marginRight = "6px";
    esigBtn.style.marginRight   = "6px";

    container.insertBefore(tlSelectBtn, dialer);
    container.insertBefore(tlSelect, tlSelectBtn);

    container.insertBefore(esigBtn, dialer);
    container.insertBefore(removeBtn, esigBtn);

    return true;
  }

  // ---------------------------
  // Remove TBW flow
  // ---------------------------
  function findProcessingAdminLink() {
    return (
      document.querySelector("#ctl00_LoansRepeater_ProcessingAdminLink_0") ||
      document.querySelector('a[href*="editprocessingadmin("], a[onclick*="editprocessingadmin("]') ||
      null
    );
  }

  function findProcessingAdminControlsInDoc(doc) {
    const target = norm(getTargetAdminName());
    const selects = [...doc.querySelectorAll("select")].filter(isVisible);
    const candidates = [];

    for (const sel of selects) {
      const opts = [...sel.options].map(o => o.textContent || "");
      const hasSelectAdmin = opts.some(t => norm(t).includes("select admin"));
      const hasTarget = opts.some(t => norm(t).includes(target));
      if (!hasSelectAdmin && !hasTarget) continue;

      let root = sel.closest(".Window, .window, .ui-dialog, .popup, .modal, form, table, div") || sel.parentElement;
      let upd = root ? findButtonByText(root, "Update") : null;

      let climb = root;
      for (let i = 0; i < 10 && climb && !upd; i++) {
        climb = climb.parentElement;
        if (climb) upd = findButtonByText(climb, "Update");
        if (upd) root = climb;
      }

      if (root && upd) candidates.push({ sel, upd, hasTarget, optCount: opts.length });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => (b.hasTarget - a.hasTarget) || (b.optCount - a.optCount));
    return candidates[0];
  }

  function findProcessingAdminControls() {
    for (const doc of getDocsToScan()) {
      const found = findProcessingAdminControlsInDoc(doc);
      if (found) return found;
    }
    return null;
  }

  async function setProcessingAdminToMe() {
    const targetName = getTargetAdminName();

    const link = findProcessingAdminLink();
    if (!link) throw new Error("Processing Admin link not found");
    link.click();

    const controls = await waitFor(() => findProcessingAdminControls(), { timeout: 20000 });
    if (!controls) throw new Error("Processing Admin popup not detected");

    const opt = [...controls.sel.options].find(o => norm(o.textContent).includes(norm(targetName)));
    if (!opt) throw new Error(`Admin "${targetName}" not found in dropdown`);

    controls.sel.value = opt.value;
    fireChange(controls.sel);
    controls.upd.click();

    await sleep(350);
  }

  function findStatusLink() {
    return (
      document.querySelector("#ctl00_LoansRepeater_LoanStatusLink_0") ||
      document.querySelector('a[href*="editstatus("], a[onclick*="editstatus("]') ||
      null
    );
  }

  function findPopupByContainsAndUpdate(containsText) {
    const c = norm(containsText);
    for (const doc of getDocsToScan()) {
      const roots = [...doc.querySelectorAll("div, form, section, table")]
        .filter(isVisible)
        .filter(el => norm(el.textContent).includes(c))
        .filter(el => findButtonByText(el, "Update"));
      roots.sort((a, b) => a.textContent.length - b.textContent.length);
      if (roots[0]) return roots[0];
    }
    return null;
  }

  async function removeStatusesTBWandNeverAnswered() {
    const link = findStatusLink();
    if (!link) throw new Error("Status link not found");
    link.click();

    const popup = await waitFor(
      () => findPopupByContainsAndUpdate("loan status") || findPopupByContainsAndUpdate("tbw"),
      { timeout: 20000 }
    );
    if (!popup) throw new Error("Loan Status popup not detected");

    const tbw = findCheckboxByLabel(popup, "TBW");
    if (tbw && tbw.checked) { tbw.checked = false; fireChange(tbw); }

    const na = findCheckboxByLabel(popup, "Never Answered");
    if (na && na.checked) { na.checked = false; fireChange(na); }

    const upd = findButtonByText(popup, "Update");
    if (!upd) throw new Error('Loan Status: "Update" not found');
    upd.click();

    await sleep(350);
  }

  function findRemarksLink() {
    return (
      document.querySelector("#ctl00_LoansRepeater_RemarksLink_0") ||
      document.querySelector('a[href^="javascript:remarks("]') ||
      null
    );
  }

  async function addLoanRemarkTCread() {
    const link = findRemarksLink();
    if (!link) throw new Error("Loan Remarks link not found");
    link.click();

    const popup = await waitFor(
      () => findPopupByContainsAndUpdate("loan remarks") || findPopupByContainsAndUpdate(REMARK_TEXT),
      { timeout: 20000 }
    );
    if (!popup) throw new Error("Loan Remarks popup not detected");

    const cb = findCheckboxByLabel(popup, REMARK_TEXT);
    if (!cb) throw new Error(`Remark checkbox not found: "${REMARK_TEXT}"`);

    if (!cb.checked) { cb.checked = true; fireChange(cb); }

    const upd = findButtonByText(popup, "Update");
    if (!upd) throw new Error('Loan Remarks: "Update" not found');
    upd.click();

    await sleep(350);
  }

  // ---------------------------
  // Send Esig flow
  // ---------------------------
  function findLettersControls() {
    return {
      actionSel: document.querySelector("#ctl00_LoansRepeater_LetterAction_0"),
      emailSel:  document.querySelector("#ctl00_LoansRepeater_Letter_ForEmail_0"),
      textSel:   document.querySelector("#ctl00_LoansRepeater_Letter_ForTextMessage_0"),
      sendBtn:   document.querySelector("#ctl00_LoansRepeater_Btn_DoLetterActionSend_0"),
    };
  }

  async function sendEsigEmailThenText() {
    const c = findLettersControls();
    if (!c.actionSel || !c.emailSel || !c.sendBtn) {
      throw new Error("Letters controls not found");
    }

    // EMAIL
    try {
      if (pageShowsContactDisabled()) {
        throw new Error("Contact method disabled");
      }

      const emailActionOpt = [...c.actionSel.options].find(o => norm(o.textContent).includes("send email"));
      if (!emailActionOpt) throw new Error('Letters action "Send Email" not found');

      c.actionSel.value = emailActionOpt.value;
      fireChange(c.actionSel);
      await sleep(250);

      const emailOpt = [...c.emailSel.options].find(o => includesAll(o.textContent, EMAIL_ESIG_MATCHERS));
      if (!emailOpt) throw new Error("Email Esig template not found");
      if (isOptionDisabledLike(emailOpt)) throw new Error("Contact method disabled");

      c.emailSel.value = emailOpt.value;
      fireChange(c.emailSel);
      await sleep(200);

      c.sendBtn.click();
      await sleep(200);
      await autoCloseDuringSend(6500);

      if (pageShowsContactDisabled()) {
        closeLMSModals();
        throw new Error("Contact method disabled");
      }

      toast("Email sent");
    } catch (e) {
      const msg = (e && e.message ? e.message : "").toLowerCase();
      if (msg.includes("disabled") || msg.includes("cannot") || msg.includes("not allowed")) {
        toast("Email disabled", true);
      } else {
        toast("Email send failed", true);
      }
    }

    await sleep(900);

    // TEXT
    try {
      const c2 = findLettersControls();
      if (!c2 || !c2.actionSel || !c2.textSel || !c2.sendBtn) {
        throw new Error("Letters controls not found");
      }

      if (pageShowsContactDisabled()) {
        throw new Error("Contact method disabled");
      }

      if (c2.textSel.disabled) {
        throw new Error("Contact method disabled");
      }

      const txtActionOpt = [...c2.actionSel.options].find(o => norm(o.textContent).includes("send text message"));
      if (!txtActionOpt) throw new Error('Letters action "Send Text Message" not found');

      c2.actionSel.value = txtActionOpt.value;
      fireChange(c2.actionSel);
      await sleep(250);

      const txtOpt = [...c2.textSel.options].find(o => includesAll(o.textContent, TXT_ESIG_MATCHERS));
      if (!txtOpt) throw new Error("Text Esig template not found");
      if (isOptionDisabledLike(txtOpt)) throw new Error("Contact method disabled");

      c2.textSel.value = txtOpt.value;
      fireChange(c2.textSel);
      await sleep(200);

      c2.sendBtn.click();
      await sleep(200);
      await autoCloseDuringSend(6500);

      if (pageShowsContactDisabled()) {
        closeLMSModals();
        throw new Error("Contact method disabled");
      }

      toast("Text sent");
    } catch (e) {
      const msg = (e && e.message ? e.message : "").toLowerCase();
      if (msg.includes("disabled") || msg.includes("cannot") || msg.includes("not allowed") || msg.includes("failed")) {
        toast("Text disabled", true);
      } else {
        toast("Text send failed", true);
      }
    }

    await sleep(250);
  }

  // ---------------------------
  // Button handlers (with strong final unfreeze)
  // ---------------------------
  let runningRemove = false;
  async function runRemoveTBWFlow() {
    if (runningRemove) return;
    runningRemove = true;

    const btn = document.getElementById(BTN_ID_REMOVE);
    if (btn) btn.style.opacity = "0.7";

    try {
      await watchdogStep("Set Processing Admin", async () => { await setProcessingAdminToMe(); });
      await watchdogStep("Remove TBW / Never Answered", async () => { await removeStatusesTBWandNeverAnswered(); });
      await watchdogStep("Add Loan Remark", async () => { await addLoanRemarkTCread(); });

      await watchdogStep("Final UI cleanup", async () => {
        await sleep(350);
        unfreezeHard();
        await sleep(150);
      }, { idleTimeout: 5000, hardReloadAfterFail: true });

    } catch (e) {
      console.error(e);
    } finally {
      if (btn) btn.style.opacity = "";
      runningRemove = false;
    }
  }

  let runningEsig = false;
  async function runSendEsigFlow() {
    if (runningEsig) return;
    runningEsig = true;

    const btn = document.getElementById(BTN_ID_ESIG);
    if (btn) btn.style.opacity = "0.7";

    try {
      await watchdogStep(
        "Send Esig",
        async () => { await sendEsigEmailThenText(); },
        { idleTimeout: 15000, hardReloadAfterFail: false }
      );
    } catch (e) {
      console.error(e);
      toast("E-Sign send failed", true);
    } finally {
      if (btn) btn.style.opacity = "";
      runningEsig = false;
    }
  }

  // your center toast (kept as-is)
  function showTLToast(message) {
    const old = document.getElementById("cc_tl_toast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "cc_tl_toast";
    toast.textContent = message;

    toast.style.position = "fixed";
    toast.style.top = "50%";
    toast.style.left = "50%";
    toast.style.transform = "translate(-50%, -50%)";
    toast.style.background = "#2e7d32";
    toast.style.color = "#fff";
    toast.style.padding = "8px 16px";
    toast.style.borderRadius = "6px";
    toast.style.fontSize = "15px";
    toast.style.fontWeight = "300";
    toast.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)";
    toast.style.zIndex = "999999";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function isPendingStatus() {
    const statusRow = [...document.querySelectorAll("td,div,span")]
      .find(el =>
        el.textContent &&
        el.textContent.trim().toLowerCase().startsWith("status")
      );

    if (!statusRow) return false;

    const fullText = statusRow.parentElement
      ? statusRow.parentElement.textContent.toLowerCase()
      : statusRow.textContent.toLowerCase();

    return fullText.includes("pending");
  }

  // ---------------------------
  // Bootstrap
  // ---------------------------
  async function start() {
    await waitFor(() => findDialer(), { timeout: 30000 });
    ensureButtonsPlaced();

    let t = null;
    const obs = new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        ensureButtonsPlaced();
      }, 250);
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  function startScript() {
    if (!isPendingStatus()) {
      return;
    }
    start();
  }

  startScript();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // SCRIPT: pifDcHelper
  // Original source: pif_dc_helper.js
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldRun('pifDcHelper')) runScript('pifDcHelper', function () {

  const sleep = _sleep;

  // ===== IDS =====
  const BTN_IDS = {
    updatedc: 'ccUpdateDC_UI13',
    pifpp: 'ccCreatePIFPP_UI13',
    docs: 'ccSendPIFDocs_UI13',
    wrap: 'ccWrap_UI13',
  };

  // ===== THRESHOLDS (v13.7) =====
  const THRESH_HIGH = 3000;
  const THRESH_LOW = 40;

  // ===== STATE (per LOAN) =====
  function getLoanIdFromHeaderText() {
    const txt = document.body?.innerText || '';
    const m = txt.match(/LOAN#\s*(\d+)/i);
    return m ? m[1] : 'X';
  }
  const LOAN = getLoanIdFromHeaderText();

  function doneKey(btnId) {
    return `CC_DONE_${LOAN}_${btnId}`;
  }
  function setDone(btnId) {
    sessionStorage.setItem(doneKey(btnId), '1');
  }
  function clearDone(btnId) {
    sessionStorage.removeItem(doneKey(btnId));
  }
  function isDone(btnId) {
    return sessionStorage.getItem(doneKey(btnId)) === '1';
  }

  // ===== TOAST (STACK like alerts) =====
  function toast(msg, type = 'ok') {
   let box = document.getElementById('ccToast_pifDc');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ccToast_pifDc';
      box.style.position = 'fixed';
      box.style.bottom = '18px';
      box.style.right = '18px';
      box.style.zIndex = '2147483647';
      box.style.display = 'flex';
      box.style.flexDirection = 'column-reverse';
      box.style.alignItems = 'flex-end';
      box.style.pointerEvents = 'none';
      document.body.appendChild(box);
    }

    const t = document.createElement('div');
    const isErr = type === 'err';
    const isWarn = type === 'warn';
    t.textContent = msg;
    t.style.cssText =
      'padding:10px 14px;border-radius:8px;color:#fff;font-size:12px;' +
      (isErr ? 'background:#c62828;' : isWarn ? 'background:#ef6c00;' : 'background:#1b5e20;') +
      ';box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:520px;white-space:pre-line;' +
      'margin-top:8px;pointer-events:auto;';
    box.appendChild(t);

    setTimeout(() => {
      t.remove();
      if (!box.children.length) box.remove();
    }, 3600);
  }

  // ===== CSS (v13.7 + ResetX) =====
  const style = document.createElement('style');
  style.textContent = `
    .cc-ui13-done{
      background:#ef6c00 !important;
      border-color:#ef6c00 !important;
      color:#fff !important;
    }
    .cc-ui13-disabled{
      opacity:.65 !important;
      pointer-events:none !important;
    }
    .cc-reset-x{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:14px;height:14px;
      line-height:14px;
      border-radius:6px;
      font-size:11px;
      margin-left:-4px;
      cursor:pointer;
      background:#ddd;
      border:1px solid #bbb;
      color:#111;
      user-select:none;
    }
    .cc-reset-x:hover{ background:#ccc; }
  `;
  document.head.appendChild(style);

  function makeOrange(btn) {
    if (!btn) return;
    btn.classList.add('cc-ui13-done');
  }
  function removeOrange(btn) {
    if (!btn) return;
    btn.classList.remove('cc-ui13-done');
  }
  function applySavedState() {
    const b1 = document.getElementById(BTN_IDS.updatedc);
    const b2 = document.getElementById(BTN_IDS.pifpp);
    const b3 = document.getElementById(BTN_IDS.docs);
    if (isDone(BTN_IDS.updatedc)) makeOrange(b1); else removeOrange(b1);
    if (isDone(BTN_IDS.pifpp)) makeOrange(b2); else removeOrange(b2);
    if (isDone(BTN_IDS.docs)) makeOrange(b3); else removeOrange(b3);
  }

  // ===== STRICT CLICK ISOLATION =====
  let operationRunning = false;

  function hardStop(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    } catch {}
  }

  function lockButtons(lock) {
    operationRunning = lock;
    [BTN_IDS.updatedc, BTN_IDS.pifpp, BTN_IDS.docs].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = lock;
      if (lock) b.classList.add('cc-ui13-disabled');
      else b.classList.remove('cc-ui13-disabled');
    });
  }

  // =====================================================================
  // POPUP CLOSE
  // =====================================================================
  function closeLMSModals() {
    try {
      document.querySelectorAll('#modalWindow .closeBtn.modal-link').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow a[data-value="ok"]').forEach((b) => b.click());
      document.querySelectorAll('#modalWindow').forEach((m) => m.remove());
      document.querySelectorAll('#sendingFrame').forEach((f) => f.remove());
      document.body.style.overflow = '';
    } catch {}
  }

  async function autoCloseDuringSend(maxMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      closeLMSModals();
      const hasModal = !!document.querySelector('#modalWindow') || !!document.querySelector('#sendingFrame');
      if (!hasModal) return;
      await sleep(250);
    }
    closeLMSModals();
  }

  function pageShowsContactDisabled() {
    return (document.body.innerText || '').toLowerCase().includes('contact method disabled');
  }

  function isOptionDisabledLike(opt) {
    if (!opt) return false;
    const t = (opt.textContent || '').toLowerCase();
    return !!opt.disabled || t.includes('(disabled)') || t.includes(' disabled');
  }

  // ===== LETTER CONTROLS (v13.7) =====
  function getLetterIndex() {
    const actionSel = document.querySelector('select[id*="LoansRepeater_LetterAction_"]');
    if (!actionSel) return null;
    const m = actionSel.id.match(/_(\d+)$/);
    return m ? m[1] : null;
  }

  function byIdOrQuery(idExact, query) {
    return document.getElementById(idExact) || document.querySelector(query);
  }

  function findLetterControls() {
    const idx = getLetterIndex();
    if (idx == null) return null;

    const actionSel = byIdOrQuery(
      `ctl00_LoansRepeater_LetterAction_${idx}`,
      `select[id*="LoansRepeater_LetterAction_${idx}"]`
    );
    const sendBtn = byIdOrQuery(
      `ctl00_LoansRepeater_Btn_DoLetterActionSend_${idx}`,
      `input[id*="LoansRepeater_Btn_DoLetterActionSend_${idx}"]`
    );
    const selText = byIdOrQuery(
      `ctl00_LoansRepeater_Letter_ForTextMessage_${idx}`,
      `select[id*="LoansRepeater_Letter_ForTextMessage_${idx}"]`
    );
    const selEmail = byIdOrQuery(
      `ctl00_LoansRepeater_Letter_ForEmail_${idx}`,
      `select[id*="LoansRepeater_Letter_ForEmail_${idx}"]`
    );

    if (!actionSel || !sendBtn) return null;
    return { actionSel, sendBtn, selText, selEmail };
  }

  const lastSend = new Map();
  function allowSend(key, ms = 2500) {
    const now = Date.now();
    const prev = lastSend.get(key) || 0;
    if (now - prev < ms) return false;
    lastSend.set(key, now);
    return true;
  }

  async function sendLetter(actionType, templateContains) {
    const ctrls = findLetterControls();
    if (!ctrls) throw new Error('Letter controls not found');

    const key = `${LOAN}:${actionType}:${String(templateContains).toLowerCase()}`;
    if (!allowSend(key)) return;

    if (pageShowsContactDisabled()) {
      throw new Error('Contact method disabled');
    }

    ctrls.actionSel.value = actionType;
    ctrls.actionSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);

    const templateSel = actionType === 'textmessage' ? ctrls.selText : ctrls.selEmail;
    if (!templateSel) throw new Error('Template dropdown missing for ' + actionType);

    const opt = Array.from(templateSel.options || []).find((o) =>
      (o.textContent || '').toLowerCase().includes(String(templateContains).toLowerCase())
    );
    if (!opt) throw new Error('Template not found: ' + templateContains);

    if (isOptionDisabledLike(opt)) {
      throw new Error('Contact method disabled');
    }

    templateSel.value = opt.value;
    templateSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);

    ctrls.sendBtn.click();
    await sleep(200);
    await autoCloseDuringSend(6000);

    if (pageShowsContactDisabled()) {
      closeLMSModals();
      throw new Error('Contact method disabled');
    }
  }

  async function sendBothWithSeparateToasts(textContains, emailContains) {
    // EMAIL
    try {
      await sendLetter('send', emailContains);
      toast('Email sent');
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed')) {
        toast('Email disabled', 'err');
      } else {
        toast('Email send failed', 'err');
      }
    }

    await sleep(350);

    // TEXT
    try {
      await sendLetter('textmessage', textContains);
      toast('Text sent');
    } catch (e) {
      const msg = (e && e.message ? e.message : '').toLowerCase();
      if (msg.includes('disabled') || msg.includes('cannot') || msg.includes('not allowed') || msg.includes('failed')) {
        toast('Text disabled', 'err');
      } else {
        toast('Text send failed', 'err');
      }
    }

    await sleep(200);
  }

  // ===== BUSINESS HELPERS (v13.7) =====
  function getTotalDue() {
    const m = (document.body.innerText || '').match(/Total\s+Due\s*:\s*\$?\s*([\d,.]+)/i);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function nextBusinessDay(d) {
    const x = new Date(d);
    x.setDate(x.getDate() + 1);
    if (x.getDay() === 6) x.setDate(x.getDate() + 2);
    if (x.getDay() === 0) x.setDate(x.getDate() + 1);
    return x;
  }

  function formatDate(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  }

  // ===== ACTIONS =====
  async function handleUpdateDC() {
    if (operationRunning) return;
    lockButtons(true);
    try {
      await sendBothWithSeparateToasts('Debit Card Update Link', 'Debit Card Update Link');
      setDone(BTN_IDS.updatedc);
      makeOrange(document.getElementById(BTN_IDS.updatedc));
    } catch (e) {
      toast('Update DC error: ' + (e?.message || e), 'err');
    } finally {
      lockButtons(false);
      applySavedState();
    }
  }

  async function handleCreatePIFPP() {
    if (operationRunning) return;

    const total = getTotalDue();
    if (total == null) {
      toast('Total Due not found', 'err');
      return;
    }

    if (total > THRESH_HIGH || total < THRESH_LOW) {
      const ok = confirm(`Total Due is $${total.toFixed(2)}.\nContinue creating PIF Payment Plan?`);
      if (!ok) {
        toast('Cancelled', 'warn');
        return;
      }
    }

    lockButtons(true);

    try {
      const payBtn = document.querySelector('input[id*="Btn_PaymentPlan"]');
      if (!payBtn || !payBtn.onclick) throw new Error('Payment Plan button not found');

      const m = payBtn.onclick.toString().match(/PaymentPlan\.aspx\?loanid=\d+/i);
      if (!m) throw new Error('Cannot parse PaymentPlan url');
      const url = m[0];

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = async () => {
        try {
          for (let i = 0; i < 40; i++) {
            if (typeof iframe.contentWindow?.jstemplatetable_additem === 'function') break;
            await sleep(200);
          }
          if (typeof iframe.contentWindow?.jstemplatetable_additem !== 'function') {
            throw new Error('PaymentPlan page not ready (jstemplatetable_additem missing)');
          }

          const today = new Date();
          const next = nextBusinessDay(today);

          iframe.contentWindow.jstemplatetable_additem('tbl_paymentplaninfos', null, {
            paymentdate: formatDate(today),
            paymentamount: total.toFixed(2),
            paymenttype: '',
          });

          await sleep(200);

          iframe.contentWindow.jstemplatetable_additem('tbl_paymentplaninfos', null, {
            paymentdate: formatDate(next),
            paymentamount: '0',
            paymenttype: '',
          });

          await sleep(250);

          const submitBtn =
            iframe.contentDocument.querySelector('input[id*="Btn_Submit"]') ||
            iframe.contentDocument.querySelector('input[type="submit"][value="Submit"]');

          if (!submitBtn) throw new Error('Submit not found');
          submitBtn.click();

          await sleep(900);
          try { iframe.remove(); } catch {}

          if (window.refreshSection) window.refreshSection();

          setDone(BTN_IDS.pifpp);
          makeOrange(document.getElementById(BTN_IDS.pifpp));
          toast('Payment Plan created ✓');
        } catch (e) {
          try { iframe.remove(); } catch {}
          toast('PIF error: ' + (e?.message || e), 'err');
        } finally {
          lockButtons(false);
          applySavedState();
        }
      };
    } catch (e) {
      toast('PIF error: ' + (e?.message || e), 'err');
      lockButtons(false);
      applySavedState();
    }
  }

 async function handleSendPIFDocs() {
  if (operationRunning) return;
  lockButtons(true);

  try {
    const link =
      document.querySelector('a[href*="additionalagreements("]') ||
      Array.from(document.querySelectorAll('a')).find((a) =>
        /additionalagreements\(\d+\)/i.test(a.getAttribute('href') || '')
      );

    if (!link) throw new Error('Additional Agreements link not found');

    const mm = (link.getAttribute('href') || '').match(/additionalagreements\((\d+)\)/i);
    if (!mm) throw new Error('Cannot parse loanid');
    const loanid = mm[1];

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `popups/AdditionalAgreements.aspx?loanid=${loanid}`;
    document.body.appendChild(iframe);

    let pifDocsFlowStarted = false;

    iframe.onload = async () => {
      if (pifDocsFlowStarted) return;
      pifDocsFlowStarted = true;

      try {
        const doc = iframe.contentDocument;

        for (let i = 0; i < 40; i++) {
          const sel = doc.querySelector('select');
          if (sel && sel.options && sel.options.length > 1) break;
          await sleep(200);
        }

        const sel = doc.querySelector('select');
        if (!sel) throw new Error('Agreement dropdown not found');

        const opt = Array.from(sel.options || []).find((o) =>
          (o.textContent || '').toLowerCase().includes('repayment plan addendum')
        );
        if (!opt) throw new Error('Repayment Plan Addendum not found');

        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(250);

        const createBtn =
          doc.querySelector('input[value="Create"]') || doc.querySelector('button');
        if (!createBtn) throw new Error('Create button not found');
        createBtn.click();

        await sleep(900);
        try { iframe.remove(); } catch {}

        await sendBothWithSeparateToasts('Payment Plan Agreement', 'Payment Plan Agreement');

        setDone(BTN_IDS.docs);
        makeOrange(document.getElementById(BTN_IDS.docs));

        await autoCloseDuringSend(2000);
      } catch (e) {
        try { iframe.remove(); } catch {}
        toast('PIF Docs error: ' + (e?.message || e), 'err');
        await autoCloseDuringSend(2000);
      } finally {
        lockButtons(false);
        applySavedState();
      }
    };
  } catch (e) {
    toast('PIF Docs error: ' + (e?.message || e), 'err');
    await autoCloseDuringSend(1500);
    lockButtons(false);
    applySavedState();
  }
}






  // ===================== ACTIVE GATE =====================
  function isLoanActive() {
    const tds = Array.from(document.querySelectorAll('td'));
    for (const td of tds) {
      const label = (td.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^status\s*:\s*$/i.test(label) || /^status\s*:?$/i.test(label)) {
        const val = (td.nextElementSibling?.textContent || '').replace(/\s+/g, ' ').trim();
        if (val) return /\bactive\b/i.test(val);
      }
    }
    const txt = document.body?.innerText || '';
    const m = txt.match(/LOAN#\s*\d+\s*\/\s*([A-Z]+)/i);
    return m ? /ACTIVE/i.test(m[1]) : false;
  }

  function removeUIIfExists() {
    const wrap = document.getElementById(BTN_IDS.wrap);
    if (wrap) wrap.remove();
  }

  // ===== UI =====
  function buildBtn(label, id) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'padding:4px 9px;' +
      'background:#2f3640;' +
      'color:#fff;' +
      'border:1px solid #111;' +
      'border-radius:6px;' +
      'cursor:pointer;' +
      'font-size:11px;' +
      'line-height:1.1;' +
      'white-space:nowrap;';
    return b;
  }

  function buildResetX(forBtnId) {
    const x = document.createElement('span');
    x.className = 'cc-reset-x';
    x.textContent = '✕';
    x.title = 'Reset';
    x.addEventListener('click', (e) => {
      hardStop(e);
      clearDone(forBtnId);
      applySavedState();
      toast('Reset ✓', 'warn');
    }, true);
    return x;
  }

  function injectUI() {
    if (!/CustomerDetails\.aspx/i.test(location.href)) return;

    if (!isLoanActive()) {
      removeUIIfExists();
      return;
    }

    const dialer = document.querySelector('a[id*="DialerLeadsLink"]');
    if (!dialer) return;

    const parent = dialer.closest('span')?.parentElement || dialer.parentElement;
    if (!parent) return;

    if (document.getElementById(BTN_IDS.wrap)) {
      applySavedState();
      return;
    }

    const wrap = document.createElement('span');
    wrap.id = BTN_IDS.wrap;
    wrap.style.marginLeft = '10px';
    wrap.style.display = 'inline-flex';
    wrap.style.gap = '4px';
    wrap.style.alignItems = 'center';

    const b1 = buildBtn('Update DC', BTN_IDS.updatedc);
    const x1 = buildResetX(BTN_IDS.updatedc);

    const b2 = buildBtn('Create PIF PP', BTN_IDS.pifpp);
    const x2 = buildResetX(BTN_IDS.pifpp);

    const b3 = buildBtn('Send PIF Docs', BTN_IDS.docs);
    const x3 = buildResetX(BTN_IDS.docs);

    b1.addEventListener('click', async (e) => { hardStop(e); await handleUpdateDC(); }, true);
    b2.addEventListener('click', async (e) => { hardStop(e); await handleCreatePIFPP(); }, true);
    b3.addEventListener('click', async (e) => { hardStop(e); await handleSendPIFDocs(); }, true);

    wrap.appendChild(b1); wrap.appendChild(x1);
    wrap.appendChild(b2); wrap.appendChild(x2);
    wrap.appendChild(b3); wrap.appendChild(x3);

    parent.appendChild(wrap);

    applySavedState();
  }

  // ===== SELF-HEAL =====
  function boot() {
    injectUI();
  
    let _pifDebounce = null;
    const mo = new MutationObserver(() => {
      clearTimeout(_pifDebounce);
      _pifDebounce = setTimeout(injectUI, 120);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  boot();
  });

})();
