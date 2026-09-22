const { launch, appUrl, watch, readStore, report } = require('./lib/harness');

// Mirrors the supplied operations list. Kept here deliberately: if the app's
// copy is edited by hand, this notices.
const EXPECTED = {
  Military: 11, Exploration: 7, Diplomacy: 7, Intrigue: 7,
};
const SAMPLES = [
  ['OPERATION TEDDER', 'Military'],
  ['ITHAKA MINING FACILITY', 'Military'],
  ['OPERATION AMUNDSEN', 'Exploration'],
  ['TERRA NOVAN DIPLOMATIC INCIDENT', 'Diplomacy'],
  ['OPERATION MOCKINGBIRD', 'Intrigue'],
];

(async () => {
  const b = await launch();
  const ok = [], errors = [];
  const p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await p.locator('#tab-mission-setup').click();

  // ---- the picker ---------------------------------------------------------
  const sel = p.locator('#mission-name-select');
  ok.push(['mission name is a picker', (await sel.count()) === 1]);
  const names = await sel.locator('option').evaluateAll(os =>
    os.map(o => o.value).filter(v => v && v !== '__other__'));
  ok.push(['all 32 operations listed', names.length === 32, names.length]);

  const groups = await sel.locator('optgroup').evaluateAll(gs =>
    gs.map(g => ({ label: g.label, n: g.children.length })));
  ok.push(['grouped by type', groups.length === 4, JSON.stringify(groups.map(g => g.label))]);
  ok.push(['group counts match the source list',
    groups.every(g => EXPECTED[g.label] === g.n),
    JSON.stringify(groups)]);

  ok.push(['type picker offers the four types', await p.evaluate(() =>
    [...document.querySelectorAll('#mission-type-select option')]
      .map(o => o.value).filter(v => v && v !== '__other__').length === 4)]);

  // ---- selecting an operation fills the type ------------------------------
  let allDerived = true, detail = '';
  for (const [name, type] of SAMPLES) {
    await sel.selectOption(name);
    await p.waitForTimeout(60);
    const s = await readStore(p);
    if (s.mission.name !== name || s.mission.type !== type) {
      allDerived = false;
      detail += name + ' -> ' + s.mission.type + ' (want ' + type + '); ';
    }
  }
  ok.push(['choosing an operation sets its type', allDerived, detail]);
  ok.push(['and says so', /Mission type set to/.test(await p.locator('#note-mission-setup').textContent())]);
  ok.push(['type picker reflects the derived value',
    (await p.locator('#mission-type-select').inputValue()) === 'Intrigue']);

  // ---- every listed operation resolves to a type --------------------------
  const unmapped = await p.evaluate(() =>
    [...document.querySelectorAll('#mission-name-select optgroup')].flatMap(g =>
      [...g.children].map(o => ({ name: o.value, group: g.label }))
    ).filter(x => !x.name).map(x => x.name));
  ok.push(['no operation is missing a group', unmapped.length === 0, JSON.stringify(unmapped)]);

  // ---- freetext -----------------------------------------------------------
  ok.push(['custom field hidden while a listed operation is chosen',
    !(await p.locator('#mission-name-other').isVisible())]);

  await sel.selectOption('__other__');
  await p.waitForTimeout(60);
  ok.push(['Other reveals a free text field', await p.locator('#mission-name-other').isVisible()]);
  await p.locator('#mission-name').fill('OPERATION LONGSHORE');
  await p.waitForTimeout(60);
  let s = await readStore(p);
  ok.push(['typed name is stored', s.mission.name === 'OPERATION LONGSHORE', s.mission.name]);

  await p.locator('#mission-type-select').selectOption('__other__');
  await p.waitForTimeout(60);
  await p.locator('#mission-type').fill('Search and rescue');
  await p.waitForTimeout(60);
  s = await readStore(p);
  ok.push(['typed type is stored', s.mission.type === 'Search and rescue', s.mission.type]);

  // ---- an unlisted value round-trips as Other -----------------------------
  await p.reload();
  await p.locator('#tab-mission-setup').click();
  ok.push(['unlisted name reopens as Other',
    (await p.locator('#mission-name-select').inputValue()) === '__other__']);
  ok.push(['...with the text still there',
    (await p.locator('#mission-name').inputValue()) === 'OPERATION LONGSHORE']);
  ok.push(['unlisted type reopens as Other too',
    (await p.locator('#mission-type-select').inputValue()) === '__other__' &&
    (await p.locator('#mission-type').inputValue()) === 'Search and rescue']);

  // ---- switching back to a listed operation clears the custom field -------
  await p.locator('#mission-name-select').selectOption('OPERATION CLAYMORE');
  await p.waitForTimeout(60);
  s = await readStore(p);
  ok.push(['switching back to a listed operation replaces the typed name',
    s.mission.name === 'OPERATION CLAYMORE' && s.mission.type === 'Military',
    JSON.stringify({ n: s.mission.name, t: s.mission.type })]);
  ok.push(['custom field hidden again', !(await p.locator('#mission-name-other').isVisible())]);

  // ---- an imported unlisted operation still loads -------------------------
  await p.evaluate(() => localStorage.setItem('ucn_nav_radar_waypoints', JSON.stringify({
    version: 4, mission: { name: 'OPERATION UNKNOWN TO THIS BUILD', type: 'Salvage' }, waypoints: [],
  })));
  await p.reload();
  await p.locator('#tab-mission-setup').click();
  ok.push(['an operation not in the list still loads and displays',
    (await p.locator('#mission-name').inputValue()) === 'OPERATION UNKNOWN TO THIS BUILD' &&
    /OPERATION UNKNOWN TO THIS BUILD/.test(await p.locator('#missionSummary').textContent())]);

  await b.close();
  report(ok, errors);
})();
