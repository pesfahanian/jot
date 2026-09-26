import { bannedWords, firstWordFingerprints, nominalizations, phrasalVerbs } from './ruleset'
import { analyzeProse, capitalize, countWords, nextWord, type Prose, type Sentence } from './text'

// Pass A (T5.9, checks.md "Execution model"): all client-side detection,
// before any model call. Mode-independent rules finish here — verdict and,
// where the fix is mechanical, a real non-empty `after`. The four
// mode-dependent rules (T1-01, T1-08, T1-11, T1b-05's density) only record
// raw candidates with positions: their threshold needs the section's mode,
// which only exists once the shared call returns.

export type Family = 'tier1' | 'tier1b' | 'tier2' | 'spelling' | 'grammar' | 'punctuation'

export interface RawFlag {
  id: string
  family: Family
  span: string
  // Client-side flags know their exact position; model flags are anchored
  // by quote later (assemble.ts).
  start?: number
  end?: number
  after: string | null
  rationale: string
}

// A confirmed Tier 1 span whose fix is a rewrite, not a substitution: the
// shared call is asked only for the replacement, never whether it fired.
export interface FixRequest {
  ref: string
  ruleId: string
  family: Family
  start: number
  end: number
  span: string
  instruction: string
  rationale: string
  // Mode-dependent candidates get their fix requested up front (one call per
  // document); Pass B discards the fix if the candidate passes.
  candidate?: boolean
}

export type ModeRule = 'T1-01' | 'T1-08' | 'T1-11' | 'T1b-05'

export interface Candidate {
  rule: ModeRule
  start: number
  end: number
  span: string
  // T1-08: the sentence's word count and whether it reads as an instruction.
  words?: number
  instruction?: boolean
  // T1-01 / T1-11 / T1-08: the fix request carrying the generative rewrite.
  fixRef?: string
  // T1b-05: mechanical fallback fix for a density failure.
  fallback?: { start: number; end: number; span: string; after: string }
}

// T1b-05 steps 2–3 and T1b-06 step 2 go to the shared call only when their
// client-side gate passed (T5.10).
export interface DashInstance {
  index: number
  start: number
  end: number
  sentence: string
}

export interface SemicolonInstance {
  index: number
  start: number
  end: number
  sentence: string
}

export interface PassAResult {
  prose: Prose
  flags: RawFlag[]
  fixRequests: FixRequest[]
  candidates: Candidate[]
  dashes: DashInstance[]
  dashGatePassed: boolean
  semicolons: SemicolonInstance[]
}

// ── helpers ────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Regular inflections of a base verb or noun, plus the handful of irregular
// forms the tables actually need.
const IRREGULAR: Record<string, { ed?: string[] }> = {
  build: { ed: ['built'] },
  do: { ed: ['did', 'done'] },
  take: { ed: ['took', 'taken'] },
  spin: { ed: ['spun'] },
  dive: { ed: ['dove', 'dived'] },
  make: { ed: ['made'] },
  show: { ed: ['showed', 'shown'] },
}

