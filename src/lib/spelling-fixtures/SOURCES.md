# English spelling fixture — sources and baseline

`en-typos.tsv` is the test set that gates switching Jot's spelling engine from
nspell to Hunspell-WASM (open decision #30): Hunspell plus Jot's ranking
(`src/lib/spelling.ts`) must give the answers recorded in `en-baseline.json`,
except where this report says today's answer is wrong.

- `en-typos.tsv` — 499 cases. Columns: `typed`, `expected` (empty = must come
  back `null`: a real word, a name, a code-ish token, a word under 3 letters),
  `kind`, `source`, `before` (the text before the word on its line; empty for
  all but the sentence-start group).
- `en-baseline.json` — today's `suggestionFor(spell, typed, before)` for every
  case, in the same order: `{ typed, before, fixes, sure }`, `null`s kept.
- `baseline.test.ts` — rewrites the baseline. Skipped unless asked for:

  ```bash
  SPELL_BASELINE=1 pnpm vitest run src/lib/spelling-fixtures
  ```

Recorded 2026-11-21 against `main` at 57f60dd (dictionary and `en.freq` as in
`public/dict/`).

## Sources and licences

Every case was **written for Jot** (`source` starts with `authored`), under the
repo's MIT licence. No list was copied from any corpus, because none of them
can be redistributed in an MIT repo:

| Source | Licence | Used for |
|---|---|---|
| Wikipedia, *Lists of common misspellings* (incl. the "For machines" page, and Mitton's `wikipedia.dat` built from it) | CC BY-SA 4.0 — share-alike, so a copied list would have to stay CC BY-SA, not MIT | attestation only |
| Birkbeck spelling error corpus, Roger Mitton (`missp.dat`; originals at the Oxford Text Archive) | no licence stated on the download page | attestation only |
| Holbrook corpus (Mitton, from *English for the Rejected*, 1964) | no licence stated; used by Mitton with the publisher's permission | attestation only |
| Aspell test data, Kevin Atkinson (`batch0.tab`, via Mitton's `aspell.dat`) | no licence stated; aspell.net/test is no longer reachable | attestation only |
| Norvig, *How to Write a Spelling Corrector* (`spell-testset1.txt`, `-2.txt`, drawn from Birkbeck) | no licence stated | attestation only |

**Attestation.** The corpora were downloaded outside the repo and used only to
check that a hand-written case is a real human error: when the same
`typed → expected` pair appears in a corpus, the `source` column says so
(`authored; attested: wikipedia,birkbeck`). 294 of the 388 typo cases are
attested (wikipedia 220, birkbeck 208, norvig 43, holbrook 31, aspell 49 —
a case can be in several). A single misspelling and its correction is a fact,
not an expression, so naming where it also occurs copies nothing.

The unattested cases are keyboard slips the corpora don't collect (they are
handwriting and spelling tests): almost all of `neighbour` (QWERTY, e.g.
`rhe`, `wprk`), most of `extra` (`thje`, `anmd`) and some `dropped`
(`softwre`, `keybord`) — the slips a writer in a markdown editor actually
makes.

## Curation

- Lower-case single words, deduplicated by `(typed, before)`. Each kind is the
  slip that *most* explains the error (`recieve` is a swap, `definately` is
  phonetic).
- Unattested `swap`, `doubled` and `phonetic` cases were dropped in favour of
  attested ones; British/American trimmed to 21 spellings and their pairs.
- Left out where the right answer is genuinely two words: `lisence`
  (licence/license), `skillfull` (skilful/skillful), `nieghbor`
  (neighbour/neighbor), `judgemental` (valid British).
- `british-american`: both spellings must be accepted, never "fixed" —
  expected empty.
- `leave-alone`: commonly confused real words (form/from, its, quiet/quite),
  real words that look like a missing apostrophe (`cant`, `wont`, `lets`,
  `ill`, `were`), `alot` (Jot's `NEVER` list), words under 3 letters, and
  tokens `suggestionFor` must not touch (`useState`, `foo_bar`, `README`,
  `iPhone`, `x2`, `they're`).
- `sentence-start`: capitalised typos after `""`, `. `, `# `, `## `, `- `,
  `* `, `+ `, `> `, `1. `, `Done! `, `Really? ` (fixes keep the capital); plus
  14 that must stay `null` — correct words at a sentence start (`The`,
  `Colour`, `London`, `Tuesday`), capitals mid-sentence (`I met |Teh`, a name),
  and all-caps `TEH`.

| kind | cases |
|---|---:|
| swap | 64 |
| doubled (doubled / undoubled letter) | 60 |
| dropped | 60 |
| extra | 29 |
| neighbour | 51 |
| phonetic | 65 |
| apostrophe | 32 |
| sentence-start | 41 (27 typos, 14 left alone) |
| british-american | 42 |
| leave-alone | 55 |
| **total** | **499** (388 typos, 111 left alone) |

## Report — today's behaviour (nspell + Jot's ranking)

Top-1: the first fix (what a click applies) is the expected word. Top-4: it is
anywhere in the menu. Sure: the case would be changed by "fix all".

| kind | cases | typos | top-1 | top-4 | not marked | sure | sure but wrong | must be left alone | wrongly marked |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| swap | 64 | 64 | 62 (97%) | 64 (100%) | 0 | 59 (92%) | 0 | – | – |
| doubled | 60 | 60 | 58 (97%) | 59 (98%) | 1 | 49 (82%) | 0 | – | – |
| dropped | 60 | 60 | 55 (92%) | 56 (93%) | 1 | 49 (82%) | 0 | – | – |
| extra | 29 | 29 | 24 (83%) | 29 (100%) | 0 | 5 (17%) | 1 | – | – |
| neighbour | 51 | 51 | 49 (96%) | 51 (100%) | 0 | 30 (59%) | 2 | – | – |
| phonetic | 65 | 65 | 59 (91%) | 63 (97%) | 1 | 26 (40%) | 1 | – | – |
| apostrophe | 32 | 32 | 25 (78%) | 29 (91%) | 2 | 18 (56%) | 0 | – | – |
| sentence-start | 41 | 27 | 27 (100%) | 27 (100%) | 0 | 19 (70%) | 0 | 14 | 0 |
| british-american | 42 | – | – | – | – | – | – | 42 | 0 |
| leave-alone | 55 | – | – | – | – | – | – | 55 | 0 |
| **total** | 499 | 388 | 359 (93%) | 378 (97%) | 5 | 255 (66%) | 4 | 111 | 0 |

### Sure but wrong — "fix all" would change these to the wrong word

- `abnd` → band, and, abed (expected and) — extra
- `abd` → bad, and, abed, add (expected and) — neighbour
- `frim` → firm, from, grim, trim (expected from) — neighbour
- `persue` → peruse, pursue (expected pursue) — phonetic

All four are one-letter slips where a rarer word wins on edit cost alone; the
commonness push (`RARITY`) is too small to overturn it, and the gap to the
second fix still clears `SURE_GAP`.

### Wrongly marked — should have been left alone

None. (`wether` was dropped from the fixture: it isn't in the dictionary, and
the corpora list it as a misspelling of both *weather* and *whether*, so it
has no one right answer.)

### Top fix is not the expected word (not sure, so a click is wrong but "fix all" leaves it)

- `htis` → hits, this — swap
- `tiem` → item, time — swap
- `comited` → vomited, committed — doubled
- `rember` → member, ember (remember not offered) — dropped
- `accidently` → anciently (accidentally not offered) — dropped
- `incidently` → indigently (incidentally not offered) — dropped
- `evry` → very, every — dropped
- `fourty` → fourth, forty — extra
- `potatoe` → potatoes, potato — extra
- `hellow` → yellow, hello — extra
- `helpe` → helped, helps, helper, help — extra
- `posess` → poses, possess — phonetic
- `tounge` → lounge (tongue not offered) — phonetic
- `compatable` → comparable, compatible — phonetic
- `visable` → viable, visible — phonetic
- `arent` → parent, aren't — apostrophe
- `ive` → five, give, live, vie (I've not offered) — apostrophe
- `theres` → threes, there's — apostrophe
- `itll` → till, it'll — apostrophe
- `aint` → saint, ain't — apostrophe

### Typos not marked at all

- `proffesional`, `wendsday`, `maintainance` — nspell offers nothing within
  `MAX_COST` (two slips each).
- `whats`, `hes` — the dictionary knows them as words (plurals: "the whats and
  whys", "hes and shes"), so they are never checked.

### Where the switch should not copy today

The switch must match the baseline everywhere above **except** these, where
matching would copy a mistake: the four sure-but-wrong cases (they must at
least stop being sure), `comited → vomited`, `tounge → lounge`,
`accidently → anciently`, `incidently → indigently`, and the apostrophe
cases where an unrelated word beats the contraction (`arent`, `theres`,
`itll`, `aint`, `ive`). An engine that does better on those is a pass.
