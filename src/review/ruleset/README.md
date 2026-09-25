# Style Guide

A machine-verifiable style guide for technical and product documentation. Every rule in RULES.md has a defined check: either a script (Tier 1 / Tier 1b) or an LLM judge running a fixed decision procedure (Tier 2). No rule exists without a way to verify it. See checks.md.

## Files

- `RULES.md` — the full rule list, one line each, grouped by tier
- `checks.md` — how each rule is actually verified, what runs client-side vs. in the shared LLM call, and how each fix is produced
- `modes.md` — strict vs. flavored, and which doc sections get which (criteria only — see checks.md for who applies it)
- `banned-vocabulary.md` — word, phrase, and nominalization substitution tables
- `output-schema.md` — the per-instance JSON shape a completed check produces, for Jot's review UI
- `examples/tier1-examples.md` — before/after pairs for Tier 1/1b, grouped by whether the fix is mechanical or needs the shared call
- `examples/tier2-examples.md` — full worked examples with reasoning, load-bearing for the judge

## Design choices

Two patterns here are borrowed directly, not reinvented: keeping the core rules file small with detail loaded on demand from separate files, and pairing judgment-tier rules with annotated before/after examples rather than a one-line description. Both come from existing Claude Skills built for this exact problem — [no-slop](https://github.com/Byk3y/no-slop), sourced from Wikipedia's Signs of AI Writing page, and the skill behind [this experiment](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop), sourced from ASD-STE100.

The three-tier split — pure pattern match, mechanical-but-needs-NLP, judgment-with-a-written-procedure — isn't present in either source. Most existing anti-AI-slop tools collapse everything into a banned-word list. That experiment found banned-word lists to be the least reliable version of this idea, and worked at all only because it was standing in for rules that actually needed to be structural.

## Known gap

T1b-04 (vague attribution) never fails a document by itself. It flags a sourcing gap, not a style violation, and routes to human review. See checks.md.

## Revision history

Rev 2: after a test run against a real postmortem, four checks turned out too blunt for real technical writing — em dash and semicolon counts couldn't tell a legitimate use from a slop tic, rule of three couldn't tell necessary enumeration from decoration, and participial tack-on required a number even when the claim was already grounded elsewhere in the sentence. All four were rewritten with a judgment test instead of a flat count, which moved em dash and semicolons into Tier 1b and rule of three and participial tack-on into Tier 2. IDs were renumbered accordingly — see RULES.md.

Rev 3: T1b-05 (em dash) failed silently on a real CV — 4 dashes in 326 words, well over its own cap, and 3 of the 4 using the identical construction. The per-instance motivation test in Rev 2 never got a chance to catch either problem, because it only ever asked "is this one okay" and never tallied across instances. Added two mechanical gates that run before the motivation test: a density check and a repeated-construction check. Either can fail a document even when every individual instance would pass the motivation test alone.

Rev 4: rebuilt for Jot's review UI, which needs one accept/reject record per flagged instance, not one aggregated row per rule. `report-template.md` is gone, replaced by `output-schema.md`. This forced three things that weren't decided before: (1) mode assignment now has an explicit owner — the model, as step 0 of one shared LLM call, not a person or a separate pass; (2) Tier 1 detection being deterministic turned out not to mean Tier 1 *fixing* is — most Tier 1 rules need real rewriting to fix well, so fix-generation for those rides along in the same shared call that already runs for Tier 1b/Tier 2, while a genuinely mechanical subset (banned vocabulary, phrasal verbs, nominalization, first-word fingerprints, mechanical transitions) gets its fix from a table, client-side, for free; (3) aggregate rules (density, variance, frequency caps) don't have one violating span, so a document-wide failure now produces one flag per contributing instance, all sharing one rationale. Added a nominalization table to banned-vocabulary.md to make T1b-03's fix mechanical too — the one change outside what this revision was scoped to touch.

Rev 5: Rev 4 had a real sequencing contradiction, caught before any code was written rather than after. "Client-side runs first" and "mode comes from the shared call, which runs after client-side" can't both be true for the four rules whose pass/fail threshold depends on mode (T1-01, T1-08, T1-11, T1b-05's density step) — client-side can't finish those without a mode it doesn't have yet. Fixed by splitting client-side into two passes: Pass A detects raw candidates before the shared call, Pass B reconciles them against mode after the shared call returns, as local arithmetic with no second model call. Also formalized `after` as three distinct values (a real replacement, an explicit empty-string deletion, or `null` for no fix proposed) instead of an implicit null/non-null binary, after confirming none of the current 26 rules' mechanical fixes actually need the empty-string case — every one of them sits at a position where recapitalizing the next word is required, which makes the fix a short substitution instead.
