import type { Provider } from '@/lib/db'
import { chat } from '@/review/providers'
import { ReviewRequestError, type ChatMessage } from '@/review/request'

// Full translation (round 4, frame 15): a document translated into a new
// one, section by section — by heading, or batches of paragraphs when there
// are none (designer's pushback), so a long note never becomes one slow
// request. Markdown, code, links and maths are kept as they are. No
// decisions: the result is a fresh draft.

export const TARGETS: Record<string, { name: string; native: string; note?: string }> = {
  fa: { name: 'Farsi', native: 'فارسی', note: 'Write natural, standard written Farsi: half-spaces (ZWNJ) where standard orthography puts them, Persian ی and ک, Persian punctuation (، ؛ ؟ « ») in Farsi sentences.' },
  en: { name: 'English', native: 'English' },
  ar: { name: 'Arabic', native: 'العربية' },
  fr: { name: 'French', native: 'français' },
  de: { name: 'German', native: 'Deutsch' },
  es: { name: 'Spanish', native: 'español' },
  tr: { name: 'Turkish', native: 'Türkçe' },
}

const MAX = 2400

// The document in pieces that keep their own markdown whole: split before
// each heading; a section still too long is split at blank lines between
// paragraphs (never inside a fenced block).
export function sections(text: string): string[] {
  const lines = text.split('\n')
  const parts: string[][] = [[]]
  let fence: string | null = null
  for (const line of lines) {
    const f = line.match(/^\s*(`{3,}|~{3,})/)
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1]
    if (!fence && !f && /^#{1,6}\s/.test(line) && parts[parts.length - 1].some((l) => l.trim())) parts.push([])
    parts[parts.length - 1].push(line)
  }
  const out: string[] = []
  for (const p of parts) {
    const s = p.join('\n')
    if (s.length <= MAX) {
      out.push(s)
      continue
    }
    // Paragraph batches.
    let batch: string[] = []
    let size = 0
    let inFence: string | null = null
    for (const line of p) {
      const f = line.match(/^\s*(`{3,}|~{3,})/)
      if (f) inFence = inFence ? (line.trim().startsWith(inFence) ? null : inFence) : f[1]
      if (!inFence && !line.trim() && size > MAX) {
        out.push(batch.join('\n'))
        batch = []
        size = 0
      }
      batch.push(line)
      size += line.length + 1
    }
    if (batch.length) out.push(batch.join('\n'))
  }
  // Sections join back with a newline, exactly.
  return out
}

export function translateMessages(section: string, target: string, title: string, at: number, of: number): ChatMessage[] {
  const t = TARGETS[target] ?? { name: target, native: target }
  return [
    {
      role: 'system',
      content: `You translate one part of a markdown document into ${t.name}. Keep the markdown exactly as it is: headings, lists, tables, emphasis, blank lines and line breaks. Translate link text and image alt text, never URLs. Leave inline code, fenced code blocks, maths ($…$, $$…$$) and Mermaid diagrams untouched. Keep names, product names and keyboard shortcuts as they are. ${t.note ?? ''} Translate everything else; add nothing, leave nothing out, no notes of your own.

Reply with only this JSON object: {"translation": "..."}`,
    },
    { role: 'user', content: `Document: "${title}", part ${at} of ${of}.\n\n${section}` },
  ]
}

export function parseTranslation(raw: string): string {
  const body = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1))
      if (typeof obj.translation === 'string') return obj.translation
    } catch {
      /* not our JSON: take the reply as it is */
    }
  }
  if (!body.trim()) throw new ReviewRequestError('The model returned nothing', 'parse', raw)
  return body.replace(/^```(?:markdown|md)?\n([\s\S]*)\n```\s*$/, '$1')
}

export async function translateSection(provider: Provider, chainList: string[], key: string, section: string, target: string, title: string, at: number, of: number, signal?: AbortSignal) {
  if (!section.trim()) return { text: section, model: '' }
  const { content, model } = await chat(provider, chainList, key, translateMessages(section, target, title, at, of), signal)
  return { text: parseTranslation(content), model }
}
