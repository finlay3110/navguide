# UCN Navigation & Radar

A fan-made reference and logging tool for the United Confederation Navy (UCN) community. This tool is **not affiliated with or endorsed by Bridge Command / The London Space Elevator Limited**.

## What it does

Lets you log waypoints (waypoint number, title, optional sector, and a description of what the waypoint means) and organises them by category across nine tabs:

1. **Mission Setup** — details of the sortie: date, time, mission name, mission type, navigator, rank and ship.
2. **All** — every logged waypoint in one place, colour-coded by category. Select any entry to expand its details.
3. **Navigation / Course Plotting** (white) — course plotting and immediate navigation/route waypoints.
4. **Hazards** (purple) — hazards and areas to avoid.
5. **Objectives** (green) — general objectives.
6. **Hostiles / Hostile Area** (red) — hostile contacts and hostile areas.
7. **Unknown / Suspect / Investigate** (yellow) — unidentified or suspicious contacts worth investigating.
8. **Mission Objectives** (royal blue) — dedicated mission objective waypoints.
9. **History** — every completed waypoint, most recently finished first.

Each waypoint can be expanded for its full description, then **completed**, **edited** or **deleted** from its expanded view. Deleting asks for confirmation first. If you reuse a waypoint number already used in the same category, the tool logs the entry anyway and flags the clash so you can spot it.

Expanded entries stay expanded while you add, edit or delete other waypoints, and an entry opened in its category tab shows as open in the **All** tab too.

## Completing a waypoint

Press **Complete** on an expanded waypoint and a dialog asks what the outcome was:

- **Quick outcome buttons** finish it in one tap, and differ by category — Hostiles offer "Threat neutralised" and "Hostile disengaged", Nav offers "Arrived at destination" and "Passed / bypassed", and so on. Every category also offers "No longer required". If you have already typed a note, the button's label is added in front of it rather than replacing it.
- The **freetext box** records anything else worth logging; **Mark Complete** saves it.
- **Cancel** closes the dialog and leaves the waypoint untouched, for when Complete was pressed by accident. Escape and clicking outside the dialog do the same.

A completed waypoint stays in its category tab, dimmed and struck through, sorted below the work still outstanding, and it also appears in **History**. Its category colour stripe stays at full strength so it is still identifiable at a glance.

**Restore** puts a completed waypoint back with the active work. It keeps the outcome text, so if you completed it by mistake and complete it again later, what you wrote is offered back to you.

### Times

Waypoints record when they were logged and when they were completed, shown as start time, completion time and how long it took. Waypoints saved before this feature existed have no start time and show a dash.

## Mission Setup

The first tab records the sortie: date, time, mission name, mission type, navigator, rank and ship. It saves as you type — there is no Save button to forget — and **Set date & time to now** fills both from the clock. **Clear setup** empties every field.

**Mission name** is a picker of the 32 known operations, grouped by type — Military, Exploration, Diplomacy and Intrigue. Choosing one fills in the mission type for you, since the operation determines it: pick OPERATION TEDDER and the type becomes Military. **Mission type** is a picker too, for the sorties that aren't on the list.

Both pickers end with **Other…**, which reveals a text box for anything not listed — a new operation, a training run, or a type the list doesn't cover. Choosing an operation after typing something replaces the typed value, and a log imported with an operation the tool doesn't know reopens in the text box with the name intact rather than being silently dropped.

Mission setup is stored alongside the waypoints and included in every export.

### Starting a new mission

Waypoints are not tied to a mission, so without a boundary every category tab and **History** would keep accumulating across sorties — and the PDF cover would print one mission's name over a report containing all of them.

**New mission** clears the log and the setup so the tool only ever holds the sortie in progress; past missions live in the JSON files you exported. It confirms first, showing how much will be cleared, and:

