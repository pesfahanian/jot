import { Fragment, useRef, type CSSProperties } from 'react'
import type { JotDocument, PaneLayout } from '@/lib/db'
import { columnsOf } from '@/state/layout'
import { useWorkspace } from '@/state/workspace'
import { EditorPane } from './EditorPane'

// The pane grid (Phase 13): up to three columns, each one pane or two
// stacked, with the seams between them as resize handles — an 8px hit
// target with nothing drawn at rest, like the sidebar's (§1.9). Panes are
// placed absolutely from one flat, keyed list, so a pane that moves (a
// column closing, a stacked pane taking the top) keeps its editor mounted:
// cursor, scroll and undo stay.

// Smallest a pane may be dragged to.
const MIN_WIDTH = 260
const MIN_HEIGHT = 140

// `part` of the space left once `seams` seams are taken out, plus `offset`
// seams: every position in the grid is one of these.
const at = (part: number, seams: number, offset = 0) => `calc((100% - ${seams} * var(--seam)) * ${part} + ${offset} * var(--seam))`

function seamPx(el: HTMLElement) {
  return parseFloat(getComputedStyle(el).getPropertyValue('--seam')) || 8
}

export function PaneGrid({ panes, docsById }: { panes: PaneLayout[]; docsById: Map<string, JotDocument> }) {
  const resizePanes = useWorkspace((s) => s.resizePanes)
  const self = useRef<HTMLDivElement>(null)
  const cols = columnsOf(panes)
  const n = cols.length
  const weights = cols.map((c) => c[0].size ?? 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const starts = weights.map((_, i) => weights.slice(0, i).reduce((a, b) => a + b, 0) / total)

  const placed: { pane: PaneLayout; style: CSSProperties }[] = []
  cols.forEach((col, i) => {
    const x = { left: at(starts[i], n - 1, i), width: at(weights[i] / total, n - 1) }
    if (col.length === 1) return placed.push({ pane: col[0], style: { ...x, top: 0, bottom: 0 } })
    const split = col[0].split ?? 0.5
    placed.push({ pane: col[0], style: { ...x, top: 0, height: at(split, 1) } })
    placed.push({ pane: col[1], style: { ...x, top: at(split, 1, 1), bottom: 0 } })
  })

  // Dragging the seam between columns i-1 and i: those two trade width,
  // each kept to MIN_WIDTH; the rest keep theirs. Sizes are stored as the
  // columns' pixel widths, which work as weights at any window size.
  function dragColumns(e: React.PointerEvent, i: number) {
    const box = self.current!.getBoundingClientRect()
    const avail = box.width - (n - 1) * seamPx(self.current!)
    const px = weights.map((w) => (avail * w) / total)
    const x0 = e.clientX
    const pair = px[i - 1] + px[i]
    const move = (ev: PointerEvent) => {
      const left = Math.min(pair - MIN_WIDTH, Math.max(MIN_WIDTH, px[i - 1] + ev.clientX - x0))
      const sizes = Object.fromEntries(cols.map((c, k) => [c[0].id, { size: k === i - 1 ? left : k === i ? pair - left : px[k] }]))
      resizePanes(sizes)
    }
    track(e, move)
  }

  // Dragging the seam inside a stacked column moves the split.
  function dragRows(e: React.PointerEvent, col: PaneLayout[]) {
    const box = self.current!.getBoundingClientRect()
    const avail = box.height - seamPx(self.current!)
    const y0 = e.clientY
    const top0 = avail * (col[0].split ?? 0.5)
    const move = (ev: PointerEvent) => {
      const top = Math.min(avail - MIN_HEIGHT, Math.max(MIN_HEIGHT, top0 + ev.clientY - y0))
      resizePanes({ [col[0].id]: { split: top / avail } })
    }
    track(e, move)
  }

  // Double-click: the two columns share their width evenly; a stack splits
  // in half.
  function evenColumns(i: number) {
    const half = (weights[i - 1] + weights[i]) / 2
    resizePanes({ [cols[i - 1][0].id]: { size: half }, [cols[i][0].id]: { size: half } })
  }

  return (
    <div ref={self} className="absolute inset-0">
      {placed.map(({ pane, style }) => (
        <EditorPane key={pane.id} pane={pane} docsById={docsById} style={style} />
      ))}
      {cols.map((col, i) => (
        <Fragment key={col[0].id}>
          {i > 0 && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="resize columns"
              onPointerDown={(e) => dragColumns(e, i)}
              onDoubleClick={() => evenColumns(i)}
              style={{ left: at(starts[i], n - 1, i - 1) }}
              className="absolute inset-y-0 z-30 w-(--seam) cursor-col-resize"
            />
          )}
          {col.length > 1 && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="resize panes"
              onPointerDown={(e) => dragRows(e, col)}
              onDoubleClick={() => resizePanes({ [col[0].id]: { split: 0.5 } })}
              style={{ left: at(starts[i], n - 1, i), width: at(weights[i] / total, n - 1), top: at(col[0].split ?? 0.5, 1) }}
              className="absolute z-30 h-(--seam) cursor-row-resize"
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

// Follows the pointer until it's released; text selection is off meanwhile.
function track(e: React.PointerEvent, move: (ev: PointerEvent) => void) {
  e.preventDefault()
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    document.body.style.removeProperty('user-select')
  }
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
