# Rules (Farsi)

One line per rule. Tier controls how it's checked (checks.md) and where it applies (modes.md). Full reasoning and worked examples for judgement-tier rules live in examples/tier2-examples.md.

The tiers mean exactly what they mean in the English guide, so the review UI's kinds work unchanged: Tier 1 is a *Quick fix*, Tier 1b with a fix is a *Check fix*, Tier 2 and any flag with no fix is a *Your call*.

**Orthography is never the model's job.** FA-T1-01…14 and FA-T1b-01…03 are fixed rules, decided client-side from the Farhangestan's *Dastur-e Khatt-e Farsi* (new edition, 1401/2022) and from Virastar's well-known conventions. The model handles fluency, register and structure only. Every rule here produces a suggestion the person decides on; nothing auto-applies.

The last column is the plain name the reader sees under a flag's kind (the UI never shows rule IDs or the word "tier").

## Tier 1 — pattern match (regex / count / threshold)

### Orthography and typography — fixed rules, mode-independent

| ID | Rule | Name shown |
|---|---|---|
| FA-T1-01 | Half-space after the verb prefixes می / نمی / همی (`می روم`, `میروم` → `می‌روم`) | Half-space after می |
| FA-T1-02 | Half-space before the plural «ها»: the spaced form, and the joined form after a silent ه (`کتاب ها` → `کتاب‌ها`, `خانهها` → `خانه‌ها`) | Half-space before ها |
| FA-T1-03 | Half-space before «ترین» (`بزرگ ترین` → `بزرگ‌ترین`) | Half-space before ترین |
| FA-T1-04 | Half-space before pronoun clitics, the copula and the indefinite «ی» after a silent ه (`خسته ام` → `خسته‌ام`, `خانه ای` → `خانه‌ای`) | Half-space before an ending |
| FA-T1-05 | Ezafe after a silent ه written with a space (`خانه ی من` → `خانهٔ من`) | Ezafe after ه |
| FA-T1-06 | Arabic ي ى ك written instead of Persian ی ک | Arabic letter |
| FA-T1-07 | Arabic-Indic digits ٠–٩ instead of Persian ۰–۹ | Arabic digits |
| FA-T1-08 | Latin `,` `;` `?` in a Farsi sentence instead of `،` `؛` `؟` | Latin punctuation |
| FA-T1-09 | Spacing around punctuation, inside brackets and inside « » | Punctuation spacing |
| FA-T1-10 | Straight or curly double quotes instead of « » | Quotation marks |
| FA-T1-11 | Doubled spaces | Doubled space |
| FA-T1-12 | Kashida (ـ) | Kashida |
| FA-T1-13 | Stray half-space (ZWNJ): doubled, next to a space, punctuation, digit or Latin letter, or at a line edge | Stray half-space |
| FA-T1-14 | Commonly mis-split or mis-joined words — see banned-vocabulary.md | Mis-spaced word |

### Style

| ID | Rule | Name shown |
|---|---|---|
| FA-T1-15 | Banned vocabulary: AI-tell words and stock phrases, marketing adjectives, officialese verbs — see banned-vocabulary.md | Overused word or phrase |
| FA-T1-16 | Stock transitions capped per paragraph | Stock transition |
| FA-T1-17 | Stock openers banned at section starts | Stock opener |
| FA-T1-18 | Markdown/bullet leakage into prose banned | Markdown inside prose |
| FA-T1-19 | Hedging stack (hedge pileup) capped per sentence | Stacked hedging |
| FA-T1-20 | Sentence-length hard cap (mode-dependent) | Sentence too long |
| FA-T1-21 | Sentence-length variance floor (anti-uniformity) | Sentences all one length |
| FA-T1-22 | List-item length variance floor | List items all one length |
| FA-T1-23 | Antithesis («نه تنها … بلکه …», «X نیست، Y است») frequency capped (mode-dependent) | "Not only X but Y" contrast |
| FA-T1-24 | «از X گرفته تا Y» sweeping-claim frequency capped | "From X to Y" sweep |
| FA-T1-25 | False positivity / «با وجود X، Y» frequency capped (mode-dependent) | "Despite X, Y" upbeat turn |

## Tier 1b — mechanical, needs one bounded judgement or a closed table

| ID | Rule | Name shown |
|---|---|---|
| FA-T1b-01 | Half-space before «تر»: comparative suffix vs the separate word «تر» (wet) | Half-space before تر |
| FA-T1b-02 | Mixed digit systems: the minority system is flagged against the document's dominant one | Mixed digits |
| FA-T1b-03 | Ezafe written `ه‌ی`; house style is `ـهٔ` | Ezafe spelling |
| FA-T1b-04 | Officialese that needs context (`جهت`, `لذا`, `مذکور`, `به منظور`) — see banned-vocabulary.md | Stiff official word |
| FA-T1b-05 | Light-verb padding (`مورد بررسی قرار دادن` → `بررسی کردن`) — see banned-vocabulary.md | Noun where a verb works |
| FA-T1b-06 | Synonym doublets (`سعی و تلاش` → `تلاش`) — see banned-vocabulary.md | Doubled synonyms |
| FA-T1b-07 | Everyday loanword with an approved Farhangestan equivalent: flagged, no fix — see banned-vocabulary.md | Loanword |
| FA-T1b-08 | Vague attribution flagged, not failed — see checks.md | Vague attribution |
| FA-T1b-09 | One name per entity, no synonym rotation (including variant spellings and loan/native pairs for one thing) | One thing, several names |

## Tier 2 — judgement (LLM judge against a written decision procedure, may need document-wide context)

| ID | Rule | Name shown |
|---|---|---|
| FA-T2-01 | Abstraction over specificity | Too abstract |
| FA-T2-02 | Padding / restatement (treadmill effect) | Padding |
| FA-T2-03 | Hedging seesaw (false balance) | Hedging both ways |
| FA-T2-04 | Personifying abstractions | Abstraction acting like a person |
| FA-T2-05 | Over-explaining the obvious | Over-explaining |
| FA-T2-06 | Restatement disguised as meta-commentary | Commentary about the text |
| FA-T2-07 | Rule of three — decorative use only; necessary enumeration of named items exempt | Decorative list of three |
| FA-T2-08 | Participial tack-on («که باعث … می‌شود») — must be entailed by context | Tacked-on clause |
| FA-T2-09 | Ezafe pile-up: four or more nouns chained by ezafe that the reader must unpack | Pile of ezafe |
| FA-T2-10 | Hidden agent: passive or impersonal wording that hides an actor the reader needs | Hidden agent |
| FA-T2-11 | Translationese: English-shaped phrasing and structure | English-shaped Farsi |
| FA-T2-12 | Register mixing: formal and colloquial forms side by side in one passage | Mixed register |

46 rules total (17 of them orthography). See modes.md for which subset applies to a given section.

## English rules with no Farsi counterpart

- **Em dash and semicolon (T1b-05, T1b-06).** `؛` is ordinary Farsi punctuation and the em dash is not a Farsi writing tic, so neither needs a density or relatedness test. A wrongly placed `؛` is covered by FA-T1-08 and FA-T1-09 where it is a typing slip.
- **Phrasal verbs (T1-12).** Farsi has no phrasal verbs. Its closest analogue is the light-verb compound, covered by FA-T1b-05.
