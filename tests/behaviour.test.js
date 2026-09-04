const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/fonts.googleapis|net::ERR/.test(m.text())) errors.push('CONSOLE: '+m.text()); });
  await page.goto(appUrl());
  const ok = [];
  const ensureOpen = async item => { if(!(await item.evaluate(e=>e.classList.contains('open')))) await item.locator('button.row').click(); };

  ok.push(['9 tabs generated (setup + 7 + history)', (await page.locator('.tab-btn').count())===9]);
  const cl = await page.locator('#compassWrap text').allTextContents();
  ok.push(['compass has 90', cl.includes('90')]);
  ok.push(['compass has 270', cl.includes('270')]);
  ok.push(['compass has 0/180', cl.includes('0')&&cl.includes('180')]);
  ok.push(['compass label count', cl.length===20, cl.length]);

  await page.locator('#tab-nav').click();
  await page.locator('#panel-nav input[name=number]').fill('01');
  await page.locator('#panel-nav input[name=title]').fill('Turn Alpha');
  await page.locator('#panel-nav textarea[name=description]').fill('Course change <script>x</script>');
  await page.locator('#panel-nav button[type=submit]').click();
  ok.push(['waypoint added', (await page.locator('#list-nav .wp-item').count())===1]);
  ok.push(['description escaped', (await page.locator('#list-nav .wp-item .desc').innerHTML()).includes('&lt;script&gt;')]);

  await page.locator('#panel-nav input[name=number]').fill('01');
  await page.locator('#panel-nav input[name=title]').fill('Dupe');
  await page.locator('#panel-nav button[type=submit]').click();
  ok.push(['duplicate warned', /already uses that number/.test(await page.locator('#note-nav').textContent())]);

  await page.locator('#list-nav .wp-item button.row').first().focus();
  await page.keyboard.press('Enter');
  ok.push(['row opens via keyboard',
    (await page.locator('#list-nav .wp-item').first().getAttribute('class')).includes('open') &&
    (await page.locator('#list-nav .wp-item button.row').first().getAttribute('aria-expanded'))==='true']);

  await page.locator('#tab-all').click();
  ok.push(['open state synced to ALL tab', (await page.locator('#list-all .wp-item[data-id]').first().getAttribute('class')).includes('open')]);

  await page.locator('#tab-nav').click();
  await ensureOpen(page.locator('#list-nav .wp-item').nth(1));
  await page.locator('#list-nav .wp-item').nth(1).locator('.btn-delete').click();
  ok.push(['delete asks for confirmation', (await page.locator('#list-nav .wp-item').nth(1).locator('.btn-delete-confirm').count())===1]);
  await page.locator('#list-nav .wp-item').nth(1).locator('.btn-delete-confirm').click();
  ok.push(['deleted after confirm', (await page.locator('#list-nav .wp-item').count())===1]);
  ok.push(['expansion survives re-render', (await page.locator('#list-nav .wp-item').first().getAttribute('class')).includes('open')]);

  await page.locator('#list-nav .wp-item').first().locator('.btn-edit').click();
  await page.locator('#list-nav .edit-form input[name=title]').fill('Turn Bravo');
  await page.locator('#list-nav .edit-form button[type=submit]').click();
  ok.push(['edit saved', (await page.locator('#list-nav .wp-item .title').first().textContent())==='Turn Bravo']);

  const stored = await page.evaluate(()=>localStorage.getItem('ucn_nav_radar_waypoints'));
  ok.push(['stored with version 3', JSON.parse(stored).version===3 && JSON.parse(stored).waypoints.length===1]);

  await page.evaluate(()=>localStorage.setItem('ucn_nav_radar_waypoints', JSON.stringify([
    {id:'old1',category:'hostile',number:'7',title:'Legacy',sector:'',description:'from v0'},
    {id:'bad',category:'nope',number:'1',title:'invalid'}])));
  await page.reload();
  await page.locator('#tab-hostile').click();
  ok.push(['legacy array migrated', (await page.locator('#list-hostile .wp-item').count())===1]);
  ok.push(['invalid entry dropped', (await page.locator('#list-all .wp-item[data-id]').count())===1]);

  await page.locator('#quickRefBtn').click();
  ok.push(['modal open', await page.locator('#refOverlay').evaluate(e=>e.classList.contains('open'))]);
  ok.push(['focus in modal', await page.evaluate(()=>document.activeElement.id==='closeRefBtn')]);
  ok.push(['dialog role', (await page.locator('#refOverlay .modal').getAttribute('role'))==='dialog']);
  await page.keyboard.press('Escape');
  ok.push(['escape closes', !(await page.locator('#refOverlay').evaluate(e=>e.classList.contains('open')))]);
  ok.push(['focus restored', await page.evaluate(()=>document.activeElement.id==='quickRefBtn')]);

  await page.locator('#tab-all').focus();
  await page.keyboard.press('ArrowRight');
  ok.push(['arrow key moves tab', await page.evaluate(()=>document.activeElement.id==='tab-nav')]);
  ok.push(['panel switched', await page.locator('#panel-nav').isVisible()]);
  await page.keyboard.press('End');
  ok.push(['End key -> last tab (history)', await page.evaluate(()=>document.activeElement.id==='tab-history')]);

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBtn').click()]);
  ok.push(['export filename', /^ucn-waypoints-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename()]);

  const fs=require('fs');
  const tmp=artifact('imp.json');
  fs.writeFileSync(tmp, JSON.stringify({version:2, waypoints:[
    {id:'old1',category:'mission',number:'3',title:'Imported',sector:'G4',description:'x'},{junk:true}]}));
  await page.locator('#importInput').setInputFiles(tmp);
  await page.waitForTimeout(300);
  ok.push(['import reports added+skipped', /Imported 1 waypoint.*skipped as invalid/.test(await page.locator('#notice').textContent())]);
  ok.push(['import did not overwrite id collision', (await page.locator('#list-all .wp-item[data-id]').count())===2]);

  await browser.close();
  let failed=0;
  ok.forEach(([n,p,e])=>{if(!p)failed++;console.log((p?'PASS ':'FAIL ')+n+(!p&&e!==undefined?'  -> '+e:''));});
  if(errors.length){console.log('\nJS ERRORS:');errors.forEach(e=>console.log('  '+e));}
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' checks passed, '+errors.length+' js errors');
  process.exit(failed||errors.length?1:0);
})();
