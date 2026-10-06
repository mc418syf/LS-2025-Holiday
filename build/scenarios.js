/* ================= PAID SCENARIOS (inside the Paid search tab) =================
   Same model as the JD Q4 dashboard's "Paid scenarios" tab, fitted to Livestock data.
   Each day's net sales = a baseline that would happen with no Google spend, plus a
   paid-responsive part under diminishing returns:
     R(S) = B + (R0 - B) * (S/S0)^b
   Marginal return dR/dS = b*(R-B)/S.
   Livestock's Google Ads export has conversions but no conversion value, so the platform
   ROAS anchor is estimated as Google conversions x that day's Shopify AOV / Google spend.
   The baseline is calibrated per day so the marginal return at the spend we ran equals it. */
const xx=v=>!ok(v)?'—':v.toFixed(1)+'x';
const LAUNCHD=new Set(PAY.launches.map(l=>l.d));
const isLaunch=d=>LAUNCHD.has(d);
const estRoas=r=>(r.g_cost&&r.g_conv&&r.aov)?r.g_conv*r.aov/r.g_cost:null;
const SCN={T:30,b:0.65,mode:'anchor',base:0.40,capMult:4,capAbs:0,budget:0,useBudget:false,scope:'all',view:'cum'};
const ELAS=(()=>{const rs=D.filter(r=>r.g_cost>0&&r.g_conv>0&&r.aov>0);
 const xs=rs.map(r=>Math.log(r.g_cost)),ys=rs.map(r=>Math.log(r.g_conv*r.aov));
 const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
 const cs=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);
 const dd=[];for(let i=1;i<rs.length;i++){const ds=Math.log(rs[i].g_cost/rs[i-1].g_cost);if(Math.abs(ds)>Math.log(1.15))dd.push(Math.log((rs[i].g_conv*rs[i].aov)/(rs[i-1].g_conv*rs[i-1].aov))/ds);}
 dd.sort((a,b)=>a-b);const dod=dd.length?dd[Math.floor(dd.length/2)]:null;
 const srt=rs.slice().sort((a,b)=>a.g_cost-b.g_cost),dec=[];
 for(let k=0;k<10;k++){const g=srt.slice(Math.floor(k*srt.length/10),Math.floor((k+1)*srt.length/10));
  const s=g.reduce((a,r)=>a+r.g_cost,0),v=g.reduce((a,r)=>a+r.g_conv*r.aov,0);dec.push({d:k+1,spend:s/g.length,roas:v/s});}
 const a=DI['2025-11-27'],b=DI['2025-11-28'];
 return {cs,dod,n:dd.length,dec,bf:{ds:b.g_cost/a.g_cost-1,dv:(b.g_conv*b.aov)/(a.g_conv*a.aov)-1}};})();
function dayB(r){if(SCN.mode==='manual')return r.net*SCN.base;
 const m=estRoas(r)||20;const B=r.net-(m*r.g_cost)/SCN.b;return Math.max(0,Math.min(B,r.net*0.95));}
function respR(r,S){const B=dayB(r);return (!r.g_cost||S<=0)?B:B+(r.net-B)*Math.pow(S/r.g_cost,SCN.b);}
function margAt(r,S){return SCN.b*(respR(r,S)-dayB(r))/S;}
function sTarget(r){if(r.net/r.g_cost<=SCN.T)return r.g_cost;let lo=r.g_cost,hi=r.g_cost*600;
 if(respR(r,hi)/hi>SCN.T)return hi;for(let i=0;i<70;i++){const m=(lo+hi)/2;respR(r,m)/m>SCN.T?lo=m:hi=m;}return (lo+hi)/2;}
function sForMarg(r,m){const k=r.net-dayB(r);if(k<=0)return r.g_cost;return r.g_cost*Math.pow(SCN.b*k/(r.g_cost*m),1/(1-SCN.b));}
function ceilFor(r){let c=r.g_cost*SCN.capMult;if(SCN.capAbs>0)c=Math.min(c,Math.max(SCN.capAbs,r.g_cost));return c;}
function planDay(r,mStar){if(!(r.g_cost>0)||!(r.net>0))return null;
 let S=sTarget(r);if(mStar!=null)S=Math.min(S,sForMarg(r,mStar));S=Math.min(S,ceilFor(r));S=Math.max(S,r.g_cost);const R=respR(r,S);
 const bind=Math.abs(S-r.g_cost)<1?'none':(Math.abs(S-ceilFor(r))<1?'spend ceiling':(mStar!=null&&Math.abs(S-sForMarg(r,mStar))<1?'budget':'target MER'));
 return {d:r.d,S0:r.g_cost,R0:r.net,S,R,dS:S-r.g_cost,dR:R-r.net,mer0:r.net/r.g_cost,mer1:R/S,marg:S>r.g_cost+0.5?(R-r.net)/(S-r.g_cost):null,bind};}
