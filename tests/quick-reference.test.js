const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
(async()=>{
  const b=await chromium.launch(launchOpts());
  const ok=[]; const errs=[];
  const p=await b.newPage({viewport:{width:375,height:552},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto(appUrl());
  await p.locator('#quickRefBtn').click();
  await p.waitForTimeout(200);

  const toggles=p.locator('#refOverlay .ref-toggle');
  ok.push(['5 section buttons', (await toggles.count())===5, await toggles.count()]);
  ok.push(['button labels intact', JSON.stringify((await toggles.allTextContents()).map(t=>t.replace(/[^\w\s\/]/g,'').trim()))
    .includes('Ship Types')]);
  ok.push(['all collapsed on open', (await p.locator('#refOverlay .ref-body:not([hidden])').count())===0]);
  ok.push(['aria-expanded false initially', (await toggles.first().getAttribute('aria-expanded'))==='false']);

  // modal is now short enough not to scroll
  const m1=await p.evaluate(()=>{const e=document.querySelector('#refOverlay .modal');
    return {h:Math.round(e.getBoundingClientRect().height), scroll:e.scrollHeight>e.clientHeight+2};});
  ok.push(['panel fits without scrolling when collapsed', !m1.scroll, 'h='+m1.h]);

  // expand one
  await toggles.nth(1).click();
  ok.push(['clicking a button reveals its content', await p.locator('#refpanel-1').isVisible()]);
  ok.push(['aria-expanded true', (await toggles.nth(1).getAttribute('aria-expanded'))==='true']);
  ok.push(['others stay closed', (await p.locator('#refOverlay .ref-body:not([hidden])').count())===1]);
  ok.push(['radar colours are the revealed content',
    /RED — Gravity/.test(await p.locator('#refpanel-1').textContent())]);

  // collapse again
  await toggles.nth(1).click();
  ok.push(['clicking again hides it', (await p.locator('#refOverlay .ref-body:not([hidden])').count())===0]);

  // keyboard
  await toggles.nth(0).focus();
  await p.keyboard.press('Enter');
  ok.push(['keyboard operable', await p.locator('#refpanel-0').isVisible()]);
  ok.push(['ship grid still populated inside the panel',
    (await p.locator('#refpanel-0 .ship-card').count())===13]);

  // compass still renders after being moved into a panel
  await toggles.nth(4).click();
  ok.push(['compass still renders', (await p.locator('#refpanel-4 #compassWrap svg').count())===1]);
  const labels=await p.locator('#refpanel-4 #compassWrap text').allTextContents();
  ok.push(['compass cardinals intact', labels.includes('90')&&labels.includes('270'), labels.length+' labels']);

  // state persists across close/reopen within the session
  await p.keyboard.press('Escape');
  await p.locator('#quickRefBtn').click();
  await p.waitForTimeout(150);
  ok.push(['open sections persist on reopen', (await p.locator('#refOverlay .ref-body:not([hidden])').count())===2]);

  // completion dialog's section must NOT have become collapsible
  await p.keyboard.press('Escape');
  await p.evaluate(()=>{const f=document.querySelector('form.wp-form[data-cat="nav"]');
    f.elements.number.value='01';f.elements.title.value='T';f.elements.sector.value='';f.elements.description.value='';
    f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await p.locator('#tab-nav').click();
  await p.locator('#panel-nav .wp-item button.row').first().click();
  await p.locator('#panel-nav .wp-item .btn-complete').first().click();
  await p.waitForTimeout(150);
  ok.push(['completion dialog unaffected', (await p.locator('#completeOverlay .ref-toggle').count())===0]);
  ok.push(['quick outcomes still visible', await p.locator('#outcomeGrid .outcome-btn').first().isVisible()]);

  await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length)console.log('JS ERRORS: '+errs.join(' | '));
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' passed, '+errs.length+' js errors');
  process.exit(failed||errs.length?1:0);
})();
