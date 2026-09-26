import { anchorQuote } from './anchor'
import type { Candidate, PassAResult, RawFlag } from './passA'
import type { Mode, SharedResponse } from './sharedCall'

// Pass B (T5.11): local arithmetic only, no model call. Buckets Pass A's
// raw candidates into the sections the shared call returned and finishes
// the verdicts using each section's mode. Three kinds of arithmetic:
//   rate cap          T1-01, T1b-05 density, T2-07 — per section, count vs words
//   flat per-sentence T1-08 — each sentence against its own section's cap
//   per-document      T1-11 — strict fails on its own; flavored candidates
//                     share ONE budget across all flavored territory

export interface ResolvedSection {
  start: number
  end: number
  mode: Mode
  words: number
}

export function resolveSections(text: string, a: PassAResult, sections: SharedResponse['sections']): ResolvedSection[] {
  const starts: { start: number; mode: Mode }[] = []
  for (const s of sections) {
    const r = anchorQuote(text, s.start)
    if (r && !starts.some((x) => x.start === r.start)) starts.push({ start: r.start, mode: s.mode })
  }
  starts.sort((x, y) => x.start - y.start)
  // The first section always opens the document; with nothing anchored the
  // whole document is one section, defaulting to strict (modes.md: default
  // to strict for anything prescriptive).
  if (!starts.length) starts.push({ start: 0, mode: 'strict' })
  else starts[0] = { ...starts[0], start: 0 }
  return starts.map((s, i) => {
    const end = starts[i + 1]?.start ?? text.length
    const words = a.prose.sentences.filter((x) => x.from >= s.start && x.from < end).reduce((n, x) => n + x.words, 0)
    return { start: s.start, end, mode: s.mode, words }
  })
}

export const sectionOf = (sections: ResolvedSection[], pos: number) =>
  sections.find((s) => pos >= s.start && pos < s.end) ?? sections[sections.length - 1]

// "Flag above 1 per N words", read as an allowance of at least one — the
// flavored "sparingly" (output-schema.md: a single instance in a flavored
// section is within the allowance).
export const allowance = (words: number, per: number) => Math.max(1, Math.floor(words / per))

