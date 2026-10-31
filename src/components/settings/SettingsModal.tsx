import { useLiveQuery } from 'dexie-react-hooks'
import { Dialog as D } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { db } from '@/lib/db'
import { useMotion } from '@/lib/motion'
import { getSettings, updateSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { exportWorkspace, pickImport } from '@/state/actions'
import { useReview } from '@/state/review'
import { useTheme } from '@/state/theme'
import { useUi, type SettingsSection } from '@/state/ui'
import { AiProviderSection } from './AiProviderSection'
import { Grid, Label, quietButton, Rule, SectionHead, Segmented, Switch } from './controls'
import { ShortcutsSection } from './ShortcutsSection'
import { TranslationSection } from './TranslationSection'

// Settings (round 4, frames 3a–3e): a modal, 780 × 540, sections grouped
// ai / app / data. Opened from the sidebar foot, the palette and ⌘, — and
// by asking for a review with no key, which lands on ai provider.

// Every item has its own view.
const NAV: { group: string; items: { label: string; section: SettingsSection }[] }[] = [
  {
    group: 'ai',
    items: [
      { label: 'ai provider', section: 'ai' },
      { label: 'translation', section: 'translation' },
    ],
  },
  {
    group: 'app',
    items: [
      { label: 'editor', section: 'editor' },
      { label: 'appearance', section: 'appearance' },
      { label: 'keyboard shortcuts', section: 'shortcuts' },
    ],
  },
  {
    group: 'data',
    items: [
      { label: 'storage and backup', section: 'storage' },
      { label: 'about', section: 'about' },
    ],
  },
]

function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[18px] px-[22px] py-[18px]">{children}</div>
}

function EditorPage() {
  const renderIn = useLiveQuery(() => getSettings().then((s) => s.renderIn ?? 'tab'), []) ?? 'tab'
  const autofix = useLiveQuery(() => getSettings().then((s) => s.autofix ?? false), []) ?? false
  return (
    <Page>
      <SectionHead title="editor" />
      <Row title="rendered view" detail={renderIn === 'tab' ? 'Opens as a new tab beside the document, in the same pane.' : 'Opens in a split beside the document.'}>
        <Segmented value={renderIn} options={['tab', 'split'] as const} onChange={(renderIn) => void updateSettings({ renderIn })} />
      </Row>
      <Row
        title="auto-fix spelling"
        detail="Quietly corrects clear typos a couple of words behind you — English only, never inside code or links, each fix its own undo. Downloads a 200 KB dictionary the first time."
      >
        <Switch label="auto-fix spelling" on={autofix} onChange={(on) => void updateSettings({ autofix: on })} />
      </Row>
    </Page>
  )
}

function AppearancePage() {
  const { preference, resolved } = useTheme()
  const motion = useMotion()
  return (
    <Page>
      <SectionHead title="appearance" />
      <Row title="theme" detail={preference === 'system' ? `Follows your system, light or dark — now ${resolved}.` : 'Light and dark share every shape; only colour changes.'}>
        <Segmented value={preference} options={['light', 'dark', 'system'] as const} onChange={(theme) => void updateSettings({ theme })} />
      </Row>
      <Row title="animations" detail={motion.systemReduced ? 'Your system asks for reduced motion.' : 'Menus, the palette, panes and ai mode move briefly as they open.'}>
        <Switch label="animations" on={motion.on} disabled={motion.systemReduced} onChange={(on) => void updateSettings({ animations: on })} />
      </Row>
    </Page>
  )
}

function Row({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex flex-auto flex-col gap-0.5">
        <span className="text-[13px] font-medium">{title}</span>
        {detail && <span className="text-[12px] text-pretty text-ink-tertiary">{detail}</span>}
      </span>
      {children}
    </div>
  )
}

const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

function StoragePage() {
  const count = useLiveQuery(() => db.documents.count(), []) ?? 0
  const [state, setState] = useState<{ persisted: boolean | null; usage: number | null; quota: number | null }>({ persisted: null, usage: null, quota: null })
  useEffect(() => {
    let live = true
    void (async () => {
      const persisted = (await navigator.storage?.persisted?.().catch(() => null)) ?? null
      const est = await navigator.storage?.estimate?.().catch(() => null)
      if (live) setState({ persisted, usage: est?.usage ?? null, quota: est?.quota ?? null })
    })()
    return () => {
      live = false
    }
  }, [count])
  const share = state.usage !== null && state.quota ? Math.min(1, state.usage / state.quota) : 0
  return (
    <Page>
      <SectionHead title="storage and backup">
        Each browser keeps its own separate workspace. Documents written in this browser are not visible in another one, or in a private window.
      </SectionHead>
      <Grid label={112}>
        <Label>this browser</Label>
        <span className="flex items-center gap-2 text-foreground">
          <span className="size-1.5 rounded-full bg-secondary-foreground" />
          {state.persisted === null ? 'unknown' : state.persisted ? 'persistent' : 'best effort'}
          <span className="text-muted-foreground">
            {state.persisted ? "· the browser won't clear it to free space" : state.persisted === false ? '· the browser may clear it when space runs low' : ''}
          </span>
        </span>
        <Label>used</Label>
        <span className="flex flex-col gap-[5px]">
          <span className="text-foreground">
            {state.usage !== null ? mb(state.usage) : '—'} <span className="text-muted-foreground">· {count} document{count === 1 ? '' : 's'}</span>
          </span>
          <span className="h-1 w-[260px] rounded-sm bg-hover-lift">
            <span className="block h-1 min-w-1.5 rounded-sm bg-secondary-foreground" style={{ width: `${share * 100}%` }} />
          </span>
        </span>
      </Grid>
      <Rule />
      <div className="flex flex-col gap-2.5">
        <Row title="export the workspace" detail="Every document as markdown, in one .zip.">
          <button type="button" className={quietButton} onClick={() => void exportWorkspace()}>
            export .zip
          </button>
        </Row>
        <Row title="import" detail="Markdown or text files, a folder, or a jot .zip. Imports add documents; nothing is replaced.">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={quietButton}>
                import…
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => pickImport('files')}>files…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickImport('folder')}>a folder…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Row>
      </div>
    </Page>
  )
}

