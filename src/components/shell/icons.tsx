// Glyphs drawn the way 8a/8b draw them: 1.5px strokes in currentColor,
// sized to sit inside a 24×20 icon button (§1.9).

export function SortDateIcon() {
  return (
    <span className="flex items-center gap-[3px]">
      <span className="flex flex-col items-start gap-[2px]">
        <span className="h-[1.5px] w-[9px] bg-current" />
        <span className="h-[1.5px] w-[6px] bg-current" />
        <span className="h-[1.5px] w-[3px] bg-current" />
      </span>
      <span className="relative block h-[10px] w-[1.5px] bg-current">
        <span className="absolute bottom-0 -left-[2px] h-[1.5px] w-[5.5px] origin-bottom-left rotate-45 bg-current" />
        <span className="absolute bottom-[1.5px] left-[1.5px] h-[1.5px] w-[5.5px] origin-bottom-left -rotate-45 bg-current" />
      </span>
    </span>
  )
}

export function FilterIcon() {
  return (
    <span className="grid grid-cols-[5px_5px] grid-rows-[5px_5px] gap-[1.5px]">
      <span className="bg-tag-1" />
      <span className="bg-tag-2" />
      <span className="bg-tag-4" />
      <span className="bg-tag-5" />
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
