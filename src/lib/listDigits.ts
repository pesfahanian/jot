// Numbered lists written in Persian (۱. ۲.) or Arabic-Indic (١. ٢.) digits
// (friend's feedback, 2026-11-21). Markdown counts only 0–9 as list numbers,
// so on a Persian keyboard "۱. …" lines ran together as one paragraph. The
// editor's parser and list continuation are patched to take these digits
// (patches/); the renderer reads the list numbers through this map. The
// document itself is never changed, so other markdown apps still see text.

const PERSIAN = /[۰-۹]/g
const ARABIC = /[٠-٩]/g
const toAscii = (s: string) => s.replace(PERSIAN, (c) => String(c.charCodeAt(0) - 0x6f0)).replace(ARABIC, (c) => String(c.charCodeAt(0) - 0x660))

// A list number at the start of a line: after any indent and quote markers,
// up to nine digits of one kind, then "." or ")" and a space or the line's end.
const MARKER = /^([ \t]*(?:>[ \t]?)*[ \t]*)([۰-۹]{1,9}|[٠-٩]{1,9})(?=[.)](?:[ \t]|$))/
const FENCE = /^[ \t>]*(`{3,}|~{3,})/

// The same text with every such list number in 0–9. One digit for one
// digit, so every offset (scroll sync, annotations) stays where it was.
// Fenced code is left as written.
export function asciiListNumbers(md: string): string {
  if (!/[۰-۹٠-٩]/.test(md)) return md
  let fence: string | null = null
  return md
    .split('\n')
    .map((line) => {
      const f = FENCE.exec(line)
      if (fence) {
        if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.slice(f[0].length).trim()) fence = null
        return line
      }
      if (f) {
        fence = f[1]
        return line
      }
      return line.replace(MARKER, (_, lead: string, digits: string) => lead + toAscii(digits))
    })
    .join('\n')
}
