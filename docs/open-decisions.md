# Open decisions — banked for the end of the build

Decisions the docs don't settle. Each has a working choice already in the code so the build can proceed; all of them are reviewed together once development is complete. Only a genuine blocker gets raised mid-build.

| # | Topic | Working choice in the code | Raised |
|---|---|---|---|
| 1 | Rendered-preview pane ("render", frames 2g/2h, mermaid) — drawn, never ticketed | Button present but inert | Phase 3 |
| 2 | PDF export — true one-click PDF needs a large library | Browser print dialog → "Save as PDF" | Phase 3 |
| 3 | Active-tab marker edge — audit (drift #2) recommends top; final frames 8a/8b draw bottom | Bottom, as 8a/8b | Phase 3 |
| 4 | List continuation on Enter (`- item` ⏎ → next bullet) — CM6's markdown keymap, excluded by the zero-collision rule | Off | Phase 2 |
| 5 | Proofing flags (spelling / grammar / punctuation) — PRD and T5.4 expect them; the rule set never produces them | Undecided — needed before T5.4 | Addendum |
| 6 | OpenRouter model for the shared review call — no setting, no spec | **Decided (owner):** free model for now — `google/gemma-4-31b-it:free` | Addendum |
| 7 | Verbatim `span` matching when the same text occurs more than once | First unclaimed occurrence in document order, unless the interaction spec says otherwise | Addendum |
| 8 | T1-04 (markdown leakage) in a markdown editor | Conservative: only markup inside flowing prose | Addendum |
| 9 | PRD §7 — undecided review flags persist and are resumable | Build as proposed (T5.6 requires it) | PRD |
| 10 | PRD §7 — plain-text export strips markdown | Built as proposed (T3.6) | PRD |
| 11 | Deployment target (T0.3) | **Decided (owner):** discussed at the very end, after the owner has tested everything | Phase 0 |
| 12 | Undo-toast window length | 8 seconds | Phase 3 |
| 13 | Tab overflow | Strip scrolls sideways + "+N ▾" list of every tab | Phase 3 |
| 14 | Row "⋯" menu button (3e, an alternative to right-click) | Not built; right-click only | Phase 3 |
| 15 | "Comment-only note" for model quotes that don't match the document — the addendum calls it an existing mechanism; no spec defines it | Note flag: no span, listed in the review log, bubble explains, decided by Dismiss | Phase 5 |
| 16 | Overlapping flags (e.g. a banned word inside a sentence the model rewrote) | Wider span wins its stretch in preview/apply; the narrower flag still needs its own decision | Phase 5 |
| 17 | banned-vocabulary.md entries whose "replacement" is guidance ("state the failure mode it survives") | Routed to the shared call as a generative fix; "(cut)" entries cut mechanically | Phase 5 |
| 18 | Resuming a review after the document was edited | Flags re-anchored by their original text near their old position; lost ones become notes | Phase 5 |
| 19 | Proofing source (see #5) | Rides the same shared call — keeps "one call per document" | Phase 5 |
| 20 | Review control while a session exists | Reads "resume review" (fixed-width slot, widened to 200px to fit the error state) | Phase 5 |
| 21 | T1-09 "section" before modes exist | Markdown heading sections (T1-09 is mode-independent, so it can't wait for the model's sections) | Phase 5 |
| 22 | Whether a stored key that re-tests as rejected is kept | Kept, marked rejected; "clear" removes it (a new rejected key is never stored) | Phase 5 |
