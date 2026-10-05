# Tier 2 Examples (Farsi) — Worked Reasoning

These are load-bearing, not illustrative. A judge only produces a consistent verdict once it has seen a full pair with the reasoning attached, not just a rule statement. The reasoning is in English; the Farsi is the real text, and it is the Farsi that the judge reads for the verdict.

**On the "Good" text below:** it is part of the reasoning. It is what makes the distinction between a real violation and a false positive concrete enough for a judge to apply consistently. It is not an `after` value. Per output-schema.md, no Tier 2 flag ever carries a proposed fix; the person resolves it with their own actual context in hand. Read every "Good" line below as "here is what distinguishes a pass from a fail," not "here is what to auto-generate."

## FA-T2-04 Personifying abstractions

Bad: «موتور قیمت‌گذاری تصمیم گرفت دستهٔ قدیمی‌تر را اول اعمال کند.»
Nothing decided anything: a first-in-first-out rule executed, deterministically. The sentence sounds confident but hides the fact the reader actually needs, which rule and under what condition.

Good, device used deliberately, passes: «کار تطبیق نبودِ شناسهٔ دسته را نمی‌بخشد و کل اجرا را متوقف می‌کند.»
Still personifying, but it compresses a real, verifiable behaviour into something memorable. Swapping the verb for the mechanism («کار تطبیق اگر شناسهٔ دسته نباشد، با کد خروج غیرصفر تمام می‌شود») loses nothing factual, and the personified version is the one a reader will remember. No fact was hidden to get there. Persian prose has a long literary tradition of this device, so in a flavoured section weigh whether it is deliberate before failing it.

Rule of thumb: replace the personified verb with the real mechanism. If the sentence loses its only concrete fact, fail. If it just loses colour, pass.

## FA-T2-01 Abstraction over specificity

Bad: «این ابزار عملکرد بسیار خوبی ارائه می‌دهد.»
No number, no comparison, nothing the reader can act on or verify.

Good: «این ابزار ۱۰ هزار ردیف را در ۳ ثانیه روی یک لپ‌تاپ معمولی پردازش می‌کند.»

Also good, and abstract on purpose: «این سریع‌ترین راهبرد ابطال حافظهٔ پنهان است که آزمودیم.»
Abstract, but placing weight on a result stated elsewhere in the document, the actual benchmark numbers. It is summarising, not hiding. Check whether the concrete backing exists nearby before failing an abstraction.

## FA-T2-02 Padding / restatement

Bad: «این مهاجرت پایداری را بهبود می‌دهد. این بدان معناست که سیستم برای کاربران قابل‌اعتمادتر و باثبات‌تر می‌شود و در نهایت تجربه‌ای پایدارتر فراهم می‌کند.»
Two sentences, one fact. The second restates the first three times («قابل‌اعتمادتر», «باثبات‌تر», «پایدارتر»).

Good: «این مهاجرت پایداری را بهبود می‌دهد: خطاهای تطبیق از ۴۰ مورد در هفته به ۳ مورد رسید.»

Test: delete the second sentence from the bad example. Nothing is lost. That is the fail condition.

## FA-T2-03 Hedging seesaw

Bad: «برخی معتقدند طرح جدید برای خواندن بهتر است و برخی دیگر طرح قدیمی را به‌خاطر نوشتن ساده‌تر ترجیح می‌دهند. هر دو مزایای خود را دارند.»
If the benchmark data elsewhere in the document already shows the new schema is faster for reads at no meaningful write cost, this sentence manufactures a debate the document's own evidence already settled.

Good: «طرح جدید خواندن را سریع‌تر می‌کند و سرعت نوشتن تغییری نکرده است.»

Test: does the surrounding document contain evidence that already resolves this? If yes, and the text still both-sides it, fail.

## FA-T2-05 Over-explaining the obvious

Bad, in a document written for backend engineers: «API مجموعه‌ای از پروتکل‌هاست که به برنامه‌های نرم‌افزاری مختلف اجازه می‌دهد با هم ارتباط برقرار کنند. API ما صفحه‌بندی را پشتیبانی می‌کند.»

