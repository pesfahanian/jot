import type { CSSProperties, ReactNode } from 'react'
import type { ReviewFlag } from '@/lib/db'
import { previewSegments } from '@/review/decor'
import { kindInfo } from '@/review/kinds'
import { isNote, isProofing, showsArrow } from '@/review/model'

// Span decoration (interaction spec §3–§4, design system §1.11). Each flag
// kind has its own hue (kinds.ts): a wash for fixes, an underline for "your
// call", a squiggle for proofing. The 2px accent ring says which flag is
// open — color says what kind, the ring says which one.

const ring: CSSProperties = { outline: '2px solid var(--primary)', outlineOffset: 0, borderRadius: 2 }
const resolved = (f: ReviewFlag) => f.status !== 'pending'
// "Leaves the document": accepted or edited (§1.11 — strikethrough already
// means this text is gone, which answers spec §10 without a new token).
const leaves = (f: ReviewFlag) => f.status === 'accepted' || f.status === 'edited'

// ── Left pane: the original, locked ────────────────────────────────────────

function originalStyle(f: ReviewFlag, focused: boolean): CSSProperties {
  const s: CSSProperties = {}
  if (resolved(f)) {
    s.background = 'var(--resolved-bg)'
    if (leaves(f)) {
      s.textDecoration = 'line-through'
      s.textDecorationColor = 'var(--muted-foreground)'
      s.color = 'var(--muted-foreground)'
    }
    return s
  }
  if (isProofing(f.family)) {
    Object.assign(s, { textDecoration: `underline wavy ${kindInfo(f).ink}`, textDecorationThickness: '1.5px', textUnderlineOffset: '4px' })
  } else if (f.kind === 'flag') {
    // Tier 2 (and T1b-04): underline only — nothing about the original
    // changes. Tier 2 is a 2px underline in its ink with no ground.
    Object.assign(s, { borderBottom: `2px solid ${kindInfo(f).ink}`, paddingBottom: 1 })
  } else {
    // Tier ground + strikethrough in the tier ink for text that will leave.
    Object.assign(s, { background: kindInfo(f).ground, textDecoration: 'line-through', textDecorationColor: kindInfo(f).ink })
  }
  if (focused) Object.assign(s, ring)
  return s
}

interface Deco {
  start: number
  end: number
  flag: ReviewFlag
}

// Innermost (shortest) flag wins the styling of a stretch covered by
// several; every flag's own end gets its arrow.
function segmentsOf(text: string, decos: Deco[], extraCuts: number[] = []) {
  const cuts = new Set<number>([0, text.length, ...extraCuts])
  for (const d of decos) {
    cuts.add(d.start)
    cuts.add(d.end)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const out: { start: number; end: number; flag?: ReviewFlag }[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]]
    if (a === b) continue
    const covering = decos.filter((d) => d.start <= a && d.end >= b).sort((x, y) => x.end - x.start - (y.end - y.start))
    out.push({ start: a, end: b, flag: covering[0]?.flag })
  }
  return out
}

