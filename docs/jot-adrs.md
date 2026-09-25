# Jot — Architecture Decision Records

Prepared ahead of repo creation, for the local Claude Code implementation session. Each entry captures a decision with real technical consequence and a real alternative that was seriously considered and rejected — not a UI preference. Feature-level behavior lives in the interaction spec and design docs; this file is for decisions that shape the system itself.

---

## ADR-001: Build from scratch, not a fork of stackedit.io

**Status:** Accepted

**Context:** Jot began as "a clone of stackedit.io." stackedit's source is Apache-2.0, so forking it was legally available and was seriously considered.

**Decision:** Build a new codebase. Use stackedit only as a UX/feature reference, never as a starting point for code.

**Reasoning:** stackedit's repo is effectively unmaintained (no meaningful commits in roughly two years), built on Vue 2 and webpack, and its editor core is a hand-rolled `contenteditable` engine with Prism.js overlaid on it rather than a real editor framework with a document/transaction model. That absence of a real model is specifically why it has no IDE-style commands (multi-cursor, move-line, and similar) — there's nothing to hang those commands on. Retrofitting that onto a legacy stack is more work than building fresh on a framework that already has these commands built in.

**Consequences:** No shortcuts from existing code; everything is built new. In exchange, the codebase starts on a current, real editor framework (ADR-002) instead of inheriting stackedit's architectural ceiling.

---

## ADR-002: CodeMirror 6 + `@replit/codemirror-vscode-keymap`, not Monaco

**Status:** Accepted

**Context:** The editor needs to feel like a fast, minimal tab, support real VSCode-style keybindings (multi-cursor, move-line, select-next-occurrence), and support native spellcheck. Monaco — VSCode's own editor component — was the natural first candidate.

**Decision:** CodeMirror 6, with `@replit/codemirror-vscode-keymap` layered on top for keybinding parity.

**Reasoning:** Monaco's native browser spellcheck has been broken since 2019, a long-standing unresolved upstream issue, because Monaco renders text as span-per-token overlays rather than genuine contenteditable content — the browser's spellchecker has nothing real to attach to. The only workarounds are third-party libraries that reimplement spellcheck from scratch (their own dictionary, their own underline rendering, their own suggestions), which is a larger, worse-integrated feature than what CM6 provides natively. CM6's content area is real contenteditable text, so `EditorView.contentAttributes.of({ spellcheck: "true" })` hands off to the actual OS/browser spellchecker — the one with the person's own dictionary and added words. `@replit/codemirror-vscode-keymap` (MIT, maintained by Replit for their own in-browser editor) independently supplies the VSCode keybinding parity that was Monaco's other main draw.

**Consequences:** CM6 is also lighter than Monaco, with none of Monaco's unused IntelliSense/LSP machinery. Accepted tradeoff: CM6's theme coloring is a Lezer-tag-based approximation of a real TextMate grammar, not pixel-identical to how Monaco would render an imported VSCode theme. This stopped mattering once custom theme *import* was dropped entirely (ADR-006) in favor of Jot's own built-in light and dark themes.

---

## ADR-003: IndexedDB only — no File System Access API, no sync backend

**Status:** Accepted

**Context:** Documents need to persist locally with no backend. Two real options existed: IndexedDB (works in any browser) or the File System Access API (real folder sync, reading and writing actual files on disk).

**Decision:** IndexedDB only.

**Reasoning:** File System Access API is Chromium-only — no Safari, no Firefox. Real folder sync was attractive, but at the cost of the app not fully working outside Chromium. Universality won.

**Consequences:** No real on-disk file backing; documents live inside browser storage, scoped to one browser on one device, with no cross-device sync by design. Data loss if browser storage is cleared is a real, accepted risk for a single-user personal tool. A full-workspace export/import (backup) flow was flagged during feature research as the mitigation for this — it belongs in the product roadmap, not this ADR.

---

## ADR-004: No backend for AI features — client-side OpenRouter key

**Status:** Accepted

**Context:** The flagship AI feature (style review) needs to call an LLM. Jot has no server anywhere, by design, for hosting-cost and complexity reasons.

**Decision:** The person supplies their own OpenRouter API key, stored client-side. Calls go directly from the browser to OpenRouter.

