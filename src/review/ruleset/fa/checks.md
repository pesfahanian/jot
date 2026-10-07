# Checks (Farsi)

How each rule in RULES.md is actually verified. Tier 1 and 1b: detection methods precise enough to implement as a script, with the exact pattern and test strings. Tier 2: the exact procedure an LLM judge applies. The judge sees this text directly, not a summary of it.

<!-- client:start -->

**Two audiences, one file.** Everything between a `client:start` and a `client:end` HTML comment is for the developer implementing the client-side checks and for the test suite: patterns, algorithms and test strings. The build strips those blocks before it sends this file to the model; what remains is what the judge needs. This paragraph is one of them. To strip:

```js
const OPEN = '<!-- client:' + 'start -->'
const CLOSE = '<!-- client:' + 'end -->'
const forModel = (md) => md.split(OPEN).map((part, i) => (i ? part.slice(part.indexOf(CLOSE) + CLOSE.length) : part)).join('')
```

<!-- client:end -->

**Sources.** Orthography follows the Academy of Persian Language and Literature's *Dastur-e Khatt-e Farsi* (دستور خط فارسی), new edition, Tehran 1401/2022 (page numbers below are that edition's), and Virastar's conventions (MIT, `brothersincode/virastar`). The Dastur does not cover punctuation (its preface, point 3, says so), so the punctuation rules rest on Virastar and ordinary Persian typesetting practice, not on an Academy text. Persian ی and ک are the Academy's letters (Dastur, Table 1, p.29–33); digit and Arabic-letter normalisation follows Virastar.

## Execution model

Three places this runs, same as the English guide. One thing differs: **orthography is never the model's job.**

**Client-side, Pass A: raw detection, before the shared call.** All of Tier 1 (orthography and style) and Tier 1b FA-T1b-01 to FA-T1b-08 in full: pass or fail is decided here, and `after` is produced here wherever the fix is a table lookup or a safe deterministic transform. For the three mode-dependent rules (FA-T1-20, FA-T1-23, FA-T1-25) this pass records raw candidates and positions only, because their threshold depends on a mode that does not exist yet.

**One shared LLM call, once per document, after Pass A.**
- Mode classification for every section: always included, resolved first.
- FA-T1b-09 in full (coreference has no client-side substitute).
- All of Tier 2, detection and rationale together.
- Fix generation for the Tier 1 rules detected deterministically but needing rewriting, not substitution: FA-T1-18, FA-T1-19, FA-T1-20, FA-T1-21, FA-T1-22, FA-T1-23, FA-T1-24, FA-T1-25. Also FA-T1-15 and the FA-T1b table rules whose table entry gives guidance instead of a replacement.
- **Not in the Farsi call:** the spelling/grammar/punctuation proofing pass, and the em-dash and semicolon follow-ups. Current models are unreliable on formal Persian orthography and grammar, so every objective error here is a fixed rule instead.

**Client-side, Pass B: mode reconciliation, after the shared call returns.** Local arithmetic only. Finalizes the three mode-dependent rules and the T2-07 frequency cap. See below.

**Never re-decided by the model:** whether a Tier 1 or mechanical Tier 1b rule fired. The shared call only writes prose where prose is genuinely the job.

### Two-pass reconciliation for mode-dependent rules

- **FA-T1-20** is a flat per-sentence cap: strict 25 words (instruction) or 30 (descriptive); flavoured 40, soft. Pass B compares each candidate sentence's word count with the cap for its section's mode.
- **FA-T1-23** (antithesis): strict, zero allowed; flavoured, flag above one per 500 words in that section.
- **FA-T1-25** (despite-X): strict, zero allowed; flavoured, one per document, shared across all flavoured sections.
- **FA-T2-07** (decorative triplets): the model reports every instance; Pass B applies strict zero or flavoured one per 500 words.

Zero-tolerance strict candidates need no arithmetic: any candidate in a strict section fails once its mode is known.

### Mode classification

The model does this as the first part of the shared call, applying modes.md exactly as written. Output is the `sections` array in output-schema.md: one entry per section, anchored by a verbatim quote of where it starts.

### Tier 1b: which technique, rule by rule

| Rule | Technique | Where it runs |
|---|---|---|
| FA-T1b-01 Half-space before تر | Pattern + guard words | Client-side, in full |
| FA-T1b-02 Mixed digits | Count + dominant-system rule | Client-side, in full |
| FA-T1b-03 Ezafe `ه‌ی` | Pattern | Client-side, in full |
| FA-T1b-04 Stiff officialese | Table + guard | Client-side, in full |
| FA-T1b-05 Light-verb padding | Verb generator + table | Client-side, in full |
| FA-T1b-06 Synonym doublets | Table | Client-side, in full |
| FA-T1b-07 Loanwords | Table | Client-side, in full |
| FA-T1b-08 Vague attribution | Regex + proximity | Client-side, in full |
| FA-T1b-09 One name per entity | Coreference | Shared call, in full |

### Aggregate rules produce more than one flag

FA-T1-16, FA-T1-21, FA-T1-22, FA-T1-23, FA-T1-24, FA-T1-25, FA-T1b-02 and FA-T2-07 fail on a document-wide count or measurement. When one fails, every contributing instance gets its own flag record, with the shared `id`/`family` and a `rationale` stating the aggregate finding.

### How a fix is scoped

- **`after` is never empty.** A mechanical fix that deletes something scopes `span` to include the neighbouring word, so `after` is a short real replacement. Farsi has no capitalization, so the following word is copied unchanged: `span: "در این راستا ما"`, `after: "ما"`. When the deleted phrase is followed by a comma (`،`), the span includes it.
- **Spans include the host word.** A half-space fix quotes the word and its ending together (`کتاب ها` → `کتاب‌ها`), so the reader sees a real before and after instead of an invisible character.
- **Invisible characters are literal in `after`.** The half-space is U+200C and the ezafe mark on ه is U+0654, written into `after` as themselves.

<!-- client:start -->

## Shared definitions (client-side)

Patterns below are JavaScript `RegExp` source with the `u` flag. JavaScript's `\b` does not see Arabic-script letters, and ZWNJ (U+200C) is not a letter, so every pattern builds its own Farsi word boundaries from these constants.

```js
const Z  = '‌'                                         // ZWNJ, the half-space
const L  = 'ء-غف-يٱ-ۓە'  // Arabic-script letters (Persian and Arabic)
const M  = 'ً-ٰٟ'                            // diacritics, including U+0654 (ezafe hamza)
const W  = `${L}${M}${Z}`                                   // characters that can sit inside a Farsi word
const WB = `(?<![${W}])`                                    // start of a Farsi word
const WE = `(?![${W}])`                                     // end of a Farsi word
```

**Masked text.** Pass A runs every pattern on `masked` (code, URLs, link targets, raw HTML and math blanked to spaces, as in the English guide). **A match is discarded if any character of its span differs in the original `text`**, so a space that exists only because code was blanked can never be flagged or "fixed" (`` (`code` سلام) `` must not lose its space).

