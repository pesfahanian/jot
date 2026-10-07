# Style Guide (Farsi)

The Farsi counterpart of the English style guide in the parent folder. A machine-verifiable guide for Farsi prose. It applies to documents the review routes as Farsi (decided by counting scripts before any call: mostly Farsi uses this guide; genuinely mixed documents use the majority language's guide on the whole document; English terms, code and URLs inside Farsi prose are normal and are never flagged as errors).

Every rule in RULES.md has a defined check: a script (Tier 1 / Tier 1b) or an LLM judge running a fixed decision procedure (Tier 2). No rule exists without a way to verify it. See checks.md.

**The one structural difference from the English guide: orthography never goes through the model.** Half-spaces, ی/ک, digits, punctuation, quotes, spacing, kashida and a table of commonly mis-spaced words are fixed client-side rules. The model handles fluency, register and structure only. Every rule, including the fixed ones, produces a suggestion the person decides on; nothing auto-applies.

## Files

- `RULES.md`: the full rule list, one line each, grouped by tier, with the plain name the reader sees
- `checks.md`: how each rule is actually verified. For every Tier 1 / 1b rule, the exact client-side pattern and tested must-match / must-not-match strings, in blocks the build strips before sending the file to the model; for Tier 2, the judge's procedure
- `modes.md`: strict vs. flavoured, and what they change (and don't change) in Farsi
- `banned-vocabulary.md`: client-side data tables (never sent to the model): AI-tell vocabulary, officialese, doublets, light-verb padding, loanwords, orthography slips, the verb-stem table
- `output-schema.md`: the per-instance JSON shape, with the few Farsi differences
- `examples/tier1-examples.md`: before/after pairs for Tier 1/1b, grouped by whether the fix is mechanical or needs the shared call
- `examples/tier2-examples.md`: full worked examples with reasoning, load-bearing for the judge

## Design choices

**Orthography is deterministic because the model is not good enough at it.** Persian formal-grammar benchmarks put current models under 50% (PersLitEval, arXiv 2605.27015, May 2026: no model reached 50%; Gemini 2.5 Flash scored 39–46% on grammar depending on prompting). A study of machine-translated Persian found ChatGPT's output showed 12 of 16 catalogued half-space, character and punctuation error types, and that the errors track what human writers do on the web (Medadian, *Language Research*, University of Tehran, 16(1), published online 2025-09-20). So these errors are caught by pattern, from the Academy's own text.

**Sources.** The Academy of Persian Language and Literature's *Dastur-e Khatt-e Farsi* (دستور خط فارسی), new edition, Tehran 1401/2022, ISBN 978-622-5305-22-9 (read 2026-10-05); Virastar, the MIT-licensed Persian text cleaner (`brothersincode/virastar`, `lib/virastar.js`, npm 0.22.1, read 2026-10-05). The Dastur says in its preface (point 3) that punctuation is outside its scope, so the punctuation rules rest on Virastar and ordinary typesetting practice. Research notes: `docs/research/farsi-2026-10.md`.

**Where the Academy and common practice differ, the guide follows the Academy only as far as it is unambiguous.** The Academy accepts joined plurals and comparatives (`کتابها`, `بزرگترین`) and recommends the half-space, so only the spaced forms are flagged. The new edition also fuses compound prepositions and conjunctions (`ازنظر`, `براساس`, `درحالی‌که`); the spaced forms are near-universal, so they are deliberately not flagged (a known, owner-decided omission).

**Register is a consistency question, not a correctness one.** Colloquial Farsi is never called wrong. Only a shift between formal and colloquial inside one passage is flagged (FA-T2-12), as a decision for the writer.

**The three-tier split is the English guide's.** Pure pattern match, mechanical with one bounded judgement or a closed table, and judgement with a written procedure. The UI's kinds (Quick fix, Check fix, Your call) therefore work unchanged.

**Curated lists are the owner's, not a corpus.** The AI-tell phrases, officialese, doublets, loanwords and mis-spaced words were proposed, edited and approved entry by entry. No published list of machine-written Farsi exists that the guide could cite.

## Known gaps

- FA-T1-01 recognises formal verb conjugations only (a closed table of 60 verbs). Colloquial spellings like `می خوام` are not caught.
- Arabic quoted without quotation marks or a blockquote, inside a Farsi sentence, is not recognised as Arabic and its ي/ك will be flagged.
- A joined noun plus clitic (`خانهام`) is not caught; only spaced forms and joined past participles are.
- The sentence-length caps (25/30/40 words), the variance floor (4 words) and the hedge cap (2) are provisional. No published Persian threshold exists, and they have not been calibrated on real writing.
- FA-T1b-08 (vague attribution) never fails a document by itself. It flags a sourcing gap, not a style violation, and routes to human review.
- There is no spelling check for Farsi: a misspelled word that is not one of the listed orthography slips is not flagged. The model's proofing pass is off for Farsi because of the benchmark results above.

## Revision history

Rev 1: first release of the Farsi guide, written with the owner. 46 rules: 17 fixed orthography rules decided entirely client-side from the Academy's Dastur (new edition, 2022) and Virastar, with every pattern carrying tested must-match and must-not-match strings; 9 Tier 1b rules (closed tables with guards, plus coreference); and 12 Tier 2 judgement rules, including four Farsi-specific ones (ezafe pile-up, hidden agent, translationese, register mixing). The English em-dash, semicolon and phrasal-verb rules have no Farsi counterpart. Normalisation is suggest-only throughout. Sentence-length thresholds are provisional.