**Reasoning:** OpenRouter's API is CORS-enabled and designed to be called directly from a browser with nothing more than a Bearer header. This is a concrete advantage over calling a provider like Anthropic's own API directly from a browser, which requires a special `anthropic-dangerous-direct-browser-access` header precisely because direct browser calls aren't its intended integration path. OpenRouter also gives access to multiple model providers, including Gemini, through one key — evaluated and explicitly declined in favor of OpenRouter-only for v1, to keep the settings surface to a single field.

**Consequences:** The API key sits in browser storage, unencrypted. Acceptable for a single-user personal tool; would need revisiting if Jot is ever shared or made multi-tenant.

---

## ADR-005: Vite + React + shadcn, not Next.js

**Status:** Accepted

**Context:** Framework choice was deliberately deferred through most of the design phase. Once design work was essentially complete, the decision was made directly. Next.js was the front-runner going in, on the strength of prior personal experience with it.

**Decision:** Vite + React, with shadcn/ui for components.

**Reasoning:** Next.js's core value — server-side rendering, file-based routing, API routes — solves problems Jot doesn't have: no backend, nothing that needs to be crawlable, no server-rendering target, and no meaningful "pages" (documents are client-side state, not routes). Shipping Next's SSR/routing runtime for an app that never uses either is unjustified weight. shadcn/ui is fully Vite-native — confirmed via its own official installation docs, which list Vite as a first-class target independent of Next.js — so nothing about its Radix-based accessible components (menus, popovers, dialogs) requires Next.

**Consequences:** The entire design token system already built (colors, radii, spacing, both themes) was constructed explicitly as shadcn CSS variables (`--background`, `--primary`, `--border-strong`, and so on), so it drops into a Vite+shadcn setup without translation. Pure vanilla HTML/JS/CSS was considered as an even lighter alternative and rejected for v1 — real but modest additional savings (tens of MB, not hundreds) at the cost of hand-building every accessible menu, popover, and dialog interaction shadcn/Radix already solves correctly.

---

## ADR-006: Light/dark theming is first-class; custom theme import is not supported

**Status:** Accepted

**Context:** The project originally wanted to let the person import an arbitrary custom VSCode theme file for the editor's syntax colors. Over the course of design work, real light and dark themes were built out in full — shared shapes, spacing, and radii, with per-theme color values — and the goal shifted from "import someone else's theme" to "the app has its own two real themes."

**Decision:** Jot ships its own light and dark themes as first-class, switchable options, plus a `system` setting that follows the OS. Arbitrary custom theme import is dropped, not deferred.

**Reasoning:** With CM6's theme rendering being an approximation rather than a true TextMate grammar (ADR-002), faithfully reproducing an arbitrary imported VSCode theme was never going to be pixel-accurate regardless. Once Jot had its own considered, from-scratch design system, importing someone else's theme stopped being the goal.

**Consequences:** No theme-JSON import UI needs to be built. The two shipped themes must stay in shape parity with each other — same radii, spacing, and borders, with only color differing. This was violated during design (dark drifted from light on several dimensions because it was designed in a separate round) and required an explicit audit and reconciliation pass to fix. New work should hold this rule from the start rather than needing another audit later.

---

## ADR-007: Tags are metadata-only, six fixed colors, no folders

**Status:** Accepted

**Context:** Organization needed a decision between nested folders, free-text tags, or something simpler. An early draft let a document carry inline `#tag` text in its body as a shortcut into the tag system, which created a real problem: removing a tag was never supposed to touch document text, but if `#tag` text stayed live in the document, the tag could silently reappear the next time it was read.

**Decision:** Tags are exactly six fixed colors, no names, no free text. Each document carries at most one color, or none. Assignment happens only through an explicit UI action (a swatch picker or context menu), never by typing. Filtering the sidebar by multiple selected colors is a logical OR — a document can only be one color, so selecting more colors can only add matches, never narrow them.

**Reasoning:** Colors aren't a natural thing to type inline the way `#todo` is, so the dual-source inline-text-plus-metadata design was solving a problem — a typing shortcut — that stopped existing once tags became colors rather than words. Nested folders were rejected earlier for a separate reason: they'd force the sidebar into a tree view, a structural UI change, whereas tags are purely additive to the data model and require no change to the sidebar's shape at all.

