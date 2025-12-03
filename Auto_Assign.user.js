// ==UserScript==
// @name         Auto-Assign
// @author       Tom Harris
// @namespace    https://github.com/Tom-TL/credit_cube_scripts
// @version      1,0
// @description  Evenly assign visible Pending Loans (bottom→up) to Day/Late/Everyone using roster CSV. Strict equal split, custom reps-per-rep, exclusions, choose reps draft, bottom-up selection.
// @match        https://apply.creditcube.com/plm.net/reports/*
// @updateURL    https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Auto_Assign.user.js
// @downloadURL  https://raw.githubusercontent.com/Tom-TL/credit_cube_scripts/main/Auto_Assign.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__SA_ONCE__) return; window.__SA_ONCE__ = true;

  // Only on Pending Loans
  const usp = new URLSearchParams(location.search);
  if (usp.get('reportpreset') !== 'pending') return;

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
    LPR:'sa:lpr'                    // Leads per rep (int) — empty means auto
  };
  const SS = { NAV:'sa:navigating', TOKEN:'sa:runToken' };

  const save=(k,v)=>localStorage.setItem(k, JSON.stringify(v));
  const load=(k,d)=>{ try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(d)); } catch { return d; } };
  const ssDel=(k)=>sessionStorage.removeItem(k);

  // ---------- Infinity DOM hooks ----------
  const getAssignDD = ()=> $('#maincontent_AssignToProcessingAdminId') ||
    $$('select').find(s=>/Assign checked customers to processing admin/i.test(s.closest('tr,div,section')?.textContent||''));
  const getUpdateBtn = ()=> $$('input[type="submit"],button').find(b=>/update/i.test((b.value||b.textContent||'')));
  const getBoxes = ()=> $$('input[name="processingAdminLoanIds"]').filter(el=>el.offsetParent!==null && !el.disabled);
  const clearChecks = ()=> getBoxes().forEach(b=>b.checked=false);
  const pickBottom = (n)=>{ const arr=getBoxes().reverse(); const out=[]; for(const b of arr){ if(!b.checked){ out.push(b); if(out.length>=n) break; } } return out; };
  const topFilterSelect=()=> $$('select').find(sel => (/Processing Admin/i.test(sel.closest('tr,div,section')?.textContent||'')) && sel!==getAssignDD());
  const topIsNoAdmin=()=>{ const s=topFilterSelect(); if(!s) return true; const t=(s.options[s.selectedIndex]?.text||'').toLowerCase(); return t.includes('no admin'); };
  const setAssignAdmin=(id)=>{ const dd=getAssignDD(); if(!dd) return false; dd.value=String(id); dd.dispatchEvent(new Event('change',{bubbles:true})); return true; };

  // ---------- roster CSV ----------
  const CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vQgWqtMjWSM3pxso2zs8mUh51JS0u2EqsN5_d_l2rjhsXGlcQ-A0F2gzk8nRtrNmjG2YurSxqbcIo0Z/pub?gid=355516630&single=true&output=csv';
  let roster={day:[], late:[]};
  let id2name=new Map(), name2id=new Map();

  async function loadRoster(force=false){
    if(!force && (roster.day.length+roster.late.length)) return roster;
    const res=await fetch(CSV_URL,{cache:'no-store'}); if(!res.ok) throw new Error('CSV '+res.status);
    const lines=(await res.text()).split(/\r?\n/);
    const day=[], late=[];
    for(let i=1;i<lines.length;i++){
      if(!lines[i]) continue;
      const parts=lines[i].split(',');
      const d=(parts[0]||'').trim();
      const l=(parts[1]||'').trim();
      if(/^\d+$/.test(d)) day.push(d);
      if(/^\d+$/.test(l)) late.push(l);
    }
    roster={day:uniq(day), late:uniq(late)};
    return roster;
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
  }
  const names=(ids)=> ids.map(id=> id2name.get(id)||String(id));

  // ---------- styles ----------
  function injectCSS(){
    if($('#sa-css')) return;
    const st=document.createElement('style'); st.id='sa-css';
    st.textContent=`
      :root{--bg:#0f172a;--text:#e5e7eb;--mut:#94a3b8;--line:#1f2937;--chip:#111827;--y:#facc15;--b:#3b82f6;--p:#8b5cf6;--g:#6b7280;}
      @media (prefers-color-scheme:light){:root{--bg:#fff;--text:#0f172a;--mut:#475569;--line:#e5e7eb;--chip:#eef2ff;}}
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

      /* Modals */
      #sa-cfm,#sa-modal{
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
      .sa-label{font-size:12px; opacity:.85;}
      .sa-inline-note{font-size:12px;color:#eab308;margin-top:6px;}
    `;
    document.head.appendChild(st);
  }

  // ---------- panel UI ----------
  function buildPanel(){
    if($('#sa')) return;
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
          <span class="sa-small" id="sa-warn" style="margin-left:auto;"></span>
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

    // position + drag
    const pos=load(LS.POS,{left:16,top:Math.max(16,window.innerHeight-420)});
    box.style.left=pos.left+'px'; box.style.top=pos.top+'px';
    const drag=$('#sa-drag'); let m=false,sx=0,sy=0,sl=0,st=0;
    drag.addEventListener('mousedown',e=>{ if(e.target.closest('.right')) return; m=true; sx=e.clientX; sy=e.clientY; const r=box.getBoundingClientRect(); sl=r.left; st=r.top; document.body.style.userSelect='none';});
    window.addEventListener('mousemove',e=>{ if(!m) return; let l=sl+(e.clientX-sx), t=st+(e.clientY-sy);
      l=Math.max(8,Math.min(l,window.innerWidth-box.offsetWidth-8));
      t=Math.max(8,Math.min(t,window.innerHeight-box.offsetHeight-8));
      box.style.left=l+'px'; box.style.top=t+'px';
    });
    window.addEventListener('mouseup',()=>{ if(!m) return; m=false; document.body.style.userSelect=''; const r=box.getBoundingClientRect(); save(LS.POS,{left:r.left,top:r.top}); });
    window.addEventListener('resize',()=>{ const r=$('#sa').getBoundingClientRect();
      const l=Math.max(8,Math.min(r.left,window.innerWidth-$('#sa').offsetWidth-8));
      const t=Math.max(8,Math.min(r.top,window.innerHeight-$('#sa').offsetHeight-8));
      $('#sa').style.left=l+'px'; $('#sa').style.top=t+'px'; save(LS.POS,{left:l,top:t});});

    const collapsed=!!load(LS.COL,false);
    box.classList.toggle('collapsed',collapsed);
    $('#sa-collapse').textContent = collapsed ? '▢':'−';

    // preload saved "Leads per rep" -> input + Saved label
    const lprSaved = load(LS.LPR, null);
    if (lprSaved && Number.isFinite(lprSaved)) $('#sa-lpr').value = String(lprSaved);
    $('#sa-lpr-saved').textContent = 'Saved: ' + (lprSaved ? lprSaved : 'auto');
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
  function showConfirmModal({shift, reps, perRep, visible, totalAssign, remainder, assignees=[], excluded=[]}) {
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
              <div>Total visible leads: ${visible}</div>
              <div>Total leads to assign: ${totalAssign}</div>
              ${remainder>0 ? `<div>Unassigned remainder: ${remainder}</div>` : ``}
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
  function showSummaryModal({perRep, reps, totalAssign, remainder, assignedNames=[], skippedNames=[]}) {
    const wrap = document.createElement('div'); wrap.id='sa-modal';
    wrap.innerHTML = `
      <div class="sa-card" role="dialog" aria-modal="true" aria-label="Auto-Assign summary">
        <div class="hd">
          <div>Assigning completed</div>
          <button class="btn ghost" id="sa-close-x" title="Close">✕</button>
        </div>
        <div class="content">
          <div class="sub">
            <div>Leads per rep: ${perRep}</div>
            <div>Reps: ${reps}</div>
            <div>Assigned total: ${totalAssign}</div>
            ${remainder>0 ? `<div>Unassigned remainder: ${remainder}</div>` : ``}
          </div>
          <div class="bd">
            <div class="col">
              <h4>✅ Assigned</h4>
              <pre id="sa-pre-assigned">${assignedNames.map(n => `- ${n}`).join('\n') || '(none)'}</pre>
              <button class="btn ghost" id="sa-copy-assigned" type="button">Copy assigned</button>
            </div>
            <div class="col">
              <h4>⏭ Skipped</h4>
              <pre id="sa-pre-skipped">${skippedNames.map(n => `- ${n}`).join('\n') || '(none)'}</pre>
              <button class="btn ghost" id="sa-copy-skipped" type="button">Copy skipped</button>
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

  // ---------- start job ----------
  async function startJob(group, baseIds){
    if(!topIsNoAdmin()){ alert('Please set top filter "Processing Admin" to "-- no admin --".'); return; }

    const poolBase=baseIds.filter(id=> id2name.has(id));
    const excl=new Set(load(LS.SAVED_IDS,[]));
    const filtered=poolBase.filter(id=> !excl.has(id)); // after exclusions

    // Choose representatives (optional): if saved list non-empty → intersect
    const chooseSaved = new Set(load(LS.CH_IDS,[]));
    const finalPool = chooseSaved.size
      ? filtered.filter(id => chooseSaved.has(id))
      : filtered; // If empty -> All reps

    if (chooseSaved.size && finalPool.length===0){
      alert('No representatives selected.');
      return;
    }
    if(!finalPool.length){ alert('No reps to assign (all excluded).'); return; }

    const visible = getBoxes().length;

    // Leads per rep (user or auto)
    const lprValueRaw = ($('#sa-lpr').value||'').trim();
    let perRep = null;
    if (lprValueRaw === '') {
      if (visible < finalPool.length){
        alert('Not enough leads. Needed ' + finalPool.length + ', available ' + visible + '.');
        return;
      }
      perRep = floorSplit(visible, finalPool.length);
    } else {
      const parsed = parseInt(lprValueRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        alert('Leads per rep must be at least 1.');
        return;
      }
      const needed = parsed * finalPool.length;
      if (visible < needed) {
        alert(`Not enough leads. Needed ${needed}, available ${visible}.`);
        return;
      }
      perRep = parsed;
    }

    const totalAssign = perRep * finalPool.length;
    const remainder   = visible - totalAssign;

    // Confirm modal
    const ok = await showConfirmModal({
      shift: group,
      reps: finalPool.length,
      perRep,
      visible,
      totalAssign,
      remainder,
      assignees: names(finalPool),
      excluded: names([...excl])
    });
    if(!ok) return;

    const token = Math.random().toString(36).slice(2);
    sessionStorage.setItem(SS.TOKEN, token);
    const job={token, group, queue:buildQueue(finalPool, perRep), idx:0, lastId:null, perRep, totalAssign, remainder, visible0:visible};
    save(LS.JOB, job);
    runJob();
  }

  async function waitReady(ms=12000){
    const t=performance.now();
    while(performance.now()-t<ms){
      if(document.readyState!=='loading' && (getAssignDD() || getBoxes().length)) return;
      await sleep(100);
    }
  }

  // ---------- engine ----------
  let running=false;
  async function runJob(){
    if(running) return; running=true;
    try{
      await waitReady();
      let job=load(LS.JOB,null);
      const token=job?.token;
      if(!job || !token || sessionStorage.getItem(SS.TOKEN)!==token){
        localStorage.removeItem(LS.JOB); localStorage.removeItem(LS.STEP); running=false; return;
      }

      // restore step after navigation: always move NEXT, never same rep twice
      const step=load(LS.STEP,null);
      if(step && sessionStorage.getItem(SS.NAV)){
        sessionStorage.removeItem(SS.NAV);
        const idx = job.queue.findIndex(q=> String(q.id)===String(step.id));
        if(idx>=0){
          const node=job.queue[idx];
          node.remaining = Math.max(0, node.remaining - (step.expected || 0));
          node.tries=0;
          job.lastId = node.id;
          if (job.idx < job.queue.length) job.idx++; // advance to next rep
          save(LS.JOB,job);
        }
        localStorage.removeItem(LS.STEP);
      }

      // main loop
      while(true){
        if(!topIsNoAdmin()){ alert('Please set top filter "Processing Admin" to "-- no admin --".'); localStorage.removeItem(LS.JOB); break; }

        // Skip done/skipped nodes
        while(job.idx < job.queue.length && (job.queue[job.idx].remaining<=0 || job.queue[job.idx].remaining===Number.POSITIVE_INFINITY)){
          job.idx++;
        }

        // If reached end: check wrap-around need
        if(job.idx >= job.queue.length){
          const unfinished = job.queue.some(q => q.remaining > 0 && q.remaining !== Number.POSITIVE_INFINITY);
          const available = getBoxes().length;
          if(unfinished && available > 0){
            job.idx = 0; // new round to finish exact quotas
            save(LS.JOB, job);
            continue;
          } else {
            break; // job finished
          }
        }

        // No consecutive batches to the same rep
        if (job.lastId && String(job.queue[job.idx].id) === String(job.lastId)) {
          job.idx++;
          save(LS.JOB, job);
          continue;
        }

        const node=job.queue[job.idx];
        const available=getBoxes().length; if(available<=0) break;
        const take=Math.min(node.remaining, available);
        if (take <= 0) { job.idx++; save(LS.JOB,job); continue; }

        clearChecks();
        const picked=pickBottom(take);
        if(!picked.length){ break; }
        picked.forEach(cb=>cb.checked=true);

        if(!setAssignAdmin(node.id)){
          node.tries++;
          if(node.tries>=2){ node.remaining = Number.POSITIVE_INFINITY; job.idx++; }
          save(LS.JOB, job);
          continue;
        }

        save(LS.STEP,{id:node.id, expected:picked.length, beforeCount:available, ts:Date.now()});
        sessionStorage.setItem(SS.NAV,'1');

        const btn=getUpdateBtn();
        if(!btn){
          node.tries++;
          if(node.tries>=2){ node.remaining = Number.POSITIVE_INFINITY; job.idx++; }
          save(LS.JOB, job);
          break;
        }
        btn.click(); return; // wait for navigation/re-render
      }

      // Finish: summary modal
      if(job){
        const assignedIds = job.queue.filter(q=>q.remaining===0).map(q=>q.id);
        const skippedIds  = job.queue.filter(q=>q.remaining===Number.POSITIVE_INFINITY).map(q=>q.id);
        const assignedNames = names(assignedIds);
        const skippedNames  = names(skippedIds);

        save(LS.RES,{group:job.group,assignedNames,skippedNames,perRep:job.perRep});
        localStorage.removeItem(LS.JOB); localStorage.removeItem(LS.STEP);

        const visible0 = job.visible0 || 0;
        showSummaryModal({
          perRep: job.perRep,
          reps: job.queue.length,
          totalAssign: (job.perRep * job.queue.length),
          remainder: Math.max(0, visible0 - (job.perRep * job.queue.length)),
          assignedNames,
          skippedNames
        });
      }
    } finally { running=false; }
  }

  // ---------- bindings ----------
  function bindUI(){
    // refresh roster
    $('#sa-refresh').onclick = async ()=>{
      $('#sa-refresh').disabled=true;
      try{ await loadRoster(true); rebuildMaps(); }
      finally{ $('#sa-refresh').disabled=false; }
    };

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
  async function boot(){
    injectCSS(); buildPanel(); bindUI(); renderChips();
    try{ await loadRoster(false);}catch{}
    rebuildMaps();

    const warn=$('#sa-warn');
    const updateWarn=()=>{ warn.textContent = topIsNoAdmin() ? '' : 'Set Processing Admin = "-- no admin --"'; };
    updateWarn();
    const obs=new MutationObserver(updateWarn);
    obs.observe(document.body,{childList:true,subtree:true});

    const job=load(LS.JOB,null);
    if(job && job.token && sessionStorage.getItem(SS.TOKEN)===job.token){ runJob(); }
    else { localStorage.removeItem(LS.JOB); localStorage.removeItem(LS.STEP); ssDel(SS.NAV); ssDel(SS.TOKEN); }
  }
  boot();
})();
