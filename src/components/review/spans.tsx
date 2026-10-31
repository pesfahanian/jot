import type { CSSProperties, ReactNode } from 'react'
import type { ReviewFlag } from '@/lib/db'
import { lineDirections, type DirSetting } from '@/lib/direction'
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

// Both panes lay their text out line by line, each line with the direction
// lib/direction.ts gives it — the same answer as the editor, the rendered
// view and the PDF — so Farsi reads right-to-left here too. A piece of text
// that crosses lines is split, each part keeping its flag (the bubble anchors
// to the first). Zero-length pieces (arrows, deletion stubs) sit in the line
// they fall on.
interface Piece {
  text: string
  render: (text: string, key: string) => ReactNode
}

function inLines(pieces: Piece[], setting: DirSetting): ReactNode[] {
  const dirs = lineDirections(pieces.map((p) => p.text).join(''), setting)
  const lines: ReactNode[] = []
  let line: ReactNode[] = []
  const close = () => {
    const n = lines.length
    lines.push(
      <div key={n} dir={dirs[n] === 'rtl' ? 'rtl' : undefined}>
        {line.length ? line : <br />}
      </div>,
    )
    line = []
  }
  pieces.forEach((p, i) => {
    if (!p.text) {
      line.push(p.render('', `${i}`))
      return
    }
    p.text.split('\n').forEach((t, j) => {
      if (j > 0) close()
      if (t) line.push(p.render(t, `${i}.${j}`))
    })
  })
  close()
  return lines
}

// The left pane renders with no event handlers of any kind — structurally
// non-interactive (T5.3), not just visually. Bubbles never originate here.
export function OriginalText({ source, flags, activeKey, dir = 'auto' }: { source: string; flags: ReviewFlag[]; activeKey: string | null; dir?: DirSetting }) {
  const decos: Deco[] = flags.filter((f) => !isNote(f)).map((f) => ({ start: f.spanStart!, end: f.spanEnd!, flag: f }))
  const heads = headingLines(source)
  const pieces: Piece[] = []
  // Heading line ends are cuts too, so weight 600 stops at the line.
  for (const seg of segmentsOf(source, decos, heads.flat())) {
    const text = source.slice(seg.start, seg.end)
    const weight = isHeading(heads, seg.start) ? 600 : undefined
    const f = seg.flag
    if (!f) {
      pieces.push({
        text,
        render: (t, key) => (
          <span key={key} style={weight ? { fontWeight: weight } : undefined}>
            {t}
          </span>
        ),
      })
      continue
    }
    pieces.push({
      text,
      render: (t, key) => (
        <span key={key} data-flag-key={f.key} style={{ ...originalStyle(f, f.key === activeKey), fontWeight: weight }}>
          {t}
        </span>
      ),
    })
    // Trailing arrow: this flag is a replacement — something takes the
    // struck text's place. A pure deletion ("") gets bare strikethrough and
    // never an arrow (the CLS-007 bug).
    const endsHere = decos.filter((d) => d.end === seg.end && showsArrow(d.flag))
    for (const d of endsHere) {
      pieces.push({
        text: '',
        render: (_, key) => (
          <span key={key} data-arrow-for={d.flag.key} style={{ color: resolved(d.flag) ? 'var(--ink-dim)' : kindInfo(d.flag).ink }}>
            →
          </span>
        ),
      })
    }
  }
  return <>{inLines(pieces, dir)}</>
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
  dir = 'auto',
}: {
  source: string
  flags: ReviewFlag[]
  activeKey: string | null
  onOpen: (key: string) => void
  dir?: DirSetting
}) {
  const heads = headingLines(source)
  const pieces: Piece[] = previewSegments(source, flags).flatMap((seg): Piece[] => {
    const f = seg.flag
    if (!f) {
      // Unflagged text: heading lines at weight 600, judged by where each
      // line starts in the source.
      const out: Piece[] = []
      let at = 0
      while (at < seg.text.length) {
        const nl = seg.text.indexOf('\n', at)
        const end = nl === -1 ? seg.text.length : nl + 1
        const bold = isHeading(heads, seg.sourceStart + at)
        out.push({
          text: seg.text.slice(at, end),
          render: (t, key) => (
            <span key={key} style={bold ? { fontWeight: 600 } : undefined}>
              {t}
            </span>
          ),
        })
        at = end
      }
      return out
    }
    const focused = f.key === activeKey
    // A deletion leaves nothing to click: a small stub in the tier ground
    // marks the point and carries the ring (§1.11).
    if (seg.text === '' && !resolved(f)) {
      return [
        {
          text: '',
          render: (_, key) => (
            <span
              key={key}
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
          ),
        },
      ]
    }
    return [
      {
        text: seg.text,
        render: (t, key) => (
          <span
            key={key}
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
            {t}
          </span>
        ),
      },
    ]
  })
  return <>{inLines(pieces, dir)}</>
}