**Consequences:** No nested organization exists or is currently planned. If multi-directory support is ever revisited, it's a genuinely new feature, not an extension of the tag system.

---

## ADR-008: Continuous autosave — no "unsaved" state anywhere

**Status:** Accepted

**Context:** stackedit's actual behavior, verified directly from its own bundled documentation, is that local documents write to browser storage automatically and continuously — no explicit save action, no "unsaved changes" state modeled anywhere for local documents. Jot's own early shell mockups had drifted into showing an unsaved dot on tabs and an "unsaved" badge before this was caught and corrected.

**Decision:** Every edit writes to IndexedDB continuously. No UI anywhere represents a "dirty" or "unsaved" document state, because that state doesn't exist.

**Reasoning:** A save-state indicator only makes sense when "in memory" and "written to disk" are two different states a document can be in. Once persistence is continuous, that distinction doesn't exist, so showing UI for it would describe a state that never happens.

**Consequences:** Several other flows simplify as a result — closing a tab, switching documents, or reloading the page never needs a confirmation on this basis. Deletion is still destructive and handled separately; this ADR concerns routine editing only, not deletion.

---

## ADR-009: AI review flags require an explicit decision — nothing auto-applies

**Status:** Accepted

**Context:** The AI Style Review feature proposes edits at varying confidence levels, from a one-word mechanical fix to "flagged, no fix exists." It would be technically simpler to auto-apply the highest-confidence tier and only surface the uncertain ones.

**Decision:** No flag is ever applied automatically, regardless of confidence tier. Every flag — mechanical or not — requires an explicit terminal decision (accept, reject, ignore, dismiss, or a saved custom edit) before it counts toward completion, and the document itself only changes once the person applies the fully-decided set.

**Reasoning:** This was a standing requirement from the first design of this feature, re-confirmed at multiple points across the design process, including an explicit correction when an early mockup implied otherwise. Even a high-confidence rewrite is still a change to the person's own words that they didn't type themselves.

**Consequences:** Every flag needs its own persisted decision state (pending / accepted / rejected / ignored / dismissed / edited) — a real data-modeling requirement, not just a UI detail. The "apply" action's enabled state depends on every flag having reached a terminal state, and must be modeled as an actual precondition rather than inferred from the UI alone.

---

## ADR-010: No command palette, no quick-switch (Cmd+P) — removed, not deferred

**Status:** Accepted

**Context:** Both a VSCode-style command palette and a Cmd+P "quick-switch" document finder were explored during design and fully specified — quick-switch had a working mockup: a ranked list, open documents first, fuzzy filtering.

**Decision:** Both are cut entirely from v1. This is a removal, not a "not built yet."

**Reasoning:** A deliberate move away from keyboard-shortcut-driven, no-mouse-first interaction patterns for now — the same reasoning that removed keyboard shortcuts from the AI review feature earlier in the process. Quick-switch specifically only existed as a reason to have a shortcut in the first place; with no shortcut, there's no reason to keep a document-finder modal when the sidebar already does that job with a mouse.

**Consequences:** Document switching relies on the sidebar and open tabs only. If a coding agent building this feature is tempted to add a command palette or quick-open as a natural addition to a keyboard-centric editor, that instinct should be overridden — it was deliberately removed, not overlooked.

---

## ADR-011: Desktop only, no responsive layout

**Status:** Accepted

**Context:** Every design frame across this project was rendered at 1000–1400px. The interaction model — multi-pane layout, hover-dependent controls, right-click context menus — has no mobile equivalent, and this was flagged as an unaddressed gap in the design system's own inventory.

**Decision:** Jot is desktop-only. No responsive breakpoints, no attempt at a mobile layout. Below a minimum window width, the app doesn't try to reflow — it replaces its entire content with a plain message telling the person to widen their window.

**Reasoning:** The interaction model was designed and tested exclusively at desktop widths. A mobile-adapted version of multi-pane editing, hover controls, and right-click menus would be a different product, not a smaller version of this one.

**Consequences:** No responsive QA needed beyond confirming the guard triggers correctly at the threshold. Threshold set at 1000px — the lower bound of what was actually tested throughout design.
