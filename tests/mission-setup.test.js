const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
const FIELDS=['date','time','name','type','navigator','rank','ship'];

(async () => {
  const b=await chromium.launch(launchOpts());
  const p=await b.newPage({viewport:{width:1000,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const ok=[];
  const store=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('ucn_nav_radar_waypoints')));

  await p.goto(appUrl());

  // --- tab present and first -------------------------------------------
  ok.push(['9 tabs, setup first', await p.evaluate(()=>{
    const t=[...document.querySelectorAll('.tab-btn')];
    return t.length===9 && t[0].id==='tab-mission-setup';
  })]);
  await p.locator('#tab-mission-setup').click();
  ok.push(['setup panel visible', await p.locator('#panel-mission-setup').isVisible()]);
  ok.push(['all 7 fields present', await p.evaluate(f=>f.every(k=>!!document.getElementById('mission-'+k)), FIELDS)]);
  ok.push(['date input is type=date', (await p.locator('#mission-date').getAttribute('type'))==='date']);
  ok.push(['time input is type=time', (await p.locator('#mission-time').getAttribute('type'))==='time']);
  ok.push(['empty state shown', /No mission setup recorded/.test(await p.locator('#missionSummary').textContent())]);

  // --- saves as you type -------------------------------------------------
  await p.locator('#mission-name').fill('Operation Longshore');
  await p.locator('#mission-type').fill('Escort');
  await p.locator('#mission-navigator').fill('Fin Tetra');
  await p.locator('#mission-rank').fill('Lt');
  await p.locator('#mission-ship').fill('UCN Hydra');
  await p.locator('#mission-date').fill('2026-09-01');
  await p.locator('#mission-time').fill('14:30');
  let s=await store();
  ok.push(['saved to storage without a save button', s.mission && s.mission.name==='Operation Longshore', JSON.stringify(s.mission)]);
  ok.push(['all 7 keys persisted', FIELDS.every(k=>s.mission[k]), JSON.stringify(s.mission)]);
  ok.push(['schema bumped to v3', s.version===3, s.version]);
  ok.push(['summary lists values', /UCN Hydra/.test(await p.locator('#missionSummary').textContent())]);

  // --- survives reload ---------------------------------------------------
  await p.reload();
  await p.locator('#tab-mission-setup').click();
  ok.push(['reload restores form values', (await p.locator('#mission-name').inputValue())==='Operation Longshore']);

  // --- Now button --------------------------------------------------------
  await p.locator('#missionNowBtn').click();
  const nowVals=await p.evaluate(()=>({d:document.getElementById('mission-date').value,t:document.getElementById('mission-time').value}));
  ok.push(['Now sets date + time', /^\d{4}-\d{2}-\d{2}$/.test(nowVals.d) && /^\d{2}:\d{2}$/.test(nowVals.t), JSON.stringify(nowVals)]);
  ok.push(['Now did not touch other fields', (await p.locator('#mission-ship').inputValue())==='UCN Hydra']);

  // --- export carries mission -------------------------------------------
  await p.evaluate(()=>{const f=document.querySelector('form.wp-form[data-cat="nav"]');
    f.elements.number.value='01';f.elements.title.value='Turn Alpha';f.elements.sector.value='G-4';f.elements.description.value='x';
    f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  const exported=await p.evaluate(()=>localStorage.getItem('ucn_nav_radar_waypoints'));
  const ex=JSON.parse(exported);
  ok.push(['payload has version/mission/waypoints', ['version','mission','waypoints'].every(k=>k in ex), Object.keys(ex).join(',')]);

  // --- import into an EMPTY setup adopts it ------------------------------
  await p.evaluate(()=>localStorage.removeItem('ucn_nav_radar_waypoints'));
  await p.reload();
  await p.evaluate(t=>{const i=document.getElementById('importInput');const dt=new DataTransfer();
    dt.items.add(new File([t],'m.json',{type:'application/json'})); i.files=dt.files; i.dispatchEvent(new Event('change'));}, exported);
  await p.waitForTimeout(300);
  let s2=await store();
  ok.push(['import adopts mission when ours is empty', s2.mission.ship==='UCN Hydra', JSON.stringify(s2.mission)]);
  ok.push(['import says so', /Mission setup adopted/.test(await p.locator('#notice').textContent())]);
  await p.locator('#tab-mission-setup').click();
  ok.push(['adopted values appear in the form', (await p.locator('#mission-ship').inputValue())==='UCN Hydra']);

  // --- import into a FILLED setup must not overwrite ---------------------
  await p.locator('#mission-ship').fill('UCN Kestrel');
  const other=JSON.stringify({version:3,mission:{name:'Other Op',ship:'UCN Wrong'},waypoints:[]});
  await p.evaluate(t=>{const i=document.getElementById('importInput');const dt=new DataTransfer();
    dt.items.add(new File([t],'o.json',{type:'application/json'})); i.files=dt.files; i.dispatchEvent(new Event('change'));}, other);
  await p.waitForTimeout(300);
  let s3=await store();
  ok.push(['existing mission setup NOT overwritten', s3.mission.ship==='UCN Kestrel', JSON.stringify(s3.mission)]);
  ok.push(['import reports it was ignored', /ignored because this one is already filled in/.test(await p.locator('#notice').textContent())]);

  // --- hostile input is text only ---------------------------------------
  const nasty=JSON.stringify({version:3,mission:{name:'<img src=x onerror=alert(1)>',ship:{evil:true},rank:42},waypoints:[]});
  await p.evaluate(()=>localStorage.removeItem('ucn_nav_radar_waypoints'));
  await p.reload();
  await p.evaluate(t=>{const i=document.getElementById('importInput');const dt=new DataTransfer();
    dt.items.add(new File([t],'x.json',{type:'application/json'})); i.files=dt.files; i.dispatchEvent(new Event('change'));}, nasty);
  await p.waitForTimeout(300);
  await p.locator('#tab-mission-setup').click();
  ok.push(['markup in imported text is escaped, not rendered',
    (await p.locator('#missionSummary').evaluate(e=>e.innerHTML)).includes('&lt;img'),
    (await p.locator('#missionSummary').evaluate(e=>e.innerHTML)).slice(0,120)]);
  ok.push(['no img element injected', (await p.locator('#missionSummary img').count())===0]);
  const s4=await store();
  ok.push(['non-string values dropped', s4.mission.ship==='' && s4.mission.rank==='42', JSON.stringify(s4.mission)]);

  // --- clear -------------------------------------------------------------
  await p.locator('#missionClearBtn').click();
  const s5=await store();
  ok.push(['clear empties every key', FIELDS.every(k=>s5.mission[k]===''), JSON.stringify(s5.mission)]);
  ok.push(['empty state returns', /No mission setup recorded/.test(await p.locator('#missionSummary').textContent())]);

  // --- v2 payload (no mission) still loads -------------------------------
  await p.evaluate(()=>localStorage.setItem('ucn_nav_radar_waypoints', JSON.stringify({version:2,waypoints:[
    {id:'a',category:'nav',number:'1',title:'Old leg',sector:'',description:'',createdAt:new Date().toISOString(),completedAt:null,outcome:''}]})));
  await p.reload();
  ok.push(['v2 payload loads', (await p.locator('#list-all .wp-item[data-id]').count())===1]);
  await p.locator('#tab-mission-setup').click();
  ok.push(['v2 payload yields empty setup', /No mission setup recorded/.test(await p.locator('#missionSummary').textContent())]);

  await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length)console.log('JS ERRORS: '+errs.join(' | '));
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' passed, '+errs.length+' js errors');
  process.exit(failed||errs.length?1:0);
})();
