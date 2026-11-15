# CLAUDE.md

Jot — a personal, minimal markdown/writing editor. Single user, zero backend, built to replace stackedit.io.

## Read first, in this order

1. `jot-prd-trd.md` — what Jot is, the tech stack, the data model, and a feature-set summary with pointers to full specs.
2. `jot-adrs.md` — why each architectural decision was made and what alternative was rejected. Consult before second-guessing any stack or storage choice.
3. `jot-tickets.md` — the phased build plan. Work through phases in order; each ticket carries its own acceptance criteria — verify against them directly before marking a ticket done, not just when the phase ends.

One more document exists for deep detail, referenced from the tickets as needed: the final design system (`docs/design/Jot Design System v3.dc.html`). Open design decisions are banked in `docs/open-decisions.md` for the end of the build.

## Standing rules — apply everywhere, not just where a ticket happens to mention them

- No formatting toolbar, anywhere, ever. Not a v1 cut.
- Command palette and customisable shortcuts: **started by the owner on 2026-10-14** — designed in the 14b round, built in Phase 15 (`docs/todo.md`). Build them only as designed there, not as a side effect of other work. (ADR-010 + amendment)
- No AI in Jot. The AI suite (AI mode, its chat, the style review, document translation) was removed on 2026-11-15 because nobody used it; its code is parked on the `parked/ai` branch. Don't bring any of it back unless the owner asks.
- No "unsaved" state anywhere in the UI. Every edit persists continuously; there is no dirty/clean distinction to represent. (ADR-008)
- Tags are six fixed colors, metadata-only, one per document. No folders, no free text, no parsing document content for tags. (ADR-007)
- No backend, anywhere. The only network call Jot makes is translating a selection, straight from the browser to Google Cloud Translation with the user's own key. (ADR-004 + amendments)
- IndexedDB only. Don't reach for the File System Access API — it's Chromium-only and was explicitly rejected for that reason. (ADR-003)
- Light and dark share identical shapes, spacing, and radii. Only color differs between them. (ADR-006)
- CodeMirror 6, not Monaco. `@replit/codemirror-vscode-keymap` supplies VSCode keybinding parity. (ADR-002)
- Vite + React + shadcn. Not Next.js — nothing here needs SSR or file-based routing. (ADR-005)
- stackedit.io is a UX reference only. Never copy from its source. (ADR-001)
- Desktop only. No responsive layout or breakpoints; below 1000px the app renders only a "widen your window" message. (ADR-011)

## Testing philosophy

Broad UI test coverage is not a goal — this is a single-user personal tool. Unit tests cover the pure logic: the pane layout moves, the tag OR-filter and sort, annotations, backup, shortcuts, rendering helpers.

## Project structure

Scaffolded in T0.1. Package manager is pnpm (pinned via `packageManager` in `package.json`); `pnpm dev` / `pnpm build` / `pnpm lint` (oxlint) / `pnpm test` (vitest).