export function runPassB(text: string, a: PassAResult, shared: SharedResponse, sections: ResolvedSection[]): RawFlag[] {
  const out: RawFlag[] = []
  const fixFor = (c: Candidate) => (c.fixRef ? (shared.fixes[c.fixRef] ?? null) : null)
  const byRule = (rule: Candidate['rule']) => a.candidates.filter((c) => c.rule === rule)
  const inSection = (s: ResolvedSection, pos: number) => pos >= s.start && pos < s.end

  // T1-01 Antithesis — rate cap. Strict: zero allowed. Flavored: above 1 per
  // 500 words in that section; a failing section flags every instance.
  for (const s of sections) {
    const cands = byRule('T1-01').filter((c) => inSection(s, c.start))
    if (!cands.length) continue
    const fails = s.mode === 'strict' || cands.length > allowance(s.words, 500)
    if (!fails) continue
    for (const c of cands) {
      out.push({
        id: 'T1-01',
        family: 'tier1',
        start: c.start,
        end: c.end,
        span: c.span,
        after: fixFor(c),
        rationale:
          s.mode === 'strict'
            ? 'Antithesis construction, zero-tolerance in strict mode.'
            : `${cands.length} antithesis constructions in a ${s.words}-word flavored section; the cap is 1 per 500 words.`,
      })
    }
  }

  // T1-08 Sentence length — flat per sentence: strict 20 (instruction) / 25
  // (descriptive), flavored 35.
  for (const c of byRule('T1-08')) {
    const s = sectionOf(sections, c.start)
    const cap = s.mode === 'strict' ? (c.instruction ? 20 : 25) : 35
    if ((c.words ?? 0) <= cap) continue
    out.push({
      id: 'T1-08',
      family: 'tier1',
      start: c.start,
      end: c.end,
      span: c.span,
      after: fixFor(c),
      rationale: `Sentence length — ${c.words} words against the ${s.mode}${s.mode === 'strict' ? (c.instruction ? ' instruction' : ' descriptive') : ''} cap of ${cap}.`,
    })
  }

  // T1-11 False positivity — per document, not per section. A strict-section
  // candidate fails on its own. Flavored candidates draw from one shared
  // budget of one: the first (in document order) is allowed, every later
  // one anywhere in flavored territory fails.
  let flavoredBudget = 1
  for (const c of byRule('T1-11').sort((x, y) => x.start - y.start)) {
    const s = sectionOf(sections, c.start)
    if (s.mode === 'flavored' && flavoredBudget > 0) {
      flavoredBudget--
      continue
    }
    out.push({
      id: 'T1-11',
      family: 'tier1',
      start: c.start,
      end: c.end,
      span: c.span,
      after: fixFor(c),
      rationale:
        s.mode === 'strict'
          ? 'False positivity ("Despite X, Y"), zero-tolerance in strict mode.'
          : 'False positivity ("Despite X, Y") — the one allowed instance in flavored sections is already used earlier in the document.',
    })
  }

  // T1b-05 Em dash — density per section first (strict 1/300, flavored
  // 1/150): a failing section fails every instance, with the mechanical
  // fallback fix. Otherwise the shared call's repetition/motivation verdict
  // decides each instance.
  const dashCands = byRule('T1b-05')
  const dashVerdicts = new Map(shared.dashes.map((d) => [d.index, d]))
  for (const s of sections) {
    const cands = dashCands.filter((c) => inSection(s, c.start))
    if (!cands.length) continue
    const per = s.mode === 'strict' ? 300 : 150
    const densityFails = cands.length > allowance(s.words, per)
    for (const c of cands) {
      const idx = a.dashes.findIndex((d) => d.start === c.start)
      const v = dashVerdicts.get(idx)
      if (densityFails) {
        out.push({
          id: 'T1b-05',
          family: 'tier1b',
          start: c.fallback!.start,
          end: c.fallback!.end,
          span: c.fallback!.span,
          after: c.fallback!.after,
          rationale: `${cands.length} em dashes in ${s.words} words exceeds the ${s.mode}-mode cap of 1 per ${per} words. Flagged as part of that count, not for this instance alone.`,
        })
      } else if (v && v.verdict !== 'pass') {
        out.push({
          id: 'T1b-05',
          family: 'tier1b',
          start: c.fallback!.start,
          end: c.fallback!.end,
          span: c.fallback!.span,
          after: v.after?.trim() ? v.after : c.fallback!.after,
          rationale: v.rationale || (v.verdict === 'repeated' ? 'Em dash repeats a construction used elsewhere.' : 'Reflexive em dash — emphasis with no syntactic role.'),
        })
      }
    }
  }

  // T2-07 Rule of three — decorative instances only (the model judged
  // decorative vs enumeration); the cap is a rate cap like T1-01.
  const tricolons = shared.tricolons
    .map((t) => ({ ...t, range: anchorQuote(text, t.span) }))
    .filter((t): t is typeof t & { range: { start: number; end: number } } => !!t.range)
  for (const s of sections) {
    const inS = tricolons.filter((t) => inSection(s, t.range.start))
    if (!inS.length) continue
    if (s.mode === 'flavored' && inS.length <= allowance(s.words, 500)) continue
    for (const t of inS) {
      out.push({
        id: 'T2-07',
        family: 'tier2',
        start: t.range.start,
        end: t.range.end,
        span: text.slice(t.range.start, t.range.end),
        after: null,
        rationale:
          (t.rationale ? t.rationale + ' ' : '') +
          (s.mode === 'strict' ? 'Decorative tricolon, zero-tolerance in strict mode.' : `${inS.length} decorative tricolons exceed the flavored cap of 1 per 500 words.`),
      })
    }
  }

  return out
}
