// Whether a document is worth reviewing (owner, after Phase 13). The review
// declines rather than flag text the guide can't meaningfully apply to.
// Jot decides what counting can — too little prose, only code — before any
// call and before asking for a key; the model decides what it can't
// (gibberish, placeholder text, a data dump), by answering {"skip": …}
// (sharedCall.ts). "review anyway" overrides both.

// Fewer words of prose than this and there's nothing for the guide to judge.
export const MIN_PROSE_WORDS = 30

const FENCE = /^[ \t>]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t>]*\1[ \t]*(?=\n|$)|$(?![\s\S]))/gm

// Words of prose: what's left once front matter, code, math, HTML comments
// and bare links are taken out. A word is a run of letters, in any script.
export function proseWords(md: string): number {
  const text = md
    .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, ' ')
    .replace(FENCE, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/g, ' ')
  return (text.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? []).length
}

const hasCode = (md: string) => new RegExp(FENCE.source, 'm').test(md)

// Why Jot won't review this text, or null when it will.
export function declineReason(md: string): string | null {
  const n = proseWords(md)
  if (n >= MIN_PROSE_WORDS) return null
  if (n === 0 && hasCode(md)) return 'only code, no prose to review'
  if (n === 0) return 'no prose to review'
  return `too short: ${n} word${n === 1 ? '' : 's'} of prose, a review needs ${MIN_PROSE_WORDS}`
}
