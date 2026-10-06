// The letter or digit a shortcut means, whatever keyboard layout is active.
// On a Persian (or any non-Latin) layout, Cmd/Ctrl+S reports e.key as a
// Persian letter, so matching e.key alone never fires. When e.key isn't a
// plain ASCII letter or digit, the physical key (e.code, "KeyS") decides —
// and only then, so AZERTY and QWERTZ still match by the letter they type
// (Farsi research §7). CodeMirror's own keymaps already fall back this way.
export function shortcutKey(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const key = e.key.toLowerCase()
  if (/^[a-z0-9]$/.test(key)) return key
  const code = e.code.match(/^(?:Key([A-Z])|Digit([0-9]))$/)
  return code ? (code[1] ?? code[2]).toLowerCase() : key
}