**Normalised copy for matching.** Table lookups (banned-vocabulary.md) compare against a copy with Arabic ي ى ك mapped to ی ی ک, one character for one, so offsets stay valid.

**Words.** A word is a run of letters, digits and marks, and **ZWNJ joins**: `می‌روم` is one word. The English `countWords` splits it in two, so Farsi needs its own:

```js
const WORD_FA = /[\p{L}\p{N}][\p{L}\p{N}\p{M}‌'’_-]*/gu
```

**Sentences.** A sentence ends at `. ! ? ؟ …` plus closing quotes or brackets, followed by whitespace or the end of the block. A `.` between two digits (Latin or Persian) is not a sentence end. `؛` and `:` are not.

```js
const SENT_END = /[.!?؟…]+["»”')\]]*(?=\s|$)/gu
```

**Farsi sentence.** A sentence with **two or more Farsi words** (a word whose first character is in `L`). English terms, code and URLs inside it are normal and never change this. A quotation inside `«…»`, `"…"` or `“…”` is its own unit: a Farsi sentence quoting English stays Farsi, and the English inside the quote is not checked. Rules marked "in a Farsi sentence" (FA-T1-08, FA-T1-09, FA-T1-10, FA-T1b-02) skip everything else.

**Arabic unit.** Quoted Arabic must never be "corrected" into Persian. A unit (the text inside one pair of quotes, or a blockquote paragraph, or otherwise a sentence) is Arabic when it has an Arabic-only marker and no Persian signal:

```js
const arabicMarker  = /[ً-ْ]|ة|(?<![ء-ي])ال[ء-ي]{2,}/u      // tashkeel, ة, ال-words
const persianSignal = new RegExp(`[پچژگکی]|${WB}(?:را|است|این|که|می)${WE}`, 'u')       // پ چ ژ گ, Persian ک ی, Persian function words
const isArabicUnit  = (s) => arabicMarker.test(s) && !persianSignal.test(s)
```

FA-T1-06, FA-T1-07 and FA-T1-12 skip Arabic units. Arabic embedded in a Farsi sentence without quotes or a blockquote is not detected and will be flagged; the person dismisses it.

**Verb forms.** The verb generator turns an infinitive from the "Verb stems" table (banned-vocabulary.md) into every form the rules need, keyed by tense and person, so a replacement verb can be conjugated to match the one it replaces. Present endings `P = [م, ی, د, یم, ید, ند]`, past endings `Q = [م, ی, ∅, یم, ید, ند]`, perfect endings `C = [ام, ای, است, ایم, اید, اند]`. The present stem already includes the glide letter for vowel-final stems (`گوی`, `آی`).

| Form | Template (person endings in order) |
|---|---|
| past | `[ن]` past + Q |
| imperfect | `[ن]می‌` past + Q |
| present | `[ن]می‌` present + P |
| subjunctive | `ب` present + P, negative `ن` present + P |
| perfect | `[ن]` past + `ه‌` + C |
| future | `[ن]خواه` + P, space, past |
| participle | past + `ه` |
| imperative | `ب` present, `ب` present + `ید` |

Stems beginning with آ or ا change their `ب-` prefix (`بیاموز`, `بینداز`); the replacement verbs this guide uses (`کردن`, `شدن`, `دادن`) never do.

##### Verb generator tests (swapping a banned verb for its replacement, same tense and person)

| Input | Result |
|---|---|
| `او اقدام نمود و آنها اقدام نمودند` (نمودن → کردن) | `نمود` → `کرد`; `نمودند` → `کردند` |
| `می‌نماید و نمی‌نمایند` | `می‌نماید` → `می‌کند`; `نمی‌نمایند` → `نمی‌کنند` |
| `نموده‌اند` | `نموده‌اند` → `کرده‌اند` |
| `بنمایید` | `بنمایید` → `بکنید` |
| `انجام گردید و می‌گردد` (گردیدن → شدن) | `گردید` → `شد`; `می‌گردد` → `می‌شود` |
| `خواهد نمود` | `خواهد نمود` → `خواهد کرد` |
| `نمودار و نمودن` | `نمودار` is a different word: no flag for it |

<!-- client:end -->

## Tier 1 — orthography and typography

All mode-independent. Every fix is mechanical and non-empty. Each one is a suggestion; nothing auto-applies.

**FA-T1-01 Half-space after می / نمی / همی** — the imperfective prefixes are always written with a half-space from the verb (Dastur p.39): `می‌روم`, `نمی‌دانیم`, `برمی‌دارد`. A space (`می روم`) and no gap (`میروم`) are both wrong. Detection is closed-set: the prefix must be followed by a conjugated form of a verb in the "Verb stems" table, which keeps nouns like `میز`, `میدان` and `میوه` out. Only formal conjugations are recognised; colloquial `می خوام` is not caught. Fix: mechanical, the span covers the prefix and the verb, `after` is the same pair joined by a ZWNJ.

<!-- client:start -->

Build `VERBFORM` from the "Verb stems" table: all present stems joined by `|` as `PRES`, all past stems as `PAST`.

```js
const VERBFORM = `(?:(?:${PRES})(?:م|ی|د|یم|ید|ند)|(?:${PAST})(?:م|ی|یم|ید|ند|))${WE}`
const R01 = new RegExp(`${WB}((?:بر|در|باز|فرا|فرو|وا)?ن?می)([ ${Z}]?)(?=${VERBFORM})`, 'gu')
```

Skip a match whose separator (group 2) is already `Z`. Group 1 may carry a preverb (`برمی‌دارد`). `after` = group 1 + `Z` + the verb token that follows. The wine word `می` followed by a verb-shaped word (`می خورد`) is a known false positive; the person dismisses it.

##### FA-T1-01 tests — half-space after می / نمی / همی

| Input | Result |
|---|---|
| `من می روم` | flags `می روم` → `می‌روم` |
| `او میرود` | flags `میرود` → `می‌رود` |
| `ما نمی دانیم` | flags `نمی دانیم` → `نمی‌دانیم` |
| `آنها برمیدارند` | flags `برمیدارند` → `برمی‌دارند` |
| `او می گفت` | flags `می گفت` → `می‌گفت` |
| `او می‌رود` | no flag — already correct |
| `میز و میدان و میوه` | no flag — nouns, not verbs |
| `` از `می روم` استفاده کنید `` | no flag — inside code |
| `به https://example.com/میروم بروید` | no flag — inside a URL |
| `the word میرزا is a name` | no flag — name |


<!-- client:end -->

**FA-T1-02 Half-space before the plural «ها»** — the Academy accepts both joined and half-spaced plurals (`کتابها`, `کتاب‌ها`) and recommends the half-space (Dastur p.40); the half-space is **mandatory** after a silent ه and a ه preceded by a connecting letter, after foreign words, and in a few other cases (p.41: `خانه‌ها`, `ویتامین‌ها`). This rule flags only what is never acceptable: (a) a space between a word and `ها`, `های`, `هایی`, `هایم`… (`کتاب ها`); (b) a joined `ها` after a ه preceded by a letter other than ا or و (`خانهها`). A joined plural elsewhere (`کتابها`) is allowed and never flagged. Fix: mechanical, the span covers the word and its ending.