- `docs/` — PRD/TRD, ADRs, tickets.
- `src/main.tsx`, `src/App.tsx` — entry and root component.
- `src/index.css` — Tailwind v4 entry + shadcn theme variables (`:root` / `.dark`). Design tokens land here (T0.2).
- `src/components/ui/` — shadcn components (Radix base, added via `pnpm dlx shadcn@latest add <name>`).
- `src/lib/` — shared utilities (`utils.ts` re-exports `cn`).
- `src/editor/` — CodeMirror 6 editor: `Editor.tsx` (one view per document, wired to autosave), `keymap.ts` (vscode keymap as the sole keymap), `theme.ts` (§1.7 highlighting, all colors via CSS variables), `codeLanguages.ts` (markdown with fenced code parsed in its own language), `minimap.ts` (the minimap, setting-driven).
- `src/components/shell/` — floating-panel shell: `Shell.tsx` (tray, sidebar handle, file drop, first run), `PaneGrid.tsx` (panes placed absolutely from one keyed list so a moved pane keeps its editor; resizable seams between columns and stacked panes), `Sidebar.tsx` (header: new document, search, sort-and-filter, hide; foot: settings, ?), `Draft.tsx` (a new document before it exists — `workspace.draft`: its name field, in the sidebar or its tab, and an empty page; ↩ or a click into the page creates it via `actions.commitDraft`, anything else drops it), `SidebarToggle.tsx` (in the sidebar header, or the first pane's tab strip while hidden), `CommandPalette.tsx` (⌘K: commands and documents in one list), `Wordmark.tsx` (the dotted-j logo: outlined on hi-DPI, pixel-hinted on 1×), `EditorPane.tsx` (tab strip + overflow, pane controls, export menu), `RenderView.tsx` (the rendered view — body of a rendered tab: live render + line-anchored scroll sync), `DocumentMenu.tsx` (right-click menu: color, rename, pin, delete), `StatusBar.tsx` (counts, notes, minimap toggle at the right), `StorageWarning.tsx` (the amber Safari / iPad storage warning, from `lib/storageRisk.ts`; dev preview: `?storage-warning=mac|ipad`), `Toast.tsx`, `Keycap.tsx` (the one elevation exception, ground fixed to panel; the guide card's keys).
- `src/components/annotations/` — highlights, underlines and notes (Phase 16): `SelectionMenu.tsx` (the right-click menu on a selection), `NotePopover.tsx` (read and edit a note), `NotesCell.tsx` ("notes N" in the status bar), `TranslatePopover.tsx` (Google Translate, no AI). Data: `lib/annotations.ts` (pure moves: follow an edit, re-anchor, paint, erase), `state/annotations.ts` (per-document lists, followed through `editor/sessions.ts`, saved to the `annotations` table), `editor/annotations.ts` (editor marks, the notes gutter, the active editor), `state/annotate.ts` (menu and key actions), `lib/annotatedSource.ts` (markers through the renderer for the rendered view and PDF, markdown export with annotations).
- `src/components/settings/` — the settings modal (round 4): `SettingsModal.tsx` (editor, appearance, keyboard shortcuts, translation, storage and backup, about), `TranslationSection.tsx` (the Google Cloud Translation key), `ShortcutsSection.tsx` (record keys, clashes inline), `controls.tsx`.
- `src/state/` — `commands.ts` (every app action as a command: the palette's list, the shortcut editor's rows and the app key handler in Shell; the person's own keys in settings), `ui.ts` (settings modal, palette, PDF-card requests), `workspace.ts` (zustand: panes/tabs/focus/sidebar/toast; layout persisted to the `workspace` table), `layout.ts` (the pane grid — up to 3 columns × 2 stacked, kept as one flat list with `below` flags — and tab drag, as pure, unit-tested moves: reorder, move between panes, split on any pane edge, remove a pane with the one below taking its place), `actions.ts` (new/rename/color/pin/delete-with-undo/import), `theme.ts` (light/dark/system preference), `hooks.ts` (live document list).
- `src/editor/sessions.ts` — one shared session per open document, so the same document in two panes stays in step and has one autosave.
- `src/lib/docList.ts` — pure sort / OR color filter / search logic (T6.2 unit-test target); `src/lib/render.ts` — the one markdown → HTML renderer (rendered view and PDF), with `math.ts` (KaTeX: `$…$`, `$$…$$`) and `diagrams.ts` (Mermaid fences, framed per 2h), each loaded only when a document uses it; `src/lib/code.ts` — code-block languages and colour groups shared by editor and renderer; `src/lib/format.ts` — Prettier markdown formatting in the house style (Cmd+Shift+I / Shift+Option+F); `src/lib/export.ts` — md / plain-text / PDF export (PDF paginated by Paged.js inside the print frame: A4, 20mm margins, point-sized type, backgrounds always printed, page numbers; long tables continue between rows with the header repeated; headings kept with the next block). `docs/benchmarks/pdf-benchmark.md` and its Farsi twin `farsi-benchmark.md` are the upper-bound test documents — re-export both after any change to rendering, direction or PDF; `src/lib/backup.ts` — the whole workspace as one .zip (one .md per document + `jot-workspace.json` for tags, pins, dates; never keys or settings), and reading it back — dropped .zip files import alongside, never replacing; `src/lib/storage.ts` — asks for persistent storage on new document / import; `src/lib/counts.ts` — status-bar counts; `src/lib/shortcuts.ts` — keys as data (one canonical form, ⌘ / Ctrl display, browser-owned keys, the editor's own bindings); `src/lib/motion.ts` — animations on/off (setting + reduced motion → `data-motion="off"`; the motion tokens are in `index.css`); `src/lib/palette.ts` — palette matching; `src/lib/spelling.ts` + `editor/autofix.ts` — auto-fix spelling (nspell, the merged en_US/en_GB dictionary in `public/dict/` built by `scripts/build-dictionary.mjs`; off by default); `src/lib/translate.ts` — Google Cloud Translation v2 (key in a header); `src/lib/welcome.ts` — the guide as a document: "welcome to jot" is created on a true first run (no `welcomedAt` flag and no documents) and reopened or recreated from the guide card (sidebar foot "?").
- `src/dev/` — dev-only design specimens, e.g. `/?specimen=keycap`; excluded from production builds.
- `docs/design/logo/` — the logo's Claude Design export (rounds 1–2, source SVG/PNG with content credentials); the shipped, stripped copies are in `public/`.
- `docs/design/round-4/` — the round 4 canvas (shell, settings, palette, annotations, AI mode (removed), motion); decisions in `docs/todo.md`.
- `docs/design/` — design canvases from the Claude Design project (open via the dev server, e.g. `/docs/design/Jot%20Missing%20Flows.dc.html`).
- `scripts/keymap-collisions.mjs` — `pnpm check:keymap`; run after any keymap change (T2.2).
- `@/` is aliased to `src/` (see `vite.config.ts`, `tsconfig*.json`).
- `.claude/launch.json` — dev-server config for the preview browser.
- `public/_headers` — production response headers (strict Content-Security-Policy: own code only, network only to Google's Translation API, for translating a selection); Cloudflare Pages applies it, and `vite.config.ts` feeds it to `pnpm preview`. Any new network host must be added to `connect-src`, or its calls will be blocked.
- `README.md`, `LICENSE` (MIT), `.node-version` (22, read by Cloudflare Pages).
