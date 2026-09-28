import { ArrowDownAZ, ClockArrowDown, Plus, Search } from 'lucide-react'
import type { TagColor } from '@/lib/db'
import { cn } from '@/lib/utils'
import { tagBg } from './tagClass'

// Glyphs drawn the way 8a/8b draw them: 1.5px strokes in currentColor,
// sized to sit inside a 24×20 icon button (§1.9).

// Sort icon (3d), from Lucide — shows the current order: clock with a
// down arrow for newest first, A→Z for by name.
export function SortIcon({ mode }: { mode: 'date' | 'name' }) {
  const Icon = mode === 'date' ? ClockArrowDown : ArrowDownAZ
  return <Icon size={14} strokeWidth={1.75} aria-hidden />
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
        <span key={c} className={cn('rounded-[1.5px]', muted ? 'bg-ink-mute' : tagBg[c])} />
      ))}
    </span>
  )
}

// Search and new share the sort icon's Lucide set, so the sidebar header
// reads as one row of icons.
export function SearchIcon() {
  return <Search size={14} strokeWidth={1.75} aria-hidden />
}

export function PlusIcon() {
  return <Plus size={15} strokeWidth={1.75} aria-hidden />
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
