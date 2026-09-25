# Checks

How each rule in RULES.md is actually verified. Tier 1 and 1b: detection methods precise enough to implement as a script. Tier 2: the exact procedure an LLM judge applies. The judge sees this text directly, not a summary of it.

## Execution model

Three places this actually runs — and one of them runs twice, which matters.

**Client-side, Pass A: raw detection, before the shared call.** All of Tier 1 detection, T1b-03 and T1b-04 in full, and the mechanical pre-checks for T1b-05 (density) and T1b-06 (independent-clause validity) — computed the same way regardless of mode, since mode isn't known yet. For mode-*independent* rules, this pass alone is final: pass/fail is already decided, and `after` is already produced wherever the fix is a table lookup or a safe deterministic transform. For the four mode-*dependent* rules (below), this pass produces raw candidate counts and positions only, not a verdict — the threshold to apply against those counts doesn't exist yet.

**One shared LLM call, once per document, after Pass A.** Everything needing real judgment, generation, or classification, not three separate round trips:
- Mode classification for every section — always included, every document, and resolved first within this call, since Pass B and some of the items below depend on it.
- T1b-01 and T1b-02 in full (coreference resolution has no client-side substitute).
- T1b-05's structural-repetition and motivation steps, only for documents where the density pre-check already passed.
- T1b-06's relatedness judgment, only for semicolons where both sides already passed the independent-clause check.
- All of Tier 2, detection and rationale together, as specified below.
- Fix generation for the Tier 1 rules detected deterministically but needing rewriting, not substitution: T1-01, T1-04, T1-05, T1-07, T1-08, T1-09, T1-10, T1-11.

**Client-side, Pass B: mode reconciliation, after the shared call returns.** Local arithmetic only, no model call. Takes `sections` from the shared call and the raw candidates from Pass A, and finalizes pass/fail for whichever rules Pass A couldn't resolve alone. See "Two-pass reconciliation," directly below.

**Never re-decided by the model:** whether a Tier 1 or Tier 1b-mechanical rule fired at all. That's settled client-side, across Pass A and Pass B together. The shared call only writes prose where prose is genuinely the job, and only classifies what Pass B needs to finish its own arithmetic.

### Two-pass reconciliation for mode-dependent Tier 1 rules

Four rules can't be fully resolved by Pass A alone, because their threshold depends on a mode that doesn't exist until the shared call returns: **T1-01, T1-08, T1-11, and T1b-05's density step.** For these, Pass A records every raw candidate with its position but doesn't decide pass/fail. Once `sections` comes back, Pass B buckets each candidate into whichever section contains it (by position, against the `start` boundaries), then finishes the arithmetic using that section's mode:

- **T1-01** and **T1b-05 (density)** are rate caps ("1 per 500 words," "1 per 150 words") — Pass B computes the candidate count and word count *for that section* and compares the ratio against that section's threshold.
- **T1-08** is a flat per-sentence cap (20/25 words strict, 35 flavored) — no counting needed; Pass B just compares each sentence's already-known word count against whichever number applies to that sentence's section.
- **T1-11** is a flat *per-document* cap ("flag above one"), not word-count-relative, and it does not reset per section. A candidate in a strict section fails immediately, on its own. Candidates in flavored sections share one document-wide budget of one — the first is allowed, every one after it, anywhere in flavored territory, fails.

Zero-tolerance strict-mode candidates need no arithmetic at all: any candidate whose section comes back strict fails the moment Pass B knows that. The counting in Pass B exists only for the flavored "how many is too many" cases.

### Mode classification

Resolved: the model does this, as the first part of the shared call — not a separate pass, not something the person does by hand. It applies modes.md's criteria exactly as written; nothing about what counts as strict vs. flavored changes here, only who applies it and when. Output is the `sections` array in output-schema.md: one entry per section, anchored the same way flags are (a verbatim quote marking where the section starts), holding until the next section's start or the end of the document.

### Tier 1b: which technique, rule by rule

Not one undifferentiated bucket:

| Rule | Technique | Where it runs |
|---|---|---|
| T1b-01 One name per entity | Coreference resolution | Shared call, in full |
| T1b-02 Elegant variation | Coreference resolution | Shared call, in full |
| T1b-03 Nominalization | POS pattern match | Client-side, in full |
| T1b-04 Vague attribution | Regex + proper-noun proximity | Client-side, in full |
| T1b-05 Em dash | Split: count (mechanical) vs. structural/motivation judgment | Density: client-side. Repetition + motivation: shared call, only if density passed |
| T1b-06 Semicolons | Split: clause-independence (parseable) vs. relatedness judgment | Independence: client-side. Relatedness: shared call, only if both sides independent |

