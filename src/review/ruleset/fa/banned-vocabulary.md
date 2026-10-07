# Banned Vocabulary (Farsi)

Direct substitution lists and word tables for the Farsi guide. FA-T1-14 (mis-spaced words), FA-T1-15 (banned vocabulary), FA-T1-16 and FA-T1-17 (transitions and openers), FA-T1b-04 to FA-T1b-07 (officialese, light-verb padding, doublets, loanwords) and the verb prefix check FA-T1-01 read this file.

This file is client-side data. The build does not send it to the model, same as the English file. Every table here is in the format the English parser (`tableUnder` in `src/review/ruleset.ts`) already reads: a `## Heading`, then a markdown table whose first row is the header. See "Parser notes" at the end for the few places the Farsi data needs more than that parser does today.

**Matching conventions, for every table below:**

- Compare against a copy of the text with Arabic ي ى ك normalised to ی ی ک (a one-to-one character swap, so offsets stay valid).
- A space and a ZWNJ inside an entry are interchangeable (`بی‌شک` also matches `بی شک` and `بیشک`).
- Match whole Farsi words only; Farsi word boundaries are defined in checks.md ("Shared definitions").
- Entries are written as the Academy's standard spelling. Where the "Banned" cell is itself a wrong spelling (the slips table), match it literally.

## AI-tell vocabulary → plain replacement

Stock phrases and words that read as machine-written Farsi. Any hit flags, both modes. Parentheses mean no word replaces it: `(cut)` removes it, any other parenthetical is guidance for the shared call.

| Banned | Use instead |
|---|---|
| در دنیای امروز | (cut) |
| در عصر حاضر | (cut, or «امروز») |
| بدون شک | (cut) |
| بی‌شک | (cut) |
| حائز اهمیت | مهم |
| از اهمیت بالایی برخوردار است | مهم است |
| نقش کلیدی | (say what it actually does) |
| نقش حیاتی | (say what it actually does) |
| چندوجهی | (name the specific facets instead) |
| واکاوی | بررسی |
| تحول‌آفرین | (state the change) |
| در این راستا | (cut) |
| نکتهٔ قابل‌توجه این است که | (cut) |
| همان‌طور که می‌دانیم | (cut) |
| ستودنی | (cut, or state the specific result) |
| موشکافانه | دقیق |

## Marketing adjectives → cut or replace with a fact

| Banned | Use instead |
|---|---|
| بی‌نظیر | (cut) |
| بی‌همتا | (cut) |
| فوق‌العاده | (state the number or capability) |
| شگفت‌انگیز | (state the number or capability) |
| قدرتمند | (state the number or capability) |
| نوآورانه | (cut) |
| همه‌جانبه | (cut) |
| پیشرو | (cut, or cite the comparison) |
| بی‌نقص | (state what actually happens) |
| مستحکم | (state the failure mode it survives) |

## Inflated verbs → plain verb

The Farsi counterpart of "utilize → use": stiff officialese verbs with a plain equivalent. Rows are infinitives. Each is matched in every tense and person by the verb generator (checks.md, "Verb forms"), so `نمود`, `می‌نماید`, `نموده‌اند` and `بنمایید` all hit the `نمودن` row, and the replacement is conjugated to the same tense and person. Stems are in "Verb stems" below.

| Banned | Use instead |
|---|---|
| نمودن | کردن |
| گردیدن | شدن |

## Officialese "to be" → plain form

`می‌باشد` for `است`. Matched literally (no generator needed).

| Banned | Use instead |
|---|---|
| می‌باشد | است |
| می‌باشند | هستند |
| می‌باشم | هستم |
| می‌باشی | هستی |
| می‌باشیم | هستیم |
| می‌باشید | هستید |
| نمی‌باشد | نیست |
| نمی‌باشند | نیستند |
| نمی‌باشم | نیستم |
| نمی‌باشی | نیستی |
| نمی‌باشیم | نیستیم |
| نمی‌باشید | نیستید |

## Stiff connectors → plain word (FA-T1b-04)

Check fix: each has an exact plain equivalent, but some have a second, legitimate sense, so each carries a guard. The third column is read by the client-side check, not by the parser that reads the first two.

| Stiff | Plain | Not flagged when |
|---|---|---|
| جهت | برای | the previous word is این, آن, همین, همان, یک, هر, دو, سه, چند, در, از or مخالف, or the next character is ی (the noun "direction") |
| لذا | پس | — |
| مذکور | این | — |
| به منظور | برای | — |
| در خصوص | دربارهٔ | — |
| بر روی | روی | — |
| لیکن | اما | — |

## First-word fingerprints (banned at section starts)

البته، / قطعاً، / حتماً، / بله، / سؤال خوبی است! / با کمال میل / به‌عنوان یک مدل زبانی...

