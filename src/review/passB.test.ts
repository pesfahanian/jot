import { describe, expect, it } from 'vitest'
import { runPassA } from './passA'
import { allowance, resolveSections, runPassB } from './passB'
import type { Mode, SharedResponse } from './sharedCall'

// Pass B arithmetic (T5.11) — the three kinds, and T1-11's per-document
// budget in particular, the one most likely to be built wrong by analogy.

function passB(text: string, sections: { start: string; mode: Mode }[]) {
  const a = runPassA(text)
  const shared: SharedResponse = {
    sections,
    flags: [],
    fixes: Object.fromEntries(a.fixRequests.map((f) => [f.ref, `fix ${f.ref}`])),
    dashes: [],
    semicolons: [],
    tricolons: [],
  }
  return runPassB(text, a, shared, resolveSections(text, a, sections))
}

const ids = (flags: { id: string; span: string }[], id: string) => flags.filter((f) => f.id === id).map((f) => f.span)

describe('T1-11 — one flavored budget per document, not per section', () => {
  const doc = [
    'Why we moved. Despite the added latency, this is a net improvement for the team.',
    '',
    'Setup steps. Despite the cost, run the migration now.',
    '',
    'More rationale. Despite the risk, the result was worth it for everyone.',
    '',
  ].join('\n')

  it('fails a strict-section candidate on its own', () => {
    const flags = ids(passB(doc, [{ start: 'Why we moved.', mode: 'strict' }]), 'T1-11')
    expect(flags).toHaveLength(3)
  })

  it('allows only the first flavored candidate anywhere in the document', () => {
    const flags = ids(
      passB(doc, [
        { start: 'Why we moved.', mode: 'flavored' },
        { start: 'Setup steps.', mode: 'flavored' },
        { start: 'More rationale.', mode: 'flavored' },
      ]),
      'T1-11',
    )
    expect(flags).toHaveLength(2)
    expect(flags[0]).toMatch(/^Despite the cost/)
    expect(flags[1]).toMatch(/^Despite the risk/)
  })

  it('does not reset the budget in a second flavored section after a strict one', () => {
    const flags = ids(
      passB(doc, [
        { start: 'Why we moved.', mode: 'flavored' },
        { start: 'Setup steps.', mode: 'strict' },
        { start: 'More rationale.', mode: 'flavored' },
      ]),
      'T1-11',
    )
    // Strict one fails alone; the third fails because the first used the budget.
    expect(flags.map((s) => s.slice(0, 16))).toEqual(['Despite the cost', 'Despite the risk'])
  })
})

describe('T1-08 — flat per-sentence cap by the sentence’s own section', () => {
  const long = 'The migration of every queue worker and scheduler and runner has to be finished by the owners of each service before next week.'
  it('fails a 23-word descriptive sentence only where the cap is below it', () => {
    const text = `Intro.\n\n${long}\n`
    expect(ids(passB(text, [{ start: 'Intro.', mode: 'strict' }]), 'T1-08')).toHaveLength(0)
    const longer = `${long.slice(0, -1)} without any exception at all.`
    expect(ids(passB(`Intro.\n\n${longer}\n`, [{ start: 'Intro.', mode: 'strict' }]), 'T1-08')).toHaveLength(1)
    expect(ids(passB(`Intro.\n\n${longer}\n`, [{ start: 'Intro.', mode: 'flavored' }]), 'T1-08')).toHaveLength(0)
  })

  it('uses the instruction cap (20) for list items and imperatives', () => {
    const imperative = 'Run the migration for every queue worker and scheduler and runner that belongs to the owners of each service today, please.'
    expect(ids(passB(`Steps.\n\n${imperative}\n`, [{ start: 'Steps.', mode: 'strict' }]), 'T1-08')).toHaveLength(1)
  })
})

describe('rate caps — T1-01 and T1b-05 density', () => {
  it('reads "flag above 1 per N words" as an allowance of at least one', () => {
    expect(allowance(200, 500)).toBe(1)
    expect(allowance(1000, 500)).toBe(2)
    expect(allowance(0, 150)).toBe(1)
  })

  it('fails a lone antithesis in strict, allows it in flavored', () => {
    const text = "Overview. It's not a rewrite, it's a refinement.\n"
    expect(ids(passB(text, [{ start: 'Overview.', mode: 'strict' }]), 'T1-01')).toHaveLength(1)
    expect(ids(passB(text, [{ start: 'Overview.', mode: 'flavored' }]), 'T1-01')).toHaveLength(0)
  })

  it('fails every em dash in a section over the density cap, each as its own record', () => {
    const text = 'Notes. Led the vertical — owned architecture. Built the layer — handled edge cases. The system is fast — really fast — and scales.\n'
    const flags = passB(text, [{ start: 'Notes.', mode: 'flavored' }]).filter((f) => f.id === 'T1b-05')
    expect(flags).toHaveLength(3)
    expect(new Set(flags.map((f) => f.rationale.split('.')[0])).size).toBe(1)
    expect(flags.every((f) => f.after && f.after.length > 0)).toBe(true)
  })
})
