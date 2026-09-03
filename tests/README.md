# Tests

The tool is a single self-contained `index.html` with no build step. These
suites drive it in a real browser through Playwright and are the only thing
standing between a refactor and a silent regression.

## Running them

```
npm install
npx playwright install chromium
npm test
```

Run one suite, or a few, by name fragment:

```
npm test iphone
npm test contrast pdf
node tests/iphone.test.js        # suites also run standalone
```

If your environment ships a Chromium that Playwright did not install itself,
point at it: `UCN_CHROMIUM=/path/to/chrome npm test`.

`npm run measure:iphone` prints the layout numbers behind the iPhone targets
(header height, tab rows, where the first waypoint lands) without asserting
anything — useful when changing mobile layout.

## The suites

| Suite | Guards |
|---|---|
| `behaviour` | Tabs, add/edit/delete, HTML escaping, storage v3, migration from the v0 bare-array and v1/v2 formats, modal accessibility, keyboard navigation, export/import |
| `completion` | Completion dialog, per-category quick outcomes, cancel leaving the waypoint untouched, restore preserving the outcome, timing, history |
| `iphone` | Layout targets on three viewports, 44px touch targets, 16px form controls, the add-form disclosure, sticky tab strip, iOS scroll lock, install metadata |
| `mission-setup` | Mission fields, autosave, import adopting setup only when blank, escaping of imported text |
| `quick-reference` | The section accordion, its scoping away from the completion dialog, compass surviving the restructure |
| `ship-icons` | Ship grid contents, `currentColor` inheritance, viewBox refit, Arrow scaling |
| `pdf-export` | Report generates, filename slug, fonts embed rather than falling back |
| `contrast` | Static: category colours meet 3:1 against the card, text meets 4.5:1, and each `--c-*` matches its `CATEGORIES[].hex` |

## Conventions

Suites are plain Node scripts sharing `lib/harness.js`. Each collects
`ok.push([name, passed, detail])` and ends with `report(ok, errors)`, which
prints and sets the exit code. `detail` is shown only when the check fails.

Two things have caught me out and are worth remembering:

- **Do not measure geometry inside collapsed or hidden UI.** `getBBox()`
  returns zero, which looks exactly like broken artwork. Open the section
  first — this is why `ship-icons` expands Ship Types before measuring.
- **Prefer `page.evaluate(() => el.click())` when the assertion depends on
  scroll position.** Playwright's `locator.click()` scrolls the target into
  view first, which quietly destroys what you were trying to measure.

Also note that expanded state is shared across tabs by design, so use
`ensureOpen()` rather than clicking a row and assuming it opened.