## Stock transitions (FA-T1-16)

Checked at paragraph starts; flagged above one per three consecutive paragraphs (checks.md).

علاوه بر این، / افزون بر این، / همچنین، / در نتیجه، / لازم به ذکر است که / شایان ذکر است که

## Synonym doublets → single word (FA-T1b-06)

Check fix. Real synonym pairs where one word carries the meaning. True idioms (`شور و شوق`, `کم و کاست`, `امن و امان`) and fixed legal or technical pairs (`قوانین و مقررات`, `تجزیه و تحلیل`) are deliberately not here.

| Doublet | Single word |
|---|---|
| سعی و تلاش | تلاش |
| تلاش و کوشش | تلاش |
| حل و فصل | حل |
| راه و روش | روش |
| علل و عوامل | علل |
| اهداف و مقاصد | اهداف |
| مسائل و مشکلات | مشکلات |
| اصول و مبانی | اصول |
| شرایط و اوضاع | شرایط |
| ابزار و وسایل | ابزار |
| بحث و گفت‌وگو | گفت‌وگو |

## Light-verb padding → verb form (FA-T1b-05)

The Farsi counterpart of "perform an analysis → analyze". `<N>` stands for one word (a verbal noun). The verb is matched in every tense and person and the replacement conjugated to match (checks.md, "Verb forms"). Check fix.

| Padded form | Plain form |
|---|---|
| مورد <N> قرار دادن | <N> کردن |
| مورد <N> قرار گرفتن | <N> شدن |
| اقدام به <N> کردن | <N> کردن |
| به انجام رساندن | انجام دادن |
| مبادرت ورزیدن به <N> | <N> کردن |

## Nouns eligible for «مورد N قرار …» (FA-T1b-05)

Only these nouns trigger the first two rows above; with other nouns the plain form reads badly, so nothing is flagged.

بررسی / استفاده / تحلیل / ارزیابی / آزمایش / مقایسه / تأیید / بازبینی

## Loanwords with an approved equivalent (FA-T1b-07)

Everyday loanwords only, never technical terms (`کامپوننت`, `سرور`, `فایل`, `API` are not listed and are never flagged). Flagged with no fix: the equivalent is named in the explanation and the person decides. Entries ending in `کردن` match the noun plus any form of `کردن`; nouns also match with a trailing `ها`, `های` or `ی`.

| Loanword | Approved equivalent |
|---|---|
| پروسه | فرایند |
| لیست | فهرست |
| چک کردن | بررسی کردن |
| کنسل کردن | لغو کردن |
| تایم | زمان |
| سیو کردن | ذخیره کردن |
| دیلیت کردن | حذف کردن |

## Orthography slips → standard form (FA-T1-14)

Quick fix. The wrong form is matched literally, as a whole word. Sources, all in the Academy's *Dastur-e Khatt-e Farsi*, new edition (Tehran, 1401/2022): `به` in adverbs and prepositional compounds takes a half-space, p.38; `بنابراین` and `همچنین` are written as one word, p.40 and p.71; the hamza spellings `رئیس`, `ارائه`, `جزئی`, `قرائت` are the standard and `رییس`, `ارایه`, `جزیی`, `قرایت` the named errors, p.42–43.

| Wrong | Standard |
|---|---|
| بطور | به‌طور |
| بخاطر | به‌خاطر |
| بعنوان | به‌عنوان |
| بدلیل | به‌دلیل |
| بوسیله | به‌وسیله |
| بجای | به‌جای |
| بخصوص | به‌خصوص |
| بجهت | به‌جهت |
| بسبب | به‌سبب |
| بموجب | به‌موجب |
| بمحض | به‌محض |
| بنابر این | بنابراین |
| بنا بر این | بنابراین |
| هم چنین | همچنین |
| هم‌چنین | همچنین |
| رییس | رئیس |
| ارایه | ارائه |
| جزیی | جزئی |
| قرایت | قرائت |
| مساله | مسئله |
| هیات | هیئت |

## Comparatives always written joined (FA-T1-03, FA-T1b-01)

The Dastur lists these as the exceptions to the half-space before `تر` and `ترین` (p.40): they are written as one word with no ZWNJ. For any other word the half-space applies.

| Stem | Written |
|---|---|
| به | بهتر / بهترین |
| بیش | بیشتر / بیشترین |
| کم | کمتر / کمترین |
| که | کهتر / کهترین |
| مه | مهتر / مهترین |
| کلان | کلانتر / کلانترین |

## Words that take a separate «تر» (wet), not the comparative (FA-T1b-01)

دست / لب / پارچه / نان / لباس / خاک / زمین / مو

## Verb stems (FA-T1-01, FA-T1-15, FA-T1b-05)

