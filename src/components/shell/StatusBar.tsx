import { cn } from '@/lib/utils'
import { counters, cursorLine } from './sample'

function Cell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 border-border-subtle px-[11px]', className)}>
      <span className="font-normal text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function StatusBar({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return (
    <footer className="flex h-7 flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px]">
      <div className="flex items-center border-r border-border-subtle px-[5px]">
        <button
          type="button"
          className="flex h-[18px] items-center gap-1.5 rounded-sm border border-border-strong px-[7px]"
        >
          <span className="size-[5px] rounded-[2px] bg-primary" />
          review style
        </button>
      </div>
      <Cell label="key" value="set" className="border-r" />
      <div className="flex-auto" />
      {counters.map(([label, value]) => (
        <Cell key={label} label={label} value={value} className="border-l" />
      ))}
      <Cell label="cursor" value={`${cursorLine}:47`} className="border-l font-medium" />
      {/* Temporary: in-memory toggle for checking both palettes. T4.1 replaces this. */}
      <button type="button" onClick={onToggleTheme} className="flex items-center">
        <Cell label="theme" value={theme} className="h-full border-l pr-3" />
      </button>
    </footer>
  )
}
