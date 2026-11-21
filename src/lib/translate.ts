// Translating a selection (Phase 16; research in docs/research/
// phase-16-2026-10.md): Google Cloud Translation Basic (v2), straight from
// the browser with the person's own key — in a header, never in the URL.
// Machine translation, no AI.

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'

// Google's languages (Cloud Translation v2), by name.
export const LANGUAGES: Record<string, string> = {
  af: 'afrikaans',
  sq: 'albanian',
  am: 'amharic',
  ar: 'arabic',
  hy: 'armenian',
  az: 'azerbaijani',
  eu: 'basque',
  be: 'belarusian',
  bn: 'bengali',
  bs: 'bosnian',
  bg: 'bulgarian',
  ca: 'catalan',
  ceb: 'cebuano',
  'zh-CN': 'chinese (simplified)',
  'zh-TW': 'chinese (traditional)',
  co: 'corsican',
  hr: 'croatian',
  cs: 'czech',
  da: 'danish',
  nl: 'dutch',
  en: 'english',
  eo: 'esperanto',
  et: 'estonian',
  fa: 'farsi',
  fi: 'finnish',
  fr: 'french',
  fy: 'frisian',
  gl: 'galician',
  ka: 'georgian',
  de: 'german',
  el: 'greek',
  gu: 'gujarati',
  ht: 'haitian creole',
  ha: 'hausa',
  haw: 'hawaiian',
  he: 'hebrew',
  hi: 'hindi',
  hmn: 'hmong',
  hu: 'hungarian',
  is: 'icelandic',
  ig: 'igbo',
  id: 'indonesian',
  ga: 'irish',
  it: 'italian',
  ja: 'japanese',
  jv: 'javanese',
  kn: 'kannada',
  kk: 'kazakh',
  km: 'khmer',
  rw: 'kinyarwanda',
  ko: 'korean',
  ku: 'kurdish',
  ckb: 'kurdish (sorani)',
  ky: 'kyrgyz',
  lo: 'lao',
  la: 'latin',
  lv: 'latvian',
  lt: 'lithuanian',
  lb: 'luxembourgish',
  mk: 'macedonian',
  mg: 'malagasy',
  ms: 'malay',
  ml: 'malayalam',
  mt: 'maltese',
  mi: 'maori',
  mr: 'marathi',
  mn: 'mongolian',
  my: 'myanmar (burmese)',
  ne: 'nepali',
  no: 'norwegian',
  ny: 'nyanja',
  or: 'odia',
  ps: 'pashto',
  pl: 'polish',
  pt: 'portuguese',
  pa: 'punjabi',
  ro: 'romanian',
  ru: 'russian',
  sm: 'samoan',
  gd: 'scots gaelic',
  sr: 'serbian',
  st: 'sesotho',
  sn: 'shona',
  sd: 'sindhi',
  si: 'sinhala',
  sk: 'slovak',
  sl: 'slovenian',
  so: 'somali',
  es: 'spanish',
  su: 'sundanese',
  sw: 'swahili',
  sv: 'swedish',
  tl: 'tagalog',
  tg: 'tajik',
  ta: 'tamil',
  tt: 'tatar',
  te: 'telugu',
  th: 'thai',
  tr: 'turkish',
  tk: 'turkmen',
  uk: 'ukrainian',
  ur: 'urdu',
  ug: 'uyghur',
  uz: 'uzbek',
  vi: 'vietnamese',
  cy: 'welsh',
  xh: 'xhosa',
  yi: 'yiddish',
  yo: 'yoruba',
  zu: 'zulu',
}

// Languages written right to left: text in one of these reads right to left.
const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'ckb'])
export const isRtlLanguage = (code: string) => RTL.has(code)

// A language's name; null is the source Google works out.
export const DETECT = 'detect'
export const languageName = (code: string | null) => (code ? (LANGUAGES[code] ?? code) : DETECT)

export type TranslateResult = { ok: true; text: string; from: string } | { ok: false; reason: 'rejected' | 'offline' | 'failed'; message?: string }

// `source` null: Google detects it.
export async function translate(text: string, target: string, key: string, signal?: AbortSignal, source: string | null = null): Promise<TranslateResult> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({ q: text, target, format: 'text', ...(source ? { source } : {}) }),
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