Good: «API ما صفحه‌بندی را پشتیبانی می‌کند.»

Test: the stated or implied audience already knows this. Explaining it is not neutral: it signals the writer does not know who is reading, which undercuts trust in the parts of the document that are actually new.

## FA-T2-06 Restatement disguised as meta-commentary

Bad: «در پایان، مهم‌ترین ملاحظات این مهاجرت را مرور کردیم و مبادلات آن را بررسی کردیم.»
Says nothing that was not already said, once, in the sections it points back at.

Good, exempt as functional signposting: «بخش ۲ الگوریتم تخصیص FIFO را شرح می‌دهد. بخش ۳ آن را با سه راهبرد پایه مقایسه می‌کند.»
A real roadmap: a reader skimming or citing later needs it, and it carries information (what is specifically in section 3) that a title alone does not.

Test: strip the sentence out. Roadmap sentences cost the reader something if removed: they lose the ability to navigate. Restatement sentences cost nothing.

## FA-T1b-09 One name per entity, worked case

Bad: «کاربر فرم را باز می‌کند. مشتری دکمهٔ ارسال را می‌زند. استفاده‌کننده تأییدیه را می‌بیند.»
Three words for one person. The reader has to do extra work confirming they are the same, and it reads as three actors.

Also bad, in Farsi's characteristic form: one thing under a loanword and a native word. «فایل را ذخیره کنید. سپس پرونده را ببندید.» If both name the same object, pick one. The same applies to variant spellings of one loanword («کامپوننت» and «مؤلفه» for the same thing, each used without the other being introduced).

Good: «کاربر فرم را باز می‌کند، دکمهٔ ارسال را می‌زند و تأییدیه را می‌بیند.»

Legitimate exception, not a violation: a gloss at first mention, «کامپوننت (مؤلفه)», after which one name is used throughout. And deliberate repetition for rhythm: «نوشتیم. آزمودیم. اصلاح کردیم. منتشر کردیم.» Repeating the same referent and pattern on purpose, for cadence, is not synonym rotation. It passes because it is motivated, not reflexive.

Also bad, for the opposite reason: rewriting «استفاده می‌کنیم» five times in a paragraph as «بهره می‌بریم / به کار می‌گیریم / از آن سود می‌جوییم / مورد استفاده قرار می‌دهیم» to avoid repetition. This inflates vocabulary to dodge a structural problem instead of fixing it. Restructure so the predicate does not have to fire five times.

## FA-T2-07 Rule of three

Bad, decorative: «سریع، قابل‌اعتماد و مقیاس‌پذیر.»
Three adjectives describing one subject, no content behind any of them.

Good, decorative but passes: used once, doing real work, sparingly, in a flavoured section: «مهاجرت سریع بود، تمیز بود و کسل‌کننده؛ دقیقاً آنچه یک مهاجرت پایگاه داده باید باشد.» The third item lands as the actual point of the sentence, not a filler match for the first two.

Good, necessary enumeration, always passes regardless of mode: «ستون‌های `name`، `category` و `image_url` حذف می‌شوند.» Three specific field names, not descriptive filler. This happens to match the rule-of-three shape but is naming three different real things. Failing this would mean rewriting real technical content to dodge a pattern-matcher, which is backwards.

Test: are the three items interchangeable descriptors of one thing, or three different real things that all happen to need naming here? The first is decorative. The second is enumeration.

## FA-T2-08 Participial tack-on

Bad, unsupported: «جدول قیمت را به دسته‌بندی FIFO منتقل کردیم که باعث بهبود پایداری و کاهش خطاهای تطبیق شد.»
Nothing elsewhere in the document backs either claim: no numbers, no follow-up anywhere. The clause is doing the work a citation should be doing.

Good, grounded even without a number: «شرکا به ساختار فعلی پاسخ API وابسته‌اند. تغییر در ۱۶ ژوئن نوشته شد و در ۲۸ ژوئیه برای نخستین بار به تولید رسید، که همین ساختار را شکست.»
No number inside the final clause, but the sentence before it already established exactly what is at stake. The claim is entailed by context that is already there; it does not need a number to be verifiable.

