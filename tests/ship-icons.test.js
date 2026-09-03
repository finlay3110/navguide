const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport:{width:900,height:900} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(appUrl());
  const ok=[];
  await p.locator('#quickRefBtn').click();
  await p.waitForTimeout(200);
  // Ship Types is collapsed behind its own button now; open it before measuring.
  await p.locator('#refOverlay .ref-toggle').first().click();
  await p.waitForTimeout(150);
  ok.push(['13 ship entries', (await p.locator('.ship-card').count())===13]);
  const names=(await p.locator('.ship-card').allTextContents()).map(s=>s.trim());
  ok.push(['Fighter present', names.includes('Fighter')]);
  ok.push(['Gunship kept', names.includes('Gunship')]);
  ok.push(['Small Station + Arrow added', names.includes('Small Station')&&names.includes('Arrow')]);
  const withIcon=await p.locator('.ship-icon-slot.has-icon').count();
  const ph=await p.locator('.ship-icon-slot.placeholder').count();
  ok.push(['12 real icons, 1 placeholder', withIcon===12&&ph===1, withIcon+'/'+ph]);
  ok.push(['placeholder is Gunship', (await p.locator('.ship-card:has(.placeholder)').textContent()).trim()==='Gunship']);
  const painted=await p.evaluate(()=>{const out=[];document.querySelectorAll('.ship-icon-slot.has-icon').forEach(slot=>{
    const svg=slot.querySelector('svg'),bb=svg.getBBox(),sh=svg.querySelector('path,rect,circle,ellipse,polygon,polyline,line');
    out.push({name:slot.parentElement.textContent.trim(),w:+bb.width.toFixed(2),h:+bb.height.toFixed(2),
      fill:sh?getComputedStyle(sh).fill:null,box:svg.getBoundingClientRect().width});});return out;});
  ok.push(['all icons have geometry', painted.every(i=>i.w>0&&i.h>0)]);
  const themed='rgb(234, 240, 251)';
  ok.push(['all icons inherit --text via currentColor', painted.every(i=>i.fill===themed),
    JSON.stringify(painted.filter(i=>i.fill!==themed).map(i=>i.name+'='+i.fill))]);
  const scaled=painted.filter(i=>i.name==='Arrow'), unscaled=painted.filter(i=>i.name!=='Arrow');
  ok.push(['unscaled icons render at slot size', unscaled.every(i=>i.box>30), JSON.stringify(unscaled.map(i=>i.name+':'+i.box))]);
  ok.push(['Arrow scaled to ~0.7 of slot', scaled.length===1&&Math.abs(scaled[0].box/36-0.7)<0.02, JSON.stringify(scaled)]);
  const fr=await p.evaluate(()=>{const r=[];document.querySelectorAll('.ship-icon-slot.has-icon svg').forEach(svg=>{
    const bb=svg.getBBox(),vb=svg.viewBox.baseVal;r.push(+(Math.max(bb.width/vb.width,bb.height/vb.height)).toFixed(3));});return r;});
  ok.push(['artwork fills >=90% of viewBox', fr.every(v=>v>=0.9&&v<=1.001), JSON.stringify(fr)]);
  await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length)console.log('JS ERRORS: '+errs.join('; '));
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' passed, '+errs.length+' js errors');
  process.exit(failed||errs.length?1:0);
})();
