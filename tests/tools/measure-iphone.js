// Reports the layout numbers behind the iPhone targets rather than
// asserting them; iphone.test.js is what enforces the thresholds.
const { chromium, launchOpts, appUrl } = require('../lib/harness');
// Safari's *visible* viewport is shorter than the device height once the URL
// bar and tab bar are on screen.
const TARGETS=[
  ['iPhone SE',        375, 667-115],
  ['iPhone 13/14',     390, 844-140],
  ['iPhone 14 Pro Max',430, 932-140],
];
(async()=>{
  const b=await chromium.launch(launchOpts());
  for(const [name,w,h] of TARGETS){
    const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await p.goto(appUrl());
    await p.evaluate(()=>{const add=(c,n,t,s,d)=>{const f=document.querySelector('form.wp-form[data-cat="'+c+'"]');
      f.elements.number.value=n;f.elements.title.value=t;f.elements.sector.value=s;f.elements.description.value=d;
      f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));};
      add('nav','01','Turn point Alpha','G-4','x');add('nav','02','Turn point Bravo','G-6','x');
      add('hostile','03','Hostile patrol','H-2','x');});
    await p.reload();               // steady state, as when reopening mid-mission
    await p.locator('#tab-nav').click();
    // action buttons only exist once a row is expanded
    await p.locator('#list-nav .wp-item button.row').first().click();
    const m=await p.evaluate(()=>{
      const R=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect():null;};
      const tabs=[...document.querySelectorAll('.tab-btn')];
      const rows=new Set(tabs.map(t=>Math.round(t.getBoundingClientRect().top)));
      const list=document.querySelector('#list-nav .wp-item');
      const cs=s=>{const e=document.querySelector(s);return e?getComputedStyle(e):null;};
      const smallBtn=document.querySelector('#panel-nav .wp-item .btn-edit');
      return {
        header:Math.round(R('header.app-header').height),
        tabsH:Math.round(R('#tabNav').height),
        tabRows:rows.size,
        formH:Math.round(R('#panel-nav form.wp-form').height),
        toggleShown: !!R('#panel-nav .add-toggle') && R('#panel-nav .add-toggle').height>0,
        firstItemTop: list?Math.round(list.getBoundingClientRect().top):null,
        vh:innerHeight,
        inputFontPx: parseFloat(cs('#panel-nav input[name=number]').fontSize),
        tabH: Math.round(tabs[0].getBoundingClientRect().height),
        rowH: Math.round(R('#list-nav .wp-item button.row').height),
        actionBtnH: smallBtn?Math.round(smallBtn.getBoundingClientRect().height):null,
        pillH: Math.round(R('.pill-btn').height),
        bodyScrollW: document.documentElement.scrollWidth,
        usesDvh: getComputedStyle(document.body).minHeight,
      };
    });
    const pct=Math.round(m.firstItemTop/m.vh*100);
    console.log(`\n== ${name}  ${w}x${h} (Safari visible)`);
    console.log(`   header ${m.header}  tabs ${m.tabsH} (${m.tabRows} rows)  form ${m.formH} (toggle:${m.toggleShown})`);
    console.log(`   first waypoint at y=${m.firstItemTop} of ${m.vh}  -> ${pct}% of viewport`);
    console.log(`   input font ${m.inputFontPx}px ${m.inputFontPx<16?'** iOS WILL ZOOM ON FOCUS **':'(ok)'}`);
    console.log(`   tap targets: tab ${m.tabH}px, row ${m.rowH}px, action btn ${m.actionBtnH}px, pill ${m.pillH}px  (44 needed)`);
    console.log(`   horizontal overflow: ${m.bodyScrollW>w?('YES '+m.bodyScrollW+'px'):'no'}`);
    await p.close();
  }
  await b.close();
})();