<!-- client:start -->

```js
const HA  = '(?:ها(?:ی(?:ی|م|ت|ش|مان|تان|شان)?)?)'
const R02a = new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (${HA})${WE}`, 'gu')                       // a space before ها
const R02b = new RegExp(`${WB}([${W}]*[${L}](?<![اآو])ه)(${HA})${WE}`, 'gu')     // joined after a silent-type ه
```

`after` = group 1 + `Z` + the ending. The host may be a Latin word (`API ها` → `API‌ها`). ه after ا/و is skipped because it is usually pronounced and joined is then allowed (`ماهها`, `کوهها`, Dastur p.40).

##### FA-T1-02 tests — half-space before the plural «ها»

| Input | Result |
|---|---|
| `این کتاب ها خوب‌اند` | flags `کتاب ها` → `کتاب‌ها` |
| `خانهها و میوه‌ها` | flags `خانهها` → `خانه‌ها` |
| `کتاب های من` | flags `کتاب های` → `کتاب‌های` |
| `این API ها مهم‌اند` | flags `API ها` → `API‌ها` — after a foreign word the half-space is mandatory |
| `ده ها نفر` | flags `ده ها` → `ده‌ها` |
| `کتابها و ماهها و کوهها` | no flag — joined is allowed by the Academy; ماه/کوه end in a pronounced ه after ا / و |
| `کتاب‌ها` | no flag — already correct |
| `او گفت: ها` | no flag — the interjection, no host word |
| `` از `کتاب ها` بخوانید `` | no flag — inside code |


<!-- client:end -->

**FA-T1-03 Half-space before «ترین»** — as for `ها`, the Academy accepts joined or half-spaced and recommends the half-space (p.40); only the **space** is flagged. The six comparatives that are always written as one word (`بهترین`, `بیشترین`, `کمترین`, `کهترین`, `مهترین`, `کلانترین`) take no half-space; a spaced `به ترین` becomes `بهترین`. Fix: mechanical.

<!-- client:start -->

```js
const R03 = new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (ترین)${WE}`, 'gu')
```

`after` = group 1 + group 2 joined, if group 1 is a stem in "Comparatives always written joined"; otherwise group 1 + `Z` + group 2.

##### FA-T1-03 tests — half-space before «ترین»

| Input | Result |
|---|---|
| `بزرگ ترین شهر` | flags `بزرگ ترین` → `بزرگ‌ترین` |
| `به ترین راه` | flags `به ترین` → `بهترین` — the Academy's always-joined comparatives take no half-space |
| `بزرگترین شهر` | no flag — joined is allowed |
| `بزرگ‌ترین شهر` | no flag — already correct |


<!-- client:end -->

**FA-T1-04 Half-space before clitics and the indefinite «ی» after a silent ه** — after a silent ه, the pronoun clitics `ام ات اش مان تان شان`, the copula forms `ای ایم اید اند` and the indefinite ی (`ای`) take a half-space: `خسته‌ام`, `آمده‌اند`, `خانه‌ای`, `خانه‌شان` (Dastur p.43–44). Flags (a) a space before one of them after a word ending in ه, and (b) a joined `ام/ای/ایم/اید/اند` on a past participle (a word ending in `ده` or `ته`, such as `کردهام`). The joined case is limited to participles on purpose: ordinary words end in `هام` (`ابهام`, `الهام`, `اتهام`). A joined noun (`خانهام`) is not caught. Words `که`, `چه`, `به` never host a clitic. Fix: mechanical.

<!-- client:start -->

```js
const CL  = '(?:ام|ای|ایم|اید|اند|ات|اش|مان|تان|شان)'
const R04a = new RegExp(`${WB}([${W}]*ه) (${CL})${WE}`, 'gu')                          // spaced; skip hosts که چه به
const R04b = new RegExp(`${WB}([${W}]*[دت]ه)(ام|ای|ایم|اید|اند)${WE}`, 'gu')          // joined participle
```

`after` = group 1 + `Z` + the clitic. Skip R04b when group 1 is exactly `اته` (the word `اتهام`, "accusation").

##### FA-T1-04 tests — half-space before pronoun clitics and the indefinite «ی» after a silent ه

| Input | Result |
|---|---|
| `من خسته ام` | flags `خسته ام` → `خسته‌ام` |
| `خانه ای دیدم` | flags `خانه ای` → `خانه‌ای` |
| `آمده اند` | flags `آمده اند` → `آمده‌اند` |
| `خانه شان بزرگ است` | flags `خانه شان` → `خانه‌شان` |
| `کردهام و نوشتهاند` | flags `کردهام` → `کرده‌ام`; flags `نوشتهاند` → `نوشته‌اند` — joined participle + clitic |
| `کرده‌ام` | no flag — already correct |
| `اتهام و ابهام و الهام` | no flag — real words ending in هام |
| `خسته است` | no flag — است is a separate word |
| `او گفت: ای خدا` | no flag — vocative «ای» |


<!-- client:end -->

**FA-T1-05 Ezafe after a silent ه written with a space** — the ezafe after a silent ه is written `ۀ` or `هٔ` (Dastur p.46): `خانهٔ من`, `برنامهٔ روزانه`. `خانه ی من` (a detached ی) is a typing slip. Fix: mechanical, `ه` + U+0654. The one-character form `ۀ` (U+06C0) is also the Academy's and is **not** flagged.

<!-- client:start -->

```js
const R05 = new RegExp(`${WB}([${W}]*ه) ی(?= [${L}])`, 'gu')                           // skip hosts که چه به
```

`after` = group 1 + `ٔ`.

##### FA-T1-05 tests — ezafe after a silent ه written with a space

| Input | Result |
|---|---|
| `خانه ی من` | flags `خانه ی` → `خانهٔ` |
| `نامه ی رسمی` | flags `نامه ی` → `نامهٔ` |
| `خانهٔ من` | no flag — already the Academy form |


<!-- client:end -->

**FA-T1-06 Arabic letters for Persian** — Arabic ي (U+064A), ى (U+0649) and ك (U+0643) written where Persian has ی (U+06CC) and ک (U+06A9). Skips Arabic units. Fix: mechanical, one character for one.

<!-- client:start -->

```js
const R06 = /[يىك]/g          // → ی, ی, ک, skipping Arabic units
```

##### FA-T1-06 tests — Arabic ي ى ك for Persian ی ک

| Input | Result |
|---|---|
| `علي و كتاب` | flags `ي` → `ی`; flags `ك` → `ک` |
| `او گفت كتاب را بخوان` | flags `ك` → `ک` |
| `علی و کتاب` | no flag — already Persian |
| `قال الله تعالى في كتابه` | no flag — an Arabic sentence: Arabic-only markers, no Persian signal |
| `او گفت «الكتاب هو الكتاب» و رفت` | no flag — an Arabic quotation inside «» |


