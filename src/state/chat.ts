import { create } from 'zustand'
import { aiNotesInOrder, notesInOrder } from '@/lib/annotations'
import { db, type ChatMessage } from '@/lib/db'
import { getDocument } from '@/lib/documents'
import { getSettings, providerKey } from '@/lib/settings'
import { openContent } from '@/editor/sessions'
import { ReviewRequestError } from '@/review/request'
import { modelChain } from '@/review/providers'
import { useAnnotations } from './annotations'
import { useReview } from './review'

// AI mode's conversation, per document (Phase 17): kept in this browser
// with the document, gone with it. Sending takes the queued AI notes with
// the message (they leave the text and live in the message from then on),
// and the person's own notes as context when switched on. A failure keeps
// the message and its notes for a retry; nothing is sent twice.

interface ChatState {
  byDoc: Record<string, ChatMessage[]>
  busy: Record<string, AbortController>
  load(documentId: string): Promise<void>
  append(documentId: string, message: ChatMessage): void
  send(documentId: string, text: string, withNotes: boolean): Promise<void>
  retry(documentId: string, messageId: string): Promise<void>
  cancel(documentId: string): void
  clear(documentId: string): void
}

const save = (documentId: string, messages: ChatMessage[]) => void db.chats.put({ documentId, messages })
const liveText = async (id: string) => openContent(id) ?? (await getDocument(id))?.content ?? ''
const TIMEOUT_MS = 90_000

export const useChat = create<ChatState>()((set, get) => ({
  byDoc: {},
  busy: {},
  async load(documentId) {
    if (get().byDoc[documentId]) return
    const chat = await db.chats.get(documentId)
    set({ byDoc: { ...get().byDoc, [documentId]: chat?.messages ?? [] } })
  },
  append(documentId, message) {
    // Never save over a conversation not read yet: load it first.
    if (!get().byDoc[documentId]) {
      void get().load(documentId).then(() => get().append(documentId, message))
      return
    }
    const messages = [...(get().byDoc[documentId] ?? []), message]
    set({ byDoc: { ...get().byDoc, [documentId]: messages } })
    save(documentId, messages)
  },
  async send(documentId, text, withNotes) {
    const list = useAnnotations.getState().byDoc[documentId] ?? []
    const queue = aiNotesInOrder(list)
    if (!text.trim() && !queue.length) return
    const personal = withNotes ? notesInOrder(list).filter((n) => n.body?.trim()) : []
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      at: Date.now(),
      role: 'user',
      text: text.trim(),
      notes: queue.map((n, i) => ({ n: i + 1, quote: n.quote, body: n.body ?? '' })),
      context: personal.length,
    }
    get().append(documentId, message)
    // The notes go with the message: off the text, into the chat.
    if (queue.length)
      useAnnotations.getState().set(
        documentId,
        list.filter((a) => a.kind !== 'ai-note'),
      )
    await run(documentId, message, personal.map((p) => ({ ...p })))
  },
  async retry(documentId, messageId) {
    const messages = get().byDoc[documentId] ?? []
    const message = messages.find((m) => m.id === messageId)
    if (!message || message.role !== 'user') return
    // The failure card gives way to the new attempt.
    const kept = messages.filter((m) => !(m.role === 'error' && m.retry === messageId))
    set({ byDoc: { ...get().byDoc, [documentId]: kept } })
    save(documentId, kept)
    const personal = message.context ? notesInOrder(useAnnotations.getState().byDoc[documentId] ?? []).filter((n) => n.body?.trim()) : []
    await run(documentId, message, personal)
  },
  cancel(documentId) {
    get().busy[documentId]?.abort()
  },
  clear(documentId) {
    set({ byDoc: { ...get().byDoc, [documentId]: [] } })
    void db.chats.delete(documentId)
  },
}))

async function run(documentId: string, message: Extract<ChatMessage, { role: 'user' }>, personal: ReturnType<typeof notesInOrder>) {
  const st = useChat.getState()
  const settings = await getSettings()
  const key = providerKey(settings).key
  if (!key) {
    st.append(documentId, { id: crypto.randomUUID(), at: Date.now(), role: 'error', kind: 'no-key', message: 'No AI key yet', retry: message.id })
    return
  }
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, TIMEOUT_MS)
  useChat.setState({ busy: { ...useChat.getState().busy, [documentId]: ctrl } })
  const chain = modelChain(settings.models, settings.provider)
  try {
    const text = await liveText(documentId)
    const doc = await getDocument(documentId)
    const history = (useChat.getState().byDoc[documentId] ?? []).filter((m) => m.id !== message.id)
    const { ask, toFlags } = await import('@/ai/assistant')
    const { reply, model } = await ask(settings.provider, chain, key, { title: doc?.title ?? '', text, message: message.text, aiNotes: message.notes, personalNotes: personal, history }, ctrl.signal)
    if (reply.declined) {
      st.append(documentId, { id: crypto.randomUUID(), at: Date.now(), role: 'error', kind: 'declined', message: reply.declined, model, retry: message.id })
      return
    }
    // The text may have moved on while the call ran; anchor to what it says now.
    const now = await liveText(documentId)
    const flags = toFlags(now, reply)
    if (flags.length) await useReview.getState().addProposals(documentId, now, flags, model)
    st.append(documentId, {
      id: crypto.randomUUID(),
      at: Date.now(),
      role: 'assistant',
      text: reply.answer || (flags.length ? `${flags.length} proposal${flags.length === 1 ? '' : 's'}.` : 'Done.'),
      model,
      proposals: flags.filter((f) => f.spanStart !== null).length,
      unmatched: flags.filter((f) => f.spanStart === null).length,
      keys: flags.map((f) => f.key),
    })
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError'
    // Stopped by the person: nothing to report; the message stays.
    if (aborted && !timedOut) return
    const err = e instanceof ReviewRequestError ? e : null
    st.append(documentId, {
      id: crypto.randomUUID(),
      at: Date.now(),
      role: 'error',
      kind: 'provider',
      message: aborted ? 'No answer in time' : err ? `${settings.provider} · ${err.status === 'network' ? 'no connection' : err.status} · ${err.message}` : String((e as Error).message ?? e),
      detail: aborted ? `Gave up after ${TIMEOUT_MS / 1000} s.` : chain.length > 1 ? `tried ${chain.join(', then ')}` : undefined,
      retry: message.id,
    })
  } finally {
    clearTimeout(timer)
    const { [documentId]: _done, ...busy } = useChat.getState().busy
    void _done
    useChat.setState({ busy })
  }
}
