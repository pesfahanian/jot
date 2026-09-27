# Browser support (T6.5)

Jot runs anywhere IndexedDB and a current CSS engine exist — ADR-003 rules out Chromium-only APIs, and the code audit below confirms none are used.

## Minimum versions

| Browser | Minimum | Set by |
|---|---|---|
| Chrome / Edge / Brave | 111 | Tailwind v4 (oklch, `color-mix`, `@property`, cascade layers) |
| Safari | 16.4 | Tailwind v4, and one regex lookbehind in the review's Pass A |
| Firefox | 128 | Tailwind v4 |

## Features in use (audited 2026-09-27)

| Feature | Where | Chrome | Safari | Firefox |
|---|---|---|---|---|
| IndexedDB (via Dexie), `IDBTransaction.commit()` | storage, unload-safe autosave | ✓ | 15+ | 74+ |
| `crypto.randomUUID` | document ids | 92+ | 15.4+ | 95+ |
| Regex `\p{L}` / lookbehind `(?<=)` | word counts, Pass A | ✓ | 11.1+ / 16.4+ | 78+ |
| `ResizeObserver`, `MutationObserver`, `AbortController`, `TextEncoder`, pointer capture | panes, editor, review | ✓ | ✓ | ✓ |
| `contenteditable` + `spellcheck` | native spellcheck (ADR-002) | ✓ | ✓ | ✓ |
| Hidden-iframe `print()` | PDF export | ✓ | ✓ | ✓ |
| CSS oklch, `color-mix`, `@property`, `@layer` | all tokens | 111+ | 16.4+ | 128+ |
| `@container` queries | review toolbar | 105+ | 16+ | 110+ |
| `:has()`, `svh` | shadcn menus, layout | ✓ | 15.4+ | 121+ / 101+ |
| `scrollbar-color` / `scrollbar-width` | thin themed scrollbars | 121+ | **no** — falls back to the system overlay scrollbar | 64+ |

Not used anywhere: File System Access API, `requestIdleCallback`, `structuredClone`, WebUSB/Serial/HID, or any `navigator.*` Chromium extension.

## Verification status

| Browser | How | Result |
|---|---|---|
| Chromium (Claude app browser, Chrome 152 engine) | Every phase's checks, dev and production builds | Passes |
| Firefox 152 (installed) | Code audit above; automated run blocked — launching it needs to run outside the tool sandbox, which was declined | **Manual check pending** |
| Safari 27 (installed) | Code audit above; automation needs "Allow Remote Automation" in Safari's settings, the owner's to change | **Manual check pending** |

Manual check, ~2 minutes per browser, against `pnpm build && pnpm preview` (http://localhost:4173):

1. First run shows "No documents yet"; **new document** → type a name → Enter → type a line.
2. Reload — the line is still there, same tab open.
3. Misspell a word — red underline, right-click offers corrections.
4. **theme** cell cycles light → dark → system; everything recolors.
5. **split**, right-click a file → pick a color, search a word from your line.
6. **export ▾ → Plain text** downloads a .txt; **PDF** opens the print dialog.
7. Narrow the window below 1000 px — only the "wider" message shows; widen it back.