const SCOPES={all:['All 92 days',()=>true],launch:['Launch days',isLaunch],bfcm:['BFCM run, 21 Nov – 1 Dec',d=>d>='2025-11-21'&&d<='2025-12-01'],
 dec:['December only',d=>d>='2025-12-01'],oct:['October only',d=>d<='2025-10-31']};
function buildPlan(){const f=SCOPES[SCN.scope][1],sel=new Set(D.map(r=>r.d).filter(f));let mStar=null;
 if(SCN.useBudget&&SCN.budget>0){let lo=0.5,hi=2000;for(let i=0;i<70;i++){const m=(lo+hi)/2;
  const t=D.reduce((a,r)=>{if(!sel.has(r.d))return a;const p=planDay(r,m);return a+(p?p.dS:0);},0);t>SCN.budget?lo=m:hi=m;}mStar=(lo+hi)/2;}
 const plan=D.map(r=>{const p=planDay(r,sel.has(r.d)?mStar:null);if(!p)return null;
  if(!sel.has(r.d))return {d:r.d,S0:r.g_cost,R0:r.net,S:r.g_cost,R:r.net,dS:0,dR:0,mer0:r.net/r.g_cost,mer1:r.net/r.g_cost,marg:null,bind:'out of scope'};return p;}).filter(Boolean);
 return {plan,mStar,sel};}
const dayTags=d=>{const p=periodOf(d);return `<span class="pdot" style="background:${KC(p.k)}"></span>${esc(p.n)}`;};
const launchBadge=d=>isLaunch(d)?`<span class="badge">Launch · ${(LBYD[d]||[]).length}</span>`:'<span class="tag">No launch</span>';