// Headings keep weight 600; no syntax hue anywhere in the review panes
// (§1.11 — grammar blue and link blue would collide).
const headingLines = (text: string) => {
  const ranges: [number, number][] = []
  let at = 0
  for (const line of text.split('\n')) {
    if (/^#{1,6}\s/.test(line)) ranges.push([at, at + line.length])
    at += line.length + 1
  }
  return ranges
}
const isHeading = (ranges: [number, number][], pos: number) => ranges.some(([a, b]) => pos >= a && pos < b)

// The left pane renders with no event handlers of any kind — structurally
// non-interactive (T5.3), not just visually. Bubbles never originate here.
export function OriginalText({ source, flags, activeKey }: { source: string; flags: ReviewFlag[]; activeKey: string | null }) {
  const decos: Deco[] = flags.filter((f) => !isNote(f)).map((f) => ({ start: f.spanStart!, end: f.spanEnd!, flag: f }))
  const heads = headingLines(source)
  const nodes: ReactNode[] = []
  // Heading line ends are cuts too, so weight 600 stops at the line.
  for (const seg of segmentsOf(source, decos, heads.flat())) {
    const text = source.slice(seg.start, seg.end)
    const weight = isHeading(heads, seg.start) ? 600 : undefined
    const f = seg.flag
    if (!f) {
      nodes.push(
        <span key={seg.start} style={weight ? { fontWeight: weight } : undefined}>
          {text}
        </span>,
      )
      continue
    }
    nodes.push(
      <span key={seg.start} data-flag-key={f.key} style={{ ...originalStyle(f, f.key === activeKey), fontWeight: weight }}>
        {text}
      </span>,
    )
    // Trailing arrow: this flag is a replacement — something takes the
    // struck text's place. A pure deletion ("") gets bare strikethrough and
    // never an arrow (the CLS-007 bug).
    const endsHere = decos.filter((d) => d.end === seg.end && showsArrow(d.flag))
    for (const d of endsHere) {
      nodes.push(
        <span key={`arrow-${d.flag.key}`} data-arrow-for={d.flag.key} style={{ color: resolved(d.flag) ? 'var(--ink-dim)' : kindInfo(d.flag).ink }}>
          →
        </span>,
      )
    }
  }
  return <>{nodes}</>
}

// ── Right pane: result — preview ───────────────────────────────────────────

function previewStyle(f: ReviewFlag, focused: boolean): CSSProperties {
  const s: CSSProperties = { cursor: 'pointer' }
  if (!resolved(f)) {
    if (isProofing(f.family)) {
      // The fix is shown, so the error is gone: a plain underline in the
      // type's color, never a squiggle.
      Object.assign(s, { textDecoration: `underline ${kindInfo(f).ink}`, textDecorationThickness: '1.5px', textUnderlineOffset: '4px' })
    } else if (f.kind === 'flag') {
      // Tier 2 keeps its underline until acted on — no rewrite to fall back on.
      Object.assign(s, { borderBottom: `2px solid ${kindInfo(f).ink}`, paddingBottom: 1 })
    } else {
      s.background = kindInfo(f).ground
    }
  }
  if (focused) Object.assign(s, ring)
  return s
}

export function PreviewText({
  source,
  flags,
  activeKey,
  onOpen,
}: {
  source: string
  flags: ReviewFlag[]
  activeKey: string | null
  onOpen: (key: string) => void
}) {
  const segments = previewSegments(source, flags)
  return (
    <>
      {segments.map((seg) => {
        const f = seg.flag
        if (!f) return <PlainPreview key={`p${seg.sourceStart}`} text={seg.text} sourceStart={seg.sourceStart} source={source} />
        const focused = f.key === activeKey
        // A deletion leaves nothing to click: a small stub in the tier ground
        // marks the point and carries the ring (§1.11).
        if (seg.text === '' && !resolved(f)) {
          return (
            <span
              key={f.key}
              data-flag-key={f.key}
              role="button"
              tabIndex={0}
              aria-label={`${f.id} deletion`}
              onClick={(e) => {
                e.stopPropagation()
                onOpen(f.key)
              }}
              style={{ display: 'inline-block', width: 9, height: 14, verticalAlign: -2, borderRadius: 2, background: kindInfo(f).ground, cursor: 'pointer', ...(focused ? ring : {}) }}
            />
          )
        }
        return (
          <span
            key={f.key}
            data-flag-key={f.key}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onOpen(f.key)
            }}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(f.key)}
            style={previewStyle(f, focused)}
          >
            {seg.text}
          </span>
        )
      })}
    </>
  )
}

// Unflagged preview text, with heading lines at weight 600.
function PlainPreview({ text, sourceStart, source }: { text: string; sourceStart: number; source: string }) {
  const heads = headingLines(source)
  const parts: ReactNode[] = []
  let at = 0
  while (at < text.length) {
    const nl = text.indexOf('\n', at)
    const end = nl === -1 ? text.length : nl + 1
    const piece = text.slice(at, end)
    parts.push(
      <span key={at} style={isHeading(heads, sourceStart + at) ? { fontWeight: 600 } : undefined}>
        {piece}
      </span>,
    )
    at = end
  }
  return <>{parts}</>
}
