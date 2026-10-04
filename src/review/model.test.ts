import { describe, expect, it } from 'vitest'
import type { FlagFamily, ReviewFlag } from '@/lib/db'
import { kindFor } from './assemble'
import { allowedDecisions, appliedSet, applyPlan, atStake, canApply, composeText, counts, decide, hasStake, reopen, showsArrow, standing, type Decision } from './model'

// T6.2 — the review state machine (ADR-009, interaction spec §7).

const SOURCE = 'We will leverage the pipeline moving forward, and have a robust solution. Owners will recieve it.'

let seq = 0
function flag(family: FlagFamily, before: string, after: string | null, extra: Partial<ReviewFlag> = {}): ReviewFlag {
  const start = SOURCE.indexOf(before)
  if (start === -1) throw new Error(`fixture: "${before}" not in source`)
  return {
    key: `k${++seq}`,
    id: extra.id ?? 'X',
    family,
    kind: kindFor(after),
    spanStart: start,
    spanEnd: start + before.length,
    before,
    after,
    rationale: '',
    status: 'pending',
    ...extra,
  }
}

const note = (): ReviewFlag => ({ ...flag('tier2', 'robust', null), spanStart: null, spanEnd: null, before: 'not in the document' })

describe('decision transitions', () => {
  it('offers exactly the actions the spec gives each flag type', () => {
    expect(allowedDecisions(flag('tier1', 'leverage', 'use'))).toEqual(['accept', 'reject'])
    expect(allowedDecisions(flag('tier1b', 'moving forward', ''))).toEqual(['accept', 'reject', 'edit'])
    expect(allowedDecisions(flag('tier2', 'a robust solution', null))).toEqual(['edit', 'dismiss'])
    expect(allowedDecisions(flag('spelling', 'recieve', 'receive'))).toEqual(['accept', 'ignore'])
    expect(allowedDecisions(note())).toEqual(['dismiss'])
  })

  it.each<[FlagFamily, string, string | null, Decision, ReviewFlag['status']]>([
    ['tier1', 'leverage', 'use', 'accept', 'accepted'],
    ['tier1', 'leverage', 'use', 'reject', 'rejected'],
    ['tier1b', 'moving forward', '', 'accept', 'accepted'],
    ['tier1b', 'moving forward', '', 'reject', 'rejected'],
    ['tier2', 'a robust solution', null, 'dismiss', 'dismissed'],
    ['spelling', 'recieve', 'receive', 'accept', 'accepted'],
    ['grammar', 'have', 'has', 'ignore', 'ignored'],
  ])('%s: %s → %s', (family, before, after, decision, status) => {
    const f = flag(family, before, after)
    expect(decide([f], f.key, decision)[0].status).toBe(status)
  })

  it('records an edit only with the person’s own text', () => {
    const f = flag('tier2', 'a robust solution', null)
    expect(decide([f], f.key, 'edit')[0].status).toBe('pending')
    const edited = decide([f], f.key, 'edit', 'a failover under one second')[0]
    expect(edited.status).toBe('edited')
    expect(edited.userText).toBe('a failover under one second')
  })

  it('refuses actions a flag does not offer', () => {
    const t1 = flag('tier1', 'leverage', 'use')
    const proof = flag('spelling', 'recieve', 'receive')
    expect(decide([t1], t1.key, 'edit', 'x')[0].status).toBe('pending')
    expect(decide([t1], t1.key, 'dismiss')[0].status).toBe('pending')
    expect(decide([proof], proof.key, 'reject')[0].status).toBe('pending')
  })

  it('lets a decision be revised or reopened before apply, dropping stale edit text', () => {
    const f = flag('tier1b', 'moving forward', '')
    let flags = decide([f], f.key, 'edit', 'from now on')
    flags = decide(flags, f.key, 'reject')
    expect(flags[0].status).toBe('rejected')
    expect(flags[0].userText).toBeUndefined()
    flags = reopen(flags, f.key)
    expect(flags[0].status).toBe('pending')
  })

  it('only touches the flag it was given', () => {
    const a = flag('tier1', 'leverage', 'use')
    const b = flag('spelling', 'recieve', 'receive')
    const out = decide([a, b], a.key, 'accept')
    expect(out[1]).toBe(b)
  })
})