function renderScenarios(el){
 el.innerHTML=`<div class="sec"><div class="sech"><h2>Paid scenarios</h2><span class="sub">Spend Google Ads up to an MER guardrail, subject to ceilings you control</span></div>
 <div class="note"><b>What this does.</b> On Black Friday Livestock finished at <b>${xx(DI['2025-11-28'].net/DI['2025-11-28'].g_cost)}</b> MER (net sales ÷ Google Ads spend) on only <b>${m0(DI['2025-11-28'].g_cost)}</b> of spend. Finishing that high means the budget ran out well before the demand did. This section spends each day down towards an MER you set. Spend stops at whichever ceiling binds first: a per-day spend multiple, an absolute daily cap, or a total extra budget.
 <br><br><b>How the response curve is anchored.</b> The model calibrates each day so the marginal return at the spend actually run equals that day's estimated Google ROAS (Google conversions × Shopify AOV ÷ spend; the Ads export has no conversion value). Everything above that baseline scales with spend under diminishing returns, so elasticity is the only free assumption.
 <br><br><b>Read the elasticity honestly.</b> Fitted from Livestock's own data it is <b>${ELAS.cs.toFixed(2)}</b>, far above the 0.35 textbook value. Spend and demand are confounded here: spend rises on launch and sale days when demand is high anyway. The default is <b>0.65</b>, as in the JD model. Move the slider to 0.85 for the optimistic case or 0.45 for the conservative one, and check the sensitivity grid before quoting any single figure.</div>
 <div class="ctlbox">
  <div class="chipgrp"><span class="gl">Target MER</span>${[20,25,30,40,50,60].map(t=>`<button class="chip ${t===SCN.T?'on':''}" data-sct="${t}">${t}x</button>`).join('')}
   <span class="hint">Net sales ÷ Google Ads spend. Spend stops here.</span></div>
  <div class="chipgrp"><span class="gl">Elasticity</span><input type="range" class="slider" id="scb" min="0.30" max="1.00" step="0.01" value="${SCN.b}" aria-label="Elasticity"><span class="vlab" id="scblab"></span></div>
  <div class="chipgrp"><span class="gl">Baseline</span><button class="chip on" data-scm="anchor">Anchor to est. ROAS</button><button class="chip" data-scm="manual">Set manually</button>
   <input type="range" class="slider" id="scbase" min="0" max="0.85" step="0.01" value="${SCN.base}" style="max-width:200px" aria-label="Manual baseline share"><span class="hint" id="scbaselab"></span></div>
  <div class="chipgrp sep"><span class="gl">Spend ceiling per day</span><input type="range" class="slider" id="sccap" min="1" max="15" step="0.25" value="${SCN.capMult}" aria-label="Spend ceiling multiple"><span class="vlab" id="sccaplab"></span></div>
  <div class="chipgrp"><span class="gl">Absolute daily cap</span><input type="number" id="scabs" placeholder="no cap" min="0" step="250" style="width:150px" aria-label="Absolute daily cap"><span class="hint">Optional hard dollar limit on any single day</span></div>
  <div class="chipgrp"><span class="gl">Total extra budget</span><button class="chip" id="scbudon">Cap the total</button><input type="number" id="scbud" placeholder="additional budget" min="0" step="1000" style="width:170px" aria-label="Total extra budget">
   <span class="hint">When capped, budget goes to the highest marginal return days first</span></div>
  <div class="chipgrp sep"><span class="gl">Apply to</span>${Object.entries(SCOPES).map(([k,[l]])=>`<button class="chip ${k===SCN.scope?'on':''}" data-scs="${k}">${l}</button>`).join('')}</div>
 </div><div id="sckpi"></div></div>
 <div class="sec"><div class="sech"><h2>Rephasing against 2025 actuals</h2><span class="sub">Where the extra money goes, and what it brings back</span></div>
  <div class="ctl" id="scview"><span class="gl">View</span><button class="chip on" data-scr="cum">Cumulative</button><button class="chip" data-scr="daily">Daily</button><button class="chip" data-scr="delta">Increment only</button></div>
  <div class="legend" id="scleg"></div>
  <div class="panel"><div class="chartbox"><canvas id="scph"></canvas></div></div>
  <div class="panel" id="scph2w" style="margin-top:10px"><div class="chartbox xs"><canvas id="scph2"></canvas></div></div>
  <div id="scwk" style="margin-top:12px"></div><div class="src">Weeks run Sunday to Saturday. Shaded rows contain a launch day. Increment columns are scenario minus actual.</div></div>
 <div class="sec"><div class="sech"><h2>Black Friday response curve</h2><span class="sub">The day Livestock most underspent</span></div>
  <div class="two"><div class="panel"><div class="legend"><span><i class="sw ln" style="background:var(--cy)"></i>Modelled net sales</span><span><i class="sw" style="background:var(--ink);border-radius:50%"></i>Actual</span><span><i class="sw" style="background:var(--pos);border-radius:50%"></i>Plan</span></div><div class="chartbox sm"><canvas id="sccurve"></canvas></div></div>
  <div class="panel"><div class="legend"><span><i class="sw ln" style="background:var(--cy)"></i>MER</span><span><i class="sw ln" style="background:var(--s7)"></i>Marginal return</span><span><i class="sw dash" style="border-color:var(--pos)"></i>Target</span></div><div class="chartbox sm"><canvas id="sccurve2"></canvas></div></div></div>
  <div id="scbf" style="margin-top:12px"></div></div>
 <div class="sec"><div class="sech"><h2>The daily plan</h2><span class="sub">Sorted by extra revenue. Click a row to open the day</span></div><div id="sctab"></div>
  <div class="src">"Stopped by" shows what capped spend on each day: the target MER, the per-day ceiling, the total budget, or nothing because the day was already at or below target.</div></div>
 <div class="sec"><div class="sech"><h2>Elasticity evidence</h2><span class="sub">Why the curve is set where it is</span></div>
  <div class="two"><div class="panel"><div class="chartbox sm"><canvas id="scdec"></canvas></div><div class="src">Estimated Google ROAS by spend decile (D1 = lowest-spend tenth of days). A gentle decline means returns diminish slowly.</div></div>
  <div><div class="tw"><table><thead><tr><th class="l">Estimate</th><th>Elasticity</th><th class="l">Basis</th></tr></thead><tbody>
   <tr><td class="l strong">Cross-sectional</td><td class="strong">${ELAS.cs.toFixed(2)}</td><td class="l">Log est. conversion value on log spend, all days</td></tr>
   <tr><td class="l strong">Day over day</td><td class="strong">${ok(ELAS.dod)?ELAS.dod.toFixed(2):'—'}</td><td class="l">Median over ${ELAS.n} spend moves larger than 15%</td></tr>
   <tr><td class="l strong">27 to 28 November</td><td class="strong">${(Math.log(1+ELAS.bf.dv)/Math.log(1+ELAS.bf.ds)).toFixed(2)}</td><td class="l">Spend ${dcellTxt(ELAS.bf.ds).replace(' YoY','')}, est. conversion value ${dcellTxt(ELAS.bf.dv).replace(' YoY','')}</td></tr>
   <tr><td class="l strong">Textbook default</td><td>0.35</td><td class="l">Generic paid media benchmark</td></tr></tbody></table></div></div></div></div>
 <div class="sec"><div class="sech"><h2>Sensitivity</h2><span class="sub">Extra revenue at each elasticity and target, holding current ceilings and scope</span></div><div id="scsens"></div></div>
 <div class="ins" id="scwsw"></div>`;
 const grp=(sel,fn)=>el.querySelectorAll(sel).forEach(b=>b.onclick=()=>{el.querySelectorAll(sel).forEach(x=>x.classList.remove('on'));b.classList.add('on');fn(b);drawSc();});
 grp('.chip[data-sct]',b=>SCN.T=+b.dataset.sct);grp('.chip[data-scm]',b=>SCN.mode=b.dataset.scm);grp('.chip[data-scs]',b=>SCN.scope=b.dataset.scs);grp('.chip[data-scr]',b=>SCN.view=b.dataset.scr);
 $('#scb').oninput=e=>{SCN.b=+e.target.value;drawSc();};$('#scbase').oninput=e=>{SCN.base=+e.target.value;drawSc();};
 $('#sccap').oninput=e=>{SCN.capMult=+e.target.value;drawSc();};$('#scabs').oninput=e=>{SCN.capAbs=+e.target.value||0;drawSc();};
 $('#scbud').oninput=e=>{SCN.budget=+e.target.value||0;if(SCN.useBudget)drawSc();};
 $('#scbudon').onclick=()=>{SCN.useBudget=!SCN.useBudget;$('#scbudon').classList.toggle('on',SCN.useBudget);drawSc();};
 drawSc();}

