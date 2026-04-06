// ==UserScript==
// @name         TBW TL Helper
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1.1
// @description  Assign TL, Remove TBW , send new E-Sign (Email + Text) with toasts
// @author       Tom Harris
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_TL_Helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/TBW_TL_Helper.user.js
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const TL_LIST = [
    "Tom Harris",
    "Veronica Lodge",
    "Paul Caffrey",
    "John Lim",
    "Desa Solingan",
    "Benjamin Alla",
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

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
    let box = document.getElementById("ccDocsToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "ccDocsToast";
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
})();
