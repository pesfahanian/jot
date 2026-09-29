# CLAUDE.md

Jot — a personal, minimal markdown/writing editor. Single user, zero backend, built to replace stackedit.io.

## Read first, in this order

1. `jot-prd-trd.md` — what Jot is, the tech stack, the data model, and a feature-set summary with pointers to full specs.
2. `jot-adrs.md` — why each architectural decision was made and what alternative was rejected. Consult before second-guessing any stack or storage choice.
3. `jot-tickets.md` — the phased build plan. Work through phases in order; each ticket carries its own acceptance criteria — verify against them directly before marking a ticket done, not just when the phase ends.

Two more documents exist for deep detail on specific features, referenced from the tickets as needed: the AI Style Review interaction spec (`docs/jot-ai-style-review-interaction-spec.md`), and the final design system (`docs/design/Jot Design System v3.dc.html`). Open design decisions are banked in `docs/open-decisions.md` for the end of the build.

## Standing rules — apply everywhere, not just where a ticket happens to mention them

- No formatting toolbar, anywhere, ever. Not a v1 cut.
- No command palette, no quick-switch (Cmd+P) until the owner starts that work — it's a far-future to-do (palette + customisable shortcuts), not a permanent ban. Don't add either as a side effect of other work. (ADR-010 + amendment)
- Nothing in the AI Style Review feature auto-applies. Every flag needs an explicit terminal decision before the document changes. (ADR-009)
- No "unsaved" state anywhere in the UI. Every edit persists continuously; there is no dirty/clean distinction to represent. (ADR-008)
- Tags are six fixed colors, metadata-only, one per document. No folders, no free text, no parsing document content for tags. (ADR-007)
- No backend, anywhere. AI calls go straight from the browser to the selected provider — OpenRouter or Google AI Studio — using the user's own key. (ADR-004 + amendment)
- IndexedDB only. Don't reach for the File System Access API — it's Chromium-only and was explicitly rejected for that reason. (ADR-003)
- Light and dark share identical shapes, spacing, and radii. Only color differs between them. (ADR-006)
- CodeMirror 6, not Monaco. `@replit/codemirror-vscode-keymap` supplies VSCode keybinding parity. (ADR-002)
- Vite + React + shadcn. Not Next.js — nothing here needs SSR or file-based routing. (ADR-005)
- stackedit.io is a UX reference only. Never copy from its source. (ADR-001)
- Desktop only. No responsive layout or breakpoints; below 1000px the app renders only a "widen your window" message. (ADR-011)

## Testing philosophy

Broad UI test coverage is not a goal — this is a single-user personal tool. The one place real unit tests are required is the AI Style Review state machine (decision transitions, the decided/pending counter, the tag OR-filter logic). This exact logic produced two real bugs during design, and tests here would have caught both automatically. See T6.2.

## Project structure

Scaffolded in T0.1. Package manager is pnpm (pinned via `packageManager` in `package.json`); `pnpm dev` / `pnpm build` / `pnpm lint` (oxlint) / `pnpm test` (vitest — the review state machine, Pass B arithmetic and the tag OR-filter, per T6.2).

- `docs/` — PRD/TRD, ADRs, tickets.
- `src/main.tsx`, `src/App.tsx` — entry and root component.
- `src/index.css` — Tailwind v4 entry + shadcn theme variables (`:root` / `.dark`). Design tokens land here (T0.2).
- `src/components/ui/` — shadcn components (Radix base, added via `pnpm dlx shadcn@latest add <name>`).
- `src/lib/` — shared utilities (`utils.ts` re-exports `cn`).
- `src/editor/` — CodeMirror 6 editor: `Editor.tsx` (one view per document, wired to autosave), `keymap.ts` (vscode keymap as the sole keymap), `theme.ts` (§1.7 highlighting, all colors via CSS variables), `codeLanguages.ts` (markdown with fenced code parsed in its own language), `minimap.ts` (the minimap, setting-driven).
- `src/components/shell/` — floating-panel shell: `Shell.tsx` (tray, sidebar handle, panes, file drop, first run), `Sidebar.tsx`, `Wordmark.tsx` (the dotted-j logo: outlined on hi-DPI, pixel-hinted on 1×), `EditorPane.tsx` (tab strip + overflow, pane controls, export menu), `RenderView.tsx` (the rendered view — body of a rendered tab: live render + line-anchored scroll sync), `DocumentMenu.tsx` (right-click menu: color, rename, pin, delete), `StatusBar.tsx`, `Toast.tsx`.
- `src/state/` — `workspace.ts` (zustand: panes/tabs/focus/sidebar/toast; layout persisted to the `workspace` table), `layout.ts` (tab drag as pure, unit-tested moves: reorder, move between panes, split on a pane edge), `actions.ts` (new/rename/color/pin/delete-with-undo/import), `theme.ts` (light/dark/system preference), `hooks.ts` (live document list).
- `src/editor/sessions.ts` — one shared session per open document, so the same document in two panes stays in step and has one autosave.
- `src/lib/docList.ts` — pure sort / OR color filter / search logic (T6.2 unit-test target); `src/lib/render.ts` — the one markdown → HTML renderer (rendered pane and PDF); `src/lib/code.ts` — code-block languages and colour groups shared by editor and renderer; `src/lib/format.ts` — Prettier markdown formatting in the house style (Cmd+Shift+I / Shift+Option+F); `src/lib/export.ts` — md / plain-text / PDF export; `src/lib/counts.ts` — status-bar counts; `src/lib/favicon.ts` — favicon status states (review running / done / failed while away).
- `src/review/` — Style Review flag production: `ruleset.ts` (bundled rule files, parsed tables), `passA.ts` (client rules), `sharedCall.ts` (the one provider call) + `providers/` (OpenRouter, Google AI Studio; `request.ts` holds the shared error type), `passB.ts` (mode arithmetic), `assemble.ts` (→ ReviewFlag), `model.ts` (decision state machine, preview/apply — T6.2 unit-test target), `kinds.ts` (the reader-facing flag kinds — Quick fix / Check fix / Your call / Spelling / Grammar / Punctuation / Note — their names, help text, colors and plain rule names; the UI never says "tier"), `pipeline.ts`.
- `src/components/review/` — review UI: `ReviewView.tsx` (toolbar, locked original, preview, log), `Bubble.tsx`, `spans.tsx`, `KeyPanel.tsx`, `Keycap.tsx` (the one elevation exception, ground fixed to panel). `src/state/review.ts` — runs, sessions (persisted, resumable), lock, key panel.
- `src/dev/` — dev-only design specimens, e.g. `/?specimen=keycap`; excluded from production builds.
- `docs/design/logo/` — the logo's Claude Design export (rounds 1–2, source SVG/PNG with content credentials); the shipped, stripped copies are in `public/`.
- `docs/design/` — design canvases from the Claude Design project (open via the dev server, e.g. `/docs/design/Jot%20Missing%20Flows.dc.html`).
- `scripts/keymap-collisions.mjs` — `pnpm check:keymap`; run after any keymap change (T2.2).
- `src/review/ruleset/` — the Style Review rule set (bundled at build time, T5.8). `checks.md` and `output-schema.md` are authoritative for Phase 5 flag production.
- `@/` is aliased to `src/` (see `vite.config.ts`, `tsconfig*.json`).
- `.claude/launch.json` — dev-server config for the preview browser.
