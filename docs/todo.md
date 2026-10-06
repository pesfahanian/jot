# Jot — roadmap and to-do

Decisions still open live in `open-decisions.md`.

## Roadmap (agreed with the owner)

Done: Phases 0–10 (v1.0.0 plus polish, editor power, render & export, first impressions), Phase 12 (AI providers), Phase 13 (Layout 2.0).

| Phase | Contents |
|---|---|
| 12: AI providers ✓ | OpenAI and Anthropic alongside OpenRouter and Google; provider dropdown; model picker suggesting from the provider's model list; per-provider fallback chain; new hosts in `public/_headers` connect-src |
| 13: Layout 2.0 ✓ | Tab drag part B: top/bottom splits, up to a 2×3 grid, resizable dividers; the status bar stays global |

## Done from testing after Phases 12–13

- Style review can decline text there's nothing to judge in (open-decisions #27).
- "saves as <title>.*" dropped from the export menu.
- AI Provider panel footer moved into a "?" tooltip in the panel header.

## Checks still open

- **Model decline, live** (open-decisions #27): the AI half of the review opt-out has only been unit-tested. Next time a real key is at hand, review a gibberish document (30+ words) once and confirm the "skipped" chip shows the model's reason.
- **Cross-browser pass** (a QA chat with Computer Use; prompt on request): Safari and Firefox haven't been tried. Includes the storage bar in real Safari and on iPad, Firefox's persistence prompt, a workspace .zip round-trip, and the "can't save documents here" screen under Safari's Lockdown Mode (it couldn't be forced in the Chromium preview).

## Built: data safety (owner, locked 2026-09-30, after research; built 2026-10-04)

The browser's storage is the only copy of a person's writing, and browsers treat site storage as clearable. Research (30 Sep 2026, summarised below) settled the plan; build before Jot is shared.

