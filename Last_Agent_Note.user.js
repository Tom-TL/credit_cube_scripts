// ==UserScript==
// @name         Last Agent Note
// @author       Tom Harris
// @namespace    https://github.com/TOM-TL/credit_cube_scripts
// @version      1.0
// @description  Shows last Created By from Notes (skips exclusions)
// @match        *://apply.creditcube.com/plm.net/customers/CustomerDetails.aspx*
// @homepageURL  https://github.com/Tom-TL/credit_cube_scripts
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Last_Agent_Note.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Last_Agent_Note.user.js
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

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
        "auto extension",
        "monica smith",
        "liam moss collections",
        "liam moss portfolio",
   	     "enrique martinez",
        "customer site service"
    ];

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

        // ❌ Пропускаем системные ноты
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
pill.style.color = "#d32f2f"; // нормальный красный
pill.style.fontWeight = "600";
pill.style.fontSize = "13px";




/*pill.style.background = "#fff3cd";
pill.style.border = "1px solid #ffca2c";
pill.style.color = "#664d03";
pill.style.fontWeight = "600";
pill.style.fontSize = "13px"; */

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

        // ✨ кастомный tooltip
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

    } catch {
        return;
    }
});







        host.appendChild(btn);
    }

    // Infinity перерисовывает блок → держим кнопку
    const observer = new MutationObserver(() => ensureUI());
    observer.observe(document.body, { childList: true, subtree: true });

    ensureUI();

})();

})();
