const { launch, appUrl, watch, readStore, report } = require('./lib/harness');

// The ladder the app ships. If the list is edited, this is the other place to
// change — deliberately, so a silent edit to one of them shows up.
const RANKS = ['Cadet', 'Ensign', 'Sub Lt', 'Lieutenant', 'Lt Cmdr', 'Commander',
  'Captain', 'Commodore', 'Rear Admiral', 'Vice Admiral', 'Admiral',
  'Admiral of the Fleet'];

const rows = p => p.locator('#mission-rank-list .combo-opt');

async function type(p, text) {
  await p.locator('#mission-rank').fill(text);
  await p.waitForTimeout(60);
}

(async () => {
  const b = await launch();
  const ok = [], errors = [];
  const p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await p.locator('#tab-mission-setup').click();

  // ---- the list -----------------------------------------------------------
  await p.locator('#mission-rank-toggle').click();
  await p.waitForTimeout(40);
  ok.push(['rank is a searchable field',
    (await p.locator('#mission-rank[role=combobox]').count()) === 1]);
  const listed = (await rows(p).evaluateAll(rs =>
    rs.map(r => r.getAttribute('data-value'))));
  ok.push(['every rank listed', listed.length === RANKS.length, listed.length]);
  ok.push(['...in the ladder order', listed.join('|') === RANKS.join('|'), listed.join('|')]);
  ok.push(['rank has no group headings', (await p.locator('#mission-rank-list .combo-group').count()) === 0]);

  // ---- searching works in both directions ---------------------------------
  // Several ranks are stored abbreviated, so matching has to run the other way
  // too or "lieutenant commander" would never find Lt Cmdr.
  await type(p, 'lt cmdr');
  ok.push(['the stored short form matches', (await rows(p).count()) === 1, await rows(p).allTextContents()]);
  ok.push(['...the right one', (await rows(p).first().getAttribute('data-value')) === 'Lt Cmdr']);

  await type(p, 'lieutenant commander');
  ok.push(['spelling it out finds the abbreviated rank',
    (await rows(p).count()) === 1 &&
    (await rows(p).first().getAttribute('data-value')) === 'Lt Cmdr',
    await rows(p).allTextContents()]);

  await type(p, 'sub lieutenant');
  ok.push(['and Sub Lt the same way',
    (await rows(p).count()) === 1 &&
    (await rows(p).first().getAttribute('data-value')) === 'Sub Lt',
    await rows(p).allTextContents()]);

  await type(p, 'lt');
  const lt = await rows(p).evaluateAll(rs => rs.map(r => r.getAttribute('data-value')));
  ok.push(['"lt" finds all three lieutenant ranks',
    lt.length === 3 && lt.includes('Lieutenant') && lt.includes('Lt Cmdr') && lt.includes('Sub Lt'),
    JSON.stringify(lt)]);

  await type(p, 'adm');
  const adm = await rows(p).evaluateAll(rs => rs.map(r => r.getAttribute('data-value')));
  ok.push(['"adm" finds all four admirals', adm.length === 4, JSON.stringify(adm)]);

  ok.push(['the other form is shown beside the rank', await p.evaluate(() => {
    const r = document.querySelector('#mission-rank-list .combo-opt .combo-alt');
    return !!r && r.textContent.trim().length > 0;
  })]);

  // ---- choosing stores the full name, not the short form ------------------
  await type(p, 'capt');
  await rows(p).first().click();
  await p.waitForTimeout(60);
  let s = await readStore(p);
  ok.push(['choosing stores the rank as written', s.mission.rank === 'Captain', s.mission.rank]);
  ok.push(['the field shows it', (await p.locator('#mission-rank').inputValue()) === 'Captain']);

  // Found by the spelled-out form, stored abbreviated: what is written on the
  // ladder is what goes in the log and on the report, not what was typed.
  await type(p, 'lieutenant commander');
  await rows(p).first().click();
  await p.waitForTimeout(60);
  s = await readStore(p);
  ok.push(['an abbreviated rank stores abbreviated, not as searched',
    s.mission.rank === 'Lt Cmdr', s.mission.rank]);
  ok.push(['choosing a rank does not touch the mission type',
    !s.mission.type, JSON.stringify(s.mission.type)]);

  // ---- freetext -----------------------------------------------------------
  await type(p, 'Midshipman');
  s = await readStore(p);
  ok.push(['a rank not on the list is stored as typed', s.mission.rank === 'Midshipman', s.mission.rank]);
  ok.push(['and the list says it is kept',
    /what you typed is kept/i.test(await p.locator('#mission-rank-list .combo-empty').textContent())]);

  await p.reload();
  await p.locator('#tab-mission-setup').click();
  ok.push(['it survives a reload', (await p.locator('#mission-rank').inputValue()) === 'Midshipman']);
  ok.push(['and reaches the summary',
    /Midshipman/.test(await p.locator('#missionSummary').textContent())]);

  // ---- two pickers on one form stay independent ---------------------------
  await p.locator('#mission-name-toggle').click();
  await p.waitForTimeout(40);
  ok.push(['opening one list closes the other',
    !(await p.locator('#mission-name-list').isHidden()) &&
    await p.locator('#mission-rank-list').isHidden()]);

  // ---- clearing the setup clears the pickers ------------------------------
  await p.locator('#missionClearBtn').click();
  await p.waitForTimeout(60);
  ok.push(['Clear setup empties both pickers',
    (await p.locator('#mission-rank').inputValue()) === '' &&
    (await p.locator('#mission-name').inputValue()) === '']);

  await b.close();
  report(ok, errors);
})();
