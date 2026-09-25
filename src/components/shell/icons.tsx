import type { TagColor } from '@/lib/db'
import { cn } from '@/lib/utils'
import { tagBg } from './tagClass'

// Glyphs drawn the way 8a/8b draw them: 1.5px strokes in currentColor,
// sized to sit inside a 24×20 icon button (§1.9).

// Sort icon, two modes (3d): newest first — bars run long to short, arrow
// down; A to Z — bars run short to long, arrow up.
export function SortIcon({ mode }: { mode: 'date' | 'name' }) {
  const bars = mode === 'date' ? [9, 6, 3] : [3, 6, 9]
  return (
    <span className="flex items-center gap-[3px]">
      <span className="flex flex-col items-start gap-[2px]">
        {bars.map((w, i) => (
          <span key={i} className="h-[1.5px] bg-current" style={{ width: w }} />
        ))}
      </span>
      <span className={cn('relative block h-[10px] w-[1.5px] bg-current', mode === 'name' && 'rotate-180')}>
        <span className="absolute bottom-0 -left-[2px] h-[1.5px] w-[5.5px] origin-bottom-left rotate-45 bg-current" />
        <span className="absolute bottom-[1.5px] left-[1.5px] h-[1.5px] w-[5.5px] origin-bottom-left -rotate-45 bg-current" />
      </span>
    </span>
  )
}

// At rest the face is a 2×2 sample of the palette. While filtering it shows
// what is being filtered (drift audit #8): one color as a single square,
// several as a grid of the selected ones.
// With nothing to filter (first run) it draws at mute, like sort and search.
export function FilterIcon({ active, muted }: { active: TagColor[]; muted?: boolean }) {
  if (active.length === 1) return <span className={cn('size-2 rounded-[2px]', tagBg[active[0]])} />
  const cells = active.length ? active.slice(0, 4) : ([1, 2, 4, 5] as TagColor[])
  return (
    <span className="grid grid-cols-[5px_5px] grid-rows-[5px_5px] gap-[1.5px]">
      {cells.map((c) => (
        <span key={c} className={muted ? 'bg-ink-mute' : tagBg[c]} />
      ))}
    </span>
  )
}

export function SearchIcon() {
  return (
    <span className="relative block size-[8px] rounded-full border-[1.5px] border-current">
      <span className="absolute top-[6px] left-[6px] h-[1.5px] w-[5px] origin-left rotate-45 bg-current" />
    </span>
  )
}

export function PlusIcon() {
  return <span className="font-mono text-[14px] leading-none">+</span>
}

export function PinIcon() {
  return (
    <span className="flex w-[7px] flex-none flex-col items-center">
      <span className="size-[7px] rounded-full border-[1.5px] border-current" />
      <span className="h-[4px] w-[1.5px] bg-current" />
    </span>
  )
}

export function SplitIcon() {
  return (
    <span className="flex h-[9px] w-[11px] rounded-[2px] border border-current">
      <span className="flex-auto border-r border-current" />
      <span className="flex-auto" />
    </span>
  )
}

// "No color" is absence, drawn as a struck empty square — never a seventh
// color value (§1.5).
export function NoColorMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('rounded-sm border border-border-strong', className)}
      style={{
        background:
          'linear-gradient(to top right, transparent calc(50% - 0.5px), var(--border-strong) calc(50% - 0.5px), var(--border-strong) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
      }}
    />
  )
}
