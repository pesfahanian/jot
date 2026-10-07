import type { Candidate, FixRequest, PassAResult, RawFlag } from '../passA'
import { analyzeProse, type Sentence } from '../text'
import { L, M, W, WB, WE, Z, countWordsFa, farsiSentences, isArabicText, isFarsiText, normalise, unitAt } from './text'
import {
  aiTell,
  conjugate,
  doublets,
  eligibleNouns,
  inflatedVerbs,
  joinedComparatives,
  lightVerbRows,
  loanwords,
  marketing,
  officialeseBe,
  openers,
  slips,
  stiffConnectors,
  transitions,
  verbPattern,
  verbs,
  wetWords,
  type Fix,
} from './vocab'
import { entryPattern } from './text'

// Pass A for Farsi documents (ruleset/fa/checks.md): every client-side
// rule, before the shared call. Orthography is never the model's job here —
// all of it is decided below, each fix a suggestion the person decides on.
// The patterns are the guide's own; its test tables run as unit tests
// (fa/passA.test.ts).

const PRES = [...verbs.values()].map((v) => v.present).sort((a, b) => b.length - a.length).join('|')
const PAST = [...verbs.values()].map((v) => v.past).sort((a, b) => b.length - a.length).join('|')
const VERBFORM = `(?:(?:${PRES})(?:م|ی|د|یم|ید|ند)|(?:${PAST})(?:م|ی|یم|ید|ند|))${WE}`

// ---- detectors the guide's "Fires?" tables test directly ----

const HEDGE = new RegExp(
  `${WB}(?:شاید|احتمالاً|احتمالا|ممکن\\s+(?:است|بود)|به\\s+نظر\\s+می[ ${Z}]?رسد|تا\\s+حدی|تا\\s+حدودی|به\\s+نوعی|بعضاً|بعضا|می[ ${Z}]?تواند|می[ ${Z}]?توانند|می[ ${Z}]?توان)${WE}`,
  'gu',
)
export const hedgeCount = (s: string) => (s.match(HEDGE) ?? []).length

const IMPERATIVE = new RegExp(`^(?:(?:ن|ب)?(?:${PRES})ید|ب(?:${PRES}))$`, 'u')
export function isInstruction(sentence: string, listItem = false): boolean {
  if (listItem) return true
  const words = sentence.replace(/[.!؟?…»"”')\]]+$/u, '').trim().split(/\s+/)
  return IMPERATIVE.test(words[words.length - 1] ?? '')
}

const R23a = new RegExp(`${WB}نه\\s+(?:تنها|فقط|صرفاً|صرفا)\\s+[^.!؟\\n]{1,120}?[،,]?\\s*بلکه\\s`, 'u')
const R23b = new RegExp(`${WB}نه\\s+[^.!؟\\n،]{1,60}?[،]?\\s*بلکه\\s`, 'u')
const R23c = new RegExp(`${WB}نیست(?:ند)?[،؛,]\\s+(?:بلکه\\s+)?(?!اما|ولی|لیکن|ولیکن)[^.!؟\\n]{1,80}?\\s(?:است|هستند|هست)${WE}`, 'u')
export const isAntithesis = (s: string) => R23a.test(s) || R23b.test(s) || R23c.test(s)

const R24 = new RegExp(`${WB}از\\s+[^.!؟\\n]{1,60}?\\s+گرفته\\s+تا\\s`, 'gu')
export const isSweeping = (s: string) => new RegExp(R24.source, 'u').test(s)

const R25 = new RegExp(`(?:^|(?<=[.!؟]\\s)|(?<=\\n))(?:با\\s+وجود|علی${Z}?رغم|به${Z}?رغم)\\s+[^،.!؟\\n]{2,100}،`, 'gmu')
export const isDespite = (s: string) => new RegExp(R25.source, 'mu').test(s)

const R1b08 = new RegExp(
  `${WB}(?:مطالعات|تحقیقات|پژوهش[ ${Z}]?ها|پژوهشگران|کارشناسان|متخصصان|محققان|آمارها|گزارش[ ${Z}]?ها|بررسی[ ${Z}]?ها)\\s+` +
    `(?:نشان\\s+می[ ${Z}]?(?:دهند|دهد)|می[ ${Z}]?گویند|معتقدند|بر\\s+این\\s+باورند|تأیید\\s+می[ ${Z}]?کنند|حاکی(?:\\s+از)?)${WE}`,
  'gu',
)
// Sourced when the next 16 tokens hold a link, a year, a parenthetical with a
// digit, or a capitalised Latin word.
const sourced = (after: string) => {
  const next = after.trim().split(/\s+/).slice(0, 16).join(' ')
  return /https?:\/\/|www\./.test(next) || /(?:^|[^0-9۰-۹])(?:1[34]|19|20)[0-9]{2}(?![0-9])|(?:۱[۳۴]|۱۹|۲۰)[۰-۹]{2}(?![۰-۹])/.test(next) || /\([^)]*[0-9۰-۹][^)]*\)/.test(next) || /(?:^|\s)[A-Z][a-z]/.test(next)
}
export function vagueAttributions(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  for (const m of text.matchAll(R1b08)) if (!sourced(text.slice(m.index + m[0].length))) out.push({ start: m.index, end: m.index + m[0].length })
  return out
}

