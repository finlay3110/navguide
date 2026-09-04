const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
const seed=`(function(){const add=(c,n,t)=>{const f=document.querySelector('form.wp-form[data-cat="'+c+'"]');
  f.elements.number.value=n;f.elements.title.value=t;f.elements.sector.value='G-4';f.elements.description.value='x';
  f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));};
  for(let i=1;i<=8;i++) add('nav',String(i).padStart(2,'0'),'Waypoint '+i);
  for(let i=1;i<=8;i++) add('hostile',String(i).padStart(2,'0'),'Contact '+i);})()`;

(async()=>{
  const b=await chromium.launch(launchOpts());
  const ok=[]; const errs=[];
  const phone=async()=>{const p=await b.newPage({viewport:{width:375,height:552},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    p.on('pageerror',e=>errs.push(e.message)); await p.goto(appUrl()); return p;};

  // --- layout targets, all three iPhones ---------------------------------
  for(const [name,w,h,limit] of [['SE',375,552,0.60],['13/14',390,704,0.50],['ProMax',430,792,0.45]]){
    const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto(appUrl()); await p.evaluate(seed); await p.reload();
    await p.locator('#tab-nav').click();
    const m=await p.evaluate(()=>({
      top:document.querySelector('#list-nav .wp-item').getBoundingClientRect().top,
      vh:innerHeight,
      rows:new Set([...document.querySelectorAll('.tab-btn')].map(t=>Math.round(t.getBoundingClientRect().top))).size,
      scrolls:document.getElementById('tabNav').scrollWidth>document.getElementById('tabNav').clientWidth,
      overflow:document.documentElement.scrollWidth,
      header:Math.round(document.querySelector('header.app-header').getBoundingClientRect().height),
    }));
    ok.push([name+': first waypoint above '+(limit*100)+'% of viewport', m.top/m.vh<limit, Math.round(m.top/m.vh*100)+'%']);
    ok.push([name+': tab strip is one row', m.rows===1, m.rows+' rows']);
    ok.push([name+': tab strip scrolls horizontally', m.scrolls]);
    ok.push([name+': no horizontal page overflow', m.overflow<=w, m.overflow]);
    await p.close();
  }

  const p=await phone();
  await p.evaluate(seed); await p.reload();

  // --- 16px inputs (the iOS zoom trigger) --------------------------------
  await p.locator('#tab-nav').click();
  await p.locator('#panel-nav .add-toggle').click();
  const fonts=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#panel-nav input, #panel-nav textarea, #panel-mission-setup input').forEach(e=>
      out.push({n:e.name||e.id, px:parseFloat(getComputedStyle(e).fontSize)}));
    return out;
  });
  ok.push(['every form control >=16px (no iOS zoom)', fonts.every(f=>f.px>=16), JSON.stringify(fonts.filter(f=>f.px<16))]);

  // --- disclosure --------------------------------------------------------
  ok.push(['toggle expands the form', await p.locator('#form-nav').isVisible()]);
  ok.push(['aria-expanded tracks state', (await p.locator('#panel-nav .add-toggle').getAttribute('aria-expanded'))==='true']);
  await p.locator('#panel-nav .add-toggle').click();
  ok.push(['toggle collapses again', !(await p.locator('#form-nav').isVisible())]);
  // keyboard operable
  await p.locator('#panel-nav .add-toggle').focus();
  await p.keyboard.press('Enter');
  ok.push(['toggle is keyboard operable', await p.locator('#form-nav').isVisible()]);
  await p.locator('#tab-mission-setup').click();
  ok.push(['mission setup form is exempt', await p.locator('#missionForm').isVisible()]);
  ok.push(['mission setup has no toggle', (await p.locator('#panel-mission-setup .add-toggle').count())===0]);

  // --- sticky tabs + strip scrolling, not page scrolling -----------------
  await p.locator('#tab-nav').click();
  await p.evaluate(()=>window.scrollTo(0,400));
  const stuck=await p.evaluate(()=>Math.round(document.querySelector('.tabs-sticky').getBoundingClientRect().top));
  ok.push(['tab strip stays pinned when scrolled', stuck<=1, 'top='+stuck]);
  const before=await p.evaluate(()=>window.pageYOffset);
  await p.evaluate(()=>{document.getElementById('tabNav').scrollLeft=0;});
  await p.locator('#tab-hostile').click();   // equally tall panel, so no clamping
  const after=await p.evaluate(()=>({y:window.pageYOffset, sl:document.getElementById('tabNav').scrollLeft,
    max:Math.max(0, document.scrollingElement.scrollHeight - innerHeight)}));
  ok.push(['selecting an off-screen tab scrolls the strip', after.sl>0, 'scrollLeft='+after.sl]);
  ok.push(['...and does not scroll the page itself', after.y===Math.min(before, after.max),
    before+' -> '+after.y+' (clamp '+after.max+')']);

  // --- iOS scroll lock ---------------------------------------------------
  await p.evaluate(()=>window.scrollTo(0,300));
  const yBefore=await p.evaluate(()=>window.pageYOffset);
  // click via the DOM: locator.click() auto-scrolls the header into view,
  // which would defeat the very thing being measured
  await p.evaluate(()=>document.getElementById('quickRefBtn').click());
  const locked=await p.evaluate(()=>({pos:getComputedStyle(document.body).position, top:document.body.style.top}));
  ok.push(['body pinned while dialog open (iOS-proof)', locked.pos==='fixed', JSON.stringify(locked)]);
  await p.keyboard.press('Escape');
  const yAfter=await p.evaluate(()=>window.pageYOffset);
  ok.push(['scroll position restored on close', Math.abs(yAfter-yBefore)<2, yBefore+' -> '+yAfter]);
  ok.push(['body unpinned after close', await p.evaluate(()=>getComputedStyle(document.body).position!=='fixed')]);

  // --- install metadata --------------------------------------------------
  const meta=await p.evaluate(()=>({
    vf:(document.querySelector('meta[name=viewport]')||{}).content||'',
    theme:!!document.querySelector('meta[name=theme-color]'),
    cap:!!document.querySelector('meta[name=apple-mobile-web-app-capable]'),
    icon:(document.querySelector('link[rel=apple-touch-icon]')||{}).href||'',
  }));
  ok.push(['viewport-fit=cover set', /viewport-fit=cover/.test(meta.vf)]);
  ok.push(['pinch zoom NOT disabled', !/user-scalable=no|maximum-scale/.test(meta.vf), meta.vf]);
  ok.push(['theme-color + web-app-capable', meta.theme&&meta.cap]);
  ok.push(['apple-touch-icon present', meta.icon.indexOf('data:image/png')===0]);

  // --- desktop unaffected -------------------------------------------------
  await p.close();
  const d=await b.newPage({viewport:{width:1100,height:900}});
  d.on('pageerror',e=>errs.push(e.message));
  await d.goto(appUrl());
  await d.locator('#tab-nav').click();
  ok.push(['desktop: add form visible, no disclosure', await d.locator('#form-nav').isVisible() &&
    !(await d.locator('#panel-nav .add-toggle').isVisible())]);
  ok.push(['desktop: tabs still wrap (not a scroll strip)',
    await d.evaluate(()=>getComputedStyle(document.querySelector('nav.tabs')).flexWrap==='wrap')]);
  ok.push(['desktop: pill labels visible', await d.locator('#exportBtn .pill-label').isVisible()]);
  await d.close();

  await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length)console.log('JS ERRORS: '+errs.join(' | '));
  console.log('\n'+(ok.length-failed)+'/'+ok.length+' passed, '+errs.length+' js errors');
  process.exit(failed||errs.length?1:0);
})();
