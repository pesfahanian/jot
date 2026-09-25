# Jot — Implementation Tickets

Organized by phase, each phase producing something checkable before the next starts. Every ticket has acceptance criteria a coding agent can verify against itself before marking it done — that verification happens per ticket, not deferred to a final testing phase. Full behavior detail lives in the referenced companion documents; this file is scope and acceptance criteria, not re-specification.

Format per ticket: scope, acceptance criteria, reference.

---

## Phase 0 — Scaffolding

**T0.1 — Project init**
Vite + React + TypeScript, shadcn/ui installed and configured, Tailwind wired.
- [ ] `pnpm dev` runs a blank app locally with no errors.
- [ ] shadcn CLI has been run; at least one stock component renders correctly.
- Reference: ADR-005.

**T0.2 — Design tokens wired in**
Both themes' CSS variables from the design system's final round dropped into the global stylesheet.
- [ ] `:root` and `.dark` blocks match the design doc's §2 exactly, including `--border-strong` / `--border-subtle` and the layout tokens (`--seam`, `--radius-panel`, `--radius-tray`, `--document`, `--mark`).
- [ ] Toggling a `dark` class on `<html>` visibly swaps the palette with no other code changes.
- Reference: Design system, final round, §2.

**T0.3 — Deploy pipeline, empty shell**
> **Deferred (2026-09-25, owner's decision):** no deployment until development is complete. Phases are verified on localhost only; this ticket is picked up after Phase 6, and the "every subsequent phase deploys" criterion no longer applies.

Ship the blank scaffold to the real deployment target before building anything on top of it.
- [ ] A build of the current (empty) app is live at the real subdomain.
- [ ] Every subsequent phase deploys to this same target, not just localhost.
- Reference: personal-projects-deployment plan.

**T0.4 — Storage wrapper**
IndexedDB access layer set up (Dexie or equivalent).
- [ ] A test record can be written and read back after a full page reload.
- Reference: ADR-003.

---

## Phase 1 — Storage & document model

**T1.1 — Document CRUD**
Create, read, update, delete against the `Document` schema.
- [ ] All four operations work against IndexedDB with no UI yet — verify via console/test script.
- Reference: PRD §5.

**T1.2 — Continuous autosave**
Every edit writes to storage; no dirty-state concept exists anywhere.
- [ ] Typing in a document (once the editor exists in Phase 2) persists within the debounce window with no explicit save action.
- [ ] No boolean or state anywhere represents "unsaved."
- Reference: ADR-008.

**T1.3 — Settings store**
Single record: API key, key status + last-validated timestamp, theme preference.
- [ ] Settings persist across reload.
- Reference: PRD §5.

---

## Phase 2 — Editor integration

**T2.1 — CodeMirror 6 base setup**
Markdown mode, connected to a document's `content` field.
- [ ] Typing updates the bound document's content in memory.
- Reference: ADR-002.

**T2.2 — VSCode keymap**
`@replit/codemirror-vscode-keymap` integrated.
- [ ] Insert-cursor-above/below, select-next-occurrence, and move-line all work.
- [ ] Zero collisions confirmed against CM6's own default bindings — check directly, don't assume.
- Reference: ADR-002.

**T2.3 — Native spellcheck**
`contentAttributes` set for spellcheck.
- [ ] Misspelled words get real OS/browser spellcheck underlines and right-click suggestions.
- Reference: ADR-002.

**T2.4 — Syntax highlighting**
Both themes' `--syn-*` tokens applied to markdown syntax.
- [ ] Headings, bold/emphasis, links, and code each render in their assigned hue, matching the design doc's §1.7 exactly.
- Reference: Design system, final round, §1.7.

---

## Phase 3 — Shell chrome

**T3.1 — Sidebar**
Flat file list, relative timestamps, sort toggle (name ↔ date), pinned notes, collapsible search.
- [ ] Sort toggle cycles correctly. Pinned files stay on top regardless of sort.
- [ ] Search collapses to an icon at rest, expands to a field on click.
- Reference: Design system + missing-flows spec.

**T3.2 — Tabs**
Open/close documents as tabs; overflow behavior when more tabs exist than fit.
- [ ] Closing the last tab in a pane behaves sensibly (defined at implementation time if not already specified).
- [ ] Overflow menu contents are decided and implemented, not left as a stub — this was an open item in the design docs.
- Reference: Design system §3 inventory gap: "narrow-pane ⋯ menu."

**T3.3 — Split panes, floating-panel shell**
2–3 panes side by side; sidebar, editor(s), and status bar as independent floating panels per the final design round.
- [ ] Visual structure matches frames 8a/8b: seam, tray, panel radius, concentric tray radius.
- [ ] Three-pane layout specifically verified — the design doc asserts this works but never rendered it; confirm directly rather than assuming the two-pane case generalizes.
- Reference: Design system, final round, §1.2b.

**T3.4 — Tag system**
Six fixed colors, one per document, assignment via swatch UI, sidebar filter with OR semantics.
- [ ] Assigning a new color replaces any existing one.
- [ ] Selecting multiple filter colors only ever adds matching documents, never removes any.
- [ ] No text-parsing of document content for tags anywhere.
- Reference: ADR-007.

**T3.5 — Delete flow**
No confirmation dialog; immediate delete with an undo toast.
- [ ] Deleting a second document while a toast is still showing resolves the first one's undo window rather than leaving two toasts stacked.
- Reference: Design system §6c behavior notes.

**T3.6 — Export**
Markdown / plain text / PDF, triggered directly with no intermediate dialog.
- [ ] Plain text strips markdown syntax to clean prose (PRD §7 resolution) — confirm this was actually implemented, not left as raw text with a renamed extension.
- Reference: PRD §7.

**T3.7 — Empty states**
No documents, no search results, no color-filter matches, empty document.
- [ ] All four render distinctly and correctly, including the zero-match color-filter case, which only becomes reachable once T3.4's OR-filter logic is correct.
- Reference: Design system, missing-flows spec §6d.

**T3.8 — New-document flow**
The `+` control's actual behavior: naming, and which pane it opens in.
- [ ] Decided and implemented as part of this ticket — this was left open in every prior design round and needs resolving here, not deferred again.

**T3.9 — Status bar**
Counts, cursor position, theme switch cell, review control, API key cell.
- [ ] All cells match the design doc's fixed-width, no-reflow requirement across every state.
- Reference: Design system §1.9, §1.13.

**T3.10 — Minimum-width guard**
Desktop only (ADR-011).
- [ ] Below 1000px, the app (sidebar, editor, everything) doesn't mount or render at all — only a plain, centered text message.
- [ ] Above 1000px, normal operation, no guard visible.
- [ ] Resizing live across the threshold, in either direction, triggers the swap correctly without needing a reload.
- Message tone: blunt, not apologetic — final copy at implementation's discretion.
- Reference: ADR-011.

---

## Phase 4 — Theming

**T4.1 — Theme switching**
Light / dark / system, with `system` resolving to and displaying the OS preference.
- [ ] Switching updates every token-driven surface immediately, with no page reload required.
- Reference: Design system §3f behavior notes.

**T4.2 — Keycap elevation**
The one signature elevation exception, reserved for the AI review panel and its shortcut keys, both themes.
- [ ] Confirmed rendered against `panel` ground, not `surface` — the light version specifically fails on the wrong ground.
- Reference: Design system §1.9, §1.10.

---

## Phase 5 — AI Style Review

**T5.1 — API key panel**
Masked input, test-connection action, clear/reset, states mapped to the review control's own four-state model.
- [ ] "No key" maps to the disabled register, not idle — confirm this reads correctly once real, not just as a design intention.
- Reference: API-key screen spec, design system §1.13.

**T5.2 — Review invocation**
Status-bar control: idle / idle-disabled / running / error.
- [ ] Clicking while idle-disabled (no key set) opens the key panel instead of attempting a request.
- Reference: Design system §7 frames.

**T5.3 — Two-pane review interface**
Original (locked) / Result (interactive), per the interaction spec.
- [ ] Left pane genuinely has no click handlers of any kind — verify this structurally, not just visually.
- Reference: AI Style Review interaction spec, §1–§5.

**T5.4 — Tier and proofing bubbles**
Tier 1 / 1b / 2, plus spelling / grammar / punctuation.
- [ ] All five bubble types implemented — Tier 1 was still undrawn as of the last design round; don't assume it's identical to 1b minus the before/after block without checking the spec.
- Reference: Interaction spec §2; design system §1.11.

**T5.5 — Review log**
Third pane, document order, jump-and-focus on click.
- Reference: Interaction spec §8.

**T5.6 — Apply / completion flow**
Gating on N/N decided; writes and closes; undo toast.
- [ ] Undecided flags on exit persist and are resumable (PRD §7 resolution) — confirm this was actually built, not just documented as intent.
- Reference: PRD §7; design system §1.11.

**T5.7 — Decoration rules**
Focus ring, resolved-state dimming, replace-vs-delete distinction (arrow vs. bare strikethrough).
- [ ] A pure-deletion flag never carries a replacement arrow — this specific bug occurred once already during design; re-verify it doesn't recur in code.
- Reference: Interaction spec §3–§4.

> **Flag production (addendum, 2026-09-25).** T5.1–T5.7 specify the review UI; T5.8–T5.12 specify how flags are produced. The rule set lives in `src/review/ruleset/` — `checks.md` (execution model, per-rule detection) and `output-schema.md` (result shape) are authoritative; read both in full before implementing any of these. Summary: **Pass A** (client-side, before any model call) runs all Tier 1 detection, T1b-03/T1b-04 in full, and the mechanical pre-checks for T1b-05 (density) and T1b-06 (independent-clause validity); mode-independent rules are final here, while the four mode-dependent ones (T1-01, T1-08, T1-11, T1b-05 density) record candidates only. **One shared OpenRouter call** per document then covers section mode classification (first), T1b-01/T1b-02, the gated T1b-05/T1b-06 follow-ups, all of Tier 2, and fix generation for T1-01/04/05/07/08/09/10/11 on already-confirmed spans. **Pass B** (client-side, arithmetic only) buckets Pass A candidates into the returned sections and finalizes them by mode. The model never re-decides whether a Tier 1 or Tier 1b-mechanical rule fired.
>
> Mapping onto `ReviewFlag`: `id` is the real rule ID (`T1-01`…`T1-12`, `T1b-01`…`T1b-06`, `T2-01`…`T2-08`, replacing the interaction spec's placeholder IDs); `family` is `tier1`/`tier1b`/`tier2`; `span` is matched verbatim against the live document, and a non-match downgrades to a comment-only note (existing interaction-spec mechanism); `after` sets `kind` — `null` → `flag` (Tier 2 and T1b-04), non-empty → `replace`, `""` → `delete` (handled defensively; no current rule emits it); `rationale` is present on every record. Aggregate rules (T1-03, T1-09, T1-10, T1-11, T2-07, T1b-05 density) emit one independent record per contributing instance, sharing `id`/`family`/`rationale`.

**T5.8 — Ruleset loading**
Bundle `src/review/ruleset/` into the app at build time (e.g. Vite `?raw` imports) — no runtime fetch, no backend.
- [ ] All 8 files' content is available to the app as static, bundled strings.

**T5.9 — Pass A: client-side detection**
All Tier 1 rules, T1b-03, T1b-04, and the mechanical pre-checks for T1b-05/T1b-06, per `checks.md`'s per-rule detection methods.
- [ ] Mode-independent rules produce a final verdict and, where mechanical, a real (non-empty) `after` directly from this pass — no model call involved.
- [ ] The four mode-dependent rules (T1-01, T1-08, T1-11, T1b-05 density) produce raw candidates with position only, correctly withholding a verdict.

**T5.10 — Shared OpenRouter call**
The single per-document call: mode classification, T1b-01/T1b-02, the conditional T1b-05/T1b-06 follow-ups, all of Tier 2, and fix generation for the generative-fix Tier 1 rules.
- [ ] Confirmed as one call per document, not several — the efficiency requirement this was specifically designed around.
- [ ] T1b-05's repetition/motivation steps and T1b-06's relatedness step are only included in the prompt when their respective client-side gate already passed — not sent unconditionally.
- [ ] Both example files are included as grounding content.
- [ ] Response is parsed into the `sections` array and the shared call's own flag entries per `output-schema.md`.

**T5.11 — Pass B: mode reconciliation**
Bucket Pass A's raw candidates into the returned `sections` and finalize pass/fail using each section's mode.
- [ ] The three distinct arithmetic types (rate cap, flat per-sentence, flat per-document budget) are each implemented correctly — verify against `checks.md`'s worked description of T1-11 specifically, since its per-document (not per-section) budget is the one most likely to be implemented wrong by analogy to the other two.

**T5.12 — Assemble final flags, map to `ReviewFlag`**
Combine Pass A's mode-independent flags, Pass B's reconciled flags, and the shared call's own flags into one final list; map every field per the mapping above.
- [ ] A flag whose `span` doesn't match the live document exactly downgrades to a comment-only note, using the same mechanism already built for this in the interaction spec — not a new one.
- [ ] Aggregate rules render as multiple independent flag records, never collapsed into one.

---

## Phase 6 — End-to-end, performance, polish

**T6.1 — Persistence smoke test**
Open the app, type, reload, confirm the content is still there.
- [ ] Passes with a real browser reload, not a simulated one.

**T6.2 — Review state machine unit tests**
The one area of the app where broad test coverage is actually warranted.
- [ ] Accept/reject/ignore/dismiss/edit transitions, the decided/pending counter, and the tag OR-filter logic each have real unit tests — these exact areas produced real bugs during design (the tag AND/OR mixup, the CLS-007 arrow bug) and a test suite here would have caught both automatically.

**T6.3 — Performance and memory profiling**
Checked against the actual "light and fast" goal that drove the framework decision.
- [ ] Baseline memory and bundle size measured and recorded, not just assumed acceptable.

**T6.4 — Long-content stress test**
Sidebar at 100+ files, very long filenames, scrollbar behavior under real load.
- Reference: Design system §3, "gaps — not yet considered: long content."

**T6.5 — Cross-browser check**
Confirm behavior in every browser IndexedDB is expected to support.
