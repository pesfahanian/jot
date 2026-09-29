import { Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { showMinimap } from '@replit/codemirror-minimap'

// The minimap (Phase 8): VSCode's zoomed-out file view down the editor's
// right edge — drag or click it to scroll, the lit band is what's on screen.
// On by default (a setting, toggled from the sidebar foot) and hidden when
// three panes leave each too narrow to spare the width. Glyph colours come
// from the editor's own highlighting, so it follows the theme.

export const minimapCompartment = new Compartment()

const config = {
  create: () => ({ dom: document.createElement('div') }),
  displayText: 'characters' as const,
  showOverlay: 'always' as const,
}

export const minimapFor = (on: boolean) => [showMinimap.of(on ? config : null), minimapTheme]

// The package's grey overlay and drop shadow, redrawn in Jot's tokens.
const minimapTheme = EditorView.theme({
  '& .cm-minimap-gutter': { borderLeft: '1px solid var(--border-subtle)', backgroundColor: 'var(--document)' },
  '& .cm-minimap-box-shadow': { boxShadow: 'none' },
  '& .cm-minimap-overlay-container .cm-minimap-overlay': { background: 'var(--foreground)', opacity: '0.07' },
  '& .cm-minimap-overlay-container .cm-minimap-overlay:hover': { opacity: '0.11' },
  '& .cm-minimap-overlay-container.cm-minimap-overlay-active .cm-minimap-overlay': { opacity: '0.14' },
})
