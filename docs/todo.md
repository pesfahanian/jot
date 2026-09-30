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

## Next round: first up

- **Bring README and the welcome document up to date with Phases 12–13 and the testing fixes.** The README names the four providers but nothing else; the welcome document (`src/lib/welcome.ts`) still names two providers and says nothing of the model picker, top/bottom splits and the grid, resizable seams, or the review declining short or non-prose text. Update the welcome text for new installs only: existing copies are the person's own document.

## Next round: data safety (owner, decided 2026-09-30)

The browser's storage is the only copy of a person's writing, and browsers treat site storage as clearable. Before Jot is shared:

- **Persistent storage.** Ask the browser to keep Jot's storage (`navigator.storage.persist()`), so it isn't cleared when the disk runs low.
- **Workspace export.** A new entry in the export menu that saves the entire workspace (every document) as one `.zip`, clearly labelled as the whole workspace, not the current document.
- **Safari warning.** A large coloured bar at the top when Jot is opened in Safari: Safari deletes a site's stored data after 7 days of browsing without a visit, so Jot can't keep documents there reliably.
- Details under discussion: bar wording, dismissal and which browsers it covers; what the .zip holds and whether it imports back; when persistence is asked for (Firefox prompts).

## Next round: design first (owner)

These four touch each other, so they get a design round together before any build — building PDF options now would mean redoing them for Farsi.

- **PDF options** (was Phase 11). A small card behind export → PDF, remembered between exports: page size (A4 / Letter / A5) and orientation, margins (narrow / normal / wide), font (Jot sans, a serif, mono — bundled, loaded when chosen) and body size, colour presets (Jot, monochrome, classic), an optional custom-CSS box applied last, page numbers on/off. Depends on Farsi: fonts, direction and the renderer's typography.
- **Full Farsi support** (below).
- **Diff checker** (below).
- **Command palette and customisable shortcuts** (below).

## Far future

### Full Farsi support
- **Writing:** right-to-left text in the editor, per line (CodeMirror can set direction line by line, so mixed Farsi/English documents work); a proper Farsi font (e.g. Vazirmatn, open licence), bundled for offline use.
- **Rendered view and PDF:** RTL blocks with correct bidirectional handling of mixed text, lists, tables and code.
- **AI style review in Farsi:** its own rule set and examples, curated by the owner. The client-side checks (Pass A) are English-specific and need Farsi counterparts or to be skipped for Farsi text.
- Open question: does the app chrome (menus, labels) also need a Farsi translation, or only the content?

### Command palette and customisable keyboard shortcuts
- A full command palette plus user-remappable shortcuts.
- ADR-010's removal was a planning expedient, not the owner's position (see its amendment). Wanted; just not yet.

### Built-in diff checker (like diffchecker.com)
- Compare two documents, or a document against pasted text: side by side and unified, with word-level highlighting.
- CodeMirror has an official merge/diff view (`@codemirror/merge`), which makes this far more tractable than building from scratch.
- Open UX questions: how a comparison opens (from the sidebar? a pane mode?), whether one side is editable, and whether Jot keeps document snapshots to diff against.

### One-click PDF (Typst)
- A direct `.pdf` download, no print dialog, identical in every browser: markdown converted to Typst and typeset by Typst compiled to WebAssembly, in the browser. Native math, themeable. Costs a few MB loaded on first export and a markdown→Typst converter to maintain. Revisit after Phase 10's options on the print pipeline.
