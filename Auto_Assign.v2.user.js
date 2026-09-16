// ==UserScript==
// @name         Auto-Assign 2.3
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      2.3.1
// @description  Persistent Auto Assign with stable roster loading, verified updates, safe recovery, hang-free engine, and clearer button feedback.
// @match        https://apply.creditcube.com/plm.net/reports/LoansReport.aspx*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Auto_Assign.v2.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Auto_Assign.v2.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==


(function () {
  'use strict';



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
  // other LMS screen. The @match above already limits this, but the check is
  // repeated here so a stale or broader install cannot leak the UI elsewhere.
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


})();
