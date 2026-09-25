# Tier 1 & 1b Examples

Illustrative for humans either way, but the fix mechanism differs by rule — grouped accordingly, per checks.md's Fix: lines.

## Mechanical fixes — table lookup, produced client-side, no model involved

**T1-02 Banned vocabulary** — Bad: "We utilize a consistent process." Good: "We use a consistent process."

**T1-03 Mechanical transitions** — Bad: "Furthermore, it supports pagination. Additionally, it supports filtering." Good: "It supports pagination and filtering."

**T1-06 First-word fingerprints** — Bad: "Certainly, this works as expected." Good: "This works as expected."

**T1-12 Phrasal verbs** — Bad: "Reach out to the on-call engineer." Good: "Contact the on-call engineer."

**T1b-03 Nominalization** — Bad: "We performed an analysis of the data." Good: "We analyzed the data."

**T1b-04 Vague attribution** — Bad: "Studies show this approach is faster." No `after` produced — this rule flags, it never proposes a fix (output-schema.md). A person would resolve it as: "Chen et al. (2024) found this approach is 30% faster," or cut the claim.

## Generative fixes — need the shared LLM call, not a lookup

**T1-01 Antithesis** — Bad: "It's not a bug, it's a feature." Good: "This is intentional." (Deletion alone doesn't produce this — the replacement has to be composed.)

**T1-04 Markdown leakage** — Bad: a mid-paragraph switch to a bolded bullet list with no structural reason. Good: rewritten as prose, or moved into an actual reference list — either way, not a mechanical strip of the markup.

**T1-07 Hedging stack** — Bad: "It's important to note that this may potentially help improve reliability." Good: "This improves reliability." (Deleting just the hedge words leaves "This may potentially help improve reliability" — still broken; needs a real rewrite.)

**T1-08 Sentence length** — Bad: a 41-word instruction sentence. Good: split into two sentences, each under 20 words — finding a grammatical split point isn't mechanical.

**T1-09 Sentence-length variance** — Bad: five consecutive 18-word sentences. Good: vary it — a 6-word sentence after a 30-word one.

**T1-11 False positivity** — Bad: "Despite the added latency, this is a net improvement." Good: "This adds 40ms of latency in exchange for X." State the tradeoff and let the reader weigh it.

## Mechanical pre-check, generative fix when it matters — the two split rules

**T1b-05 Em dash, motivated — passes** — "The reconciliation job doesn't forgive a missing batch ID — it halts the whole run." A true aside; commas would work just as well.

**T1b-05 Em dash, reflexive — fails** — "The system is fast — really fast — and built to scale." No syntactic role, pure emphasis-stacking. Fix needs the shared call; a bare deletion reads just as awkward as the original.

**T1b-05 Em dash, repeated construction — fails even though each instance passes alone** — "Led the FoodRo vertical — owned architecture end to end. Built the payments layer — handled every edge case." Same "[noun phrase]—[elaboration]" move twice. Fix: vary the connector — a period, a colon, a comma — generated per instance, not the same substitute reused.

**T1b-06 Semicolons, correct use — passes** — "The batch failed; the queue backed up as a direct result." Independent, tightly related clauses — splitting loses the connection.

**T1b-06 Semicolons, misuse — fails at the mechanical step** — "The system is fast; reliable; and easy to use." Not independent clauses on either side — caught client-side, no model needed to know this is wrong. Mechanical fallback fix: period + recapitalize; a better rewrite still benefits from the shared call.