function forms(base: string): { s: string; ed: string[]; ing: string } {
  const b = base.toLowerCase()
  const irregular = IRREGULAR[b]?.ed
  const s = /(s|x|z|ch|sh)$/.test(b) ? `${b}es` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : b === 'do' ? 'does' : `${b}s`
  const ing = /ie$/.test(b) ? `${b.slice(0, -2)}ying` : /[^e]e$/.test(b) ? `${b.slice(0, -1)}ing` : /^(spin|kick|reach)$/.test(b) ? (b === 'spin' ? 'spinning' : `${b}ing`) : `${b}ing`
  const ed = irregular ?? [/e$/.test(b) ? `${b}d` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ied` : `${b}ed`]
  return { s, ed, ing }
}

type Inflection = 'base' | 's' | 'ed' | 'ing'

function inflectionOf(word: string, base: string): Inflection | null {
  const w = word.toLowerCase()
  const f = forms(base)
  if (w === base) return 'base'
  if (w === f.s) return 's'
  if (f.ed.includes(w)) return 'ed'
  if (w === f.ing) return 'ing'
  return null
}

function inflect(base: string, how: Inflection): string {
  if (how === 'base') return base
  const f = forms(base)
  return how === 's' ? f.s : how === 'ing' ? f.ing : f.ed[0]
}

// Keep the matched word's capitalization on its replacement.
const matchCase = (source: string, repl: string) =>
  source === source.toUpperCase() && source.length > 1 ? repl.toUpperCase() : /^[A-Z]/.test(source) ? capitalize(repl) : repl

// Adverb form of a banned adjective ("seamless" → "seamlessly").
const adverb = (b: string) => (/y$/.test(b) ? `${b.slice(0, -1)}ily` : /le$/.test(b) ? `${b.slice(0, -1)}y` : `${b}ly`)

function wordAlternation(base: string, withAdverb = false): string {
  const f = forms(base)
  return [base, f.s, ...f.ed, f.ing, ...(withAdverb ? [adverb(base)] : [])].map(esc).join('|')
}

function sentenceAt(prose: Prose, pos: number): Sentence | undefined {
  return prose.sentences.find((s) => pos >= s.from && pos < s.to)
}

const IMPERATIVE_START =
  /^(add|allow|avoid|build|call|change|check|choose|clear|click|close|configure|confirm|connect|copy|create|delete|deploy|disable|download|edit|enable|ensure|enter|export|find|follow|go|install|keep|launch|log|make|merge|move|open|paste|pick|press|pull|push|put|read|remove|rename|replace|restart|run|save|select|send|set|start|stop|switch|tag|test|type|update|upgrade|use|verify|wait|write)\b/i

// ── the pass ───────────────────────────────────────────────────────────────

export function runPassA(text: string): PassAResult {
  const prose = analyzeProse(text)
  const { masked } = prose
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

  // Word-level matches over the masked text, inside prose blocks only.
  const inProse = (pos: number) => prose.blocks.some((b) => pos >= b.from && pos < b.to)
  function* matches(re: RegExp) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(masked))) {
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      if (inProse(m.index)) yield m
    }
  }

  // T1-02 Banned vocabulary — any hit fails, both modes. Fix: table lookup.
  for (const entry of bannedWords) {
    const re = new RegExp(`\\b(${wordAlternation(entry.banned, true)})\\b`, 'gi')
    for (const m of matches(re)) {
      const start = m.index
      const end = start + m[0].length
      const word = m[0]
      const how = inflectionOf(word, entry.banned) ?? 'base'
      const rationale = `Banned vocabulary — ${entry.banned}${entry.fix.type === 'replace' ? ` → ${entry.fix.word}` : ''} (banned-vocabulary.md).`
      if (entry.fix.type === 'replace') {
        flags.push({ id: 'T1-02', family: 'tier1', start, end, span: word, after: matchCase(word, inflect(entry.fix.word, how)), rationale })
      } else if (entry.fix.type === 'cut') {
        // Cutting leaves nothing adjacent to fix only mid-sentence; scope the
        // span to include the following word so `after` is never "".
        const nw = nextWord(text, end)
        if (nw && sentenceAt(prose, start)?.to && nw.to <= sentenceAt(prose, start)!.to) {
          const following = slice(nw.from, nw.to)
          const sentenceStart = sentenceAt(prose, start)!.from === start
          flags.push({ id: 'T1-02', family: 'tier1', start, end: nw.to, span: slice(start, nw.to), after: sentenceStart ? capitalize(following) : following, rationale })
        } else {
          const ref = requestFix({ ruleId: 'T1-02', family: 'tier1', start, end, span: word, instruction: `Remove "${word}" and repair the sentence around it.`, rationale })
          void ref
        }
      } else {
        requestFix({
          ruleId: 'T1-02',
          family: 'tier1',
          start,
          end: sentenceAt(prose, start)?.to ?? end,
          span: slice(start, sentenceAt(prose, start)?.to ?? end),
          instruction: `Replace the banned word "${word}" — ${entry.fix.guidance}. Rewrite only this span.`,
          rationale: `Banned vocabulary — ${entry.banned}: ${entry.fix.guidance} (banned-vocabulary.md).`,
        })
      }
    }
  }

  // T1-12 Phrasal verbs — any hit fails, both modes. Fix: table lookup.
  for (const p of phrasalVerbs) {
    const obj = p.needsObject ? '(?=\\s+(?:the|a|an|this|that|these|those|its|their|your|my|our)\\b)' : ''
    const re = new RegExp(`\\b(${wordAlternation(p.verb)})\\s+${esc(p.particle)}\\b${obj}`, 'gi')
    for (const m of matches(re)) {
      const verbWord = m[1]
      const how = inflectionOf(verbWord, p.verb) ?? 'base'
      flags.push({
        id: 'T1-12',
        family: 'tier1',
        start: m.index,
        end: m.index + m[0].length,
        span: m[0],
        after: matchCase(verbWord, inflect(p.replacement, how)),
        rationale: `Phrasal verb — ${p.verb} ${p.particle} → ${p.replacement} (banned-vocabulary.md).`,
      })
    }
  }

  // T1b-03 Nominalization — light verb + determiner + -tion/-ment/-sis/-ance
  // noun. Fix: table lookup; a form not in the table goes to the shared call.
  const LIGHT = ['perform', 'conduct', 'provide', 'make', 'carry out']
  const lightAlt = LIGHT.map((v) => (v === 'carry out' ? `(?:${wordAlternation('carry')})\\s+out` : `(?:${wordAlternation(v)})`)).join('|')
  const nomRe = new RegExp(`\\b(${lightAlt})\\s+(?:(a|an|the|this|that)\\s+)?([a-z]+(?:tion|ment|sis|ance))\\b(\\s+of\\b)?`, 'gi')
  for (const m of matches(nomRe)) {
    const [whole, verbPhrase, det, noun, of] = m
    const verbWord = verbPhrase.split(/\s+/)[0]
    const lightBase = LIGHT.find((v) => inflectionOf(verbWord, v.split(' ')[0]) !== null) ?? 'make'
    const entry = nominalizations.find(
      (n) => n.noun === noun.toLowerCase() && n.lightVerbs.some((lv) => lv === lightBase || lv.split(' ')[0] === lightBase.split(' ')[0]),
    )
    const start = m.index
    const end = start + whole.length
    const how = inflectionOf(verbWord, lightBase.split(' ')[0]) ?? 'base'
    const rationale = `Nominalization — "${verbPhrase} ${det ? det + ' ' : ''}${noun}" hides the verb${entry ? `; use "${entry.verb}"` : ''} (banned-vocabulary.md).`
    if (entry) {
      flags.push({ id: 'T1b-03', family: 'tier1b', start, end, span: whole, after: matchCase(verbWord, inflect(entry.verb, how)), rationale })
    } else {
      requestFix({
        ruleId: 'T1b-03',
        family: 'tier1b',
        start,
        end,
        span: whole,
        instruction: `Replace the nominalization with its verb form ("${noun}" → its verb), keeping tense${of ? ' and dropping the "of"' : ''}. Return only the replacement for this span.`,
        rationale,
      })
    }
  }

  // T1b-04 Vague attribution — authority phrase with no proper noun, date or
  // link within 15 tokens. Flag, never fail; no fix, by design.
  const attribRe = /\b(studies|research|experts|scientists|analysts|surveys|reports)\s+(show|shows|showed|suggest|suggests|indicate|indicates|agree|agrees|say|says|found|find|finds|confirm|confirms)\b/gi
  for (const m of matches(attribRe)) {
    const after15 = text.slice(m.index + m[0].length).split(/\s+/).slice(0, 16).join(' ')
    const sourced = /\[[^\]]*\]\([^)]*\)|https?:\/\/|\b(1[89]|20)\d{2}\b/.test(after15) || /\s[A-Z][a-z]+/.test(' ' + after15.split(/(?<=[.!?])\s/)[0].replace(/^\s*\S+/, ''))
    if (sourced) continue
    const s = sentenceAt(prose, m.index)
    flags.push({
      id: 'T1b-04',
      family: 'tier1b',
      start: m.index,
      end: m.index + m[0].length,
      span: m[0],
      after: null,
      rationale: `Vague attribution — "${m[0]}" with no named source, date or link nearby. A sourcing gap for you to resolve, not a style failure.`,
    })
    void s
  }

  // T1-06 First-word fingerprints at the start of any section. Fix:
  // mechanical — the phrase plus the following word, recapitalized.
  for (const b of prose.blocks) {
    if (!b.sectionStart || b.kind === 'heading') continue
    const head = text.slice(b.from, b.to)
    for (const fp of firstWordFingerprints) {
      if (!head.toLowerCase().startsWith(fp.toLowerCase())) continue
      const phraseEnd = b.from + fp.length
      const nw = nextWord(text, phraseEnd)
      if (!nw) continue
      flags.push({
        id: 'T1-06',
        family: 'tier1',
        start: b.from,
        end: nw.to,
        span: text.slice(b.from, nw.to),
        after: capitalize(text.slice(nw.from, nw.to)),
        rationale: `First-word fingerprint — "${fp}" at a section start; deleted, next word recapitalized.`,
      })
      break
    }
  }

  // T1-03 Mechanical transitions at paragraph starts — above one per three
  // consecutive paragraphs; not when a comparative/causal verb shares the
  // sentence. Aggregate: every contributing instance is its own flag.
  const TRANSITIONS = ['Furthermore', 'Additionally', 'Moreover', 'Consequently', 'Notably']
  const CAUSAL = /\b(causes?|caused|leads?|led|results?|resulted|increases?|increased|reduces?|reduced|compared|outperforms?|exceeds?|drops?|dropped|improves?|improved)\b/i
  const paras = prose.blocks.filter((b) => b.kind === 'paragraph')
  const transitionHits = paras.map((b) => {
    const head = text.slice(b.from, b.to)
    const t = TRANSITIONS.find((w) => head.startsWith(w))
    if (!t) return null
    const s = sentenceAt(prose, b.from)
    if (s && CAUSAL.test(text.slice(s.from, s.to))) return null
    return { block: b, word: t }
  })
  const flaggedParas = new Set<number>()
  for (let i = 0; i < transitionHits.length; i++) {
    const window = transitionHits.slice(i, i + 3)
    if (window.filter(Boolean).length > 1) window.forEach((h, k) => h && flaggedParas.add(i + k))
  }
  for (const i of flaggedParas) {
    const h = transitionHits[i]!
    const phraseEnd = h.block.from + h.word.length
    const nw = nextWord(text, phraseEnd)
    if (!nw) continue
    flags.push({
      id: 'T1-03',
      family: 'tier1',
      start: h.block.from,
      end: nw.to,
      span: text.slice(h.block.from, nw.to),
      after: capitalize(text.slice(nw.from, nw.to)),
      rationale: 'More than one mechanical transition within three consecutive paragraphs. Flagged as part of that count, not for this instance alone.',
    })
  }

  // T1-04 Markdown/bullet leakage into prose — conservative in a markdown
  // editor (open-decisions #8): bullet glyphs or heading marks inside a
  // paragraph, and bold "Label:" lead-ins repeated across paragraphs.
  for (const b of paras) {
    const t = text.slice(b.from, b.to)
    const glyph = t.search(/(^|\s)[•◦▪]\s/)
    const midHeading = t.search(/\S\s+#{1,6}\s+\S/)
    if (glyph !== -1 || midHeading !== -1) {
      requestFix({
        ruleId: 'T1-04',
        family: 'tier1',
        start: b.from,
        end: b.to,
        span: t,
        instruction: 'List or heading markup has leaked into this prose paragraph. Rewrite it as plain prose, keeping every fact.',
        rationale: 'Markdown leakage — bullet or heading syntax inside a prose paragraph.',
      })
    }
  }
  const leadIns = paras.filter((b) => /^\*\*[^*\n]{1,40}:\*\*/.test(text.slice(b.from, b.to)))
  if (leadIns.length >= 2) {
    for (const b of leadIns) {
      const t = text.slice(b.from, b.to)
      requestFix({
        ruleId: 'T1-04',
        family: 'tier1',
        start: b.from,
        end: b.to,
        span: t,
        instruction: 'This paragraph opens with a bold "Label:" lead-in, a list pattern leaking into prose. Rewrite it as plain prose without the bold label.',
        rationale: `Markdown leakage — ${leadIns.length} paragraphs open with a bold "Label:" lead-in.`,
      })
    }
  }

  // T1-05 "From X to Y" in comprehensiveness position — above one per
  // document. Numeric, date, time and version ranges are not claims.
  const fromTo = [...matches(/\bfrom\s+([\p{L}\p{N}][\p{L}\p{N}'’-]*)[^.;!?]{0,60}?\s+to\s+([\p{L}\p{N}][\p{L}\p{N}'’-]*)/giu)].filter(
    (m) => !/^(v?\d|\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)/i.test(m[1]) && !/^\d/.test(m[2]),
  )
  if (fromTo.length > 1) {
    for (const m of fromTo) {
      const s = sentenceAt(prose, m.index)
      if (!s) continue
      requestFix({
        ruleId: 'T1-05',
        family: 'tier1',
        start: s.from,
        end: s.to,
        span: text.slice(s.from, s.to),
        instruction: `Rewrite this sentence without the sweeping "from ${m[1]} … to ${m[2]}" construction; name what is actually covered.`,
        rationale: `${fromTo.length} "from X to Y" constructions in one document; the cap is one. Flagged as part of that count.`,
      })
    }
  }

  // T1-07 Hedging stack — two or more hedges in one sentence.
  const HEDGES = /\b(may|might|could|potentially|arguably|possibly|perhaps)\b|it['’]s worth noting|to some extent/gi
  for (const s of prose.sentences) {
    const hedges = masked.slice(s.from, s.to).match(HEDGES) ?? []
    if (hedges.length < 2) continue
    requestFix({
      ruleId: 'T1-07',
      family: 'tier1',
      start: s.from,
      end: s.to,
      span: text.slice(s.from, s.to),
      instruction: `This sentence stacks hedges (${hedges.join(', ')}). Rewrite it with at most one, keeping the claim; bare deletion breaks the grammar.`,
      rationale: `Hedging stack — ${hedges.length} hedges in one sentence.`,
    })
  }

  // T1-09 Sentence-length variance — std dev below 4 words over any run of
  // 5+ sentences in a (heading) section. Aggregate, generative fix each.
  const bySection = new Map<number, Sentence[]>()
  for (const s of prose.sentences) {
    if (s.block.kind === 'heading') continue
    bySection.set(s.block.headingSection, [...(bySection.get(s.block.headingSection) ?? []), s])
  }
  const flatSentences = new Set<Sentence>()
  for (const list of bySection.values()) {
    for (let i = 0; i + 5 <= list.length; i++) {
      const win = list.slice(i, i + 5)
      const mean = win.reduce((a, s) => a + s.words, 0) / 5
      const sd = Math.sqrt(win.reduce((a, s) => a + (s.words - mean) ** 2, 0) / 5)
      if (sd < 4) win.forEach((s) => flatSentences.add(s))
    }
  }
  for (const s of flatSentences) {
    requestFix({
      ruleId: 'T1-09',
      family: 'tier1',
      start: s.from,
      end: s.to,
      span: text.slice(s.from, s.to),
      instruction: 'This sentence is part of a run of near-identical sentence lengths. Rewrite it to vary the rhythm (shorter or longer), keeping the content.',
      rationale: 'Sentence-length variance below 4 words across a run of 5+ sentences. Flagged as part of that run.',
    })
  }

  // T1-10 List-item length variance — 4+ items all within a 20% band.
  const lists = new Map<number, { from: number; to: number }[]>()
  for (const b of prose.blocks) if (b.kind === 'listItem' && b.listId !== undefined) lists.set(b.listId, [...(lists.get(b.listId) ?? []), b])
  for (const items of lists.values()) {
    if (items.length < 4) continue
    const lens = items.map((i) => text.slice(i.from, i.to).trim().length)
    const max = Math.max(...lens)
    const min = Math.min(...lens)
    if (max === 0 || (max - min) / max > 0.2) continue
    for (const it of items) {
      requestFix({
        ruleId: 'T1-10',
        family: 'tier1',
        start: it.from,
        end: it.to,
        span: text.slice(it.from, it.to),
        instruction: 'Every item in this list has nearly the same length. Rewrite this item so the list reads less uniform (vary its length), keeping its meaning.',
        rationale: `${items.length} list items all within a 20% length band. Flagged as part of that list.`,
      })
    }
  }

  // ── mode-dependent: candidates only ──────────────────────────────────────

  // T1-01 Antithesis ("not X, but Y", "it's not X, it's Y").
  const antithesis = /\b(?:not|n['’]t)\s+(?:just\s+|only\s+|merely\s+)?[^.;!?,]{1,80},\s*(?:but|it['’]s|it is|this is|that['’]s|they['’]re)\b/gi
  for (const m of matches(antithesis)) {
    const s = sentenceAt(prose, m.index)
    if (!s || candidates.some((c) => c.rule === 'T1-01' && c.start === s.from)) continue
    const span = text.slice(s.from, s.to)
    const fixRef = requestFix({
      ruleId: 'T1-01',
      family: 'tier1',
      start: s.from,
      end: s.to,
      span,
      instruction: 'Rewrite this sentence to state the point directly, without the "not X, but Y" antithesis.',
      rationale: 'Antithesis construction.',
      candidate: true,
    })
    candidates.push({ rule: 'T1-01', start: s.from, end: s.to, span, fixRef })
  }

  // T1-11 False positivity ("Despite [limit], [positive reframe]").
  for (const m of matches(/\bDespite\s+[^,.;!?]{2,100},/g)) {
    const s = sentenceAt(prose, m.index)
    if (!s) continue
    const span = text.slice(s.from, s.to)
    const fixRef = requestFix({
      ruleId: 'T1-11',
      family: 'tier1',
      start: s.from,
      end: s.to,
      span,
      instruction: 'Rewrite this "Despite X, Y" sentence to state the tradeoff plainly and let the reader weigh it.',
      rationale: 'False positivity — "Despite X, Y" reframing.',
      candidate: true,
    })
    candidates.push({ rule: 'T1-11', start: s.from, end: s.to, span, fixRef })
  }

  // T1-08 Sentence length — every sentence over the lowest cap (strict
  // instruction, 20 words) is a candidate; Pass B applies the section's cap.
  for (const s of prose.sentences) {
    if (s.words <= 20 || s.block.kind === 'heading') continue
    const span = text.slice(s.from, s.to)
    const instruction = s.block.kind === 'listItem' || IMPERATIVE_START.test(span)
    const fixRef = requestFix({
      ruleId: 'T1-08',
      family: 'tier1',
      start: s.from,
      end: s.to,
      span,
      instruction: `This ${s.words}-word sentence is too long. Split or tighten it into sentences of at most ${instruction ? 20 : 25} words each, keeping every fact.`,
      rationale: `Sentence length — ${s.words} words.`,
      candidate: true,
    })
    candidates.push({ rule: 'T1-08', start: s.from, end: s.to, span, words: s.words, instruction, fixRef })
  }

  // T1b-05 Em dash — a paired dash (no sentence end between) is one
  // instance. Density is mode-dependent (Pass B); a mechanical fallback fix
  // is prepared for a density failure.
  const dashPositions = [...matches(/—/g)].map((m) => m.index)
  const dashes: DashInstance[] = []
  for (let i = 0; i < dashPositions.length; i++) {
    const a = dashPositions[i]
    const s = sentenceAt(prose, a)
    const b = dashPositions[i + 1]
    const paired = b !== undefined && s && b < s.to
    const lastDash = paired ? b : a
    if (paired) i++
    const nw = nextWord(text, lastDash + 1)
    const start = paired ? a : a
    // Fallback: dashes become commas; span runs through the next word so the
    // replacement is never empty.
    const spanEnd = nw ? nw.to : lastDash + 1
    const spanText = text.slice(start, spanEnd)
    const after = spanText.replace(/\s*—\s*/g, ', ').replace(/^,\s*/, ', ')
    candidates.push({ rule: 'T1b-05', start, end: spanEnd, span: spanText, fallback: { start, end: spanEnd, span: spanText, after } })
    dashes.push({ index: dashes.length, start, end: spanEnd, sentence: s ? text.slice(s.from, s.to) : spanText })
  }
  // Gate for steps 2–3: the document must pass density under the most
  // lenient cap (flavored, 1 per 150 words). Failing even that, every dash
  // fails on density whatever the mode — no reason to spend the call.
  const dashGatePassed = dashes.length > 0 && dashes.length <= Math.max(1, Math.floor(prose.words / 150))

  // T1b-06 Semicolons — step 1 (independent clauses) client-side; failures
  // are final with a period fallback. Passing ones go to the shared call.
  const semicolons: SemicolonInstance[] = []
  for (const m of matches(/;/g)) {
    const s = sentenceAt(prose, m.index)
    if (!s) continue
    const left = masked.slice(s.from, m.index)
    const rightEnd = (() => {
      const nextSemi = masked.indexOf(';', m.index + 1)
      return nextSemi !== -1 && nextSemi < s.to ? nextSemi : s.to
    })()
    const right = masked.slice(m.index + 1, rightEnd)
    const leftClause = left.split(';').pop() ?? left
    if (isIndependentClause(leftClause) && isIndependentClause(right)) {
      semicolons.push({ index: semicolons.length, start: m.index, end: m.index + 1, sentence: text.slice(s.from, s.to) })
      continue
    }
    const nw = nextWord(text, m.index + 1)
    if (!nw) continue
    const next = text.slice(nw.from, nw.to).replace(/^(and|or|but)$/i, '')
    const after = next ? `. ${capitalize(next)}` : '.'
    flags.push({
      id: 'T1b-06',
      family: 'tier1b',
      start: m.index,
      end: nw.to,
      span: text.slice(m.index, nw.to),
      after: after === '.' ? `. ${capitalize(text.slice(nw.from, nw.to))}` : after,
      rationale: 'Semicolon without an independent clause on both sides — a grammar failure, not a judgment call.',
    })
  }

  return { prose, flags, fixRequests, candidates, dashes, dashGatePassed, semicolons }
}

// A clause is "independent" if it has a few words and a finite verb. A
// heuristic stand-in for a parser: auxiliaries, common verbs, and regular
// past/present forms after a likely subject.
const AUX = /\b(am|is|are|was|were|be|been|has|have|had|do|does|did|will|would|can|could|should|shall|may|might|must)\b/i
const VERBISH = /\b(\w+(ed|es)|runs?|goes|went|gets?|got|makes?|made|takes?|took|keeps?|kept|holds?|held|backs?|breaks?|broke|fails?|works?|needs?|wants?|shows?|uses?|stays?|stops?|starts?|moves?|returns?|exits?|halts?|reads?|writes?|wrote|sends?|sent|builds?|built|comes?|came|sees?|saw|knows?|knew|thinks?|thought|says?|said|becomes?|became|remains?|seems?|looks?|feels?|lets?|puts?)\b/i

export function isIndependentClause(s: string): boolean {
  const t = s.trim().replace(/^(and|or|but|so)\s+/i, '')
  if (/^(and|or|but)\b/i.test(s.trim())) return false
  if (countWords(t) < 3) return false
  return AUX.test(t) || VERBISH.test(t)
}
