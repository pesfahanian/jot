import { closeBrackets } from '@codemirror/autocomplete'
import { history } from '@codemirror/commands'
import { markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput, LanguageSupport } from '@codemirror/language'
import { highlightSelectionMatches, search } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { createAutosave } from '@/lib/autosave'
import { editorKeymap } from './keymap'
import { jotEditorTheme } from './theme'

interface EditorProps {
  documentId: string
  initialContent: string
  // Fires on every edit with the new content — the in-memory binding (T2.1).
  onChange?: (content: string) => void
}

// Tells CodeMirror which palette is active. Changing it is what makes the
// view re-measure line heights after a theme switch: the palettes are only
// CSS variables, which CodeMirror can't see, but dark's line-height differs
// (1.7 vs 1.65), so without this the selection layer and gutter go stale.
const themeMode = new Compartment()
const themeModeFor = (dark: boolean) => EditorView.theme({}, { dark })
const isDark = () => document.documentElement.classList.contains('dark')

// One CodeMirror instance bound to one document. Remount (key by id) to
// switch documents; every edit goes straight to autosave (ADR-008).
export function Editor({ documentId, initialContent, onChange }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const autosave = createAutosave(documentId)
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          search({ top: true }),
          // The markdown language alone (GFM), not lang-markdown's markdown()
          // helper: that one bundles HTML/CSS/JS grammars for embedded code
          // and layers its own Enter/Backspace keymap over the vscode one.
          new LanguageSupport(markdownLanguage),
          EditorView.lineWrapping,
          // Real contenteditable text, so the OS/browser spellchecker attaches
          // to it directly — the reason for CM6 over Monaco (ADR-002).
          EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'off' }),
          keymap.of(editorKeymap),
          jotEditorTheme,
          themeMode.of(themeModeFor(isDark())),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return
            const content = u.state.doc.toString()
            autosave.write(content)
            onChangeRef.current?.(content)
          }),
        ],
      }),
    })
    view.focus()

    const themeObserver = new MutationObserver(() => {
      view.dispatch({ effects: themeMode.reconfigure(themeModeFor(isDark())) })
      // The selection layer still draws from the pre-switch geometry in the
      // frame that re-measures; redraw it one frame after that.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => view.dispatch({ selection: view.state.selection })),
      )
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      themeObserver.disconnect()
      view.destroy()
      void autosave.dispose()
    }
    // initialContent is read once at mount; the editor owns the text after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  return <div ref={host} className="min-h-0 flex-auto overflow-hidden" />
}