function drawSc(){const {plan,mStar,sel}=buildPlan(),PI={};plan.forEach(p=>PI[p.d]=p);const act=plan.filter(p=>sel.has(p.d));
 const tS0=sum(plan,'S0'),tS=sum(plan,'S'),tR0=sum(plan,'R0'),tR=sum(plan,'R'),moved=act.filter(p=>p.dS>1);
 $('#scblab').textContent=SCN.b.toFixed(2)+' · fitted '+ELAS.cs.toFixed(2)+', textbook 0.35'+(SCN.b>=0.8?' · optimistic':SCN.b<=0.5?' · conservative':'');
 $('#scbaselab').textContent=SCN.mode==='anchor'?'calibrated per day from est. ROAS (slider not in use)':'manual: '+pc(SCN.base,0)+' of net sales is baseline';
 $('#sccaplab').textContent=SCN.capMult.toFixed(2)+'x actual spend'+(SCN.capAbs>0?' or '+m0(SCN.capAbs)+', whichever is lower':'');
 const bc=k=>act.filter(p=>p.bind===k).length;
 $('#sckpi').innerHTML=`<div class="kpis">${[['Days scaled',n0(moved.length)+' of '+n0(act.length)],['Additional spend',m0(tS-tS0)],['Additional revenue',m0(tR-tR0)],
  ['Return on the increment',xx((tS-tS0)?(tR-tR0)/(tS-tS0):null)],['Revenue uplift',pc(tR0?(tR-tR0)/tR0:null,1)],['Quarter net sales',kk(tR)],['Quarter Google spend',kk(tS)],['Quarter MER',xx(tR/tS)]]
  .map(([l,v])=>kpi(l,v)).join('')}</div>
  <div class="bindbar" role="img" aria-label="Binding constraints across scoped days">${['target MER','spend ceiling','budget','none'].map(k=>{const n=bc(k);return n?`<div style="flex:${n};background:${BINDC[k]}" title="${k}: ${n} days">${n>3?k+' · '+n:''}</div>`:'';}).join('')}</div>
  <div class="legend">${['target MER','spend ceiling','budget','none'].map(k=>`<span><i class="sw" style="background:${BINDC[k]}"></i>${k==='none'?'already at or below target':k} · ${bc(k)} days</span>`).join('')}</div>
  ${SCN.useBudget&&SCN.budget>0?`<div class="src">Budget capped at ${m0(SCN.budget)}. Allocated down to a marginal return of ${xx(mStar)}, so every extra dollar is expected to return at least that.</div>`:''}`;
 drawPhase(plan,PI);drawBF(PI);
 table($('#sctab'),[{k:'d',t:'Date',l:1,cls:'strong',f:p=>fd(p.d)},{k:'per',t:'Period',l:1,v:p=>periodOf(p.d).n,f:p=>dayTags(p.d)},{k:'ln',t:'Launch',l:1,v:p=>isLaunch(p.d)?1:0,f:p=>launchBadge(p.d)},
  {k:'S0',t:'Actual spend',f:p=>m0(p.S0)},{k:'S',t:'Plan spend',f:p=>p.dS<=1?'<span class="muted">no change</span>':'<b>'+m0(p.S)+'</b>'},{k:'dS',t:'Extra',f:p=>p.dS<=1?'—':m0(p.dS)},
  {k:'mult',t:'Multiple',v:p=>p.S/p.S0,f:p=>p.dS<=1?'—':(p.S/p.S0).toFixed(2)+'x'},{k:'R0',t:'Actual net',f:p=>m0(p.R0)},{k:'R',t:'Plan net',f:p=>p.dS<=1?'—':m0(p.R)},
  {k:'dR',t:'Extra revenue',f:p=>p.dS<=1?'—':`<span class="up">${m0(p.dR)}</span>`},{k:'mer0',t:'Actual MER',f:p=>`<span class="${p.mer0>=SCN.T?'up':'down'}">${xx(p.mer0)}</span>`},
  {k:'mer1',t:'Plan MER',f:p=>p.dS<=1?'—':xx(p.mer1)},{k:'marg',t:'Marginal',f:p=>p.dS<=1?'—':xx(p.marg)},{k:'bind',t:'Stopped by',l:1,f:p=>`<span class="pdot" style="background:${BINDC[p.bind]||'transparent'}"></span>${esc(p.bind)}`}],
  act.slice().sort((a,b)=>b.dR-a.dR),{click:'d',onclick:openDay,h:520,rowcls:p=>isLaunch(p.d)?'hl':''});
 mk('scdec',{type:'bar',data:{labels:ELAS.dec.map(d=>'D'+d.d),datasets:[{label:'Est. Google ROAS',data:ELAS.dec.map(d=>d.roas),backgroundColor:css('--cy')}]},
  options:barOpts('num',false,{plugins:{tooltip:{callbacks:{label:c=>' Est. ROAS '+xx(c.raw)+' · avg spend '+m0(ELAS.dec[c.dataIndex].spend)}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:css('--grid')},ticks:{callback:v=>v+'x'}}}})});
 const betas=[0.45,0.60,0.65,0.75,0.85,0.95],targs=[20,25,30,40,50,60],save={...SCN};
 let h=`<div class="tw"><table><thead><tr><th class="l">Extra revenue</th>${targs.map(t=>`<th>Target ${t}x</th>`).join('')}</tr></thead><tbody>`;
 betas.forEach(b=>{SCN.b=b;h+=`<tr><td class="l strong">Elasticity ${b.toFixed(2)}${Math.abs(b-save.b)<0.005?' <span class="badge">current</span>':''}</td>`;
  targs.forEach(t=>{SCN.T=t;const {plan:p2,sel:s2}=buildPlan();const a2=p2.filter(x=>s2.has(x.d));const dR=a2.reduce((x,y)=>x+Math.max(0,y.dR),0),dS=a2.reduce((x,y)=>x+Math.max(0,y.dS),0);
   h+=`<td class="${Math.abs(b-save.b)<0.005&&t===save.T?'cur':''}"><b>${m0(dR)}</b><br><span class="muted" style="font-size:10.5px">on ${m0(dS)} · ${xx(dS?dR/dS:null)}</span></td>`;});h+='</tr>';});
 Object.assign(SCN,save);$('#scsens').innerHTML=h+'</tbody></table></div>';
 const bf=DI['2025-11-28'],pbf=PI['2025-11-28'];
 $('#scwsw').innerHTML=`<div><h4>What</h4><p>Holding a ${SCN.T}x MER with a ${SCN.capMult.toFixed(2)}x daily ceiling implies <b>${m0(tS-tS0)}</b> more Google spend across ${n0(moved.length)} days. That returns <b>${m0(tR-tR0)}</b> more net sales, ${xx((tS-tS0)?(tR-tR0)/(tS-tS0):null)} on the increment. Black Friday moves from ${m0(bf.g_cost)} to ${m0(pbf.S)} of spend, and from ${m0(bf.net)} to ${m0(pbf.R)}.</p></div>
  <div><h4>So what</h4><p>At ${SCN.b.toFixed(2)} elasticity, Livestock's Google spend is small relative to its sales. Quarter MER was ${xx(tR0/tS0)}, so even large percentage increases are small dollars. On launch and peak days the binding constraint is usually the per-day ceiling, not the MER guardrail, which means budget, not demand, held those days back.</p></div>
  <div><h4>What's next</h4><p>Set peak-day budgets from an MER guardrail rather than a flat daily cap, with authority to release more spend intraday on launch days. Shift money from the low-return generic Shopping traffic to launch and BFCM days. Add conversion value to the Ads export so the model can anchor on real ROAS instead of an estimate.</p></div>`;}

