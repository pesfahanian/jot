// The command palette's matching (round 4, frame 4): documents and commands
// in one list. A match scores 3 at the start, 2 at a word's start, 1
// anywhere; whichever kind has the best match comes first (commands on a
// tie), so "tog" leads with toggles and "sa" with "sample outline".

export function matchScore(text: string, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  const at = t.indexOf(q)
  if (at === -1) return 0
  if (at === 0) return 3
  return t.split(/[\s:·\-–—/]+/).some((w) => w.startsWith(q)) ? 2 : 1
}

// Where the query sits in a title, for bolding it.
export function matchRange(text: string, query: string): [number, number] | null {
  const q = query.trim().toLowerCase()
  const at = q ? text.toLowerCase().indexOf(q) : -1
  return at === -1 ? null : [at, at + q.length]
}

// A short window of a matched line around the hit: "…toggle for the minimap…".
export function snippet(line: string, range: [number, number], around = 14): { text: string; range: [number, number] } {
  const from = Math.max(0, range[0] - around)
  const to = Math.min(line.length, range[1] + around)
  const lead = from > 0 ? '…' : ''
  const text = lead + line.slice(from, to) + (to < line.length ? '…' : '')
  const shift = lead.length - from
  return { text, range: [range[0] + shift, range[1] + shift] }
}