describe('decided / pending counter and the apply gate', () => {
  const fresh = () => [
    flag('tier1', 'leverage', 'use'),
    flag('tier1b', 'moving forward', ''),
    flag('tier2', 'a robust solution', null),
    flag('spelling', 'recieve', 'receive'),
    note(),
  ]

  it('counts every flag once toward proposed, style and proofing alike', () => {
    expect(counts(fresh())).toEqual({ proposed: 5, decided: 0, pending: 5 })
  })

  it('moves a flag to decided on any of the five terminal actions', () => {
    let f = fresh()
    f = decide(f, f[0].key, 'reject')
    f = decide(f, f[1].key, 'edit', 'going forward')
    f = decide(f, f[2].key, 'dismiss')
    f = decide(f, f[3].key, 'ignore')
    expect(counts(f)).toEqual({ proposed: 5, decided: 4, pending: 1 })
    expect(canApply(f)).toBe(false)
    f = decide(f, f[4].key, 'dismiss')
    expect(counts(f)).toEqual({ proposed: 5, decided: 5, pending: 0 })
    expect(canApply(f)).toBe(true)
  })

  it('keeps apply disabled until decided equals proposed, one flag short or not', () => {
    const f = fresh()
    const allButLast = f.slice(0, 4).reduce((acc, x) => decide(acc, x.key, allowedDecisions(x)[allowedDecisions(x).length - 1], 'x'), f)
    expect(counts(allButLast).decided).toBe(4)
    expect(canApply(allButLast)).toBe(false)
  })

  it('reopening a decision takes it back off the counter', () => {
    let f = fresh()
    f = decide(f, f[0].key, 'accept')
    f = reopen(f, f[0].key)
    expect(counts(f).decided).toBe(0)
  })
})

describe('preview and apply', () => {
  it('previews tier defaults — fixes shown, Tier 2 untouched — while final applies only decisions', () => {
    const f = [flag('tier1', 'leverage', 'use'), flag('tier2', 'a robust solution', null), flag('spelling', 'recieve', 'receive')]
    expect(composeText(SOURCE, appliedSet(f, 'preview'))).toBe('We will use the pipeline moving forward, and have a robust solution. Owners will receive it.')
    expect(composeText(SOURCE, appliedSet(f, 'final'))).toBe(SOURCE)
  })

  it('reports changes separately from decisions that change nothing', () => {
    let f = [flag('tier1', 'leverage', 'use'), flag('tier1b', 'moving forward', ''), flag('tier2', 'a robust solution', null), flag('spelling', 'recieve', 'receive')]
    f = decide(f, f[0].key, 'accept')
    f = decide(f, f[1].key, 'reject')
    f = decide(f, f[2].key, 'dismiss')
    f = decide(f, f[3].key, 'accept')
    const plan = applyPlan(SOURCE, f)
    expect(plan.changed).toBe(2)
    expect(plan.kept).toBe(2)
    expect(plan.text).toBe('We will use the pipeline moving forward, and have a robust solution. Owners will receive it.')
  })

  it('treats an edit identical to the original as a kept decision, not a change', () => {
    let f = [flag('tier2', 'a robust solution', null)]
    f = decide(f, f[0].key, 'edit', 'a robust solution')
    expect(applyPlan(SOURCE, f).changed).toBe(0)
  })

  it('lets the wider of two overlapping flags win its stretch', () => {
    const inner = flag('tier1', 'robust', 'resilient')
    const outer = flag('tier1', 'have a robust solution', 'have a failover plan')
    let f = [inner, outer]
    f = decide(f, inner.key, 'accept')
    f = decide(f, outer.key, 'accept')
    expect(applyPlan(SOURCE, f).text).toContain('have a failover plan.')
    // With the wide rewrite rejected, the narrow fix applies on its own.
    f = decide(f, outer.key, 'reject')
    expect(applyPlan(SOURCE, f).text).toContain('have a resilient solution.')
  })

  it('never applies a note — it has no span', () => {
    let f = [note()]
    f = decide(f, f[0].key, 'dismiss')
    expect(applyPlan(SOURCE, f)).toMatchObject({ changed: 0, text: SOURCE })
  })
})

describe('decoration rules — the CLS-007 arrow bug', () => {
  it('maps after onto kind: null → flag, "" → delete, text → replace', () => {
    expect(kindFor(null)).toBe('flag')
    expect(kindFor('')).toBe('delete')
    expect(kindFor('use')).toBe('replace')
  })

  it('gives a pure deletion bare strikethrough, never an arrow', () => {
    expect(showsArrow(flag('tier1b', 'moving forward', '', { id: 'CLS-007' }))).toBe(false)
  })

  it('gives a replacement its arrow', () => {
    expect(showsArrow(flag('tier1', 'leverage', 'use'))).toBe(true)
  })

  it('never arrows a Tier 2 flag, a proofing flag or a note', () => {
    expect(showsArrow(flag('tier2', 'a robust solution', null))).toBe(false)
    expect(showsArrow(flag('spelling', 'recieve', 'receive'))).toBe(false)
    expect(showsArrow(note())).toBe(false)
  })
})

