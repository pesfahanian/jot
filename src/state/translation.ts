import { create } from 'zustand'
import { db } from '@/lib/db'
import { createDocument, getDocument, updateDocument } from '@/lib/documents'
import { getSettings, providerKey } from '@/lib/settings'
import { openContent, viewsOf } from '@/editor/sessions'
import { ReviewRequestError } from '@/review/request'
import { modelChain } from '@/review/providers'
import { useChat } from './chat'
import { useWorkspace } from './workspace'

// A full translation in progress (Phase 17): one per chat message, section
// by section into a new document that opens beside the original. The
// progress bar jumps a segment as each section lands — no fake smooth
// progress (motion spec). A failure stops where it is and can go on from
// there; the original is never touched.

export interface TranslationRun {
  documentId: string
  source: string
  target: string
  sections: string[]
  done: number
  state: 'running' | 'done' | 'failed' | 'stopped'
  error?: string
}

interface TranslationState {
  runs: Record<string, TranslationRun>
  start(documentId: string, target: string): Promise<void>
  resume(messageId: string): Promise<void>
  stop(messageId: string): void
}

const controllers: Record<string, AbortController> = {}

// Writes the next section at the end of the draft — through its editor
// when it's open, so the editor and the stored text never disagree.
async function appendTo(documentId: string, text: string) {
  const view = viewsOf(documentId)[0]
  if (view) {
    const end = view.state.doc.length
    view.dispatch({ changes: { from: end, insert: text }, userEvent: 'input.translate' })
    return
  }
  const doc = await getDocument(documentId)
  await updateDocument(documentId, { content: (doc?.content ?? '') + text })
}

export const useTranslation = create<TranslationState>()((set, get) => ({
  runs: {},
  async start(sourceId, target) {
    const { TARGETS, sections } = await import('@/ai/translateDocument')
    const source = await getDocument(sourceId)
    if (!source) return
    const text = openContent(sourceId) ?? source.content
    const draft = await createDocument({ title: `${source.title} (${TARGETS[target]?.native ?? target})`, content: '' })
    const id = crypto.randomUUID()
    useChat.getState().append(sourceId, { id, at: Date.now(), role: 'action', action: 'translate', text: `Translate into ${TARGETS[target]?.name ?? target}`, documentId: draft.id })
    set({ runs: { ...get().runs, [id]: { documentId: draft.id, source: sourceId, target, sections: sections(text), done: 0, state: 'running' } } })
    // The draft opens beside the original (AI mode's second pane).
    useWorkspace.getState().openBeside(draft.id)
    useWorkspace.getState().focusPane(useWorkspace.getState().aiMode?.paneId ?? useWorkspace.getState().focusedPaneId)
    await go(id)
  },
  async resume(id) {
    const run = get().runs[id]
    if (!run || run.state === 'running' || run.state === 'done') return
    set({ runs: { ...get().runs, [id]: { ...run, state: 'running', error: undefined } } })
    await go(id)
  },
  stop(id) {
    controllers[id]?.abort()
  },
}))

async function go(id: string) {
  const { translateSection } = await import('@/ai/translateDocument')
  const settings = await getSettings()
  const key = providerKey(settings).key
  const patch = (p: Partial<TranslationRun>) => {
    const runs = useTranslation.getState().runs
    useTranslation.setState({ runs: { ...runs, [id]: { ...runs[id], ...p } } })
  }
  if (!key) return patch({ state: 'failed', error: 'No AI key yet — add one in settings.' })
  const ctrl = new AbortController()
  controllers[id] = ctrl
  const chain = modelChain(settings.models, settings.provider)
  try {
    for (;;) {
      const run = useTranslation.getState().runs[id]
      if (run.done >= run.sections.length) break
      // The draft may have been deleted meanwhile.
      if (!(await db.documents.get(run.documentId))) return patch({ state: 'stopped' })
      const src = await getDocument(run.source)
      const { text } = await translateSection(settings.provider, chain, key, run.sections[run.done], run.target, src?.title ?? '', run.done + 1, run.sections.length, ctrl.signal)
      await appendTo(run.documentId, (run.done > 0 ? '\n' : '') + text)
      patch({ done: run.done + 1 })
    }
    patch({ state: 'done' })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return patch({ state: 'stopped' })
    const err = e instanceof ReviewRequestError ? `${err2(e)}` : String((e as Error).message ?? e)
    patch({ state: 'failed', error: err })
  } finally {
    delete controllers[id]
  }
}

const err2 = (e: ReviewRequestError) => `${e.status === 'network' ? 'no connection' : e.status} · ${e.message}`
