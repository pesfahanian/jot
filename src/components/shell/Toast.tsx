import { useEffect } from 'react'
import { UNDO_WINDOW_MS, undoDelete } from '@/state/actions'
import { undoApply } from '@/state/reviewActions'
import { db, type Comparison } from '@/lib/db'

// Undo a cleared comparison: put it back as it was.
async function undoClear(c: Comparison) {
  await db.comparisons.put(c)
  useWorkspace.getState().showToast(null)
}
import { useWorkspace } from '@/state/workspace'

// The one inverted surface per theme, which is what makes it read as
// transient (§1.13). The 2px bar is the remaining undo window (2e).
export function Toast() {
  const toast = useWorkspace((s) => s.toast)
  const showToast = useWorkspace((s) => s.showToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => {
      if (useWorkspace.getState().toast?.id === toast.id) showToast(null)
    }, UNDO_WINDOW_MS)
    return () => clearTimeout(t)
  }, [toast, showToast])

  if (!toast) return null
  return (
    <div
      role="status"
      // Keyed by id so a replacing toast restarts the countdown bar.
      key={toast.id}
      className="absolute bottom-3.5 left-3.5 z-40 flex w-[360px] flex-col overflow-hidden rounded-md bg-toast-bg text-toast-fg"
    >
      <div className="flex items-center gap-2.5 py-[9px] pr-2.5 pl-3 font-mono text-[12px]">
        <span className="min-w-0 flex-auto truncate">
          {toast.kind === 'deleted' ? (
            <>
              deleted <span className="text-toast-muted">{toast.entry.doc.title}</span>
            </>
          ) : toast.kind === 'cleared' ? (
            <>comparison cleared</>
          ) : toast.kind === 'notice' ? (
            <>
              {toast.lead} <span className="text-toast-muted">{toast.detail}</span>
            </>
          ) : (
            <>
              {toast.changed} {toast.changed === 1 ? 'change' : 'changes'} applied <span className="text-toast-muted">{toast.kept} kept</span>
            </>
          )}
        </span>
        {toast.kind !== 'notice' && (
        <button
          type="button"
          onClick={() => (toast.kind === 'deleted' ? void undoDelete(toast.id) : toast.kind === 'cleared' ? void undoClear(toast.comparison) : undoApply(toast.documentId))}
          className="rounded-sm border border-(--toast-line) px-2 py-0.5 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          undo
        </button>
        )}
        <button type="button" aria-label="dismiss" onClick={() => showToast(null)} className="text-(--toast-line) hover:text-toast-fg">
          ×
        </button>
      </div>
      <div className="h-0.5 bg-(--toast-track)">
        <div className="h-0.5 origin-left bg-primary" style={{ animation: `jot-countdown ${UNDO_WINDOW_MS}ms linear forwards` }} />
      </div>
    </div>
  )
}
