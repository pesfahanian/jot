# Tier 1 & 1b Examples (Farsi)

Illustrative for humans either way, but the fix mechanism differs by rule: grouped accordingly, per checks.md's Fix: lines. The reasoning is in English; the Farsi is the real text.

## Mechanical fixes — produced client-side, no model involved

### Orthography and typography (FA-T1-01 to FA-T1-14)

Each of these is decided by pattern from the Academy's *Dastur-e Khatt-e Farsi* or from Virastar's conventions. The model never sees them. Every `span` quotes the whole word, so the reader sees a real before and after instead of an invisible character.

**FA-T1-01 Half-space after می / نمی** — Bad: «من هر روز به دفتر می روم.» Good: «من هر روز به دفتر می‌روم.» The prefix is written with a half-space; a space or no gap are both wrong. «میروم» (no gap) is fixed the same way.

**FA-T1-02 Half-space before «ها»** — Bad: «این کتاب ها را بخوانید.» Good: «این کتاب‌ها را بخوانید.» Bad: «خانهها قدیمی‌اند.» Good: «خانه‌ها قدیمی‌اند.» A space is never acceptable; a joined plural after a silent ه is not either. Joined «کتابها» is allowed by the Academy and is not flagged.

**FA-T1-03 Half-space before «ترین»** — Bad: «بزرگ ترین شهر ایران» Good: «بزرگ‌ترین شهر ایران». Bad: «به ترین راه» Good: «بهترین راه». The six always-joined comparatives take no half-space at all.

**FA-T1-04 Half-space before clitics** — Bad: «من خسته ام و آنها رفته اند.» Good: «من خسته‌ام و آنها رفته‌اند.» Bad: «خانه ای دیدم.» Good: «خانه‌ای دیدم.» After a silent ه the pronoun and copula endings and the indefinite ی take a half-space.

**FA-T1-05 Ezafe after ه** — Bad: «خانه ی من» Good: «خانهٔ من». A detached «ی» is a typing slip; the Academy writes the ezafe as «هٔ».

**FA-T1-06 Arabic letters** — Bad: «كتاب علي» (Arabic ك and ي) Good: «کتاب علی» (Persian ک and ی). The same fix applies to ى. A quotation in Arabic is left alone: «قال الله تعالى» is Arabic, not a typo.

**FA-T1-07 Arabic-Indic digits** — Bad: «در سال ١٤٠١» Good: «در سال ۱۴۰۱». The two sets differ on 4, 5 and 6, so the fix maps by value.

**FA-T1-08 Latin punctuation** — Bad: «سلام, حال شما چطور است?» Good: «سلام، حال شما چطور است؟» Applies in a Farsi sentence even when it contains English terms («از React, Vue و Svelte» becomes «از React، Vue و Svelte»). Not applied to an English sentence, or to the comma in «1,000».

**FA-T1-09 Punctuation spacing** — Bad: «این مثال ( ساده ) است ،اما مفید است .» Good: «این مثال (ساده) است، اما مفید است.» No space before `، ؛ ؟ ! : .` and one space after.

**FA-T1-10 Quotation marks** — Bad: «او گفت "سلام" و رفت.» Good: «او گفت «سلام» و رفت.» Includes English terms inside a Farsi sentence: «کلمهٔ "React"» becomes «کلمهٔ «React»».

**FA-T1-11 Doubled spaces** — Bad: «این  یک مثال است.» Good: «این یک مثال است.»

**FA-T1-12 Kashida** — Bad: «سلاـم» Good: «سلام». A kashida used as a dash between spaces becomes «–».

**FA-T1-13 Stray half-space** — Bad: «می‌‌روم» (two half-spaces) Good: «می‌روم». The same fix removes a half-space that touches a space or punctuation.

**FA-T1-14 Mis-spaced words** — Bad: «بطور کامل موافقم.» Good: «به‌طور کامل موافقم.» Bad: «بنابر این نتیجه می‌گیریم» Good: «بنابراین نتیجه می‌گیریم». Bad: «رییس شرکت» Good: «رئیس شرکت».

### Style (table lookup)

**FA-T1-15 Banned vocabulary** — Bad: «در دنیای امروز، این ابزار حائز اهمیت است.» Good: «این ابزار مهم است.» Two hits, two fixes: «در دنیای امروز،» is cut (the span runs through the next word so the fix is never empty) and «حائز اهمیت» becomes «مهم». Bad: «اطلاعات ارسال می‌گردد.» Good: «اطلاعات ارسال می‌شود.» The verb `گردیدن` is matched in every tense and person and replaced with the same tense of `شدن`.

**FA-T1-16 Stock transitions** — Bad: «علاوه بر این، سرور سریع است. همچنین، کد ساده است.» Good: «سرور سریع است. کد ساده است.» Two transitions in two paragraphs exceeds one per three; both are removed. A transition that sits next to a real causal verb is exempt: «در نتیجه، فروش افزایش یافت.»

**FA-T1-17 Stock openers** — Bad: «البته، این کار می‌کند.» Good: «این کار می‌کند.»

