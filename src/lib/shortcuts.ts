import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { shortcutKey } from './keys'

// Keyboard shortcuts as data (round 4, frames 3d–3e): one canonical form —
// modifiers in a fixed order, then the key, e.g. "Mod-Alt-n" — so the
// command registry, the shortcut editor and the editor's own keymap can be
// compared. Mod is ⌘ on a Mac and Ctrl elsewhere; Ctrl on a Mac is its own
// modifier.

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

const ORDER = ['mod', 'ctrl', 'alt', 'shift'] as const

// "Shift-Mod-l", "mod-shift-L", "Cmd-Alt-N" → "Mod-Alt-Shift-l".
export function normKey(k: string): string {
  const parts = k.split(/-(?!$)/)
  const key = parts.pop()!.toLowerCase()
  const mods = new Set(
    parts.map((p) => {
      const m = p.toLowerCase()
      if (m === 'cmd' || m === 'meta') return isMac ? 'mod' : 'meta'
      if (m === 'ctrl' || m === 'control') return isMac ? 'ctrl' : 'mod'
      if (m === 'option') return 'alt'
      return m
    }),
  )
  const name = (m: string) => m[0].toUpperCase() + m.slice(1)
  return [...ORDER.filter((m) => mods.has(m)).map(name), key].join('-')
}

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Fn'])
const NAMED: Record<string, string> = { ',': ',', '.': '.', '/': '/', '`': '`', ';': ';', "'": "'", '[': '[', ']': ']', '\\': '\\', '-': '-', '=': '=' }

// The canonical key a keydown means, or null for a lone modifier. Letters
// and digits come from shortcutKey (the physical key on a non-Latin layout,
// and under ⌥ on a Mac, where e.key is the character ⌥ types).
export function keyOfEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  let key = shortcutKey(e)
  if (!/^[a-z0-9]$/.test(key)) {
    const punct = e.code.match(/^(Comma|Period|Slash|Backquote|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/)
    const byCode: Record<string, string> = { Comma: ',', Period: '.', Slash: '/', Backquote: '`', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=' }
    key = punct ? byCode[punct[1]] : (NAMED[e.key] ?? e.key.toLowerCase())
  }
  const mods = [
    (isMac ? e.metaKey : e.ctrlKey) && 'Mod',
    isMac && e.ctrlKey && 'Ctrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
  ].filter(Boolean)
  return [...mods, key].join('-')
}

// How a key is shown: ⌃⌥⇧⌘K on a Mac, Ctrl+Alt+Shift+K elsewhere.
export function formatKey(k: string): string {
  const parts = normKey(k).split('-')
  const key = parts.pop()!
  const label = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1)
  if (isMac) {
    const glyph: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' }
    return ['Ctrl', 'Alt', 'Shift', 'Mod'].filter((m) => parts.includes(m)).map((m) => glyph[m]).join('') + label
  }
  const name: Record<string, string> = { Mod: 'Ctrl', Alt: 'Alt', Shift: 'Shift' }
  return [...['Mod', 'Alt', 'Shift'].filter((m) => parts.includes(m)).map((m) => name[m]), label].join('+')
}

// A key a command may have: something held besides Shift, and not ⌥ alone
// on a Mac (⌥ there types characters: ⌥N is how you type ñ).
export function isCommandKey(k: string): boolean {
  const mods = normKey(k).split('-').slice(0, -1)
  if (mods.includes('Mod') || mods.includes('Ctrl')) return true
  return !isMac && mods.includes('Alt')
}

// Keys the browser keeps for itself: a page can't have them, so binding one
// would fail silently. The shortcut editor flags them instead.
const RESERVED = ['Mod-n', 'Mod-t', 'Mod-w', 'Mod-q', 'Mod-Shift-n', 'Mod-Shift-t', 'Mod-Shift-w', ...(isMac ? ['Mod-m', 'Mod-h', 'Mod-Alt-h', 'Mod-`', 'Mod-Alt-Shift-escape'] : ['Mod-Shift-q', 'Mod-pageup', 'Mod-pagedown'])].map(normKey)
export function browserOwns(k: string): boolean {
  const n = normKey(k)
  return RESERVED.includes(n) || /^Mod-[1-9]$/.test(n)
}

// The editor's own bindings (the vscode keymap, CodeMirror's names), to
// warn before a command takes one of their keys. Two-key chords are left
// out — the editor drops its ⌘K chords for the palette (owner).
const editorKeys = new Map<string, string>()
for (const b of vscodeKeymap) {
  const k = (isMac ? b.mac : undefined) ?? b.key
  if (!k || k.includes(' ')) continue
  const name = b.run?.name?.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  if (name && !editorKeys.has(normKey(k))) editorKeys.set(normKey(k), name)
}
export function editorCommandFor(k: string): string | undefined {
  return editorKeys.get(normKey(k))
}
