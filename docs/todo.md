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

## Next round: from the decisions review (2026-10-04)

- **Check the model's decline live** (open-decisions #27): the AI half of the review opt-out has only been unit-tested. Next time a real key is at hand, review a gibberish document once and confirm the "skipped" chip shows the model's reason.

## Next round: data safety (owner, locked 2026-09-30, after research)

The browser's storage is the only copy of a person's writing, and browsers treat site storage as clearable. Research (30 Sep 2026, summarised below) settled the plan; build before Jot is shared.

**Research findings that shaped it**
- Safari deletes all script-written storage, IndexedDB included, after 7 days of Safari use with no click, tap or keypress in the site (ITP). A visit alone doesn't reset it; writing in Jot does.
- It's the WebKit engine, not the Safari brand: every browser on iPad (Chrome, Firefox, Edge) behaves the same, and so does Orion on Mac.
- `navigator.storage.persist()` protects against disk-pressure eviction in Chrome, Edge and Firefox, but is not documented to exempt a site from Safari's 7-day rule. Assume it doesn't.
- Installed web apps have their own separate, initially empty storage. Home Screen apps (iPad) are documented as exempt from the 7-day rule; Mac Dock apps are not documented and may not report `display-mode: standalone`.
- Safari's Lockdown Mode turns IndexedDB off entirely.
- Unverified on purpose (needs 8+ days on real devices; the plan doesn't depend on it): whether persistence exempts, whether Dock apps skip the rule, whether iPad Chrome really deletes.

**What to build**
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
