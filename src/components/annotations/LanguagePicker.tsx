import { ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { updateSettings } from '@/lib/settings'
import { DETECT, LANGUAGES, languageName } from '@/lib/translate'
import { cn } from '@/lib/utils'

// A translation language, from Google's list: the last few picked first,
// then every language by name; "detect" where the source can be left to
// Google. Picking one remembers it as recent.

function rememberLanguage(code: string, recent: readonly string[]) {
  void updateSettings({ translateRecent: [code, ...recent.filter((c) => c !== code)].slice(0, 5) })
}

export function LanguagePicker({
  value,
  onChange,
  recent,
  detect,
  label,
  shown,
  className,
}: {
  value: string | null
  onChange: (code: string | null) => void
  recent: readonly string[]
  detect?: boolean
  label: string
  // What the button says, if not the value's name (a detected language).
  shown?: string
  className?: string
}) {
  const pick = (code: string | null) => {
    if (code) rememberLanguage(code, recent)
    onChange(code)
  }
  const recents = recent.filter((c) => LANGUAGES[c])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} className={cn('flex h-5 items-center gap-1 rounded-[5px] border border-border bg-background px-1.5 text-secondary-foreground hover:text-foreground', className)}>
          {shown ?? languageName(value)}
          <ChevronDown size={11} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[280px] overflow-y-auto">
        {detect && <DropdownMenuItem onSelect={() => pick(null)}>{DETECT}</DropdownMenuItem>}
        {recents.map((c) => (
          <DropdownMenuItem key={`r-${c}`} onSelect={() => pick(c)}>
            {languageName(c)}
          </DropdownMenuItem>
        ))}
        {(detect || recents.length > 0) && <DropdownMenuSeparator />}
        {Object.entries(LANGUAGES).map(([code, name]) => (
          <DropdownMenuItem key={code} onSelect={() => pick(code)}>
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
