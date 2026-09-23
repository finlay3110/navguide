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

const rows = p => p.locator('#mission-name-list .combo-opt');

// The list is built on open, so it is opened through the control people use.
async function openList(p, key) {
  await p.locator('#mission-' + key + '-toggle').click();
  await p.waitForTimeout(40);
}

async function typeInto(p, key, text) {
  await p.locator('#mission-' + key).fill(text);
  await p.waitForTimeout(60);
}

(async () => {
  const b = await launch();
  const ok = [], errors = [];
  const p = await b.newPage();
  watch(p, errors);
  await p.goto(appUrl());
  await p.locator('#tab-mission-setup').click();

  // ---- the list behind the caret -----------------------------------------
  await openList(p, 'name');
  ok.push(['mission name is a searchable field',
    (await p.locator('#mission-name[role=combobox]').count()) === 1]);
  ok.push(['all 32 operations listed', (await rows(p).count()) === 32, await rows(p).count()]);

  const groups = await p.locator('#mission-name-list .combo-group').evaluateAll(gs =>
    gs.map(g => ({
      label: g.textContent.trim(),
      // Rows belonging to a heading are the ones before the next heading.
      n: (() => { let n = 0, el = g.nextElementSibling;
        while (el && el.classList.contains('combo-opt')) { n++; el = el.nextElementSibling; }
        return n; })(),
    })));
  ok.push(['grouped by type', groups.length === 4, JSON.stringify(groups.map(g => g.label))]);
  ok.push(['group counts match the source list',
    groups.every(g => EXPECTED[g.label] === g.n), JSON.stringify(groups)]);
  ok.push(['type picker still offers the four types', await p.evaluate(() =>
    [...document.querySelectorAll('#mission-type-select option')]
      .map(o => o.value).filter(v => v && v !== '__other__').length === 4)]);

  // ---- searching ----------------------------------------------------------
  await typeInto(p, 'name', 'tedd');
  ok.push(['typing filters the list', (await rows(p).count()) === 1, await rows(p).allTextContents()]);
  ok.push(['...to the match', (await rows(p).first().textContent()) === 'OPERATION TEDDER']);

  await typeInto(p, 'name', 'operation');
  const many = await rows(p).count();
  ok.push(['a broader search keeps every match', many > 1 && many < 32, many]);

  await typeInto(p, 'name', 'TEDD');
  ok.push(['search ignores case', (await rows(p).count()) === 1]);

  // ---- choosing from the list fills the type ------------------------------
  let allDerived = true, detail = '';
  for (const [name, type] of SAMPLES) {
    await typeInto(p, 'name', name.slice(0, 12));
    await rows(p).filter({ hasText: name }).first().click();
    await p.waitForTimeout(60);
    const s = await readStore(p);
    if (s.mission.name !== name || s.mission.type !== type) {
      allDerived = false;
      detail += name + ' -> ' + s.mission.name + '/' + s.mission.type + ' (want ' + type + '); ';
    }
  }
  ok.push(['choosing an operation sets its type', allDerived, detail]);
  ok.push(['and says so', /Mission type set to/.test(await p.locator('#note-mission-setup').textContent())]);
  ok.push(['type picker reflects the derived value',
    (await p.locator('#mission-type-select').inputValue()) === 'Intrigue']);
  ok.push(['the list closes once something is chosen',
    await p.locator('#mission-name-list').isHidden()]);

  // ---- keyboard -----------------------------------------------------------
  await p.locator('#mission-name').fill('');
  await p.locator('#mission-name').focus();
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowDown');
  const active = await p.locator('#mission-name-list .combo-opt.active').textContent();
  ok.push(['arrow keys move through the list', !!active, active]);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(60);
  ok.push(['Enter chooses the active row',
    (await p.locator('#mission-name').inputValue()) === active, await p.locator('#mission-name').inputValue()]);
  await openList(p, 'name');
  await p.keyboard.press('Escape');
  ok.push(['Escape closes the list', await p.locator('#mission-name-list').isHidden()]);

  // ---- freetext is always allowed ----------------------------------------
  await typeInto(p, 'name', 'OPERATION LONGSHORE');
  let s = await readStore(p);
  ok.push(['an unlisted name is stored as typed', s.mission.name === 'OPERATION LONGSHORE', s.mission.name]);
  ok.push(['and the list says so rather than going blank',
    /what you typed is kept/i.test(await p.locator('#mission-name-list .combo-empty').textContent())]);

  await p.locator('#mission-type-select').selectOption('__other__');
  await p.waitForTimeout(60);
  await p.locator('#mission-type').fill('Search and rescue');
  await p.waitForTimeout(60);
  s = await readStore(p);
  ok.push(['typed type is stored', s.mission.type === 'Search and rescue', s.mission.type]);

  // ---- an unlisted value round-trips --------------------------------------
  await p.reload();
  await p.locator('#tab-mission-setup').click();
  ok.push(['an unlisted name survives a reload',
    (await p.locator('#mission-name').inputValue()) === 'OPERATION LONGSHORE']);
  ok.push(['unlisted type reopens as Other',
    (await p.locator('#mission-type-select').inputValue()) === '__other__' &&
    (await p.locator('#mission-type').inputValue()) === 'Search and rescue']);

  // ---- switching back to a listed operation replaces it -------------------
  await typeInto(p, 'name', 'CLAYMORE');
  await rows(p).first().click();
  await p.waitForTimeout(60);
  s = await readStore(p);
  ok.push(['choosing a listed operation replaces the typed name',
    s.mission.name === 'OPERATION CLAYMORE' && s.mission.type === 'Military',
    JSON.stringify({ n: s.mission.name, t: s.mission.type })]);

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