const BINDC={'target MER':'var(--s3)','spend ceiling':'var(--s2)','budget':'var(--s7)','none':'var(--bau)','out of scope':'transparent'};

function drawPhase(plan,PI){const v=SCN.view;let cS0=0,cS=0,cR0=0,cR=0;const aS0=[],aS=[],aR0=[],aR=[];
 D.forEach(r=>{const p=PI[r.d]||{S0:r.g_cost||0,S:r.g_cost||0,R0:r.net,R:r.net};cS0+=p.S0;cS+=p.S;cR0+=p.R0;cR+=p.R;aS0.push(cS0);aS.push(cS);aR0.push(cR0);aR.push(cR);});
 const leg=(a,b)=>`<span><i class="sw ${v==='delta'?'':'ln'}" style="background:var(--pos)"></i>${a}</span><span><i class="sw ${v==='delta'?'':'ln'}" style="background:${v==='delta'?'var(--s7)':'var(--cy)'}"></i>${b}</span><span><i class="sw" style="background:var(--launch);opacity:.35"></i>Launch day</span>`;
 const launchBg={id:'launchBg',beforeDatasetsDraw(c){const x=c.scales.x,ar=c.chartArea,ctx=c.ctx,w=(ar.right-ar.left)/D.length;ctx.save();ctx.fillStyle=css('--launch');ctx.globalAlpha=.10;
  D.forEach((r,i)=>{if(isLaunch(r.d)){const px=x.getPixelForValue(i);ctx.fillRect(px-w/2,ar.top,w,ar.bottom-ar.top);}});ctx.restore();}};
 const click={onClick:(e,els)=>{if(els.length)openDay(D[els[0].index].d);}};
 if(v==='delta'){$('#scleg').innerHTML=leg('Extra net sales','Extra spend (shown below zero)');$('#scph2w').style.display='none';
  mk('scph',{type:'bar',data:{labels:LABELS,datasets:[{label:'Extra net sales',data:D.map(r=>(PI[r.d]||{}).dR||0),backgroundColor:css('--pos')},{label:'Extra spend',data:D.map(r=>-((PI[r.d]||{}).dS||0)),backgroundColor:css('--s7')}]},
   plugins:[launchBg],options:barOpts('money',false,Object.assign({scales:{x:{stacked:true,grid:{display:false},ticks:{maxRotation:0,autoSkipPadding:14}},y:{stacked:true,grid:{color:css('--grid')},ticks:{callback:v=>kk(v)}}},
    plugins:{tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+m0(Math.abs(c.raw))}}}},click))});return;}
 $('#scph2w').style.display='';
 const cum=v==='cum';$('#scleg').innerHTML=leg(cum?'Plan, cumulative':'Plan','Actual 2025'+(cum?', cumulative':''));
 const dsR=cum?[cyDs('Plan net sales',aR,{borderColor:css('--pos'),backgroundColor:css('--pos')}),cyDs('Actual net sales',aR0)]:
  [{label:'Plan net sales',data:D.map(r=>(PI[r.d]||{}).R??r.net),backgroundColor:css('--pos')},{label:'Actual net sales',data:D.map(r=>r.net),backgroundColor:css('--cy')}];
 const dsS=cum?[cyDs('Plan spend',aS,{borderColor:css('--pos'),backgroundColor:css('--pos')}),cyDs('Actual spend',aS0)]:
  [cyDs('Plan spend',D.map(r=>(PI[r.d]||{}).S??r.g_cost),{borderColor:css('--pos'),backgroundColor:css('--pos')}),cyDs('Actual spend',D.map(r=>r.g_cost))];
 mk('scph',{type:cum?'line':'bar',data:{labels:LABELS,datasets:dsR},plugins:[launchBg],options:Object.assign(cum?lineOpts('money'):barOpts('money',false,{datasets:{bar:{borderRadius:2,maxBarThickness:10,categoryPercentage:.9,barPercentage:.9}}}),click,
  {plugins:{title:{display:true,text:'Net sales: '+(cum?'cumulative ':'daily ')+'plan against actual',color:css('--ink2'),align:'start'},tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+m0(c.raw)}}}})});
 mk('scph2',{type:'line',data:{labels:LABELS,datasets:dsS},plugins:[launchBg],options:Object.assign(lineOpts('money'),{plugins:{title:{display:true,text:'Google Ads spend: '+(cum?'cumulative':'daily'),color:css('--ink2'),align:'start'},tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+m0(c.raw)}}}})});
 const wk=[];D.forEach(r=>{const dt=dl(r.d);dt.setDate(dt.getDate()-dt.getDay());const k=dt.toISOString().slice(0,10);let e=wk.find(x=>x.k===k);if(!e){e={k,ds:[]};wk.push(e);}e.ds.push(r.d);});
 const T0=sum(plan,'S0'),T1=sum(plan,'S');
 const rows=wk.map(w=>{const ps=w.ds.map(d=>PI[d]).filter(Boolean);const S0=sum(ps,'S0'),S=sum(ps,'S'),R0=sum(ps,'R0'),R=sum(ps,'R');
  return {k:w.k,s:w.ds[0],e:w.ds[w.ds.length-1],lc:w.ds.filter(isLaunch).length,S0,S,dS:S-S0,sh:(T1-T0)?(S-S0)/(T1-T0):null,R0,R,dR:R-R0,up:R0?(R-R0)/R0:null,m0:R0/S0,m1:R/S,mg:(S-S0)>1?(R-R0)/(S-S0):null};});
 table($('#scwk'),[{k:'k',t:'Week',l:1,cls:'strong',f:r=>fds(r.s)+' – '+fds(r.e)},{k:'per',t:'Period',l:1,v:r=>periodOf(r.s).n,f:r=>dayTags(r.s)},{k:'lc',t:'Launches',f:r=>r.lc?`<span class="badge">${r.lc}</span>`:'—'},
  {k:'S0',t:'Actual spend',f:r=>m0(r.S0)},{k:'S',t:'Plan spend',f:r=>'<b>'+m0(r.S)+'</b>'},{k:'dS',t:'Extra spend',f:r=>m0(r.dS)},{k:'sh',t:'% of extra',f:r=>pc(r.sh,1)},
  {k:'R0',t:'Actual net',f:r=>m0(r.R0)},{k:'R',t:'Plan net',f:r=>m0(r.R)},{k:'dR',t:'Extra revenue',f:r=>`<span class="up">${m0(r.dR)}</span>`},{k:'up',t:'Uplift',f:r=>pc(r.up,1)},
  {k:'m0',t:'Actual MER',f:r=>`<span class="${r.m0>=SCN.T?'up':'down'}">${xx(r.m0)}</span>`},{k:'m1',t:'Plan MER',f:r=>xx(r.m1)},{k:'mg',t:'Marginal',f:r=>xx(r.mg)}],rows,{rowcls:r=>r.lc?'hl':''});}