The closed set of verbs the verb generator knows (checks.md, "Verb forms"). The present stem already includes the glide letter for vowel-final stems (`گوی`, `آی`, `نمای`, `شوی`), so every person ending is one of the six regular ones.

| Infinitive | Present stem | Past stem |
|---|---|---|
| کردن | کن | کرد |
| شدن | شو | شد |
| گفتن | گوی | گفت |
| رفتن | رو | رفت |
| آمدن | آی | آمد |
| دادن | ده | داد |
| داشتن | دار | داشت |
| خواستن | خواه | خواست |
| دیدن | بین | دید |
| گرفتن | گیر | گرفت |
| بردن | بر | برد |
| آوردن | آور | آورد |
| دانستن | دان | دانست |
| توانستن | توان | توانست |
| گذاشتن | گذار | گذاشت |
| زدن | زن | زد |
| خوردن | خور | خورد |
| نوشتن | نویس | نوشت |
| خواندن | خوان | خواند |
| ماندن | مان | ماند |
| رسیدن | رس | رسید |
| ساختن | ساز | ساخت |
| شناختن | شناس | شناخت |
| یافتن | یاب | یافت |
| پذیرفتن | پذیر | پذیرفت |
| فرستادن | فرست | فرستاد |
| نشستن | نشین | نشست |
| ایستادن | ایست | ایستاد |
| افتادن | افت | افتاد |
| گذشتن | گذر | گذشت |
| پرسیدن | پرس | پرسید |
| کشیدن | کش | کشید |
| خریدن | خر | خرید |
| فروختن | فروش | فروخت |
| شنیدن | شنو | شنید |
| پختن | پز | پخت |
| ریختن | ریز | ریخت |
| بستن | بند | بست |
| شکستن | شکن | شکست |
| گشتن | گرد | گشت |
| پرداختن | پرداز | پرداخت |
| انداختن | انداز | انداخت |
| شمردن | شمار | شمرد |
| آموختن | آموز | آموخت |
| سوختن | سوز | سوخت |
| شستن | شوی | شست |
| جستن | جوی | جست |
| دویدن | دو | دوید |
| پوشیدن | پوش | پوشید |
| فهمیدن | فهم | فهمید |
| پریدن | پر | پرید |
| بخشیدن | بخش | بخشید |
| کوشیدن | کوش | کوشید |
| رساندن | رسان | رساند |
| پنداشتن | پندار | پنداشت |
| پیوستن | پیوند | پیوست |
| افزودن | افزای | افزود |
| کاستن | کاه | کاست |
| نمودن | نمای | نمود |
| گردیدن | گرد | گردید |

## Parser notes

What the existing parser (`src/review/ruleset.ts`) handles unchanged, and what the build round needs to add.

**Works as is** (same headings, same row format, parsed by `tableUnder`): "AI-tell vocabulary → plain replacement", "Marketing adjectives → cut or replace with a fact", "Inflated verbs → plain verb", and "First-word fingerprints (banned at section starts)" (one line, entries split on ` / `, trailing `...` stripped). `parseFix` reads a Farsi cell the same way as an English one: `(cut)` is a cut, a parenthetical with `, or` or other text is guidance for the shared call, anything else is the replacement.

**Needs new code:**

1. *Word matching.* The English parser builds `\b…\b` patterns from English inflection rules. JavaScript's `\b` does not see Arabic-script letters. Farsi entries are matched with the Farsi word boundaries in checks.md and the matching conventions at the top of this file.
2. *Verb rows.* "Inflated verbs → plain verb" and "Light-verb padding → verb form" hold infinitives, not surface forms. The code needs the verb generator (checks.md, "Verb forms") fed by the "Verb stems" table. English `forms()` and `inflectionOf()` have no counterpart.
3. *Light-verb padding.* The English nominalization parser assumes `light verb + determiner + noun`, taking the last word as the noun. Farsi is noun-first and the light verb comes last, and some rows hold a `<N>` slot. Parse the first column as a template: literal words, `<N>` for one word, and an infinitive at the end that the generator expands.
4. *Extra tables and lists.* New headings not in the English file: "Officialese «to be»", "Stiff connectors" (third column is a guard), "Stock transitions" (a one-line list, like fingerprints), "Synonym doublets", "Nouns eligible for «مورد N قرار …»" (a one-line list), "Loanwords with an approved equivalent", "Orthography slips", "Comparatives always written joined" and "Words that take a separate «تر»" (one-line list), "Verb stems". All use the same `## Heading` plus table (or one-line list) shapes the English parser already reads.
5. *Phrasal verbs.* Farsi has none, so there is no "Phrasal verbs" section. `tableUnder` returns an empty list for a missing heading.
