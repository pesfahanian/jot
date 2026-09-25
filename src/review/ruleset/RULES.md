# Rules

One line per rule. Tier controls how it's checked (checks.md) and where it applies (modes.md). Full reasoning and worked examples for judgment-tier rules live in examples/tier2-examples.md.

**Revision note:** renumbered after the postmortem test run. Em dash and semicolons moved from Tier 1 to Tier 1b — both needed a bounded judgment call a pure pattern-match couldn't make. Rule of three and participial tack-on moved to Tier 2 — both needed to reason against the rest of the document, not just the flagged sentence.

## Tier 1 — pattern match (regex / count / threshold)

| ID | Rule |
|---|---|
| T1-01 | Antithesis ("not X, but Y") frequency capped |
| T1-02 | Banned vocabulary — see banned-vocabulary.md |
| T1-03 | Mechanical transitions capped per paragraph |
| T1-04 | Markdown/bullet leakage into prose banned |
| T1-05 | "From X to Y" construction frequency capped |
| T1-06 | Model first-word fingerprints banned at section starts |
| T1-07 | Hedging-stack (helper-verb pileup) capped per sentence |
| T1-08 | Sentence-length hard cap (mode-dependent) |
| T1-09 | Sentence-length variance floor (anti-uniformity) |
| T1-10 | List-item length variance floor |
| T1-11 | False-positivity / "Despite X, Y" pattern frequency capped |
| T1-12 | Phrasal verbs banned — see banned-vocabulary.md |

## Tier 1b — mechanical, needs shallow NLP or one bounded judgment call

| ID | Rule |
|---|---|
| T1b-01 | One name per entity (no noun synonym rotation) |
| T1b-02 | No elegant variation (no verb/adjective synonym-hunting for one referent) |
| T1b-03 | No nominalization ("perform an analysis" → "analyze") |
| T1b-04 | Vague attribution flagged, not failed — see checks.md |
| T1b-05 | Em dash: density-gated, then checked for repeated construction, then motivated-vs-reflexive |
| T1b-06 | Semicolons: independent-clause relatedness test, same in both modes |

## Tier 2 — judgment (LLM judge against a written decision procedure, may need document-wide context)

| ID | Rule |
|---|---|
| T2-01 | Abstraction over specificity |
| T2-02 | Padding / restatement (treadmill effect) |
| T2-03 | Hedging seesaw (false balance) |
| T2-04 | Personifying abstractions |
| T2-05 | Over-explaining the obvious |
| T2-06 | Restatement disguised as meta-commentary |
| T2-07 | Rule of three — decorative use only; necessary enumeration of named items exempt |
| T2-08 | Participial tack-on — must be entailed by context, not just contain a number |

26 rules total. See modes.md for which subset applies to a given section.
