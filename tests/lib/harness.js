'use strict';

// Shared plumbing for the suites: browser resolution, the app URL, artefact
// paths, and the pass/fail collector. Each suite is a plain Node script that
// can be run directly or through tests/run.js.

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS = path.join(__dirname, '..', '.artifacts');

// The tool is used on an iPhone, so WebKit is the engine that matters; Chromium
// stays the default because it is what most dev environments have to hand.
const ENGINE = process.env.UCN_BROWSER || 'chromium';

function engine() { return ENGINE; }
function isChromium() { return ENGINE === 'chromium'; }

// Playwright finds its own browser everywhere except sandboxes that ship one
// at a fixed path; UCN_CHROMIUM covers that case without hardcoding it.
function launchOpts(extra) {
  const opts = Object.assign({}, extra);
  if (isChromium() && process.env.UCN_CHROMIUM) opts.executablePath = process.env.UCN_CHROMIUM;
  return opts;
}

// One place decides the engine, so suites never name one themselves.
async function launch(extra) {
  const type = playwright[ENGINE];
  if (!type) throw new Error('Unknown UCN_BROWSER "' + ENGINE + '" (expected chromium or webkit)');
  try {
    return await type.launch(launchOpts(extra));
  } catch (err) {
    throw new Error(
      'Could not launch ' + ENGINE + '. Install it with `npx playwright install ' + ENGINE + '`.\n' +
      'Some sandboxes block cdn.playwright.dev, in which case only the engine already present can run ' +
      '(set UCN_CHROMIUM to its executable).\n\nUnderlying error: ' + err.message);
  }
}

// Engine-specific checks are recorded as skipped rather than dropped, so a run
// on one engine never silently loses coverage the other has.
function skip(ok, name, why) {
  ok.push([name + '  [skipped on ' + ENGINE + ': ' + why + ']', true]);
}

function appUrl() {
  return pathToFileURL(path.join(ROOT, 'index.html')).href;
}

function artifact(name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  return path.join(ARTIFACTS, name);
}

// Google Fonts is unreachable in CI and in sandboxes, and the page is designed
// to fall back, so that noise is not a test failure.
function watch(page, errors) {
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/fonts\.googleapis|fonts\.gstatic|net::ERR/.test(m.text())) {
      errors.push('CONSOLE: ' + m.text());
    }
  });
}

async function openApp(browser, contextOpts, errors) {
  const page = await browser.newPage(contextOpts);
  if (errors) watch(page, errors);
  await page.goto(appUrl());
  return page;
}

// Expanded state is shared across tabs, so toggling blindly can *close* a row
// that another tab already opened.
async function ensureOpen(item) {
  const open = await item.evaluate(e => e.classList.contains('open'));
  if (!open) await item.locator('button.row').click();
}

// Adds waypoints by driving the real form, so the app's own validation,
// timestamps and storage writes all run.
function seedWaypoints(page, rows) {
  return page.evaluate(list => {
    list.forEach(w => {
      const f = document.querySelector('form.wp-form[data-cat="' + w.cat + '"]');
      f.elements.number.value = w.number;
      f.elements.title.value = w.title;
      f.elements.sector.value = w.sector || '';
      f.elements.description.value = w.description || '';
      f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }, rows);
}

function readStore(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('ucn_nav_radar_waypoints')));
}

// ok entries are [name, passed, detail?]; detail is printed only on failure.
function report(ok, errors) {
  let failed = 0;
  ok.forEach(([name, passed, detail]) => {
    if (!passed) failed++;
    console.log((passed ? 'PASS ' : 'FAIL ') + name +
      (!passed && detail !== undefined ? '  -> ' + detail : ''));
  });
  if (errors && errors.length) {
    console.log('\nJS ERRORS:');
    errors.forEach(e => console.log('  ' + e));
  }
  const errCount = errors ? errors.length : 0;
  console.log('\n' + (ok.length - failed) + '/' + ok.length + ' checks passed, ' + errCount + ' js errors');
  process.exit(failed || errCount ? 1 : 0);
}

module.exports = {
  launch, engine, isChromium, skip, launchOpts, appUrl, artifact,
  watch, openApp, ensureOpen, seedWaypoints, readStore, report,
};