function AboutPage() {
  return (
    <Page>
      <SectionHead title="about" />
      <div className="grid gap-x-3 gap-y-[7px] font-mono text-[11px]" style={{ gridTemplateColumns: '112px minmax(0, 1fr)' }}>
        <span className="text-ink-tertiary">version</span>
        <span>
          {__APP_VERSION__} · {new Date(__BUILD_DATE__).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className="text-ink-tertiary">licence</span>
        <span>MIT</span>
        <span className="text-ink-tertiary">source</span>
        <span className="text-secondary-foreground">
          <a href="https://github.com/pesfahanian/jot" target="_blank" rel="noreferrer" className="underline underline-offset-[3px] hover:text-foreground">
            github.com/pesfahanian/jot
          </a>
        </span>
      </div>
    </Page>
  )
}

export function SettingsModal() {
  const { open: settingsOpen, section: chosen } = useUi((s) => s.settings)
  const keyPanelOpen = useReview((s) => s.keyPanel.open)
  const setSection = useUi((s) => s.setSettingsSection)
  const closeSettings = useUi((s) => s.closeSettings)
  const closeKeyPanel = useReview((s) => s.closeKeyPanel)
  const open = settingsOpen || keyPanelOpen
  // Asking for a review with no key lands on the provider.
  const section = keyPanelOpen ? 'ai' : chosen
  const close = () => {
    closeSettings()
    closeKeyPanel()
  }

  return (
    <D.Root open={open} onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="jot-modal-overlay fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--foreground)_14%,transparent)]" />
        <D.Content
          aria-describedby={undefined}
          className="jot-modal fixed top-1/2 left-1/2 z-50 flex h-[540px] w-[780px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--radius-panel) border border-border-float bg-popover text-foreground outline-none"
        >
          <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border pr-2.5 pl-[18px]">
            <D.Title className="flex-auto text-[15px] font-semibold tracking-[-0.02em]">settings</D.Title>
            <D.Close className="flex size-6 items-center justify-center rounded-md font-mono text-[14px] text-secondary-foreground hover:bg-hover-lift hover:text-foreground" aria-label="close">
              ×
            </D.Close>
          </div>
          <div className="flex min-h-0 flex-auto">
            <nav className="flex w-[184px] flex-none flex-col gap-0.5 border-r border-border bg-card px-2 py-3 text-[13px] text-secondary-foreground">
              {NAV.map((g, gi) => (
                <div key={g.group} className="flex flex-col gap-0.5">
                  <span className={cn('px-2.5 pb-0.5 font-mono text-[11px] text-muted-foreground', gi === 0 ? 'pt-1' : 'pt-2.5')}>{g.group}</span>
                  {g.items.map((it) => {
                    const on = section === it.section
                    return (
                      <button
                        key={it.label}
                        type="button"
                        onClick={() => {
                          if (keyPanelOpen) closeKeyPanel()
                          setSection(it.section)
                          document.getElementById('settings-body')?.scrollTo({ top: 0 })
                        }}
                        className={cn(
                          'rounded-r-md border-l-2 px-2.5 py-[5px] text-left hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                          on ? 'border-primary bg-hover-lift text-foreground' : 'border-transparent',
                        )}
                      >
                        {it.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
            <div id="settings-body" className="min-w-0 flex-auto overflow-y-auto">
              {section === 'ai' && (
                <Page>
                  <AiProviderSection onDone={close} />
                </Page>
              )}
              {section === 'translation' && (
                <Page>
                  <TranslationSection />
                </Page>
              )}
              {section === 'editor' && <EditorPage />}
              {section === 'appearance' && <AppearancePage />}
              {section === 'shortcuts' && <ShortcutsSection />}
              {section === 'storage' && <StoragePage />}
              {section === 'about' && <AboutPage />}
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
