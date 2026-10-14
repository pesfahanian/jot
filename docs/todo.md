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

## Checks

All run by the owner (2026-10-08): the live model decline, a live Farsi review, Farsi PDFs in Firefox and Safari, and the cross-browser pass. One finding came out of them: the review view lays Farsi out left-to-right (next round, A). Calibrating the Farsi thresholds waits on that fix.

## Later (owner: its own fresh chat)

- **Telemetry** (was "visitor counter"; widened by the owner 2026-10-11). Any tracking that shows how the app is doing — from Cloudflare's own analytics up to usage events. Touches the privacy promise (README, ADR-004) and the CSP; how much to measure is the chat's main question.

## Next round: ideas from use (owner and friends, collected 2026-10-11)

Friends are using Jot heavily; feedback so far all positive. Grouped and discussed with the owner; implementation detail, design / research needs and a phased plan still to come. The AI suite and translation wait on the owner's thinking.

**A. Bugs**
- **PDF saves as `jot.pdf`.** Chrome names the PDF after the top page's title, not the print frame's. Swap `document.title` to the document's name while printing, restore after.
- **Farsi in the review view** (owner's screenshot, 2026-10-11): the locked original and the preview lay every line out left-to-right — `#` / `**` on the wrong end, full stops at line starts, struck / inserted fix text scrambled. Wire them to `lib/direction.ts` like the editor, rendered view and PDF; bubbles anchor to a right-to-left span's start (Farsi design). Then look at what the flags are (127 on one document, 85 quick fixes) before calling the Farsi thresholds calibrated.
- **Cloudflare's "not a robot" page.** A Cloudflare dashboard setting (Bot Fight Mode / security level / a challenge rule), not code; a static site doesn't need it. Owner changes it, guided.

**B. Small, no design**
- **Close the sidebar:** a collapse button and Cmd+B (VS Code's toggle), state remembered. Today it only resizes.
- **Double-click empty space → new document**, in the tab strip and below the sidebar rows (observed habit).
- **Bulk import:** an "import…" entry with a multi-file picker (.md / .txt / .zip) and a folder picker (`webkitdirectory` — every browser; not the File System Access API). Imports alongside, as drop does.
- **Diff overview ruler** (VS Code's name): a strip beside each side's scrollbar with a tick per change in the diff colours; click to jump.
- **Auto-title, like Apple Notes:** the title follows the first line (markdown marks stripped) until the person renames it. **New documents only** (owner) — existing ones keep their titles.

**C. Needs design** (one round together, after the AI suite is shaped — it decides where things go)
- **Settings modal:** AI provider moves here; theme, animations, auto-fix, autocomplete, editor (minimap…), storage and backup, about; room for the future shortcut editor.
- **Animations:** restrained (diff checker opening, review entering, panes and tabs); a short motion spec; off via Settings, and always off under `prefers-reduced-motion`.
- **UI reshuffle:** where the diff checker, style review and other controls live — one AI entry point.

**D. Writing assistance**
- **Auto-fix spelling behind the cursor** (owner: as recommended). A bundled dictionary (Hunspell via e.g. nspell, ~1 MB English) since pages can't read the browser's spellchecker. Off by default; only unambiguous typos (one clear suggestion); acts once the cursor is a couple of words past; skips code, URLs and capitalised names; each fix flashes briefly and is its own undo step. English first. The first feature that changes text without a decision — opt-in, so ADR-009's review rule isn't touched.
- **Autocomplete:** CodeMirror sets `writingsuggestions="false"` on the editor; turning it back on may give Safari's inline predictions for free — test in Safari (CodeMirror may have disabled it for a reason). Nothing equivalent in Chrome; AI ghost text with the person's key belongs to the AI suite.

**E. Annotations and the AI suite** (owner thinking; to discuss)
- **Right-click on selected text:** highlight, underline, translate, add a note. Owner: fine to replace the browser's menu there (loses its spelling suggestions, Look Up and services on selected text).
- **Annotations** (highlights and comments) stored beside the document, not in the markdown, re-anchored as the text changes (the review's mechanism). **Exports (owner, 2026-10-14):** the workspace .zip always keeps them (in `jot-workspace.json`); the PDF options card gets "annotations: off / highlights / highlights + comments" (highlights marked through the renderer — split per block, whole-block inside code / math / diagrams; comments as Paged.js page footnotes, no margin balloons); markdown export offers clean (default) or with annotations (`==highlight==`, comments as `[^n]` footnotes); plain text stays text only. The rendered view shows highlights through the same path.
- **The AI suite:** comments and highlights as instructions ("address my comments"), free instructions on a selection or the document, proposals decided like review flags (nothing auto-applies), full translation (e.g. a linked document side by side). Open: comments for self vs for the AI, chat or not, translation output, languages.

**Dropped:** SVG in markdown (owner, 2026-10-14).

## Built: diff checker, Farsi, PDF options (owner's design round, built 2026-10-07)

**Built 2026-10-07, shipped in PR #4** (merged and deployed; the owner ran the open checks): the new-tab +, Farsi in the editor / rendered view / PDF with the dir cell, PDF options, the diff checker, the Farsi style review, and the README / welcome updates. Designs, decisions and hand-offs for each stay below for reference.

**Also in this build round (owner, 2026-10-06):** a **+** at the end of each pane's tab strip, as in a browser's tab bar, doing exactly what "new document" does, in that pane. (Seen in testing: a friend reached for it out of browser habit.)

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
- **Leaning parked (discussed 2026-10-08):** the print dialog's preview is worth keeping (owner), and Typst would mean a second layout engine beside the shared renderer, losing the custom-CSS box. Cheaper alternatives if cross-browser printing disappoints: a one-time hint about the browser's headers / footers, and PDF bookmarks from headings if Paged.js can produce them.
