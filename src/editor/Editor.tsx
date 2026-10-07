import { closeBrackets } from '@codemirror/autocomplete'
import { history } from '@codemirror/commands'
import { bracketMatching, indentOnInput, LanguageSupport } from '@codemirror/language'
import { highlightSelectionMatches, search } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { getSettings } from '@/lib/settings'
import { isLocked, useReview } from '@/state/review'
import { useWorkspace } from '@/state/workspace'
import { columnsOf } from '@/state/layout'
import { markdownWithCode } from './codeLanguages'
import { minimapCompartment, minimapFor } from './minimap'
import { editorKeymap } from './keymap'
import { getSession } from './sessions'
import { codeBlockGround, jotEditorTheme } from './theme'
import { dirCompartment, directionExtension, dirSettingFor } from './direction'
import { db } from '@/lib/db'

interface EditorProps {
  documentId: string
  initialContent: string
  paneId: string
  focused: boolean
}

// Tells CodeMirror which palette is active. Changing it is what makes the
// view re-measure line heights after a theme switch: the palettes are only
// CSS variables, which CodeMirror can't see, but dark's line-height differs
// (1.7 vs 1.65), so without this the selection layer and gutter go stale.
const themeMode = new Compartment()
// Read-only while a review view of this document is open (spec §1).
const lock = new Compartment()
const lockFor = (locked: boolean) => (locked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [])
const themeModeFor = (dark: boolean) => EditorView.theme({}, { dark })
const isDark = () => document.documentElement.classList.contains('dark')

const isRenaming = (documentId: string) => useWorkspace.getState().renamingId === documentId

function reportCursor(view: EditorView, documentId: string) {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  useWorkspace.getState().setCursor({ documentId, line: line.number, col: head - line.from + 1 })
}

// One CodeMirror view bound to one document in one pane. Remount (key by
// id) to switch documents. Text lives in the document's shared session, so
// the same document open in two panes stays in step and is saved once
// (ADR-008).
export function Editor({ documentId, initialContent, paneId, focused }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const focusedRef = useRef(focused)
  focusedRef.current = focused
  // Minimap: the setting (default on), and never with three columns open.
  const minimapSetting = useLiveQuery(() => getSettings().then((s) => s.minimap ?? true), []) ?? true
  const columnCount = useWorkspace((s) => columnsOf(s.panes).length)
  const minimapOn = minimapSetting && columnCount < 3
  // The document's direction setting (Farsi support), live.
  const dir = useLiveQuery(() => db.documents.get(documentId).then((d) => d?.dir ?? 'auto'), [documentId]) ?? 'auto'
  const dirRef = useRef(dir)
  dirRef.current = dir
  const minimapRef = useRef(minimapOn)
  minimapRef.current = minimapOn

  useEffect(() => {
    const session = getSession(documentId, initialContent)
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: session.content,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          // After drawSelection: CodeMirror stacks under-text layers in
          // reverse order (first listed on top), so this ground sits beneath
          // the selection.
          codeBlockGround,
          dropCursor(),
          rectangularSelection(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          search({ top: true }),
          // GFM markdown, with fenced code parsed in its own language
          // (codeLanguages.ts) — not lang-markdown's markdown() helper, which
          // bundles HTML/CSS/JS grammars and layers its own Enter/Backspace
          // keymap over the vscode one.
          new LanguageSupport(markdownWithCode),
          EditorView.lineWrapping,
          // Real contenteditable text, so the OS/browser spellchecker attaches
          // to it directly — the reason for CM6 over Monaco (ADR-002).
          EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'off' }),
          keymap.of(editorKeymap),
          jotEditorTheme,
          minimapCompartment.of(minimapFor(minimapRef.current)),
          directionExtension(dirRef.current),
          themeMode.of(themeModeFor(isDark())),
          lock.of(lockFor(isLocked(useReview.getState().openIn, documentId))),
          EditorView.updateListener.of((u) => {
            session.handleUpdate(u)
            if (u.focusChanged && u.view.hasFocus) useWorkspace.getState().focusPane(paneId)
            if ((u.selectionSet || u.docChanged || u.focusChanged) && focusedRef.current) reportCursor(u.view, documentId)
          }),
        ],
      }),
    })
    viewRef.current = view
    const detach = session.attach(view)
    if (focusedRef.current) {
      if (!isRenaming(documentId)) view.focus()
      reportCursor(view, documentId)
    }

    const themeObserver = new MutationObserver(() => {
      view.dispatch({ effects: themeMode.reconfigure(themeModeFor(isDark())) })
      // The selection layer still draws from the pre-switch geometry in the
      // frame that re-measures; redraw it one frame after that.
      requestAnimationFrame(() => requestAnimationFrame(() => view.dispatch({ selection: view.state.selection })))
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      themeObserver.disconnect()
      detach()
      view.destroy()
      viewRef.current = null
    }
    // initialContent seeds a new session once; the session owns the text after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, paneId])

  // Becoming the focused pane moves keyboard focus here and refreshes the
  // status bar's cursor cell. A rename in progress keeps focus in its field
  // (a new document opens straight into rename); when it ends, focus comes
  // back to the text.
  const renaming = useWorkspace((s) => s.renamingId === documentId)
  useEffect(() => {
    const view = viewRef.current
    if (!focused || !view) return
    if (!renaming && !view.hasFocus) view.focus()
    reportCursor(view, documentId)
  }, [focused, documentId, renaming])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: minimapCompartment.reconfigure(minimapFor(minimapOn)) })
  }, [minimapOn])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: dirCompartment.reconfigure(dirSettingFor(dir)) })
  }, [dir])

  const locked = useReview((s) => isLocked(s.openIn, documentId))
  useEffect(() => {
    viewRef.current?.dispatch({ effects: lock.reconfigure(lockFor(locked)) })
  }, [locked])

  // Jump requests (a search hit's line) for this document, in the focused pane.
  const reveal = useWorkspace((s) => s.reveal)
  useEffect(() => {
    const view = viewRef.current
    if (!view || !focused || !reveal || reveal.documentId !== documentId) return
    const line = view.state.doc.line(Math.min(reveal.line, view.state.doc.lines))
    view.dispatch({ selection: EditorSelection.cursor(line.from), effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
    view.focus()
  }, [reveal, focused, documentId])

  return <div ref={host} className="min-h-0 flex-auto overflow-hidden" />
}
