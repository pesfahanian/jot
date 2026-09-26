import type { FlagFamily, ReviewFlag } from '@/lib/db'
import { appliedSet, compose, isNote, type Applied } from './model'

// Review colors (design system §1.6): tier grounds and inks on the neutral
// ramp, proofing inks per error type.
export const tierGround: Partial<Record<FlagFamily, string>> = {
  tier1: 'var(--tier-1-bg)',
  tier1b: 'var(--tier-1b-bg)',
  tier2: 'var(--tier-2-bg)',
}
export const tierInk: Partial<Record<FlagFamily, string>> = {
  tier1: 'var(--tier-1)',
  tier1b: 'var(--tier-1b)',
  tier2: 'var(--tier-2)',
}
export const proofInk: Partial<Record<FlagFamily, string>> = {
  spelling: 'var(--proof-spelling)',
  grammar: 'var(--proof-grammar)',
  punctuation: 'var(--proof-punct)',
}

// Every flag's current state applied (tier defaults for pending), plus
// identity entries for flags that change nothing right now (pending Tier 2,
// rejected, ignored, dismissed) so their spans stay clickable.
export function previewSegments(source: string, flags: ReviewFlag[]) {
  const applied = appliedSet(flags, 'preview')
  const all: Applied[] = [...applied]
  const others = flags
    .filter((f) => !isNote(f) && !applied.some((a) => a.flag.key === f.key))
    .sort((a, b) => a.spanEnd! - a.spanStart! - (b.spanEnd! - b.spanStart!))
  for (const f of others) {
    const r = { start: f.spanStart!, end: f.spanEnd! }
    if (all.some((a) => r.start < a.end && a.start < r.end)) continue
    all.push({ flag: f, start: r.start, end: r.end, text: source.slice(r.start, r.end) })
  }
  return compose(
    source,
    all.sort((a, b) => a.start - b.start),
  )
}
