# Modes (Farsi)

Two modes, chosen per section, not per document. A README can mix both. Mode is assigned by what a section does, never by what kind of document it's in. This is the English guide's rule, unchanged.

**Modes never touch orthography or register.** Every orthography rule (FA-T1-01 to FA-T1-14 and FA-T1b-01 to FA-T1b-03) behaves identically in both modes, and neither mode decides whether a passage should be formal or colloquial (FA-T2-12 flags only a shift inside a passage). Modes change four things: the sentence-length cap, the frequency caps on two style patterns, the decorative-triplet cap, and how much latitude Tier 2 gets.

## Strict mode

Use for: error messages, API contracts, migration and deprecation notices, setup and procedure steps — anywhere a misread has a cost.

- Sentence-length cap: 25 words (instruction), 30 words (descriptive); a word is counted with ZWNJ joining, so `می‌روم` is one (checks.md, FA-T1-20)
- Frequency-capped rules (FA-T1-23 antithesis, FA-T1-25 «با وجود X، Y», FA-T2-07 decorative triplets): zero-tolerance for the disallowed case; strict mode has no "sparingly" allowance
- Vocabulary: locked to banned-vocabulary.md replacements, no exceptions
- Light-verb padding (FA-T1b-05) and officialese (FA-T1-15, FA-T1b-04): flagged
- Tier 2 rules: apply at full strictness

## Flavoured mode

Use for: explanations, design rationale, README prose, anything that needs to argue a point or hold a reader's attention.

- Sentence-length cap: 40 words, soft: flag, don't fail
- Frequency-capped rules (FA-T1-23, FA-T1-25, FA-T2-07): allowed sparingly. See checks.md for the actual thresholds
- Vocabulary: banned-vocabulary.md still applies, but the closed dictionary is dropped
- Light-verb padding (FA-T1b-05) and officialese (FA-T1-15, FA-T1b-04): still flagged. These hold in both modes
- Tier 2 rules: apply with more latitude. A judge should weigh whether a flagged instance is motivated or reflexive. Personification (FA-T2-04) in particular has a long literary tradition in Persian prose, so a deliberate device that still carries its fact passes

## Assigning a mode

Default to strict for anything prescriptive: an instruction the reader executes. Default to flavoured for anything explanatory: a decision the reader needs to understand, not follow.

When in doubt, ask one question: does a misreading here break something, or does it just read less well? Broken means strict. A single document can and often should mix both: assign section by section.

## What differs from the English modes

- No em-dash or semicolon rules, so no density cap to vary by mode (RULES.md explains why).
- No phrasal-verb rule. Its Farsi analogue, light-verb padding, holds in both modes.
- The sentence-length caps are about 1.2× the English ones and provisional (checks.md, FA-T1-20).
