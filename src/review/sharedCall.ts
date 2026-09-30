import type { Provider } from '@/lib/db'
import { chat } from './providers'
import { ReviewRequestError, type ChatMessage } from './request'
import type { Family, PassAResult } from './passA'
import { ruleset } from './ruleset'

// T5.10 — the one shared call per document (to whichever AI provider is
// selected). Everything that needs judgment,
// generation or classification rides in a single request: mode per section
// (first), T1b-01/T1b-02, the gated T1b-05/T1b-06 follow-ups, all of Tier 2,
// the proofing pass, and fixes for Tier 1 spans already confirmed
// client-side. The model never decides whether a Tier 1 rule fired.

export type Mode = 'strict' | 'flavored'

export interface SharedSection {
  start: string
  mode: Mode
}

export interface SharedFlag {
  id: string
  family: Family
  span: string
  after: string | null
  rationale: string
}

export interface SharedResponse {
  sections: SharedSection[]
  flags: SharedFlag[]
  fixes: Record<string, string>
  dashes: { index: number; verdict: 'pass' | 'repeated' | 'reflexive'; after: string | null; rationale: string }[]
  semicolons: { index: number; related: boolean; after: string | null; rationale: string }[]
  // T2-07 decorative tricolons: every instance, with its section's quote —
  // the frequency cap is client-side arithmetic (Pass B).
  tricolons: { span: string; rationale: string }[]
  // The model declined the document (suitability.ts), with its reason.
  skip?: string
}

// What was actually sent, for the "one call, gated parts only when their
// gate passed" checks (T5.10).
export interface SharedRequest {
  messages: ChatMessage[]
  includesDashSteps: boolean
  includesSemicolonStep: boolean
  fixRefs: string[]
}

// allowSkip: whether the model may decline the document; off for "review
// anyway".
export function buildSharedRequest(text: string, a: PassAResult, allowSkip = true): SharedRequest {
  const includesDashSteps = a.dashGatePassed && a.dashes.length > 0
  const includesSemicolonStep = a.semicolons.length > 0

  const system = [
    'You are the judge for a machine-verifiable prose style guide. The complete guide follows; apply it exactly as written.',
    'A client-side pass has already run every Tier 1 detection, T1b-03, T1b-04 and the mechanical gates for T1b-05 and T1b-06. Never re-decide whether a Tier 1 or mechanical Tier 1b rule fired; only do the tasks listed in the user message.',
    'Quote spans verbatim from the document — exact characters, no paraphrase, no added or dropped punctuation — scoped to what needs to change (a word or phrase for lexical issues, a clause or sentence for structural ones). A quote that does not match the document exactly is discarded.',
    'Respond with one JSON object and nothing else.',
    '',
    '===== RULES.md =====',
    ruleset.rules,
    '===== checks.md =====',
    ruleset.checks,
    '===== modes.md =====',
    ruleset.modes,
    '===== output-schema.md =====',
    ruleset.outputSchema,
    // The judge only produces consistent verdicts after seeing full
    // reasoned examples, not the rule statements alone (README).
    '===== examples/tier1-examples.md =====',
    ruleset.tier1Examples,
    '===== examples/tier2-examples.md =====',
    ruleset.tier2Examples,
  ].join('\n')

  const tasks: string[] = []
  if (allowSkip)
    tasks.push(
      '0. FIRST decide whether this document is prose the guide can meaningfully apply to. If it is not — gibberish or random characters, placeholder text such as lorem ipsum, a data dump, a list of links or identifiers, or almost entirely code — return exactly {"skip": "<the reason in under 12 words, lowercase>"} and nothing else, doing none of the tasks below. Otherwise do not include "skip" at all. Writing that is rough, informal, short or in note form is still prose: review it.',
    )
  tasks.push(
    '1. "sections" — FIRST, split the document into sections by what each part does and assign each a mode per modes.md. Each entry: {"start": "<verbatim quote of where the section begins, at least 6 words or the whole first line>", "mode": "strict"|"flavored"}. Sections are in document order; the first one starts at the beginning of the document.',
  )
  tasks.push(
    '2. "flags" — T1b-01 and T1b-02 (coreference, in full, with fixes), and every Tier 2 rule except T2-07 (T2-01…T2-06, T2-08: detection and rationale; after is always null). Also the separate proofing pass: objective spelling, grammar and punctuation errors only, family "spelling" | "grammar" | "punctuation", with the corrected text as after and a short rationale. Each flag: {"id","family","span","after","rationale"}. Use ids SPL-001, GRM-001, PNC-001… for proofing.',
  )
  tasks.push(
    '3. "tricolons" — every decorative rule-of-three (T2-07 judge question; necessary enumeration of named things never counts): {"span","rationale"}. Report every decorative instance; the frequency cap is applied elsewhere.',
  )
  if (a.fixRequests.length) {
    tasks.push(
      '4. "fixes" — for each confirmed span below, write only the replacement text for that exact span, following its instruction and the guide (replacement must read correctly in place, keep the author\'s facts, and not be empty). Object keyed by ref: {"f1": "…"}.\n' +
        a.fixRequests.map((f) => `- ${f.ref} [${f.ruleId}] instruction: ${f.instruction}\n  span: ${JSON.stringify(f.span)}`).join('\n'),
    )
  }
  if (includesDashSteps) {
    tasks.push(
      '5. "dashes" — T1b-05 steps 2 and 3 (density already passed). For each instance: {"index", "verdict": "pass"|"repeated"|"reflexive", "after": "<rewrite of the span from the dash through the next word, varied per instance>" or null when it passes, "rationale"}.\n' +
        a.dashes.map((d) => `- index ${d.index}: span ${JSON.stringify(text.slice(d.start, d.end))} in sentence ${JSON.stringify(d.sentence)}`).join('\n'),
    )
  }
  if (includesSemicolonStep) {
    tasks.push(
      '6. "semicolons" — T1b-06 step 2 (both sides already passed the independent-clause check). For each: {"index", "related": true|false, "after": "<replacement for the semicolon and the following word>" or null when related, "rationale"}.\n' +
        a.semicolons.map((s) => `- index ${s.index}: in sentence ${JSON.stringify(s.sentence)}`).join('\n'),
    )
  }

  const user = [
    'Tasks:',
    tasks.join('\n\n'),
    '',
    `Return: {"sections": [...], "flags": [...], "tricolons": [...]${a.fixRequests.length ? ', "fixes": {...}' : ''}${includesDashSteps ? ', "dashes": [...]' : ''}${includesSemicolonStep ? ', "semicolons": [...]' : ''}}`,
    '',
    '===== DOCUMENT =====',
    text,
  ].join('\n')

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    includesDashSteps,
    includesSemicolonStep,
    fixRefs: a.fixRequests.map((f) => f.ref),
  }
}

