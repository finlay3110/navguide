const { chromium, launchOpts, appUrl, artifact } = require('./lib/harness');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch(launchOpts());
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const ok=[];
  await p.goto(appUrl());

  ok.push(['jsPDF loaded from the page itself', await p.evaluate(()=>!!(window.jspdf&&window.jspdf.jsPDF))]);
  ok.push(['PDF button present', (await p.locator('#pdfBtn').count())===1]);

  // seed a realistic mission
  await p.evaluate(()=>{
    const m={date:'2026-09-01',time:'14:30',name:'Operation Longshore',type:'Escort',navigator:'Fin "Tetra"',rank:'Lt',ship:'UCN Hydra'};
    Object.keys(m).forEach(k=>{const el=document.getElementById('mission-'+k);el.value=m[k];el.dispatchEvent(new Event('input',{bubbles:true}));});
    const add=(c,n,t,s,d)=>{const f=document.querySelector('form.wp-form[data-cat="'+c+'"]');
      f.elements.number.value=n;f.elements.title.value=t;f.elements.sector.value=s;f.elements.description.value=d;
      f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));};
    add('nav','01','Turn point Alpha','G-4','Come to bearing 090 after clearing the belt — naïve café °');
    add('nav','02','Turn point Bravo','G-6','Second leg of the approach.');
    add('hostile','03','Hostile patrol','H-2','Two frigates on a patrol loop.');
    add('hazard','04','Debris field','G-5','Dense debris, reduce to impulse.');
    add('mission','05','Recover survey probe','J-1','Primary mission objective.');
  });
  await p.locator('#tab-nav').click();
  await p.locator('#panel-nav .wp-item').first().locator('button.row').click();
  await p.locator('#panel-nav .wp-item').first().locator('.btn-complete').click();
  await p.locator('#outcomeGrid .outcome-btn',{hasText:'Arrived at destination'}).click();
  await p.waitForTimeout(200);

  const [dl]=await Promise.all([p.waitForEvent('download'), p.locator('#pdfBtn').click()]);
  const name=dl.suggestedFilename();
  ok.push(['filename slugged from mission name', /^operation-longshore-report-\d{4}-\d{2}-\d{2}\.pdf$/.test(name), name]);
  const out=artifact('report.pdf');
  await dl.saveAs(out);
  const size=fs.statSync(out).size;
  ok.push(['pdf non-trivial size', size>20000, size+' bytes']);
  ok.push(['notice reports success', /PDF report exported/.test(await p.locator('#notice').textContent())]);
  ok.push(['fonts embedded (no helvetica fallback warning)', !/fell back to Helvetica/.test(await p.locator('#notice').textContent())]);

  await b.close();
  let failed=0;
  ok.forEach(([n,pass,extra])=>{if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+n+(!pass&&extra!==undefined?'  -> '+extra:''));});
  if(errs.length)console.log('JS ERRORS: '+errs.join(' | '));
  process.exit(failed||errs.length?1:0);
})();