<!-- client:end -->

**FA-T1-07 Arabic-Indic digits** — ٠–٩ (U+0660–0669) written instead of Persian ۰–۹ (U+06F0–06F9). The two sets differ on 4, 5 and 6, so map by value. Skips Arabic units. Fix: mechanical.

<!-- client:start -->

```js
const R07 = /[٠-٩]+/g              // each digit → String.fromCharCode(c - 0x0660 + 0x06F0)
```

##### FA-T1-07 tests — Arabic-Indic digits

| Input | Result |
|---|---|
| `در سال ١٤٠١ بود` | flags `١٤٠١` → `۱۴۰۱` |
| `در سال ۱۴۰۱ بود` | no flag — already Persian |
| `قال الله ١٢٣` | no flag — an Arabic sentence |


<!-- client:end -->

**FA-T1-08 Latin punctuation in a Farsi sentence** — `,` `;` `?` where Persian uses `،` `؛` `؟`. Applies in a Farsi sentence only, so English text and quoted English are untouched, and English terms inside a Farsi sentence do not stop it applying (`از React, Vue و Svelte`). `,` between digits (`1,000`) is a number, not punctuation. Fix: mechanical, one character.

<!-- client:start -->

```js
const R08 = /(?<!\d),(?!\d)|;(?![^\s&]*;)|\?/g     // `;` is skipped when it ends an HTML entity (&amp;)
```

`after`: `,` → `،`, `;` → `؛`, `?` → `؟`.

##### FA-T1-08 tests — Latin , ; ? in a Farsi sentence

| Input | Result |
|---|---|
| `سلام, دنیا` | flags `,` → `،` |
| `چه خبر?` | flags `?` → `؟` |
| `اول; بعد` | flags `;` → `؛` |
| `از React, Vue و Svelte` | flags `,` → `،` — a Farsi sentence even with English terms: it has 2+ Farsi words |
| `قیمت 1,000 تومان` | no flag — thousands separator |
| `He said hello, and left?` | no flag — an English sentence |
| `او گفت "Hello, world" و رفت` | no flag — a quoted English phrase is its own unit |
| `The word سلام, means hello?` | no flag — one Farsi word: an English sentence |
| `` از `f(a, b)` استفاده کنید `` | no flag — inside code |
| `a &amp; b سلام` | no flag — an HTML entity |


<!-- client:end -->

**FA-T1-09 Spacing around punctuation** — in a Farsi sentence: no space before `، ؛ ؟ ! : .`; a space after `، ؛ ؟` when a word follows; no space just inside `(` `[` `«` or `)` `]` `»`. Digits (`۱۰:۳۰`, `۱.۵`), filenames (`README.md`) and Latin words keep their own punctuation. The matched whitespace must be real whitespace in `text`, not blanked code. Source: Virastar (`fix_spacing_for_punctuations`); the Dastur does not cover punctuation. Fix: mechanical.

<!-- client:start -->

```js
const R09a = new RegExp(`(?<=[${L}${M}\\p{N}»)\\]]) +([،؛؟!:.])(?=\\s|$)`, 'gu')   // space before: remove
const R09b = new RegExp(`(?<=[${L}${M}])([،؛؟])(?=[${L}\\p{N}])`, 'gu')            // none after: add one space
const R09c = new RegExp(`([(\\[«]) +(?=[${L}\\p{N}])`, 'gu')                         // space inside an opener: remove
const R09d = new RegExp(`(?<=[${L}${M}\\p{N}!؟.،]) +([)\\]»])`, 'gu')               // space inside a closer: remove
```

`after`: a, c, d replace the span by the bracket or mark alone; b replaces `،` with `، `.

##### FA-T1-09 tests — spacing around punctuation and brackets

