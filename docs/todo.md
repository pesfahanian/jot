# Jot — to-do (far future)

Items the owner wants eventually but not in the current roadmap. Nearer work lives in the roadmap agreed in conversation; decisions still open live in `open-decisions.md`.

## Full Farsi support
- **Writing:** right-to-left text in the editor, per line (CodeMirror can set direction line by line, so mixed Farsi/English documents work); a proper Farsi font (e.g. Vazirmatn, open licence), bundled for offline use.
- **Rendered view and PDF:** RTL blocks with correct bidirectional handling of mixed text, lists, tables and code.
- **AI style review in Farsi:** its own rule set and examples, curated by the owner. The client-side checks (Pass A) are English-specific and need Farsi counterparts or to be skipped for Farsi text.
- Open question: does the app chrome (menus, labels) also need a Farsi translation, or only the content?

## Command palette and customisable keyboard shortcuts
- A full command palette plus user-remappable shortcuts.
- ADR-010's removal was a planning expedient, not the owner's position (see its amendment). Wanted; just not yet.

## Built-in diff checker (like diffchecker.com)
- Compare two documents, or a document against pasted text: side by side and unified, with word-level highlighting.
- CodeMirror has an official merge/diff view (`@codemirror/merge`), which makes this far more tractable than building from scratch.
- Open UX questions: how a comparison opens (from the sidebar? a pane mode?), whether one side is editable, and whether Jot keeps document snapshots to diff against.

## Deployment (T0.3)
- Deferred by the owner until everything else has been tested.
