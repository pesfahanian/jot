# CLAUDE.md

Jot — a personal, minimal markdown/writing editor. Single user, zero backend, built to replace stackedit.io.

## Read first, in this order

1. `jot-prd-trd.md` — what Jot is, the tech stack, the data model, and a feature-set summary with pointers to full specs.
2. `jot-adrs.md` — why each architectural decision was made and what alternative was rejected. Consult before second-guessing any stack or storage choice.
3. `jot-tickets.md` — the phased build plan. Work through phases in order; each ticket carries its own acceptance criteria — verify against them directly before marking a ticket done, not just when the phase ends.

Two more documents exist for deep detail on specific features, referenced from the tickets as needed: the AI Style Review interaction spec, and the final design system (tokens, both themes, floating-panel shell).

## Standing rules — apply everywhere, not just where a ticket happens to mention them

- No formatting toolbar, anywhere, ever. Not a v1 cut.
- No command palette, no quick-switch (Cmd+P) — deliberately removed. Don't reintroduce either as a "natural" addition to a keyboard-driven editor. (ADR-010)
- Nothing in the AI Style Review feature auto-applies. Every flag needs an explicit terminal decision before the document changes. (ADR-009)
- No "unsaved" state anywhere in the UI. Every edit persists continuously; there is no dirty/clean distinction to represent. (ADR-008)
- Tags are six fixed colors, metadata-only, one per document. No folders, no free text, no parsing document content for tags. (ADR-007)
- No backend, anywhere. AI calls go straight from the browser to OpenRouter using the user's own key. (ADR-004)
- IndexedDB only. Don't reach for the File System Access API — it's Chromium-only and was explicitly rejected for that reason. (ADR-003)
- Light and dark share identical shapes, spacing, and radii. Only color differs between them. (ADR-006)
- CodeMirror 6, not Monaco. `@replit/codemirror-vscode-keymap` supplies VSCode keybinding parity. (ADR-002)
- Vite + React + shadcn. Not Next.js — nothing here needs SSR or file-based routing. (ADR-005)
- stackedit.io is a UX reference only. Never copy from its source. (ADR-001)

## Testing philosophy

Broad UI test coverage is not a goal — this is a single-user personal tool. The one place real unit tests are required is the AI Style Review state machine (decision transitions, the decided/pending counter, the tag OR-filter logic). This exact logic produced two real bugs during design, and tests here would have caught both automatically. See T6.2.

## Project structure

Scaffolded in T0.1. Package manager is pnpm (pinned via `packageManager` in `package.json`); `pnpm dev` / `pnpm build` / `pnpm lint` (oxlint).

- `docs/` — PRD/TRD, ADRs, tickets.
- `src/main.tsx`, `src/App.tsx` — entry and root component.
- `src/index.css` — Tailwind v4 entry + shadcn theme variables (`:root` / `.dark`). Design tokens land here (T0.2).
- `src/components/ui/` — shadcn components (Radix base, added via `pnpm dlx shadcn@latest add <name>`).
- `src/lib/` — shared utilities (`utils.ts` re-exports `cn`).
- `@/` is aliased to `src/` (see `vite.config.ts`, `tsconfig*.json`).
- `.claude/launch.json` — dev-server config for the preview browser.