function drawBF(PI){const bf=DI['2025-11-28'],pbf=PI['2025-11-28'];const at=T2=>{const sv=SCN.T;SCN.T=T2;const p=planDay(bf,null);SCN.T=sv;return p;};
 const xs=[];const top=Math.max(SCN.capMult,12);for(let m=1;m<=top+1e-9;m+=top/56)xs.push(bf.g_cost*m);
 const lab=xs.map(x=>m0(x));
 const pt=(S)=>{let i=0,b=1e18;xs.forEach((x,j)=>{if(Math.abs(x-S)<b){b=Math.abs(x-S);i=j;}});return i;};
 const ia=pt(bf.g_cost),ip=pt(pbf.S);
 mk('sccurve',{type:'line',data:{labels:lab,datasets:[cyDs('Modelled net sales',xs.map(x=>respR(bf,x))),
  {type:'line',label:'Actual',data:xs.map((x,i)=>i===ia?bf.net:null),pointRadius:7,pointBackgroundColor:css('--ink'),borderWidth:0,showLine:false},
  {type:'line',label:'Plan',data:xs.map((x,i)=>i===ip?pbf.R:null),pointRadius:8,pointBackgroundColor:css('--pos'),borderWidth:0,showLine:false}]},
  options:lineOpts('money',{plugins:{title:{display:true,text:'Black Friday net sales as Google spend rises',color:css('--ink2'),align:'start'},tooltip:{filter:c=>c.raw!=null,callbacks:{title:i=>'Spend '+i[0].label,label:c=>' '+c.dataset.label+': '+m0(c.raw)}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0}},y:{grid:{color:css('--grid')},ticks:{callback:v=>kk(v)}}}})});
 mk('sccurve2',{type:'line',data:{labels:lab,datasets:[cyDs('MER',xs.map(x=>respR(bf,x)/x)),cyDs('Marginal return',xs.map(x=>margAt(bf,x)),{borderColor:css('--s7'),backgroundColor:css('--s7')}),
  pyDs('Target '+SCN.T+'x',xs.map(()=>SCN.T),{borderColor:css('--pos')})]},
  options:lineOpts('num',{plugins:{title:{display:true,text:'MER and marginal return as spend rises',color:css('--ink2'),align:'start'},tooltip:{callbacks:{title:i=>'Spend '+i[0].label,label:c=>' '+c.dataset.label+': '+xx(c.raw)}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,maxRotation:0}},y:{beginAtZero:true,grid:{color:css('--grid')},ticks:{callback:v=>v+'x'}}}})});
 const rows=[['Target 50x',at(50)],['Target 30x',at(30)],['Current settings',pbf]];
 $('#scbf').innerHTML=`<div class="tw"><table><thead><tr><th class="l">Scenario</th><th>Spend</th><th>Net sales</th><th>MER</th><th>Extra spend</th><th>Extra revenue</th><th>Marginal</th><th class="l">Stopped by</th></tr></thead><tbody>
  <tr><td class="l strong">Actual 2025</td><td>${m0(bf.g_cost)}</td><td class="strong">${m0(bf.net)}</td><td>${xx(bf.net/bf.g_cost)}</td><td>—</td><td>—</td><td>—</td><td class="l">budget</td></tr>
  ${rows.map(([l,p])=>`<tr class="${l==='Current settings'?'hl':''}"><td class="l strong">${l}</td><td>${m0(p.S)}</td><td class="strong">${m0(p.R)}</td><td>${xx(p.mer1)}</td><td>${m0(p.dS)}</td><td class="up">${m0(p.dR)}</td><td>${xx(p.marg)}</td><td class="l">${p.bind}</td></tr>`).join('')}</tbody></table></div>
  <div class="src">Anchor: marginal return at the ${m0(bf.g_cost)} actually spent is set to ${xx(estRoas(bf))}, the estimated Google ROAS that day. From 27 to 28 Nov, Google spend rose ${dcellTxt(ELAS.bf.ds).replace(' YoY','')} and estimated conversion value rose ${dcellTxt(ELAS.bf.dv).replace(' YoY','')}. Site conversion went from ${pc(DI['2025-11-27'].cvr)} to ${pc(bf.cvr)}. Nothing in the day suggests saturation.</div>`;}
