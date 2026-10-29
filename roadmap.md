# Requested changes
- [ ] Add separate cloud customer/project records and preserve existing saves.
- [ ] Add main end types and independent numbered branch settings.
- [ ] Match advanced drawing and PDF annotations and verify project isolation end to end.
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