describe('review standing against the current text', () => {
  const edited = SOURCE + ' More text.'
  it('is current while the text is exactly what was reviewed', () => {
    expect(standing(SOURCE, [flag('tier1', 'leverage', 'use')], SOURCE)).toBe('current')
    expect(standing(SOURCE, [], SOURCE)).toBe('current')
  })

  it('is stale after any change while something is undecided', () => {
    expect(standing(SOURCE, [flag('tier1', 'leverage', 'use')], SOURCE + ' ')).toBe('stale')
  })

  it('is stale after a change while an accepted or edited decision would be lost', () => {
    const f = flag('tier1', 'leverage', 'use')
    expect(standing(SOURCE, decide([f], f.key, 'accept'), edited)).toBe('stale')
    const t = flag('tier2', 'a robust solution', null)
    expect(standing(SOURCE, decide([t], t.key, 'edit', 'a solution'), edited)).toBe('stale')
  })

  it('is spent after a change when nothing would be lost', () => {
    const f = flag('tier1', 'leverage', 'use')
    const s = flag('spelling', 'recieve', 'receive')
    expect(standing(SOURCE, [], edited)).toBe('spent')
    expect(standing(SOURCE, decide(decide([f, s], f.key, 'reject'), s.key, 'ignore'), edited)).toBe('spent')
  })

  it('counts what is at stake', () => {
    const f = flag('tier1', 'leverage', 'use')
    const g = flag('tier1', 'moving forward', '')
    expect(atStake(decide([f, g, note()], f.key, 'accept'))).toEqual({ pending: 2, changes: 1 })
    expect(hasStake(decide([f], f.key, 'reject'))).toBe(false)
  })
})

// Open-decisions #16: a pending flag wholly inside a wider flag that was
// accepted or edited is set aside as superseded — no text changes, and it
// comes back when the wider flag stops replacing.
describe('overlapping flags — superseded', () => {
  const fixture = () => {
    const wide = flag('tier1b', 'We will leverage the pipeline moving forward', 'We use the pipeline from now on')
    const narrow = flag('tier1', 'leverage', 'use')
    const outside = flag('spelling', 'recieve', 'receive')
    return { wide, narrow, outside }
  }

  it('sets aside a pending flag inside an accepted or edited wider one', () => {
    const { wide, narrow, outside } = fixture()
    const flags = decide([wide, narrow, outside], wide.key, 'accept')
    expect(flags[1]).toMatchObject({ status: 'superseded', supersededBy: wide.key })
    expect(flags[2].status).toBe('pending')
    expect(decide([wide, narrow], wide.key, 'edit', 'We use it')[1].status).toBe('superseded')
  })

  it('counts a superseded flag as decided, so apply is not blocked by it', () => {
    const { wide, narrow } = fixture()
    const flags = decide([wide, narrow], wide.key, 'accept')
    expect(counts(flags)).toEqual({ proposed: 2, decided: 2, pending: 0 })
    expect(canApply(flags)).toBe(true)
    expect(applyPlan(SOURCE, flags).text.startsWith('We use the pipeline from now on')).toBe(true)
  })

  it('brings it back when the wider flag is reopened or stops replacing', () => {
    const { wide, narrow } = fixture()
    const accepted = decide([wide, narrow], wide.key, 'accept')
    expect(reopen(accepted, wide.key)[1]).toEqual(narrow)
    expect(decide(accepted, wide.key, 'reject')[1]).toEqual(narrow)
  })

  it("never overrides the person's own decision on the narrower flag", () => {
    const { wide, narrow } = fixture()
    let flags = decide([wide, narrow], narrow.key, 'reject')
    flags = decide(flags, wide.key, 'accept')
    expect(flags[1].status).toBe('rejected')
    flags = reopen(flags, wide.key)
    expect(flags[1].status).toBe('rejected')
  })

  it('lets the person decide a superseded flag themselves, dropping the link', () => {
    const { wide, narrow } = fixture()
    let flags = decide([wide, narrow], wide.key, 'accept')
    flags = decide(flags, narrow.key, 'accept')
    expect(flags[1].status).toBe('accepted')
    expect(flags[1].supersededBy).toBeUndefined()
  })
})
