// Counts shown for the focused pane's document (§1.8: every number is
// monospace). Grouped with commas — "1,904" — by the owner's call, over the
// narrow space 8a draws.
export const groupDigits = (n: number) => n.toLocaleString('en-US')

export function countText(text: string) {
  return {
    bytes: new TextEncoder().encode(text).length,
    chars: [...text].length,
    // A word runs on through vowel marks and the Farsi half-space (ZWNJ):
    // می‌روم is one word, not two.
    words: (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’_\u200c\u200d-]*/gu) ?? []).length,
    lines: text.split('\n').length,
    paras: text.split(/\n[ \t]*\n/).filter((p) => p.trim()).length,
  }
}
