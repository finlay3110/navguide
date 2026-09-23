const { launch, appUrl, watch, readStore, report } = require('./lib/harness');

// The ladder the app ships. If the list is edited, this is the other place to
// change — deliberately, so a silent edit to one of them shows up.
const RANKS = ['Recruit', 'Crewman', 'Petty Officer', 'Chief Petty Officer', 'Ensign',
  'Sub Lieutenant', 'Lieutenant', 'Lieutenant Commander', 'Commander', 'Captain',
  'Commodore', 'Rear Admiral', 'Vice Admiral', 'Admiral', 'Fleet Admiral'];

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

  // ---- the short form is what people type ---------------------------------
  await type(p, 'lt cdr');
  ok.push(['a short form finds the rank', (await rows(p).count()) === 1, await rows(p).allTextContents()]);
  ok.push(['...the right one',
    (await rows(p).first().getAttribute('data-value')) === 'Lieutenant Commander']);

  await type(p, 'lt');
  const lt = await rows(p).evaluateAll(rs => rs.map(r => r.getAttribute('data-value')));
  ok.push(['a short prefix finds both Lieutenant ranks',
    lt.includes('Lieutenant') && lt.includes('Lieutenant Commander'), JSON.stringify(lt)]);

  await type(p, 'adm');
  const adm = await rows(p).evaluateAll(rs => rs.map(r => r.getAttribute('data-value')));
  ok.push(['and the admirals', adm.length === 4, JSON.stringify(adm)]);

  ok.push(['the short form is shown beside the rank', await p.evaluate(() => {
    const r = document.querySelector('#mission-rank-list .combo-opt .combo-short');
    return !!r && r.textContent.trim().length > 0;
  })]);

  // ---- choosing stores the full name, not the short form ------------------
  await type(p, 'capt');
  await rows(p).first().click();
  await p.waitForTimeout(60);
  let s = await readStore(p);
  ok.push(['choosing stores the full rank', s.mission.rank === 'Captain', s.mission.rank]);
  ok.push(['the field shows it', (await p.locator('#mission-rank').inputValue()) === 'Captain']);
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
