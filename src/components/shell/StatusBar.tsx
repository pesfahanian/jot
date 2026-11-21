import { useLiveQuery } from 'dexie-react-hooks'
import { Check, PanelRight, PanelRightDashed, SpellCheck } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { hasRtl, lineDirections, type DirSetting } from '@/lib/direction'
import { updateDocument } from '@/lib/documents'
import { openContent, viewsOf } from '@/editor/sessions'
import { activeEditor } from '@/editor/annotations'
import { fixAllTypos } from '@/editor/spelling'
import { useTypos } from '@/state/spelling'
import { usePacks } from '@/state/packs'
import { useUi } from '@/state/ui'
import { ENGLISH, LANGUAGE, languageFor, OFF, PACKS } from '@/lib/languages'
import type { JotDocument } from '@/lib/db'
import { countText, groupDigits } from '@/lib/counts'
import { applyUpdate, useUpdateReady } from '@/lib/offline'
import { getSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { columnsOf, docIdOf } from '@/state/layout'
import { useCursor } from '@/state/cursor'
import { focusedPane, useWorkspace } from '@/state/workspace'
import { NotesCell } from '@/components/annotations/NotesCell'

// Counts hug their values and pack against the bar's right edge (§1.8:
// every number is monospace, tabular). The cursor, which changes width on
// almost every keystroke, leads the group and keeps its spare room on its
// left, in the bar's empty stretch — so its changes never move anything,
// and no gap shows. A count only nudges the cells left of it when it gains
// a digit.
function Cell({ label, value, reserve, className }: { label: string; value: string; reserve?: string; className?: string }) {
  return (
    // The leading (reserving) cell has no divider: it would stand in the
    // empty stretch, apart from the text.
    <div className={cn('flex items-center border-border-subtle px-2', !reserve && 'border-l', className)}>
      <span className="text-right tabular-nums" style={reserve ? { minWidth: `calc(${reserve} + ${label.length + 1}ch)` } : undefined}>
        <span className="font-normal text-muted-foreground">{label}</span> {value}
      </span>
    </div>
  )
}

// Text direction (Farsi support, design frame 6): a quiet cell at the
// bar's left (owner, 2026-11-17), shown only on a document with right-to-left text or a forced
// direction, so an English document's bar is unchanged. In auto it says
// what the block under the cursor resolved to. A menu, not a cycle: a
// change reflows the whole document, so the choice is explicit. Stored with
// the document.
const DIR_CHOICES: { value: DirSetting; label: string; hint: string }[] = [
  { value: 'auto', label: 'auto', hint: 'by block' },
  { value: 'rtl', label: 'right-to-left', hint: 'rtl' },
  { value: 'ltr', label: 'left-to-right', hint: 'ltr' },
]

function DirCell({ doc, text, line }: { doc: JotDocument; text: string; line: number }) {
  const setting: DirSetting = doc.dir ?? 'auto'
  if (setting === 'auto' && !hasRtl(text)) return null
  const resolved = lineDirections(text, setting)[line - 1] ?? 'ltr'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="text direction of this document" className="flex items-center px-2 hover:bg-hover-lift data-[state=open]:bg-hover-lift">
          <span className="text-muted-foreground">dir</span>&nbsp;{setting}
          {setting === 'auto' && <span className="text-muted-foreground">&nbsp;·&nbsp;{resolved}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={5} className="w-[220px]">
        <div className="px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground">direction · this document</div>
        {DIR_CHOICES.map((c) => (
          <DropdownMenuItem key={c.value} onSelect={() => void updateDocument(doc.id, { dir: c.value })} className={cn(c.value === setting && 'text-foreground')}>
            <Check size={13} strokeWidth={2} className={cn('text-primary', c.value !== setting && 'invisible')} aria-hidden />
            <span className="flex-auto">{c.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{c.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The languages this document is spell-checked in (lib/languages.ts) —
// shown only once a language pack is installed, so without packs the bar
// is as it always was. A quiet icon (owner, 2026-11-21: calm in the bar,
// everything in the menu); a short code beside it only when the document
// is checked in something other than English and Farsi. The menu is a
// set of switches, one script per section (owner: a tick means "checked
// here"): click a language to check that script in it, click the ticked
// one to stop checking that script in this document.
function LangCell({ doc }: { doc: JotDocument }) {
  const settings = useLiveQuery(() => getSettings(), [])
  const installed = usePacks((s) => s.installed)
  const openSettings = useUi((s) => s.openSettings)
  if (!settings?.autofix || !installed.size) return null
  const latinDefault = settings.spellLatin ?? 'en'
  const latin = languageFor('latin', installed, latinDefault, { latin: doc.spellLatin })
  const arabic = languageFor('arabic', installed, latinDefault, { arabic: doc.spellArabic })
  const latinChoices = [ENGLISH, ...PACKS.filter((p) => p.script === 'latin' && installed.has(p.code))]
  const arabicChoices = PACKS.filter((p) => p.script === 'arabic' && installed.has(p.code))
  const name = (code: string) => LANGUAGE.get(code)?.name ?? code
  const unusual = [latin && latin !== 'en' && latin, arabic === 'ar' && arabic].filter(Boolean).join(' · ')
  const none = !latin && !arabic
  // Picking the language a script would get anyway stores nothing, so the
  // document keeps following settings.
  const pickLatin = (code: string) => void updateDocument(doc.id, { spellLatin: code === latin ? OFF : code === latinDefault ? undefined : code })
  const arabicDefault = installed.has('fa') ? 'fa' : 'ar'
  const pickArabic = (code: string) => void updateDocument(doc.id, { spellArabic: code === arabic ? OFF : code === arabicDefault ? undefined : code })
  const item = (on: boolean, l: { code: string; name: string }, pick: (code: string) => void) => (
    // The menu stays open, so several switches can be flipped in one go (owner).
    <DropdownMenuItem
      key={l.code}
      onSelect={(e) => {
        e.preventDefault()
        pick(l.code)
      }}
      className={cn(on && 'text-foreground')}
    >
      <Check size={13} strokeWidth={2} className={cn('text-primary', !on && 'invisible')} aria-hidden />
      <span className="flex-auto">{l.name}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{l.code}</span>
    </DropdownMenuItem>
  )
  const head = (text: string) => <div className="px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground">{text}</div>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="spell-check languages"
          title={`spell-check in this document: ${[latin ? name(latin) : 'english alphabet off', arabicChoices.length ? (arabic ? name(arabic) : 'farsi alphabet off') : null].filter(Boolean).join(' · ')}`}
          className={cn('flex items-center gap-1 px-2 hover:bg-hover-lift hover:text-foreground data-[state=open]:bg-hover-lift', none ? 'text-ink-dim' : 'text-secondary-foreground')}
        >
          <SpellCheck size={13} strokeWidth={1.75} aria-hidden />
          {unusual && <span>{unusual}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={5} className="w-[220px]">
        {head('english alphabet')}
        {latinChoices.map((l) => item(latin === l.code, l, pickLatin))}
        {arabicChoices.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {head('farsi alphabet')}
            {arabicChoices.map((l) => item(arabic === l.code, l, pickArabic))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openSettings('languages')}>
          <span className="w-[13px]" aria-hidden />
          <span className="flex-auto text-secondary-foreground">language packs…</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Typos marked in this document (spelling suggestions, editor/spelling.ts),
// with a way to fix them all as one undo step. At the bar's left, with the
// direction.
function TyposCell({ documentId }: { documentId: string }) {
  const on = useLiveQuery(() => getSettings().then((s) => s.autofix ?? false), []) ?? false
  const all = useTypos((s) => s.byDoc[documentId]?.all ?? 0)
  const sure = useTypos((s) => s.byDoc[documentId]?.sure ?? 0)
  if (!on || !all) return null
  const fixSure = () => {
    const active = activeEditor()
    const view = active?.documentId === documentId ? active.view : viewsOf(documentId)[0]
    if (view) fixAllTypos(view)
  }
  // Only sure fixes go in a batch; close calls wait for a click.
  return (
    <div className="flex items-center px-2">
      <span className="text-muted-foreground">typos</span>&nbsp;{all}
      {sure > 0 && (
        <button
          type="button"
          onClick={fixSure}
          title={sure === all ? 'fix every typo' : `fix the ${sure} with a sure fix — click the others to choose`}
          className="ml-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          · {sure === all ? 'fix all' : `fix ${sure}`}
        </button>
      )}
    </div>
  )
}

// A new version of Jot is downloaded and waiting (lib/offline.ts): a quiet
// offer at the bar's left. Every edit is saved, so reloading loses nothing.
function UpdateReady() {
  const ready = useUpdateReady()
  if (!ready) return null
  return (
    <button type="button" onClick={applyUpdate} title="a new version of jot is ready" className="flex items-center gap-[7px] px-2.5 hover:bg-hover-lift">
      <span className="size-1.5 rounded-full bg-primary" />
      updated <span className="text-muted-foreground">· reload</span>
    </button>
  )
}

// Minimap on/off (Phase 8; in the status bar since the owner moved it), one
// setting for every editor. Lit while on. With three columns open the
// editors hide it regardless — the tooltip says so.
function MinimapToggle() {
  const on = useLiveQuery(() => getSettings().then((s) => s.minimap ?? true), []) ?? true
  const crowded = useWorkspace((s) => columnsOf(s.panes).length >= 3)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="minimap"
      title={`minimap: ${on ? 'on' : 'off'}${on && crowded ? ' (hidden with three columns)' : ''} — click to ${on ? 'hide' : 'show'}`}
      onClick={() => void updateSettings({ minimap: !on })}
      className={cn(
        'flex w-[30px] flex-none items-center justify-center border-l border-border-subtle hover:bg-hover-lift hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        on ? 'text-secondary-foreground' : 'text-ink-dim',
      )}
    >
      {on ? <PanelRight size={13} strokeWidth={1.75} aria-hidden /> : <PanelRightDashed size={13} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

export function StatusBar({ docsById }: { docsById: Map<string, JotDocument> }) {
  const pane = useWorkspace(focusedPane)
  const cursor = useCursor((s) => s.cursor)
  // A rendered tab counts as its document.
  const doc = pane?.active ? docsById.get(docIdOf(pane.active)) : undefined
  const text = doc ? (openContent(doc.id) ?? doc.content) : ''
  const c = countText(text)
  const cur = cursor && doc && cursor.documentId === doc.id ? cursor : { line: 1, col: 1 }

  return (
    <footer className="@container flex h-[35px] flex-none items-stretch overflow-hidden rounded-(--radius-status) border border-border-strong bg-card font-mono text-[11.5px] whitespace-nowrap">
      {/* The bar is about the focused document; the global controls are an
          update waiting, at the left, and the minimap toggle (owner). The
          cells only some documents have — direction, typos, notes — sit at the
          left too, so the counts at the right keep their place from one
          document to the next (owner, 2026-11-17). */}
      <div className="flex items-stretch divide-x divide-border-subtle [&:not(:empty)]:border-r [&:not(:empty)]:border-border-subtle">
        <UpdateReady />
        {doc && <DirCell doc={doc} text={text} line={cur.line} />}
        {doc && <LangCell doc={doc} />}
        {doc && <TyposCell documentId={doc.id} />}
        {doc && <NotesCell documentId={doc.id} />}
      </div>
      <div className="flex-auto" />
      {doc && (
        <>
          <Cell label="cursor" value={`${cur.line}:${cur.col}`} reserve="7ch" className="font-medium" />
          {/* Under the panes only, the bar can be narrow: bytes and paras, the
              least used, give way first. */}
          <Cell label="bytes" value={groupDigits(c.bytes)} className="hidden @[920px]:flex" />
          <Cell label="chars" value={groupDigits(c.chars)} />
          <Cell label="words" value={groupDigits(c.words)} />
          <Cell label="lines" value={groupDigits(c.lines)} />
          <Cell label="paras" value={groupDigits(c.paras)} className="hidden pr-2.5 @[920px]:flex" />
        </>
      )}
      {/* The minimap toggle, at the far right (round 4). */}
      <MinimapToggle />
    </footer>
  )
}
