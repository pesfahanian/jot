# Modes

Two modes, chosen per section, not per document. A README can mix both. Mode is assigned by what a section does, never by what kind of document it's in — there is no per-document-type lookup in this file, and there shouldn't be one added later either.

## Strict mode

Use for: error messages, API contracts, migration and deprecation notices, setup and procedure steps — anywhere a misread has a cost.

- Sentence-length cap: 20 words (instruction), 25 words (descriptive)
- Semicolons: independent-clause relatedness test applies (checks.md, T1b-06) — this rule is not mode-dependent
- Em dash: motivated asides capped at 1 per 300 words; reflexive stacking banned outright (checks.md, T1b-05)
- Frequency-capped rules (T1-01, T1-11, T2-07): zero-tolerance for the disallowed case — strict mode has no "sparingly" allowance
- Vocabulary: locked to banned-vocabulary.md replacements, no exceptions
- Phrasal verbs: banned
- Tier 2 rules: apply at full strictness

## Flavored mode

Use for: explanations, design rationale, README prose, anything that needs to argue a point or hold a reader's attention.

- Sentence-length cap: 35 words, soft — flag, don't fail
- Semicolons: same relatedness test as strict (checks.md, T1b-06) — not mode-dependent
- Em dash: motivated asides capped at 1 per 150 words; reflexive stacking still banned outright
- Frequency-capped rules (T1-01, T1-11, T2-07): allowed sparingly. See checks.md for the actual thresholds.
- Vocabulary: banned-vocabulary.md still applies, but the closed dictionary is dropped
- Phrasal verbs: still banned. This is the one rule that holds in both modes.
- Tier 2 rules: apply with more latitude. A judge should weigh whether a flagged instance is motivated or reflexive.

## Assigning a mode

Default to strict for anything prescriptive: an instruction the reader executes. Default to flavored for anything explanatory: a decision the reader needs to understand, not follow.

When in doubt, ask one question: does a misreading here break something, or does it just read less well? Broken means strict. A single document can and often should mix both — assign section by section.