T1b-01 and T1b-02 need coreference resolution specifically because the question — do two different phrases refer to the same thing — is semantic, not a tag on one word; there's no cheap client-side substitute. T1b-03 and T1b-04 were classified as Tier 1b originally because they need more than a flat word list, not because they need a model — a lightweight tagger handles both. T1b-05 and T1b-06 each contain one hard mechanical gate that can fail a document with no model involvement, and one judgment call that has no mechanical substitute; treating either as fully client-side or fully model-bound would be wrong in one direction or the other.

### Aggregate rules produce more than one flag

T1-03 (frequency per paragraph), T1-09 and T1-10 (variance floors), T1-11 and T2-07 (frequency caps on decorative use), and T1b-05's density step all fail on a document-wide count or measurement, not on one self-contained span. None of these has a single instance that "is" the violation — the violation is the aggregate.

Rule: when one of these fails, every contributing instance gets its own flag record — its own `span`, the shared `id`/`family`, and a `rationale` stating the aggregate finding, since there is no per-instance justification to give. Five em dashes against a cap of two produce five flag records, not one. The person needs to see all of them to decide which to cut, and the schema requires one record per clickable item regardless of why the rule fired.

## Tier 1 — pattern match

**T1-01 Antithesis** — regex for "not [clause], but [clause]" and variants ("it's not X, it's Y"). Strict: zero allowed. Flavored: flag above 1 per 500 words. Fix: generative, shared call.

**T1-02 Banned vocabulary** — direct match against banned-vocabulary.md. Any hit fails, both modes. Fix: mechanical, table lookup.

**T1-03 Mechanical transitions** — match a fixed list ("Furthermore," "Additionally," "Moreover," "Consequently," "Notably") at paragraph starts. Flag above one instance per three consecutive paragraphs. Does not fire when the transition is adjacent to an actual comparative or causal verb in the same sentence. Fix: mechanical — span covers the transition phrase plus the following word, so `after` is a short real replacement with that word recapitalized (output-schema.md), not an empty deletion.

**T1-04 Markdown/bullet leakage** — flag bold, bullet, or heading syntax inside a section marked as prose rather than a designated list or reference block. Fix: generative, shared call.

**T1-05 "From X to Y"** — regex for `from \w+.*? to \w+.*?` in comprehensiveness-claim position. Flag above one per document. Fix: generative, shared call.

**T1-06 First-word fingerprints** — match a fixed phrase list ("Certainly," "Great question!", "I'd be happy to," "Sure,") at the start of any section. Any hit fails. Fix: mechanical — span covers the fingerprint phrase plus the following word, so `after` is a short real replacement with that word recapitalized (output-schema.md), not an empty deletion.

**T1-07 Hedging stack** — count modal or hedge auxiliaries per sentence ("may," "might," "could," "potentially," "arguably," "it's worth noting," "to some extent"). Flag any sentence with two or more. Fix: generative, shared call — bare deletion usually leaves broken grammar.

**T1-08 Sentence-length cap** — word count per sentence. Strict: fail above 20 words (instruction) or 25 (descriptive). Flavored: flag above 35. Fix: generative, shared call.

**T1-09 Sentence-length variance** — standard deviation of sentence length across a section. Flag if it drops below 4 words over any span of 5+ sentences. Fix: generative, shared call.

**T1-10 List-item length variance** — for lists of four or more items, flag if every item falls within a 20% character-count band of the others. Fix: generative, shared call.

**T1-11 False positivity** — regex for "Despite [negative or limiting clause], [positive reframe]." Strict: zero allowed. Flavored: flag above one per document. Fix: generative, shared call.

**T1-12 Phrasal verbs** — direct match against the phrasal-verb table in banned-vocabulary.md. Any hit fails, both modes. Fix: mechanical, table lookup.

## Tier 1b — mechanical, needs shallow NLP or one bounded judgment call

**T1b-01 One name per entity** — coreference resolution, flag any cluster using two or more distinct head nouns for one entity within a document. Fix: generative, shared call, same pass as detection.

**T1b-02 Elegant variation** — same coreference pass on verbs and adjectives. Flag three or more distinct synonyms describing the same recurring action or quality within roughly one paragraph. Fix: generative, shared call, same pass as detection.

**T1b-03 Nominalization** — POS pattern: light verb ("perform," "conduct," "carry out," "provide," "make") plus a determiner plus a noun ending in a verbal suffix (-tion, -ment, -sis, -ance). Fix: mechanical, table lookup (banned-vocabulary.md); falls back to the shared call only when the nominalized noun isn't in the table.