**FA-T1b-01 Half-space before «تر»** — Bad: «این روش سریع تر است.» Good: «این روش سریع‌تر است.» Bad: «کم تر از ده» Good: «کمتر از ده». The one judgement: «تر» also means "wet". «نان تر» and «تر و تازه» are left alone.

**FA-T1b-02 Mixed digits** — Bad: «در ۳ مرحله، ۵ بخش و 7 فایل کار کنید.» Good: «در ۳ مرحله، ۵ بخش و ۷ فایل کار کنید.» Persian digits dominate, so the Latin 7 is flagged. Identifiers and versions («React 18», «2.1.0») are exempt.

**FA-T1b-03 Ezafe `ه‌ی`** — Bad: «همه‌ی مردم» Good: «همهٔ مردم». A house-style Check fix: the Academy's form, which you may dismiss.

**FA-T1b-04 Stiff officialese** — Bad: «جهت نصب برنامه، فایل را دانلود کنید.» Good: «برای نصب برنامه، فایل را دانلود کنید.» «جهت» is also the noun "direction": «از این جهت مهم است» is left alone.

**FA-T1b-05 Light-verb padding** — Bad: «داده‌ها مورد بررسی قرار گرفتند.» Good: «داده‌ها بررسی شدند.» Bad: «ما اقدام به نصب کردیم.» Good: «ما نصب کردیم.» The replacement verb takes the same tense and person.

**FA-T1b-06 Synonym doublets** — Bad: «سعی و تلاش ما بی‌نتیجه ماند.» Good: «تلاش ما بی‌نتیجه ماند.»

**FA-T1b-07 Loanwords** — Bad: «لیست کارها را چک کنید.» No `after` is produced. The rationale names «فهرست» and «بررسی کنید» and leaves the decision to the writer. Technical terms («کامپوننت», «سرور», «API») are never flagged.

**FA-T1b-08 Vague attribution** — Bad: «مطالعات نشان می‌دهد این روش سریع‌تر است.» No `after` is produced: this rule flags, it never proposes a fix. A person would resolve it as «چن و همکاران (۲۰۲۴) نشان دادند این روش ۳۰ درصد سریع‌تر است», or cut the claim.

## Generative fixes — need the shared LLM call, not a lookup

**FA-T1-18 Markdown leakage** — Bad: a mid-paragraph switch to a bolded bullet list with no structural reason. Good: rewritten as prose, or moved into an actual reference list. Not a mechanical strip of the markup.

**FA-T1-19 Hedging stack** — Bad: «شاید این تغییر احتمالاً به نوعی به بهبود پایداری کمک کند.» Good: «این تغییر پایداری را بهبود می‌دهد.» Three hedges stack in one sentence. Deleting just the hedges leaves «این تغییر به بهبود پایداری کمک کند», which is not a sentence; it needs a real rewrite.

**FA-T1-20 Sentence length** — Bad: a 41-word instruction: «پیش از آنکه نسخهٔ جدید را روی سرور اصلی اجرا کنید، ابتدا باید مطمئن شوید که نسخهٔ آزمایشی روی سرور دوم بدون خطا اجرا شده است و پایگاه داده نیز از آخرین وضعیت پشتیبان‌گیری شده است، سپس تغییرات را تأیید کنید.» Good: split into three sentences, each under 25 words: «ابتدا نسخهٔ آزمایشی را روی سرور دوم اجرا کنید و مطمئن شوید بدون خطا کار می‌کند. سپس از آخرین وضعیت پایگاه داده پشتیبان بگیرید. در پایان نسخهٔ جدید را روی سرور اصلی اجرا کنید.» Words are counted with the half-space joining: «می‌کند» is one word. Finding a grammatical split point is not mechanical. Farsi is verb-final, so each clause has to end on its own verb.

**FA-T1-21 Sentence-length variance** — Bad: five consecutive 14-word sentences. Good: vary it: a 5-word sentence after a 24-word one.

**FA-T1-23 Antithesis** — Bad: «این ابزار نه تنها سریع است، بلکه ایمن هم هست.» Good: «این ابزار هر درخواست را در ۱۲ میلی‌ثانیه پاسخ می‌دهد و ورودی‌ها را پیش از پردازش اعتبارسنجی می‌کند.» The contrast is replaced by the two facts it stood for. Bad: «این یک باگ نیست، یک ویژگی است.» Good: «این رفتار عمدی است.» Deletion alone does not produce this; the replacement has to be composed.

**FA-T1-24 «از X گرفته تا Y»** — Bad: «از معماری گرفته تا استقرار، همه‌چیز را پوشش می‌دهیم.» Good: «این راهنما معماری، استقرار و پایش را پوشش می‌دهد.» Name what is actually covered. «از ساعت ۸ تا ۱۰» is an ordinary range and is not flagged.

**FA-T1-25 False positivity** — Bad: «با وجود تأخیر، این تغییر پیشرفت بزرگی است.» Good: «این تغییر ۴۰ میلی‌ثانیه تأخیر اضافه می‌کند و در عوض زمان بازیابی را از ده دقیقه به دو دقیقه می‌رساند.» State the trade-off and let the reader weigh it.

## Mixed — a client-side check, a generative fix when it matters

**FA-T1b-09 One name per entity** — see tier2-examples.md for the full worked case; the detection and the fix both happen in the shared call.
