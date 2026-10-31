import type { Annotation, ChatMessage as Message, Provider, ReviewFlag } from '@/lib/db'
import { anchorQuote, type Range } from '@/review/anchor'
import { chat } from '@/review/providers'
import { ReviewRequestError, type ChatMessage } from '@/review/request'

// AI mode's assistant (Phase 17): one call per message. The model gets the
// whole document, the AI notes pinned to it (instructions), the person's
// own notes when they switch them on (context only), and the conversation
// so far. It acts unless told not to — asking for a change gives proposals,
// a question gives an answer — and every proposal is a verbatim stretch of
// the document with its replacement, anchored back like the style review's
// quotes and decided the same way: nothing applies itself (ADR-009).

export const SYSTEM = `You are the editor inside Jot, a markdown writing app. You work on ONE document, given below. The writer talks to you in a chat, and may pin "AI notes" to stretches of the text: each AI note is an instruction about its stretch.

How to respond:
- When the writer asks for a change, or an AI note asks for one, propose edits. Each proposal replaces ONE exact stretch of the document ("quote") with new text ("replacement").
- Copy every quote character for character from the document: whole sentences, clauses or list items, never paraphrased, never spanning a code block, unique enough to find. Keep markdown syntax (#, -, **, links) intact in the replacement. To delete a stretch, use an empty replacement.
- Change only what was asked about. Prefer a few focused proposals over a rewrite. Keep the document's language and voice; never translate unless asked.
- When the writer asks a question, or says not to change anything, answer only, with no proposals.
- Nothing you propose changes the document until the writer accepts it.
- Write "answer" in the language of the writer's message, in one to three plain sentences: what you propose and why, or the answer to the question. Refer to AI notes by number.
- If you can't or won't do what's asked, say so in "declined" (one sentence) and propose nothing.

Reply with only this JSON object, no prose around it:
{"answer": "...", "proposals": [{"quote": "...", "replacement": "...", "why": "...", "note": 1}], "declined": null}
"note" is the number of the AI note a proposal answers, or null when it answers the chat message.`

export interface AskInput {
  title: string
  text: string
  message: string
  aiNotes: { n: number; quote: string; body: string }[]
  personalNotes: Annotation[]
  history: Message[]
}

// The one user turn: document, notes, the conversation so far, the message.
export function buildMessages(input: AskInput): ChatMessage[] {
  const parts = [`<document title="${input.title.replace(/"/g, "'")}">\n${input.text}\n</document>`]
  if (input.aiNotes.length) parts.push(`AI notes (instructions pinned to the text):\n${input.aiNotes.map((n) => `${n.n}. On «${n.quote}»: ${n.body}`).join('\n')}`)
  if (input.personalNotes.length)
    parts.push(`The writer's own notes (context only, not instructions):\n${input.personalNotes.map((n) => `- On «${n.quote}»: ${n.body ?? ''}`).join('\n')}`)
  const turns = input.history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => (m.role === 'user' ? `writer: ${m.text}` : `you: ${m.text}`))
  if (turns.length) parts.push(`The conversation so far:\n${turns.join('\n')}`)
  parts.push(`The writer's message:\n${input.message || '(no message; act on the AI notes)'}`)
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: parts.join('\n\n') },
  ]
}

export interface AssistantReply {
  answer: string
  proposals: { quote: string; replacement: string; why: string; note: number | null }[]
  declined: string | null
}

// Tolerant parse: the first JSON object in the reply, every field checked.
export function parseReply(raw: string): AssistantReply {
  const body = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end <= start) {
    // A model that ignored the format but answered in prose: take it as an
    // answer with nothing proposed.
    if (body.trim()) return { answer: body.trim(), proposals: [], declined: null }
    throw new ReviewRequestError('The model returned nothing', 'parse', raw)
  }
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(body.slice(start, end + 1))
  } catch {
    throw new ReviewRequestError('The model returned malformed JSON', 'parse', raw)
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const proposals = (Array.isArray(obj.proposals) ? obj.proposals : [])
    .map((p: Record<string, unknown>) => ({ quote: str(p.quote), replacement: str(p.replacement), why: str(p.why), note: typeof p.note === 'number' ? p.note : null }))
    .filter((p) => p.quote.trim() && p.quote !== p.replacement)
  const declined = str(obj.declined).trim() || null
  return { answer: str(obj.answer).trim(), proposals: declined ? [] : proposals, declined }
}

// Proposals as review flags: anchored to the text (first unclaimed place,
// tolerant of retyped whitespace and Farsi spellings); one the model quoted
// wrongly becomes a note, decided by dismissing it.
export function toFlags(text: string, reply: AssistantReply): ReviewFlag[] {
  const claimed: Range[] = []
  return reply.proposals.map((p) => {
    const r = anchorQuote(text, p.quote, claimed)
    if (r) claimed.push(r)
    const id = p.note ? `ai note ${p.note}` : 'chat'
    const base = { key: crypto.randomUUID(), id, family: 'chat' as const, rationale: p.why, status: 'pending' as const }
    if (!r) return { ...base, kind: 'flag' as const, spanStart: null, spanEnd: null, before: p.quote, after: null, rationale: `${p.why}${p.why ? ' ' : ''}Proposed: "${p.replacement}"` }
    return { ...base, kind: p.replacement === '' ? ('delete' as const) : ('replace' as const), spanStart: r.start, spanEnd: r.end, before: text.slice(r.start, r.end), after: p.replacement }
  })
}

export async function ask(provider: Provider, chain: string[], key: string, input: AskInput, signal?: AbortSignal) {
  const { content, model } = await chat(provider, chain, key, buildMessages(input), signal)
  return { reply: parseReply(content), model }
}
