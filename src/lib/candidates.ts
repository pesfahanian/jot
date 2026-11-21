// Spelling candidates: the words a typo could have meant, before Jot ranks
// them (lib/spelling.ts). Ported from nspell's suggest() (MIT, © 2016 Titus
// Wormer, github.com/wooorm/nspell) so that English keeps exactly the
// suggestions it had while nspell was the engine (open decision #30): the
// same replacement table, keyboard groups, doubled letters and one- then
// two-letter edits, in the same order. Only the dictionary lookup is
// passed in — Hunspell's, since the language packs.

export interface AffixHints {
  // REP: common misspellings, [from, to].
  rep: [string, string][]
  // KEY: groups of neighbouring keys.
  key: string[]
  // TRY: letters to try inserting or replacing with, likeliest first.
  tryChars: string[]
  // ICONV: input conversions (e.g. ’ → ').
  iconv: [RegExp, string][]
}

const ALPHABET = 'etaoinshrdlcumwfgypbvkjxqz'.split('')
const DEFAULT_KEYS = ['qwertzuop', 'yxcvbnm', 'qaw', 'say', 'wse', 'dsx', 'sy', 'edr', 'fdc', 'dx', 'rft', 'gfv', 'fc', 'tgz', 'hgb', 'gv', 'zhu', 'jhn', 'hb', 'uji', 'kjm', 'jn', 'iko', 'lkm']

// The hints an .aff file gives, read as nspell read them.
export function affixHints(aff: string): AffixHints {
  const lines = aff.split(/\r?\n/)
  const rep: [string, string][] = []
  const key: string[] = []
  const iconv: [RegExp, string][] = []
  let tryChars: string[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/)
    const type = parts[0]
    if (type === 'REP' || type === 'ICONV') {
      const count = i + parseInt(parts[1], 10)
      while (++i <= count && i < lines.length) {
        const p = lines[i].split(/\s+/)
        if (type === 'REP') rep.push([p[1], p[2]])
        else iconv.push([new RegExp(p[1], 'g'), p[2]])
      }
      i--
    } else if (type === 'TRY') {
      const source = parts[1] ?? ''
      tryChars = [...source].filter((c) => c.toLowerCase() === c)
      // Some dictionaries forget a letter (en forgets j, x and y).
      for (const c of ALPHABET) if (!source.includes(c)) tryChars.push(c)
    } else if (type === 'KEY') {
      key.push(...(parts[1] ?? '').split('|'))
    }
  }
  return { rep, key: key.length ? key : DEFAULT_KEYS, tryChars: tryChars ?? [...ALPHABET], iconv }
}

const casing = (value: string): 'l' | 'u' | 's' | null => {
  const exact = (v: string) => (v === v.toLowerCase() ? 'l' : v === v.toUpperCase() ? 'u' : null)
  const head = exact(value.charAt(0))
  const rest = value.slice(1)
  if (!rest) return head
  const r = exact(rest)
  if (head === r) return head
  if (head === 'u' && r === 'l') return 's'
  return null
}