| Input | Result |
|---|---|
| `سلام ، دنیا` | flags ` ،` → `،` |
| `چه خبر ؟` | flags ` ؟` → `؟` |
| `سلام،دنیا` | flags `،` → `، ` |
| `این ( مثال ) است` | flags `( ` → `(`; flags ` )` → `)` |
| `او گفت « سلام »` | flags `« ` → `«`; flags ` »` → `»` |
| `ساعت ۱۰:۳۰ شد` | no flag — a time |
| `نسخهٔ ۱.۵ آمد` | no flag — a decimal |
| `فایل README.md را ببین` | no flag — a filename |
| `` (`code` سلام) بود `` | no flag — the space after ( is a blanked code span, not a real space |


<!-- client:end -->

**FA-T1-10 Quotation marks** — straight `"…"` and curly `“…”` double quotes in a Farsi sentence become `«…»`, including around English terms (`«React»`). A paragraph with an odd number of `"` has no safe pairing and is skipped entirely. Nested quotes are skipped. Fix: mechanical, the span is the whole quoted phrase.

<!-- client:start -->

```js
const R10a = /"([^"\n]{1,200}?)"/g       // only if the paragraph has an even number of " ; content or lead-in has Farsi
const R10b = /“([^“”\n]{1,200}?)”/g
```

`after` = `«` + group 1 + `»`.

##### FA-T1-10 tests — straight or curly double quotes

| Input | Result |
|---|---|
| `او گفت "سلام" و رفت` | flags `"سلام"` → `«سلام»` |
| `او گفت “سلام” و رفت` | flags `“سلام”` → `«سلام»` |
| `کلمهٔ "React" معروف است` | flags `"React"` → `«React»` — an English term inside a Farsi sentence is quoted with « » |
| `او گفت "سلام و رفت` | no flag — unbalanced: no safe pairing, nothing flagged |
| `He said "hello" and left` | no flag — an English sentence |
| `` از `"x"` استفاده کنید `` | no flag — inside code |


<!-- client:end -->

**FA-T1-11 Doubled spaces** — two or more spaces or tabs between non-space characters inside a prose line. Not leading indentation, and not the two trailing spaces that mean a markdown line break. Fix: mechanical, one space.

<!-- client:start -->

```js
const R11 = /(?<=\S)[ \t]{2,}(?=\S)/g
```

##### FA-T1-11 tests — doubled spaces

| Input | Result |
|---|---|
| `سلام  دنیا` | flags `  ` → ` ` |
| `  سلام دنیا` | no flag — leading indentation |
| `سلام دنیا  
خط بعد` | no flag — two trailing spaces are a markdown line break |
| `` از `a  b` استفاده `` | no flag — inside code |


<!-- client:end -->

**FA-T1-12 Kashida** — the elongation mark ـ (U+0640). Between letters it is removed; standing alone between spaces it is a stand-in for a dash and becomes `–` (Virastar, `kashidas_as_parenthetic`). Skips Arabic units. Fix: mechanical; the between-letters case scopes the span to include the neighbouring letters so `after` is not empty.

<!-- client:start -->

```js
const R12a = new RegExp(`([${L}${M}])ـ+(?=[${L}${M}])`, 'gu')    // span = the letter, the kashida and the next letter
const R12b = /(?<=\s)ـ+(?=\s)/g                                   // → –
```

##### FA-T1-12 tests — kashida

| Input | Result |
|---|---|
| `سلاـم` | flags `اـم` → `ام` |
| `این ـ مثال ـ است` | flags `ـ` → `–`; flags `ـ` → `–` — a spaced kashida used as a dash |
| `سلام` | no flag — no kashida |
| `قال الله ٱلرَّحْـمَـٰنِ ٱلرَّحِيمِ` | no flag — an Arabic sentence (tashkeel, ال-words): kashida is original orthography |


<!-- client:end -->

**FA-T1-13 Stray half-space** — a ZWNJ is correct only between a letter, digit or Latin letter on its left and an Arabic-script letter on its right. It is stray when doubled, when it touches a space, punctuation or the edge of a line, or when a Latin letter follows it. Fix: mechanical; the span includes the neighbouring characters, so `after` is never empty.

<!-- client:start -->

```js
const R13 = new RegExp(`${Z}{2,}|(?<![${L}${M}A-Za-z\\p{N}])${Z}(?!${Z})|(?<!${Z})${Z}(?![${L}])`, 'gu')
```

A doubled ZWNJ becomes one. Any other match: `span` = the previous character (if any) + `Z` + the next character (if any), `after` = the same without `Z`. ZWNJ next to a digit on the right is **not** flagged (ordinals like `۱۰‌ام` are written both ways).

##### FA-T1-13 tests — stray half-space (ZWNJ)

| Input | Result |
|---|---|
| `سلام‌ دنیا` | flags `م‌ ` → `م ` |
| `می‌‌روم` | flags `‌‌` → `‌` |
| `‌سلام` | flags `‌س` → `س` |
| `سلام‌.` | flags `م‌.` → `م.` |
| `می‌React` | flags `ی‌R` → `یR` |
| `می‌روم` | no flag — a real half-space |
| `API‌ها` | no flag — Latin word + half-space + Farsi: legitimate |


<!-- client:end -->

**FA-T1-14 Mis-spaced words** — a word on the closed list in banned-vocabulary.md ("Orthography slips") written the wrong way: `بطور` for `به‌طور`, `بنابر این` for `بنابراین`, `رییس` for `رئیس`. Every entry has an exact standard form from the Dastur. Fix: mechanical, table lookup.

<!-- client:start -->

Match each "Wrong" cell against the normalised copy with the Farsi word boundaries; a space in an entry matches a space or a ZWNJ. The span is the matched text; `after` is the "Standard" cell. A whole Farsi word is flagged even next to English text.

##### FA-T1-14 tests — mis-spaced words

| Input | Result |
|---|---|
| `من بطور کامل موافقم` | flags `بطور` → `به‌طور` |
| `بنابر این نتیجه` | flags `بنابر این` → `بنابراین` |
| `رییس شرکت` | flags `رییس` → `رئیس` |
| `او به‌طور کامل موافق بود` | no flag — already correct |
| `` از `بطور` استفاده کنید `` | no flag — inside code |
| `the variable name بطور is a label` | flags `بطور` → `به‌طور` — a whole Farsi word is flagged even among English |


<!-- client:end -->

## Tier 1 — style

**FA-T1-15 Banned vocabulary** — direct match against banned-vocabulary.md: the AI-tell words and stock phrases, the marketing adjectives, the officialese verbs (`نمودن`, `گردیدن`, matched in every tense) and the officialese forms of "to be" (`می‌باشد`). Any hit fails, both modes. Fix: mechanical for table replacements and `(cut)`; a parenthetical that gives guidance instead of a word rides the shared call.

<!-- client:start -->

Match as described in banned-vocabulary.md. A replacement entry: `after` is the replacement. A `(cut)` entry: the span covers the phrase, an optional `،` and the next word, and `after` is that next word; if no next word follows in the sentence, request a rewrite instead. A guidance entry: request a rewrite of the span for the shared call. Verb rows (`نمودن`, `گردیدن`) are matched through the verb generator and replaced with the same tense and person of the replacement verb.

##### FA-T1-15 tests — banned vocabulary (replace, cut, rewrite)

| Input | Result |
|---|---|
| `این روش حائز اهمیت است` | flags `حائز اهمیت` → `مهم` — a table replacement |
| `در دنیای امروز، نرم‌افزار مهم است` | flags `در دنیای امروز، نرم‌افزار` → `نرم‌افزار` — a cut: the span runs through the comma and the next word, so `after` is never empty |
| `او گفت: در این راستا ما کار می‌کنیم` | flags `در این راستا ما` → `ما` |
| `این ابزار قدرتمند است` | flags `قدرتمند`, fix by rewrite (state the number or capability) — guidance only: the fix is a rewrite for the shared call |
| `بی شک این درست است` | flags `بی شک این` → `این` — a space for the entry's ZWNJ still matches |
| `او كار واکاوی کرد` | flags `واکاوی` → `بررسی` — matching happens on the ي/ك-normalised copy |
| `` از `در دنیای امروز` بخوانید `` | no flag — inside code |
| `دنیای امروز پیچیده است` | no flag — only the full phrase is banned |


<!-- client:end -->

**FA-T1-16 Stock transitions** — a transition from the "Stock transitions" list at the start of a paragraph. Flag above one instance per three consecutive paragraphs. Does not fire when the same sentence contains a real comparative or causal verb (`باعث`, `منجر`, `افزایش`, `کاهش`, `بیشتر از`…): the transition is then doing work. Fix: mechanical, the span covers the transition plus the following word, so `after` is that word.

<!-- client:start -->

Compare against the first sentence of each `paragraph` block (`prose.blocks`, kind `paragraph`). Causal check: `/باعث|منجر|موجب|افزایش|کاهش|بهبود|بیشتر از|کمتر از|سریع‌تر از/u` on that sentence.

##### FA-T1-16 tests — stock transitions

| Input | Result |
|---|---|
| `علاوه بر این، سرور سریع است. ⏎ همچنین، کد ساده است. ⏎ متن عادی.` | flags `علاوه بر این، سرور` → `سرور`; flags `همچنین، کد` → `کد` — two in three paragraphs: both flagged as an aggregate |
| `علاوه بر این، سرور سریع است. ⏎ متن عادی. ⏎ متن عادی.` | no flag — one is within the cap |
| `علاوه بر این، سرور سریع است. ⏎ در نتیجه، فروش افزایش یافت. ⏎ متن عادی.` | no flag — one counts, the other is exempt: «افزایش یافت» is a real causal verb, so it is not a stock transition |


<!-- client:end -->

**FA-T1-17 Stock openers** — an opener from the "First-word fingerprints" list at the start of any section. Any hit fails. Fix: mechanical, the span covers the opener plus the following word, so `after` is that word.

<!-- client:start -->

A "section start" is `sectionStart` on a non-heading prose block, as in the English guide.

##### FA-T1-17 tests — stock openers at a section start

| Input | Result |
|---|---|
| `البته، این روش ساده است.` | flags `البته، این` → `این` |
| `سؤال خوبی است! این روش ساده است.` | flags `سؤال خوبی است! این` → `این` |
| `این روش ساده است. البته، سریع هم هست.` | no flag — only at a section start |


<!-- client:end -->

**FA-T1-18 Markdown/bullet leakage** — flag bold, bullet or heading syntax inside a section marked as prose rather than a designated list or reference block. Same detection as the English T1-04. Fix: generative, shared call.

**FA-T1-19 Hedging stack** — count hedges per sentence. Flag any sentence with two or more. The hedges: `شاید`, `احتمالاً`, `ممکن است`, `به نظر می‌رسد`, `تا حدی`, `تا حدودی`, `به نوعی`, `بعضاً`, `می‌تواند`, `می‌توانند`, `می‌توان`. Fix: generative, shared call; bare deletion usually leaves broken grammar.

<!-- client:start -->

```js
const HEDGE = new RegExp(`${WB}(?:شاید|احتمالاً|احتمالا|ممکن\\s+(?:است|بود)|به\\s+نظر\\s+می[ ${Z}]?رسد|تا\\s+حدی|تا\\s+حدودی|به\\s+نوعی|بعضاً|بعضا|می[ ${Z}]?تواند|می[ ${Z}]?توانند|می[ ${Z}]?توان)${WE}`, 'gu')
```

##### FA-T1-19 tests — hedge count per sentence (flagged at 2 or more)

| Sentence | Hedges |
|---|---|
| `شاید این روش ممکن است به نوعی کمک کند.` | 3 — flagged |
| `او می‌تواند بیاید.` | 1 |
| `این روش کار می‌کند.` | 0 |


<!-- client:end -->

**FA-T1-20 Sentence-length cap** — word count per sentence, counting each ZWNJ-joined word once and counting Latin words and digits as words. Strict: fail above 25 words (instruction) or 30 (descriptive). Flavoured: flag above 40. These caps are about 1.2× the English ones: Farsi is verb-final and chains clauses with `که` and `و`, so a clause waits longer for its verb. **They are provisional**: no published Persian threshold exists, so calibrate them on real writing. Fix: generative, shared call.

<!-- client:start -->

An *instruction* is a sentence whose last word is a second-person imperative (`[ن|ب]` + a present stem + `ید`, or `ب` + a present stem, from the "Verb stems" table) or a list item. Every sentence over 25 words is a Pass A candidate; Pass B applies the cap for the sentence's section mode.

##### FA-T1-20 tests — word counts and instruction detection

| Sentence | Words | Instruction? |
|---|---|---|
| `او می‌رود به خانه.` | 4 | — |
| `از React 18 استفاده کنید.` | 5 | — |
| `نسخهٔ آزمایشی را روی سرور دوم اجرا کنید.` | 8 | — |
| `فهرست تغییرات را مرور کنید.` | 5 | yes |
| `نسخهٔ آزمایشی را اجرا نمایید.` | 5 | yes |
| `این سند مراحل انتشار را توضیح می‌دهد.` | 7 | no |
| `شما این کار را کردید.` | 5 | no |
| `همهٔ فایل‌ها را ببینید.` | 4 | yes |


<!-- client:end -->

**FA-T1-21 Sentence-length variance** — standard deviation of sentence length across a section. Flag if it drops below 4 words over any span of 5 or more sentences. Same measure as English; the threshold is provisional for the same reason as FA-T1-20. Fix: generative, shared call.

**FA-T1-22 List-item length variance** — for lists of four or more items, flag if every item falls within a 20% character-count band of the others. Fix: generative, shared call.

**FA-T1-23 Antithesis** — «نه تنها X، بلکه Y», «نه X، بلکه Y», «X نیست، Y است». Strict: zero allowed. Flavoured: flag above one per 500 words. Does not fire for a concession (`ساده نیست، اما ممکن است`) or a plain double negation (`نه به مدرسه رفت و نه به خانه`). Fix: generative, shared call.

<!-- client:start -->

```js
const R23a = new RegExp(`${WB}نه\\s+(?:تنها|فقط|صرفاً|صرفا)\\s+[^.!؟\\n]{1,120}?[،,]?\\s*بلکه\\s`, 'gu')
const R23b = new RegExp(`${WB}نه\\s+[^.!؟\\n،]{1,60}?[،]?\\s*بلکه\\s`, 'gu')
const R23c = new RegExp(`${WB}نیست(?:ند)?[،؛,]\\s+(?:بلکه\\s+)?(?!اما|ولی|لیکن|ولیکن)[^.!؟\\n]{1,80}?\\s(?:است|هستند|هست)${WE}`, 'gu')
```

One candidate per sentence; the span is the sentence.

##### FA-T1-23 tests

| Input | Fires? |
|---|---|
| `این ابزار نه تنها سریع است، بلکه ایمن هم هست.` | yes |
| `این یک باگ نیست، یک ویژگی است.` | yes |
| `نه سرعت، بلکه پایداری مهم است.` | yes |
| `کار ساده نیست، اما ممکن است.` | no |
| `او نه به مدرسه رفت و نه به خانه.` | no |
| `این گزینه موجود نیست.` | no |


<!-- client:end -->

**FA-T1-24 «از X گرفته تا Y»** — the sweeping comprehensiveness claim. Flag above one per document. Plain «از … تا …» is not flagged: it is ordinary Farsi for ranges of time, place and number. Fix: generative, shared call.

<!-- client:start -->

```js
const R24 = new RegExp(`${WB}از\\s+[^.!؟\\n]{1,60}?\\s+گرفته\\s+تا\\s`, 'gu')
```

##### FA-T1-24 tests

| Input | Fires? |
|---|---|
| `از معماری گرفته تا استقرار، همه‌چیز پوشش داده شد.` | yes |
| `از ساعت ۸ تا ۱۰ باز است.` | no |


<!-- client:end -->

**FA-T1-25 False positivity** — «با وجود X، Y», «علی‌رغم X، Y», «به‌رغم X، Y» at the start of a sentence, followed by a positive reframe. Strict: zero allowed. Flavoured: flag above one per document. Fix: generative, shared call.

<!-- client:start -->

```js
const R25 = new RegExp(`(?:^|(?<=[.!؟]\\s)|(?<=\\n))(?:با\\s+وجود|علی${Z}?رغم|به${Z}?رغم)\\s+[^،.!؟\\n]{2,100}،`, 'gmu')
```

##### FA-T1-25 tests

| Input | Fires? |
|---|---|
| `با وجود چالش‌ها، پروژه موفق شد.` | yes |
| `پروژه تمام شد. علی‌رغم تأخیر، همه راضی بودند.` | yes |
| `او با وجود خستگی کار کرد.` | no |


<!-- client:end -->

## Tier 1b — mechanical, needs one bounded judgement or a closed table

**FA-T1b-01 Half-space before «تر»** — the comparative suffix is written with a half-space (`بزرگ‌تر`), or joined for the six always-joined comparatives (`بهتر`, `بیشتر`, `کمتر`…; Dastur p.40). The one bounded judgement: «تر» is also a word meaning "wet", which must stay separate. The check resolves that with a guard list (`دست تر`, `نان تر`) and the idiomatic follow-ons (`تر و تازه`, `تر و خشک`); anything else is flagged as a Check fix. Fix: mechanical.

<!-- client:start -->

```js
const R1b01 = new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (تر)${WE}(?! و (?:تازه|خشک|فرز|تمیز))`, 'gu')
```

Skip when group 1 is in "Words that take a separate «تر»". `after` as for FA-T1-03.

##### FA-T1b-01 tests — half-space before «تر»

| Input | Result |
|---|---|
| `این بزرگ تر است` | flags `بزرگ تر` → `بزرگ‌تر` |
| `کم تر از آن` | flags `کم تر` → `کمتر` — always-joined comparative |
| `نان تر و تازه` | no flag — the word «تر» (wet) |
| `دست تر شد` | no flag — wet, guarded by the previous word |
| `سبز تر و تازه` | no flag — wet, guarded by the following «و تازه» |
| `بزرگ‌تر است` | no flag — already correct |


<!-- client:end -->

**FA-T1b-02 Mixed digit systems** — in running prose of Farsi sentences, count digit tokens in Persian (۰–۹) and Latin (0–9). If both appear, the system with more tokens is dominant (a tie goes to Persian) and every token of the other system is flagged with a conversion to the dominant system. Arabic-Indic digits are handled by FA-T1-07, not here. A digit token is exempt when a Latin letter or underscore touches it (`React18`, `v2`), or it is a version (`2.1.0`) or an ISO date. Aggregate rule: one flag per minority token. Fix: mechanical.

<!-- client:start -->

A digit token: `/[0-9۰-۹]+(?:[.,٫٬:/-][0-9۰-۹]+)*/gu`. List-item numbers are already blanked by the prose masker.

##### FA-T1b-02 tests — mixed digit systems

| Input | Result |
|---|---|
| `در ۳ مرحله و ۵ بخش و 7 فایل کار کنید` | flags `7` → `۷` |
| `در 3 مرحله و 5 بخش و ۷ فایل کار کنید` | flags `۷` → `7` |
| `در ۳ مرحله و 7 فایل` | flags `7` → `۷` — a tie goes to Persian |
| `از React18 و نسخه 2.1.0 و ۳ مرحله استفاده کنید` | no flag — identifiers and versions are exempt |
| `Chapter 7 has 3 parts and ۴ more` | no flag — an English sentence |


<!-- client:end -->

**FA-T1b-03 Ezafe written `ه‌ی`** — after a silent ه the Academy's form is `ـهٔ` (Dastur p.46), and `خانه‌ی من` is the common alternative. Jot's house style is the Academy's. The check flags a half-spaced ی that is followed by a word; `ه‌ای` (the indefinite) is not ezafe and is not flagged. Check fix, because it is a house-style choice the person may dismiss. Fix: mechanical, `ه` + U+0654.

<!-- client:start -->

```js
const R1b03 = new RegExp(`${WB}([${W}]*ه)${Z}ی(?= [${L}])`, 'gu')
```

##### FA-T1b-03 tests — ezafe written ه‌ی

| Input | Result |
|---|---|
| `خانه‌ی من` | flags `خانه‌ی` → `خانهٔ` |
| `همه‌ی مردم` | flags `همه‌ی` → `همهٔ` |
| `خانه‌ای دیدم` | no flag — the indefinite «ای», not ezafe |
| `خانهٔ من` | no flag — already the Academy form |


<!-- client:end -->

**FA-T1b-04 Stiff officialese needing context** — `جهت`, `لذا`, `مذکور`, `به منظور`, `در خصوص`, `بر روی`, `لیکن` from banned-vocabulary.md ("Stiff connectors"). Each has an exact plain equivalent, but `جهت` is also the noun "direction", so each entry carries a guard (the "Not flagged when" column). Fix: mechanical, table lookup.

<!-- client:start -->

##### FA-T1b-04 tests — stiff connectors with guards

| Input | Result |
|---|---|
| `جهت بهبود کار` | flags `جهت` → `برای` |
| `به منظور ساده‌سازی` | flags `به منظور` → `برای` |
| `از این جهت مهم است` | no flag — guard: after «این» |
| `جهتی دیگر` | no flag — guard: the noun «direction» |
| `لذا نتیجه می‌گیریم` | flags `لذا` → `پس` |


<!-- client:end -->

**FA-T1b-05 Light-verb padding** — a nominal plus light-verb construction where a plain verb exists: `مورد بررسی قرار دادیم` for `بررسی کردیم`, `اقدام به نصب کرد` for `نصب کرد`. The table rows are templates with a verb at the end; the verb is matched in every tense and person and the replacement conjugated to match. The first two rows apply only to the listed nouns. Fix: mechanical, table lookup and verb generator.

<!-- client:start -->

##### FA-T1b-05 tests — light-verb padding

| Input | Result |
|---|---|
| `ما داده‌ها را مورد بررسی قرار دادیم` | flags `مورد بررسی قرار دادیم` → `بررسی کردیم` |
| `نتایج مورد بررسی قرار می‌گیرد` | flags `مورد بررسی قرار می‌گیرد` → `بررسی می‌شود` |
| `الگو مورد استفاده قرار گرفت` | flags `مورد استفاده قرار گرفت` → `استفاده شد` |
| `طرح مورد حمایت قرار گرفت` | no flag — حمایت is not in the eligible list |
| `` از `مورد بررسی قرار دادیم` بخوانید `` | no flag — inside code |


<!-- client:end -->

**FA-T1b-06 Synonym doublets** — a pair from banned-vocabulary.md ("Synonym doublets") where one word carries the meaning (`سعی و تلاش`). Idioms and fixed legal or technical pairs are not on the list. Fix: mechanical, table lookup.

**FA-T1b-07 Loanword with an approved equivalent** — an everyday loanword from banned-vocabulary.md ("Loanwords with an approved equivalent"). Technical terms (`کامپوننت`, `سرور`, `فایل`, `API`) are never flagged. Flag, never fail, and never auto-fix: the equivalent is named in the rationale and the person decides. Fix: none, by design (`after` is `null`).

**FA-T1b-08 Vague attribution** — an authority phrase (`مطالعات نشان می‌دهد`, `کارشناسان معتقدند`, `پژوهش‌ها حاکی از …`) not followed within 15 tokens by a year, a link, a parenthetical citation or a Latin-script proper noun. Flag, never fail. Route to human review. Fix: none, by design.

<!-- client:start -->

```js
const R1b08 = new RegExp(
  `${WB}(?:مطالعات|تحقیقات|پژوهش[ ${Z}]?ها|پژوهشگران|کارشناسان|متخصصان|محققان|آمارها|گزارش[ ${Z}]?ها|بررسی[ ${Z}]?ها)\\s+` +
  `(?:نشان\\s+می[ ${Z}]?(?:دهند|دهد)|می[ ${Z}]?گویند|معتقدند|بر\\s+این\\s+باورند|تأیید\\s+می[ ${Z}]?کنند|حاکی(?:\\s+از)?)${WE}`, 'gu')