- If there are changes that have not been exported, it says so and offers **Export, then start**, which writes the mission out before clearing it.
- If the log was already exported, it tells you when, so you know it is recoverable.
- Cancel and Escape leave everything untouched, and the confirmation opens with focus on Cancel rather than the destructive action.

## Export & Import

- **PDF Report** produces a printable mission report: cover sheet, clickable table of contents, mission setup, waypoint summary and per-category tables, waypoint detail, the completed log with outcomes and durations, and the quick reference.
- **Export** downloads your whole log as a JSON file (`ucn-waypoints-YYYY-MM-DD.json`).
- **Import** reads a previously exported file and **merges** it into the current log — nothing is overwritten, and entries that don't parse as valid waypoints are skipped and reported.
- Mission setup is singular rather than a list, so it is only adopted from an imported file when your own setup is still blank. If you have already filled it in, the file's setup is ignored and the import says so — an import can never overwrite the sortie in progress.

Use these to move a log between devices or browsers, or to back it up before clearing your browser data.

## Quick Reference panel

Accessible via the "Quick Reference" button in the header. Closes with Escape or by clicking outside it.

Each section is collapsed behind its own button, so the panel opens as a short index rather than a long scroll — tap the one you need. Sections open independently, and whichever you left open is still open next time you bring the panel up. It contains:

- **Ship types** — Drone, Fighter, Gunship, Shuttle, Frigate, Destroyer, Cruiser, Battle Cruiser, Battleship, Carrier, Freighter, Small Station and Arrow, each with its silhouette. Gunship still shows the dashed placeholder slot, as no gunship artwork has been supplied yet; drop one in and it picks up the same treatment as the rest.
- **Radar colour meanings** — Red (Gravity), Green (Biological/Thermal), Blue (Electrical), with what each shows up on radar.
- **Scanned ship colour meaning** — Blue (UCN), Green (Allied), Red (Hostile), Yellow (Unknown/UVP), Grey/White (Unscanned).
- **Ordnance type colours** — Gold chevron (Torpedo/tracker), Grey/white chevron (HVLI/Slug), Orange chevron (Nuke), Purple chevron (EMP), White circle (Mine).
- **Compass** — a bearing dial marked every 20° from 0–340, with the four cardinal bearings (0, 90, 180, 270) picked out in orange.

## On an iPhone

The tool is built for use on a phone mid-mission:

- **Add it to your home screen** (Share → Add to Home Screen) for a full-screen app with no Safari chrome, which also recovers about 115px of vertical space. It carries the UCN roundel as its icon.
- The tab strip is a single row you swipe sideways, and it stays pinned to the top while a long waypoint list scrolls beneath it. Selecting a tab scrolls the strip, never the page.
- The add form is collapsed behind **+ Add Waypoint** on phones and always open on desktop, because during a mission you read the log far more often than you add to it.
- Every control is at least 44pt, and form fields are 16px so iOS does not zoom the page when you tap into one. Pinch zoom is left enabled.
- Layout respects the notch and home indicator in both orientations.
- **PDF Report** opens the report in a new tab on iOS rather than downloading it, so you can save or print it from the share sheet. A file download can fail silently once the tool is installed to the home screen.

## Keeping your log

The log lives in this browser on this device, and nowhere else.

**Install it to your home screen.** iOS clears saved website data after roughly a week without opening a site, which would empty the log with no warning. A site installed to the home screen is exempt. The tool offers this on first run — on iOS via Share → Add to Home Screen, on Android with an Install button — and the prompt goes away once you install or dismiss it. Where the browser supports it, the tool also asks for persistent storage; Safari does not honour that, which is why installing matters there.

**It works with no signal.** The tool caches itself on first load, so it opens
and runs on venue wifi that has dropped, in a dead spot, or in airplane mode —
adding waypoints, completing them and generating the PDF report all happen on
the device. Without that, an app installed to the home screen and launched with
no network shows a browser error, which is exactly when you need it. Fonts are
the one part that comes from the network; offline they fall back to the system
face until you have loaded the tool online once.

