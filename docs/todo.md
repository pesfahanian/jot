# Jot — roadmap and to-do

Decisions still open live in `open-decisions.md`.

## Roadmap (agreed with the owner)

Done: Phases 0–9 (v1.0.0 plus polish, editor power, render & export).

| Phase | Contents |
|---|---|
| 10: PDF options | A small card behind export → PDF, remembered between exports: page size (A4 / Letter / A5) and orientation, margins (narrow / normal / wide), font (Jot sans, a serif, mono — bundled, loaded when chosen) and body size, colour presets (Jot, monochrome, classic), an optional custom-CSS box applied last, page numbers on/off |
| 11: AI providers | OpenAI and Anthropic alongside OpenRouter and Google; provider dropdown; model picker suggesting from the provider's model list; per-provider fallback chain. Each new API host must be added to `public/_headers` connect-src |
| 12: Layout 2.0 | Tab drag part B: top/bottom splits, up to a 2×3 grid, resizable dividers; the status bar stays global |

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
