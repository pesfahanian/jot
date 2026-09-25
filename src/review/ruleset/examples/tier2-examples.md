# Tier 2 Examples — Worked Reasoning

These are load-bearing, not illustrative. A judge only produces a consistent verdict once it's seen a full pair with the reasoning attached, not just a rule statement.

**On the "Good" text below:** it's part of the reasoning — it's what makes the distinction between a real violation and a false positive concrete enough for a judge to apply consistently. It is not an `after` value. Per output-schema.md, no Tier 2 flag ever carries a proposed fix; the person resolves it with their own actual context in hand. Read every "Good" line below as "here is what distinguishes a pass from a fail," not "here is what to auto-generate."

## T2-04 Personifying abstractions

Bad: "The pricing engine decided to apply the older batch first."
Nothing decided anything — a FIFO rule executed, deterministically. The sentence sounds confident but hides the fact the reader actually needs: which rule, under what condition.

Good, device used deliberately, passes: "The reconciliation job doesn't forgive a missing batch ID — it halts the whole run."
Still personifying, but it compresses a real, verifiable behavior into something memorable. Swapping the verb for the mechanism ("the job checks for a batch ID and exits nonzero if it's missing") loses nothing factual, and the personified version is the one a reader will actually remember. No fact was hidden to get there.

Rule of thumb: replace the personified verb with the real mechanism. If the sentence loses its only concrete fact, fail. If it just loses color, pass.

## T2-01 Abstraction over specificity

Bad: "The tool offers strong performance characteristics."
No number, no comparison, nothing the reader can act on or verify.

Good: "The tool processes 10,000 rows in 3 seconds on a standard laptop."

Also good, and abstract on purpose: "This is the fastest cache invalidation strategy we tested."
Abstract, but placing weight on a result stated elsewhere in the document — the actual benchmark numbers. It's summarizing, not hiding. Check whether the concrete backing exists nearby before failing an abstraction.

## T2-02 Padding / restatement

Bad: "The migration improves reliability. This means the system becomes more dependable and consistent for users, leading to a more stable overall experience."
Three sentences, one fact.

Good: "The migration improves reliability: reconciliation errors dropped from 40/week to 3/week."

Test: delete the second and third sentences from the bad example. Nothing is lost. That's the fail condition.

## T2-03 Hedging seesaw

Bad: "Some argue the new schema is better for read performance, while others prefer the old schema for its simpler writes. Both have their merits."
If the benchmark data elsewhere in the document already shows the new schema is faster for reads at no meaningful write cost, this sentence manufactures a debate the document's own evidence already settled.

Good: "The new schema is faster for reads. Write performance is unchanged."

Test: does the surrounding document contain evidence that already resolves this? If yes, and the text still both-sides it, fail.

## T2-05 Over-explaining the obvious

Bad, in a doc written for backend engineers: "An API is a set of protocols that allows different software applications to communicate with each other. Our API supports pagination."

Good: "Our API supports pagination."

Test: the stated or implied audience already knows this. Explaining it isn't neutral — it signals the writer doesn't know who's reading, which undercuts trust in the parts of the doc that actually are new information.

## T2-06 Restatement disguised as meta-commentary

Bad: "In conclusion, we have covered the key considerations for this migration and explored the tradeoffs involved."
Says nothing that wasn't already said, once, in the sections it's pointing back at.

Good, exempt as functional signposting: "Section 2 covers the FIFO allocation algorithm. Section 3 benchmarks it against three baseline strategies."
A real roadmap — a reader skimming or citing later needs it, and it carries information (what's specifically in section 3) that a title alone doesn't.

Test: strip the sentence out. Roadmap sentences cost the reader something if removed — they lose the ability to navigate. Restatement sentences cost nothing.

## T1b-02 Elegant variation, worked case

Bad: "The vehicle arrived at the depot. The automobile was unloaded. The car was then inspected."
Three words for one object. A reader has to do extra work confirming these are the same thing — reads as evasive, not varied.

Also bad, for the opposite reason — this is the fix people reach for instead: rewriting "use" five times in a paragraph as "use / utilize / employ / leverage / apply" to avoid repetition. This inflates vocabulary to dodge a structural problem instead of fixing it.

Good: restructure so the predicate doesn't have to fire five times. Combine clauses, use a pronoun, cut the two sentences that didn't need "use" as their main verb at all.

Legitimate exception, not a violation: deliberate repetition for rhythm — "We tested it. We broke it. We fixed it. We shipped it." Repeating the same referent and verb pattern on purpose, for cadence, is not synonym rotation and not elegant variation. It passes because it's motivated, not reflexive.

## T2-07 Rule of three

Bad, decorative: "Fast, reliable, and scalable."
Three adjectives describing one subject, no content behind any of them.

Good, decorative but passes — used once, doing real work, sparingly, in flavored mode: "The migration was fast, clean, and boring — exactly what a database migration should be." The third item lands as the actual point of the sentence, not a filler match for the first two.

Good, necessary enumeration — always passes, regardless of mode: "...dropping `name`, `category`, and `image_url`." Three specific field names, not descriptive filler. This happens to match the rule-of-three shape but is naming three different real things. Failing this would mean rewriting real technical content to dodge a pattern-matcher, which is backwards.

Test: are the three items interchangeable descriptors of one thing, or three different real things that all happen to need naming here? The first is decorative. The second is enumeration.

## T2-08 Participial tack-on

Bad, unsupported: "We migrated the pricing table to FIFO batching, improving reliability and reducing reconciliation errors."
Nothing elsewhere in the document backs either claim — no numbers, no follow-up anywhere. The clause is doing the work a citation should be doing.

Good, grounded even without a number: "The change was written on 2026-06-16 and first reached production on 2026-07-28, breaking the response shape partners depend on."
No number inside the participial clause itself, but the same sentence's main clause already established exactly what broke. The claim is entailed by context that's already there — it doesn't need a number to be verifiable.

Test: could a skeptical reader check this claim against something already stated in the document? If yes, pass, number or not. If the claim exists only inside the participial clause and nowhere else, fail.
