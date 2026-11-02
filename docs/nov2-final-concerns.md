# November 2, 2026 final concern fixes

Scope: the six-page 3pm concern document, plus the resident missing-contact label and Environmental Awareness Article report. Changes retain the forest-green/cream TrashTrack theme, rounded controls, Outfit typography and approved Balete photography.

## Findings and changes

| Concern | Cause | Implemented behavior |
| --- | --- | --- |
| View/print a chosen month | Analytics offered rolling GIS windows but exported other summaries across all dates. | A month/year selector scopes report totals, charts, collections, events, learning counts and the report record list. Both printable and downloaded PDFs use the same selected records. Month intervals use Asia/Manila, inclusive start and exclusive next-month start. |
| Report status confirmation becomes stuck | Confirmation was a separate modal sibling, with its open state surviving some report selections. | Confirmation is nested within its owning report dialog, reset on report selection/filter/close, and cannot open without a selected action. Server revision checks and draft recovery remain. This shared component serves MENRO and barangay staff. |
| Notification toolbar clutter | The toolbar exposed delivery filters and two creation links. | Removed the delivery-state filter and the creation tab beside history. The header creation action remains. Delivery labels/errors/retry stay truthful and functional. |
| Notification categories | History filter exposed additional report/general entries. | Filter offers Schedule, Alerts and Events. Historical report/general notices remain available under All categories, without deleting or relabeling stored notices. |
| Resident account-status filter | Staff approval/suspension choices appeared for residents. | Account-status filtering is hidden and ignored on the resident view. Staff account controls remain in their staff views. |
| Resident missing contact text | Empty contact values produced a conspicuous placeholder. | Contact rows render when a number exists; the empty-contact placeholder is removed from the resident list and profile. No profile data is erased. |
| Cover upload is hard to notice | Optional cover used a native text-sized file input. | Added a themed upload panel with icon, Browse files control, visible file requirements, preview and Remove cover action. |
| Missing learning filters | Resource filters hard-coded only Waste Segregation/Composting and Guide/Video. | Shared options cover all four categories and Guide/Video/Article; existing additional category labels are retained. |
| Environmental Awareness Article missing on phone | Android only displayed Guide/Document and Video resources. | Articles are included in the reading library regardless of category. A read-only production check found the existing Environmental Awareness Article already stored among seven resources; no re-upload/data migration is needed. |
| Written Articles require an attachment | Publication always parsed an external source URL. | A written Article can publish from its content without a file/cover. Android and dashboard readers display its saved plain text. Article PDFs still use the document reader and external links still open the original article. Required-file validation remains for Guide/Video. |
| No AM/PM in phone collection updates | Edit/cancel/follow-up and creation messages interpolated stored 24-hour values. | All new collection lifecycle notices format their times as AM/PM before Firebase receives the push. Event publication uses the same clock formatter. |
| Missing outcome notes | Collection edits omitted existing outcome notes; the inbox had no structured full-note field. | Outcome and change notices include an explicit note excerpt within the phone payload limit and save the complete notes separately. Android inbox and staff notification details show the full saved notes. Legacy notices remain readable. |

## Validation and limits

- Web regression suite: 192 passing tests, including month boundaries/year changes/leap February, selected-record totals, written Articles, every supported category/type, preserved PDF sources, invalid input, lifecycle AM/PM messages and bounded push/full-note behavior.
- Synthetic monthly PDF sample: all 37 August records included; September record excluded. All four rendered pages and the one-page empty-period sample visually inspected. No live report records were generated.
- TypeScript, lint, production build, function-bundle and read-only Firebase readiness checks passed.
- Android 1.0.7 (version code 8): 61 unit tests and six targeted offline UI checks passed. The Article reader, large-text Article and full outcome-note screens were visually inspected after clearing an emulator System UI overlay. No app-code failure was found in that overlay.
- One initial UI test had an ambiguous Back selector (both library and article headers); the selector was scoped to the dialog and the complete six-test selection passed on rerun.
- Browser UI interaction is disabled in Work settings. The report modal fix was checked against the installed Base UI parent-dialog implementation and reviewed in source; browser click-through is not claimed as tested.
- Password reset, account passwords, authenticator activation and Firestore access policy are unchanged. No reset messages, synthetic production notices, or duplicate learning records were created for validation.

Monthly report exports use submission dates and **current** saved statuses, rather than reconstructing historical statuses at month end. Event counts use event dates, collection counts use scheduled collection dates, and learning counts use publication dates. Undated records remain available in All recorded dates and are excluded from a specific month with a visible explanation.

Full outcome notes are available for notices saved with the new field. Historical phone tray notifications already delivered by Android retain their original text.
