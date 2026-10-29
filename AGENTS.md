<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep project field defaults and backward-compatible saved-project normalization in the collector module so new fields do not change existing geometry settings.
- Generate SVG and PDF content from the same drawing primitives so production annotations match in preview and print.
- Keep PDF generation dynamically imported, and expose a prepared blob URL through a direct user-clicked link for opening without invoking the share sheet.
- Build editor and PDF batches from ordered session IDs, never filter editor members by customer name, so renaming preserves every local draft.
- Use shared collector customer-label/grouping helpers for editor batches and expandable cloud lists; apply the blank-name fallback on cloud writes while preserving legacy normalization and geometry.
- Editor cancellation discards only local edits and opens the project list; persisted record deletion remains a separate confirmed cloud operation.
- Opening a cloud save restores only its batch ID and stored order; legacy ungrouped records open individually because their original save boundaries cannot be reconstructed.
- Keep per-collector local draft snapshots including raw numeric inputs; addition and switching are synchronous without cloud writes. Saving a new editor session inserts one batch with fresh IDs; saving a session opened from (or already saved as) a batch upserts that batch ID and member IDs and deletes removed members, so groups never duplicate. Legacy import remains separate.
- Store collectors through the generated browser Cloud client with owner-scoped RLS and a composite owner/legacy-ID key; this preserves legacy IDs while preventing cross-account access.
- Keep the editor public with inline account sign-in and one root auth-state provider; authenticated client queries power cloud records without protected SSR calls.
- Preserve legacy device records for explicit import and retain their hidden name field for compatibility; visible naming uses the customer field.
- Wrap production notes in the collector module and render them through shared drawing primitives; PDF accepts one project or a batch with one page per collector.
- Advanced projects use separate owner-scoped customer and project entities; a SECURITY INVOKER database RPC atomically saves the project and exact member set to prevent cross-project mixing and partial saves.
- Keep projectTitle distinct from the hidden legacy name and propagate project identity across ordered local drafts.
- Advanced branch axes accumulate independently on each side, with the first axis at the start allowance; branch numbering follows original layout order, top before bottom.
- Render manufacturing sheets with the diagram above the first schedule rows and paginate overflow using shared primitives; preserve legacy axis geometry unless branch settings are edited.
- Store optional fittings as a separate collector JSON field and use the shared production schedule for their placement and table values, so they never change numbered branch membership or axes.