// Candidates for `value`, best first by nspell's weighting (a pre-generated
// edit counts ten, every route that reaches a word adds one). `known` says
// whether the dictionary would suggest a word.
// `twoEdits` false skips the slow two-edit search (the packs, where
// Hunspell's own suggestions cover it).
export function candidates(raw: string, hints: AffixHints, known: (word: string) => boolean, twoEdits = true): string[] {
  let value = raw.trim()
  for (const [re, to] of hints.iconv) value = value.replace(re, to)
  if (!value || known(value)) return []
  const currentCase = casing(value)
  const edits: string[] = []

  // The replacement table.
  for (const [from, to] of hints.rep) {
    let offset = value.indexOf(from)
    while (offset > -1) {
      edits.push(value.replace(from, to))
      offset = value.indexOf(from, offset + 1)
    }
  }

  // Neighbouring keys.
  for (let index = 0; index < value.length; index++) {
    const character = value.charAt(index)
    const before = value.slice(0, index)
    const after = value.slice(index + 1)
    const insensitive = character.toLowerCase()
    const upper = insensitive !== character
    const added: Record<string, boolean> = {}
    for (const group of hints.key) {
      const position = group.indexOf(insensitive)
      if (position < 0) continue
      for (let o = 0; o < group.length; o++) {
        if (o === position) continue
        let other = group.charAt(o)
        if (added[other]) continue
        added[other] = true
        if (upper) other = other.toUpperCase()
        edits.push(before + other + after)
      }
    }
  }

  // A doubled letter typed once, or a single one twice, up to three times.
  {
    let nextCharacter = value.charAt(0)
    const values = ['']
    let max = 1
    let distance = 0
    for (let index = 0; index < value.length; index++) {
      const character = nextCharacter
      nextCharacter = value.charAt(index + 1)
      const replacement = character === nextCharacter ? '' : character + character
      const count = values.length
      for (let offset = 0; offset < count; offset++) {
        if (offset <= max) values.push(values[offset] + replacement)
        values[offset] += character
      }
      if (++distance < 3) max = values.length
    }
    edits.push(...values)
  }

  // The word as typed, capitalised and in capitals.
  const values = [value]
  const lower = value.toLowerCase()
  if (value === lower || currentCase === null) values.push(value.charAt(0).toUpperCase() + lower.slice(1))
  const upperAll = value.toUpperCase()
  if (value !== upperAll) values.push(upperAll)

  const state = new Map<string, boolean>()
  const weighted = new Map<string, number>()
  const suggestions: string[] = []
  const tryChars = hints.tryChars

  const check = (word: string, result: string[], double = false) => {
    let s = state.get(word)
    if (s === undefined) {
      result.push(word)
      s = known(word)
      state.set(word, s)
      if (s) {
        weighted.set(word, double ? 10 : 0)
        suggestions.push(word)
      }
    }
    if (s) weighted.set(word, weighted.get(word)! + 1)
  }

  const switchCase = (fragment: string) => {
    const first = fragment.charAt(0)
    return (first.toLowerCase() === first ? first.toUpperCase() : first.toLowerCase()) + fragment.slice(1)
  }

  const generate = (words: string[], pre?: string[]) => {
    const result: string[] = []
    if (pre) for (const e of pre) check(e, result, true)
    for (const word of words) {
      let before = ''
      let character = ''
      let nextCharacter = word.charAt(0)
      let nextAfter = word
      let nextNextAfter = word.slice(1)
      let nextUpper = nextCharacter.toLowerCase() !== nextCharacter
      const wordCase = casing(word)
      for (let position = 0; position <= word.length; position++) {
        before += character
        const after = nextAfter
        nextAfter = nextNextAfter
        nextNextAfter = nextAfter.slice(1)
        character = nextCharacter
        nextCharacter = word.charAt(position + 1)
        const upper = nextUpper
        if (nextCharacter) nextUpper = nextCharacter.toLowerCase() !== nextCharacter
        if (nextAfter && upper !== nextUpper) {
          check(before + switchCase(nextAfter), result)
          check(before + switchCase(nextCharacter) + switchCase(character) + nextNextAfter, result)
        }
        check(before + nextAfter, result)
        if (nextAfter) check(before + nextCharacter + character + nextNextAfter, result)
        for (let inject of tryChars) {
          if (upper && inject !== inject.toUpperCase()) {
            if (wordCase !== 's') {
              check(before + inject + after, result)
              check(before + inject + nextAfter, result)
            }
            inject = inject.toUpperCase()
            check(before + inject + after, result)
            check(before + inject + nextAfter, result)
          } else {
            check(before + inject + after, result)
            check(before + inject + nextAfter, result)
          }
        }
      }
    }
    return result
  }

  const firstLevel = generate(values, edits)

  // Nothing one edit away: two edits, a batch at a time.
  let previous = 0
  const max = Math.min(firstLevel.length, Math.pow(Math.max(15 - value.length, 3), 3))
  const size = Math.max(Math.pow(10 - value.length, 3), 1)
  while (twoEdits && !suggestions.length && previous < max) {
    generate(firstLevel.slice(previous, previous + size))
    previous += size
  }

  suggestions.sort((a, b) => {
    const wa = weighted.get(a)!
    const wb = weighted.get(b)!
    if (wa !== wb) return wa > wb ? -1 : 1
    const ca = casing(a)
    const cb = casing(b)
    if (ca !== cb) {
      if (ca === currentCase) return -1
      if (cb === currentCase) return 1
    }
    return a.localeCompare(b)
  })

  const out: string[] = []
  const seen = new Set<string>()
  for (const s of suggestions) {
    const l = s.toLowerCase()
    if (!seen.has(l)) {
      out.push(s)
      seen.add(l)
    }
  }
  return out
}