const FAMILIES: Family[] = ['tier1', 'tier1b', 'tier2', 'spelling', 'grammar', 'punctuation']

// Tolerant parse: the first JSON object in the reply, with every field
// checked and anything malformed dropped rather than trusted.
export function parseSharedResponse(raw: string): SharedResponse {
  // Reasoning models may prepend their thinking; its braces would confuse the
  // object search, so it goes first. A ```json fence is fine as-is.
  const body = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end <= start) throw new ReviewRequestError('The model did not return JSON', 'parse', raw)
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(body.slice(start, end + 1))
  } catch {
    throw new ReviewRequestError('The model returned malformed JSON', 'parse', raw)
  }
  if (typeof obj.skip === 'string' && obj.skip.trim()) return { sections: [], flags: [], fixes: {}, dashes: [], semicolons: [], tricolons: [], skip: obj.skip.trim() }
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  const str = (v: unknown) => (typeof v === 'string' ? v : null)

  const sections = arr(obj.sections)
    .map((s) => ({ start: str(s.start) ?? '', mode: s.mode === 'flavored' ? 'flavored' : 'strict' }) as SharedSection)
    .filter((s) => s.start.trim())
  const flags = arr(obj.flags)
    .map((f) => ({
      id: str(f.id) ?? '',
      family: (FAMILIES.includes(f.family as Family) ? f.family : 'tier2') as Family,
      span: str(f.span) ?? '',
      after: f.after === null ? null : str(f.after),
      rationale: str(f.rationale) ?? '',
    }))
    .filter((f) => f.id && f.span)
    // Tier 2 and T1b-04 never carry a fix (output-schema.md).
    .map((f) => (f.family === 'tier2' ? { ...f, after: null } : f))
  const fixes: Record<string, string> = {}
  if (obj.fixes && typeof obj.fixes === 'object') {
    for (const [k, v] of Object.entries(obj.fixes as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) fixes[k] = v
  }
  const dashes = arr(obj.dashes).map((d) => ({
    index: Number(d.index),
    verdict: (d.verdict === 'repeated' || d.verdict === 'reflexive' ? d.verdict : 'pass') as 'pass' | 'repeated' | 'reflexive',
    after: str(d.after),
    rationale: str(d.rationale) ?? '',
  }))
  const semicolons = arr(obj.semicolons).map((s) => ({ index: Number(s.index), related: s.related !== false, after: str(s.after), rationale: str(s.rationale) ?? '' }))
  const tricolons = arr(obj.tricolons)
    .map((t) => ({ span: str(t.span) ?? '', rationale: str(t.rationale) ?? '' }))
    .filter((t) => t.span)
  return { sections, flags, fixes, dashes, semicolons, tricolons }
}

export async function runSharedCall(provider: Provider, chain: string[], key: string, text: string, a: PassAResult, signal?: AbortSignal, allowSkip = true) {
  const request = buildSharedRequest(text, a, allowSkip)
  const { content, model } = await chat(provider, chain, key, request.messages, signal)
  return { request, model, response: parseSharedResponse(content) }
}
