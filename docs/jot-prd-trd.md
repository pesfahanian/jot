# Jot — Product & Technical Requirements

Consolidates the interaction spec, the feature-research decisions, the final design system, and the ten ADRs into one document. This is the entry point for understanding what Jot is; it points to the companion documents for full detail rather than repeating them.

## 1. Product overview

Jot is a personal, minimal markdown/writing editor — built by and for one person, a backend engineer, to replace stackedit.io as a daily-driver browser tab. Not a product for anyone else, not indexed, not shared. It needs to feel fast to open and quiet to live inside for hours.

## 2. Goals

- Real editor power: VSCode-style keybindings, native spellcheck, fast and light (see ADR-002, ADR-005).
- A genuinely restrained shell: no formatting toolbar, no command palette, no quick-switch — these are standing constraints, not v1 cuts (ADR-010).
- A flagship AI feature (Style Review) that never changes the person's own words without an explicit decision on each change (ADR-009).
- Two real, switchable themes, light and dark, sharing identical shapes and differing only in color (ADR-006, and the design system's floating-panel shell).
- Zero backend, fully functional offline once loaded.

## 3. Non-goals

Explicit, not merely unaddressed — recorded so none of these get quietly reintroduced during implementation:

- No multi-user, no real-time collaboration, no cross-device sync (ADR-003, ADR-004).
- No encryption or "secure note" affordance, despite informal use for things like passwords.
- No PWA install banner or custom offline indicator — the browser's native prompt covers installability.
- No nested folders — tags cover the organizational need instead (ADR-007).
- No custom VSCode theme import (ADR-006).
- No multi-provider AI key management for v1 — OpenRouter only.

## 4. Tech stack

Full reasoning lives in the ADRs; this is the summary.

| Layer | Choice | ADR |
|---|---|---|
| Framework | Vite + React | ADR-005 |
| Components | shadcn/ui | ADR-005 |
| Editor | CodeMirror 6 + `@replit/codemirror-vscode-keymap` | ADR-002 |
| Storage | IndexedDB | ADR-003 |
| AI integration | Client-side OpenRouter, user's own key | ADR-004 |
| Backend | None | ADR-003, ADR-004 |

## 5. Data model

Not previously written down as a unified model — synthesized here from the interaction spec, the design docs, and the ADRs. This is the shape a coding agent should build storage and state around.

**Document**
- `id`
- `title`
- `content` (raw markdown)
- `color` — one of 6 fixed slots, or none (ADR-007); assignment replaces, never additive
- `pinned` (boolean)
- `createdAt`, `updatedAt` — drives relative-timestamp display and date sort

**Settings** (single record)
- `openRouterApiKey`
- `keyStatus` — untested / valid / invalid / offline, plus `lastValidatedAt` (the key panel shows "tested 2 min ago," which means this persists, not just a session check)
- `theme` — light / dark / system

**ReviewSession** (per document, created when a style review is run)
- `rulesetVersion`
- `flags`: a list of **ReviewFlag**
  - `id` (rule ID, e.g. `VOC-014`)
  - `family` — tier1 / tier1b / tier2 / spelling / grammar / punctuation
  - `kind` — replace / delete / insert / flag
  - `spanStart`, `spanEnd` — anchors into the document text
  - `before`, `after`
  - `rationale`
  - `status` — pending / accepted / rejected / ignored / dismissed / edited
  - `userText` — set only when `status` is `edited`

Decided vs. proposed counts, and whether "Apply" is enabled, are derived from `flags[].status` — never stored redundantly (ADR-009).

## 6. Feature set

Summary only — each item's full behavior is specified elsewhere.

| Area | Spec location |
|---|---|
| Shell: sidebar, tabs, panes, search, tags, delete/undo, export, empty states | Design system doc + missing-flows spec |
| AI Style Review: tiers, proofing, bubbles, review log, apply flow | Interaction spec |
| Theming: light/dark/system, floating-panel shell, all tokens | Design system doc, final round |
| Settings: API key panel | API-key screen spec |

## 7. Product decisions resolved here

Two items were explicitly left open in earlier documents, deferred to "the product spec." Resolving them now, flagged clearly since they're new, not previously agreed:

- **Leaving a review with undecided flags.** Proposed: the in-progress `ReviewSession` persists per document and is resumable, rather than discarded on exit. This matches the same philosophy behind continuous autosave (ADR-008) — closing a review shouldn't be able to silently lose work any more than closing a document can.
- **What "Plain text" export means.** Proposed: markdown syntax stripped to clean prose, not the raw source with a renamed extension. A plain-text export that still contains `##` and `**` isn't actually plain text in any useful sense. **Owner (2026-10-04, open-decisions #10): the reverse — plain text is the document exactly as written, markdown included, saved as `.txt`.**

Both are proposals, not settled facts — worth a direct yes/no before they go into a ticket.

## 8. Non-functional requirements

- Fully usable offline once the page has loaded once (no backend, no network dependency for core editing).
- No dependency on Chromium-only APIs (ADR-003 rules this out structurally).
- No memory or bundle-size target more specific than "light" was set numerically — see ADR-005's reasoning on why this wasn't quantified further.

## 9. Companion documents

- **ADRs** — architecture and rejected alternatives, one decision per entry.
- **AI Style Review interaction spec** — full state machine for the flagship feature.
- **Design system, final round** — every token, both themes, plus the floating-panel shell structure.
- **Feature-research document** — the original comparative research behind tags, search, deletion, and the other behavior decisions in §6.

Ticket-level detail (new-document flow specifics, file-drop import, tab-overflow menu contents, and similar small items still marked open in the design docs) is resolved when each ticket is written, not here.
