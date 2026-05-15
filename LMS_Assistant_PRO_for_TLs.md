# 🛠️ LMS Assistant PRO for TLs

> Unified TamperMonkey module — bundles 12 helper scripts for CreditCube Team Leaders into a single toggleable system.

**Current version:** v1.0.6
**Target CRM:** Infinity LMS at `apply.creditcube.com`
**Target user role:** Team Leader (Support)
**File:** [`LMS_Assistant_PRO_for_TLs.user.js`](./LMS_Assistant_PRO_for_TLs.user.js)

---

## 🚀 Install (one-click)

**[👉 Click here to install / update](https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/LMS_Assistant_PRO_for_TLs.user.js)**

> 💡 You need the [TamperMonkey](https://www.tampermonkey.net/) browser extension installed first.

After clicking the link:
1. TamperMonkey will open an install screen automatically
2. Click **Install**
3. Reload the CRM (`F5`)
4. A new menu item **🛠️ LMS ASSISTANT PRO (TLs)** will appear in the topbar

### ⚠️ Before installing
**Disable** any old standalone scripts in TamperMonkey that are now bundled in this module (do NOT delete them — keep as backup):
- DC Quick Comments, Reversed Loan, Docs Status Checker, Last Agent Note, Processing Admin Quick Search
- TBW Assistant, TBW TL Helper, PIF DC Helper
- Bulk Open Tabs, AA In Progress Bulk Cleanup, Compact Denial List, Auto-Assign

---

## 🔄 Auto-updates

Once installed, **TamperMonkey checks for updates daily** via this repo. No action needed.

When a new version is released:
- TamperMonkey silently downloads it in the background
- Next time you open the CRM, a **"What's new"** popup shows what changed
- Click **Got it** — popup won't show again until the next update

To force an update check manually: TamperMonkey Dashboard → Utilities → Check for updates.

---

## 🎛️ Usage

- **Hover** the menu item → dropdown opens
- Click any **toggle switch** to enable/disable a script
- Page reloads automatically when you toggle (state is saved to `localStorage`)
- Click **📝 New Ideas / Bug Report** at the bottom to submit feedback

---

## 📦 Bundled scripts

### 📂 Customer Page (8)
| Script | What it does |
|---|---|
| DC Quick Comments | Quick green PIF/Regular DC comment buttons under Comments |
| Reversed Loan Notifier | Red Reversed Loan button — auto-sends Email + Text notification |
| Docs Status Checker | Check Docs button — verifies if Additional Agreement was signed today |
| Last Agent Note | Shows the last meaningful agent note (filters system events) |
| Processing Admin Quick Search | Inline admin search field next to Processing Admin link |
| TBW Assistant | Shows TBW denial reason, auto-denies certain reasons, quick Review to CRP |
| TBW TL Helper | Assign TL, Remove TBW status, send new E-Sign — one-click |
| PIF DC Helper | One-click Update DC, create PIF Payment Plan, send PIF docs |

### 📂 Reports (2)
| Script | What it does |
|---|---|
| Bulk Open Tabs | Open N customers in tabs (5/10/15/20/All) |
| AA In Progress Bulk Cleanup | Removes "AA In Progress" status for all loans in Pending |

### 📂 Popups (1)
| Script | What it does |
|---|---|
| Compact Denial List | Compact denial reasons list with custom order and pill toggles |

### 📂 Global / Automation (1)
| Script | What it does |
|---|---|
| Auto-Assign | Distributes Pending Loans to Day/Late/Everyone reps (**OFF by default**) |

---

## 🐛 Troubleshooting

**Menu doesn't appear**
- Open DevTools (F12) → Console → look for `[LMS Assistant PRO TLs]` errors
- Make sure you're on `apply.creditcube.com`
- Wait a moment — the menu re-injects every 1 second if missing

**A specific script doesn't work**
- Open the dropdown → make sure its toggle is ON (green)
- Check Console for `Script "scriptId" crashed:` errors
- Make sure the old standalone version of that script is disabled

**Toggle state doesn't persist**
- Check the browser allows `localStorage` for `apply.creditcube.com`

**My settings disappeared**
- `localStorage` is per-browser. If you clear cookies/site data, toggles reset to defaults

---

## 📊 Tech specs

| | |
|---|---|
| Format | Single `.user.js` file |
| Size | ~237 KB |
| Lines | ~6790 |
| Storage | `localStorage` (per browser) |
| Frameworks | None (vanilla JavaScript) |
| Browser support | Chrome, Firefox, Edge, Safari (anything TamperMonkey supports) |

---

## 🗺️ Roadmap

- [x] v1.0.0 — Framework + 9 ready scripts
- [x] v1.0.4 — Stage 2: integrated TBW Assistant, TBW TL Helper, PIF DC Helper
- [x] v1.0.5 — "What's new" changelog popup
- [x] v1.0.6 — GitHub auto-update enabled
- [ ] Create Google Form for Bug Report
- [ ] Per-script settings (custom Bulk Open counts, etc.)
- [ ] Cross-device sync via Supabase

---

## 🤝 Credits

- **Author / Maintainer:** Nikita (Credit Sense, Team Lead Support)
- **Inspired by:** LMS Assistant PRO for Sales
- **Bundled scripts:** Original authorship by Tom Harris (Tom-TL)
