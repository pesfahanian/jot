import { insertBlankLine, simplifySelection } from '@codemirror/commands'
import { insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import type { StateCommand } from '@codemirror/state'
import { findNext, findPrevious } from '@codemirror/search'
import { EditorView, type KeyBinding } from '@codemirror/view'
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'

// The vscode keymap is the only keymap loaded — CodeMirror's own default
// keymaps are deliberately not layered underneath it, so no key has two
// competing meanings (T2.2). scripts/keymap-collisions.mjs checks this.
//
// Two CM6 defaults VSCode also has, which the replit keymap leaves out,
// are added back here:
//   - find next / previous: keys the vscode keymap doesn't bind at all.
//   - Escape collapses multi-cursor: appended after the vscode keymap's own
//     Escape chain (close completion, close search), so it only runs when
//     neither of those had anything to close — same order VSCode uses.
// Format document (Phase 8): Prettier's markdown formatter in the house
// style (lib/format.ts), applied as one edit — one Cmd+Z undoes it. The
// formatter loads on first use, so the edit lands a moment later; if the
// text changed meanwhile, the stale result is dropped.
const formatDocument = (view: EditorView) => {
  if (view.state.readOnly) return false
  const before = view.state.doc.toString()
  void import('@/lib/format')
    .then(async ({ formatMarkdown, minimalChange }) => {
      const change = minimalChange(before, await formatMarkdown(before))
      if (!change || view.state.doc.toString() !== before) return
      view.dispatch({ changes: change, userEvent: 'format' })
    })
    .catch((e) => console.warn('format failed', e))
  return true
}

export const supplementKeymap: readonly KeyBinding[] = [
  // Format document: VSCode's Mac default and the owner's Cmd+Shift+I.
  { key: 'Mod-Shift-i', run: formatDocument, preventDefault: true },
  { key: 'Shift-Alt-f', run: formatDocument, preventDefault: true },
  // Mac only: on Windows/Linux, Ctrl-g is the vscode keymap's go-to-line.
  { mac: 'Mod-g', run: findNext, shift: findPrevious, preventDefault: true },
  { key: 'F3', run: findNext, shift: findPrevious, preventDefault: true },
  // VSCode's ⌘↵ / Ctrl+Enter: a new line below, the cursor on it. Bound
  // here so the key is the editor's, not left to the browser (owner,
  // 2026-10-31: it was opening find).
  { key: 'Mod-Enter', run: insertBlankLine, preventDefault: true },
]

export const escapeFallback: readonly KeyBinding[] = [{ key: 'Escape', run: simplifySelection }]

// List continuation (open-decisions #4, owner: "like stackedit"). Enter in a
// list item starts the next one — "- " continues as "- ", "1." as "2.",
// "- [ ]" as a fresh task — and Enter on an empty item ends the list.
// It runs ahead of the vscode keymap's Enter but acts only when every
// cursor sits in a list item; anywhere else it declines and plain Enter
// runs untouched. (Blockquotes are left alone: lists only.)
const continueList = insertNewlineContinueMarkupCommand({ nonTightLists: false })
const inListItem: StateCommand = ({ state }) =>
  state.selection.ranges.every((r) => {
    for (let n: ReturnType<ReturnType<typeof syntaxTree>['resolveInner']> | null = syntaxTree(state).resolveInner(r.head, -1); n; n = n.parent) {
      if (n.name === 'ListItem') return true
      if (n.name === 'FencedCode' || n.name === 'CodeBlock' || n.name === 'Blockquote') return false
    }
    return false
  })
const listEnter: StateCommand = (target) => inListItem(target) && continueList(target)

export const listContinuation: readonly KeyBinding[] = [{ key: 'Enter', run: listEnter }]

// The vscode keymap's ⌘K chords give way to the command palette (owner,
// round 4): fold all, unfold all, and the chord forms of comment and
// uncomment. ⌘/ stays the comment toggle.
const withoutChords = vscodeKeymap.filter((b) => ![b.key, b.mac, b.win, b.linux].some((k) => k && /^(Mod|Cmd|Ctrl)-k /i.test(k)))

export const editorKeymap: readonly KeyBinding[] = [...listContinuation, ...withoutChords, ...supplementKeymap, ...escapeFallback]