```

Sourced, so not flagged, when the next 16 whitespace-separated tokens contain a link, a year (`13xx`, `14xx`, `19xx`, `20xx`, Latin or Persian digits), a parenthetical with a digit in it, or a capitalised Latin word.

##### FA-T1b-08 tests

| Input | Fires? |
|---|---|
| `مطالعات نشان می‌دهد این روش سریع‌تر است.` | yes |
| `کارشناسان معتقدند این روش بهتر است.` | yes |
| `مطالعات نشان می‌دهد که این روش سریع‌تر است (چن، ۲۰۲۴).` | no |
| `طبق گزارش Chen et al. مطالعات نشان می‌دهد، Chen گفت.` | no |


<!-- client:end -->

**FA-T1b-09 One name per entity** — coreference. Flag any cluster that uses two or more distinct names for one entity within a document, including three or more synonyms for one recurring action or quality within roughly one paragraph. In Farsi, "distinct name" includes **variant spellings and transliterations of one loanword** (`کامپوننت` / `کامپوننت‌` / `مؤلفه`) and **a loanword and a native word for the same thing** (`فایل` / `پرونده`, `کاربر` / `مشتری` when they mean the same person). Not a violation: a gloss at first mention (`کامپوننت (مؤلفه)`), singular versus plural, and deliberate repetition for rhythm. Fix: generative, shared call, same pass as detection; rename later uses to the first-used name.

## Tier 2 — judgement

The judge applies each procedure against the document and its audience. The Farsi examples are in examples/tier2-examples.md and are load-bearing.

**FA-T2-01 Abstraction over specificity**
Flag any claim about a result, benefit or behaviour with no number, unit or named entity, where one is available (`عملکرد بالایی ارائه می‌دهد`, `تجربهٔ کاربری بهتری فراهم می‌کند`).
Judge question: is this abstraction placing weight on a specific result already stated nearby (motivated), or standing in for a concrete fact the writer never supplied (reflexive)? Fail only the second case.

**FA-T2-02 Padding / restatement**
Flag any sentence that restates a claim already made in the same paragraph without adding a new fact, number or mechanism (a second sentence opening `این بدان معناست که` that only repeats the first; `به عبارت دیگر` followed by the same claim).
Judge question: if this sentence were deleted, would the reader lose information? If no, fail.

**FA-T2-03 Hedging seesaw**
Flag any «از یک سو … از سوی دیگر …» structure, or any comparison giving both sides equal weight.
Judge question: does evidence elsewhere in the document already resolve this in one direction? If yes, and the text still both-sides it, fail.

**FA-T2-04 Personifying abstractions**
Flag any sentence where an abstract or inanimate subject (`داده‌ها`, `سیستم`, `بازار`, `ابزار`) takes a cognition verb (`تصمیم گرفت`, `می‌خواهد`, `باور دارد`, `به ما می‌گوید`).
Judge question: can the verb be replaced with the real mechanism without losing the only concrete fact in the sentence? If yes, fail. Persian prose has a long literary tradition of personification: in flavoured sections, weigh whether the device is deliberate and the sentence still carries its fact.

**FA-T2-05 Over-explaining the obvious**
Flag any definition or explanation of a term or concept.
Judge question: given this document's stated or clearly implied audience, would they already know this? If yes, fail.

**FA-T2-06 Restatement disguised as meta-commentary**
Flag any sentence describing the document's own structure (`در این بخش به بررسی … می‌پردازیم`, `در پایان`).
Judge question: does it preview or review information the reader did not already have (a real roadmap), or restate what is already stated elsewhere? Fail only the second case. Functional signposting in long technical documents is exempt by default.

**FA-T2-07 Rule of three**
Detect comma- or `و`-joined lists of exactly three parallel items (`سریع، قابل‌اعتماد و مقیاس‌پذیر`).
Judge question: are all three items concrete, distinct, named referents (code-formatted tokens, proper nouns, IDs, file or field names) enumerating real things? Or are they descriptive adjectives or abstract nouns characterizing one subject for effect? Fail only the second case (decorative tricolon). Necessary enumeration always passes, both modes. Decorative use: strict, zero allowed; flavoured, flag above one per 500 words.

**FA-T2-08 Participial tack-on**
Flag any sentence ending in a result clause that asserts a benefit or consequence (`… که باعث بهبود پایداری می‌شود`, `… و این امر … را ممکن می‌سازد`, `… تا … را تضمین کند`).
Judge question: does the rest of the sentence, or the surrounding paragraph, already state or support this claim? Pass if yes, regardless of whether a number is present. Fail only when the clause asserts a benefit or consequence with nothing behind it anywhere in context.

**FA-T2-09 Ezafe pile-up**
Flag a noun phrase in which four or more words are chained by ezafe (the unwritten *-e* that links a noun to what follows, as in `بررسی تأثیر عوامل مؤثر بر کیفیت خدمات`). The ezafe is not visible in the text, so this cannot be matched by pattern; read the phrase and count the links.
Judge question: can a reader take the phrase in one pass, or must they re-read to see what modifies what? Pass a chain that is established terminology (`سامانهٔ مدیریت پایگاه داده`) or whose links are concrete named things. Fail a chain of abstract nouns that a verb or a preposition would unpack.

**FA-T2-10 Hidden agent**
Flag a passive or impersonal construction (`مورد توجه قرار گرفت`, `تصمیم گرفته شد`, `انجام می‌شود`, `دیده می‌شود`, an agentive `توسط`) where the actor is not stated and the document gives no reason to leave it out.
Judge question: would the reader be able to act on, verify or question the sentence if told who acts? Pass when the actor is obvious, irrelevant, or the reader themself (a procedure), or when the system is the natural subject of a technical description. Fail when a decision, claim or failure is reported with no one behind it.

**FA-T2-11 Translationese**
Flag English-shaped Farsi: phrases calqued from English, and sentence structure that keeps English word order where Farsi would not (`در پایان روز`, `بازی را تغییر می‌دهد`, `در رابطه با`, `این یک … است که` chains, a literal `یک` where English had "a", `به‌عنوان یک X` where `X` is enough).
Judge question: would a native writer, writing this from scratch for this reader, choose this phrasing? If a plain Farsi equivalent exists with no loss, fail. Pass quoted text identified as a translation and established technical terms.

**FA-T2-12 Register mixing**
Decide the passage's dominant register, formal written or colloquial. Flag the forms that break it: colloquial verb endings and contractions (`می‌شه`, `نمی‌دونم`, `کتابو`) inside formal prose; formal or officialese forms (`می‌باشد`, `اینجانب`, `بنمایید`) inside colloquial prose. A passage is a paragraph or a section. A passage is never flagged for being colloquial, or for being formal; only a shift inside it. Quoted speech and dialogue are exempt.
Judge question: would the reader notice the shift? Fix: none; the person chooses the direction.

Fix for all of Tier 2: none, by design: see output-schema.md.