**Research findings that shaped it**
- Safari deletes all script-written storage, IndexedDB included, after 7 days of Safari use with no click, tap or keypress in the site (ITP). A visit alone doesn't reset it; writing in Jot does.
- It's the WebKit engine, not the Safari brand: every browser on iPad (Chrome, Firefox, Edge) behaves the same, and so does Orion on Mac.
- `navigator.storage.persist()` protects against disk-pressure eviction in Chrome, Edge and Firefox, but is not documented to exempt a site from Safari's 7-day rule. Assume it doesn't.
- Installed web apps have their own separate, initially empty storage. Home Screen apps (iPad) are documented as exempt from the 7-day rule; Mac Dock apps are not documented and may not report `display-mode: standalone`.
- Safari's Lockdown Mode turns IndexedDB off entirely.
- Unverified on purpose (needs 8+ days on real devices; the plan doesn't depend on it): whether persistence exempts, whether Dock apps skip the rule, whether iPad Chrome really deletes.

**What was built**
1. **Warning bar, amber, full width above the panels.** Shown in any WebKit-engine browser (`navigator.vendor === 'Apple Computer, Inc.'`): Safari on Mac, every iPad browser, Orion. Not in Chromium browsers or Firefox. Hidden only in an installed iPad Home Screen app (`navigator.standalone` / `display-mode: standalone` on iPadOS). Never hidden because persistence was granted. Dismissible; returns after 7 days. Its button: **export workspace**.
   - Mac: "Safari deletes jot's documents after 7 days of using Safari without typing or clicking in jot. Everything jot saves lives only in this browser. For writing you want to keep, use Chrome, Firefox or Edge — and export a backup now and then."
   - iPad (WebKit with touch, `maxTouchPoints > 1`): "On iPad, every browser deletes jot's documents after 7 days of use without typing or clicking in jot. Add jot to your Home Screen to keep them there. It starts empty, so export your workspace here first and import it in the app."
2. **Workspace export and import (.zip).** A separated "whole workspace" section in the export menu, "all N documents .zip". One `.md` per document (duplicate titles numbered, a `/` in a title becomes a folder) plus `jot-workspace.json` with tags, pins and dates. Never keys, settings or review sessions. File `jot-workspace-YYYY-MM-DD.zip`; a small zip library loaded on use. Dropping the .zip restores the workspace, added alongside existing documents, never replacing.
3. **Persistent storage.** Ask on an explicit action — new document or import — not while typing (Firefox prompts). At most once per session, skipped if already granted; asking again in a later session is fine (Chrome re-evaluates).
4. **Storage-unavailable screen.** When IndexedDB can't be opened (e.g. Lockdown Mode), a plain full-screen message like the narrow-window one: jot can't save documents in this browser's current mode.
5. **Welcome document and README** (with the update banked above): each browser, profile and installed app keeps its own separate workspace; clearing site data or a "delete data on close" setting erases it; export is the backup.
6. No backup reminder for now.

## Later (owner: its own fresh chat)

- **Visitor counter.** Something as basic as Cloudflare's own analytics or Google Analytics, enough to know "5 people from the UK visited today". Touches the privacy promise (README, ADR-004) and the CSP.

## Next round: design first (owner)

**Design status (2026-10-05): all three designs accepted** — diff checker, Farsi, PDF options. The owner's Farsi style-guide session is done too (`src/review/ruleset/fa/`). **Next: build all three together.**

**Sequence (owner, 2026-10-04):** finish all the open design work for the three — diff checker, PDF options, Farsi — first, then build all three together. Not design → build one at a time. (The palette and shortcut editor are not among the three.)

These four touch each other, so they get a design round together before any build — building PDF options now would mean redoing them for Farsi.

- **PDF options** (was Phase 11). A small card behind export → PDF, remembered between exports: page size (A4 / Letter / A5) and orientation, margins (narrow / normal / wide), font (Jot sans, a serif, mono — bundled, loaded when chosen) and body size, colour presets (Jot, monochrome, classic), an optional custom-CSS box applied last, page numbers on/off. Depends on Farsi: fonts, direction and the renderer's typography.
  - **Decided (owner, 2026-10-05):** the card opens on every PDF export (export → PDF), filled with the last choices, with an export button that goes on to the print dialog; no live preview in the card (the print dialog previews). One remembered set for all documents. Fonts: Jot sans = Public Sans, serif = **Source Serif 4** (OFL), mono = Source Code Pro; Farsi always uses Vazirmatn whichever is chosen. The custom-CSS box stays, collapsed under "advanced", applied last. Next: Claude Design brief (its own chat).
  - **Design accepted (owner, 2026-10-05)** — Claude Design canvas, frames in `docs/design/pdf-options/`. The card replaces the export menu in place: a 320px popover, right edge on the export button; header "pdf options" + the document name; rows page (A4 / Letter / A5 + portrait / landscape icon buttons 24×22), margins, font (each choice set in its own face), size (9 / 10 / 11 / 12 / 13 pt, default 11), colours, page numbers; collapsed "advanced" with the custom-CSS box (Source Code Pro 11.5, accent border on focus, "applied last" note, clear); cancel + "continue to print" (the one accent); Esc / click outside cancels, Enter continues; the expanded state is remembered. Sizes scale by ratio (h1 1.52em, h2 1.22em, tables 0.9em, code 0.86em; code always Source Code Pro); line height sans 1.55, serif 1.5, mono 1.6. Margins narrow 12.7mm, normal 20mm, wide 30mm, equal on all sides. Page number: bare, Source Code Pro 8pt, preset grey, centred horizontally and in the bottom margin; off keeps the margin; first page numbered. Presets (colour, rules, block styling — never the font): **jot** = today's tokens; **monochrome** = print black #000, greys #555 / #808080 / #A4A4A4, no fills (code: 0.25mm outline; syntax as weight and italic), links black underlined; **classic** = justified and hyphenated, following paragraphs indented 1.5em with no gap, headings 400 with h2 italic, quote italic inset 2em with no rule, three-rule tables (0.4mm ink above and below, 0.2mm under the header, header italic), code unfilled and indented, links ink with a dim underline.
  - **Pushbacks / adjustments (owner):** fonts and presets stay independent (classic + sans allowed); collapsed "advanced" shows "custom css · N lines" when the box isn't empty; custom CSS containing `@page` is honoured and the page and margins rows grey out with "set by your custom css"; margins scale with paper size (A5 at ×0.7, so wide = 21mm on A5); monochrome drops code fills. **Farsi:** classic justifies left-to-right paragraphs only — right-to-left paragraphs stay start-aligned — and Farsi headings never go italic (h2 italic applies to Latin only).
- **Full Farsi support** (below).
- **Diff checker** (below).
- **Command palette and customisable shortcuts** (below).

## Far future

### Full Farsi support
- **Research done** (2026-10-05): `docs/research/farsi-2026-10.md`. Feasible on the current stack; the core work is one shared per-block direction function for editor, preview and PDF.
- **Decided (owner, 2026-10-05):**
  1. **No UI translation for now** — Farsi documents get full support; the interface stays English. Still build the language-pack structure (data-only, lazy-loaded: detection, fonts, typography, counting, review rules and prompt, reserved keys, UI strings later) so a UI translation or another language needs no rework.
  2. **Editor font:** Farsi falls back to Vazirmatn (proportional) behind Source Code Pro; no monospace Farsi font. Farsi pipe tables won't align in source.
  3. **Emphasis in Farsi:** upright and bolder (no synthetic slant); English keeps real italics; same in editor, preview, PDF.
  4. **Direction:** per block (paragraph, list item, heading) by majority script, not first letter; tables take one direction for the whole table; fenced code, inline code, URLs, math and diagrams stay LTR; plus a per-document override (auto / rtl / ltr) — where it lives is a design item.
  5. **Normalisation** (ي/ك → ی/ک, digits, half-spaces): review suggestions only, never automatic.
- **Farsi style review (owner, 2026-10-05): in this build round, both halves** — fixed rules (Virastar-style: half-spaces, ی/ک, digits, «» quotes, punctuation spacing, kashida, curated loanwords) and an AI Farsi style guide. Writing the Farsi guide gets its own session, possibly with its own research. Until it exists, a Farsi document's review shows the "skipped" chip ("style review isn't available for Farsi yet"). **Routing:** the suitability gate (`review/suitability.ts`) also decides the document's language by counting scripts, before any call: mostly English → English guide, mostly Farsi → Farsi guide, genuinely mixed → the majority language's guide on the whole document, with a high bar for "mixed" (a Farsi essay with English terms and code is Farsi).
- **Design accepted (owner, 2026-10-05)** — Claude Design canvas, frames in `docs/design/farsi/`. Vazirmatn as `--font-farsi` (variable, Arabic-script `unicode-range`, `size-adjust: 108%`), appended to both font stacks; editor line height unchanged (1.65); rendered and PDF right-to-left blocks at line height 1.8, Farsi headings 1.5. Emphasis by the script of the run: Farsi `*em*` upright 600, `**strong**` 800 (new weight; English strong stays 600, English em keeps italics). Farsi headings: same sizes and weight 600, letter-spacing 0. Direction override: a `dir` status-bar cell (before cursor) — `dir auto · rtl` shows the resolved direction of the cursor's block; click opens a menu (auto / right-to-left / left-to-right), stored per document. Review bubbles: chrome stays left-to-right, quoted before/after text mirrors, the bubble anchors to the span's start (right edge on RTL); wavy proofing underlines 5px below the baseline (clear of Farsi dots). PDF: page number centred, Persian digits for a right-to-left document; symmetric margins. Farsi document names isolated in sidebar rows. Mermaid's dark figure ground is new (`#18181B`).
- **Designer pushbacks, all accepted:** lists and blockquotes resolve direction once for the whole block (like tables); a block with no majority script (e.g. "API", numbers, a lone link) inherits the previous block's direction; word counts don't split on ZWNJ; Mermaid stays left-to-right — Farsi readers write `flowchart RL` (mention in the welcome document).
- **Adjustments (owner):** the review frame shows an outdated review screen (tier labels, old toolbar) — build on the current review UI (kind names, no "tier"), taking only the RTL rules; the `dir` cell shows only when the document contains Arabic-script text or its override isn't auto — an English document's status bar is unchanged.
- **Farsi style guide written (owner session, 2026-10-06):** `src/review/ruleset/fa/` (README Rev 1, RULES — 46 rules: 17 orthography, 12 Tier 1 style, 6 Tier 1b, 12 Tier 2; checks with exact client patterns and ~140 tested rows; banned-vocabulary with parser notes; modes; output-schema; tier1/tier2 examples). Sources: the Academy's Dastur-e Khatt-e Farsi (1401), Virastar (MIT), Medadian 2025. **Build needs** (from the session's hand-off): strip `client:start…client:end` blocks from `fa/checks.md` before sending, don't send `fa/banned-vocabulary.md`, no proofing task and no dash/semicolon steps for Farsi; Farsi text helpers (ZWNJ-joined word count, sentence split on `. ! ? ؟ …`, Farsi word-boundary constants — JS `\b` doesn't see Arabic script — and discard matches that span masked code/URLs); Pass A for FA-T1-01…25 and FA-T1b-01…08 incl. a verb-form generator from the verb-stems table; parser extensions per the Parser notes; Pass B for FA-T1-20/23/25 and the triplet cap; **tolerant anchoring** of model quotes (ignore U+200C/E/F, normalise ي/ك, with an offset map) or many Farsi model flags fall back to notes. Turn `checks.md`'s must-match / must-not-match tables into vitest tests. Provisional and to calibrate on real writing: sentence caps 25/30/40, variance floor 4, hedge cap 2; vocabulary lists untested against real LLM Farsi; the Academy's ~40 fused compounds deliberately not flagged; colloquial verb forms not caught; no spelling check beyond listed slips (the model's proofing pass is off for Farsi).
- From the research, no decision needed: Vazirmatn arabic subset via `@fontsource-variable/vazirmatn` loaded by `unicode-range`; letter-spacing 0 on RTL; no justify; Segmenter-based word counts (ZWNJ joins words); one shortcut matcher that falls back to `e.code` on non-Latin layouts; never bind Shift+Space (it types ZWNJ); check `highlightSpecialChars` doesn't mark ZWNJ; AI review for fluency only, orthography by fixed rules (Virastar, MIT). PDF (Paged.js) and Mermaid with Farsi need testing during the build.
- **Writing:** right-to-left text in the editor, per line (CodeMirror can set direction line by line, so mixed Farsi/English documents work); a proper Farsi font (e.g. Vazirmatn, open licence), bundled for offline use.
- **Rendered view and PDF:** RTL blocks with correct bidirectional handling of mixed text, lists, tables and code.
- **AI style review in Farsi:** its own rule set and examples, curated by the owner. The client-side checks (Pass A) are English-specific and need Farsi counterparts or to be skipped for Farsi text.
- Open question: does the app chrome (menus, labels) also need a Farsi translation, or only the content?

### Command palette and customisable keyboard shortcuts
- A full command palette plus user-remappable shortcuts.
- ADR-010's removal was a planning expedient, not the owner's position (see its amendment). Wanted; just not yet.

### Built-in diff checker (like diffchecker.com)
- **Decided (owner, 2026-10-04):** comparable: document vs document, document vs pasted text, and two pasted texts (blank comparison). Both sides editable — a document side edits the real document (autosaved), a pasted side is scratch; the diff updates live. No version snapshots for now. Design: heavily modelled on diffchecker.com's UX (a reference, not copied — as ADR-001 treats stackedit), redrawn in Jot's design system via Claude Design. How a comparison opens (owner, from diffchecker screenshots): a **diff tab** in the pane grid, movable like a rendered tab, in two stages in the same tab. **Input:** two panes, "original" and "changed", each filled by "open document" (pick one of yours) or pasting; then "find difference". **Result:** line-numbered diff, removed in red (destructive), added in teal (the quick-fix hue), changed characters highlighted within a line; split or unified. A slim options strip at the top of the tab (not a second left rail — the documents sidebar is there): split / unified, hide unchanged lines, ignore whitespace, word / character precision, go to first change, edit input, clear. Real-time editing always on. Dropped (need a server, or out of scope): save, share, history, explain, export, syntax choice, transform text. Entry points: right-click a document → "compare with…" (opens with it on the left), and a blank comparison from somewhere global (to design). - **Design accepted (owner, 2026-10-05)** — Claude Design canvas, frames in `docs/design/diff-checker/` (9a–9z). Below 560px pane width the result shows unified (split preference kept); the input stage stacks. Entry points: "compare with…" in the document right-click menu (opens with the picker on "changed"), a new-comparison icon in the sidebar header (beside **+** in the current header), and right-clicking empty tab-strip space (new document / new comparison). Tab label `original ↔ changed`, "new comparison" while empty, two-panel icon, 220px cap. Filter-first picker; the other side's document listed but disabled. Unchanged stretches of 3+ lines fold into a band (expand all, or 20 at a time). "find difference" disabled (dashed) until both sides have text; ⌘↵. Removed text not struck through. New tokens `--diff-del/-add`, `-line`, `-char` washes mixed onto `--document`.
- **Adjustments to the canvas (owner):** "added" is built from the review's quick-fix teal (`--flag-quick`), not tag 4; "first change" becomes ↑ / ↓ previous / next change; clear uses the undo toast; the first edit to a document side shows a toast without undo ("editing <name>: changes save to the document"; ⌘Z reverses edits); the frames' shell is outdated (old status bar, sidebar header without **+**) — build against the current app.
- Compare two documents, or a document against pasted text: side by side and unified, with word-level highlighting.
- CodeMirror has an official merge/diff view (`@codemirror/merge`), which makes this far more tractable than building from scratch.
- Open UX questions: how a comparison opens (from the sidebar? a pane mode?), whether one side is editable, and whether Jot keeps document snapshots to diff against.

### One-click PDF (Typst)
- A direct `.pdf` download, no print dialog, identical in every browser: markdown converted to Typst and typeset by Typst compiled to WebAssembly, in the browser. Native math, themeable. Costs a few MB loaded on first export and a markdown→Typst converter to maintain. Revisit after Phase 10's options on the print pipeline.
