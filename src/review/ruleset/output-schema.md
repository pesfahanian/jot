# Output Schema

Replaces report-template.md. That format produced one aggregated row per rule for a human reading a report. This produces one independent record per flagged instance, for a UI where each instance is its own accept/reject/edit decision. See checks.md's "Execution model" for what produces each part of this — client-side code for most of it, one shared LLM call for the rest.

## Top-level shape

```json
{
  "sections": [
    { "start": "<verbatim quote marking where this section begins>", "mode": "strict" }
  ],
  "flags": [
    {
      "id": "T1-02",
      "family": "tier1",
      "span": "<exact literal text being flagged>",
      "after": "<proposed replacement, or null>",
      "rationale": "<one line, human-readable, why this fired>"
    }
  ]
}
```

## `sections`

One entry per section, produced by the shared call's mode-classification step (checks.md). `start` is a verbatim quote of where the section begins — not a heading name, since not every document has headings — and the section is understood to extend until the next entry's `start` or the end of the document. This reuses the same verbatim-quote anchoring as `flags` rather than inventing a second addressing scheme.

## `flags`

- **`id`** — the rule ID (`T1-01`, `T2-04`, etc.), from RULES.md.
- **`family`** — `tier1`, `tier1b`, or `tier2`. Coarser than `id`; lets the UI group or filter without a lookup table.
- **`span`** — the exact literal text being flagged, quoted verbatim. Jot matches this against the live document to find its real position; a non-matching quote renders as a comment-only note rather than a broken highlight (Jot's existing mechanism — this schema produces input for it, not a new one). Scope the quote to what actually needs to change: a single word or phrase for lexical rules (banned vocabulary, phrasal verbs, nominalization), a full sentence or clause for structural rules (antithesis, sentence-length, semicolons, em dash). Don't quote a whole paragraph when one sentence is the problem.
- **`after`** — the proposed fix. **Three distinct values, not two, matching three distinct UI treatments:**
  - **A non-empty string** — a real proposed replacement for `span`. Present whenever checks.md's Fix: line says mechanical or generative. Renders as strikethrough-old, show-new. For any mechanical fix that deletes something adjacent to a word needing recapitalization (T1-03, T1-06, and the T1b-05/T1b-06 period fallbacks), `span` is scoped to include that following word, so `after` comes out as a short real replacement — e.g. `span: "Certainly, this"`, `after: "This"` — not an empty deletion.
  - **An empty string (`""`)** — reserved for a genuine delete-with-nothing-adjacent-to-fix case. Renders as bare strikethrough, nothing after. Defined and available in this schema, but as RULES.md currently stands, no rule actually emits it: every mechanical deletion in the current 26 sits at a position (sentence-initial, paragraph-initial) where recapitalizing what follows is required, which makes the real fix a short substitution instead. Don't build a UI path assuming some current rule secretly needs `""` — check checks.md's Fix: line first.
  - **`null`** — no fix proposed at all, by design, not an omission. Exactly two cases: every Tier 2 rule, and T1b-04 (vague attribution). Both are judgment calls where a good fix depends on context the model shouldn't guess at. Renders as underline only, no strikethrough.
- **`rationale`** — one line, human-readable, explaining why the flag fired. Required on every record now, not just Tier 2 — a Tier 1 banned-vocabulary flag still gets one ("utilize → use, banned-vocabulary.md"), even though it's the least interesting case. For aggregate rules (checks.md), the rationale states the aggregate finding, not a per-instance justification, since there isn't one.

## Worked example

Source text: *"This document explains our approach. It's not a rewrite, it's a refinement. We utilize a consistent process. The user should check settings; the customer needs to confirm changes. The pricing engine decided to hold the batch."* — treated as one strict section.

```json
{
  "sections": [
    { "start": "This document explains our approach.", "mode": "strict" }
  ],
  "flags": [
    {
      "id": "T1-02",
      "family": "tier1",
      "span": "utilize",
      "after": "use",
      "rationale": "Banned vocabulary — utilize → use (banned-vocabulary.md)."
    },
    {
      "id": "T1-01",
      "family": "tier1",
      "span": "It's not a rewrite, it's a refinement.",
      "after": "It's a refinement of the original.",
      "rationale": "Antithesis construction, zero-tolerance in strict mode."
    },
    {
      "id": "T1b-01",
      "family": "tier1b",
      "span": "the customer needs to confirm changes",
      "after": "the user needs to confirm changes",
      "rationale": "\"The user\" and \"the customer\" refer to the same person two clauses apart. \"The user\" was used first; renamed to match."
    },
    {
      "id": "T2-04",
      "family": "tier2",
      "span": "The pricing engine decided to hold the batch.",
      "after": null,
      "rationale": "Abstract subject (\"the pricing engine\") takes a cognition verb (\"decided\") with no mechanism stated. Swapping the verb for the real rule would show whether this hides a real gap or is just phrasing — left for the writer to resolve with the actual mechanism in hand."
    }
  ]
}
```

## Worked example — mechanical deletion, span scoped to avoid an empty `after`

Source text: *"Certainly, this works as expected."*

```json
{
  "id": "T1-06",
  "family": "tier1",
  "span": "Certainly, this",
  "after": "This",
  "rationale": "First-word fingerprint — deleted, next word recapitalized. Non-empty after by design; see output-schema.md's after field."
}
```

## Worked example — Pass A / Pass B for a mode-dependent rule

A document with one section. Pass A (before the shared call) records a raw T1-01 candidate but no verdict — this intermediate form is internal bookkeeping, not part of the schema in "Top-level shape" above, since it never gets returned to Jot as-is:

```json
{ "id": "T1-01", "family": "tier1", "span": "It's not a rewrite, it's a refinement.", "pending_mode": true }
```

The shared call returns `sections: [{ "start": "This document explains our approach.", "mode": "strict" }]`. Pass B (client-side, no model call) sees the candidate falls in a strict section, applies the zero-tolerance threshold, and finalizes it as a real flag:

```json
{
  "id": "T1-01",
  "family": "tier1",
  "span": "It's not a rewrite, it's a refinement.",
  "after": "It's a refinement of the original.",
  "rationale": "Antithesis construction, zero-tolerance in strict mode."
}
```

Had the section come back flavored instead, and this were the only such candidate in that section, Pass B would drop it — no flag emitted at all, since one instance is within the flavored allowance.

## Worked example — an aggregate failure

Source text (excerpt): four em dashes in a 200-word flavored-mode section, against the 1-per-150-word cap — density fails before repetition or motivation are even checked (checks.md, T1b-05, step 1).

```json
{
  "flags": [
    { "id": "T1b-05", "family": "tier1b", "span": "led the FoodRo vertical — owned architecture end to end",
      "after": "led the FoodRo vertical, owning architecture end to end",
      "rationale": "4 em dashes in 200 words exceeds the flavored-mode cap of 1 per 150 words. Flagged as part of that document-wide count, not for this instance alone." },
    { "id": "T1b-05", "family": "tier1b", "span": "the payments layer — handled every edge case",
      "after": "the payments layer, handling every edge case",
      "rationale": "Same document-wide density failure as above." }
  ]
}
```

Two more instances would produce two more records the same way — one per dash, all citing the same aggregate cause, each independently accept/reject-able.
