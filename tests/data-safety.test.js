const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, launchOpts, appUrl, artifact, watch, seedWaypoints, readStore, report } = require('./lib/harness');

const INDEX = path.resolve(__dirname, '..', 'index.html');

// The manifest's start_url is only valid over a real origin, so this suite
// serves the file rather than loading it from disk for that one check.
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(INDEX));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const ok = [], errors = [];

  // ---- backup state ------------------------------------------------------
  let p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());

  await seedWaypoints(p, [{ cat: 'nav', number: '01', title: 'Turn Alpha', sector: 'G-4' }]);
  let s = await readStore(p);
  ok.push(['schema at v4', s.version === 4, s.version]);
  ok.push(['changedAt stamped on mutation', !!s.changedAt]);
  ok.push(['lastExportAt absent before any export', !s.lastExportAt]);

  await p.locator('#tab-mission-setup').click();
  ok.push(['reports never exported', /Never exported/.test(await p.locator('#backupState').textContent()),
    await p.locator('#backupState').textContent()]);
  ok.push(['Export pill marked unbacked', await p.locator('#exportBtn').evaluate(e => e.classList.contains('needs-backup'))]);

  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#exportBtn').click()]);
  await dl.saveAs(artifact('backup.json'));
  await p.waitForTimeout(150);
  s = await readStore(p);
  ok.push(['export stamps lastExportAt', !!s.lastExportAt]);
  ok.push(['export does not move changedAt past it', Date.parse(s.lastExportAt) >= Date.parse(s.changedAt),
    s.changedAt + ' / ' + s.lastExportAt]);
  ok.push(['now reports backed up', /Backed up at/.test(await p.locator('#backupState').textContent()),
    await p.locator('#backupState').textContent()]);
  ok.push(['Export pill marker cleared', !(await p.locator('#exportBtn').evaluate(e => e.classList.contains('needs-backup')))]);

  // the exported file itself carries both stamps
  const exported = JSON.parse(fs.readFileSync(artifact('backup.json'), 'utf8'));
  ok.push(['exported file carries the stamps', !!exported.lastExportAt && !!exported.changedAt]);

  await seedWaypoints(p, [{ cat: 'hostile', number: '02', title: 'Patrol' }]);
  await p.waitForTimeout(100);
  ok.push(['a later change flips it back to unbacked',
    /Changed since the last export/.test(await p.locator('#backupState').textContent()),
    await p.locator('#backupState').textContent()]);

  await p.reload();
  const after = await readStore(p);
  ok.push(['both stamps survive a reload', !!after.changedAt && !!after.lastExportAt]);

  // ---- a PDF is not a backup --------------------------------------------
  const beforePdf = (await readStore(p)).lastExportAt;
  await p.locator('#pdfBtn').click();
  await p.waitForTimeout(1200);
  ok.push(['PDF export does NOT count as a backup', (await readStore(p)).lastExportAt === beforePdf]);

  // ---- a v3 payload still loads -----------------------------------------
  await p.evaluate(() => localStorage.setItem('ucn_nav_radar_waypoints', JSON.stringify({
    version: 3, mission: {}, waypoints: [{ id: 'a', category: 'nav', number: '9', title: 'Legacy leg',
      sector: '', description: '', createdAt: new Date().toISOString(), completedAt: null, outcome: '' }]
  })));
  await p.reload();
  ok.push(['v3 payload loads', (await p.locator('#list-all .wp-item[data-id]').count()) === 1]);
  await p.locator('#tab-mission-setup').click();
  ok.push(['v3 payload reports never exported rather than erroring',
    /Never exported/.test(await p.locator('#backupState').textContent())]);
  await p.close();

  // ---- install nudge -----------------------------------------------------
  p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  ok.push(['install banner shown when not installed', await p.locator('#installBanner').isVisible()]);

  await p.locator('#installDismiss').click();
  ok.push(['dismiss hides it', !(await p.locator('#installBanner').isVisible())]);
  await p.reload();
  ok.push(['dismissal persists across reload', !(await p.locator('#installBanner').isVisible())]);
  await p.close();

  // standalone: Playwright cannot emulate display-mode, so stub the query
  p = await b.newPage();
  watch(p, errors);
  await p.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = q => (q === '(display-mode: standalone)'
      ? { matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : real(q));
  });
  await p.goto(appUrl());
  ok.push(['no nudge once installed', !(await p.locator('#installBanner').isVisible())]);
  await p.close();

  // iOS wording mentions Add to Home Screen
  p = await b.newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  watch(p, errors);
  await p.goto(appUrl());
  ok.push(['iOS nudge names Add to Home Screen',
    /Add to Home Screen/.test(await p.locator('#installText').textContent())]);
  await p.close();

  // ---- persistent storage ------------------------------------------------
  p = await b.newPage();
  watch(p, errors);
  await p.addInitScript(() => {
    window.__persistCalled = false;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: () => { window.__persistCalled = true; return Promise.reject(new Error('denied')); } }
    });
  });
  await p.goto(appUrl());
  await p.waitForTimeout(200);
  ok.push(['persist() requested when available', await p.evaluate(() => window.__persistCalled)]);
  ok.push(['a rejected persist() does not break startup',
    (await p.locator('.tab-btn').count()) === 9]);
  await p.close();

  // ---- manifest ----------------------------------------------------------
  const { srv, url } = await serve();
  p = await b.newPage();
  watch(p, errors);
  await p.goto(url);
  const cdp = await p.context().newCDPSession(p);
  const man = await cdp.send('Page.getAppManifest').catch(e => ({ errors: [{ message: e.message, critical: 1 }] }));
  const critical = (man.errors || []).filter(e => e.critical);
  ok.push(['manifest parses with no critical errors', critical.length === 0, JSON.stringify(critical)]);
  const parsed = man.data ? JSON.parse(man.data) : null;
  ok.push(['manifest is standalone with the brand colours', !!parsed &&
    parsed.display === 'standalone' && parsed.theme_color === '#1B2A5E', JSON.stringify(parsed && {
      d: parsed.display, t: parsed.theme_color })]);
  const big = parsed && (parsed.icons || []).some(i => parseInt(i.sizes, 10) >= 144);
  ok.push(['manifest ships an icon >=144px (Chrome install minimum)', !!big,
    JSON.stringify(parsed && (parsed.icons || []).map(i => i.sizes))]);
  await p.close();
  srv.close();

  await b.close();
  report(ok, errors);
})();
