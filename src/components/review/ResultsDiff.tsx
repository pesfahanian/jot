import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { directionExtension } from '@/editor/direction'
import { jotEditorTheme } from '@/editor/theme'
import type { DirSetting } from '@/lib/direction'

// The results as a diff (round 4, frame 13): the same proposals, drawn the
// way the diff checker draws a comparison — the original before this run on
// the left, the result on the right ("as decided", or "if all accepted").
// Only for looking: decisions are made in the review view.

export function ResultsDiff({ source, result, dir }: { source: string; result: string; dir: DirSetting }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const side = (doc: string) => ({
      doc,
      extensions: [lineNumbers(), EditorView.lineWrapping, EditorState.readOnly.of(true), EditorView.editable.of(false), jotEditorTheme, directionExtension(dir)],
    })
    const mv = new MergeView({ parent: host.current!, a: side(source), b: side(result), gutter: true, highlightChanges: true, collapseUnchanged: { margin: 3, minSize: 6 } })
    return () => mv.destroy()
  }, [source, result, dir])
  return <div ref={host} className="jot-diff min-h-0 flex-auto overflow-auto [&_.cm-mergeView]:min-h-full" />
}