Test: could a skeptical reader check this claim against something already stated in the document? If yes, pass, number or not. If the claim exists only inside the tacked-on clause and nowhere else, fail.

## FA-T2-09 Ezafe pile-up

Bad: «بررسی تأثیر عوامل مؤثر بر کیفیت خدمات ارائه‌شده به کاربران»
Read it aloud: *barrasi-ye ta'sir-e avamel-e mo'asser bar keyfiyyat-e khadamat-e erâ'e-shode*. Five words are linked by ezafe, and every link is an abstract noun. The reader has to rebuild the structure to see what modifies what, and the sentence has no verb to anchor it.

Good: «بررسی کردیم که چه عواملی بر کیفیت خدماتی که به کاربران ارائه می‌شود اثر می‌گذارند.»
The same content, with the chain unpacked by a verb and two relative clauses. Nothing was lost; the reader now sees who does what.

Passes: «سامانهٔ مدیریت پایگاه داده» is four words linked by ezafe, but it is established terminology: the reader takes it as one unit. «فایل پیکربندی سرور تولید» passes because each link is a concrete named thing.

Test: can a reader take the phrase in one pass? If it is fixed terminology or every link is concrete, pass. If the links are abstract and a verb or preposition would unpack them, fail.

## FA-T2-10 Hidden agent

Bad, in a postmortem: «تصمیم گرفته شد که استقرار متوقف شود و موضوع مورد بررسی قرار گرفت.»
Two decisions and one investigation, and no one is behind any of them. A reader trying to learn from the incident cannot tell who to ask, or whether anyone was responsible for the outcome.

Good: «سارا استقرار را متوقف کرد و تیم زیرساخت علت را بررسی کرد.»

Passes, the actor is the natural subject: «پیش از اجرا، از پایگاه داده پشتیبان گرفته می‌شود.» In a technical description of a script, the script is the actor, and naming it adds nothing.
Passes, the actor is irrelevant: «نسخهٔ جدید ۱۲ مارس منتشر شد.»

Test: would the reader be able to act on, verify or question the sentence if told who acts? If yes, and the document does not say, fail. If the actor is obvious, irrelevant, or the reader themself, pass.

## FA-T2-11 Translationese

Bad: «در پایان روز، این ابزار بازی را تغییر می‌دهد و در رابطه با عملکرد، یک گام بزرگ به جلو است.»
Four calques in one sentence: «در پایان روز» (at the end of the day), «بازی را تغییر می‌دهد» (changes the game), «در رابطه با» (in relation to), «یک گام بزرگ به جلو» (a big step forward). Each is word-for-word English. A native writer reaching for the point would say what the tool does.

Good: «این ابزار سرعت اجرا را دو برابر می‌کند.»
The claim is stated directly, with a fact, in Farsi word order, verb last.

Passes: established technical terms («ردگیری خطا», «ابطال حافظهٔ پنهان»), and a passage clearly marked as a translation. A calque is not a violation if the document is quoting.

Test: would a native writer, writing this from scratch for this reader, choose this phrasing? If a plain Farsi equivalent exists with no loss, fail.

## FA-T2-12 Register mixing

Bad: «ابتدا فایل را باز کنید. سپس دکمهٔ ذخیره رو بزنید و صبر کنید تا تغییرات ثبت بشه.»
The passage opens formal («را باز کنید») and shifts mid-way into colloquial («رو», «بشه»). A reader notices the lurch.

Good, consistently formal, passes: «ابتدا فایل را باز کنید. سپس دکمهٔ ذخیره را بزنید و صبر کنید تا تغییرات ثبت شود.»
Good, consistently colloquial, also passes: «اول فایل رو باز کن. بعد دکمهٔ ذخیره رو بزن و صبر کن تا تغییرات ثبت بشه.»
Neither register is the guide's standard. Only the shift is a problem, and the person chooses the direction to resolve it.

Test: would the reader notice the shift? Quoted speech and dialogue are exempt. Judge the passage, not the document: a formal specification with a colloquial aside in a clearly separate section is two passages.
