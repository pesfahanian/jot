import { liveQuery } from 'dexie'
import type { Settings } from '@/lib/db'
import { db } from '@/lib/db'
import { exportMarkdown, exportPlainText } from '@/lib/export'
import { defaultSettings, getSettings, updateSettings } from '@/lib/settings'
import { normKey } from '@/lib/shortcuts'
import { welcomeDocumentId } from '@/lib/welcome'
import { openContent } from '@/editor/sessions'
import { exportWorkspace, newComparison, newDocument, pickImport } from './actions'
import { addNote, hasSelection, highlightSelection, translateSelection, underlineSelection } from './annotate'
import { useOverlays } from './overlays'
import { docIdOf, isDiffTab } from './layout'
import { useReview } from './review'
import { nextTheme } from './theme'
import { useUi } from './ui'
import { focusedPane, useWorkspace } from './workspace'

// Every app action as a command (round 4): one list the command palette
// shows, the shortcut editor edits and the app's key handler (Shell) runs.
// Each has default keys; the person's own choices are kept in settings
// (`shortcuts`: command id → keys, [] for none). The editor's own keys —
// typing, selection, find, format — stay with the editor.

export interface CommandContext {
  settings: Settings
  sidebarOpen: boolean
  hasDocument: boolean
}

export interface Command {
  id: string
  title: string
  keys: string[]
  run(): void
  // What the palette shows beside a toggle: "on", "off", "light"…
  state?(ctx: CommandContext): string | undefined
  enabled?(ctx: CommandContext): boolean
  // Where the palette groups it, before a match ranks it.
  suggested?: boolean
}

const focusedDocument = async () => {
  const pane = focusedPane(useWorkspace.getState())
  if (!pane?.active || isDiffTab(pane.active)) return null
  return (await db.documents.get(docIdOf(pane.active))) ?? null
}
const withDocument = (fn: (doc: NonNullable<Awaited<ReturnType<typeof focusedDocument>>>) => void) => () => {
  void focusedDocument().then((d) => d && fn(d))
}
const live = (id: string, content: string) => openContent(id) ?? content

