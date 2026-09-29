<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/tile-dark.svg">
    <img src="public/tile-light.svg" width="96" height="96" alt="jot">
  </picture>
</p>

<h1 align="center">jot</h1>

<p align="center">A minimal, local-first markdown editor with an AI style review.<br>No backend, no account: everything stays in your browser.</p>

---

Jot is a personal writing tool built to replace [StackEdit](https://stackedit.io): a quiet place to write markdown, with a VSCode-grade editor, a live rendered view, and an optional AI review that checks your prose against a machine-verifiable style guide — and never changes a word without your say-so.

## Features

**Writing**
- CodeMirror 6 editor with VSCode keybindings, multi-cursor, find and replace, and the browser's own spellchecker
- Markdown highlighting, with code blocks coloured by their language (` ```py `, ` ```ts `, ` ```sh `, …)
- List continuation on Enter — bullets, numbers and tasks
- Markdown formatter (Prettier) in a fixed house style
- Minimap, and continuous autosave — there is no "unsaved" state

**Organising**
- Documents in a sidebar with search (titles and full text), sorting, pinning and six colour tags
- Tabs in up to three side-by-side panes; drag tabs to reorder, move between panes, or split into a new column — and drag documents in from the sidebar
- Import by dropping `.md` files anywhere; export to Markdown, plain text or PDF

**Reading**
- A live rendered view (GitHub-flavoured markdown) as its own tab, scroll-synced to the editor by source line
- Light, dark and system themes

**AI style review** (optional, bring your own key)
- Reviews a document against a bundled style guide: mechanical fixes, fixes that need your judgment, patterns worth a second look, and spelling / grammar / punctuation
- Every flag needs an explicit decision; nothing applies until you press **apply**, and one undo reverses it
- Runs on [OpenRouter](https://openrouter.ai) or [Google AI Studio](https://aistudio.google.com) with your own API key; the tab's icon shows when a review running in the background is done

## Privacy and security

- **Your documents never leave your browser.** They live in IndexedDB on your device. There is no server, no sync and no analytics.
- **API keys are stored in your browser only** and sent only to the provider you chose, and only when you test the key or run a review. The review sends that one document's text to that provider.
- **A strict Content-Security-Policy** (`public/_headers`) limits the app to its own code and to the two AI providers' APIs, so injected script couldn't send your keys anywhere else.
- Raw HTML in documents is shown as text, never executed.

Because data is stored per website, the same browser at a different address (or a different browser) starts empty. Export your documents as `.md` to move them.

## Keyboard

| Keys | Action |
|---|---|
| `Cmd/Ctrl + Shift + V` | Toggle the rendered view |
| `Cmd/Ctrl + Shift + I` or `Shift + Option/Alt + F` | Format the document |
| `Cmd/Ctrl + F` | Find and replace |
| `Cmd/Ctrl + S` | Nothing — every edit is already saved |

Everything else follows VSCode's defaults.

## Getting started

Requires Node 22+ and pnpm (the version is pinned in `package.json`; `corepack enable` provides it).

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

```bash
pnpm build      # production build into dist/
pnpm preview    # serve dist/ with the production security headers
pnpm test       # unit tests (vitest)
pnpm lint       # oxlint
```

Jot is desktop-only: below 1000px wide it asks for a wider window.

## Deploying

The build is a static site. On **Cloudflare Pages**: build command `pnpm build`, output directory `dist`. The Node version comes from `.node-version`, and `public/_headers` is applied automatically. Any static host works; carry over the headers in `_headers` for the same protection.

## Project documents

`docs/` holds the product and design record: the PRD/TRD (`jot-prd-trd.md`), architecture decisions (`jot-adrs.md`), the phased build plan (`jot-tickets.md`), open decisions, a far-future to-do list, and the design canvases. `CLAUDE.md` maps the codebase. The AI review's rule set is in `src/review/ruleset/`.

## Credits

Built with [CodeMirror](https://codemirror.net), [React](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Dexie](https://dexie.org), [marked](https://marked.js.org), [Prettier](https://prettier.io) and [Lucide](https://lucide.dev) icons. Inspired by StackEdit, with no code taken from it.

## License

[MIT](LICENSE) © Parsa Esfahanian