When a new version has been deployed, the tool says so and waits — it never
reloads itself mid-mission. Close and reopen it to pick the new version up.

**Export is the backup.** The Mission Setup tab shows whether the log has ever been exported and whether it has changed since, and the Export button carries an amber dot whenever there are unsaved changes. Only the JSON export counts — a PDF is a report, not something you can restore from.

## Running the tests

The tool ships as a single `index.html` with no build step. The test suites are
dev-only tooling and are never served.

```
npm install
npx playwright install chromium
npm test
```

Twelve suites, around 225 checks, covering behaviour, storage and migration,
the completion flow, mission setup, the operations picker, mission boundaries,
the Quick Reference accordion, ship icons, PDF generation, colour contrast,
backup/install data safety, and offline operation. They run automatically on
every pull request. See `tests/README.md`.

## Keyboard & accessibility

- Tabs follow the standard tablist pattern: arrow keys move between categories, Home/End jump to the first/last.
- Waypoint rows are real buttons — reachable by Tab, opened with Enter or Space, and they report their expanded state to screen readers.
- The Quick Reference and completion panels are proper modal dialogs: focus moves into them on open, stays trapped inside while open, and returns to the button that opened them on close. The completion dialog opens with focus in the outcome text box rather than on a button, so a stray Enter can't complete a waypoint you opened by accident.
- Category is conveyed by text as well as colour, so entries aren't identified by colour alone.

## Notes

- `sw.js` is the one file besides `index.html` that is served. A service worker
  cannot be inlined — it has to be a real file at the site root to claim the
  right scope — so the tool is a single page plus a small worker rather than a
  single file. It caches the page and serves it from cache first, then checks
  for a new deploy in the background and compares ETags to decide whether to
  mention it. To withdraw it, deploy an `sw.js` containing only
  `self.addEventListener('install', function(){ self.registration.unregister(); });`
  — every device picks that up on its next load and the caches go with it.
- PDF reports are generated in the browser by jsPDF, vendored inline along with subset Exo 2 and Orbitron fonts, so export works offline with no build step and no CDN. This is what makes `index.html` large; if the fonts fail to register the report still exports, falling back to Helvetica.
- The report cover carries the UCN roundel, inlined as a base64 PNG flattened onto white and colour-reduced, at roughly 356dpi for the 32mm it prints at. If the image cannot be decoded the cover falls back to a drawn vector mark rather than failing the export.
- Waypoint data is stored locally in the browser (per device/browser), so it will persist between visits on the same device but won't sync across devices. If the browser blocks local storage, a banner warns you that the log won't survive closing the page.
- Stored data carries a schema version, and logs saved by older versions of the tool are migrated automatically on load. Completion times and outcomes are included in exports.
- Matches the standard UCN dark navy visual theme used across the rest of the tool suite.
- The UCN roundel appears in the app header, as the browser tab icon, and on the PDF cover, all inlined as base64 PNGs. The supplied artwork is a knockout — its ring and manta are transparent holes rather than white pixels — so the header and favicon copies have those holes filled with white and only the area outside the disc left transparent. Without that the mark disappears against the navy header. The disc's own navy matches the header almost exactly, so a CSS hairline ring gives it an edge rather than recolouring the artwork.
- Ship icons are inlined into `index.html` as SVG rather than loaded as separate files, so the tool remains a single self-contained page with no build step. They are drawn with `currentColor`, so they follow the theme's text colour instead of carrying their own.

### Adding or replacing a ship icon

Add an entry to the `SHIP_ICONS` map in `index.html` and reference its key from `SHIP_TYPES`. An entry with no `icon` key renders the dashed placeholder slot. Icons exported from Inkscape need two things done first: strip the editor metadata, and set the `viewBox` to the artwork's real bounding box — several of the supplied files shipped with a `viewBox` that cropped part of the drawing.

---

Designed by Lt Fin "Tetra"
