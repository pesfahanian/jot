// The favicon as a status light for the style review (owner's request, like
// Claude.ai's): while a review runs, the dotted j wears a grey badge; if a
// review finishes or fails while Jot's tab is in the background, the badge
// turns accent (done) or red (failed) — and clears when the person comes
// back. Files are in public/, drawn in docs/design/logo.

export type FaviconState = 'idle' | 'running' | 'done' | 'failed'

let current: FaviconState = 'idle'

export function setFavicon(state: FaviconState) {
  if (state === current) return
  current = state
  const suffix = state === 'idle' ? '' : `-${state}`
  const set = (which: string, href: string) => document.querySelector<HTMLLinkElement>(`link[data-favicon="${which}"]`)?.setAttribute('href', href)
  set('svg', `/favicon${suffix}.svg`)
  set('light', `/favicon${suffix}-32-light.png`)
  set('dark', `/favicon${suffix}-32-dark.png`)
}
