# Requested changes
- [x] Draw socket branches directly on the main pipe without an added pipe and shorten visual branch proportions only.
- [x] Offer two collector modes with independent ends only in the configurable mode, preserving legacy axes and saved records.
- [x] Verify threaded/socket geometry, all end combinations, PDF/PNG and mobile controls without cloud writes.

Final drawing QA: 74 tests passed, including direct top/bottom socket junctions, unchanged production lengths/odd-outlet positions and 25 independent end combinations. Browser checks passed for the two modes, three requested end examples and 390×600 controls, with no page errors. PDF has one A4 sheet; PNG is 4000×2828. No cloud writes or database changes. The original supplied logo was served locally during browser export checks because of the sandbox asset proxy limitation; hosted asset delivery and native mobile sharing remain unverified.
- [x] Simplify and enlarge the sheet, correct socket junctions and add independent five-way pipe ends.
- [x] Add the supplied logo, home-screen icons and high-resolution PNG/PDF delivery.
- [x] Verify dimensions, saved-data compatibility, exports and mobile layout without modifying existing records.

Second update QA: 70 tests passed, including all 25 end combinations and saved JSON round trips. Real browser PDF/PNG downloads passed with no page errors; PNG is 4000×2828 and PDF is one sheet. Viewed both exports and socket junctions. Corrected WebP logo embedding in PDF. Local browser checks supplied the original CDN asset bytes through request interception because the sandbox asset path returns HTML; hosted delivery and native phone share/icon behavior remain unverified. No existing cloud records were modified.
- [x] Add independent open-end fittings, socket branches and expanded auxiliary positions without changing the database schema.
- [x] Remove the general spacing and separate thread section while preserving legacy layout controls and measurements.
- [x] Refresh proportional pipe rendering and verify save/reopen, mobile and single-sheet PDF.
- [x] Put the technical diagram above the manufacturing schedule in screen and PDF sheets.
- [x] Add optional left/right bottom drain and fixed half-inch top gauge fittings, preserving cloud saves and old geometry.
- [x] Verify fitting save/reopen, dimensions, pagination and PDF visually and with tests.

Workshop QA: 54 tests passed; signed-in cloud save/reopen retained fitting sides, offsets and branch connection. Draft switching and PDF download passed. The initial diagram was too narrow; independent horizontal/vertical scales widened it and made dimension arrows readable. All five short/sixty-branch PDF pages were visually inspected with no clipping or overlaps. Temporary test collector removed; native phone PDF display remains unverified.
- [x] Add separate cloud customer/project records and preserve existing saves.
- [x] Add main end types and independent numbered branch settings.
- [x] Match advanced drawing and PDF annotations and verify project isolation end to end.
- [x] Preserve all editor collectors when changing customer name.
- [x] Save all displayed collectors atomically as a uniquely identified snapshot on each explicit Save.
- [x] Show dated saved subgroups under customers and reopen only the selected subgroup.
- [x] Verify isolated saves, reopening, draft switching and PDF with tests and signed-in browser checks.
- [x] Stabilize collector switching, preserve local drafts, and restrict removal to confirmed X actions.
- [x] Show cloud-save success only on explicit Save and check related editor/PDF flows.
- [x] Make New open an isolated clean design without previous unnamed collectors.
- [x] Move cancellation to an X beside the active collector and verify addition/cancellation.
- [x] Allow unnamed customers with a saved fallback name and collector addition.
- [x] Confirm cancellation and return to the project list without saving the cancelled design.
- [x] Group the project list by customer with expandable collectors and counts.
- [x] Verify these three changes with tests and a signed-in browser flow.
- [x] Remove separate project name; use customer name in form, drawing and PDF.
- [x] Add account sign-in without profiles and private cloud save/list/open/delete.
- [x] Offer safe import of existing device records and verify cloud read-back/PDF.
- [x] Group multiple collectors by customer and generate one PDF with one collector per page.
- [x] Add readable notes to drawing and PDF; preserve saved project geometry.
- [x] Verify customer collection and multi-page PDF end to end.
- [x] Default new projects to Karşılıklı and Kapalı tek.
- [x] Add date and production quantity, with large quantity on drawing/PDF; saved values read back correctly.
- [x] Add direct PDF opening and verify the popup target and downloaded PDF in Chromium/WebKit; native PDF display on the user's phone remains unverified.

PDF visual inspection: date and large quantity are legible with no overlap or clipping in the 9-outlet, 25-unit example.
- [x] Select existing value on numeric input focus for direct retyping.
- [x] Default start length by layout: tek sıra 8 cm, karşılıklı 10 cm (editable).
- [x] Render mixed inch sizes as integer plus small stacked fraction in drawing and PDF; plain fractions stay flat.