**T1b-04 Vague attribution** — regex for authority phrases ("studies show," "experts agree," "research indicates") not followed within 15 tokens by a proper noun, date, or link. Flag, never fail. Route to human review. Fix: none, by design — see output-schema.md.

**T1b-05 Em dash** — count paired dashes (an opening and closing `—` with no sentence-ending punctuation between them) as one instance, not two. Run in this order:

1. *Density, client-side, always first.* Count instances per 1,000 words. If it exceeds the cap (strict: 1/300 words; flavored: 1/150 words), every instance in the document fails on density alone — see the aggregate-rules note above. Skip steps 2–3 for this document; no reason to spend the shared call on finer checks once the coarse one has already failed.
2. *Structural repetition, shared call, only if step 1 passed.* If two or more instances share the same surrounding construction — most commonly "[noun phrase]—[elaboration clause]" used as a colon substitute — fail regardless of individual defensibility.
3. *Motivation, shared call, only for what survives 1 and 2.* Does the dash set off a genuine aside — a true interruption that could just as well be commas or parentheses — or is it stacking emphasis with no syntactic role? Fail every reflexive instance.

Fix: mechanical fallback available for density failures — dash replaced with a period or comma, span scoped to include the following word so `after` is a real replacement, not `""`; generative, shared call, for anything failing on repetition or motivation, since a bare substitution reads as awkwardly as the original.

**T1b-06 Semicolons** — for each semicolon:

1. *Independence, client-side.* Are both sides full independent clauses? If either isn't, fail immediately — this is a grammar check, not a judgment call (e.g. "fast; reliable; and easy to use" fails here, no model needed).
2. *Relatedness, shared call, only if step 1 passed.* Are the two clauses related closely enough that splitting into two sentences would lose the connection? Pass if yes — that's the correct, intended use.

Fix: mechanical fallback available for step-1 failures — semicolon replaced with a period, span scoped to include the following word so `after` is a real replacement, not `""`; generative, shared call, for step-2 failures.

## Tier 2 — judgment

**T2-01 Abstraction over specificity**
Flag any claim about a result, benefit, or behavior with no number, unit, or named entity, where one is available.
Judge question: is this abstraction placing weight on a specific result already stated nearby (motivated), or standing in for a concrete fact the writer never supplied (reflexive)? Fail only the second case.

**T2-02 Padding / restatement**
Flag any sentence that restates a claim already made in the same paragraph without adding a new fact, number, or mechanism.
Judge question: if this sentence were deleted, would the reader lose information? If no, fail.

**T2-03 Hedging seesaw**
Flag any "on one hand / on the other hand" structure, or any comparison giving both sides equal weight.
Judge question: does evidence elsewhere in the document already resolve this in one direction? If yes, and the text still both-sides it, fail.

**T2-04 Personifying abstractions**
Flag any sentence where an abstract or inanimate subject (data, system, market, tool) takes a cognition verb (decided, chose, wants, tells, believes).
Judge question: can the verb be replaced with the real mechanism without losing the only concrete fact in the sentence? If yes, fail.

**T2-05 Over-explaining the obvious**
Flag any definition or explanation of a term or concept.
Judge question: given this document's stated or clearly implied audience, would they already know this? If yes, fail.

**T2-06 Restatement disguised as meta-commentary**
Flag any sentence describing the document's own structure ("In this section, we will..." / "In conclusion...").
Judge question: does it preview or review information the reader didn't already have — a real roadmap — or restate what's already stated elsewhere? Fail only the second case. Functional signposting in long technical documents is exempt by default.

**T2-07 Rule of three**
Detect comma- or "and"-joined lists of exactly three parallel items (adjectives, nouns, clauses).
Judge question: are all three items concrete, distinct, named referents — code-formatted tokens, proper nouns, IDs, file or field names — enumerating real things? Or are they descriptive adjectives or abstract nouns characterizing one subject for effect? Fail only the second case (decorative tricolon). Necessary enumeration always passes, both modes. Decorative use: strict, zero allowed; flavored, flag above 1 per 500 words — see the aggregate-rules note above for how a failing document's instances map to flags.

**T2-08 Participial tack-on**
Flag any sentence ending in a present-participle clause ("...cutting deployment time," "...improving reliability").
Judge question: does the rest of the sentence, or the surrounding paragraph, already state or support this claim? Pass if yes, regardless of whether a number is present. Fail only when the clause asserts a benefit or consequence with nothing behind it anywhere in context.

Fix for all of Tier 2: none, by design — see output-schema.md.
