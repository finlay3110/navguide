const fs = require('fs');
const { launch, appUrl, artifact, watch, seedWaypoints, readStore, report } = require('./lib/harness');

// A mission's worth of waypoints across several categories, plus setup.
async function seedMission(p) {
  await p.evaluate(() => {
    const m = { date: '2026-09-01', time: '14:30', name: 'Operation Longshore',
      type: 'Escort', navigator: 'Fin', rank: 'Lt', ship: 'UCN Hydra' };
    Object.keys(m).forEach(k => {
      const el = document.getElementById('mission-' + k);
      el.value = m[k];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await seedWaypoints(p, [
    { cat: 'nav', number: '01', title: 'Turn Alpha', sector: 'G-4' },
    { cat: 'nav', number: '02', title: 'Turn Bravo', sector: 'G-6' },
    { cat: 'hostile', number: '03', title: 'Patrol', sector: 'H-2' },
  ]);
}

(async () => {
  const b = await launch();
  const ok = [], errors = [];
  let p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await seedMission(p);
  await p.locator('#tab-mission-setup').click();

  // ---- the dialog warns when the log is unbacked -------------------------
  await p.locator('#newMissionBtn').click();
  ok.push(['dialog opens', await p.locator('#newMissionOverlay').evaluate(e => e.classList.contains('open'))]);
  ok.push(['focus starts on Cancel, not the destructive action',
    await p.evaluate(() => document.activeElement.id === 'newMissionCancel')]);
  let body = await p.locator('#newMissionBody').textContent();
  ok.push(['names how much will be cleared', /3 waypoints/.test(body), body]);
  ok.push(['warns the log is unexported', /have not been exported/.test(body), body]);
  ok.push(['offers Export first', await p.locator('#newMissionExportFirst').isVisible()]);

  // ---- cancel changes nothing -------------------------------------------
  await p.locator('#newMissionCancel').click();
  let s = await readStore(p);
  ok.push(['Cancel leaves the log untouched', s.waypoints.length === 3 && s.mission.name === 'Operation Longshore']);

  await p.locator('#newMissionBtn').click();
  await p.keyboard.press('Escape');
  ok.push(['Escape also leaves it untouched', (await readStore(p)).waypoints.length === 3]);

  // ---- confirm clears ----------------------------------------------------
  await p.locator('#newMissionBtn').click();
  await p.locator('#newMissionConfirm').click();
  await p.waitForTimeout(150);
  s = await readStore(p);
  ok.push(['waypoints cleared', s.waypoints.length === 0, s.waypoints.length]);
  ok.push(['mission setup cleared', Object.keys(s.mission).every(k => !s.mission[k]), JSON.stringify(s.mission)]);
  ok.push(['a cleared log counts as never exported', !s.lastExportAt]);
  ok.push(['form fields cleared on screen', (await p.locator('#mission-name').inputValue()) === '']);
  ok.push(['notice confirms', /New mission started/.test(await p.locator('#notice').textContent())]);

  await p.locator('#tab-all').click();
  ok.push(['All tab is empty', (await p.locator('#list-all .wp-item[data-id]').count()) === 0]);
  await p.locator('#tab-history').click();
  ok.push(['History is empty — no longer unbounded across missions',
    (await p.locator('#list-history .wp-item[data-id]').count()) === 0]);

  ok.push(['survives a reload', await (async () => {
    await p.reload();
    const r = await readStore(p);
    return r.waypoints.length === 0 && !r.mission.name;
  })()]);
  await p.close();

  // ---- backed-up wording -------------------------------------------------
  p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await seedMission(p);
  await p.locator('#tab-mission-setup').click();
  let [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#exportBtn').click()]);
  await dl.saveAs(artifact('pre-new-mission.json'));
  await p.waitForTimeout(150);

  await p.locator('#newMissionBtn').click();
  body = await p.locator('#newMissionBody').textContent();
  ok.push(['backed-up wording says it is recoverable', /can be restored from that file/.test(body), body]);
  ok.push(['no Export-first button when already backed up',
    !(await p.locator('#newMissionExportFirst').isVisible())]);
  await p.locator('#newMissionCancel').click();
  await p.close();

  // ---- export-first path -------------------------------------------------
  p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await seedMission(p);
  await p.locator('#tab-mission-setup').click();
  await p.locator('#newMissionBtn').click();
  [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#newMissionExportFirst').click()]);
  const saved = artifact('export-first.json');
  await dl.saveAs(saved);
  await p.waitForTimeout(200);

  const exported = JSON.parse(fs.readFileSync(saved, 'utf8'));
  ok.push(['Export first writes the mission out before clearing',
    exported.waypoints.length === 3 && exported.mission.name === 'Operation Longshore',
    exported.waypoints.length + ' waypoints / ' + exported.mission.name]);
  s = await readStore(p);
  ok.push(['...and then clears', s.waypoints.length === 0 && !s.mission.name]);

  // ---- empty state -------------------------------------------------------
  await p.locator('#newMissionBtn').click();
  ok.push(['says there is nothing to clear when empty',
    /nothing to clear/.test(await p.locator('#newMissionBody').textContent())]);
  await p.locator('#newMissionCancel').click();
  await p.close();

  await b.close();
  report(ok, errors);
})();
