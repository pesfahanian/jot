import { describe, expect, it } from 'vitest'
import type { FlagFamily, ReviewFlag } from '@/lib/db'
import { kindCounts, kindOf } from './kinds'

const flag = (family: FlagFamily, extra: Partial<ReviewFlag> = {}): ReviewFlag => ({
  key: Math.random().toString(36),
  id: 'X',
  family,
  kind: 'replace',
  spanStart: 0,
  spanEnd: 1,
  before: 'a',
  after: 'b',
  rationale: '',
  status: 'pending',
  ...extra,
})

describe('flag kinds', () => {
  it('names each flag for what it asks of the reader', () => {
    expect(kindOf(flag('tier1'))).toBe('quick')
    expect(kindOf(flag('tier1b'))).toBe('check')
    expect(kindOf(flag('tier2', { kind: 'flag', after: null }))).toBe('call')
    // A Tier 1b flag with no fix (T1b-04) is the reader's call, not a fix to check.
    expect(kindOf(flag('tier1b', { kind: 'flag', after: null }))).toBe('call')
    expect(kindOf(flag('grammar'))).toBe('grammar')
    expect(kindOf(flag('tier2', { spanStart: null, spanEnd: null }))).toBe('note')
  })

  it('counts per kind in legend order, leaving out empty kinds', () => {
    const flags = [flag('tier2', { kind: 'flag' }), flag('tier1'), flag('tier1', { status: 'accepted' })]
    expect(kindCounts(flags)).toEqual([
      { kind: 'quick', total: 2, pending: 1 },
      { kind: 'call', total: 1, pending: 1 },
    ])
  })
})
