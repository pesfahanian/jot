# Jot — AI Style Review: Interaction Spec (v1)

> Imported from the Claude Design project (`uploads/jot-ai-style-review-interaction-spec.md`) during Phase 5. The illustrative rule IDs in §9 are superseded by the real ones in `src/review/ruleset/RULES.md` (see the addendum in `jot-tickets.md`, Phase 5).

This document specifies behavior only — states, transitions, gating rules, keyboard model. No colors, fonts, spacing, or component styling. Visual design is decided separately and layers on top of everything here.

## 0. Purpose

A two-pane review interface for Jot's flagship AI feature: running a document through a personal, machine-verifiable prose style guide (three tiers of confidence) plus a separate mechanical proofing pass (spelling, grammar, punctuation). Every flagged issue requires an explicit human decision. **Nothing auto-applies, ever** — this is a non-negotiable, standing rule, not a default that gets revisited.

## 1. Layout

- Two panes, side by side, scrolling in sync.
- **Left — "Original."** The untouched source document. Read-only in the fullest sense: while the review view is open, the left pane accepts no text input or edits of any kind — not just "no bubbles for flags," the whole document is locked, full stop. This is broader than a rule about this one feature: for as long as any AI review view is open, editing the underlying document is blocked. Worth carrying into the larger Jot product spec, not just this component.
- **Right — "Result — Preview."** The document as it reads if every flag's current state (see tier defaults below) is applied. Not the committed document — a live preview that updates as decisions are made.
- **Optional third pane — "Review log."** Hidden by default, opened from the top bar.
- **Top bar**, always visible: document path, active ruleset name/version, "N proposed / N decided" counter, Review-log toggle, "Apply N decisions" action — disabled until decided == proposed.

## 2. Flag taxonomy

Two families, kept visually and functionally distinct from each other.

### A. Style tiers (from the prose style guide)

**Tier 1 — mechanical, pattern-matched.**
- Left pane: struck text, trailing arrow if it's a replacement, bare strikethrough if it's a pure deletion.
- Right pane: previews the fix already applied.
- Bubble: rule ID, one-line rationale shown directly (no hidden disclosure — the explanation is short enough not to need one). Actions: **Accept / Reject**. No before/after block — the change is already fully visible inline across the two panes, a separate quote of it would be redundant.

