# Open decisions — banked for the end of the build

Decisions the docs don't settle. Each has a working choice already in the code so the build can proceed; all of them are reviewed together once development is complete. Only a genuine blocker gets raised mid-build.

| # | Topic | Working choice in the code | Raised |
|---|---|---|---|
| 1 | Rendered-preview pane ("render", frames 2g/2h, mermaid) — drawn, never ticketed | **Built (owner: baseline = VSCode's default preview):** render opens a rendered pane beside the editor (2g), GFM, live as you type, scroll synced both ways by source line; shares its renderer and typography with PDF export; raw HTML shown as text. Later: mermaid (2h), math, RTL, code highlighting, paged PDF | Phase 3 |
| 2 | PDF export — true one-click PDF needs a large library | Browser print dialog → "Save as PDF" | Phase 3 |
| 3 | Active-tab marker edge — audit (drift #2) recommends top; final frames 8a/8b draw bottom | **Decided (owner):** bottom, as built | Phase 3 |
| 4 | List continuation on Enter (`- item` ⏎ → next bullet) — CM6's markdown keymap, excluded by the zero-collision rule | **Decided (owner):** on, like stackedit — bullets, numbers (1. → 2.) and tasks continue; Enter on an empty item ends the list. A declared Enter binding ahead of the vscode keymap that acts only inside list items (not blockquotes, not code) | Phase 2 |
| 5 | Proofing flags (spelling / grammar / punctuation) — PRD and T5.4 expect them; the rule set never produces them | Undecided — needed before T5.4 | Addendum |
| 6 | Model and provider for the shared review call — no setting, no spec | **Decided (owner), for now:** provider is selectable — Google AI Studio added, failing over Flash → Flash-Lite → Gemma 4 → Gemma 3 on 404/429/500/503 (owner's call; each model has its own free quota) after OpenRouter's free pools kept returning 429 (ADR-004 amendment). OpenRouter: free and light — `qwen/qwen3.8-27b:free` (the only free Qwen; no JSON mode, so prompt + tolerant parser carry the format; its thinking is switched off to fit the timeout). Earlier picks: Gemma 4 free (shared-pool 429s), Nemotron 3 Ultra free (4+ minutes), Gemini 3.5 Flash Lite (not free). Requests give up after 60 s and can be cancelled. Model/provider choice and a fallback plan: to-do, to discuss | Addendum |
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
| 18 | Resuming a review after the document was edited | Flags re-anchored by their original text near their old position; lost ones become notes — now only when the owner picks "resume" (see #23) | Phase 5 |
| 19 | Proofing source (see #5) | Rides the same shared call — keeps "one call per document" | Phase 5 |
| 20 | Review control while a session exists | "Resume review" while the text is unchanged; "Review outdated" once it changed (see #23). Shares the status bar's left block with the theme icons, as wide as the sidebar | Phase 5 |
| 21 | T1-09 "section" before modes exist | Markdown heading sections (T1-09 is mode-independent, so it can't wait for the model's sections) | Phase 5 |
| 22 | Whether a stored key that re-tests as rejected is kept | Kept, marked rejected; "clear" removes it (a new rejected key is never stored) | Phase 5 |
| 23 | A review whose document changed since it ran | **Decided (owner):** strict — any change makes it stale. Unchanged → resume. Changed with nothing to lose (no undecided flags, no accepted/edited decisions) → a fresh review runs. Changed with something to lose → the control reads "review outdated" and asks: resume (re-anchor) or review again (discard). Closing a review with nothing to lose ends it | Testing |
| 24 | Flag colors and names in the review UI | **Decided (owner):** one hue per kind, replacing §1.6's neutral tier ramp — Quick fix (Tier 1) teal, Check fix (Tier 1b) amber, Your call (Tier 2 and no-fix flags) muted violet; proofing squiggles red spelling / yellow grammar / blue punctuation (an experiment). Tiers are never shown; an always-visible legend under the review toolbar names each kind with counts, and "?" explains them. Clickable legend filtering: not now | Testing |
