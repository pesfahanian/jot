// Counts shown for the focused pane's document (§1.8: every number is
// monospace). Grouped with a narrow no-break space, as 8a draws "1 904".
export const groupDigits = (n: number) => n.toLocaleString('en-US').replace(/,/g, ' ')

export function countText(text: string) {
  return {
    bytes: new TextEncoder().encode(text).length,
    chars: [...text].length,
    words: (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? []).length,
    lines: text.split('\n').length,
    paras: text.split(/\n[ \t]*\n/).filter((p) => p.trim()).length,
  }
}
