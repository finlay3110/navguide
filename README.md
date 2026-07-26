# UCN Navigation & Radar

A fan-made reference and logging tool for the United Confederation Navy (UCN) community. This tool is **not affiliated with or endorsed by Bridge Command / The London Space Elevator Limited**.

## What it does

Lets you log waypoints (waypoint number, title, optional sector, and a description of what the waypoint means) and organises them by category across seven tabs:

1. **All** — every logged waypoint in one place, colour-coded by category. Select any entry to expand its details.
2. **Navigation / Course Plotting** (white) — course plotting and immediate navigation/route waypoints.
3. **Hazards** (purple) — hazards and areas to avoid.
4. **Objectives** (green) — general objectives.
5. **Hostiles / Hostile Area** (red) — hostile contacts and hostile areas.
6. **Unknown / Suspect / Investigate** (yellow) — unidentified or suspicious contacts worth investigating.
7. **Mission Objectives** (royal blue) — dedicated mission objective waypoints.

Each waypoint can be expanded for its full description, then **edited** or **deleted** from its expanded view. Deleting asks for confirmation first. If you reuse a waypoint number already used in the same category, the tool logs the entry anyway and flags the clash so you can spot it.

Expanded entries stay expanded while you add, edit or delete other waypoints, and an entry opened in its category tab shows as open in the **All** tab too.

## Export & Import

- **Export** downloads your whole log as a JSON file (`ucn-waypoints-YYYY-MM-DD.json`).
- **Import** reads a previously exported file and **merges** it into the current log — nothing is overwritten, and entries that don't parse as valid waypoints are skipped and reported.

Use these to move a log between devices or browsers, or to back it up before clearing your browser data.

## Quick Reference panel

Accessible via the "Quick Reference" button in the header. Closes with Escape or by clicking outside it. Includes:

- **Ship types** — Drone, Fighter, Gunship, Shuttle, Frigate, Destroyer, Cruiser, Battle Cruiser, Battleship, Carrier, Freighter, Small Station and Arrow, each with its silhouette. Gunship still shows the dashed placeholder slot, as no gunship artwork has been supplied yet; drop one in and it picks up the same treatment as the rest.
- **Radar colour meanings** — Red (Gravity), Green (Biological/Thermal), Blue (Electrical), with what each shows up on radar.
- **Scanned ship colour meaning** — Blue (UCN), Green (Allied), Red (Hostile), Yellow (Unknown/UVP), Grey/White (Unscanned).
- **Ordnance type colours** — Gold chevron (Torpedo/tracker), Grey/white chevron (HVLI/Slug), Orange chevron (Nuke), Purple chevron (EMP), White circle (Mine).
- **Compass** — a bearing dial marked every 20° from 0–340, with the four cardinal bearings (0, 90, 180, 270) picked out in orange.

## Keyboard & accessibility

- Tabs follow the standard tablist pattern: arrow keys move between categories, Home/End jump to the first/last.
- Waypoint rows are real buttons — reachable by Tab, opened with Enter or Space, and they report their expanded state to screen readers.
- The Quick Reference panel is a proper modal dialog: focus moves into it on open, stays trapped inside while it's open, and returns to the button that opened it on close.
- Category is conveyed by text as well as colour, so entries aren't identified by colour alone.

## Notes

- This tool does not generate or export PDFs. Export is JSON only.
- Waypoint data is stored locally in the browser (per device/browser), so it will persist between visits on the same device but won't sync across devices. If the browser blocks local storage, a banner warns you that the log won't survive closing the page.
- Stored data carries a schema version, and logs saved by older versions of the tool are migrated automatically on load.
- Matches the standard UCN dark navy visual theme used across the rest of the tool suite.
- Ship icons are inlined into `index.html` as SVG rather than loaded as separate files, so the tool remains a single self-contained page with no build step. They are drawn with `currentColor`, so they follow the theme's text colour instead of carrying their own.

### Adding or replacing a ship icon

Add an entry to the `SHIP_ICONS` map in `index.html` and reference its key from `SHIP_TYPES`. An entry with no `icon` key renders the dashed placeholder slot. Icons exported from Inkscape need two things done first: strip the editor metadata, and set the `viewBox` to the artwork's real bounding box — several of the supplied files shipped with a `viewBox` that cropped part of the drawing.

---

Designed by Lt Fin "Tetra"
