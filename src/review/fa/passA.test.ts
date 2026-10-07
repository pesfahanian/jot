import { describe, expect, it } from 'vitest'
import checksMd from '../ruleset/fa/checks.md?raw'
import { countWordsFa, hedgeCount, isAntithesis, isDespite, isInstruction, isSweeping, runPassAFa, vagueAttributions } from './passA'

// The Farsi guide's own test tables (ruleset/fa/checks.md, every "#####
// … tests" table), run against the Farsi Pass A. The guide was written with
// these verified; this keeps the code and the guide in step.

interface Table {
  title: string
  rule: string | null
  header: string[]
  rows: string[][]
}

function tables(md: string): Table[] {
  const out: Table[] = []
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##### (.+)$/)
    if (!h) continue
    const rule = h[1].match(/^(FA-T1b?-\d+)/)?.[1] ?? null
    let j = i + 1
    while (j < lines.length && !lines[j].startsWith('|')) j++
    const header = cells(lines[j])
    const rows: string[][] = []
    // Rows; a row whose text has a line break continues on the next line.
    for (j += 2; j < lines.length && lines[j].startsWith('|'); j++) {
      let row = lines[j]
      while (!row.trimEnd().endsWith('|') && j + 1 < lines.length) row += '\n' + lines[++j]
      rows.push(cells(row))
    }
    out.push({ title: h[1], rule, header, rows })
  }
  return out
}

// Cells split on | outside code spans.
function cells(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let tick = 0
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '`') {
      let n = 1
      while (line[i + n] === '`') n++
      if (!tick) tick = n
      else if (tick === n) tick = 0
      cur += '`'.repeat(n)
      i += n - 1
      continue
    }
    if (c === '|' && !tick) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  return out.slice(1).map((c) => c.trim())
}

// The text inside a cell's first code span (`x` or `` x ``).
function code(cell: string): string {
  const dbl = cell.match(/^`` (.*?) ``/s)
  if (dbl) return dbl[1]
  return cell.match(/`([^`]*)`/s)?.[1] ?? cell
}

// "flags `a` → `b`; flags `c` → `d` — note", "flags `x`, fix by rewrite …",
// or "no flag — …".
function expected(cell: string) {
  const fixes = [...cell.matchAll(/`([^`]*)` → `([^`]*)`/g)].map((m) => [m[1], m[2]])
  const rewrites = [...cell.matchAll(/flags `([^`]*)`, fix by rewrite/g)].map((m) => m[1])
  return { fixes, rewrites }
}

const all = tables(checksMd)

describe('Farsi guide test tables', () => {
  it('found the tables', () => {
    expect(all.length).toBeGreaterThan(25)
  })

  for (const t of all) {
    describe(t.title, () => {
      for (const row of t.rows) {
        const input = code(row[0]).replace(/ ⏎ /g, '\n\n')
        it(input.slice(0, 60), () => {
          if (t.header[1] === 'Hedges') return expect(hedgeCount(input)).toBe(Number(row[1].match(/\d+/)![0]))
          if (t.header[1] === 'Words') {
            expect(countWordsFa(input)).toBe(Number(row[1]))
            if (row[2] !== '—') expect(isInstruction(input)).toBe(row[2] === 'yes')
            return
          }
          if (t.header[1] === 'Fires?') {
            const detect: Record<string, (s: string) => boolean> = {
              'FA-T1-23': isAntithesis,
              'FA-T1-24': isSweeping,
              'FA-T1-25': isDespite,
              'FA-T1b-08': (s) => vagueAttributions(s).length > 0,
            }
            return expect(detect[t.rule!](input)).toBe(row[1].startsWith('yes'))
          }
          // Flag tables: the rule's flags (span → after) and rewrite requests.
          const rule = t.rule ?? 'FA-T1-15' // the verb generator's table
          const a = runPassAFa(input)
          const got = a.flags.filter((f) => f.id === rule).map((f) => [f.span, f.after ?? ''])
          const want = expected(row[1])
          expect(got).toEqual(want.fixes)
          const rewrites = a.fixRequests.filter((f) => f.ruleId === rule).map((f) => f.span)
          expect(rewrites).toEqual(want.rewrites)
        })
      }
    })
  }
})