**Tier 1b — mechanical plus one bounded judgment call.**
- Same left/right decoration rules as Tier 1.
- Bubble: rule ID, a "?" icon (hover reveals the one-line rationale as a tooltip — kept out of the bubble's default view since these tend to run longer), a quoted BEFORE/AFTER block. Actions: **Accept / Reject / Write my own**.

**Tier 2 — flagged, no fix exists.**
- Left pane: underline only, no strikethrough — nothing about the original text changes, it's flagged for the person's own judgment.
- Right pane: same underline persists, unresolved, until the person acts — it cannot resolve itself the way the other tiers can, since there's no proposed rewrite to fall back on.
- Bubble: rule ID, the flagged span quoted, the rationale shown directly (no hiding — here it's the primary content, not a detail). A text field for writing a replacement. Actions: **Save edit / Dismiss flag** (dismissing still counts as a decision — see §7).

### B. Mechanical / proofing flags (a separate system, not part of the style ruleset)

- **Spelling** (red) · **Grammar** (blue) · **Punctuation** (yellow) — squiggly underline while pending. Deliberately different from the tier highlight-and-strike treatment, since these are objective errors, not style judgment calls.
- ID prefixes `SPL-` / `GRM-` / `PNC-`, kept distinct from the style ruleset's own `PUN-` prefix (a Tier 1 rule about serial-comma insertion — a style preference, not an error).
- Right pane previews the fix as applied by default, marked with a plain colored underline in that type's color — not a squiggly, since squiggly specifically means "an error sits here," which stops being true once the corrected text is what's shown.
- Bubble: error-type label, the plain-text suggested fix, no before/after block, no rationale. Actions: **Accept / Ignore** (not "Reject" — this borrows the exact vocabulary every spellchecker already uses).

## 3. Span decoration rules (left pane)

- **Strikethrough** — text that will be removed if the flag is accepted or has already been.
- **Trailing arrow (→)**, immediately after struck text — this flag is a *replacement*, something will take its place. This is a property of the flag as a whole, not of each struck fragment individually: a single flag touching multiple non-contiguous struck fragments gets the arrow on every fragment it owns.
- **Bare strikethrough, no arrow** — a *pure deletion*. Nothing replaces this text.
- **Underline only, no strikethrough** — Tier 2 (nothing about the original changes) or a resolved mechanical flag.
- **Small caret (^)** at a point with nothing struck nearby — a pure insertion: something is being added at that exact point, nothing is being removed.
- **Squiggly underline** — a pending mechanical flag, and only a mechanical flag. Never used for style tiers.

## 4. Span states

**Left pane — three states per flagged span:**
- *Pending* — full tier/type color. No ring, no dimming. Default.
- *Focused* — same color, plus a focus ring (an outline, not a fill or saturation change) around the exact span. Active only while that flag's bubble is open, from either a right-pane click or a Review-log jump. The ring is an independent channel from color: color says what kind of flag this is, the ring says which one is open right now.
- *Resolved* — a decision has been made. The highlight desaturates/dims. No ring is possible in this state.

**Right pane — two states per span:**
- *Pending* — tier/type-colored highlight or underline, reflecting the current default preview.
- *Resolved* — on Accept, the highlight clears to plain text. On Reject, the span reverts to the original wording. On a saved replacement, it becomes the person's own text. All three read as equally plain — no outcome leaves a residual color trace.

## 5. Bubble interaction model

- A bubble exists only after an explicit click. No hover-triggered bubbles anywhere.
  - Exception: the "?" rationale icon nested inside an already-open Tier 1b bubble is a secondary hover tooltip within an open surface — not a new top-level bubble, and not bound by this rule.
- Bubbles originate only from clicking a span on the right pane, or an entry in the Review log — never the left pane.
- Closes on click-outside, or its own × control.
- Only one bubble open at a time; opening a new one closes whichever was open.

## 6. Keyboard model

Deferred for v1. A keyboard-driven review flow (step between flags, accept/reject without the mouse) was explored but is intentionally left out for now, to keep the interaction mouse/click-only and simple. Nothing is lost by leaving it out — every flag is already reachable by clicking its span on the right pane or its entry in the Review log, and both remain the only ways to open a bubble. Worth reconsidering as a later addition, not a rejected idea.

## 7. Decision counting & gating

- Every flag — style or mechanical — counts once toward "N proposed."
- A flag moves from *proposed* to *decided* the moment any terminal action is taken: Accept, Reject, Ignore, Dismiss flag, or Save edit. All five are equally valid, equally terminal.
- "Apply N decisions" stays disabled until decided == proposed.
- Applying writes the right pane's current resolved state back into the real document. (How that write happens mechanically — buffer replace, positional patch set, etc. — is an implementation detail outside this spec's scope.)

## 8. Review log

- Lists every flag: ID, tier/type label, a one-line description of the change (before → after, or the flagged span for Tier 2), current status.
- Clicking an entry scrolls both panes to that span and opens its bubble on the right pane — identical behavior to a direct click.

## 9. Reference sample (from the design exploration, not required for implementation)

Source sentence set used throughout: `~/notes/platform-migration.md`, §3 "Rollout."

| ID | Type | Before → After |
|---|---|---|
| VOC-014 | Tier 1 | leverage → use |
| INT-003 | Tier 1 | seamlessly → (deleted) |
| PUN-001 | Tier 1 | insert serial comma after "CI" |
| STR-021 | Tier 1b | — this ensures → . This gives you |
| CLS-007 | Tier 1b | moving forward → (deleted) |
| ABS-002 | Tier 2 | "a robust and scalable solution" — flagged, no fix proposed |
| SPL-031 | Spelling | recieve → receive |
| PNC-014 | Punctuation | ,, → , |
| GRM-022 | Grammar | have → has |

## 10. Known open items

- **Accept vs. Reject on the left pane.** Both resolved outcomes currently just "dim" identically. Whether they should look different from each other (not just different from pending) was never explored.
- **Exiting the review view.** The left pane is locked for editing for as long as this view is open (§1), but what happens to any undecided flags when the person closes it — discarded, or preserved so the review can be resumed later — hasn't been decided. Likely belongs to the broader Jot product spec rather than this document alone.
