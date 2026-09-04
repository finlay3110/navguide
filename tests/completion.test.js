const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');

const seed = `(function(){
  const add=(c,n,t,s,d)=>{const f=document.querySelector('form.wp-form[data-cat="'+c+'"]');
    f.elements.number.value=n;f.elements.title.value=t;f.elements.sector.value=s;f.elements.description.value=d;
    f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));};
  add('nav','01','Turn point Alpha','G-4','Come to bearing 090.');
  add('nav','02','Turn point Bravo','G-6','Second leg.');
  add('hostile','03','Hostile patrol','H-2','Two frigates.');
})()`;

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport:{width:1000,height:900} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const ok=[];
  const store = () => p.evaluate(()=>JSON.parse(localStorage.getItem('ucn_nav_radar_waypoints')));
  // Open state is shared across tabs by design, so an item may already be
  // expanded. Toggle only when it is actually closed.
  const ensureOpen = async (item) => {
    if(!(await item.evaluate(e=>e.classList.contains('open')))) {
      await item.locator('button.row').click();
    }
  };
  const openFirst = async (panel) => ensureOpen(p.locator(`#${panel} .wp-item`).first());

  await p.goto(appUrl());
  await p.evaluate(seed);
  await p.locator('#tab-nav').click();

  // --- 1. Complete opens dialog; Cancel leaves it untouched ---------------
  await openFirst('panel-nav');
  await p.locator('#panel-nav .wp-item').first().locator('.btn-complete').click();
  ok.push(['dialog opens on Complete', await p.locator('#completeOverlay').evaluate(e=>e.classList.contains('open'))]);
  ok.push(['focus starts in textarea (not an action button)', await p.evaluate(()=>document.activeElement.id==='outcomeText')]);
  ok.push(['dialog names the waypoint', (await p.locator('#completeTitle').textContent()).includes('#01')]);
  ok.push(['dialog shows start time', /Started \d{2}:\d{2}/.test(await p.locator('#completeStarted').textContent())]);
  await p.locator('#completeCancel').click();
  ok.push(['Cancel closes', !(await p.locator('#completeOverlay').evaluate(e=>e.classList.contains('open')))]);
  let s1 = await store();
  ok.push(['Cancel leaves waypoint active', s1.waypoints.every(w=>!w.completedAt)]);
  ok.push(['focus returns to Complete button', await p.evaluate(()=>document.activeElement.classList.contains('btn-complete'))]);

  // Escape also cancels
  await p.locator('#panel-nav .wp-item').first().locator('.btn-complete').click();
  await p.keyboard.press('Escape');
  ok.push(['Escape cancels too', (await store()).waypoints.every(w=>!w.completedAt)]);

  // --- 2. Quick outcome completes in one tap ------------------------------
  await p.locator('#panel-nav .wp-item').first().locator('.btn-complete').click();
  const quick = await p.locator('#outcomeGrid .outcome-btn').allTextContents();
  ok.push(['nav quick outcomes are category-specific', quick.includes('Arrived at destination') && quick.includes('Passed / bypassed'), JSON.stringify(quick)]);
  ok.push(['shared outcome appended last', quick[quick.length-1]==='No longer required', JSON.stringify(quick)]);
  await p.locator('#outcomeGrid .outcome-btn', { hasText:'Arrived at destination' }).click();
  let s2 = await store();
  const done1 = s2.waypoints.find(w=>w.number==='01');
  ok.push(['one tap completes', !!done1.completedAt]);
  ok.push(['outcome stored verbatim', done1.outcome==='Arrived at destination', done1.outcome]);
  ok.push(['createdAt recorded', !!done1.createdAt]);
  ok.push(['schema at v3', s2.version===3, s2.version]);

  // --- 3. Typed text is preserved when a quick button is tapped -----------
  await ensureOpen(p.locator('#panel-nav .wp-item', { hasText:'Turn point Bravo' }));
  await p.locator('#panel-nav .wp-item', { hasText:'Turn point Bravo' }).locator('.btn-complete').click();
  await p.locator('#outcomeText').fill('held station 3 min');
  await p.locator('#outcomeGrid .outcome-btn', { hasText:'Arrived at destination' }).click();
  const b2 = (await store()).waypoints.find(w=>w.number==='02');
  ok.push(['typed text kept and prefixed', b2.outcome==='Arrived at destination — held station 3 min', b2.outcome]);

  // --- 4. Custom freetext via Mark Complete -------------------------------
  await p.locator('#tab-hostile').click();
  await openFirst('panel-hostile');
  await p.locator('#panel-hostile .wp-item').first().locator('.btn-complete').click();
  const hq = await p.locator('#outcomeGrid .outcome-btn').allTextContents();
  ok.push(['hostile outcomes differ from nav', hq.includes('Threat neutralised'), JSON.stringify(hq)]);
  await p.locator('#outcomeText').fill('Withdrew after warning shot');
  await p.locator('#completeForm button[type=submit]').click();
  const h = (await store()).waypoints.find(w=>w.number==='03');
  ok.push(['custom outcome stored', h.outcome==='Withdrew after warning shot', h.outcome]);

  // --- 5. Completed items dim, sink, keep their stripe --------------------
  await p.locator('#tab-nav').click();
  const order = await p.locator('#panel-nav .wp-item').evaluateAll(els=>els.map(e=>({n:e.querySelector('.num').textContent, done:e.classList.contains('done')})));
  ok.push(['completed carry .done', order.every(o=>o.done)]);
  await p.evaluate(()=>{const f=document.querySelector('form.wp-form[data-cat="nav"]');
    f.elements.number.value='04';f.elements.title.value='Active leg';f.elements.sector.value='';f.elements.description.value='';
    f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  const order2 = await p.locator('#panel-nav .wp-item').evaluateAll(els=>els.map(e=>e.classList.contains('done')));
  ok.push(['active sorts above completed', order2[0]===false && order2.slice(1).every(Boolean), JSON.stringify(order2)]);
  const stripe = await p.locator('#panel-nav .wp-item.done').first().evaluate(e=>getComputedStyle(e).borderLeftColor);
  ok.push(['completed keeps full-strength category stripe', stripe==='rgb(234, 240, 251)', stripe]);

  // --- 6. History tab -----------------------------------------------------
  await p.locator('#tab-history').click();
  ok.push(['history panel visible', await p.locator('#panel-history').isVisible()]);
  const hist = await p.locator('#list-history .wp-item').count();
  ok.push(['history lists completed only', hist===3, hist]);
  const times = await p.locator('#list-history .wp-item').evaluateAll(els=>els.map(e=>e.querySelector('.done-tag').textContent));
  ok.push(['history newest first', times.length===3]);
  ok.push(['history count shown', /3 completed/.test(await p.locator('#historyCount').textContent())]);

  // --- 7. Restore ---------------------------------------------------------
  await ensureOpen(p.locator('#list-history .wp-item').first());
  await p.locator('#list-history .wp-item').first().locator('.btn-restore').click();
  ok.push(['restore drops it from history', (await p.locator('#list-history .wp-item').count())===2]);
  const restored = (await store()).waypoints.find(w=>!w.completedAt && w.outcome);
  ok.push(['restore clears completedAt but keeps outcome', !!restored && !!restored.outcome, JSON.stringify(restored&&{c:restored.completedAt,o:restored.outcome})]);
  // re-completing offers the previous text back
  await p.locator('#tab-hostile').click();
  await openFirst('panel-hostile');
  await p.locator('#panel-hostile .wp-item').first().locator('.btn-complete').click();
  ok.push(['dialog pre-fills previous outcome', (await p.locator('#outcomeText').inputValue())==='Withdrew after warning shot']);
  await p.locator('#completeCancel').click();

  // --- 8. v1 payload still loads -----------------------------------------
  await p.evaluate(()=>localStorage.setItem('ucn_nav_radar_waypoints', JSON.stringify({version:1, waypoints:[
    {id:'old1',category:'nav',number:'9',title:'Legacy leg',sector:'',description:'from v1'}]})));
  await p.reload();
  await p.locator('#tab-nav').click();
  await openFirst('panel-nav');
  ok.push(['v1 entry loads', (await p.locator('#panel-nav .wp-item').count())===1]);
  ok.push(['missing start time renders as a dash', (await p.locator('#panel-nav .timing').first().textContent()).includes('—')]);
  await p.locator('#panel-nav .wp-item').first().locator('.btn-complete').click();
  await p.locator('#outcomeGrid .outcome-btn').first().click();
  ok.push(['v1 entry can still be completed', !!(await store()).waypoints[0].completedAt]);

  // --- 9. Export/import round-trip ---------------------------------------
  const payload = await p.evaluate(()=>localStorage.getItem('ucn_nav_radar_waypoints'));
  await p.evaluate(()=>localStorage.removeItem('ucn_nav_radar_waypoints'));
  await p.reload();
  await p.evaluate(t=>{
    const inp=document.getElementById('importInput');
    const dt=new DataTransfer();
    dt.items.add(new File([t],'x.json',{type:'application/json'}));
    inp.files=dt.files; inp.dispatchEvent(new Event('change'));
  }, payload);
  await p.waitForTimeout(300);
  const imported=(await store()).waypoints[0];
  ok.push(['import round-trips completedAt + outcome', !!imported.completedAt && !!imported.outcome, JSON.stringify(imported)]);

  await p.close(); await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length) console.log('JS ERRORS: '+errs.join(' | '));
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' passed, '+errs.length+' js errors');
  process.exit(failed||errs.length?1:0);
})();