// ---- the pass ----

export function runPassAFa(text: string): PassAResult {
  const prose = analyzeProse(text)
  const { masked } = prose
  const norm = normalise(masked)
  const sentences = farsiSentences(prose)
  prose.sentences = sentences
  prose.words = sentences.reduce((n, s) => n + s.words, 0)
  const flags: RawFlag[] = []
  const fixRequests: FixRequest[] = []
  const candidates: Candidate[] = []
  let refSeq = 0
  const requestFix = (r: Omit<FixRequest, 'ref'>) => {
    const ref = `f${++refSeq}`
    fixRequests.push({ ...r, ref })
    return ref
  }
  const slice = (a: number, b: number) => text.slice(a, b)
  const inProse = (pos: number) => prose.blocks.some((b) => pos >= b.from && pos < b.to)
  // A match is discarded if any character of it differs in the original —
  // a space that exists only because code was blanked is never "fixed".
  const real = (a: number, b: number) => masked.slice(a, b) === text.slice(a, b)
  const sentenceAt = (pos: number): Sentence | undefined => sentences.find((s) => pos >= s.from && pos < s.to)
  const unit = (pos: number) => {
    const s = sentenceAt(pos)
    return s ? unitAt(text, s, pos) : null
  }
  const inFarsi = (pos: number) => {
    const u = unit(pos)
    return !!u && isFarsiText(masked.slice(u.from, u.to))
  }
  // Spacing and digits are judged by the whole sentence, quotes included.
  const inFarsiSentence = (pos: number) => {
    const s = sentenceAt(pos)
    return !!s && isFarsiText(masked.slice(s.from, s.to))
  }
  const inArabic = (pos: number) => {
    const u = unit(pos)
    return !!u && isArabicText(text.slice(u.from, u.to))
  }
  function* matches(re: RegExp, on = norm) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    for (const m of on.matchAll(g)) {
      if (!m[0].length || !inProse(m.index) || !real(m.index, m.index + m[0].length)) continue
      yield m
    }
  }
  const flag = (id: string, start: number, end: number, after: string | null, rationale: string) =>
    flags.push({ id, family: id.startsWith('FA-T1b') ? 'tier1b' : 'tier1', start, end, span: slice(start, end), after, rationale })
  // The word after a position, past spaces and a comma — inside its
  // sentence, unless the phrase before it ends one (an opener like
  // «سؤال خوبی است!»).
  const nextWord = (at: number, acrossSentences = false) => {
    const m = text.slice(at).match(new RegExp(`^[ \\t]*[،,]?[ \\t]*([${W}A-Za-z0-9]+)`, 'u'))
    if (!m) return null
    const to = at + m[0].length
    const s = sentenceAt(at - 1)
    if (s && to > s.to && !acrossSentences) return null
    return { from: to - m[1].length, to }
  }

  // ── orthography and typography ──────────────────────────────────────────

  // FA-T1-01 Half-space after می / نمی / همی, before a known verb form.
  for (const m of matches(new RegExp(`${WB}((?:بر|در|باز|فرا|فرو|وا)?ن?می)([ ${Z}]?)(?=${VERBFORM})`, 'u'))) {
    if (m[2] === Z) continue
    const start = m.index
    const verbStart = start + m[0].length
    const verb = norm.slice(verbStart).match(new RegExp(`^[${W}]+`, 'u'))?.[0]
    if (!verb) continue
    flag('FA-T1-01', start, verbStart + verb.length, `${m[1]}${Z}${slice(verbStart, verbStart + verb.length)}`, 'می / نمی is written with a half-space before the verb (Dastur p.39).')
  }

  // FA-T1-02 Half-space before the plural ها.
  const HA = '(?:ها(?:ی(?:ی|م|ت|ش|مان|تان|شان)?)?)'
  for (const re of [new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (${HA})${WE}`, 'u'), new RegExp(`${WB}([${W}]*[${L}](?<![اآو])ه)(${HA})${WE}`, 'u')]) {
    for (const m of matches(re)) flag('FA-T1-02', m.index, m.index + m[0].length, `${m[1]}${Z}${m[2]}`, 'The plural ها takes a half-space, not a space; after a silent ه it is never joined (Dastur p.40–41).')
  }

  // FA-T1-03 Half-space before ترین (the joined comparatives excepted).
  for (const m of matches(new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (ترین)${WE}`, 'u'))) {
    const after = joinedComparatives.has(m[1]) ? m[1] + m[2] : `${m[1]}${Z}${m[2]}`
    flag('FA-T1-03', m.index, m.index + m[0].length, after, 'ترین takes a half-space, not a space (Dastur p.40).')
  }

  // FA-T1-04 Half-space before clitics after a silent ه.
  const CL = '(?:ام|ای|ایم|اید|اند|ات|اش|مان|تان|شان)'
  for (const m of matches(new RegExp(`${WB}([${W}]*ه) (${CL})${WE}`, 'u'))) {
    if (/^(که|چه|به)$/.test(m[1])) continue
    flag('FA-T1-04', m.index, m.index + m[0].length, `${m[1]}${Z}${m[2]}`, 'After a silent ه a clitic takes a half-space (Dastur p.43–44).')
  }
  for (const m of matches(new RegExp(`${WB}([${W}]*[دت]ه)(ام|ای|ایم|اید|اند)${WE}`, 'u'))) {
    if (m[1] === 'اته') continue
    flag('FA-T1-04', m.index, m.index + m[0].length, `${m[1]}${Z}${m[2]}`, 'After a silent ه a clitic takes a half-space (Dastur p.43–44).')
  }

  // FA-T1-05 Ezafe after a silent ه written as a detached ی.
  for (const m of matches(new RegExp(`${WB}([${W}]*ه) ی(?= [${L}])`, 'u'))) {
    if (/^(که|چه|به)$/.test(m[1])) continue
    flag('FA-T1-05', m.index, m.index + m[0].length, `${m[1]}ٔ`, 'The ezafe after a silent ه is written هٔ (Dastur p.46).')
  }

  // FA-T1-06 Arabic letters for Persian (on the unnormalised text).
  for (const m of matches(/[يىك]/u, masked)) {
    if (inArabic(m.index)) continue
    flag('FA-T1-06', m.index, m.index + 1, m[0] === 'ك' ? 'ک' : 'ی', 'Arabic letter where Persian has its own (ی, ک).')
  }

  // FA-T1-07 Arabic-Indic digits.
  for (const m of matches(/[٠-٩]+/u, masked)) {
    if (inArabic(m.index)) continue
    flag('FA-T1-07', m.index, m.index + m[0].length, [...m[0]].map((c) => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x06f0)).join(''), 'Arabic-Indic digits; Persian uses ۰–۹.')
  }

  // FA-T1-08 Latin , ; ? in a Farsi sentence.
  for (const m of matches(/(?<![0-9]),(?![0-9])|;|\?/u)) {
    if (!inFarsi(m.index)) continue
    if (m[0] === ';' && /&[a-z0-9#]+$/i.test(text.slice(Math.max(0, m.index - 10), m.index))) continue
    flag('FA-T1-08', m.index, m.index + 1, m[0] === ',' ? '،' : m[0] === ';' ? '؛' : '؟', 'Latin punctuation in a Farsi sentence.')
  }

  // FA-T1-09 Spacing around punctuation and brackets, in a Farsi sentence.
  const spacing: [RegExp, (m: RegExpMatchArray) => string][] = [
    [new RegExp(`(?<=[${L}${M}\\p{N}»)\\]]) +([،؛؟!:.])(?=\\s|$)`, 'u'), (m) => m[1]],
    [new RegExp(`(?<=[${L}${M}])([،؛؟])(?=[${L}\\p{N}])`, 'u'), (m) => `${m[1]} `],
    [new RegExp(`([(\\[«]) +(?=[${L}\\p{N}])`, 'u'), (m) => m[1]],
    [new RegExp(`(?<=[${L}${M}\\p{N}!؟.،]) +([)\\]»])`, 'u'), (m) => m[1]],
  ]
  for (const [re, after] of spacing) {
    for (const m of matches(re)) {
      if (!inFarsiSentence(m.index)) continue
      flag('FA-T1-09', m.index, m.index + m[0].length, after(m), 'Spacing around punctuation (Virastar; typesetting convention).')
    }
  }

  // FA-T1-10 Straight or curly double quotes in a Farsi sentence → « ».
  for (const b of prose.blocks) {
    const para = masked.slice(b.from, b.to)
    const straightOk = ((para.match(/"/g) ?? []).length & 1) === 0
    for (const re of [...(straightOk ? [/"([^"\n]{1,200}?)"/g] : []), /“([^“”\n]{1,200}?)”/g]) {
      for (const m of para.matchAll(re)) {
        const start = b.from + m.index
        const end = start + m[0].length
        if (!real(start, end)) continue
        const s = sentenceAt(start)
        if (!s || !isFarsiText(masked.slice(s.from, s.to).replace(m[0], ' '))) continue
        flag('FA-T1-10', start, end, `«${m[1]}»`, 'Persian quotes are « ».')
      }
    }
  }

  // FA-T1-11 Doubled spaces inside a prose line.
  for (const m of matches(/(?<=\S)[ \t]{2,}(?=\S)/u)) flag('FA-T1-11', m.index, m.index + m[0].length, ' ', 'Doubled space.')

  // FA-T1-12 Kashida.
  for (const m of matches(new RegExp(`([${L}${M}])ـ+(?=[${L}${M}])`, 'u'), masked)) {
    if (inArabic(m.index)) continue
    const end = m.index + m[0].length + 1
    flag('FA-T1-12', m.index, end, m[1] + text[end - 1], 'Kashida (ـ) stretches a word; Persian text leaves it out.')
  }
  for (const m of matches(/(?<=\s)ـ+(?=\s)/u, masked)) {
    if (inArabic(m.index)) continue
    flag('FA-T1-12', m.index, m.index + m[0].length, '–', 'A spaced kashida standing in for a dash.')
  }

  // FA-T1-13 Stray half-space.
  for (const m of matches(/‌+/u, masked)) {
    if (m[0].length > 1) {
      flag('FA-T1-13', m.index, m.index + m[0].length, Z, 'A doubled half-space.')
      continue
    }
    const prev = masked[m.index - 1] ?? ''
    const next = masked[m.index + 1] ?? ''
    const okLeft = new RegExp(`[${L}${M}A-Za-z\\p{N}]`, 'u').test(prev)
    const okRight = new RegExp(`[${L}]`, 'u').test(next) || /\p{N}/u.test(next)
    if (okLeft && okRight) continue
    const start = prev ? m.index - 1 : m.index
    const end = next ? m.index + 2 : m.index + 1
    if (end - start < 2) continue
    flag('FA-T1-13', start, end, prev + next, 'A half-space where none belongs.')
  }

  // FA-T1-14 Mis-spaced words (closed list).
  for (const s of slips) {
    for (const m of matches(new RegExp(s.re, 'u'))) flag('FA-T1-14', m.index, m.index + m[0].length, s.standard, `Standard spelling: ${s.standard} (Dastur).`)
  }

  // ── style ───────────────────────────────────────────────────────────────

  // FA-T1-15 Banned vocabulary — replace, cut (through the next word), or a
  // rewrite for guidance; the inflated verbs in every tense and person.
  const banned = (entry: { banned: string; fix: Fix; re: string }) => {
    for (const m of matches(new RegExp(entry.re, 'u'))) {
      const start = m.index
      const end = start + m[0].length
      const rationale = `Banned vocabulary — ${entry.banned}${entry.fix.type === 'replace' ? ` → ${entry.fix.word}` : ''} (banned-vocabulary.md).`
      if (entry.fix.type === 'replace') flag('FA-T1-15', start, end, entry.fix.word, rationale)
      else if (entry.fix.type === 'cut') {
        const nw = nextWord(end)
        if (nw) flag('FA-T1-15', start, nw.to, slice(nw.from, nw.to), rationale)
        else requestFix({ ruleId: 'FA-T1-15', family: 'tier1', start, end, span: slice(start, end), instruction: `Remove «${slice(start, end)}» and repair the sentence around it.`, rationale })
      } else {
        requestFix({
          ruleId: 'FA-T1-15',
          family: 'tier1',
          start,
          end,
          span: slice(start, end),
          instruction: `Replace «${slice(start, end)}»: ${entry.fix.text}. Write only the replacement, in Farsi.`,
          rationale: `Banned vocabulary — ${entry.banned}: ${entry.fix.text} (banned-vocabulary.md).`,
        })
      }
    }
  }
  for (const e of [...aiTell, ...marketing, ...officialeseBe]) banned(e)
  for (const v of inflatedVerbs) {
    const { re, keyOf } = verbPattern(v.banned)
    for (const m of matches(new RegExp(re, 'u'))) {
      const key = keyOf(m[0])
      const after = key ? conjugate(v.plain, key) : null
      if (after) flag('FA-T1-15', m.index, m.index + m[0].length, after, `Officialese verb — ${v.banned} → ${v.plain}, in the same tense and person.`)
    }
  }

  const paras = prose.blocks.filter((b) => b.kind === 'paragraph')

  // FA-T1-16 Stock transitions at paragraph starts — above one per three
  // consecutive paragraphs; a real causal verb exempts the sentence.
  const CAUSAL = /باعث|منجر|موجب|افزایش|کاهش|بهبود|بیشتر از|کمتر از|سریع‌تر از/u
  const opening = (b: { from: number }, list: string[]) => {
    const head = norm.slice(b.from)
    for (const t of list) {
      const m = head.match(new RegExp(`^${entryPattern(t)}`, 'u'))
      if (m) return m[0].length
    }
    return 0
  }
  const transitionsAt = paras.map((b) => {
    const len = opening(b, transitions)
    if (!len) return null
    const s = sentenceAt(b.from)
    if (s && CAUSAL.test(norm.slice(s.from, s.to))) return null
    const nw = nextWord(b.from + len)
    return nw ? { start: b.from, end: nw.to, after: slice(nw.from, nw.to) } : null
  })
  const hot = new Set<number>()
  for (let i = 0; i < transitionsAt.length; i++) {
    const win = [i, i + 1, i + 2].filter((k) => k < transitionsAt.length && transitionsAt[k])
    if (win.length > 1) win.forEach((k) => hot.add(k))
  }
  for (const k of [...hot].sort((a, b) => a - b)) {
    const t = transitionsAt[k]!
    flag('FA-T1-16', t.start, t.end, t.after, 'Stock transitions at the start of two paragraphs in three. Flagged as part of that count.')
  }

  // FA-T1-17 Stock openers at a section start.
  for (const b of prose.blocks) {
    if (!b.sectionStart || b.kind === 'heading') continue
    const len = opening(b, openers)
    if (!len) continue
    const nw = nextWord(b.from + len, true)
    if (nw) flag('FA-T1-17', b.from, nw.to, slice(nw.from, nw.to), 'A stock opener at the start of a section.')
  }

  // FA-T1-18 Markdown leakage — as the English T1-04.
  for (const b of paras) {
    const t = text.slice(b.from, b.to)
    if (t.search(/(^|\s)[•◦▪]\s/) !== -1 || t.search(/\S\s+#{1,6}\s+\S/) !== -1) {
      requestFix({ ruleId: 'FA-T1-18', family: 'tier1', start: b.from, end: b.to, span: t, instruction: 'List or heading markup has leaked into this prose paragraph. Rewrite it as plain Farsi prose, keeping every fact.', rationale: 'Markdown leakage — list or heading syntax inside a prose paragraph.' })
    }
  }

  // FA-T1-19 Hedging stack — two or more hedges in one sentence.
  for (const s of sentences) {
    const n = hedgeCount(norm.slice(s.from, s.to))
    if (n < 2) continue
    requestFix({ ruleId: 'FA-T1-19', family: 'tier1', start: s.from, end: s.to, span: slice(s.from, s.to), instruction: 'This sentence stacks hedges. Rewrite it in Farsi with at most one, keeping the claim.', rationale: `Hedging stack — ${n} hedges in one sentence.` })
  }

  // FA-T1-21 Sentence-length variance — std dev below 4 words over 5+.
  const bySection = new Map<number, Sentence[]>()
  for (const s of sentences) if (s.block.kind !== 'heading') bySection.set(s.block.headingSection, [...(bySection.get(s.block.headingSection) ?? []), s])
  const flat = new Set<Sentence>()
  for (const list of bySection.values()) {
    for (let i = 0; i + 5 <= list.length; i++) {
      const win = list.slice(i, i + 5)
      const mean = win.reduce((a, s) => a + s.words, 0) / 5
      if (Math.sqrt(win.reduce((a, s) => a + (s.words - mean) ** 2, 0) / 5) < 4) win.forEach((s) => flat.add(s))
    }
  }
  for (const s of flat) requestFix({ ruleId: 'FA-T1-21', family: 'tier1', start: s.from, end: s.to, span: slice(s.from, s.to), instruction: 'This sentence is part of a run of near-identical sentence lengths. Rewrite it in Farsi to vary the rhythm, keeping the content.', rationale: 'Sentence-length variance below 4 words across 5+ sentences. Flagged as part of that run.' })

  // FA-T1-22 List-item length variance — 4+ items within a 20% band.
  const lists = new Map<number, { from: number; to: number }[]>()
  for (const b of prose.blocks) if (b.kind === 'listItem' && b.listId !== undefined) lists.set(b.listId, [...(lists.get(b.listId) ?? []), b])
  for (const items of lists.values()) {
    if (items.length < 4) continue
    const lens = items.map((i) => text.slice(i.from, i.to).trim().length)
    const max = Math.max(...lens)
    if (max === 0 || (max - Math.min(...lens)) / max > 0.2) continue
    for (const it of items) requestFix({ ruleId: 'FA-T1-22', family: 'tier1', start: it.from, end: it.to, span: slice(it.from, it.to), instruction: 'Every item in this list has nearly the same length. Rewrite this item in Farsi so the list reads less uniform, keeping its meaning.', rationale: `${items.length} list items within a 20% length band. Flagged as part of that list.` })
  }

  // FA-T1-24 «از X گرفته تا Y» — above one per document.
  const sweeping = [...matches(R24)].map((m) => sentenceAt(m.index)).filter((s): s is Sentence => !!s)
  if (sweeping.length > 1) {
    for (const s of sweeping) requestFix({ ruleId: 'FA-T1-24', family: 'tier1', start: s.from, end: s.to, span: slice(s.from, s.to), instruction: 'Rewrite this sentence in Farsi without the sweeping «از … گرفته تا …»; name what is actually covered.', rationale: `${sweeping.length} «از … گرفته تا …» claims in one document; the cap is one.` })
  }

  // ── mode-dependent: candidates only ─────────────────────────────────────

  for (const s of sentences) {
    if (s.block.kind === 'heading') continue
    const span = slice(s.from, s.to)
    const n = norm.slice(s.from, s.to)
    // FA-T1-23 Antithesis.
    if (isAntithesis(n)) {
      const fixRef = requestFix({ ruleId: 'FA-T1-23', family: 'tier1', start: s.from, end: s.to, span, instruction: 'Rewrite this sentence in Farsi to state the point directly, without the «نه … بلکه» / «… نیست، … است» antithesis.', rationale: 'Antithesis construction.', candidate: true })
      candidates.push({ rule: 'FA-T1-23', start: s.from, end: s.to, span, fixRef })
    }
    // FA-T1-20 Sentence length — candidates above the lowest cap (25).
    if (s.words > 25) {
      const instruction = isInstruction(n, s.block.kind === 'listItem')
      const fixRef = requestFix({ ruleId: 'FA-T1-20', family: 'tier1', start: s.from, end: s.to, span, instruction: `This ${s.words}-word sentence is too long. Split or tighten it in Farsi into sentences of at most ${instruction ? 25 : 30} words, keeping every fact.`, rationale: `Sentence length — ${s.words} words.`, candidate: true })
      candidates.push({ rule: 'FA-T1-20', start: s.from, end: s.to, span, words: s.words, instruction, fixRef })
    }
  }
  // FA-T1-25 «با وجود X، Y» at a sentence start.
  for (const m of matches(R25)) {
    const s = sentenceAt(m.index)
    if (!s || candidates.some((c) => c.rule === 'FA-T1-25' && c.start === s.from)) continue
    const span = slice(s.from, s.to)
    const fixRef = requestFix({ ruleId: 'FA-T1-25', family: 'tier1', start: s.from, end: s.to, span, instruction: 'Rewrite this «با وجود X، Y» sentence in Farsi to state the tradeoff plainly.', rationale: 'False positivity — «با وجود X، Y».', candidate: true })
    candidates.push({ rule: 'FA-T1-25', start: s.from, end: s.to, span, fixRef })
  }

  // ── Tier 1b ─────────────────────────────────────────────────────────────

  // FA-T1b-01 Half-space before تر (not the word «wet»).
  for (const m of matches(new RegExp(`${WB}([${W}]+|[A-Za-z0-9]+) (تر)${WE}(?! و (?:تازه|خشک|فرز|تمیز))`, 'u'))) {
    if (wetWords.has(m[1])) continue
    const after = joinedComparatives.has(m[1]) ? m[1] + m[2] : `${m[1]}${Z}${m[2]}`
    flag('FA-T1b-01', m.index, m.index + m[0].length, after, 'The comparative تر takes a half-space (Dastur p.40) — unless this تر means «wet».')
  }

  // FA-T1b-02 Mixed digit systems in Farsi sentences: the minority system
  // converts to the dominant one (a tie goes to Persian).
  const digits: { start: number; end: number; persian: boolean }[] = []
  for (const m of matches(/[0-9۰-۹]+(?:[.,٫٬:/-][0-9۰-۹]+)*/u, masked)) {
    const start = m.index
    const end = start + m[0].length
    if (/[A-Za-z_]/.test(masked[start - 1] ?? '') || /[A-Za-z_]/.test(masked[end] ?? '')) continue
    if (/^\d+\.\d+\.\d+$/.test(m[0]) || /^\d{4}-\d{2}-\d{2}$/.test(m[0])) continue
    const persian = /[۰-۹]/.test(m[0])
    if (persian && /[0-9]/.test(m[0])) continue
    if (!inFarsiSentence(start)) continue
    digits.push({ start, end, persian })
  }
  const nPersian = digits.filter((d) => d.persian).length
  const nLatin = digits.length - nPersian
  if (nPersian && nLatin) {
    const toPersian = nPersian >= nLatin
    for (const d of digits.filter((x) => x.persian !== toPersian)) {
      const s = slice(d.start, d.end)
      const after = toPersian ? s.replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 48 + 0x06f0)) : s.replace(/[۰-۹]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x06f0 + 48))
      flag('FA-T1b-02', d.start, d.end, after, `Mixed digit systems — ${nPersian} Persian and ${nLatin} Latin numbers; ${toPersian ? 'Persian' : 'Latin'} is the document's own.`)
    }
  }

  // FA-T1b-03 Ezafe written ه‌ی → هٔ (house style: the Academy's form).
  for (const m of matches(new RegExp(`${WB}([${W}]*ه)${Z}ی(?= [${L}])`, 'u'))) flag('FA-T1b-03', m.index, m.index + m[0].length, `${m[1]}ٔ`, 'The ezafe after a silent ه is written هٔ (Dastur p.46); ه‌ی is the common alternative.')

  // FA-T1b-04 Stiff connectors, with guards.
  const DIR_GUARD = /(?:^|\s)(?:این|آن|همین|همان|یک|هر|دو|سه|چند|در|از|مخالف)\s+$/u
  for (const c of stiffConnectors) {
    for (const m of matches(new RegExp(c.re, 'u'))) {
      if (c.stiff === 'جهت' && DIR_GUARD.test(norm.slice(Math.max(0, m.index - 12), m.index))) continue
      flag('FA-T1b-04', m.index, m.index + m[0].length, c.plain, `Officialese — ${c.stiff} → ${c.plain}.`)
    }
  }

  // FA-T1b-05 Light-verb padding, conjugated to match.
  for (const row of lightVerbRows) {
    const words = row.padded.split(' ')
    const infinitive = words[words.length - 1]
    const plainWords = row.plain.split(' ')
    const plainVerb = plainWords[plainWords.length - 1]
    if (!verbs.has(infinitive) || !verbs.has(plainVerb)) continue // a verb the generator doesn't know
    const { re: verbRe, keyOf } = verbPattern(infinitive)
    const nounSlot = row.padded.startsWith('مورد') ? `(${eligibleNouns.join('|')})` : `([${W}]+)`
    const lead = words.slice(0, -1).map((w) => (w === '<N>' ? nounSlot : entryPattern(w))).join('\\s+')
    const re = new RegExp(`${WB}${lead}\\s+(${verbRe.slice(WB.length, -WE.length)})${WE}`, 'u')
    for (const m of matches(re)) {
      const noun = row.padded.includes('<N>') ? m[1] : ''
      const verb = m[row.padded.includes('<N>') ? 2 : 1]
      const key = keyOf(verb)
      const conj = key ? conjugate(plainVerb, key) : null
      if (!conj) continue
      const after = [...plainWords.slice(0, -1).map((w) => (w === '<N>' ? noun : w)), conj].join(' ')
      flag('FA-T1b-05', m.index, m.index + m[0].length, after, `Light-verb padding — ${row.padded} → ${row.plain}.`)
    }
  }

  // FA-T1b-06 Synonym doublets.
  for (const d of doublets) for (const m of matches(new RegExp(d.re, 'u'))) flag('FA-T1b-06', m.index, m.index + m[0].length, d.single, `Synonym doublet — one word carries the meaning: ${d.single}.`)

  // FA-T1b-07 Loanwords with an approved equivalent: flagged, no fix.
  for (const lw of loanwords) {
    const verbRow = lw.word.endsWith(' کردن')
    const head = verbRow ? lw.word.slice(0, -' کردن'.length) : lw.word
    const re = verbRow ? `${WB}${entryPattern(head)}\\s+(?:${verbPattern('کردن').re.slice(WB.length, -WE.length)})${WE}` : `${WB}${entryPattern(head)}(?:${Z}?(?:ها|های)|ی)?${WE}`
    for (const m of matches(new RegExp(re, 'u'))) flag('FA-T1b-07', m.index, m.index + m[0].length, null, `Loanword with an approved Farsi equivalent: «${lw.equivalent}». Your call.`)
  }

  // FA-T1b-08 Vague attribution: flagged for review, never fails.
  for (const v of vagueAttributions(norm)) {
    if (!inProse(v.start) || !real(v.start, v.end)) continue
    flag('FA-T1b-08', v.start, v.end, null, 'Vague attribution — no source follows. Name the study, the year or a link.')
  }

  return { prose, flags, fixRequests, candidates, dashes: [], dashGatePassed: false, semicolons: [], lang: 'fa' }
}

export { countWordsFa }
