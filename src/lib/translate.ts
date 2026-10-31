// Translating a selection (Phase 16; research in docs/research/
// phase-16-2026-10.md): Google Cloud Translation Basic (v2), straight from
// the browser with the person's own key — in a header, never in the URL.
// Machine translation, no AI.

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'

export const LANGUAGES: Record<string, string> = {
  en: 'english',
  fa: 'farsi',
  ar: 'arabic',
  fr: 'french',
  de: 'german',
  es: 'spanish',
  tr: 'turkish',
}

export type TranslateResult = { ok: true; text: string; from: string } | { ok: false; reason: 'rejected' | 'offline' | 'failed'; message?: string }

export async function translate(text: string, target: string, key: string, signal?: AbortSignal): Promise<TranslateResult> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({ q: text, target, format: 'text' }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return { ok: false, reason: 'offline' }
  }
  const body = (await res.json().catch(() => null)) as {
    data?: { translations?: { translatedText: string; detectedSourceLanguage?: string }[] }
    error?: { message?: string }
  } | null
  if (res.ok && body?.data?.translations?.[0]) {
    const t = body.data.translations[0]
    return { ok: true, text: t.translatedText, from: t.detectedSourceLanguage ?? '' }
  }
  const message = body?.error?.message
  return { ok: false, reason: res.status === 400 || res.status === 401 || res.status === 403 ? 'rejected' : 'failed', message }
}

// A key works if it translates one word.
export async function testTranslateKey(key: string): Promise<{ ok: true } | { ok: false; reason: 'rejected' | 'offline' | 'failed'; message?: string }> {
  const r = await translate('hello', 'fa', key)
  return r.ok ? { ok: true } : r
}
