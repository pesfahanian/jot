# Performance baseline (T6.3)

Measured 2026-09-27 on the production build (`pnpm build`, served by `pnpm preview`), Chromium, macOS. Heap figures are `performance.memory.usedJSHeapSize` read ~2 s after load, with no forced GC — expect ±2 MB of noise between readings. ADR-005 set no numeric target beyond "light"; this records where the app actually stands so later changes can be compared against it.

## Bundle

| | Before T6.3 | After T6.3 |
|---|---|---|
| Main JS (minified) | 1,043 KB | 904 KB |
| Main JS (gzip) | 337 KB | 291 KB |
| CSS (gzip) | 9 KB | 9 KB |
| Fonts | 6 × woff2 (Latin only), ~75 KB total | same |

Split out and loaded only on first use:

| Chunk | gzip | Loads when |
|---|---|---|
| `ruleset` (the 8 rule files) | 18 KB | a review runs or opens |
| `pipeline` (Pass A/B, prompt, assembly) | 10 KB | a review runs |
| `ReviewView` (review panes, bubbles, log) | 5 KB | a review opens |
| `marked` | 13 KB | the first PDF export |

What the main bundle is made of (unminified source): react-dom ~620 KB, CodeMirror (`view`, `state`, `language`, `commands`, `autocomplete`, `search`, `lint`) ~980 KB, Lezer ~195 KB, app code ~130 KB, Dexie ~95 KB, Radix menus/popover + floating-ui ~120 KB. `@codemirror/lint` comes in through the VSCode keymap's lint bindings; `lang-markdown`'s HTML/CSS/JS grammars were already excluded in Phase 2 (948 → 758 KB then).

## Load and memory

| Scenario | Heap used |
|---|---|
| First run, no documents | 5.5 MB |
| 12 documents (~2.4 KB each), editor open | 10.5–12.5 MB |
| 162 documents (T6.4 stress), editor open | ~27 MB |

Page parse to DOMContentLoaded: ~165 ms cold on first visit, ~50 ms warm. The editor is interactive within ~100 ms of script start on a warm load.

## Verified

- Initial load fetches a single JS file; the review and PDF chunks are fetched only when used (checked in the resource timeline).
- The lazy review path still works end to end (key test → run → review opens) on the production build.

## Stress (T6.4)

162 documents (150 imported at once by file drop, ~1–3 KB each), six of them with 110-character names.

| Check | Result |
|---|---|
| Import of 150 dropped files | ~0.8 s |
| Load with 162 documents | DOMContentLoaded ~60 ms, editor ready ~110 ms |
| Typing 64 characters by hand | no long tasks (> 50 ms) |
| Search across all 162 (2,729 matches) | ~50 ms to render, no long tasks |
| Sort toggle over 162 rows | ~30 ms |
| Long names | truncate with an ellipsis in sidebar rows, tabs (220 px cap) and the export footer (full name on hover); nothing overflows |
| Scrollbars | thin, in the edge color on a clear track, every scroll area, both themes |
