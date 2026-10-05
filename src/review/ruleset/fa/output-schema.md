# Output Schema (Farsi)

The same JSON shape as the English guide: one independent record per flagged instance, for a UI where each instance is its own accept/reject/edit decision. See checks.md's "Execution model" for what produces each part: client-side code for most of it, one shared LLM call for the rest. Where this file differs from the English one, the difference is listed first.

## What is different for Farsi

- **IDs** are `FA-T1-nn`, `FA-T1b-nn` and `FA-T2-nn` (RULES.md). `family` keeps the same values (`tier1`, `tier1b`, `tier2`).
- **No proofing flags.** The model does not produce `spelling`, `grammar` or `punctuation` flags for Farsi. Orthography and punctuation are fixed client-side rules with `family: "tier1"` or `"tier1b"`. The shared call is never asked for SPL/GRM/PNC records.
- **`span` is exact, including invisible characters.** Farsi text carries U+200C (ZWNJ, the half-space), U+0654 (the ezafe mark on ه) and sometimes U+200E/U+200F. A quote must reproduce them exactly: `می‌روم` with a half-space does not match `می روم` with a space. Copy characters from the document; never retype them. A quote that does not match is discarded and the flag becomes a comment-only note.
- **`after` is never empty for a mechanical fix.** Farsi has no capitalization, so a deletion scopes `span` to include the next word and `after` is that word unchanged (`span: "البته، این"`, `after: "این"`). Half-space fixes quote the whole word (`span: "کتاب ها"`, `after: "کتاب‌ها"`).
- **`after` is `null` for exactly three cases:** every Tier 2 rule, FA-T1b-07 (loanword) and FA-T1b-08 (vague attribution). All are judgement calls where the fix depends on context the model should not guess.
- **`rationale` is one line in English**, quoting the Farsi text where needed. The interface stays English; only the content is Farsi.
- **No Farsi counterpart** for T1b-05 (em dash) or T1b-06 (semicolons); the `dashes` and `semicolons` parts of the call do not exist.

## Top-level shape

```json
{
  "sections": [
    { "start": "<verbatim quote marking where this section begins>", "mode": "strict" }
  ],
  "flags": [
    {
      "id": "FA-T1-15",
      "family": "tier1",
      "span": "<exact literal text being flagged>",
      "after": "<proposed replacement, or null>",
      "rationale": "<one line, human-readable, why this fired>"
    }
  ]
}
```

## `sections`

One entry per section, produced by the shared call's mode-classification step (checks.md). `start` is a verbatim quote of where the section begins, not a heading name, since not every document has headings, and the section extends until the next entry's `start` or the end of the document. At least six words, or the whole first line.

## `flags`

- **`id`**: the rule ID, from RULES.md.
- **`family`**: `tier1`, `tier1b` or `tier2`. Coarser than `id`.
- **`span`**: the exact literal text being flagged, quoted verbatim. Scope it to what needs to change: a word or phrase for lexical rules (banned vocabulary, officialese, loanwords), a full sentence or clause for structural rules (antithesis, sentence length). Don't quote a whole paragraph when one sentence is the problem.
- **`after`**: the proposed fix. **Three distinct values:**
  - **A non-empty string**: a real replacement for `span`. Renders as strikethrough-old, show-new.
  - **An empty string (`""`)**: reserved for a genuine delete-with-nothing-adjacent-to-fix case. As RULES.md stands, no Farsi rule emits it.
  - **`null`**: no fix proposed, by design. Renders as underline only.
- **`rationale`**: one line, required on every record. For aggregate rules (checks.md), it states the aggregate finding, not a per-instance justification.

## Worked example

Source text, treated as one strict section: *«در دنیای امروز، این سند فرایند انتشار را توضیح می‌دهد. این یک باگ نیست، یک ویژگی است. کاربر باید تنظیمات را بررسی کند و مشتری باید تغییرات را تأیید کند. سامانه تصمیم گرفت دسته را نگه دارد.»*

```json
{
  "sections": [
    { "start": "در دنیای امروز، این سند فرایند انتشار را توضیح می‌دهد.", "mode": "strict" }
  ],
  "flags": [
    {
      "id": "FA-T1-15",
      "family": "tier1",
      "span": "در دنیای امروز، این",
      "after": "این",
      "rationale": "Stock phrase — «در دنیای امروز» is cut (banned-vocabulary.md)."
    },
    {
      "id": "FA-T1-23",
      "family": "tier1",
      "span": "این یک باگ نیست، یک ویژگی است.",
      "after": "این رفتار عمدی است.",
      "rationale": "Antithesis construction, zero-tolerance in strict mode."
    },
    {
      "id": "FA-T1b-09",
      "family": "tier1b",
      "span": "مشتری باید تغییرات را تأیید کند",
      "after": "کاربر باید تغییرات را تأیید کند",
      "rationale": "«کاربر» and «مشتری» name the same person one clause apart. «کاربر» came first; renamed to match."
    },
    {
      "id": "FA-T2-04",
      "family": "tier2",
      "span": "سامانه تصمیم گرفت دسته را نگه دارد.",
      "after": null,
      "rationale": "Abstract subject («سامانه») takes a cognition verb («تصمیم گرفت») with no mechanism stated. Naming the real rule would show whether this hides a gap or is just phrasing — left for the writer to resolve."
    }
  ]
}
```

## Worked example — an orthography fix, span scoped to the whole word

Source text: *«من می روم و کتاب ها را می‌خوانم.»*

```json
{
  "flags": [
    {
      "id": "FA-T1-01",
      "family": "tier1",
      "span": "می روم",
      "after": "می‌روم",
      "rationale": "The prefix «می» is written with a half-space before the verb (Dastur p.39)."
    },
    {
      "id": "FA-T1-02",
      "family": "tier1",
      "span": "کتاب ها",
      "after": "کتاب‌ها",
      "rationale": "A space before the plural «ها»; the half-space joins them (Dastur p.40)."
    }
  ]
}
```

## Worked example — mechanical deletion, span scoped to avoid an empty `after`

Source text: *«البته، این کار می‌کند.»*

```json
{
  "id": "FA-T1-17",
  "family": "tier1",
  "span": "البته، این",
  "after": "این",
  "rationale": "Stock opener at a section start — removed, next word kept. Non-empty after by design; see output-schema.md's after field."
}
```

## Worked example — Pass A / Pass B for a mode-dependent rule

A document with one section. Pass A (before the shared call) records a raw FA-T1-23 candidate but no verdict. This intermediate form is internal bookkeeping, not part of the schema above:

```json
{ "id": "FA-T1-23", "family": "tier1", "span": "این یک باگ نیست، یک ویژگی است.", "pending_mode": true }
```

The shared call returns `sections: [{ "start": "...", "mode": "strict" }]`. Pass B sees the candidate in a strict section, applies the zero-tolerance threshold, and finalizes it as a real flag with `after`. Had the section come back flavoured and this been the only such candidate, Pass B would drop it: one instance is within the flavoured allowance.

## Worked example — an aggregate failure

Source text: *«در ۳ مرحله، ۵ بخش و 7 فایل کار کنید.»* Two numbers use Persian digits and one uses Latin, so the Latin digit is the minority (FA-T1b-02). Had two or more minority numbers appeared, each would have its own flag record with the same rationale.

```json
{
  "id": "FA-T1b-02",
  "family": "tier1b",
  "span": "7",
  "after": "۷",
  "rationale": "Digits are mixed: 2 of 3 numbers use Persian digits, 1 uses Latin. Flagged against the dominant system as part of that document-wide count, not for this instance alone."
}
```
