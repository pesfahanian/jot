import { simplifySelection } from '@codemirror/commands'
import { findNext, findPrevious } from '@codemirror/search'
import type { KeyBinding } from '@codemirror/view'
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
export const supplementKeymap: readonly KeyBinding[] = [
  // Mac only: on Windows/Linux, Ctrl-g is the vscode keymap's go-to-line.
  { mac: 'Mod-g', run: findNext, shift: findPrevious, preventDefault: true },
  { key: 'F3', run: findNext, shift: findPrevious, preventDefault: true },
]

export const escapeFallback: readonly KeyBinding[] = [{ key: 'Escape', run: simplifySelection }]

export const editorKeymap: readonly KeyBinding[] = [...vscodeKeymap, ...supplementKeymap, ...escapeFallback]
