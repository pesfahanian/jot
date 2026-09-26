import { undo } from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import { viewsOf } from '@/editor/sessions'
import { applyPlan, canApply } from '@/review/model'
import { useReview } from './review'
import { useWorkspace } from './workspace'

// Apply (T5.6, 6c): gated on every flag decided; writes the resolved preview
// into the document as one editor transaction, closes the view, and reports
// changes and kept counts in a toast with undo.
let toastSeq = 1000
export async function applyReview(documentId: string, paneId: string): Promise<boolean> {
  const review = useReview.getState()
  const session = review.sessions[documentId]
  if (!session || !canApply(session.flags)) return false
  const view = viewsOf(documentId)[0]
  if (!view) return false
  const plan = applyPlan(session.source, session.flags)
  // The source is what the flags anchor into; the document can't have moved
  // (editing is locked while the review is open), but guard anyway.
  if (view.state.doc.toString() !== session.source) return false
  review.closeReview(paneId)
  await review.discardSession(documentId)
  // The lock lifts on the next render; the transaction is marked as a user
  // edit so it lands in history as one undoable step.
  view.dispatch({
    changes: plan.changes,
    annotations: [Transaction.userEvent.of('review.apply'), Transaction.addToHistory.of(true)],
  })
  useWorkspace.getState().showToast({ kind: 'applied', id: ++toastSeq, documentId, changed: plan.changed, kept: plan.kept })
  return true
}

// Undo restores the pre-apply text as one editor step. It does not reopen
// the review (6c).
export function undoApply(documentId: string) {
  const view = viewsOf(documentId)[0]
  if (view) undo(view)
  useWorkspace.getState().showToast(null)
}
