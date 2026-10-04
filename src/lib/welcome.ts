import { createDocument, getDocument } from './documents'
import { getSettings, updateSettings } from './settings'

// The guide is a document (Phase 10): on a true first run Jot creates and
// opens "welcome to jot", a short tour that uses each feature it describes.
// It's the person's own document from then on — edit it, keep it, delete
// it. The guide card (sidebar foot "?") can bring it back.
//
// First run = no welcomedAt flag in settings and no documents. Existing
// workspaces (documents but no flag) just get the flag, and nothing else.

export const WELCOME_TITLE = 'welcome to jot'

export const WELCOME_CONTENT = String.raw`# welcome to jot

A quiet place to write markdown. This document is a short tour, and it's yours: edit it, keep it, or delete it. You can always get it back from the **?** at the bottom of the sidebar.

## writing

Everything is saved as you type. There's no save button, and Cmd/Ctrl + S does nothing on purpose.

- Lists continue when you press Enter.
  1. Numbered items count up by themselves.
  2. Enter on an empty item ends the list.
- [ ] Tasks work too.
- [x] Like this one.

Cmd/Ctrl + Shift + I tidies the whole document: bullets, emphasis and table columns. One undo reverses it.

The icon at the far left of the bar at the bottom shows or hides the minimap.

## seeing it rendered

Press Cmd/Ctrl + Shift + V to open the rendered view beside this one. It scrolls along with the editor.

Math is written in LaTeX, inline like $a^2 + b^2 = c^2$ or on its own:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

Diagrams are written in Mermaid:

` + '```' + String.raw`mermaid
flowchart LR
  write --> render --> export
` + '```' + String.raw`

Code is coloured by its language:

` + '```' + String.raw`py
def greet(name):
    return f"hello, {name}"
` + '```' + String.raw`

| shortcut | does |
|---|---|
| Cmd/Ctrl + Shift + V | rendered view |
| Cmd/Ctrl + Shift + I | format the document |
| Cmd/Ctrl + F | find and replace |

## organising

- The sidebar holds your documents. **+** makes a new one, and the icons beside it sort, filter by colour tag and search.
- Right-click a document to tag it with a colour, rename, pin or delete it. Double-click it to rename.
- Drag tabs to reorder them, or onto another pane. Drop one on a pane's left or right edge for a new column, or on its top or bottom edge to stack two panes, up to three columns of two. Documents drag in from the sidebar too.
- Drag the gaps between panes to resize them. Double-click a gap to even it out.
- Drop .md files anywhere to import them. The **export** menu saves Markdown, plain text or PDF, and, set apart below those, the whole workspace as one .zip.

## the style review

jot can review your prose against a style guide, using your own AI key.

1. Click **AI Provider** at the bottom of the sidebar, pick a provider (OpenRouter, Google AI Studio, OpenAI or Anthropic) and add your key. Below the key you can choose the model, and fallbacks to try if it's busy.
2. Press **review style** in the bar at the bottom.
3. Click each marked passage to accept, reject or rewrite it. Nothing changes until you press **apply**.

The **?** beside the review's colour key explains each kind of suggestion. Very short documents, or ones that are all code, are skipped; **review anyway** overrides that.

## where your writing lives

Everything stays in this browser. There's no account and no server, and your key only ever goes to the provider you chose.

That makes this browser the only copy. Each browser, profile and installed app keeps its own separate workspace, and clearing site data erases it. So now and then, export the whole workspace as a .zip: it's your backup, and dropping it on jot brings everything back, alongside whatever is already here. Safari deletes a site's data on its own after a week without use, so jot is better in Chrome, Firefox or Edge.
`

// Once per app load: guards React's double-run of effects in development.
let firstRun: Promise<void> | undefined

// Runs when the document list is first known. Creates the welcome document
// on a true first run; marks an existing workspace as already welcomed.
export function welcomeIfFirstRun(documentCount: number): Promise<void> {
  firstRun ??= (async () => {
    const settings = await getSettings()
    if (settings.welcomedAt) return
    if (documentCount > 0) return void (await updateSettings({ welcomedAt: Date.now() }))
    const doc = await createDocument({ title: WELCOME_TITLE, content: WELCOME_CONTENT })
    await updateSettings({ welcomedAt: Date.now(), welcomeDocId: doc.id })
  })()
  return firstRun
}

// The guide card's "open the welcome document": the person's own copy if it
// still exists (edited or renamed, found by id), else a fresh one.
export async function welcomeDocumentId(): Promise<string> {
  const { welcomeDocId } = await getSettings()
  if (welcomeDocId && (await getDocument(welcomeDocId))) return welcomeDocId
  const doc = await createDocument({ title: WELCOME_TITLE, content: WELCOME_CONTENT })
  await updateSettings({ welcomeDocId: doc.id, welcomedAt: Date.now() })
  return doc.id
}