export const COMMANDS: Command[] = [
  { id: 'palette', title: 'command palette', keys: ['Mod-k', 'Mod-Shift-p'], run: () => useUi.getState().setPalette(!useUi.getState().paletteOpen) },
  { id: 'newDocument', title: 'new document', keys: ['Mod-Alt-n'], run: () => void newDocument() },
  { id: 'newComparison', title: 'new comparison', keys: ['Mod-Alt-Shift-n'], run: () => void newComparison(), suggested: true },
  { id: 'import', title: 'import…', keys: ['Mod-o'], run: () => pickImport('files'), suggested: true },
  { id: 'importFolder', title: 'import a folder…', keys: [], run: () => pickImport('folder') },
  {
    id: 'exportPdf',
    title: 'export as pdf…',
    keys: ['Mod-Shift-e'],
    run: () => {
      const pane = focusedPane(useWorkspace.getState())
      if (pane?.active && !isDiffTab(pane.active)) useUi.getState().requestPdf(pane.id)
    },
    enabled: (c) => c.hasDocument,
  },
  { id: 'exportMarkdown', title: 'export as markdown', keys: [], run: withDocument((d) => exportMarkdown(d.title, live(d.id, d.content))), enabled: (c) => c.hasDocument },
  { id: 'exportText', title: 'export as plain text', keys: [], run: withDocument((d) => exportPlainText(d.title, live(d.id, d.content))), enabled: (c) => c.hasDocument },
  { id: 'exportWorkspace', title: 'export workspace as .zip', keys: [], run: () => void exportWorkspace() },
  { id: 'settings', title: 'settings', keys: ['Mod-,'], run: () => useUi.getState().openSettings(), suggested: true },
  { id: 'shortcuts', title: 'keyboard shortcuts', keys: [], run: () => useUi.getState().openSettings('shortcuts') },
  { id: 'toggleSidebar', title: 'toggle sidebar', keys: ['Mod-b'], run: () => useWorkspace.getState().toggleSidebar(), state: (c) => (c.sidebarOpen ? 'on' : 'off') },
  { id: 'searchDocuments', title: 'search documents', keys: ['Mod-Shift-f'], run: () => {
      const ws = useWorkspace.getState()
      if (!ws.sidebarOpen) ws.toggleSidebar()
      ws.setSearch(true)
    } },
  { id: 'toggleRender', title: 'toggle rendered view', keys: ['Mod-Shift-v'], run: () => useWorkspace.getState().toggleRender(), enabled: (c) => c.hasDocument },
  { id: 'split', title: 'split pane', keys: [], run: () => useWorkspace.getState().split(), enabled: (c) => c.hasDocument },
  {
    id: 'closeTab',
    title: 'close tab',
    keys: [],
    run: () => {
      const ws = useWorkspace.getState()
      const pane = focusedPane(ws)
      if (pane?.active) ws.closeTab(pane.id, pane.active)
    },
  },
  { id: 'toggleMinimap', title: 'toggle minimap', keys: [], run: () => void getSettings().then((s) => updateSettings({ minimap: !(s.minimap ?? true) })), state: (c) => (c.settings.minimap ?? true ? 'on' : 'off') },
  { id: 'toggleTheme', title: 'toggle theme', keys: [], run: () => void getSettings().then((s) => updateSettings({ theme: nextTheme(s.theme) })), state: (c) => c.settings.theme },
  { id: 'toggleAnimations', title: 'settings: toggle animations', keys: [], run: () => void getSettings().then((s) => updateSettings({ animations: !(s.animations ?? true) })), state: (c) => (c.settings.animations ?? true ? 'on' : 'off') },
  { id: 'highlight', title: 'highlight', keys: ['Mod-Shift-h'], run: () => highlightSelection(), enabled: () => hasSelection() },
  { id: 'underline', title: 'underline', keys: ['Mod-Shift-u'], run: () => underlineSelection(), enabled: () => hasSelection() },
  { id: 'addNote', title: 'add note', keys: ['Mod-Alt-m'], run: () => addNote(), enabled: () => hasSelection() },
  { id: 'translate', title: 'translate', keys: ['Mod-Alt-t'], run: () => translateSelection(), enabled: () => hasSelection() },
  { id: 'notes', title: 'notes in this document', keys: [], run: () => useOverlays.getState().set({ notesList: true }), enabled: (c) => c.hasDocument },
  {
    id: 'aiMode',
    title: 'toggle ai mode',
    keys: ['Mod-j'],
    run: () => {
      const ws = useWorkspace.getState()
      if (ws.aiMode) ws.leaveAiMode()
      else ws.enterAiMode()
    },
    enabled: (c) => c.hasDocument || !!useWorkspace.getState().aiMode,
    state: () => (useWorkspace.getState().aiMode ? 'on' : 'off'),
  },
  { id: 'reviewStyle', title: 'review style', keys: [], run: withDocument((d) => void useReview.getState().requestReview(d.id)), enabled: (c) => c.hasDocument },
  { id: 'openWelcome', title: 'open the welcome document', keys: [], run: () => void welcomeDocumentId().then((id) => useWorkspace.getState().openDocument(id)) },
]

export const commandById = new Map(COMMANDS.map((c) => [c.id, c]))

// The person's own keys, kept current from settings so the key handler can
// match synchronously.
let overrides: Record<string, string[]> = {}
liveQuery(() => db.settings.get('settings')).subscribe({ next: (s) => (overrides = s?.shortcuts ?? {}) })

export function keysOf(id: string, own: Record<string, string[]> = overrides): string[] {
  return (own[id] ?? commandById.get(id)?.keys ?? []).map(normKey)
}

// Which command a key runs, if any.
export function commandForKey(key: string): Command | undefined {
  const k = normKey(key)
  return COMMANDS.find((c) => keysOf(c.id).includes(k))
}

export function commandContext(settings: Settings | undefined): CommandContext {
  const ws = useWorkspace.getState()
  const pane = focusedPane(ws)
  return { settings: settings ?? defaultSettings, sidebarOpen: ws.sidebarOpen, hasDocument: !!pane?.active && !isDiffTab(pane.active) }
}

// The commands the palette shows first while empty: the ones run lately.
const RECENT = 'jot.recentCommands'
export function recentCommands(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]')
  } catch {
    return []
  }
}
export function runCommand(c: Command) {
  try {
    localStorage.setItem(RECENT, JSON.stringify([c.id, ...recentCommands().filter((id) => id !== c.id)].slice(0, 5)))
  } catch {
    // Private windows can refuse storage; recents are a convenience.
  }
  c.run()
}

// Changing a key: [] for none; null back to the default.
export async function setCommandKeys(id: string, keys: string[] | null) {
  const s = await getSettings()
  const { [id]: _old, ...rest } = s.shortcuts ?? {}
  void _old
  await updateSettings({ shortcuts: keys ? { ...rest, [id]: keys.map(normKey) } : rest })
}
