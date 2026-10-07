// Whether a document is worth reviewing (owner, after Phase 13). The review
// declines rather than flag text the guide can't meaningfully apply to.
// Jot decides what counting can — too little prose, only code — before any
// call and before asking for a key; the model decides what it can't
// (gibberish, placeholder text, a data dump), by answering {"skip": …}
// (sharedCall.ts). "review anyway" overrides both.

// Fewer words of prose than this and there's nothing for the guide to judge.
export const MIN_PROSE_WORDS = 30

const FENCE = /^[ \t>]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n[ \t>]*\1[ \t]*(?=\n|$)|$(?![\s\S]))/gm

// The prose itself: front matter, code, math, HTML comments and bare links
// taken out.
function proseOnly(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, ' ')
    .replace(FENCE, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/g, ' ')
}

// Words of prose. A word is a run of letters, in any script.
export function proseWords(md: string): number {
  const text = proseOnly(md)
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

// Which guide reviews a document (Farsi support, owner): the gate counts
// the letters of each script in the prose — before any call — and the
// majority decides. A Farsi essay with English terms, code and links is
// Farsi; a genuinely mixed document goes to its majority language's guide.
export function reviewLanguage(md: string): 'en' | 'fa' {
  const text = proseOnly(md)
  const fa = (text.match(/\p{Script=Arabic}/gu) ?? []).length
  const latin = (text.match(/\p{Script=Latin}/gu) ?? []).length
  return fa > latin ? 'fa' : 'en'
}

