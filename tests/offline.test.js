const { launch, appUrl, serve, watch, skip, seedWaypoints, report } = require('./lib/harness');

// Waits for the service worker to be in charge of the page. Registration alone
// is not enough: until a worker controls the client, a reload still goes to the
// network and an offline reload would fail for reasons that are not a bug.
function controlled(page) {
  return page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
}

(async () => {
  const b = await launch();
  const ok = [], errors = [];

  // file:// is the normal case for every other suite, and it is also how
  // someone might open a saved copy of the tool. Registration must no-op there
  // rather than throwing.
  const local = await b.newPage();
  watch(local, errors);
  await local.goto(appUrl());
  ok.push(['file:// load registers nothing and does not error',
    await local.evaluate(() => !navigator.serviceWorker || !navigator.serviceWorker.controller)]);
  ok.push(['file:// tool still builds', (await local.locator('.tab-btn').count()) === 9]);
  await local.close();

  const site = await serve();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  watch(p, errors);

  await p.goto(site.url);

  // Feature-detected rather than guessed from the engine name: some headless
  // builds ship without service workers even though the shipping browser of
  // the same family has them. Where they exist, every check below runs,
  // whichever engine this is.
  const supported = await p.evaluate(() => 'serviceWorker' in navigator);
  if (!supported) {
    ['registers a service worker', 'the worker takes control', 'shell is cached',
     'the worker serves the cached shell with no network',
     'reload with no network still opens the tool', 'log survives an offline reload',
     'waypoints can be added offline', 'PDF report still generates offline',
     'a changed deploy announces itself', 'it does not reload the page itself']
      .forEach(name => skip(ok, name, 'this build has no service worker support'));
    await ctx.close();
    await site.close();
    await b.close();
    report(ok, errors);
    return;
  }
  await p.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r), null, { timeout: 15000 })
    .then(() => ok.push(['registers a service worker', true]))
    .catch(e => ok.push(['registers a service worker', false, e.message]));

  await controlled(p)
    .then(() => ok.push(['the worker takes control', true]))
    .catch(e => ok.push(['the worker takes control', false, e.message]));

  ok.push(['shell is cached', await p.evaluate(async () => {
    const names = await caches.keys();
    if (!names.length) return false;
    const c = await caches.open(names[0]);
    return !!(await c.match('./'));
  })]);

  // A mission's worth of work, then the network goes away mid-sortie.
  await seedWaypoints(p, [
    { cat: 'nav', number: '01', title: 'Turn Alpha', sector: 'G-4' },
    { cat: 'hostile', number: '02', title: 'Patrol', sector: 'H-2' },
  ]);

  await ctx.setOffline(true);

  // Asked before the reload, because the two can fail independently: this is
  // the worker answering a request for the shell from its cache with no
  // network, which is the thing this change actually adds. A reload asks the
  // same of the engine's navigation path on top of it.
  const served = await p.evaluate(async () => {
    try {
      const r = await fetch('./');
      if (!r.ok) return 'status ' + r.status;
      return (await r.text()).indexOf('UCN Navigation') !== -1 ? true : 'served something else';
    } catch (e) { return 'threw: ' + e.message; }
  });
  ok.push(['the worker serves the cached shell with no network', served === true, served]);

  // Without the worker serving the shell this never loads at all, so it is
  // caught: a broken offline path must read as a failed check, not a crashed
  // suite that takes the rest of the run's results with it.
  let reloadError = '';
  await p.reload({ timeout: 15000 }).catch(e => { reloadError = e.message.split('\n')[0]; });
  const reloaded = !reloadError;

  ok.push(['reload with no network still opens the tool',
    reloaded && (await p.locator('.tab-btn').count()) === 9,
    'navigation failed offline: ' + (reloadError || 'page loaded but did not build')]);

  if (reloaded) {
    ok.push(['log survives an offline reload', (await p.locator('#list-all .wp-item[data-id]').count()) === 2]);

    await seedWaypoints(p, [{ cat: 'objective', number: '03', title: 'Offline entry' }]);
    ok.push(['waypoints can be added offline', (await p.locator('#list-all .wp-item[data-id]').count()) === 3]);

    // jsPDF and its fonts are inlined, so the report is generated entirely on
    // the device. Worth pinning: filing a report with no signal is exactly
    // when that matters.
    const dl = await Promise.all([
      p.waitForEvent('download', { timeout: 20000 }).catch(() => null),
      p.locator('#pdfBtn').click(),
    ]).then(r => r[0]);
    ok.push(['PDF report still generates offline', !!dl &&
      /PDF report exported/.test(await p.locator('#notice').textContent())]);

    // Back online with a different page on the server: the cached copy is
    // served first, the background revalidation spots the new ETag, and the
    // tool says a version is ready rather than reloading out from under the
    // mission.
    await ctx.setOffline(false);
    const changed = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')
      .replace('</body>', '<!-- redeployed -->\n</body>');
    site.override('/index.html', changed);

    await p.reload();
    let announced = true;
    await p.waitForFunction(
      () => /newer version of the tool is ready/.test(document.getElementById('notice').textContent),
      null, { timeout: 15000 }).catch(() => { announced = false; });
    ok.push(['a changed deploy announces itself', announced]);
    ok.push(['it does not reload the page itself', (await p.locator('#list-all .wp-item[data-id]').count()) === 3]);
  } else {
    // Everything below depends on that reload, so report them rather than
    // crashing on an error page and losing the run.
    ['log survives an offline reload', 'waypoints can be added offline',
     'a changed deploy announces itself', 'it does not reload the page itself']
      .forEach(name => ok.push([name, false, 'skipped: the offline reload failed']));
  }

  await ctx.close();
  await site.close();
  await b.close();
  report(ok, errors);
})();
